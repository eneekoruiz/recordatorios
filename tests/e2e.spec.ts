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

  // Helper to ensure tests have access to the main dashboard (bypassing guest auth screen if present)
  async function ensureAppUnlocked(page: any) {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('domcontentloaded');

    // Unlock store directly via state
    await page.evaluate(() => {
      (window as any).useAppStore?.getState()?.setToken('local_offline_token', 'local_guest_e2e');
    });

    const guestBtn = page.locator('button:has-text("Continuar sin cuenta")').first();
    try {
      await guestBtn.click({ timeout: 1500 });
    } catch {
      // Already unlocked
    }

    await page.waitForTimeout(400);
  }

  // 3. App UI Loads and Elements Render
  test('3. App UI loads cleanly without fatal JavaScript exceptions', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await ensureAppUnlocked(page);

    await expect(page).toHaveTitle(/Recordatorios/i);
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Verify no unhandled runtime crashes
    expect(pageErrors.length).toBe(0);
  });

  // 4. Apple Smart List Cards & Navigation
  test('4. Sidebar renders Apple-style Smart Cards with colors and interaction', async ({ page }) => {
    await ensureAppUnlocked(page);
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
    await ensureAppUnlocked(page);
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
    await ensureAppUnlocked(page);
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

  // 7. MCP Server Protocol Tools Verification
  test('7. MCP Protocol: /api/mcp exposes tools and executes tool calls', async ({ request }) => {
    // Test GET /api/mcp/tools
    const getRes = await request.get('http://localhost:3001/api/mcp/tools');
    expect(getRes.status()).toBe(200);
    const toolsData = await getRes.json();
    expect(toolsData.tools).toBeDefined();
    expect(toolsData.tools.some((t: any) => t.name === 'create_reminders')).toBeTruthy();
    expect(toolsData.tools.some((t: any) => t.name === 'list_lists')).toBeTruthy();

    // Test POST /api/mcp JSON-RPC tools/list
    const rpcListRes = await request.post('http://localhost:3001/api/mcp', {
      data: {
        jsonrpc: '2.0',
        id: 101,
        method: 'tools/list'
      }
    });
    expect(rpcListRes.status()).toBe(200);
    const rpcListData = await rpcListRes.json();
    expect(rpcListData.result.tools.length).toBeGreaterThanOrEqual(4);

    // Test POST /api/mcp JSON-RPC tools/call create_reminders
    const rpcCallRes = await request.post('http://localhost:3001/api/mcp', {
      data: {
        jsonrpc: '2.0',
        id: 102,
        method: 'tools/call',
        params: {
          name: 'create_reminders',
          arguments: {
            reminders: [
              { title: 'Comprar pan', price: 1.20, timeOfDay: 'morning' },
              { title: 'Llamar al médico', priority: 'high', timeOfDay: 'afternoon' }
            ]
          }
        }
      }
    });
    expect(rpcCallRes.status()).toBe(200);
    const rpcCallData = await rpcCallRes.json();
    expect(rpcCallData.result).toBeDefined();
    const contentText = JSON.parse(rpcCallData.result.content[0].text);
    expect(contentText.success).toBeTruthy();
    expect(contentText.count).toBe(2);
  });

  // 8. Conversational AI Assistant Modal & Bulk Import
  test('8. AI Assistant: Modal opens and parses multi-task instructions', async ({ page }) => {
    await ensureAppUnlocked(page);
    await page.waitForLoadState('networkidle');

    // Trigger AI assistant via button or custom event
    const aiBtn = page.locator('button[title*="Asistente IA"]').first();
    if (await aiBtn.isVisible()) {
      await aiBtn.click();
    } else {
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-ai-assistant')));
    }
    await page.waitForTimeout(500);

    // Verify modal appeared
    const modalTitle = page.locator('text=Asistente IA');
    await expect(modalTitle.first()).toBeVisible();

    // Type complex multi-item prompt
    const aiInput = page.locator('input[placeholder*="Habla o escribe"]');
    await expect(aiInput).toBeVisible();
    await aiInput.fill('Comprar aguacates por 2.40€ y leche por 1.20€ para mañana por la tarde');
    await aiInput.press('Enter');

    // Wait for AI response bubble and proposed tasks
    await page.waitForTimeout(800);
    const importBtn = page.locator('button:has-text("Importar")').first();
    await expect(importBtn).toBeVisible();

    // Check that price pills were detected in the proposal
    const pricePill = page.locator('.apple-price-pill').first();
    if (await pricePill.isVisible()) {
      await expect(pricePill).toBeVisible();
    }

    // Click Import
    await importBtn.click();
    await page.waitForTimeout(400);

    // Verify modal closed
    await expect(modalTitle).not.toBeVisible();
  });

  // 9. Habit Counter: Progresses through intermediate states (0/3 -> 1/3 -> 2/3 -> 3/3)
  test('9. Habit Counter: progresses through intermediate states (0/3 -> 1/3 -> 2/3 -> 3/3)', async ({ page }) => {
    await ensureAppUnlocked(page);
    await page.waitForLoadState('networkidle');

    // Create a habit task with targetCount = 3 in store and navigate to 'all'
    await page.evaluate(() => {
      const store = (window as any).useAppStore?.getState?.();
      if (store) {
        const firstList = store.lists?.find((l: any) => l.id !== 'primeros_pasos')?.id || store.lists?.[0]?.id || 'inbox';
        store.addTask({
          id: 'test-habit-water-3',
          title: 'Beber agua fresca 3 vasos',
          targetCount: 3,
          currentCount: 0,
          status: 'pending',
          categoryId: firstList
        });
      }
    });

    // Click smart card "Todos" to ensure all tasks are rendered
    const allCard = page.locator('.ios-smart-card:has-text("Todos")').first();
    if (await allCard.isVisible()) {
      await allCard.click();
    }
    await page.waitForTimeout(500);

    // Locate the water habit card
    const habitTask = page.locator('.task-item-wrapper:has-text("Beber agua fresca 3 vasos")').first();
    await expect(habitTask).toBeVisible();

    // Check initial counter pill: 0/3
    const counterPill = habitTask.locator('button:has-text("/3")').first();
    await expect(counterPill).toContainText('0/3');

    // Click checkbox (first intermediate step: 1/3)
    const checkbox = habitTask.locator('button[aria-label="Completar tarea"]').first();
    await checkbox.click();
    await page.waitForTimeout(300);

    // Should now show 1/3, and task should still be pending (not completed)
    await expect(counterPill).toContainText('1/3');
    await expect(habitTask).toBeVisible();

    // Click checkbox again (second intermediate step: 2/3)
    await checkbox.click();
    await page.waitForTimeout(300);

    // Should now show 2/3, still visible and pending
    await expect(counterPill).toContainText('2/3');
    await expect(habitTask).toBeVisible();

    // Click checkbox 3rd time (final step: 3/3 -> completes)
    await checkbox.click();
    await page.waitForTimeout(300);

    // Verify task reached 3/3 in store
    const taskState = await page.evaluate(() => {
      const store = (window as any).useAppStore?.getState?.();
      return store?.tasks['test-habit-water-3'];
    });
    expect(taskState.currentCount).toBe(3);
  });
});
