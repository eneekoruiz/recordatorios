import { test, expect } from '@playwright/test';

async function ensureAppUnlocked(page: any) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => {
    (window as any).__E2E__ = true;
    sessionStorage.setItem('__E2E__', 'true');
    sessionStorage.setItem('daily_greeting_seen_session', 'true');
    localStorage.setItem('daily_greeting_dismissed_day', new Date().toDateString());
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

test.describe('Arreglos de la auditoría', () => {
  test('las fechas vencidas se conservan al volver a abrir la app', async ({ page }) => {
    await ensureAppUnlocked(page);
    await page.evaluate(() => {
      const past = new Date();
      past.setDate(past.getDate() - 3);
      (window as any).useAppStore.getState().addTask({ id: 'vencida_1', title: 'Pagar multa', dueDate: past.toISOString(), status: 'pending', created_at: new Date().toISOString() });
    });
    await page.waitForTimeout(600);
    await page.reload();
    await page.waitForTimeout(1500);
    const due = await page.evaluate(() => (window as any).useAppStore.getState().tasks['vencida_1']?.dueDate);
    expect(due).toBeTruthy();
  });

  test('el nombre se pone desde el perfil y no se inventa a partir del email', async ({ page }) => {
    await ensureAppUnlocked(page);
    await page.locator('.user-profile-trigger').first().click();
    await page.getByRole('button', { name: /Poner nombre/ }).click();
    const input = page.locator('input[placeholder="Tu nombre"]');
    await input.fill('Eneko');
    await input.press('Enter');
    await expect.poll(() => page.evaluate(() => (window as any).useAppStore.getState().displayName)).toBe('Eneko');
  });
});

test.describe('En el móvil', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('el menú «···» de una lista se abre', async ({ page }) => {
    await ensureAppUnlocked(page);
    await page.locator('[data-list-id]').filter({ hasText: 'Compras' }).first().click();
    await page.getByLabel('Opciones de lista').first().tap();
    const sheet = page.getByRole('dialog', { name: 'Opciones de lista' });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('Mostrar completados');
  });
});
