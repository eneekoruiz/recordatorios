import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function boot(page: Page) {
  await page.goto('/');
  await page.evaluate(() => {
    sessionStorage.setItem('__E2E__', 'true');
    sessionStorage.setItem('daily_greeting_seen_session', 'true');
    localStorage.setItem('daily_greeting_dismissed_day', new Date().toDateString());
    localStorage.setItem('hide_onboarding_guide', 'true');
    localStorage.setItem('pwa_prompt_dismissed', 'true');
    (window as any).useAppStore?.getState()?.setToken('local_offline_token', 'local_guest_e2e');
  });
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('.ios-list-item').length > 0, null, { timeout: 8000 });
  await page.evaluate(() => {
    const st = (window as any).useAppStore.getState();
    st.addList({ id: 'casa', name: 'Casa', color: '#ff9500' });
    const T = (id: string, title: string, o: any) => st.addTask({ id, title, status: 'pending', ...o });
    T('a', 'Limpiar cocina', { categoryId: 'casa', duration: 30, cycle_id: 'cycle_week' });
    T('d1', 'Regar plantas', { categoryId: 'casa', duration: 15, cycle_id: 'cycle_day' });
    T('c1', 'Leche', { categoryId: 'casa', price: 1.5, quantity: 2 });
    T('h1', 'Llamar al médico', { categoryId: 'casa', dueDate: new Date().toISOString(), priority: 'high' });
  });
}

const event = (page: Page, name: string, detail?: unknown) =>
  page.evaluate(([n, d]) => window.dispatchEvent(new CustomEvent(n as string, { detail: d })), [name, detail] as const);

// Los títulos de lista llevan el color que elige cada persona (p. ej. naranja): no se puede garantizar su contraste.
const scan = async (page: Page, where: string) => {
  await page.waitForTimeout(1200); // que acaben las animaciones de entrada: axe mediría un fundido a medias
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .exclude('[title="Toca para cambiar nombre"]')
    .analyze();
  const serious = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${where}: ${v.id} → ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`), where).toEqual([]);
};

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`Accesibilidad (axe) — ${scheme}`, () => {
    test.use({ colorScheme: scheme });

    test('las vistas principales no tienen fallos graves', async ({ page }) => {
      await boot(page);
      await scan(page, 'barra lateral');
      for (const view of ['smart_today', 'smart_all', 'smart_calendar', 'list_casa', 'ANALYTICS', 'DATA', 'TRASH']) {
        await event(page, 'select-view', view);
        await scan(page, view);
      }
    });

    test('las hojas y diálogos no tienen fallos graves', async ({ page }) => {
      await boot(page);
      await event(page, 'select-view', 'list_casa');
      await page.evaluate(() => window.dispatchEvent(new Event('open-new-task-drawer')));
      await scan(page, 'editor');
      await page.keyboard.press('Escape');
      await page.evaluate(() => window.dispatchEvent(new Event('open-command-palette')));
      await scan(page, 'buscador');
      await page.keyboard.press('Escape');
      await event(page, 'open-ai-assistant');
      await scan(page, 'asistente');
      await page.keyboard.press('Escape');
      await event(page, 'open-shortcuts-modal');
      await scan(page, 'atajos');
    });
  });
}
