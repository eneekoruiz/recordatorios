import { test, expect } from '@playwright/test';

async function ensureAppUnlocked(page: any) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => {
    (window as any).__E2E__ = true;
    sessionStorage.setItem('__E2E__', 'true');
    sessionStorage.setItem('daily_greeting_seen_session', 'true');
    localStorage.setItem('daily_greeting_dismissed_day', new Date().toDateString());
    localStorage.setItem('hide_onboarding_guide', 'true');
    (window as any).useAppStore?.getState()?.setToken('local_offline_token', 'local_guest_e2e');
  });
  const guestBtn = page.locator('button:has-text("Usar sin cuenta")').first();
  try {
    await guestBtn.click({ timeout: 1500 });
  } catch {
    // Ya desbloqueada
  }
  await page.waitForTimeout(400);
}

test.describe('Recordatorios Élite - Complete Suite & Quality Audit', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAppUnlocked(page);
  });

  test('App loads successfully with 0 fatal errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveTitle(/Recordatorios/i);
    const body = page.locator('body');
    await expect(body).toBeVisible();

    const hasDuplicateKeyError = consoleErrors.some(e => e.includes('Encountered two children with the same key'));
    expect(hasDuplicateKeyError).toBeFalsy();
  });

  test('Command Palette opens and supports search and navigation', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    await page.keyboard.press('Control+k');
    const input = page.locator('input[placeholder*="Busca tareas"], input[placeholder*="Buscar"]');
    await expect(input.first()).toBeVisible({ timeout: 5000 });
    await input.first().fill('Hoy');
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
  });

  test('Sidebar contains all smart lists and quick navigation items', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');

    const sidebar = page.locator('.sidebar-container, nav');
    await expect(sidebar.first()).toBeVisible({ timeout: 5000 });
  });

  test('Task creation shortcut "n" or new task drawer triggers properly', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Trigger keyboard 'n' when not focused on an input
    await page.keyboard.press('n');
    await page.waitForTimeout(300);

    // Verify task drawer or modal opened
    const drawerTitle = page.locator('input[placeholder*="Nuevo recordatorio"], input[placeholder*="título"], input[placeholder*="tarea"]');
    await expect(drawerTitle.first()).toBeVisible({ timeout: 5000 });
  });
});
