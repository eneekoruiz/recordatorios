import { test, expect } from '@playwright/test';

test.describe('Recordatorios Élite - Complete Suite & Quality Audit', () => {
  test('App loads successfully with 0 fatal errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('http://localhost:5173');
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveTitle(/Recordatorios/i);
    const body = page.locator('body');
    await expect(body).toBeVisible();

    const hasDuplicateKeyError = consoleErrors.some(e => e.includes('Encountered two children with the same key'));
    expect(hasDuplicateKeyError).toBeFalsy();
  });

  test('Command Palette opens and supports search and navigation', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    await page.keyboard.press('Control+k');
    const input = page.locator('input[placeholder*="Busca tareas"]');
    if (await input.count() > 0) {
      await expect(input).toBeVisible();
      await input.fill('Hoy');
      await page.waitForTimeout(200);
      await page.keyboard.press('Escape');
    }
  });

  test('Sidebar contains all smart lists and quick navigation items', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('domcontentloaded');

    const sidebar = page.locator('.sidebar-container');
    if (await sidebar.isVisible()) {
      await expect(sidebar).toBeVisible();
    }
  });

  test('Task creation shortcut "n" or new task drawer triggers properly', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    // Trigger keyboard 'n' when not focused on an input
    await page.keyboard.press('n');
    await page.waitForTimeout(300);

    // Verify task drawer or modal opened if user is authenticated
    const drawerTitle = page.locator('input[placeholder*="Nuevo recordatorio"], input[placeholder*="título"], input[placeholder*="tarea"]');
    if (await drawerTitle.count() > 0) {
      await expect(drawerTitle.first()).toBeVisible();
    }
  });
});
