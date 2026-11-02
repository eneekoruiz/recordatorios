import { test, expect, type Page } from '@playwright/test';
import { bootApp } from './support/bootApp';

// Limpieza por estancias: soltar una tarea sobre la cabecera de otra estancia («Para terminar») la
// lleva a esa estancia. Antes todas las cabeceras de estancia apuntaban a la sección de la frecuencia
// («Semanales») y la tarea volvía a su sitio o aparecía bajo una cabecera con el identificador crudo.
async function seedLimpieza(page: Page) {
  await bootApp(page);
  await page.evaluate(() => {
    const created = new Date(Date.now() - 30 * 86400000).toISOString();
    const T: Record<string, any> = {};
    const add = (id: string, title: string, sectionId: string, order: number) => {
      T[id] = { id, user_id: 'local_guest_e2e', type: 'task', title, status: 'pending', created_at: created, updated_at: created, version: 1, categoryId: 'limpieza', sectionId, cycle_id: 'cycle_week', order, duration: 5 };
    };
    add('l1', 'Ventilar la casa', 'sec_limp_semanal_para_empezar', 0);
    add('l2', 'Limpiar todos los espejos', 'sec_limp_semanal_para_empezar', 1);
    add('l3', 'Limpiar la vitrocerámica', 'sec_limp_semanal_cocina', 0);
    add('l4', 'Sacar la basura', 'sec_limp_semanal_para_terminar', 0);
    add('l5', 'Fregar el suelo', 'sec_limp_semanal_para_terminar', 1);
    (window as any).useAppStore.setState((s: any) => ({ tasks: { ...s.tasks, ...T } }));
    window.dispatchEvent(new CustomEvent('select-view', { detail: 'list_limpieza' }));
  });
  await expect(page.locator('.task-item-wrapper[data-task-id="l2"]')).toBeVisible();
}

const roomHeader = (page: Page, name: string) =>
  page.locator('.group-header', { has: page.locator('.section-head-title', { hasText: new RegExp(`^${name}$`) }) });

const rowsUnder = (page: Page, name: string) => page.evaluate((title) => {
  const out: string[] = [];
  let inside = false;
  for (const el of document.querySelectorAll('.group-header, .task-item-wrapper[data-task-id]')) {
    if (el.classList.contains('group-header')) { inside = el.querySelector('.section-head-title')?.textContent === title; continue; }
    if (inside) out.push((el as HTMLElement).dataset.taskId!);
  }
  return out;
}, name);

test.describe('ratón', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('cada estancia apunta a su sección y soltar sobre «Para terminar» lleva la tarea allí', async ({ page }) => {
    await seedLimpieza(page);
    await expect(roomHeader(page, 'Para empezar')).toHaveAttribute('data-section-drag-key', 'sec_limp_semanal_para_empezar');
    await expect(roomHeader(page, 'Cocina')).toHaveAttribute('data-section-drag-key', 'sec_limp_semanal_cocina');
    await expect(roomHeader(page, 'Para terminar')).toHaveAttribute('data-section-drag-key', 'sec_limp_semanal_para_terminar');

    await page.evaluate(async () => {
      const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
      const dt = new DataTransfer();
      const handle = document.querySelector('.task-item-wrapper[data-task-id="l2"] .task-drag-handle') as HTMLElement;
      const hr = handle.getBoundingClientRect();
      handle.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: hr.x + 5, clientY: hr.y + 5 }));
      await sleep(60);
      const header = [...document.querySelectorAll('.group-header')].find(h => h.querySelector('.section-head-title')?.textContent === 'Para terminar') as HTMLElement;
      const r = header.getBoundingClientRect();
      const point = { clientX: r.x + 80, clientY: r.y + r.height / 2 };
      header.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, ...point }));
      await sleep(60);
      header.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, ...point }));
      handle.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
    });

    await expect.poll(() => page.evaluate(() => (window as any).useAppStore.getState().tasks.l2.sectionId)).toBe('sec_limp_semanal_para_terminar');
    await expect.poll(() => rowsUnder(page, 'Para terminar')).toContain('l2');
    expect(await rowsUnder(page, 'Para empezar')).toEqual(['l1']);
    // Sigue siendo semanal: ni cabeceras con identificadores crudos ni otra frecuencia.
    await expect(page.locator('.section-head-title', { hasText: /^sec_/ })).toHaveCount(0);
    // Sin huecos: cada fila empieza donde acaba la anterior.
    const gaps = await page.evaluate(() => {
      const els = [...document.querySelectorAll('.group-header, .task-item-wrapper[data-task-id]')].map(e => e.getBoundingClientRect());
      return els.slice(1).map((r, i) => Math.round(r.top - els[i].bottom)).filter(g => g > 2);
    });
    expect(gaps).toEqual([]);
  });
});

test.describe('oscuro', () => {
  test.use({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', hasTouch: true, isMobile: true });

  test('la fila levantada no se ve como una placa negra', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Toques reales por CDP');
    await seedLimpieza(page);
    const cdp = await page.context().newCDPSession(page);
    const box = (await page.locator('.task-item-wrapper[data-task-id="l2"]').boundingBox())!;
    const x = box.x + 150, y = box.y + box.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await page.waitForTimeout(450);
    for (let s = 1; s <= 6; s++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + s * 6 }] }); await page.waitForTimeout(20); }
    const colors = await page.evaluate(() => {
      const ghost = document.querySelector('.drag-ghost') as HTMLElement | null;
      return ghost ? [getComputedStyle(ghost).backgroundColor, getComputedStyle(ghost.querySelector('.task-row') as HTMLElement).backgroundColor] : null;
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    expect(colors).not.toBeNull();
    expect(colors![0]).toBe('rgb(44, 44, 46)');
    expect(colors![1]).not.toBe('rgb(0, 0, 0)');
  });
});
