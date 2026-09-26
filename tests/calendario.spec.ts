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

const keyFor = (offsetDays: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

test.describe('Calendario', () => {
  test('muestra qué toca cada día y crea recordatorios en el día elegido', async ({ page }) => {
    await ensureAppUnlocked(page);

    await page.evaluate(() => {
      const store = (window as any).useAppStore.getState();
      const inTwoDays = new Date();
      inTwoDays.setDate(inTwoDays.getDate() + 2);
      inTwoDays.setHours(12, 0, 0, 0);
      store.setWeeklyTasksDay(new Date().getDay()); // hoy es el día de las semanales
      store.addTask({ id: 'cal_weekly', title: 'Aspirar el salón', cycle_id: 'cycle_week', status: 'pending', created_at: new Date().toISOString() });
      store.addTask({ id: 'cal_dated', title: 'Revisión del coche', dueDate: inTwoDays.toISOString(), status: 'pending', created_at: new Date().toISOString() });
    });

    await page.locator('.ios-smart-card', { hasText: 'Calendario' }).first().click();

    // Hoy: la ronda semanal, con su recuento y su regla
    const agenda = page.locator('.cal-agenda');
    await expect(agenda.locator('.cal-agenda-head')).toContainText('Hoy');
    const weekly = agenda.locator('button.cal-row', { hasText: 'Semanales' });
    await expect(weekly).toContainText('1');
    await expect(weekly).toContainText('Cada');

    // Otro día: su recordatorio con fecha
    const target = keyFor(2);
    if ((await page.locator(`[data-day="${target}"]`).count()) === 0) {
      await page.getByRole('button', { name: 'Mes siguiente' }).click();
    }
    await page.locator(`[data-day="${target}"]`).click();
    await expect(page.locator(`[data-day="${target}"]`)).toHaveAttribute('aria-pressed', 'true');
    await expect(agenda.locator('.cal-item', { hasText: 'Revisión del coche' })).toBeVisible();

    // La barra rápida crea el recordatorio en el día elegido
    const input = page.locator('input[placeholder="Nuevo recordatorio"]:visible').first();
    await input.fill('Pasar la ITV');
    await input.press('Enter');
    await expect(agenda.locator('.cal-item', { hasText: 'Pasar la ITV' })).toBeVisible();
    const due = await page.evaluate(() => {
      const tasks = Object.values((window as any).useAppStore.getState().tasks) as any[];
      return tasks.find((t) => t.title === 'Pasar la ITV')?.dueDate;
    });
    const dueDate = new Date(due);
    const dueKey = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`;
    expect(dueKey).toBe(target);

    // «Hoy» vuelve al día de hoy
    await page.getByRole('button', { name: 'Hoy', exact: true }).click();
    await expect(page.locator(`[data-day="${keyFor(0)}"]`)).toHaveAttribute('aria-pressed', 'true');

    // La ronda lleva a su vista de frecuencia
    await agenda.locator('button.cal-row', { hasText: 'Semanales' }).click();
    await expect(page.locator('.task-item-wrapper', { hasText: 'Aspirar el salón' }).first()).toBeVisible();
  });
});
