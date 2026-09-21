import { test, expect } from '@playwright/test';

async function ensureAppUnlocked(page: any) {
  await page.goto('http://localhost:5173');
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
}

test.describe('Compra Anual & Subtasks Visibility Suite', () => {
  test('Subtasks and cycle sections render expanded without collapsing into ghosts', async ({ page }) => {
    await ensureAppUnlocked(page);
    await page.waitForLoadState('networkidle');

    // Create Compra list, parent task and child task under Compra list with cycle_year
    await page.evaluate(() => {
      const store = (window as any).useAppStore?.getState?.();
      if (store) {
        store.addList({
          id: 'compra',
          name: 'Compra',
          color: '#34c759'
        });

        const parentId = 'test_parent_compra_' + Date.now();
        const childId = 'test_child_compra_' + Date.now();

        store.addTask({
          id: parentId,
          title: 'Zapatillas Test Anual',
          categoryId: 'compra',
          cycle_id: 'cycle_year',
          status: 'pending'
        });

        store.addTask({
          id: childId,
          parentId: parentId,
          title: 'Nike Shox Test Subtask',
          categoryId: 'compra',
          cycle_id: 'cycle_year',
          status: 'pending'
        });
      }
    });

    // Navigate to Compra list via select-view event
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('select-view', { detail: 'list_compra' }));
    });
    await page.waitForTimeout(500);

    // Verify parent task is rendered
    const parentLocator = page.locator('text=Zapatillas Test Anual').first();
    await expect(parentLocator).toBeVisible();

    // Verify child subtask is expanded and visible automatically
    const childLocator = page.locator('text=Nike Shox Test Subtask').first();
    await expect(childLocator).toBeVisible();
  });
});
