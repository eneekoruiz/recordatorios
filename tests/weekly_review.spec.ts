import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { bootApp } from './support/bootApp';

for (const width of [375, 768, 1440]) {
  test.describe(`weekly review at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 }, timezoneId: 'Europe/Madrid', reducedMotion: 'reduce' });

    test('includes renewed routines in achievements and estimated time', async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.setFixedTime(new Date('2026-10-26T12:00:00+01:00'));
      await bootApp(page);
      await page.evaluate(() => {
        const at = new Date('2026-10-24T12:00:00+02:00').getTime();
        (window as any).useAppStore.setState({ tasks: {
          review_weekly: {
            id: 'review_weekly', title: 'Limpiar los estantes', type: 'task', status: 'pending',
            duration: 30, cycle_id: 'cycle_week', categoryId: 'limpieza',
            created_at: '2026-09-01T10:00:00Z', updated_at: '2026-10-24T10:00:00Z',
            user_id: 'local_guest_e2e', version: 1, completionHistory: [at],
          },
          review_skip: {
            id: 'review_skip', title: 'Rutina omitida', type: 'task', status: 'pending',
            duration: 120, cycle_id: 'cycle_week', categoryId: 'limpieza',
            created_at: '2026-09-01T10:00:00Z', updated_at: '2026-10-24T10:00:00Z',
            user_id: 'local_guest_e2e', version: 1, skipHistory: [at],
          },
        } });
        window.dispatchEvent(new CustomEvent('select-view', { detail: 'ANALYTICS' }));
      });
      await page.getByRole('button', { name: 'Revisión semanal', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Agente de Revisión Semanal' });
      await expect(dialog.getByText('Limpiar los estantes', { exact: true })).toBeVisible();
      await expect(dialog.getByText('~30 min', { exact: true })).toBeVisible();
      await expect(dialog.getByText('1', { exact: true })).toBeVisible();
      await expect(dialog.getByText('Rutina omitida', { exact: true })).toHaveCount(0);
      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => (window as any).useAppStore.getState().setTheme(theme), theme);
        const axe = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        expect(axe.violations.filter(item => item.impact === 'serious' || item.impact === 'critical')).toEqual([]);
      }
      await dialog.screenshot({ path: testInfo.outputPath('weekly-review.png') });
      await dialog.getByRole('button', { name: 'Continuar', exact: true }).click();
      await expect(dialog.getByText('Limpiar los estantes', { exact: true })).toHaveCount(0);
      await expect(dialog.getByText('Rutina omitida', { exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await page.clock.setFixedTime(new Date('2026-11-03T12:00:00+01:00'));
      await page.getByRole('button', { name: 'Revisión semanal', exact: true }).click();
      await expect(dialog.getByText('Paso 1 de 4', { exact: false })).toBeVisible();
      await expect(dialog.getByText('0', { exact: true })).toBeVisible();
      await expect(dialog.getByText('~0 min', { exact: true })).toBeVisible();
      await expect(dialog.getByText('Limpiar los estantes', { exact: true })).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  });
}
