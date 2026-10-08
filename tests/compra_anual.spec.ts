import { test, expect } from '@playwright/test';
import { bootApp } from "./support/bootApp";

async function ensureAppUnlocked(page: any) {
    await bootApp(page);
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
    // Expand Anuales section if collapsed by default
    const anualHeader = page.locator('.group-header:has-text("Anuales")').first();
    if (await anualHeader.isVisible()) {
      await anualHeader.click();
      await page.waitForTimeout(300);
    }

    // Verify parent task is rendered
    const parentLocator = page.locator('text=Zapatillas Test Anual').first();
    await expect(parentLocator).toBeVisible();

    // Verify child subtask is expanded and visible automatically
    const childLocator = page.locator('text=Nike Shox Test Subtask').first();
    await expect(childLocator).toBeVisible();
  });
});
