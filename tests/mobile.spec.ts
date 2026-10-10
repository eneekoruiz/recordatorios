import { test, expect, type Page } from '@playwright/test';
import { bootApp } from "./support/bootApp";

async function boot(page: Page) {
    await bootApp(page);
    await page.evaluate(() => {
        const st = (window as any).useAppStore.getState();
        st.addList({ id: 'casa', name: 'Casa', color: '#ff9500' });
        st.addTask({ id: 'a', title: 'Limpiar cocina con un título bastante largo para comprobar que no se sale de la pantalla', status: 'pending', categoryId: 'casa', duration: 30, price: 12.5 });
        st.addTask({ id: 'b', title: 'Llamar al médico', status: 'pending', categoryId: 'casa', dueDate: new Date().toISOString(), priority: 'high' });
      });
}

const event = (page: Page, name: string, detail?: unknown) =>
  page.evaluate(([n, d]) => window.dispatchEvent(new CustomEvent(n as string, { detail: d })), [name, detail] as const);

const overflowX = (page: Page) =>
  page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);

test.describe('iPhone (emulado)', () => {
  test('ninguna vista desborda en horizontal', async ({ page }) => {
    await boot(page);
    expect(await overflowX(page), 'barra lateral').toBeLessThanOrEqual(0);
    for (const view of ['smart_today', 'smart_all', 'smart_calendar', 'list_casa', 'ANALYTICS', 'TRASH']) {
      await event(page, 'select-view', view);
      await page.waitForTimeout(600);
      expect(await overflowX(page), view).toBeLessThanOrEqual(0);
    }
  });

  test('los modales caben en la pantalla y se cierran con Escape', async ({ page }) => {
    await boot(page);
    await event(page, 'select-view', 'list_casa');
    for (const name of ['open-new-task-drawer', 'open-ai-assistant', 'open-command-palette']) {
      await event(page, name);
      await page.waitForTimeout(700);
      expect(await overflowX(page), name).toBeLessThanOrEqual(0);
      const box = await page.evaluate(() => {
        const el = document.querySelector('[role="dialog"], .form-sheet, .spotlight-panel, .drawer') as HTMLElement | null;
        const r = el?.getBoundingClientRect();
        return r ? { l: r.left, r: r.right, w: window.innerWidth } : null;
      });
      if (box) {
        expect(box.l, name).toBeGreaterThanOrEqual(-1);
        expect(box.r, name).toBeLessThanOrEqual(box.w + 1);
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }
  });

  test('los controles tienen un área táctil de 44 px y el texto de entrada no provoca zoom en iOS', async ({ page }) => {
    await boot(page);
    for (const view of ['smart_today', 'list_casa']) {
      await event(page, 'select-view', view);
      await page.waitForTimeout(700);
      // Comprobar cajas reales y que ningún vecino robe el toque a 21 px del centro.
      const small = await page.evaluate(() => {
        const hits = (el: Element, dx: number, dy: number) => {
          const r = el.getBoundingClientRect();
          const x = r.left + r.width / 2 + dx;
          const y = r.top + r.height / 2 + dy;
          if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return true;
          const top = document.elementFromPoint(x, y);
          // Solo cuenta si OTRO control se lleva el toque (pisándose con su vecino); un fondo o una barra no.
          const other = top?.closest('button, [role="button"], a[href]');
          return !other || other === el;
        };
        return [...document.querySelectorAll('button, [role="button"], a[href]')]
          .filter((el) => (el as HTMLElement).offsetParent !== null && el.getBoundingClientRect().width > 0)
          .filter((el) => !el.classList.contains('task-title'))
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width < 43.9 || r.height < 43.9 ||
              !(hits(el, -21, 0) && hits(el, 21, 0) && hits(el, 0, -21) && hits(el, 0, 21));
          })
          .map((el) => (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || el.className).toString().trim().slice(0, 40));
      });
      expect(small, `${view}: controles con zona táctil < 44 px: ${small.join(' | ')}`).toEqual([]);
    }
    // iOS Safari amplía la página al enfocar campos con fuente < 16 px.
    await event(page, 'open-new-task-drawer');
    await page.waitForTimeout(700);
    const tooSmall = await page.evaluate(() =>
      [...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea, select')]
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
        .map((el) => el.getAttribute('placeholder') || el.getAttribute('aria-label') || el.tagName),
    );
    expect(tooSmall, `campos con fuente < 16 px: ${tooSmall.join(' | ')}`).toEqual([]);
  });

  test('el viewport respeta el área segura y no bloquea el zoom', async ({ page }) => {
    await page.goto('/');
    const content = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(content).toContain('viewport-fit=cover');
    expect(content).not.toMatch(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?(?![\d])/);
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"], meta[name="mobile-web-app-capable"]').first()).toHaveCount(1);
  });
});
