import { test, expect } from '@playwright/test';

async function ensureAppUnlocked(page: any) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  await page.evaluate(() => {
    (window as any).__E2E__ = true;
    sessionStorage.setItem('__E2E__', 'true');
    sessionStorage.setItem('daily_greeting_seen_session', 'true');
    localStorage.setItem('daily_greeting_dismissed_day', new Date().toDateString());
    (window as any).useAppStore?.getState()?.setToken('local_offline_token', 'local_guest_e2e');
  });

  const guestBtn = page.locator('button:has-text("Usar sin cuenta")').first();
  try {
    await guestBtn.click({ timeout: 1500 });
  } catch {
    // Already unlocked
  }

  await page.waitForTimeout(400);
}

test.describe('Frecuencia Smart Lists, Spacing, and Section Routine Toggles', () => {
  test('1. Sidebar displays Frecuencia section and weekly aggregated view works', async ({ page }) => {
    await ensureAppUnlocked(page);

    // Check that Frecuencia header exists in sidebar
    const frecuenciaHeader = page.locator('span:has-text("Frecuencia")');
    await expect(frecuenciaHeader.first()).toBeVisible({ timeout: 10000 });

    // Check that Semanal, Diario, Mensual, and Anual are listed in the sidebar
    const semanalItem = page.locator('.ios-list-item:has-text("Semanal")');
    await expect(semanalItem.first()).toBeVisible();

    const diarioItem = page.locator('.ios-list-item:has-text("Diario")');
    await expect(diarioItem.first()).toBeVisible();

    const mensualItem = page.locator('.ios-list-item:has-text("Mensual")');
    await expect(mensualItem.first()).toBeVisible();

    const anualItem = page.locator('.ios-list-item:has-text("Anual")');
    await expect(anualItem.first()).toBeVisible();

    // Add a weekly task to test context menu and weekly view
    await page.evaluate(() => {
      (window as any).useAppStore?.getState()?.addTask({
        id: 'test_weekly_task_1',
        title: 'Comprobar rutina semanal',
        cycle_id: 'cycle_week',
        status: 'pending',
        created_at: new Date().toISOString()
      });
    });
    await page.waitForTimeout(300);

    // Click on Semanal to navigate to unified weekly view
    await semanalItem.first().click();

    // Verify Semanal header is displayed in main content
    const pageTitle = page.locator('h1:has-text("Semanal")');
    await expect(pageTitle).toBeVisible({ timeout: 5000 });

    // Verify task card appears
    const taskCard = page.locator('[data-task-id="test_weekly_task_1"]').first();
    await expect(taskCard).toBeVisible({ timeout: 5000 });

    // Right-click to open context menu
    await taskCard.click({ button: 'right' });

    // Verify context menu is visible
    const contextMenu = page.locator('.ios-dropdown-menu');
    await expect(contextMenu).toBeVisible({ timeout: 3000 });

    // Verify no blue ring on the task card
    const cardBoxShadow = await taskCard.evaluate((el) => {
      return window.getComputedStyle(el).boxShadow;
    });
    expect(cardBoxShadow).not.toContain('rgb(0, 122, 255)');

    // Verify "Editar recordatorio" item exists
    const editOption = contextMenu.locator('text=Editar recordatorio');
    await expect(editOption).toBeVisible();

    // Close context menu by pressing Escape
    await page.keyboard.press('Escape');
  });

  test('2. Routine toggle [Solo | Todas] works on Semanales and spacing is clean', async ({ page }) => {
    await ensureAppUnlocked(page);

    // Set up a list with a Diarias section and a Semanales section
    await page.evaluate(() => {
      const store = (window as any).useAppStore?.getState();
      if (!store) return;

      const listId = 'test_routine_list';
      store.addTasksBatch([], {
        createList: {
          id: listId,
          name: 'Rutinas Test',
          color: '#af52de',
          icon: 'sparkles'
        }
      });

      store.addListSection({
        id: 'sec_test_diaria',
        listId,
        name: 'Diarias',
        order: 0
      });

      store.addListSection({
        id: 'sec_test_semanal',
        listId,
        name: 'Semanales',
        order: 1
      });

      // Add a daily task
      store.addTask({
        id: 'task_daily_1',
        title: 'Hábito diario',
        categoryId: listId,
        sectionId: 'sec_test_diaria',
        cycle_id: 'cycle_day',
        status: 'pending',
        created_at: new Date().toISOString()
      });

      // Add a weekly task
      store.addTask({
        id: 'task_weekly_1',
        title: 'Hábito semanal',
        categoryId: listId,
        sectionId: 'sec_test_semanal',
        cycle_id: 'cycle_week',
        status: 'pending',
        created_at: new Date().toISOString()
      });
    });

    await page.waitForTimeout(300);

    // Navigate to the list
    const testListItem = page.locator('.ios-list-item:has-text("Rutinas Test")');
    if (await testListItem.count() > 0) {
      await testListItem.first().click();
    } else {
      await page.evaluate(() => {
        (window as any).useAppStore?.getState()?.onSelectView?.('list_test_routine_list');
      });
    }
    await page.waitForTimeout(400);

    // Verify Semanales header is visible and expand it (starts collapsed by default)
    const semanalHeader = page.locator('.group-header:has-text("Semanales")');
    await expect(semanalHeader).toBeVisible({ timeout: 5000 });
    await semanalHeader.click();
    await page.waitForTimeout(300);

    const soloBtn = semanalHeader.locator('button:has-text("Solo")');
    const todasBtn = semanalHeader.locator('button:has-text("Todas")');

    await expect(soloBtn).toBeVisible({ timeout: 5000 });
    await expect(todasBtn).toBeVisible({ timeout: 5000 });

    // By default, Solo is active and only weekly task is in Semanales
    await expect(soloBtn).toHaveClass(/active/);

    // Click "Todas"
    await todasBtn.click();
    await page.waitForTimeout(300);
    await expect(todasBtn).toHaveClass(/active/);

    // Click "Solo" back
    await soloBtn.click();
    await page.waitForTimeout(300);
    await expect(soloBtn).toHaveClass(/active/);

    // Verify there is no redundant .ios-section-divider inside the group headers
    const redundantDividers = page.locator('.group-header .ios-section-divider');
    expect(await redundantDividers.count()).toBe(0);
  });

  test('3. Frequency view preserves room/subgroup headers within cyclic sections and toggles on first click', async ({ page }) => {
    await ensureAppUnlocked(page);

    await page.evaluate(() => {
      const store = (window as any).useAppStore?.getState();
      if (!store) return;

      const testListId = 'list_limpieza_test';
      store.addList({
        id: testListId,
        name: 'Limpieza Test',
        color: '#34C759',
        icon: 'Sparkles',
        order: 99
      });

      const rootSecId = 'sec_test_diaria_root';
      store.addListSection({
        id: rootSecId,
        listId: testListId,
        name: 'Diarias',
        periodicity: 'daily',
        order: 1
      });

      const roomSecCocina = 'sec_test_diaria_cocina';
      store.addListSection({
        id: roomSecCocina,
        listId: testListId,
        name: 'Cocina',
        parentId: rootSecId,
        order: 1
      });

      const roomSecBano = 'sec_test_diaria_bano';
      store.addListSection({
        id: roomSecBano,
        listId: testListId,
        name: 'Baño',
        parentId: rootSecId,
        order: 2
      });

      store.addTask({
        id: 'task_limp_cocina_1',
        title: 'Barrer cocina',
        categoryId: testListId,
        sectionId: roomSecCocina,
        cycle_id: 'cycle_day',
        status: 'pending',
        created_at: new Date().toISOString()
      });

      store.addTask({
        id: 'task_limp_bano_1',
        title: 'Limpiar lavabo',
        categoryId: testListId,
        sectionId: roomSecBano,
        cycle_id: 'cycle_day',
        status: 'pending',
        created_at: new Date().toISOString()
      });
    });

    await page.waitForTimeout(300);

    // Click on Diario in sidebar
    const diarioItem = page.locator('.ios-list-item:has-text("Diario")');
    await expect(diarioItem.first()).toBeVisible({ timeout: 5000 });
    await diarioItem.first().click();

    await page.waitForTimeout(500);

    // Verify we are in Diario view
    const pageTitle = page.locator('h1:has-text("Diario")');
    await expect(pageTitle).toBeVisible({ timeout: 5000 });

    // Verify the list header for Limpieza Test is visible
    const listGroupHeader = page.locator('.group-header:has-text("Limpieza Test")');
    await expect(listGroupHeader).toBeVisible({ timeout: 5000 });

    // Verify sub-group headers Cocina and Baño are visible
    const cocinaHeader = page.locator('.group-header:has-text("Cocina")');
    const banoHeader = page.locator('.group-header:has-text("Baño")');
    await expect(cocinaHeader).toBeVisible({ timeout: 5000 });
    await expect(banoHeader).toBeVisible({ timeout: 5000 });

    // Verify task cards are visible under their sub-sections
    const cocinaTask = page.locator('[data-task-id="task_limp_cocina_1"]');
    const banoTask = page.locator('[data-task-id="task_limp_bano_1"]');
    await expect(cocinaTask).toBeVisible({ timeout: 5000 });
    await expect(banoTask).toBeVisible({ timeout: 5000 });

    // Test collapse toggle: single click collapses sub-section Cocina
    await cocinaHeader.click();
    await page.waitForTimeout(300);
    await expect(cocinaTask).not.toBeVisible();

    // Single click expands Cocina back
    await cocinaHeader.click();
    await page.waitForTimeout(300);
    await expect(cocinaTask).toBeVisible();
  });
});

