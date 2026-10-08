import { test, expect } from '@playwright/test';
import { bootApp } from "./support/bootApp";

async function ensureAppUnlocked(page: any) {
    await bootApp(page);
}

async function seedCasa(page: any) {
  await page.evaluate(() => {
    const st = (window as any).useAppStore.getState();
    st.addList({ id: 'casa_e2e', name: 'Casa E2E', color: '#ff9500' });
    const T = (id: string, title: string, o: any) => st.addTask({ id, title, status: 'pending', categoryId: 'casa_e2e', ...o });
    T('ce_1', 'Limpiar cocina', { duration: 30, cycle_id: 'cycle_week' });
    T('ce_2', 'Regar plantas', { duration: 15, cycle_id: 'cycle_day' });
    T('ce_3', 'Llamar al médico', { dueDate: new Date().toISOString() });
  });
  await page.waitForTimeout(400);
}

test.describe('Pulido final', () => {
  test('el número y la duración de la cabecera cuentan también las secciones plegadas (como la barra lateral)', async ({ page }) => {
    await ensureAppUnlocked(page);
    await seedCasa(page);
    await page.locator('.ios-list-item', { hasText: 'Casa E2E' }).first().click();
    await page.waitForTimeout(600);
    const sideCount = await page.locator('.ios-list-item', { hasText: 'Casa E2E' }).first().locator('.count').textContent();
    await expect(page.locator('.apple-large-counter').first()).toHaveText(String(sideCount).trim());
    await expect(page.locator('.list-duration-meta').first()).toContainText('45 min');
  });

  test('las listas corrientes no llevan la etiqueta «Anotar»', async ({ page }) => {
    await ensureAppUnlocked(page);
    await seedCasa(page);
    await page.locator('.ios-list-item', { hasText: 'Casa E2E' }).first().click();
    await page.waitForTimeout(500);
    await expect(page.locator('.apple-list-type-pill', { hasText: 'Anotar' })).toHaveCount(0);
  });

  test('sin cuenta: «Crear cuenta o iniciar sesión» abre el acceso y conserva los recordatorios al registrarse', async ({ page }) => {
    await ensureAppUnlocked(page);
    await seedCasa(page);
    await page.locator('.user-profile-trigger').first().click();
    await expect(page.getByText('Sincronizar ahora')).toHaveCount(0);
    await page.getByText('Crear cuenta o iniciar sesión').click();
    await page.getByRole('tab', { name: 'Crear cuenta' }).click();
    await page.locator('input[type="email"]').fill(`invitado_${Date.now()}@example.com`);
    const passwords = page.locator('input[type="password"]');
    for (let i = 0; i < await passwords.count(); i++) await passwords.nth(i).fill('Password123!');
    await page.locator('button.auth-submit').click();
    await expect(page.locator('.ios-list-item', { hasText: 'Casa E2E' }).first()).toBeVisible({ timeout: 8000 });
    const state = await page.evaluate(() => {
      const st = (window as any).useAppStore.getState();
      return { kept: Boolean(st.tasks['ce_3']), token: String(st.token || '') };
    });
    expect(state.kept).toBe(true);
    expect(state.token).not.toMatch(/^local_offline/); // ya es una cuenta real
  });

  test('nueva lista: «Crear» arriba, desactivado sin nombre, e Intro guarda', async ({ page }) => {
    await ensureAppUnlocked(page);
    await page.getByText('Añadir lista').first().click();
    const sheet = page.getByRole('dialog', { name: 'Nueva lista' });
    await expect(sheet).toBeVisible();
    const create = sheet.getByRole('button', { name: 'Crear', exact: true });
    await expect(create).toBeDisabled();
    await sheet.getByLabel('Nombre de la lista').fill('Viaje a Roma');
    await expect(create).toBeEnabled();
    await sheet.getByLabel('Nombre de la lista').press('Enter');
    await expect(sheet).toHaveCount(0);
    await expect(page.locator('.ios-list-item', { hasText: 'Viaje a Roma' }).first()).toBeVisible();
  });

  test('las alertas no llevan «×» ni etiquetas y la acción destructiva va en rojo', async ({ page }) => {
    await ensureAppUnlocked(page);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('app-confirm-request', {
      detail: { title: '¿Eliminar «Casa»?', message: 'Se moverá a la papelera.', confirmText: 'Eliminar', tone: 'danger', resolve: () => {} },
    })));
    const alert = page.getByRole('alertdialog');
    await expect(alert).toBeVisible();
    await expect(alert.getByRole('button')).toHaveCount(2);
    await expect(alert.getByRole('button', { name: 'Eliminar' })).toHaveClass(/danger/);
    await page.keyboard.press('Escape');
    await expect(alert).toHaveCount(0);
  });

  test('el buscador ignora las tildes, agrupa resultados y muestra el precio con formato', async ({ page }) => {
    await ensureAppUnlocked(page);
    await seedCasa(page);
    await page.evaluate(() => (window as any).useAppStore.getState().addTask({ id: 'ce_4', title: 'Café molido', status: 'pending', categoryId: 'casa_e2e', price: 1.5 }));
    await page.evaluate(() => window.dispatchEvent(new Event('open-command-palette')));
    const input = page.getByPlaceholder('Buscar recordatorios, listas o acciones...');
    await input.fill('medico');
    await expect(page.locator('.spotlight-section').first()).toHaveText('Recordatorios');
    await expect(page.locator('.spotlight-row').first()).toContainText('Llamar al médico');
    await input.fill('cafe');
    await expect(page.locator('.spotlight-row').first()).toContainText('1,50 €');
    await page.keyboard.press('Escape');
    await expect(input).toHaveCount(0);
  });

  test('la duración de una sección o vista con mezcla se reparte en puntuales, diarias y semanales', async ({ page }) => {
    await ensureAppUnlocked(page);
    await seedCasa(page);
    await page.evaluate(() => {
      (window as any).useAppStore.getState().addTask({ id: 'ce_5', title: 'Comprar pan', status: 'pending', categoryId: 'casa_e2e', dueDate: new Date().toISOString(), duration: 10 });
      window.dispatchEvent(new CustomEvent('select-view', { detail: 'smart_all' }));
    });
    const casa = page.locator('.group-header', { hasText: 'Casa E2E' });
    const chip = casa.getByRole('button', { name: 'Ver desglose de tiempo de sección' }).first();
    await expect(chip).toBeVisible();
    await chip.click();

    // El desglose se muestra ahora en la tarjeta modal DurationInfoCard
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Puntuales');
    await expect(modal).toContainText('10 min');
    await expect(modal).toContainText('Diarias');
    await expect(modal).toContainText('15 min');
    await expect(modal).toContainText('Semanales');
    await expect(modal).toContainText('30 min');
  });

  test('eliminar una sección avisa con «Deshacer» y Ctrl+Z la devuelve con sus recordatorios', async ({ page }) => {
    await ensureAppUnlocked(page);
    await page.evaluate(() => {
      const st = (window as any).useAppStore.getState();
      st.addTasksBatch([], { createList: { id: 'proy', name: 'Proyecto', color: '#af52de', icon: 'sparkles' } });
      st.addListSection({ id: 'sx', listId: 'proy', name: 'Fase uno', order: 0 });
      st.addTask({ id: 't1', title: 'Diseñar', status: 'pending', categoryId: 'proy', sectionId: 'sx', created_at: new Date().toISOString() });
    });
    await page.locator('.ios-list-item', { hasText: 'Proyecto' }).first().click();
    const header = page.locator('.group-header', { hasText: 'Fase uno' });
    await header.hover();
    await header.getByRole('button', { name: 'Opciones de sección' }).click();
    await page.getByText('Eliminar sección').first().click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Eliminar' }).click();
    await expect(header).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Deshacer' })).toBeVisible();
    await page.locator('body').click({ position: { x: 900, y: 500 } });
    await page.keyboard.press('Control+z');
    await expect(header).toHaveCount(1);
    expect(await page.evaluate(() => (window as any).useAppStore.getState().tasks.t1.sectionId)).toBe('sx');
  });

  test('con el modal de duración abierto, clic derecho no interactúa con las capas inferiores ni abre menús', async ({ page }) => {
    await ensureAppUnlocked(page);
    await seedCasa(page);
    await page.locator('.ios-list-item', { hasText: 'Casa E2E' }).first().click();
    await page.waitForTimeout(400);

    // Abrir modal de duración
    const durationBtn = page.locator('.section-duration-label').first();
    await expect(durationBtn).toBeVisible();
    await durationBtn.click();

    // El diálogo de duración está visible
    const dialog = page.locator('[role="dialog"][aria-modal="true"]');
    await expect(dialog).toBeVisible();

    // Clic derecho en la pantalla (sobre el backdrop o el área de una tarea de fondo)
    await page.mouse.click(100, 300, { button: 'right' });
    await page.waitForTimeout(200);

    // Ningún menú contextual de tarea o sección debe abrirse
    await expect(page.locator('.ios-dropdown-menu')).toHaveCount(0);
    // El diálogo de duración se cierra con Escape
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });

  test.describe('móvil', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test('deslizar desde el borde izquierdo vuelve a las listas; un arrastre corto no', async ({ page }) => {
      // The two sampled pointer journeys can take >30s through Chromium on Windows.
      // Preserve the slow short drag and the full threshold-crossing drag assertions.
      test.setTimeout(60000);
      await ensureAppUnlocked(page);
      await seedCasa(page);
      await page.locator('.ios-list-item', { hasText: 'Casa E2E' }).first().tap();
      await expect(page.locator('.app-container')).toHaveClass(/mobile-content/);

      // Arrastre corto y lento: la página vuelve a su sitio.
      await page.mouse.move(8, 420);
      await page.mouse.down();
      for (let x = 8; x <= 60; x += 4) { await page.mouse.move(x, 420); await page.waitForTimeout(30); }
      await page.waitForTimeout(150);
      await page.mouse.up();
      await page.waitForTimeout(500);
      await expect(page.locator('.app-container')).toHaveClass(/mobile-content/);

      // Arrastre largo: vuelve a las listas.
      await page.mouse.move(8, 420);
      await page.mouse.down();
      for (let x = 8; x <= 280; x += 12) { await page.mouse.move(x, 420); await page.waitForTimeout(16); }
      await page.mouse.up();
      await expect(page.locator('.app-container')).toHaveClass(/mobile-sidebar/, { timeout: 2000 });
      await expect(page.locator('body')).not.toHaveClass(/nav-swiping/);
    });
  });
});
