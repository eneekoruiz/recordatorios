import { expect, type Page } from '@playwright/test';

/**
 * Set test preferences before React boots, then wait for actual hydration.
 * `sectionsOpen`: las secciones empiezan plegadas por defecto; la mayoría de pruebas miran filas
 * dentro de secciones y arrancan con ellas abiertas (preferencia local `recordatorios_sections_open`).
 */
export async function bootApp(page: Page, { sectionsOpen = true }: { sectionsOpen?: boolean } = {}) {
  await page.addInitScript((open) => {
    if (open) localStorage.setItem('recordatorios_sections_open', 'true');
    else localStorage.removeItem('recordatorios_sections_open');
    (window as any).__E2E__ = true;
    sessionStorage.setItem('__E2E__', 'true');
    sessionStorage.setItem('daily_greeting_seen_session', 'true');
    localStorage.setItem('daily_greeting_dismissed_day', new Date().toDateString());
    localStorage.setItem('hide_onboarding_guide', 'true');
    localStorage.setItem('pwa_prompt_dismissed', 'true');
  }, sectionsOpen);
  await page.goto('/');
  await page.waitForFunction(() => (window as any).useAppStore?.getState().hasHydrated === true);
  await page.evaluate(() => (window as any).useAppStore.getState().setToken('local_offline_token', 'local_guest_e2e'));
  await expect(page.locator('[data-testid="user-profile-trigger"]').first()).toBeVisible();
}
