import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { bootApp } from './support/bootApp';

for (const width of [375, 768, 1440]) {
  test.describe(`search at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 }, timezoneId: 'Europe/Madrid', reducedMotion: 'reduce' });

    test('search reflects routine history and supports native keyboard controls', async ({ page }, testInfo) => {
      test.setTimeout(90000);
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.clock.setFixedTime(new Date('2026-10-25T12:00:00+01:00'));
      await bootApp(page);
      await page.evaluate(() => {
        const api = (window as any).useAppStore;
        const at = new Date('2026-10-24T12:00:00+02:00').getTime();
        const task = (id: string, title: string, extra = {}) => ({
          id, title, status: 'pending', categoryId: 'search-house', sectionId: 'search-week',
          type: 'task', user_id: 'local_guest_e2e', version: 1,
          created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-24T10:00:00Z', ...extra,
        });
        api.setState({
          lists: [...api.getState().lists,
            { id: 'search-house', name: 'Quehaceres diarios de casa', listType: 'routines', color: '#007aff' },
            { id: 'search-deleted-list', name: 'Archivo oculto', color: '#007aff', deleted_at: new Date().toISOString() },
          ],
          listSections: [{ id: 'search-week', name: 'Semanales', listId: 'search-house', order: 0 }],
          cycles: [...api.getState().cycles, { id: 'search-deleted-cycle', name: 'Archivo oculto', daysValue: 3, isPinned: false, icon: 'Repeat', deleted_at: new Date().toISOString() }],
          tasks: {
            search_done: task('search_done', 'Estantes café hechos', { completionHistory: [at], currentCount: 0, targetCount: 2 }),
            search_pending: task('search_pending', 'Estantes café pendientes', { price: 1.5 }),
            search_skip: task('search_skip', 'Estantes café omitidos', { skipHistory: [at] }),
            search_deleted: task('search_deleted', 'Estantes café eliminados', { deleted_at: new Date().toISOString() }),
          },
        });
      });
      const opener = page.getByTestId('user-profile-trigger');
      await opener.focus();
      await page.keyboard.press('Control+k');
      const dialog = page.getByRole('dialog', { name: 'Buscar', exact: true });
      const input = dialog.getByRole('textbox', { name: 'Buscar', exact: true });
      await expect(input).toBeFocused();
      await input.fill('cafe');
      const rows = dialog.locator('.spotlight-row');
      await expect(rows).toHaveCount(3);
      await expect(rows.nth(0)).toContainText('Estantes café pendientes');
      await expect(rows.nth(0)).toContainText('1,50 €');
      await expect(rows.nth(1)).toContainText('Estantes café omitidos');
      await expect(rows.nth(1).locator('.is-done')).toHaveCount(0);
      await expect(rows.nth(2)).toContainText('Completada');
      await expect(rows.nth(2).locator('.spotlight-check')).toHaveClass(/is-done/);
      await expect(rows.nth(2).getByRole('button', { name: /Enfocar/ })).toHaveCount(0);

      const clear = dialog.getByRole('button', { name: 'Borrar búsqueda', exact: true });
      const bounds = await clear.boundingBox();
      expect(bounds?.width).toBeGreaterThanOrEqual(24);
      expect(bounds?.height).toBeGreaterThanOrEqual(24);
      await input.press('Tab');
      await expect(clear).toBeFocused();
      await clear.press('Enter');
      await expect(input).toHaveValue('');
      await expect(dialog).toBeVisible();

      await input.fill('Archivo oculto');
      await expect(dialog.locator('.spotlight-empty')).toBeVisible();
      await input.press('ArrowUp');
      await input.press('Enter');
      await expect(dialog).toBeVisible();

      await input.fill('cafe');
      await input.press('ArrowUp');
      await expect(dialog.locator('.spotlight-row.is-selected')).toContainText('Estantes café hechos');
      await expect(dialog.getByRole('status')).toContainText('3 resultados. 3:');
      await input.press('ArrowDown');
      await expect(dialog.locator('.spotlight-row.is-selected')).toContainText('Estantes café pendientes');

      await page.clock.setFixedTime(new Date('2026-10-26T00:01:00+01:00'));
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      const completedRow = rows.filter({ hasText: 'Estantes café hechos' });
      await expect(completedRow.locator('.is-done')).toHaveCount(0);
      await expect(completedRow).not.toContainText('Completada');
      await page.clock.setFixedTime(new Date('2026-10-25T12:00:00+01:00'));
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await expect(completedRow).toContainText('Completada');

      for (const theme of ['light', 'dark']) {
        await page.evaluate(theme => (window as any).useAppStore.getState().setTheme(theme), theme);
        const axe = await new AxeBuilder({ page }).include('.spotlight-panel').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        expect(axe.violations.filter(item => item.impact === 'serious' || item.impact === 'critical')).toEqual([]);
      }
      await page.screenshot({ path: testInfo.outputPath('search.png') });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);

      // Tab reaches the secondary action; Enter must run it rather than opening the task editor.
      await dialog.getByRole('button', { name: 'Enfocar «Estantes café pendientes»', exact: true }).focus();
      await page.keyboard.press('Enter');
      await expect(dialog).toHaveCount(0);
      const zen = page.getByRole('dialog', { name: 'Modo Enfoque Zen' });
      await expect(zen).toBeVisible();
      await zen.getByRole('button', { name: 'Cerrar modo zen' }).click();
      await opener.focus();
      await page.keyboard.press('Control+k');
      await expect(input).toHaveValue('');
      if (width === 375) {
        await input.press('Tab');
        await expect(dialog.getByRole('button', { name: 'Cancelar', exact: true })).toBeFocused();
        await page.keyboard.press('Enter');
      } else {
        await page.keyboard.press('Escape');
      }
      await expect(dialog).toHaveCount(0);
      await expect(opener).toBeFocused();
      await page.keyboard.press('Control+k');
      await input.fill('cafe');
      await dialog.getByRole('button', { name: /^Estantes café pendientes/ }).press('Enter');
      const cancelEdit = page.getByRole('button', { name: 'Cancelar edición', exact: true });
      await expect(cancelEdit).toBeVisible();
      await cancelEdit.click();
      expect(errors).toEqual([]);
    });
  });
}
