import { test, expect, type Page } from '@playwright/test';
import { bootApp } from './support/bootApp';

// Menús y hojas: al abrirse no deben parpadear (aparecer, desaparecer y volver), remontarse ni mover el
// scroll, y ningún foco programático debe caer en un elemento aún fuera de pantalla sin preventScroll:
// iOS Safari desplaza entonces la página y la hoja parece irse hacia arriba y volver.
const SHEETS = '[role="menu"], [role="dialog"], .ios-dropdown-menu, .ios-bottom-sheet, .frequency-picker-popover';

async function seed(page: Page) {
  await bootApp(page);
  await page.evaluate(() => {
    const st = (window as any).useAppStore.getState();
    st.addList({ id: 'motion', name: 'Movimiento', color: '#ff9500', listType: 'routines' });
    st.addListSection({ id: 'motion_a', listId: 'motion', name: 'Cocina', order: 0 });
    for (let i = 0; i < 6; i++) st.addTask({ id: `motion_${i}`, title: `Tarea ${i}`, categoryId: 'motion', sectionId: 'motion_a', status: 'pending', cycle_id: 'cycle_week', duration: 10, created_at: new Date().toISOString() });
    // Registro de focos que harían saltar la página en iOS.
    const original = HTMLElement.prototype.focus;
    (window as any).__badFocus = [];
    HTMLElement.prototype.focus = function (this: HTMLElement, options?: FocusOptions) {
      const r = this.getBoundingClientRect();
      const offscreen = r.bottom > innerHeight + 1 || r.top < -1;
      if (!options?.preventScroll && offscreen) (window as any).__badFocus.push(`${this.tagName}.${this.className}`);
      return original.call(this, options);
    };
  });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('select-view', { detail: 'list_motion' })));
  await expect(page.locator('.task-item-wrapper[data-task-id="motion_0"]')).toBeVisible();
}

async function watch(page: Page, open: () => Promise<void>) {
  await page.evaluate((selector) => {
    const w = window as any;
    w.__frames = []; w.__badFocus = [];
    let id = 0; const start = performance.now();
    const scroller = document.querySelector('.content-scroll') as HTMLElement | null;
    const tick = () => {
      const open = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(e => e.getClientRects().length);
      w.__frames.push({ scroll: scroller?.scrollTop ?? 0, ids: open.map(e => ((e as any).__sid ??= ++id)) });
      if (performance.now() - start < 1100) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, SHEETS);
  await open();
  await page.waitForTimeout(1200);
  return page.evaluate(() => {
    const w = window as any;
    const frames: { scroll: number; ids: number[] }[] = w.__frames;
    const allIds = new Set(frames.flatMap(f => f.ids));
    // Un mismo menú no debe dejar de verse y volver (huecos en los fotogramas en los que aparece).
    let flicker = 0;
    for (const sid of allIds) {
      const seen = frames.map((f, index) => f.ids.includes(sid) ? index : -1).filter(index => index >= 0);
      for (let k = 1; k < seen.length; k++) if (seen[k] - seen[k - 1] > 1) flicker++;
    }
    const scrolls = frames.map(f => f.scroll);
    return {
      mounted: allIds.size,
      flicker,
      scrollJump: Math.max(...scrolls) - Math.min(...scrolls),
      badFocus: w.__badFocus as string[],
      openAtEnd: frames.at(-1)?.ids.length ?? 0,
    };
  });
}

for (const viewport of [{ name: 'móvil', width: 390, height: 844 }, { name: 'escritorio', width: 1280, height: 860 }]) {
  test.describe(`Menús sin parpadeos (${viewport.name})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('menú de la lista, de la sección y de la tarea', async ({ page }) => {
      await seed(page);
      const cases: [string, () => Promise<void>][] = [
        ['lista', () => page.getByRole('button', { name: 'Opciones de lista' }).first().click()],
        ['sección', async () => { await page.locator('.group-header').first().hover(); await page.locator('.section-head-more').first().click(); }],
        ['tarea', () => page.locator('.task-item-wrapper[data-task-id="motion_0"]').click({ button: 'right' })],
        ['editor', async () => {
          // Con el dedo, el (i) aparece al tocar la fila, como en Recordatorios; con ratón, al pasar por encima.
          if (viewport.width < 700) await page.locator('.task-item-wrapper[data-task-id="motion_0"] .task-row-content').first().click();
          await page.getByRole('button', { name: 'Detalles de «Tarea 0»' }).click(viewport.width < 700 ? {} : { force: true });
        }],
      ];
      for (const [name, open] of cases) {
        const result = await watch(page, open);
        expect.soft(result.openAtEnd, `${name}: debe quedar abierto`).toBeGreaterThan(0);
        expect.soft(result.mounted, `${name}: montado una sola vez`).toBe(result.openAtEnd);
        expect.soft(result.flicker, `${name}: sin parpadeos`).toBe(0);
        expect.soft(result.scrollJump, `${name}: sin saltos de scroll`).toBeLessThanOrEqual(2);
        expect.soft(result.badFocus, `${name}: foco sin desplazar la página`).toEqual([]);
        await page.keyboard.press('Escape');
        await expect(page.locator(SHEETS).filter({ visible: true })).toHaveCount(0);
      }
    });

    test('el resumen diario se abre una vez, sin saltos', async ({ page }) => {
      await seed(page);
      const result = await watch(page, () => page.evaluate(() => window.dispatchEvent(new CustomEvent('open-daily-greeting'))));
      expect(result.openAtEnd).toBe(1);
      expect(result.mounted).toBe(1);
      expect(result.flicker).toBe(0);
      expect(result.badFocus).toEqual([]);
    });
  });
}
