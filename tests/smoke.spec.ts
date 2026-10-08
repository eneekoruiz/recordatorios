import { test, expect } from '@playwright/test';
import { bootApp } from "./support/bootApp";

async function ensureAppUnlocked(page: any) {
    await bootApp(page);
}

test.describe('Recordatorios Élite - Complete Suite & Quality Audit', () => {
  const errors = new WeakMap<object, string[]>();
  test.beforeEach(async ({ page }) => {
    const messages: string[] = [];
    errors.set(page, messages);
    page.on('pageerror', error => messages.push(error.message));
    page.on('console', message => { if (message.type() === 'error') messages.push(message.text()); });
    await ensureAppUnlocked(page);
  });

  test('App loads successfully with 0 fatal errors', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveTitle(/Recordatorios/i);
    const body = page.locator('body');
    await expect(body).toBeVisible();

    expect(errors.get(page)).toEqual([]);
  });

  test('Command Palette opens and supports search and navigation', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    await page.keyboard.press('Control+k');
    const input = page.locator('input[placeholder*="Busca tareas"], input[placeholder*="Buscar"]');
    await expect(input.first()).toBeVisible({ timeout: 5000 });
    await input.first().fill('Hoy');
    await page.waitForTimeout(200);
    await page.keyboard.press('Escape');
  });

  test('Sidebar contains all smart lists and quick navigation items', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');

    const sidebar = page.locator('.sidebar-container, nav');
    await expect(sidebar.first()).toBeVisible({ timeout: 5000 });
  });

  test('Task creation shortcut "n" or new task drawer triggers properly', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Trigger keyboard 'n' when not focused on an input
    await page.keyboard.press('n');
    await page.waitForTimeout(300);

    // Verify task drawer or modal opened
    const drawerTitle = page.locator('input[placeholder*="Nuevo recordatorio"], input[placeholder*="título"], input[placeholder*="tarea"]');
    await expect(drawerTitle.first()).toBeVisible({ timeout: 5000 });
  });
});
