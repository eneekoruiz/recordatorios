import { test, expect } from '@playwright/test';

async function ensureAppUnlocked(page: any) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => {
    (window as any).__E2E__ = true;
    sessionStorage.setItem('__E2E__', 'true');
    sessionStorage.setItem('daily_greeting_seen_session', 'true');
    localStorage.setItem('daily_greeting_dismissed_day', new Date().toDateString());
    localStorage.setItem('hide_onboarding_guide', 'true');
    (window as any).useAppStore?.getState()?.setToken('local_offline_token', 'local_guest_e2e');
  });
  const guestBtn = page.locator('button:has-text("Usar sin cuenta")').first();
  try {
    await guestBtn.click({ timeout: 1500 });
  } catch {
    // Ya desbloqueada
  }
  await page.waitForTimeout(300);
}

test.describe('Menú del Perfil & Modal de Integraciones (Auditoría)', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAppUnlocked(page);
  });

  test('Abre el menú del perfil y muestra las opciones clave', async ({ page }) => {
    const profileTrigger = page.locator('[data-testid="user-profile-trigger"]');
    await expect(profileTrigger).toBeVisible({ timeout: 5000 });
    await profileTrigger.click();

    const dropdown = page.locator('.ios-dropdown-menu');
    await expect(dropdown).toBeVisible({ timeout: 3000 });

    await expect(page.locator('[data-testid="profile-item-integrations"]')).toBeVisible();
    await expect(page.locator('[data-testid="profile-item-shortcuts"]')).toBeVisible();
    await expect(page.locator('[data-testid="profile-item-analytics"]')).toBeVisible();
    await expect(page.locator('[data-testid="profile-item-manage-lists"]')).toBeVisible();
  });

  test('Conexiones e Integraciones abre correctamente el modal con todos los servicios', async ({ page }) => {
    const profileTrigger = page.locator('[data-testid="user-profile-trigger"]');
    await profileTrigger.click();

    const integrationsBtn = page.locator('[data-testid="profile-item-integrations"]');
    await expect(integrationsBtn).toBeVisible({ timeout: 3000 });
    await integrationsBtn.click();

    // El modal debe ser visible
    const modal = page.locator('[data-testid="integrations-modal"]');
    await expect(modal).toBeVisible({ timeout: 4000 });

    // Debe contener los 4 servicios integrados (headings exactos)
    await expect(modal.locator('text=Ecosistema & Vinculaciones')).toBeVisible();
    await expect(modal.getByRole('heading', { name: 'Google Calendar' })).toBeVisible();
    await expect(modal.getByRole('heading', { name: 'Gmail' })).toBeVisible();
    await expect(modal.getByRole('heading', { name: 'Notion' })).toBeVisible();
    await expect(modal.getByRole('heading', { name: /GitHub/i })).toBeVisible();

    // Cerrar el modal con el botón X
    const closeBtn = modal.locator('button[aria-label="Cerrar"]');
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });

  test('Atajos de teclado abre ShortcutsModal con createPortal', async ({ page }) => {
    const profileTrigger = page.locator('[data-testid="user-profile-trigger"]');
    await profileTrigger.click();

    const shortcutsBtn = page.locator('[data-testid="profile-item-shortcuts"]');
    await expect(shortcutsBtn).toBeVisible({ timeout: 3000 });
    await shortcutsBtn.click();

    const modal = page.locator('[data-testid="shortcuts-modal"]');
    await expect(modal).toBeVisible({ timeout: 4000 });
    await expect(modal.locator('text=Atajos de teclado')).toBeVisible();

    // Cerrar con Escape
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('Gestionar listas activa el modo de edición de la barra lateral', async ({ page }) => {
    const profileTrigger = page.locator('[data-testid="user-profile-trigger"]');
    await profileTrigger.click();

    const manageListsBtn = page.locator('[data-testid="profile-item-manage-lists"]');
    await expect(manageListsBtn).toBeVisible({ timeout: 3000 });
    await manageListsBtn.click();

    // El botón 'Hecho' debe aparecer indicando que el modo edición está activo
    const doneBtn = page.locator('.apple-nav-text-btn:has-text("Hecho")');
    await expect(doneBtn).toBeVisible({ timeout: 3000 });

    // Salir del modo edición
    await doneBtn.click();
    await expect(page.locator('.apple-nav-text-btn:has-text("Editar")')).toBeVisible();
  });

  test('Estadísticas y productividad navega correctamente a la vista analítica', async ({ page }) => {
    const profileTrigger = page.locator('[data-testid="user-profile-trigger"]');
    await profileTrigger.click();

    const analyticsBtn = page.locator('[data-testid="profile-item-analytics"]');
    await expect(analyticsBtn).toBeVisible({ timeout: 3000 });
    await analyticsBtn.click();

    // Debe mostrar la página de estadísticas
    await expect(page.locator('.stats-page')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.stats-page').getByText('Estadísticas', { exact: true })).toBeVisible();
  });

  test('Conexiones e Integraciones funciona perfectamente en vista móvil (iPhone)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await ensureAppUnlocked(page);

    const profileTrigger = page.locator('[data-testid="user-profile-trigger"]');
    await expect(profileTrigger).toBeVisible({ timeout: 5000 });
    await profileTrigger.click();

    const integrationsBtn = page.locator('[data-testid="profile-item-integrations"]');
    await expect(integrationsBtn).toBeVisible({ timeout: 3000 });
    await integrationsBtn.click();

    // Debe abrirse sin verse afectado por el layout móvil
    const modal = page.locator('[data-testid="integrations-modal"]');
    await expect(modal).toBeVisible({ timeout: 4000 });
    await expect(modal.getByRole('heading', { name: 'Google Calendar' })).toBeVisible();

    const closeBtn = modal.locator('button[aria-label="Cerrar"]');
    await closeBtn.click();
    await expect(modal).not.toBeVisible();
  });
});
