import { test, expect } from '@playwright/test';
import { bootApp } from "./support/bootApp";

async function ensureAppUnlocked(page: any) {
    await bootApp(page);
}

async function seedTasks(page: any) {
  await page.evaluate(() => {
    const store = (window as any).useAppStore.getState();
    store.addList({ id: 'list_dnd', name: 'Arrastre Test', color: '#34c759' });
    store.addTask({ id: 'dnd_a', title: 'Tarea A', categoryId: 'list_dnd', status: 'pending', order: 0, created_at: new Date().toISOString() });
    store.addTask({ id: 'dnd_b', title: 'Tarea B', categoryId: 'list_dnd', status: 'pending', order: 1, created_at: new Date().toISOString() });
  });
  await page.locator('[data-list-id], .ios-list-item').filter({ hasText: 'Arrastre Test' }).first().click();
  await page.waitForTimeout(500);
  return {
    rowA: page.locator('.task-item-wrapper[data-task-id="dnd_a"]'),
    rowB: page.locator('.task-item-wrapper[data-task-id="dnd_b"]'),
  };
}

async function seedSections(page: any) {
  await page.evaluate(() => {
    const store = (window as any).useAppStore.getState();
    store.addList({ id: 'list_dnd_sec', name: 'Secciones Test', color: '#af52de' });
    store.addListSection({ id: 'sec_dnd_1', listId: 'list_dnd_sec', name: 'Primera', order: 0 });
    store.addListSection({ id: 'sec_dnd_2', listId: 'list_dnd_sec', name: 'Segunda', order: 1 });
    store.addTask({ id: 'dnd_sec_task', title: 'Algo', categoryId: 'list_dnd_sec', sectionId: 'sec_dnd_1', status: 'pending', created_at: new Date().toISOString() });
  });
  await page.locator('[data-list-id], .ios-list-item').filter({ hasText: 'Secciones Test' }).first().click();
  await page.waitForTimeout(500);
  const header = (name: string) => page.locator('.group-header', { has: page.locator(`h3:text-is("${name}")`) }).first();
  return { first: header('Primera'), second: header('Segunda') };
}

// El borde (arriba/abajo) de la fila reordena; solo el centro anida — igual en tareas y en secciones.
test.describe('Arrastrar para reordenar o anidar', () => {
  test('una tarea sobre el borde superior de otra la reordena antes', async ({ page }) => {
    await ensureAppUnlocked(page);
    const { rowA, rowB } = await seedTasks(page);
    await expect(rowA).toBeVisible();
    await expect(rowB).toBeVisible();

    const handleB = (await rowB.locator('.task-drag-handle').count()) > 0 ? rowB.locator('.task-drag-handle') : rowB;
    await handleB.dragTo(rowA, { targetPosition: { x: 60, y: 4 } });
    await page.waitForTimeout(300);

    const order = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.task-item-wrapper[data-task-id]'))
        .map((w) => w.getAttribute('data-task-id'))
        .filter((id) => id === 'dnd_a' || id === 'dnd_b')
    );
    expect(order).toEqual(['dnd_b', 'dnd_a']);
    const parent = await page.evaluate(() => (window as any).useAppStore.getState().tasks['dnd_b']?.parentId);
    expect(parent).toBeFalsy();
  });

  test('una tarea sobre el centro de otra la anida como subtarea', async ({ page }) => {
    await ensureAppUnlocked(page);
    const { rowA, rowB } = await seedTasks(page);
    const boxA = await rowA.boundingBox();
    const handleB = (await rowB.locator('.task-drag-handle').count()) > 0 ? rowB.locator('.task-drag-handle') : rowB;
    await handleB.dragTo(rowA, { targetPosition: { x: 60, y: (boxA?.height ?? 52) / 2 } });
    await page.waitForTimeout(300);

    const parent = await page.evaluate(() => (window as any).useAppStore.getState().tasks['dnd_b']?.parentId);
    expect(parent).toBe('dnd_a');
  });

  test('una sección sobre el borde de otra la reordena, no la anida', async ({ page }) => {
    await ensureAppUnlocked(page);
    const { first, second } = await seedSections(page);
    await expect(first).toBeVisible();
    await expect(second).toBeVisible();

    await second.dragTo(first, { targetPosition: { x: 80, y: 4 } });
    await page.waitForTimeout(300);

    const sections = await page.evaluate(() =>
      (window as any).useAppStore.getState().listSections
        .filter((s: any) => s.listId === 'list_dnd_sec' && !s.deleted_at)
        .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
        .map((s: any) => s.id)
    );
    expect(sections).toEqual(['sec_dnd_2', 'sec_dnd_1']);
    const parent = await page.evaluate(() =>
      (window as any).useAppStore.getState().listSections.find((s: any) => s.id === 'sec_dnd_2')?.parentId
    );
    expect(parent).toBeFalsy();
  });

  test('una sección sobre el centro de otra la anida como subsección', async ({ page }) => {
    await ensureAppUnlocked(page);
    const { first, second } = await seedSections(page);
    const boxFirst = await first.boundingBox();
    await second.dragTo(first, { targetPosition: { x: 80, y: (boxFirst?.height ?? 44) / 2 } });
    await page.waitForTimeout(300);

    const parent = await page.evaluate(() =>
      (window as any).useAppStore.getState().listSections.find((s: any) => s.id === 'sec_dnd_2')?.parentId
    );
    expect(parent).toBe('sec_dnd_1');
  });
});

// Listas largas: al acercarse al borde inferior la lista se desplaza sola, y soltar tras la última
// subtarea deja la tarea al final como tarea normal (no como subtarea de la última).
test.describe('Arrastrar en listas largas', () => {
  async function seedLong(page: any) {
    await page.evaluate(() => {
      const store = (window as any).useAppStore.getState();
      store.addList({ id: 'list_dnd_long', name: 'Larga Test', color: '#007aff' });
      store.addListSection({ id: 'sec_long_a', listId: 'list_dnd_long', name: 'Sección A', order: 0 });
      store.addListSection({ id: 'sec_long_b', listId: 'list_dnd_long', name: 'Sección B', order: 1 });
      for (let i = 1; i <= 24; i++) {
        store.addTask({ id: `long_${i}`, title: `Tarea ${i}`, categoryId: 'list_dnd_long', sectionId: i <= 12 ? 'sec_long_a' : 'sec_long_b', status: 'pending', order: i, created_at: new Date().toISOString() });
      }
      store.addTask({ id: 'long_sub', title: 'Subtarea de la 24', categoryId: 'list_dnd_long', sectionId: 'sec_long_b', parentId: 'long_24', status: 'pending', order: 25, created_at: new Date().toISOString() });
    });
    await page.locator('[data-list-id], .ios-list-item').filter({ hasText: 'Larga Test' }).first().click();
    await expect(page.locator('.task-item-wrapper[data-task-id="long_1"]')).toBeVisible();
  }

  test('con el ratón, la lista baja sola y la primera tarea acaba la última', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'Arrastre con ratón (HTML5) solo en escritorio');
    await ensureAppUnlocked(page);
    await seedLong(page);
    // Eventos de arrastre reales del navegador: la emulación de Playwright pierde el «drop» si la
    // fila de origen sale de la pantalla durante el desplazamiento.
    const result = await page.evaluate(async () => {
      const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
      const dt = new DataTransfer();
      const handle = document.querySelector('.task-item-wrapper[data-task-id="long_1"] .task-drag-handle') as HTMLElement;
      const hr = handle.getBoundingClientRect();
      handle.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: hr.x + 5, clientY: hr.y + 5 }));
      const scroller = document.querySelector('.content-scroll') as HTMLElement;
      const y = innerHeight - 20;
      for (let k = 0; k < 60 && scroller.scrollTop < scroller.scrollHeight - scroller.clientHeight - 1; k++) {
        (document.elementFromPoint(innerWidth / 2, y) || document.body).dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: innerWidth / 2, clientY: y }));
        await sleep(50);
      }
      const scrolled = scroller.scrollTop;
      const row = document.querySelector('.task-item-wrapper[data-task-id="long_sub"]') as HTMLElement;
      const r = row.getBoundingClientRect();
      const cy = r.top + r.height * 0.85;
      for (let k = 0; k < 3; k++) { row.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: innerWidth / 2, clientY: cy })); await sleep(60); }
      row.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: innerWidth / 2, clientY: cy }));
      handle.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
      await sleep(300);
      return { scrolled };
    });
    expect(result.scrolled).toBeGreaterThan(200);
    const moved = await page.evaluate(() => {
      const task = (window as any).useAppStore.getState().tasks['long_1'];
      const ids = Array.from(document.querySelectorAll('.task-item-wrapper[data-task-id]')).map(w => w.getAttribute('data-task-id'));
      return { parentId: task.parentId ?? null, sectionId: task.sectionId, last: ids[ids.length - 1] };
    });
    expect(moved).toEqual({ parentId: null, sectionId: 'sec_long_b', last: 'long_1' });
  });
});

// iOS (WebKit) decide al empezar el toque si el scroll nativo puede correr en paralelo: solo lo para un
// preventDefault si ya había una escucha `touchmove` no pasiva en la fila ANTES de tocarla. Sin ella,
// al arrastrar hacia abajo la lista subía (y al revés). Chromium no reproduce ese comportamiento, así
// que se comprueba la condición que lo evita, con las escuchas reales del navegador (CDP).
test.describe('Arrastrar con el dedo', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('filas y cabeceras ya escuchan touchmove sin ser pasivas antes de tocarlas (iOS)', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Las escuchas se leen por CDP');
    await ensureAppUnlocked(page);
    await seedSections(page);
    const cdp = await page.context().newCDPSession(page);
    const listenersOf = async (selector: string) => {
      const { result } = await cdp.send('Runtime.evaluate', { expression: `document.querySelector(${JSON.stringify(selector)})` });
      const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId! });
      return listeners.filter((listener: any) => listener.type === 'touchmove').map((listener: any) => listener.passive);
    };
    expect(await listenersOf('.task-item-wrapper[data-task-id="dnd_sec_task"]')).toContain(false);
    expect(await listenersOf('.group-header[data-section-drag-key="sec_dnd_1"]')).toContain(false);
  });

  test('mantener pulsado y bajar el dedo hasta el borde desplaza la lista y lleva la primera al final', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Toques reales por CDP');
    await ensureAppUnlocked(page);
    await page.evaluate(() => {
      const store = (window as any).useAppStore.getState();
      store.addList({ id: 'list_touch_long', name: 'Táctil Test', color: '#007aff' });
      for (let i = 1; i <= 24; i++) {
        store.addTask({ id: `touch_${i}`, title: `Tarea ${i}`, categoryId: 'list_touch_long', status: 'pending', order: i, created_at: new Date().toISOString() });
      }
    });
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('select-view', { detail: 'list_list_touch_long' })));
    const first = page.locator('.task-item-wrapper[data-task-id="touch_1"]');
    await expect(first).toBeVisible();
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: string, x = 0, y = 0) => cdp.send('Input.dispatchTouchEvent', { type: type as any, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const box = (await first.boundingBox())!;
    const x = box.x + 120;
    const y = box.y + box.height / 2;
    await touch('touchStart', x, y);
    await page.waitForTimeout(450);
    for (let step = 1; step <= 8; step++) { await touch('touchMove', x, y + step * 4); await page.waitForTimeout(16); }
    for (let to = y + 40; to <= 844 - 60; to += 30) { await touch('touchMove', x, to); await page.waitForTimeout(16); }
    // Quieto junto al borde inferior: la lista debe bajar sola hasta el final.
    await expect.poll(() => page.evaluate(() => {
      const scroller = document.querySelector('.content-scroll') as HTMLElement;
      return scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;
    }), { timeout: 6000 }).toBeLessThan(2);
    const last = (await page.locator('.task-item-wrapper[data-task-id="touch_24"]').boundingBox())!;
    await touch('touchMove', x, last.y + last.height * 0.85);
    await page.waitForTimeout(120);
    await touch('touchEnd');
    await expect.poll(() => page.evaluate(() => {
      const ids = Array.from(document.querySelectorAll('.task-item-wrapper[data-task-id]')).map(row => row.getAttribute('data-task-id'));
      return ids[ids.length - 1];
    })).toBe('touch_1');
  });
});
