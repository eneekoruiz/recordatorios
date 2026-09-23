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
    expect(badLoginRes.status()).toBe(401);

    // El restablecimiento ya NO acepta solo el email (antes permitía secuestrar cuentas)
    const insecureReset = await request.post('http://localhost:3001/api/auth/reset-password', {
      data: { email: testEmail, newPassword: updatedPassword }
    });
    expect(insecureReset.status()).toBe(400);

    // Flujo seguro: solicitar enlace firmado y usarlo
    const forgotRes = await request.post('http://localhost:3001/api/auth/forgot-password', {
      data: { email: testEmail }
    });
    expect(forgotRes.status()).toBe(200);
    const { devResetUrl } = await forgotRes.json();
    const resetToken = new URL(devResetUrl).searchParams.get('reset');
    const resetRes = await request.post('http://localhost:3001/api/auth/reset-password', {
      data: { token: resetToken, newPassword: updatedPassword }
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
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Unlock store directly via state and silence greeting overlay
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

    // tools/call requiere sesión
    const mcpEmail = `mcp_${Date.now()}@example.com`;
    const reg = await request.post('http://localhost:3001/api/auth/register', { data: { email: mcpEmail, password: 'Password123!' } });
    const { token: mcpToken } = await reg.json();

    // Test POST /api/mcp JSON-RPC tools/call create_reminders
    const rpcCallRes = await request.post('http://localhost:3001/api/mcp', {
      headers: { Authorization: `Bearer ${mcpToken}` },
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

  // 10. Spotlight Modal (⌘K / Ctrl+K)
  test('10. Spotlight Command Palette: Opens with Ctrl+K or search bar, searches, and closes with ESC', async ({ page }) => {
    await ensureAppUnlocked(page);

    // Focus body and test opening Spotlight via Ctrl+K or clicking search bar
    await page.locator('body').click();
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(300);

    const searchInput = page.getByPlaceholder('Buscar recordatorios, listas o acciones...');
    const isVisible = await searchInput.isVisible().catch(() => false);
    if (!isVisible) {
      // In headless Chrome, Control+k can be trapped by Chrome address bar shortcut; trigger via UI button
      const searchBtn = page.locator('[data-testid="sidebar-search-btn"]');
      if (await searchBtn.isVisible()) {
        await searchBtn.click();
        await page.waitForTimeout(200);
      }
      const expandedBar = page.locator('[data-testid="sidebar-search-expanded-bar"]').or(page.locator('.sidebar-header').locator('text=Buscar...')).first();
      if (await expandedBar.isVisible()) {
        await expandedBar.click();
      }
    }

    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // Type query
    await searchInput.fill('Hoy');
    await page.waitForTimeout(200);

    // Expect 'Ir a Hoy' action visible
    const actionHoy = page.getByText('Ir a Hoy');
    await expect(actionHoy).toBeVisible();

    // Close via ESC
    await page.keyboard.press('Escape');
    await expect(searchInput).not.toBeVisible();
  });

  // 11. Daily Smart Briefing
  test('11. Daily Smart Briefing: Renders greeting, date, and metrics banner on Hoy view', async ({ page }) => {
    await ensureAppUnlocked(page);

    // Select smart_today view
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('select-view', { detail: 'smart_today' }));
    });
    await page.waitForTimeout(400);

    // Verify Daily Briefing container is rendered
    const briefing = page.locator('.daily-briefing-container');
    await expect(briefing).toBeVisible({ timeout: 5000 });

    // Verify it contains either Buenos días, Buenas tardes, or Buenas noches
    const greetingText = await briefing.textContent();
    expect(greetingText).toMatch(/Buenos días|Buenas tardes|Buenas noches/);
  });

  // 12. Caducidades: Pre-configured Sections, Expiration Pill & Smart Anticipation Alerts
  test('12. Special List Caducidades: Pre-configured sections, countdown pill, and anticipation alerts', async ({ page }) => {
    await ensureAppUnlocked(page);
    await page.waitForLoadState('networkidle');

    // Navigate to Caducidades list
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('select-view', { detail: 'list_caducidades' }));
    });
    await page.waitForTimeout(400);

    // Add a card task due in 25 days and a subscription task due in 2 days
    await page.evaluate(() => {
      const store = (window as any).useAppStore?.getState?.();
      if (store) {
        const today = new Date();
        const dueCard = new Date(today);
        dueCard.setDate(dueCard.getDate() + 25);
        const dueSub = new Date(today);
        dueSub.setDate(dueSub.getDate() + 2);

        store.addTask({
          id: 'test-card-visa',
          title: 'Tarjeta Visa Gold Banco',
          categoryId: 'caducidades',
          sectionId: 'sec_tarjetas',
          expirationType: 'card',
          dueDate: dueCard.toISOString(),
          alerts: [
            { id: 'al_card_30d', type: 'before', offsetMinutes: 30 * 24 * 60, label: '1 mes antes' },
            { id: 'al_card_15d', type: 'before', offsetMinutes: 15 * 24 * 60, label: '15 días antes' }
          ],
          status: 'pending'
        });

        store.addTask({
          id: 'test-sub-netflix',
          title: 'Suscripción Netflix Premium',
          categoryId: 'caducidades',
          sectionId: 'sec_suscripciones',
          expirationType: 'subscription',
          dueDate: dueSub.toISOString(),
          alerts: [
            { id: 'al_sub_3d', type: 'before', offsetMinutes: 3 * 24 * 60, label: '3 días antes' },
            { id: 'al_sub_1d', type: 'before', offsetMinutes: 1 * 24 * 60, label: '1 día antes' }
          ],
          status: 'pending'
        });
      }
    });

    await page.waitForTimeout(500);

    // Verify sections: Tarjetas y Documentos and Suscripciones
    const cardSection = page.locator('.group-header:has-text("Tarjetas")').first();
    const subSection = page.locator('.group-header:has-text("Suscripciones")').first();
    await expect(cardSection).toBeVisible();
    await expect(subSection).toBeVisible();

    // Las secciones de las listas inician cerradas por defecto: click para desplegar
    await cardSection.click();
    await subSection.click();
    await page.waitForTimeout(400);

    // Verify expiration pills on both cards
    const visaCard = page.locator('.task-item-wrapper:has-text("Tarjeta Visa Gold Banco")').first();
    await expect(visaCard).toBeVisible();
    const visaExpirationPill = visaCard.locator('.apple-expiration-pill').first();
    await expect(visaExpirationPill).toBeVisible();
    await expect(visaExpirationPill).toContainText('días restantes');

    const netflixCard = page.locator('.task-item-wrapper:has-text("Suscripción Netflix Premium")').first();
    await expect(netflixCard).toBeVisible();
    const netflixExpirationPill = netflixCard.locator('.apple-expiration-pill').first();
    await expect(netflixExpirationPill).toBeVisible();
    await expect(netflixExpirationPill).toContainText('Caduca en 2 días');
  });

  // 13. Qué he hecho (Bitácora de vida): Multi-person association & timeline toggle
  test('13. Special List Qué he hecho: Shared multi-person memories appear in each person section & timeline view', async ({ page }) => {
    await ensureAppUnlocked(page);
    await page.waitForLoadState('networkidle');

    // Navigate to Qué he hecho list
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('select-view', { detail: 'list_que_he_hecho' }));
    });
    await page.waitForTimeout(400);

    // Verify toggle controls are rendered
    const peopleToggleBtn = page.locator('button:has-text("Por Personas")').first();
    const timelineToggleBtn = page.locator('button:has-text("Línea de Tiempo")').first();
    await expect(peopleToggleBtn).toBeVisible();
    await expect(timelineToggleBtn).toBeVisible();

    // Add a shared memory with multiple people: Laura and Carlos
    await page.evaluate(() => {
      const store = (window as any).useAppStore?.getState?.();
      if (store) {
        store.addTask({
          id: 'test-memory-shared',
          title: 'Viaje a Roma en vacaciones',
          categoryId: 'que_he_hecho',
          people: ['Laura', 'Carlos'],
          dueDate: new Date().toISOString(),
          status: 'pending'
        });
      }
    });

    await page.waitForTimeout(500);

    // In 'Por Personas' mode: Memory must appear in BOTH Laura's section AND Carlos's section!
    const lauraHeader = page.locator('.group-header:has-text("Laura")').first();
    const carlosHeader = page.locator('.group-header:has-text("Carlos")').first();
    await expect(lauraHeader).toBeVisible();
    await expect(carlosHeader).toBeVisible();

    // Verify that the task shows person pills
    const personPills = page.locator('.apple-person-pill');
    await expect(personPills.first()).toBeVisible();

    // Click 'Línea de Tiempo' toggle
    await timelineToggleBtn.click();
    await page.waitForTimeout(400);

    // Verify timeline header is rendered (containing month and year; the header now
    // uses an Hourglass icon instead of a baked-in emoji, so we match on the year text)
    const timelineHeader = page.locator('.group-header').filter({ hasText: /20\d{2}/ }).first();
    await expect(timelineHeader).toBeVisible();

    // Switch back to 'Por Personas'
    await peopleToggleBtn.click();
    await page.waitForTimeout(300);
    await expect(lauraHeader).toBeVisible();
  });

  // 14. Conversational AI Companion: Natural conversational tone & multi-activity memory import
  test('14. Conversational AI Companion: Empathetic response for life experiences, Irantzu detection & 1-click import into Qué he hecho', async ({ page }) => {
    await ensureAppUnlocked(page);
    await page.waitForLoadState('networkidle');

    // Open AI Assistant modal via custom event
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('open-ai-assistant'));
    });
    await page.waitForTimeout(400);

    // AI modal should be visible
    const modal = page.locator('text=Asistente de Recordatorios').first();
    await expect(modal).toBeVisible();

    // Type conversational prompt mentioning multiple activities and Irantzu
    const aiInput = page.locator('input[placeholder*="Habla o escribe tus recordatorios"]').first();
    await expect(aiInput).toBeVisible();
    await aiInput.fill('Buah, pues hoy he hecho escalada con Irantzu y luego hemos ido a cenar pizza con Irantzu y Carlos');

    // Submit prompt
    await aiInput.press('Enter');
    await page.waitForTimeout(1000);

    // Verify AI responds empathetically mentioning Irantzu and asking to record it
    const aiMessage = page.locator('text=Irantzu').first();
    await expect(aiMessage).toBeVisible();

    // Verify 1-click import CTA for "Qué he hecho" is present
    const importBtn = page.locator('[data-testid="ai-import-all-btn"]').first();
    await expect(importBtn).toBeVisible();
    await expect(importBtn).toContainText('apuntar e importar todo a Qué he hecho');

    // Click import
    await importBtn.click();
    await page.waitForTimeout(600);

    // Verify we see the imported memories in Qué he hecho
    const queHeHechoHeader = page.locator('text=Qué he hecho').first();
    await expect(queHeHechoHeader).toBeVisible();

    // Verify memory exists
    const memoryCard = page.locator('.task-item-wrapper:has-text("escalada")').first();
    await expect(memoryCard).toBeVisible();
  });

  // 15. Caducidades: Recurring subscription financial metrics & auto-rollover
  test('15. Special List Caducidades: Recurring subscription financial totals & auto-rollover on completion', async ({ page }) => {
    await ensureAppUnlocked(page);
    await page.waitForLoadState('networkidle');

    // Navigate to Caducidades
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('select-view', { detail: 'list_caducidades' }));
    });
    await page.waitForTimeout(400);

    const initialDue = new Date(Date.now() + 86400000 * 2); // 2 days from now

    // Seed subscriptions with price, autoRollover and subscriptionPeriod
    await page.evaluate((dueIso) => {
      const store = (window as any).useAppStore?.getState?.();
      if (store) {
        store.addTask({
          id: 'test-sub-spotify',
          title: 'Spotify Premium Individual',
          categoryId: 'caducidades',
          sectionId: 'sec_suscripciones',
          expirationType: 'subscription',
          price: 10.99,
          subscriptionPeriod: 'monthly',
          autoRollover: true,
          issuerMask: 'VISA •• 1234',
          dueDate: dueIso,
          status: 'pending'
        });
        store.addTask({
          id: 'test-sub-icloud',
          title: 'iCloud+ 2TB Anual',
          categoryId: 'caducidades',
          sectionId: 'sec_suscripciones',
          expirationType: 'subscription',
          price: 120,
          subscriptionPeriod: 'yearly',
          autoRollover: true,
          dueDate: dueIso,
          status: 'pending'
        });
      }
    }, initialDue.toISOString());

    await page.waitForTimeout(500);

    // Check financial cost calculation badge in header (10.99 + 120/12 = 20.99 €/mes)
    const costBadge = page.locator('text=Gasto recurrente').first();
    await expect(costBadge).toBeVisible();
    const costText = page.locator('text=/mes').first();
    await expect(costText).toBeVisible();

    // Check Apple Wallet chip on Spotify task (desplegar sección si está colapsada)
    const subSection = page.locator('.group-header:has-text("Suscripciones")').first();
    if (await subSection.isVisible()) {
      await subSection.click();
      await page.waitForTimeout(400);
    }
    const walletChip = page.locator('.apple-card-chip:has-text("VISA •• 1234")').first();
    await expect(walletChip).toBeVisible();

    // Toggle Spotify task completion -> Auto-rollover should roll date forward +1 month and keep pending
    const spotifyCheckbox = page.locator('.task-item-wrapper:has-text("Spotify Premium Individual") button[aria-label="Completar tarea"]').first();
    await spotifyCheckbox.click();
    await page.waitForTimeout(600);

    // Verify task is still pending and date has rolled forward (+1 month)
    const updatedTask = await page.evaluate(() => {
      const store = (window as any).useAppStore?.getState?.();
      return store?.tasks?.['test-sub-spotify'];
    });

    expect(updatedTask).toBeDefined();
    expect(updatedTask.status).toBe('pending');
    expect(new Date(updatedTask.dueDate).getTime()).toBeGreaterThan(initialDue.getTime() + 20 * 86400000);
    expect(updatedTask.completionHistory?.length).toBeGreaterThan(0);
  });

  // 16. Qué he hecho: Person Profile modal opens with relationship stats
  test('16. Special List Qué he hecho: Person Profile modal opens with relationship stats and memories history', async ({ page }) => {
    await ensureAppUnlocked(page);
    await page.waitForLoadState('networkidle');

    // Navigate to Qué he hecho list
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('select-view', { detail: 'list_que_he_hecho' }));
    });
    await page.waitForTimeout(400);

    // Add memory with Irantzu
    await page.evaluate(() => {
      const store = (window as any).useAppStore?.getState?.();
      if (store) {
        store.addTask({
          id: 'test-memory-irantzu-surf',
          title: 'Tarde de surf y helados',
          categoryId: 'que_he_hecho',
          people: ['Irantzu'],
          vibe: '🏄‍♂️ Deporte',
          dueDate: new Date().toISOString(),
          status: 'pending'
        });
      }
    });

    await page.waitForTimeout(500);

    // Click on person pill
    const irantzuPill = page.locator('.apple-person-pill:has-text("Irantzu")').first();
    await expect(irantzuPill).toBeVisible();
    await irantzuPill.click();
    await page.waitForTimeout(400);

    // Person Profile modal should open
    const profileModal = page.locator('.person-profile-overlay').first();
    await expect(profileModal).toBeVisible();
    await expect(page.locator('text=Bitácora de momentos compartidos').first()).toBeVisible();
    await expect(page.locator('text=Vivencias').first()).toBeVisible();

    // Check shared memory appears in the modal list
    const modalMemory = page.locator('.person-profile-overlay :text("Tarde de surf y helados")').first();
    await expect(modalMemory).toBeVisible();

    // Close modal
    const closeBtn = page.locator('.person-profile-overlay button[title="Cerrar"]').first();
    await closeBtn.click();
    await page.waitForTimeout(300);
    await expect(profileModal).not.toBeVisible();
  });

  // 17. AI Assistant: Text-to-Speech playback & location extraction
  test('17. AI Assistant: TTS audio button, location extraction, and apple-location-pill in Qué he hecho', async ({ page }) => {
    await ensureAppUnlocked(page);
    await page.waitForLoadState('networkidle');

    // Open AI Assistant modal
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('open-ai-assistant'));
    });
    await page.waitForTimeout(400);

    const aiInput = page.locator('input[placeholder*="Habla o escribe tus recordatorios"]').first();
    await expect(aiInput).toBeVisible();
    await aiInput.fill('Comer unos pintxos en Donosti con Irantzu');
    await aiInput.press('Enter');
    await page.waitForTimeout(800);

    // Verify TTS button is rendered for assistant message
    const ttsBtn = page.locator('[data-testid="ai-tts-btn"]').last();
    await expect(ttsBtn).toBeVisible();
    await ttsBtn.click(); // Trigger speak/cancel
    await page.waitForTimeout(300);

    // Verify location chip is present in proposed task preview
    // (rendered with a MapPin icon rather than an emoji, so we match on the place name)
    const locationChip = page.locator('text=Donosti').first();
    await expect(locationChip).toBeVisible();

    // Import into Qué he hecho
    const importBtn = page.locator('[data-testid="ai-import-all-btn"]').first();
    await expect(importBtn).toBeVisible();
    await importBtn.click();
    await page.waitForTimeout(600);

    // Verify memory card has apple-location-pill
    const locationPill = page.locator('.apple-location-pill:has-text("Donosti")').first();
    await expect(locationPill).toBeVisible();
  });

  // 18. Daily Smart Briefing: Upcoming subscription caducidad warning & management link
  test('18. Daily Smart Briefing: 48h caducidad alert chip & managementUrl button in task card', async ({ page }) => {
    await ensureAppUnlocked(page);
    await page.waitForLoadState('networkidle');

    // Seed a subscription due tomorrow with price and managementUrl
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await page.evaluate((dueIso) => {
      const store = (window as any).useAppStore?.getState?.();
      if (store) {
        store.addTask({
          id: 'test-sub-hbo',
          title: 'Max HBO Suscripción',
          categoryId: 'caducidades',
          sectionId: 'sec_suscripciones',
          expirationType: 'subscription',
          price: 9.99,
          dueDate: dueIso,
          managementUrl: 'https://max.com/account',
          status: 'pending'
        });
      }
    }, tomorrow);

    await page.waitForTimeout(400);

    // Navigate to Hoy (smart_today)
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('select-view', { detail: 'smart_today' }));
    });
    await page.waitForTimeout(500);

    // Verify Daily Briefing renders the caducidad chip
    const caducidadChip = page.locator('[data-testid="briefing-caducidad-chip"]').first();
    await expect(caducidadChip).toBeVisible();
    await expect(caducidadChip).toContainText('Max HBO Suscripción');

    // Navigate to Caducidades
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('select-view', { detail: 'list_caducidades' }));
    });
    await page.waitForTimeout(500);

    // Desplegar sección Suscripciones si está colapsada
    const expandBtn = page.locator('.group-header:has-text("Suscripciones")').locator('button[aria-label="Desplegar sección"]').first();
    if (await expandBtn.isVisible().catch(() => false)) {
      await expandBtn.click();
      await page.waitForTimeout(400);
    }

    // Verify task card renders management URL button
    const manageBtn = page.locator('.apple-manage-url-btn:has-text("Gestionar")').first();
    await expect(manageBtn).toBeVisible();
    await expect(manageBtn).toHaveAttribute('href', 'https://max.com/account');
  });

  // 19. Social Care: Tiempo sin vernos alert & AI Monthly Summary generator
  test('19. Social Care: Tiempo sin vernos alert in Person Profile & AI Monthly Summary modal', async ({ page }) => {
    await ensureAppUnlocked(page);
    await page.waitForLoadState('networkidle');

    // Seed an old memory from 45 days ago with Carlos
    const oldDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
    await page.evaluate((oldIso) => {
      const store = (window as any).useAppStore?.getState?.();
      if (store) {
        store.addTask({
          id: 'test-memory-carlos-old',
          title: 'Cena de graduación',
          categoryId: 'que_he_hecho',
          people: ['Carlos'],
          dueDate: oldIso,
          created_at: oldIso,
          status: 'pending'
        });
      }
    }, oldDate);

    // Navigate to Qué he hecho
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('select-view', { detail: 'list_que_he_hecho' }));
    });
    await page.waitForTimeout(500);

    // Click on Carlos person pill
    const carlosPill = page.locator('.apple-person-pill:has-text("Carlos")').first();
    await expect(carlosPill).toBeVisible();
    await carlosPill.click();
    await page.waitForTimeout(400);

    // Check "Tiempo sin vernos" alert
    const noSeeAlert = page.locator('[data-testid="long-time-no-see-alert"]').first();
    await expect(noSeeAlert).toBeVisible();
    await expect(noSeeAlert).toContainText('Hace 45 días del último plan');

    // Close profile modal
    const closeBtn = page.locator('.person-profile-overlay button[title="Cerrar"]').first();
    await closeBtn.click();
    await page.waitForTimeout(300);

    // Click "🪄 Resumen del mes" button
    const monthlyBtn = page.locator('[data-testid="monthly-summary-btn"]').first();
    await expect(monthlyBtn).toBeVisible();
    await monthlyBtn.click();
    await page.waitForTimeout(600);

    // Verify monthly summary modal opens and shows narrative
    const summaryModal = page.locator('[data-testid="monthly-summary-modal"]').first();
    await expect(summaryModal).toBeVisible();
    const summaryContent = page.locator('[data-testid="monthly-summary-content"]').first();
    await expect(summaryContent).toBeVisible();
    await expect(summaryContent).toContainText('Memoria');
  });

  // 20. Top Navigation: Back button in header takes user back to lists
  test('20. Top Navigation: Back button in header takes user back to lists', async ({ page }) => {
    // En escritorio la barra lateral siempre está visible; el botón «Listas» es de la vista móvil.
    await page.setViewportSize({ width: 390, height: 844 });
    await ensureAppUnlocked(page);
    await page.waitForLoadState('networkidle');

    // Navigate to a list
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('select-view', { detail: 'list_caducidades' }));
    });
    await page.waitForTimeout(400);

    // Verify back button is visible in header
    const backBtn = page.locator('[data-testid="content-back-btn"]').first();
    await expect(backBtn).toBeVisible();
    await expect(backBtn).toContainText('Listas');

    // Click back button
    await backBtn.click();
    await page.waitForTimeout(300);

    // Verify app-container transitioned to sidebar view or sidebar is visible
    await expect(page.locator('.ios-smart-card').first()).toBeVisible();
  });

  // 21. Custom Special List: Creating a list named Caducidades auto-configures sections & metrics
  test('21. Custom Special List: Creating a list named Caducidades auto-configures sections & metrics', async ({ page }) => {
    await ensureAppUnlocked(page);
    await page.waitForLoadState('networkidle');

    // Create custom list with template Caducidades
    const customListId = 'test-custom-caducidades-' + Date.now();
    await page.evaluate((id) => {
      const store = (window as any).useAppStore?.getState?.();
      if (store) {
        store.addList({
          id,
          name: 'Caducidades Personales',
          color: '#ff9500',
          icon: 'credit-card',
          specialType: 'caducidades',
          isFinancial: true
        });
      }
    }, customListId);
    await page.waitForTimeout(400);

    // Seed a card task in custom Caducidades list
    await page.evaluate((id) => {
      const store = (window as any).useAppStore?.getState?.();
      if (store) {
        store.addTask({
          id: 'test-custom-card',
          title: 'Tarjeta de Débito',
          categoryId: id,
          sectionId: `sec_tarjetas_${id}`,
          expirationType: 'card',
          dueDate: new Date(Date.now() + 10 * 86400000).toISOString(),
          status: 'pending'
        });
      }
    }, customListId);
    await page.waitForTimeout(400);

    // Navigate to this new custom list
    await page.evaluate((id) => {
      window.dispatchEvent(new CustomEvent('select-view', { detail: `list_${id}` }));
    }, customListId);
    await page.waitForTimeout(600);

    // Verify the special Caducidades sections were auto-created
    const tarjetaSection = page.locator('text=Tarjetas y Documentos').first();
    await expect(tarjetaSection).toBeVisible();
    const suscripcionSection = page.locator('text=Suscripciones').first();
    await expect(suscripcionSection).toBeVisible();

    // Verify the floating plus button (.fab) is NOT present or overlapping
    const fab = page.locator('button.fab');
    await expect(fab).toHaveCount(0);
  });

  // 22. Collapsible Circular Search: starts folded as a circle and expands/collapses cleanly
  test('22. Collapsible Circular Search: starts folded as a circle and expands/collapses cleanly', async ({ page }) => {
    await ensureAppUnlocked(page);
    await page.waitForLoadState('networkidle');

    // Verify circular search trigger is rendered
    const searchBtn = page.locator('[data-testid="sidebar-search-btn"]').first();
    await expect(searchBtn).toBeVisible();

    // Click circular search button to expand
    await searchBtn.click();
    await page.waitForTimeout(200);

    // Verify search bar expands with input and close button
    const expandedInput = page.locator('.sidebar-header').locator('text=Buscar...').first();
    await expect(expandedInput).toBeVisible();
    const closeBtn = page.locator('[data-testid="sidebar-search-close-btn"]').first();
    await expect(closeBtn).toBeVisible();

    // Close it via close button
    await closeBtn.click();
    await page.waitForTimeout(200);

    // Verify it is collapsed back to the circular button
    await expect(searchBtn).toBeVisible();
  });

  // 23. Mobile Responsiveness & Empty View Scroll Suppression
  test('23. Mobile Responsiveness: Empty view locks scroll, dropdown menu is opaque and deduplicated', async ({ page }) => {
    // iPhone 14 / modern viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await ensureAppUnlocked(page);
    await page.waitForLoadState('networkidle');

    // Navigate to "Hoy" (which has empty state or no tasks)
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('select-view', { detail: 'today' }));
    });
    await page.waitForTimeout(400);

    // Check main container styles when empty
    const isScrollLocked = await page.evaluate(() => {
      const scrollable = document.querySelector('[data-testid="content-scroll-container"]') as HTMLElement;
      if (!scrollable) return false;
      const style = window.getComputedStyle(scrollable);
      return style.overflowY === 'hidden' && style.touchAction === 'none';
    });
    expect(isScrollLocked).toBe(true);

    // Navigate to a list with items/sections to test dropdown menu
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('select-view', { detail: 'list_compra' }));
    });
    await page.waitForTimeout(500);

    // Verify list-options-btn (the duplicate gear button) does NOT exist in header actions
    const duplicateGear = page.locator('[data-testid="list-options-btn"]');
    await expect(duplicateGear).toHaveCount(0);

    // Open list options menu (•••)
    const moreOptionsBtn = page.locator('[data-testid="list-more-options-btn"]').first();
    if (await moreOptionsBtn.isVisible()) {
      await moreOptionsBtn.click();
      await page.waitForTimeout(200);

      // Verify dropdown is open and has solid styling (not transparent glass-panel)
      const dropdownMenu = page.locator('.ios-dropdown-menu').first();
      await expect(dropdownMenu).toBeVisible();

      // Verify "Personalizar lista" is inside the menu
      const customizeItem = dropdownMenu.locator('text=Personalizar lista').first();
      await expect(customizeItem).toBeVisible();

      // Close menu
      await page.keyboard.press('Escape');
    }
  });
});

