import { expect, test, type Page } from '@playwright/test';
import { bootApp } from './support/bootApp';

const LONG_TITLE = 'Recoger y ordenar cuidadosamente los productos y utensilios de todas las habitaciones, guardar lo que está fuera de sitio y dejar preparadas las superficies para la siguiente sesión de limpieza de la casa';
const taskRow = (page: Page, id: string) => page.locator(`.task-item-wrapper[data-task-id="${id}"]`);

async function seedRoutine(page: Page) {
  await page.clock.setFixedTime(new Date('2026-10-25T23:59:55+01:00'));
  await bootApp(page);
  await page.evaluate(title => {
    const api = (window as any).useAppStore;
    const at = new Date('2026-10-24T18:00:00+02:00').getTime();
    const task = (id: string, title: string, cycle: string, duration: number, done = false) => ({
      id, title, cycle_id: cycle, duration, categoryId: 'audit-house', type: 'task', status: 'pending',
      user_id: 'local_guest_e2e', version: 1, created_at: '2026-10-01T10:00:00Z',
      updated_at: '2026-10-24T16:00:00Z', completionHistory: done ? [at] : [],
    });
    api.setState({
      lists: [{ id: 'audit-house', name: 'Casa de prueba', color: '#007aff', listType: 'routines', showCompleted: true, sortMode: 'manual' }],
      listSections: [],
      tasks: {
        audit_week: task('audit_week', 'Limpiar muebles', 'cycle_week', 30, true),
        audit_pending: task('audit_pending', 'Limpiar ventanas', 'cycle_week', 20),
        audit_daily: task('audit_daily', title, 'cycle_day', 10, true),
      },
    });
    window.dispatchEvent(new CustomEvent('select-view', { detail: 'cycle_week' }));
  }, LONG_TITLE);
}

for (const width of [375, 768, 1440]) {
  test.describe(`audited changes at ${width}px`, () => {
    test.use({ viewport: { width, height: 1000 }, timezoneId: 'Europe/Madrid', reducedMotion: 'reduce', hasTouch: true });

    test('full routine keeps checkboxes, time and undo consistent with the original session', async ({ page }, testInfo) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await seedRoutine(page);
      const include = page.getByRole('button', { name: 'Rutina completa: incluir las diarias', exact: true }).first();
      await expect(include).toBeVisible();
      if (await include.getAttribute('aria-pressed') !== 'true') await include.click();
      await expect(page.locator('.cycle-strip-meta .section-head-duration')).toContainText('20 min');
      await expect(page.getByTestId('cycle-status-pill-btn')).toHaveAttribute('aria-label', /2 de 3 hechas/);

      // The list exposes completed rows; frequency views intentionally hide them.
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('select-view', { detail: 'list_audit-house' })));
      const dailyHeader = page.locator('.group-header', { has: page.locator('.section-head-title', { hasText: /^Diari[ao]s?$/ }) }).first();
      await dailyHeader.locator('.section-head-chevron').click();
      const weeklyHeader = page.locator('.group-header', { has: page.getByRole('button', { name: 'Rutina completa: incluir las diarias', exact: true }) }).first();
      const includeInSection = weeklyHeader.getByRole('button', { name: 'Rutina completa: incluir las diarias', exact: true });
      if (await includeInSection.getAttribute('aria-pressed') !== 'true') await includeInSection.click();
      const daily = taskRow(page, 'audit_daily');
      await expect(daily.getByRole('button', { name: 'Marcar como pendiente', exact: true })).toBeVisible();
      await expect(weeklyHeader.locator('.section-head-duration')).toContainText('20 min');
      await expect(daily.locator('.task-title > span')).toHaveCSS('text-decoration-line', 'line-through');
      await page.screenshot({ path: testInfo.outputPath('full-routine.png') });
      await daily.getByRole('button', { name: 'Marcar como pendiente', exact: true }).click();
      await expect(daily.getByRole('button', { name: 'Completar tarea', exact: true })).toBeVisible();
      await expect(weeklyHeader.locator('.section-head-duration')).toContainText('30 min');
      expect(await page.evaluate(() => (window as any).useAppStore.getState().tasks.audit_daily.completionHistory)).toEqual([]);

      await daily.getByRole('button', { name: 'Completar tarea', exact: true }).click();
      await expect(page.locator('.premium-toast')).toContainText('completado');
      await page.clock.setFixedTime(new Date('2026-10-26T00:00:05+01:00'));
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await page.keyboard.press('Control+z');
      await expect.poll(() => page.evaluate(() => (window as any).useAppStore.getState().tasks.audit_daily.completionHistory.length)).toBe(0);
      expect(await page.evaluate(() => (window as any).useAppStore.getState().tasks.audit_week.completionHistory.length)).toBe(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      expect(errors).toEqual([]);
    });

    test('unmounting another row preserves an active touch drag, and unmounting its owner cancels it', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await bootApp(page);
      await page.evaluate(() => {
        const api = (window as any).useAppStore;
        api.setState({
          lists: [{ id: 'drag-audit', name: 'Arrastre de prueba', listType: 'simple', color: '#007aff', sortMode: 'manual' }],
          listSections: [],
          tasks: Object.fromEntries(['a', 'b', 'c'].map((id, i) => [`drag_${id}`, {
            id: `drag_${id}`, title: `Recordatorio ${id}`, type: 'task', status: 'pending', categoryId: 'drag-audit',
            user_id: 'local_guest_e2e', version: 1, created_at: new Date().toISOString(), order: i,
          }])),
        });
        window.dispatchEvent(new CustomEvent('select-view', { detail: 'list_drag-audit' }));
      });
      const source = taskRow(page, 'drag_a');
      await expect(source).toBeVisible();
      await source.click({ button: 'right' });
      await page.evaluate(() => {
        (window as any).__originalScroll = HTMLElement.prototype.scrollIntoView;
        (window as any).__scrollModes = [];
        HTMLElement.prototype.scrollIntoView = function(options) {
          (window as any).__scrollModes.push(typeof options === 'object' ? options?.behavior : undefined);
          (window as any).__originalScroll.call(this, options);
        };
      });
      await page.getByRole('button', { name: /^Más opciones/ }).click();
      await expect.poll(() => page.evaluate(() => (window as any).__scrollModes.includes('instant'))).toBe(true);
      await page.evaluate(() => { HTMLElement.prototype.scrollIntoView = (window as any).__originalScroll; });
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: /^Menos opciones/ })).toHaveCount(0);
      const box = (await source.boundingBox())!;
      await page.evaluate(() => { document.body.style.overflow = 'hidden'; });
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + 85, y: box.y + 20 }] });
      await page.waitForTimeout(350);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + 85, y: box.y + 80 }] });
      await expect(page.locator('[data-drag-ghost]')).toHaveCount(1);
      await page.evaluate(() => (window as any).useAppStore.getState().deleteTask('drag_b'));
      await expect(taskRow(page, 'drag_b')).toHaveCount(0);
      await expect(page.locator('[data-drag-ghost]')).toHaveCount(1);
      await page.evaluate(() => (window as any).useAppStore.getState().deleteTask('drag_a'));
      await expect(page.locator('[data-drag-ghost]')).toHaveCount(0);
      expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      expect(await page.evaluate(() => Boolean((window as any).useAppStore.getState().tasks.drag_a.deleted_at))).toBe(true);
      expect(errors).toEqual([]);
    });
  });
}
