import { test, expect, type Page } from '@playwright/test';
import { bootApp } from './support/bootApp';

const REFERENCE = '2026-10-10';
const LAST_WEEK = '2026-09-28';

async function seedRoutines(page: Page) {
  await page.clock.setFixedTime(new Date('2026-10-10T12:00:00+02:00'));
  await bootApp(page);
  await page.evaluate(() => {
    const at = (year: number, month: number, day: number) => new Date(year, month - 1, day, 12).getTime();
    const created = new Date(2025, 0, 1, 12).toISOString();
    const task = (id: string, title: string, overrides: Record<string, unknown>) => ({
      id, title, user_id: 'local_guest_e2e', type: 'task', status: 'pending',
      categoryId: 'analytics-cleaning', sectionId: 'analytics-kitchen', cycle_id: 'cycle_week',
      created_at: created, updated_at: created, version: 1, completionHistory: [], skipHistory: [],
      ...overrides,
    });
    const fixture = [
      task('analytics-done', 'Limpiar encimera', { completionHistory: [at(2026, 9, 29)] }),
      task('analytics-pending', 'Fregar suelo', { skipHistory: [at(2026, 8, 18)] }),
      task('analytics-bath', 'Limpiar ducha', { sectionId: 'analytics-bathroom', skipHistory: [at(2026, 9, 30)] }),
      task('analytics-shopping', 'Comprar fruta', { categoryId: 'analytics-shopping', sectionId: undefined }),
      task('analytics-month', 'Limpiar horno', { cycle_id: 'cycle_month', skipHistory: [at(2026, 9, 15)] }),
      task('analytics-day', 'Recoger cocina', { cycle_id: 'cycle_day', completionHistory: [at(2026, 10, 9)] }),
      task('analytics-day-pending', 'Ordenar mesa', { cycle_id: 'cycle_day' }),
    ];
    (window as any).useAppStore.setState({
      tasks: Object.fromEntries(fixture.map(item => [item.id, item])),
      lists: [
        { id: 'analytics-cleaning', name: 'Limpieza', color: '#34c759', listType: 'routines' },
        { id: 'analytics-shopping', name: 'Compras', color: '#ff9500', listType: 'routines' },
      ],
      listSections: [
        { id: 'analytics-kitchen', listId: 'analytics-cleaning', name: 'Cocina', order: 0 },
        { id: 'analytics-bathroom', listId: 'analytics-cleaning', name: 'Baño', order: 1 },
      ],
    });
    window.dispatchEvent(new CustomEvent('select-view', { detail: 'ANALYTICS' }));
  });
  await expect(page.getByTestId('routine-analytics')).toBeVisible();
  await page.getByTestId('routine-reference').fill(REFERENCE);
}

const group = (page: Page, sectionId: string) => page.locator(
  `[data-testid="routine-group"][data-list-id="analytics-cleaning"][data-section-id="${sectionId}"]`,
);

async function selectPreviousWeek(page: Page) {
  await page.getByTestId('routine-frequency-week').click();
  const previous = page.locator(`[data-testid="routine-period"][data-period-start="${LAST_WEEK}"]`);
  await previous.click();
  await expect(previous).toHaveAttribute('aria-pressed', 'true');
}

async function histories(page: Page): Promise<Record<string, { completions: number[]; skips: number[]; status: string }>> {
  return page.evaluate(() => Object.fromEntries(Object.entries((window as any).useAppStore.getState().tasks).map(([id, item]) => {
    const task = item as { completionHistory?: number[]; skipHistory?: number[]; status: string };
    return [id, { completions: task.completionHistory || [], skips: task.skipHistory || [], status: task.status }];
  })));
}

test('weekly history separates manual sections, completed tasks and skips', async ({ page }) => {
  await seedRoutines(page);
  await selectPreviousWeek(page);
  await expect(page.getByTestId('routine-period')).toHaveCount(8);
  const kitchen = group(page, 'analytics-kitchen');
  const bathroom = group(page, 'analytics-bathroom');
  await expect(kitchen).toContainText('Cocina');
  await expect(bathroom).toContainText('Baño');
  await expect(kitchen.getByTestId('routine-task')).toHaveCount(2);
  await expect(bathroom.getByTestId('routine-task')).toHaveCount(1);
  await expect(kitchen).toContainText('Limpiar encimera');
  await expect(kitchen).toContainText('Fregar suelo');
  await expect(bathroom).toContainText('Limpiar ducha');
  await expect(kitchen).not.toContainText('Limpiar horno');
  await expect(kitchen).not.toContainText('Recoger cocina');
  await expect(kitchen.getByTestId('routine-group-summary')).toContainText(/1 hecha/);
  await expect(kitchen.getByTestId('routine-group-summary')).toContainText(/1 omitida/);
  await expect(kitchen.getByTestId('routine-group-summary')).toContainText('0 omitidas por ti');
  await expect(kitchen.getByTestId('routine-group-summary')).toContainText('1 omitidas automáticamente');
  await expect(bathroom.getByTestId('routine-group-summary')).toContainText(/0 hecha/);
  await expect(bathroom.getByTestId('routine-group-summary')).toContainText(/1 omitida/);
  await expect(kitchen.locator('[data-task-id="analytics-done"]')).toHaveAttribute('data-status', 'completed');
  await expect(kitchen.locator('[data-task-id="analytics-pending"]')).toHaveAttribute('data-status', 'skipped');
  await expect(kitchen.locator('[data-task-id="analytics-pending"]')).toHaveAttribute('data-automatic', 'true');
  await expect(bathroom.locator('[data-task-id="analytics-bath"]')).toHaveAttribute('data-status', 'skipped');
  await expect(bathroom.locator('[data-task-id="analytics-bath"]')).toHaveAttribute('data-automatic', 'false');
});

test('skip and restore affect only the selected section, frequency and period', async ({ page }) => {
  await seedRoutines(page);
  await selectPreviousWeek(page);
  const before = await histories(page);
  const kitchen = group(page, 'analytics-kitchen');
  await kitchen.locator('summary').click();
  await kitchen.getByRole('button', { name: 'Omitir sección', exact: true }).click();
  await expect(kitchen.locator('[data-task-id="analytics-pending"]')).toHaveAttribute('data-automatic', 'false');
  await expect(kitchen.getByTestId('routine-group-summary')).toContainText('1 omitidas por ti');
  await expect(kitchen.getByTestId('routine-group-summary')).not.toContainText('automáticamente');
  const skipped = await histories(page);
  expect(skipped['analytics-pending'].skips).toHaveLength(2);
  expect(skipped['analytics-pending'].skips).toContain(before['analytics-pending'].skips[0]);
  const inserted = skipped['analytics-pending'].skips.find(value => !before['analytics-pending'].skips.includes(value));
  expect(inserted).toBeDefined();
  expect(await page.evaluate(ms => {
    const date = new Date(ms!);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }, inserted)).toBe(LAST_WEEK);
  for (const id of ['analytics-done', 'analytics-bath', 'analytics-shopping', 'analytics-month', 'analytics-day', 'analytics-day-pending']) {
    expect(skipped[id]).toEqual(before[id]);
  }
  const omit = kitchen.getByRole('button', { name: 'Omitir sección', exact: true });
  if (await omit.isVisible() && await omit.isEnabled()) {
    await omit.click();
    expect(await histories(page)).toEqual(skipped);
  }
  await kitchen.getByRole('button', { name: 'Restaurar omitidas', exact: true }).click();
  expect(await histories(page)).toEqual(before);
  await expect(kitchen.getByTestId('routine-group-summary')).toContainText(/1 omitida/);
  await expect(kitchen.locator('[data-task-id="analytics-pending"]')).toHaveAttribute('data-automatic', 'true');
  await expect(kitchen.getByTestId('routine-group-summary')).toContainText('1 omitidas automáticamente');
});

test('only closed periods infer omissions and viewing history never writes task data', async ({ page }) => {
  await seedRoutines(page);
  const before = await page.evaluate(() => JSON.stringify((window as any).useAppStore.getState().tasks));
  await page.getByTestId('routine-frequency-day').click();
  const kitchen = group(page, 'analytics-kitchen');
  const unmarked = kitchen.locator('[data-task-id="analytics-day-pending"]');
  await expect(unmarked).toHaveAttribute('data-status', 'pending');
  await expect(unmarked).toHaveAttribute('data-automatic', 'false');
  await expect(kitchen.getByTestId('routine-group-summary')).toContainText(/0 omitida/);

  await page.locator('[data-testid="routine-period"][data-period-start="2026-10-09"]').click();
  await expect(unmarked).toHaveAttribute('data-status', 'skipped');
  await expect(unmarked).toHaveAttribute('data-automatic', 'true');
  await expect(kitchen.locator('[data-task-id="analytics-day"]')).toHaveAttribute('data-status', 'completed');
  await expect(kitchen.getByTestId('routine-group-summary')).toContainText(/1 omitida/);

  await page.locator('[data-testid="routine-period"][data-period-start="2026-10-11"]').click();
  await expect(unmarked).toHaveAttribute('data-status', 'unknown');
  await expect(unmarked).toHaveAttribute('data-automatic', 'false');
  await expect(kitchen.getByTestId('routine-group-summary')).toContainText(/0 omitida/);
  await expect(kitchen.getByTestId('routine-group-summary')).toContainText(/2 sin datos/);
  expect(await page.evaluate(() => JSON.stringify((window as any).useAppStore.getState().tasks))).toBe(before);
});

test('section filters retain separate weekly and monthly history', async ({ page }) => {
  await seedRoutines(page);
  await selectPreviousWeek(page);
  const filter = page.getByTestId('routine-section-filter');
  const kitchenOption = filter.locator('option').filter({ hasText: 'Cocina' });
  const kitchenValue = await kitchenOption.getAttribute('value');
  expect(kitchenValue).toBeTruthy();
  await filter.selectOption(kitchenValue!);
  await expect(page.getByTestId('routine-group')).toHaveCount(1);
  await expect(group(page, 'analytics-kitchen')).toBeVisible();
  await page.getByTestId('routine-frequency-month').click();
  await page.locator('[data-testid="routine-period"][data-period-start="2026-09-01"]').click();
  await expect(page.getByTestId('routine-group')).toHaveCount(1);
  await expect(group(page, 'analytics-kitchen')).toContainText('Limpiar horno');
  await expect(group(page, 'analytics-kitchen').getByTestId('routine-group-summary')).toContainText(/1 omitida/);
  await expect(group(page, 'analytics-kitchen')).not.toContainText('Fregar suelo');
});

test('routine controls fit at 375px and preserve 44px touch targets', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await seedRoutines(page);
  await selectPreviousWeek(page);
  await group(page, 'analytics-kitchen').locator('summary').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  const panel = page.getByTestId('routine-analytics');
  const undersized = await panel.locator('button, input, select, summary').evaluateAll(elements => elements.flatMap(element => {
    const box = element.getBoundingClientRect();
    if (!box.width || !box.height) return [];
    return box.width < 43.9 || box.height < 43.9 ? [{ text: element.textContent?.trim(), width: box.width, height: box.height }] : [];
  }));
  expect(undersized).toEqual([]);
});
