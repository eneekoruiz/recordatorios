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

  test('2. Routine toggle [Solo | + Diarias] works on Semanales and spacing is clean', async ({ page }) => {
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
    const withDailyBtn = semanalHeader.locator('button:has-text("+ Diarias")');

    await expect(soloBtn).toBeVisible({ timeout: 5000 });
    await expect(withDailyBtn).toBeVisible({ timeout: 5000 });

    // By default, Solo is active and only weekly task is in Semanales
    await expect(soloBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(withDailyBtn).toHaveAttribute('aria-pressed', 'false');

    // Click "+ Diarias"
    await withDailyBtn.click();
    await page.waitForTimeout(300);
    await expect(withDailyBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(soloBtn).toHaveAttribute('aria-pressed', 'false');

    // Click "Solo" back
    await soloBtn.click();
    await page.waitForTimeout(300);
    await expect(soloBtn).toHaveAttribute('aria-pressed', 'true');

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

    // Las secciones en vistas de frecuencia inician cerradas por defecto para no agobiar
    // Un click en Cocina la despliega
    await cocinaHeader.click();
    await page.waitForTimeout(300);

    // Verify task card is visible under expanded sub-section
    const cocinaTask = page.locator('.task-item-wrapper[data-task-id="task_limp_cocina_1"]');
    await expect(cocinaTask).toBeVisible({ timeout: 5000 });

    // Test collapse toggle: otro click repliega la sub-sección Cocina
    await cocinaHeader.click();
    await page.waitForTimeout(300);
    await expect(cocinaTask).not.toBeVisible();

    // Single click expands Cocina back
    await cocinaHeader.click();
    await page.waitForTimeout(300);
    await expect(cocinaTask).toBeVisible();
  });

  test('4. Sequence mode [▶ Empezar], section duration and parallel tasks work seamlessly', async ({ page }) => {
    await ensureAppUnlocked(page);

    // Setup custom list with a section and tasks, including a parallel task (lavadora)
    await page.evaluate(() => {
      const store = (window as any).useAppStore?.getState();
      if (!store) return;

      store.addList({
        id: 'list_hogar_seq',
        name: 'Hogar Secuencia',
        color: '#FF6584',
        icon: 'home',
        listType: 'routines'
      });

      store.addListSection({
        id: 'sec_colada',
        name: 'Colada',
        listId: 'list_hogar_seq',
        order: 0
      });

      store.addTask({
        id: 'task_lavadora_parallel',
        title: 'Poner la lavadora',
        categoryId: 'list_hogar_seq',
        sectionId: 'sec_colada',
        status: 'pending'
      });

      store.addTask({
        id: 'task_tender_ropa',
        title: 'Barrer la cocina',
        categoryId: 'list_hogar_seq',
        sectionId: 'sec_colada',
        status: 'pending'
      });
    });

    await page.waitForTimeout(400);

    // Navigate to Hogar Secuencia list
    const listBtn = page.locator('.ios-list-item:has-text("Hogar Secuencia")');
    await expect(listBtn.first()).toBeVisible({ timeout: 5000 });
    await listBtn.first().click();

    await page.waitForTimeout(500);

    // Verify section header "Colada" displays its estimated duration
    const coladaHeader = page.locator('.group-header:has-text("Colada")');
    await expect(coladaHeader).toBeVisible({ timeout: 5000 });

    const sectionDuration = coladaHeader.locator('.section-duration');
    await expect(sectionDuration).toBeVisible({ timeout: 5000 });

    // The sequence is started from the list header ("▶ Empezar")
    const startBtn = page.getByRole('button', { name: 'Empezar lista' });
    await expect(startBtn).toBeEnabled({ timeout: 5000 });
    await startBtn.click();

    await page.waitForTimeout(500);

    // ListSequenceMode overlay should be open
    const sequenceOverlay = page.locator('text=Poner la lavadora');
    await expect(sequenceOverlay.first()).toBeVisible({ timeout: 5000 });

    // Parallel task badge should be visible
    const parallelBadge = page.locator('text=Tarea en paralelo');
    await expect(parallelBadge.first()).toBeVisible({ timeout: 5000 });

    // "Poner en marcha y seguir" action button should be visible
    const parallelActionBtn = page.locator('button:has-text("Poner en marcha y seguir")');
    await expect(parallelActionBtn).toBeVisible({ timeout: 5000 });

    // Click "Poner en marcha y seguir" -> should advance to next task "Barrer la cocina" and show running parallel pill in top bar
    await parallelActionBtn.click();
    await page.waitForTimeout(500);

    // Next task should now be displayed
    const nextTask = page.locator('text=Barrer la cocina');
    await expect(nextTask.first()).toBeVisible({ timeout: 5000 });

    // Top bar should show background parallel task chip
    const parallelChip = page.locator('text=Poner la lavadora');
    await expect(parallelChip.first()).toBeVisible({ timeout: 5000 });

    // Press Escape to exit sequence mode
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    // Sequence overlay should be closed
    await expect(page.locator('button:has-text("Poner en marcha y seguir")')).not.toBeVisible();
  });
});


