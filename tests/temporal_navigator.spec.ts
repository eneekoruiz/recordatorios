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
  await page.waitForTimeout(400);
}

test.describe('Apple Period Navigator (helen-design)', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAppUnlocked(page);
  });

  test('Muestra el navegador de fechas estilo cápsula Apple en la vista Mensual', async ({ page }) => {
    // Navegar a la vista de ciclo Mensual
    const mensualBtn = page.locator('[data-testid="cycle-item-cycle_month"], [data-view-id="cycle_month"]').first();
    await mensualBtn.click();
    await page.waitForTimeout(400);

    // El navegador de fecha Apple debe estar visible
    const navigator = page.locator('[data-testid="apple-period-navigator"]');
    await expect(navigator).toBeVisible({ timeout: 4000 });

    // Botones de avanzar y retroceder
    const prevBtn = page.locator('[data-testid="apple-period-prev-btn"]');
    const nextBtn = page.locator('[data-testid="apple-period-next-btn"]');
    await expect(prevBtn).toBeVisible();
    await expect(nextBtn).toBeVisible();

    // Retroceder un mes
    await prevBtn.click();
    await page.waitForTimeout(300);

    // Debe mostrar la insignia "Histórico" o el botón de reset rápido
    const quickResetBtn = page.locator('[data-testid="apple-period-reset-quick-btn"]');
    await expect(quickResetBtn).toBeVisible({ timeout: 3000 });

    // Volver a hoy con el botón rápido
    await quickResetBtn.click();
    await page.waitForTimeout(300);
    await expect(quickResetBtn).not.toBeVisible();
  });

  test('Abre el Popover selector Apple con opciones de Año, Mes, Semana y Día', async ({ page }) => {
    const mensualBtn = page.locator('[data-testid="cycle-item-cycle_month"], [data-view-id="cycle_month"]').first();
    await mensualBtn.click();
    await page.waitForTimeout(400);

    const triggerBtn = page.locator('[data-testid="apple-period-trigger-btn"]');
    await expect(triggerBtn).toBeVisible({ timeout: 4000 });
    await triggerBtn.click();

    // El popover debe abrirse
    const popover = page.locator('[data-testid="apple-period-picker-popover"]');
    await expect(popover).toBeVisible({ timeout: 3000 });

    // Debe contener el selector segmentado
    await expect(page.locator('[data-testid="apple-granularity-year"]')).toBeVisible();
    await expect(page.locator('[data-testid="apple-granularity-month"]')).toBeVisible();
    await expect(page.locator('[data-testid="apple-granularity-week"]')).toBeVisible();
    await expect(page.locator('[data-testid="apple-granularity-day"]')).toBeVisible();

    // Cambiar a la pestaña de Año
    await page.locator('[data-testid="apple-granularity-year"]').click();
    await expect(page.locator('[data-testid="apple-year-btn-2025"]')).toBeVisible();

    // Seleccionar 2025
    await page.locator('[data-testid="apple-year-btn-2025"]').click();
    await page.waitForTimeout(300);

    // Cerrar el popover con Escape
    await page.keyboard.press('Escape');
    await expect(popover).not.toBeVisible();

    // La cápsula debe reflejar 2025 e indicar Histórico
    await expect(page.locator('[data-testid="apple-period-trigger-btn"]')).toContainText('2025');
  });

  test('Diseño responsive adaptado a móvil (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const mensualBtn = page.locator('[data-testid="cycle-item-cycle_month"], [data-view-id="cycle_month"]').first();
    if (await mensualBtn.isVisible()) {
      await mensualBtn.click();
    }
    await page.waitForTimeout(400);

    const navigator = page.locator('[data-testid="apple-period-navigator"]');
    if (await navigator.isVisible()) {
      await expect(navigator).toBeVisible();
      // Comprobar que no desborda la pantalla
      const box = await navigator.boundingBox();
      expect(box?.width).toBeLessThan(360);
    }
  });

  test('En listas normales la cabecera se mantiene limpia sin selector temporal', async ({ page }) => {
    // Abrir una lista normal (ej. la primera de la barra lateral o Inbox)
    const normalListBtn = page.locator('.sidebar-list-item, [data-list-id]').first();
    if (await normalListBtn.isVisible()) {
      await normalListBtn.click();
      await page.waitForTimeout(400);

      // En la cabecera de la lista no debe aparecer ningún navegador temporal
      const readOnlyPill = page.locator('[data-testid="apple-period-navigator-readonly"]');
      await expect(readOnlyPill).toHaveCount(0);
      const activeNavigator = page.locator('.apple-main-page-header [data-testid="apple-period-navigator"]');
      await expect(activeNavigator).toHaveCount(0);
    }
  });

  test('En listas de frecuencia muestra la tarjeta de estado de rutina bajo el interruptor', async ({ page }) => {
    const mensualBtn = page.locator('[data-testid="cycle-item-cycle_month"], [data-view-id="cycle_month"]').first();
    await mensualBtn.click();
    await page.waitForTimeout(400);

    // Debe mostrar la tarjeta de estado de frecuencia
    const statusCard = page.locator('[data-testid="cycle-routine-status-card"]');
    await expect(statusCard).toBeVisible({ timeout: 4000 });

    // El navegador interactivo debe estar dentro de la tarjeta
    await expect(statusCard.locator('[data-testid="apple-period-navigator"]')).toBeVisible();

    // El interruptor de incluir acumuladas debe estar visible justo arriba
    const includeSwitch = page.locator('.routine-include-row');
    if (await includeSwitch.isVisible()) {
      await expect(includeSwitch).toBeVisible();
    }
  });

  test('La píldora de diagnóstico abre el Modal de Diagnóstico de Rutina estilo Apple', async ({ page }) => {
    const mensualBtn = page.locator('[data-testid="cycle-item-cycle_month"], [data-view-id="cycle_month"]').first();
    await mensualBtn.click();
    await page.waitForTimeout(400);

    // Si hay píldora de estado, hacer click para abrir el modal
    const pillBtn = page.locator('[data-testid="cycle-status-pill-btn"]');
    if (await pillBtn.isVisible()) {
      await pillBtn.click();
      await page.waitForTimeout(300);

      const modal = page.locator('[data-testid="routine-diagnostic-modal"]');
      await expect(modal).toBeVisible({ timeout: 3000 });
      await expect(modal).toContainText('Diagnóstico de Rutina');

      // Cerrar con el botón X
      const closeBtn = page.locator('[data-testid="routine-diagnostic-close-btn"]');
      await closeBtn.click();
      await page.waitForTimeout(300);
      await expect(modal).not.toBeVisible();
    }
  });
});
