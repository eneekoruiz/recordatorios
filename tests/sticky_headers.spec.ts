import { test, expect, type Page } from '@playwright/test';
import { bootApp } from './support/bootApp';

// Cabeceras fijas al hacer scroll: una subsección se pega justo debajo de la cabecera principal de su
// bloque, mida lo que mida. Con un desplazamiento fijo quedaba un hueco por el que se leían las tareas
// de detrás (o la subsección se metía debajo y se cortaba). Se recorre la lista entera a pasos cortos.
async function seed(page: Page) {
  await bootApp(page);
  await page.evaluate(() => {
    const st = (window as any).useAppStore.getState();
    st.addList({ id: 'sticky', name: 'Fijas', color: '#ff9500', listType: 'routines' });
    st.addListSection({ id: 'sticky_hv', listId: 'sticky', name: 'Hábitos vitales', order: 0 });
    st.addListSection({ id: 'sticky_ent', listId: 'sticky', name: 'Entreno', order: 1 });
    st.addListSection({ id: 'sticky_limp', listId: 'sticky', name: 'Limpieza', order: 2 });
    st.addListSection({ id: 'sticky_coc', listId: 'sticky', name: 'Cocina', order: 0, parentId: 'sticky_limp' });
    const add = (id: string, sectionId?: string) => st.addTask({ id, title: id, categoryId: 'sticky', sectionId, status: 'pending', cycle_id: 'cycle_day', duration: 5, created_at: new Date().toISOString() });
    for (let i = 0; i < 7; i++) add(`hv_${i}`, 'sticky_hv');
    for (let i = 0; i < 7; i++) add(`ent_${i}`, 'sticky_ent');
    for (let i = 0; i < 16; i++) add(`coc_${i}`, 'sticky_coc');
    for (let i = 0; i < 4; i++) add(`suelta_${i}`);
  });
}

async function stickyGaps(page: Page) {
  return page.evaluate(async () => {
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const scroller = document.querySelector('.content-scroll') as HTMLElement;
    const top = scroller.getBoundingClientRect().top;
    const problems: string[] = [];
    let pairs = 0;
    for (let pos = 0; pos <= scroller.scrollHeight - scroller.clientHeight; pos += 17) {
      scroller.scrollTo({ top: pos, behavior: 'instant' as ScrollBehavior });
      await sleep(20);
      const stuck = Array.from(document.querySelectorAll<HTMLElement>('.group-header')).filter(header => {
        const style = getComputedStyle(header);
        return style.position === 'sticky' && Math.abs(header.getBoundingClientRect().top - (top + parseFloat(style.top))) < 1;
      });
      for (const nested of stuck) {
        const parent = Array.from(nested.closest('.section-container')?.children ?? []).find(child => child.classList.contains('group-header')) as HTMLElement | undefined;
        if (!parent || parent === nested || !stuck.includes(parent)) continue;
        pairs++;
        const gap = nested.getBoundingClientRect().top - parent.getBoundingClientRect().bottom;
        if (Math.abs(gap) > 1) problems.push(`${pos}px: «${nested.innerText.split('\n')[0]}» a ${gap.toFixed(1)} px de «${parent.innerText.split('\n')[0]}»`);
      }
    }
    return { pairs, problems };
  });
}

test.use({ viewport: { width: 390, height: 844 } });

for (const theme of ['light', 'dark'] as const) {
  for (const view of ['cycle_day', 'list_sticky']) {
    test(`${view} (${theme}): las subsecciones fijas se pegan sin hueco bajo su cabecera`, async ({ page }) => {
      await seed(page);
      await page.evaluate((t) => (window as any).useAppStore.getState().setTheme(t), theme);
      await page.evaluate((v) => window.dispatchEvent(new CustomEvent('select-view', { detail: v })), view);
      await expect(page.locator('.group-header', { hasText: 'Entreno' }).first()).toBeVisible();
      const { pairs, problems } = await stickyGaps(page);
      expect(pairs).toBeGreaterThan(0);
      expect(problems).toEqual([]);
    });
  }
}
