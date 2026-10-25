import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { bootApp } from './support/bootApp';

const first = (page: Page) => page.locator('.task-item-wrapper[data-task-id="weekly_a"]');
const second = (page: Page) => page.locator('.task-item-wrapper[data-task-id="weekly_b"]');
const weeklyHeader = (page: Page) => page.locator('.group-header', {
  has: page.locator('.section-head-title', { hasText: /^Semanales$/ }),
}).first();

async function changeDate(page: Page, date: string) {
  await page.clock.setSystemTime(new Date(date));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
}

for (const width of [375, 768, 1440]) {
  test.describe(`weekly routines at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 }, timezoneId: 'Europe/Madrid', reducedMotion: 'reduce' });

    test('remaining time follows checkboxes and weekly completion survives Sunday until Monday', async ({ page }, testInfo) => {
      test.setTimeout(90000);
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.install({ time: new Date('2026-10-24T20:00:00+02:00') });
      await bootApp(page);
      await page.evaluate(() => {
        const store = (window as any).useAppStore;
        store.getState().addList({ id: 'weekly_regression', name: 'Quehaceres diarios personalizados', color: '#007aff', listType: 'routines' });
        store.getState().addListSection({ id: 'weekly_root', listId: 'weekly_regression', name: 'Semanales', order: 0 });
        store.getState().addListSection({ id: 'weekly_room', listId: 'weekly_regression', name: 'Cocina', parentId: 'weekly_root', order: 0 });
        const makeTask = (id: string, title: string, duration: number) => ({
          id, title, duration, categoryId: 'weekly_regression', sectionId: 'weekly_room',
          type: 'task', status: 'pending', version: 1, user_id: 'local_guest_e2e',
          created_at: '2026-10-01T10:00:00.000Z', updated_at: new Date().toISOString(),
        });
        store.setState({ tasks: {
          weekly_a: makeTask('weekly_a', 'Ordenar los estantes', 30),
          weekly_b: makeTask('weekly_b', 'Limpiar los muebles', 150),
        } });
        window.dispatchEvent(new CustomEvent('select-view', { detail: 'list_weekly_regression' }));
      });

      const duration = page.locator('.list-duration-meta');
      await expect(duration).toContainText('3 h');
      await first(page).getByRole('button', { name: 'Completar tarea', exact: true }).click();
      await expect(duration).toContainText('2 h 30 min');
      await first(page).getByRole('button', { name: 'Marcar como pendiente', exact: true }).click();
      await expect(duration).toContainText('3 h');
      await first(page).getByRole('button', { name: 'Completar tarea', exact: true }).click();
      await second(page).getByRole('button', { name: 'Completar tarea', exact: true }).click();
      const chevron = weeklyHeader(page).locator('.section-head-chevron');
      await expect(chevron).toHaveAttribute('aria-expanded', 'false', { timeout: 7000 });
      await chevron.click();
      await expect(first(page).getByRole('button', { name: 'Marcar como pendiente', exact: true })).toBeVisible();
      await expect(weeklyHeader(page)).toContainText('se renuevan el lunes 26 oct');
      await expect(duration).toHaveCount(0);

      for (const date of ['2026-10-25T00:01:00+02:00', '2026-10-25T23:59:00+01:00']) {
        await changeDate(page, date);
        await expect(first(page).getByRole('button', { name: 'Marcar como pendiente', exact: true })).toBeVisible();
        await expect(duration).toHaveCount(0);
      }

      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => (window as any).useAppStore.getState().setTheme(theme), theme);
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        expect(axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
      }
      await page.screenshot({ path: testInfo.outputPath('weekly-sunday.png') });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);

      await page.reload();
      await page.waitForFunction(() => (window as any).useAppStore?.getState().hasHydrated);
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('select-view', { detail: 'list_weekly_regression' })));
      await weeklyHeader(page).locator('.section-head-chevron').click();
      await expect(first(page).getByRole('button', { name: 'Marcar como pendiente', exact: true })).toBeVisible();

      await page.clock.fastForward(60_100);
      await expect(first(page).getByRole('button', { name: 'Completar tarea', exact: true })).toBeVisible();
      await expect(duration).toContainText('3 h');
      expect(errors).toEqual([]);
    });
  });
}
