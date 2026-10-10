import { test, expect, type Page, type Locator } from '@playwright/test';
import { bootApp } from './support/bootApp';

async function seedRecovery(page: Page) {
  await page.clock.setFixedTime(new Date('2026-10-10T12:00:00+02:00'));
  await bootApp(page);
  await page.evaluate(() => {
    const at = (month: number, day: number) => new Date(2026, month - 1, day, 12).getTime();
    const created = new Date(2025, 0, 1, 12).toISOString();
    const task = (id: string, title: string, overrides: Record<string, unknown> = {}) => ({
      id, title, type: 'task', user_id: 'local_guest_e2e', status: 'pending',
      categoryId: 'recovery-cleaning', sectionId: 'recovery-kitchen', cycle_id: 'cycle_week',
      created_at: created, updated_at: created, version: 1, completionHistory: [], skipHistory: [], duration: 5,
      ...overrides,
    });
    const tasks = [
      task('recovery-week', 'Fregar suelo'),
      task('recovery-month', 'Limpiar horno', { sectionId: 'recovery-bathroom', cycle_id: 'cycle_month', duration: 15 }),
      task('recovery-current-done', 'Ya hecho esta semana', { sectionId: 'recovery-done', completionHistory: [at(10, 6)] }),
      task('recovery-current-skip', 'Ya omitido esta semana', { categoryId: 'recovery-shopping', sectionId: undefined, skipHistory: [at(10, 6)] }),
      task('recovery-previous-done', 'Hecho la semana pasada', { sectionId: 'recovery-history', completionHistory: [at(9, 29)] }),
    ];
    (window as any).useAppStore.setState({
      tasks: Object.fromEntries(tasks.map(item => [item.id, item])),
      lists: [
        { id: 'recovery-cleaning', name: 'Limpieza', color: '#34c759', listType: 'routines' },
        { id: 'recovery-shopping', name: 'Compras', color: '#ff9500', listType: 'routines' },
      ],
      listSections: [
        { id: 'recovery-kitchen', listId: 'recovery-cleaning', name: 'Cocina', order: 0 },
        { id: 'recovery-bathroom', listId: 'recovery-cleaning', name: 'Baño', order: 1 },
        { id: 'recovery-done', listId: 'recovery-cleaning', name: 'Dormitorio', order: 2 },
        { id: 'recovery-history', listId: 'recovery-cleaning', name: 'Salón', order: 3 },
      ],
    });
    localStorage.removeItem('daily_briefing_collapsed');
    window.dispatchEvent(new CustomEvent('select-view', { detail: 'smart_today' }));
  });
  await expect(page.locator('.daily-briefing-container')).toBeVisible();
}

async function openGreeting(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new Event('open-daily-greeting')));
  const dialog = page.locator('.greeting-sheet');
  await expect(dialog).toBeVisible();
  return dialog;
}

const recoveryGroup = (container: Locator, section: string) => container.locator(
  `[data-testid="recovery-group"][data-list-id="recovery-cleaning"][data-section-id="${section}"]`,
);

async function sourceSnapshot(page: Page) {
  return page.evaluate(() => JSON.stringify((window as any).useAppStore.getState().tasks));
}

test('greeting and daily banner suggest the same unresolved previous sections', async ({ page }) => {
  await seedRecovery(page);
  const before = await sourceSnapshot(page);
  const banner = page.locator('.daily-briefing-container');
  const dialog = await openGreeting(page);
  for (const container of [banner, dialog]) {
    await expect(container.getByTestId('recovery-group')).toHaveCount(2);
    const weekly = recoveryGroup(container, 'recovery-kitchen');
    const monthly = recoveryGroup(container, 'recovery-bathroom');
    await expect(weekly).toContainText('La semana pasada');
    await expect(weekly).toContainText('Limpieza · Cocina');
    await expect(weekly).toHaveAttribute('data-frequency', 'week');
    await expect(monthly).toContainText('El mes pasado');
    await expect(monthly).toContainText('Limpieza · Baño');
    await expect(monthly).toHaveAttribute('data-frequency', 'month');
    await expect(container.getByTestId('routine-recovery')).not.toContainText('Ya hecho esta semana');
    await expect(container.getByTestId('routine-recovery')).not.toContainText('Ya omitido esta semana');
    await expect(container.getByTestId('routine-recovery')).not.toContainText('Hecho la semana pasada');
  }
  expect(await sourceSnapshot(page)).toBe(before);
});

test('starting one task opens its existing drawer without marking it completed', async ({ page }) => {
  await seedRecovery(page);
  const before = await sourceSnapshot(page);
  const dialog = await openGreeting(page);
  await recoveryGroup(dialog, 'recovery-kitchen').getByRole('button', { name: 'Empezar por una', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const drawer = page.getByRole('dialog', { name: 'Detalles', exact: true });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByPlaceholder('Título · p. ej. «Pastillas mañana 9:00»')).toHaveValue('Fregar suelo');
  expect(await sourceSnapshot(page)).toBe(before);
  await drawer.getByRole('button', { name: 'Cancelar edición', exact: true }).click();
  expect(await sourceSnapshot(page)).toBe(before);
});

test('omitting the previous period stops that suggestion without touching current or other sections', async ({ page }) => {
  await seedRecovery(page);
  const before = JSON.parse(await sourceSnapshot(page));
  const dialog = await openGreeting(page);
  await recoveryGroup(dialog, 'recovery-kitchen').getByRole('button', { name: 'Omitir período', exact: true }).click();
  await expect(recoveryGroup(dialog, 'recovery-kitchen')).toHaveCount(0);
  await expect(recoveryGroup(page.locator('.daily-briefing-container'), 'recovery-kitchen')).toHaveCount(0);
  await expect(recoveryGroup(dialog, 'recovery-bathroom')).toBeVisible();
  const after = JSON.parse(await sourceSnapshot(page));
  expect(after['recovery-week'].skipHistory).toHaveLength(1);
  expect(after['recovery-week'].completionHistory).toEqual([]);
  expect(after['recovery-week'].status).toBe('pending');
  expect(await page.evaluate(stamp => {
    const date = new Date(stamp);
    return [date.getFullYear(), date.getMonth() + 1, date.getDate()];
  }, after['recovery-week'].skipHistory[0])).toEqual([2026, 9, 28]);
  for (const id of Object.keys(before).filter(id => id !== 'recovery-week')) expect(after[id]).toEqual(before[id]);
  await dialog.getByRole('button', { name: 'Cerrar resumen', exact: true }).click();
  const reopened = await openGreeting(page);
  await expect(recoveryGroup(reopened, 'recovery-kitchen')).toHaveCount(0);
  expect(JSON.parse(await sourceSnapshot(page))['recovery-week'].skipHistory).toHaveLength(1);
});

test('recovery navigation opens the current list and real statistics view', async ({ page }) => {
  await seedRecovery(page);
  const before = await sourceSnapshot(page);
  const dialog = await openGreeting(page);
  await recoveryGroup(dialog, 'recovery-kitchen').getByRole('button', { name: 'Esta semana', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.content-header h1')).toContainText('Limpieza');
  const reopened = await openGreeting(page);
  await recoveryGroup(reopened, 'recovery-kitchen').getByRole('button', { name: 'Ver historial', exact: true }).click();
  await expect(reopened).not.toBeVisible();
  await expect(page.getByTestId('routine-analytics')).toBeVisible();
  await expect(page.getByTestId('routine-frequency-week')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-testid="routine-period"][data-period-start="2026-09-28"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('routine-group')).toHaveCount(1);
  await expect(page.getByTestId('routine-group')).toHaveAttribute('data-section-id', 'recovery-kitchen');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('select-view', { detail: 'smart_today' })));
  await page.locator('.daily-briefing-container').getByRole('button', { name: 'Ver estadísticas', exact: true }).click();
  await expect(page.getByTestId('routine-analytics')).toBeVisible();
  expect(await sourceSnapshot(page)).toBe(before);
});

test('mobile recovery remains inside the greeting dialog with accessible touch targets', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await seedRecovery(page);
  const dialog = await openGreeting(page);
  await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  const overflow = await dialog.evaluate(element => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  const undersized = await dialog.getByTestId('routine-recovery').locator('button').evaluateAll(buttons => buttons.flatMap(button => {
    const box = button.getBoundingClientRect();
    return box.width < 43.9 || box.height < 43.9 ? [{ text: button.textContent?.trim(), width: box.width, height: box.height }] : [];
  }));
  expect(undersized).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});
