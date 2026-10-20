import { test, expect } from '@playwright/test';
import { bootApp } from './support/bootApp';

// Menú de un recordatorio en el móvil: con «Más opciones» desplegado la hoja crece, pero no puede pasar de
// la pantalla visible ni tapar la fila de arriba, y su contenido se desplaza (antes arrastrar la hoja
// entera se llevaba el gesto y no se podía recorrer). «Empezar» queda en el icono cuando el título pasa a la barra.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

async function seed(page: any) {
  await bootApp(page);
  await page.evaluate(() => {
    const st = (window as any).useAppStore.getState();
    st.addList({ id: 'menu', name: 'Una lista con un nombre bastante largo', color: '#ff9500', listType: 'routines' });
    for (let i = 0; i < 14; i++) st.addTask({ id: `m${i}`, title: `Tarea ${i}`, categoryId: 'menu', status: 'pending', cycle_id: 'cycle_day', duration: 5, created_at: new Date().toISOString() });
  });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('select-view', { detail: 'list_menu' })));
  await expect(page.locator('.task-item-wrapper[data-task-id="m3"]')).toBeVisible();
}

test('la hoja con «Más opciones» cabe en la pantalla, se desplaza y deja ver la tarea', async ({ page }) => {
  await seed(page);
  await page.locator('.task-item-wrapper[data-task-id="m3"]').click({ button: 'right' });
  const sheet = page.locator('.ios-dropdown-menu');
  await expect(sheet).toBeVisible();
  await page.getByText('Más opciones...').click();
  const box = await sheet.evaluate((el) => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, scrollable: el.scrollHeight > el.clientHeight, vh: innerHeight }; });
  expect(box.top, 'deja sitio arriba para ver la tarea').toBeGreaterThanOrEqual(110);
  expect(box.bottom).toBeLessThanOrEqual(box.vh + 1);
  expect(box.scrollable, 'el contenido sobrante se desplaza').toBe(true);
  await sheet.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await expect(page.getByText('Eliminar recordatorio')).toBeInViewport();
});

test('con el título en la barra, «Empezar» se reduce al icono', async ({ page }) => {
  await seed(page);
  const start = page.getByRole('button', { name: 'Empezar lista' }).first();
  await expect(start).toContainText('Empezar');
  await page.locator('.content-scroll').evaluate((el) => el.scrollTo({ top: 400 }));
  await expect(start.locator('.sr-only')).toHaveText('Empezar');
  const width = await start.evaluate((el) => el.getBoundingClientRect().width);
  expect(width).toBeLessThanOrEqual(48);
});
