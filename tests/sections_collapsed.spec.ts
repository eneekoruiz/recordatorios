import { test, expect } from '@playwright/test';
import { bootApp } from './support/bootApp';

// Las secciones empiezan plegadas (se descubre poco a poco): se ve el resumen de cada una (cuántas y
// cuánto tiempo o dinero queda) y se abre lo que interesa. Lo abierto se recuerda mientras se está en la lista.
test.use({ viewport: { width: 390, height: 844 } });

test('las secciones de una lista empiezan plegadas con su resumen y se abren con un toque', async ({ page }) => {
  await bootApp(page, { sectionsOpen: false });
  await page.evaluate(() => {
    const st = (window as any).useAppStore.getState();
    st.addList({ id: 'casa', name: 'Casa', color: '#ff9500' });
    st.addListSection({ id: 's_m', listId: 'casa', name: 'Mañana', order: 0 });
    st.addListSection({ id: 's_t', listId: 'casa', name: 'Tarde', order: 1 });
    const created = new Date().toISOString();
    st.addTask({ id: 'm1', title: 'Hacer la cama', categoryId: 'casa', sectionId: 's_m', duration: 5, status: 'pending', created_at: created });
    st.addTask({ id: 't1', title: 'Regar', categoryId: 'casa', sectionId: 's_t', duration: 10, status: 'pending', created_at: created });
    window.dispatchEvent(new CustomEvent('select-view', { detail: 'list_casa' }));
  });
  const morning = page.locator('.group-header', { has: page.locator('.section-head-title', { hasText: /^Mañana$/ }) });
  await expect(morning.locator('.section-head-chevron')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByText('Hacer la cama')).toHaveCount(0);
  // Aunque quede una sola, la sección dice cuánto le queda.
  await expect(morning).toContainText('5 min');
  await morning.locator('.section-head-chevron').click();
  await expect(page.getByText('Hacer la cama')).toBeVisible();
  await expect(page.getByText('Regar')).toHaveCount(0);
});

test('compra: el total baja al marcar lo de este mes, también lo que se repite', async ({ page }) => {
  await bootApp(page);
  await page.evaluate(() => {
    const now = Date.now();
    const created = new Date(now - 40 * 86400000).toISOString();
    const T: Record<string, any> = {};
    const add = (id: string, title: string, extra: any) => { T[id] = { id, user_id: 'local_guest_e2e', type: 'task', title, status: 'pending', created_at: created, updated_at: created, version: 1, categoryId: 'compras', cycle_id: 'cycle_month', ...extra }; };
    add('p1', 'Spotify', { price: 3.5 });
    add('p2', 'Compra del súper', { price: 95, completionHistory: [now - 60000] });
    add('p3', 'Cuota del gimnasio', { price: 26.5, completionHistory: [now - 120000] });
    (window as any).useAppStore.setState((s: any) => ({ tasks: { ...s.tasks, ...T } }));
    window.dispatchEvent(new CustomEvent('select-view', { detail: 'list_compras' }));
  });
  await expect(page.locator('.page-title-row, .main-page-header, header').first()).toBeVisible();
  await expect(page.getByText('125,00 €')).toHaveCount(0);
  await expect(page.getByText('3,50 €').first()).toBeVisible();
});
