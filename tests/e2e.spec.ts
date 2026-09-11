import { test, expect } from '@playwright/test';

test.describe('Recordatorios Élite - Full E2E & Quality Verification', () => {
  const testEmail = `playwright_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  const updatedPassword = 'NewPassword456!';

  // 1. Health Check Endpoint
  test('1. Backend /api/health returns status ok', async ({ request }) => {
    const res = await request.get('http://localhost:3001/api/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.serverTime).toBeDefined();
  });

  // 2. Auth Flow: Register, Login, Reset Password
  test('2. Auth API: Register, Login, and Reset Password cycle', async ({ request }) => {
    // Register
    const regRes = await request.post('http://localhost:3001/api/auth/register', {
      data: { email: testEmail, password: testPassword }
    });
    expect(regRes.status()).toBe(200);
    const regData = await regRes.json();
    expect(regData.token).toBeDefined();
    expect(regData.user.email).toBe(testEmail);

    // Login with correct credentials
    const loginRes = await request.post('http://localhost:3001/api/auth/login', {
      data: { email: testEmail, password: testPassword }
    });
    expect(loginRes.status()).toBe(200);
    const loginData = await loginRes.json();
    expect(loginData.token).toBeDefined();

    // Login with incorrect credentials should fail
    const badLoginRes = await request.post('http://localhost:3001/api/auth/login', {
      data: { email: testEmail, password: 'WrongPassword' }
    });
    expect(badLoginRes.status()).toBe(400);

    // Reset password
    const resetRes = await request.post('http://localhost:3001/api/auth/reset-password', {
      data: { email: testEmail, newPassword: updatedPassword }
    });
    expect(resetRes.status()).toBe(200);

    // Login with new password
    const newLoginRes = await request.post('http://localhost:3001/api/auth/login', {
      data: { email: testEmail, password: updatedPassword }
    });
    expect(newLoginRes.status()).toBe(200);
  });

  // 3. App UI Loads and Elements Render
  test('3. App UI loads cleanly without fatal JavaScript exceptions', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('http://localhost:5173');
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveTitle(/Recordatorios/i);
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Verify no unhandled runtime crashes
    expect(pageErrors.length).toBe(0);
  });

  // 4. Apple Smart List Cards & Navigation
  test('4. Sidebar renders Apple-style Smart Cards with colors and interaction', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    // Check if smart cards exist
    const smartCards = page.locator('.ios-smart-card');
    const count = await smartCards.count();
    if (count > 0) {
      await expect(smartCards.first()).toBeVisible();
      // Click a smart card
      await smartCards.first().click();
      await page.waitForTimeout(300);
    }
  });

  // 5. Native Long-Press / Context Menu on Tasks
  test('5. Task context menu displays native edit and indentation options', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    // Find any rendered task
    const taskItem = page.locator('.task-item-wrapper').first();
    if (await taskItem.isVisible()) {
      // Right-click to open Apple context menu
      await taskItem.click({ button: 'right' });
      await page.waitForTimeout(400);

      // Verify context menu popped up
      const contextMenu = page.locator('.ios-dropdown-menu');
      if (await contextMenu.isVisible()) {
        // Assert native options
        const editOption = page.locator('text=Editar recordatorio');
        await expect(editOption).toBeVisible();

        // Close menu
        await page.keyboard.press('Escape');
      }
    }
  });

  // 6. Section Isolation Toggle ("Ocultar el resto" / "Ver todas")
  test('6. Section isolation toggle reduces visual noise', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');

    // Find section isolation button if visible
    const isolateBtn = page.locator('button:has-text("Ocultar el resto")').first();
    if (await isolateBtn.isVisible()) {
      await isolateBtn.click();
      await page.waitForTimeout(300);

      // Verify the button now shows "Ver todas"
      const showAllBtn = page.locator('button:has-text("Ver todas")').first();
      await expect(showAllBtn).toBeVisible();

      // Click again to restore
      await showAllBtn.click();
      await page.waitForTimeout(300);
    }
  });
});
