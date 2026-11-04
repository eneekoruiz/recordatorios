import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { bootApp } from './support/bootApp';

for (const width of [375, 768, 1440]) {
  test(`channel linking and revocation at ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.route('**/api/**', route => route.abort());
    let linked = false;
    let rejectRevocation = false;
    await page.route('**/api/channels', route => route.fulfill({ json: { accountId: 'local_guest_e2e', channels: [
      { channel: 'telegram', bridgeConfigured: true, linked, externalVerified: false },
      { channel: 'whatsapp', bridgeConfigured: false, linked: false, externalVerified: false },
    ] } }));
    await page.route('**/api/channels/telegram/link', route => {
      expect(route.request().method()).toBe('POST');
      expect(route.request().headers().authorization).toMatch(/^Bearer /);
      return route.fulfill({ json: { code: 'a'.repeat(64), expiresAt: new Date(Date.now() + 600000).toISOString() } });
    });
    await page.route('**/api/channels/telegram', route => {
      expect(route.request().method()).toBe('DELETE');
      if (rejectRevocation) return route.fulfill({ status: 503, json: {} });
      linked = false;
      return route.fulfill({ status: 204 });
    });
    await bootApp(page);
    await page.evaluate(() => window.dispatchEvent(new Event('open-integrations-modal')));
    const group = page.getByRole('group', { name: 'Vínculo de Telegram' });
    await group.getByRole('button', { name: 'Comprobar vínculo de Telegram' }).click();
    await group.getByRole('button', { name: 'Crear código de vinculación' }).click();
    const code = group.getByRole('textbox', { name: 'Comando para el chat privado de Helen en Telegram' });
    await expect(code).toHaveValue(`/recordatorios vincular ${'a'.repeat(64)}`);
    expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('a'.repeat(64));
    for (const theme of ['light', 'dark'] as const) {
      await page.evaluate(value => (window as any).useAppStore.getState().setTheme(value), theme);
      await group.screenshot({ path: testInfo.outputPath(`channel-link-${width}-${theme}.png`), animations: 'disabled' });
      const contrast = await new AxeBuilder({ page }).include('.channel-link').withRules(['color-contrast']).analyze();
      expect(contrast.violations).toEqual([]);
      expect(await group.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    }
    linked = true;
    await group.getByRole('button', { name: 'Comprobar vínculo de Telegram' }).click();
    await expect(group).toContainText('El funcionamiento externo todavía no está verificado');
    rejectRevocation = true;
    await group.getByRole('button', { name: 'Revocar vínculo de Telegram' }).click();
    await expect(group).toContainText('no está disponible');
    await expect(group.getByRole('textbox')).toHaveCount(0);
    rejectRevocation = false;
    await group.getByRole('button', { name: 'Revocar vínculo de Telegram' }).click();
    await expect(group).toContainText('Vínculo revocado. Las tareas se conservan.');
    const whatsapp = page.getByRole('group', { name: 'Vínculo de WhatsApp' });
    await whatsapp.getByRole('button', { name: 'Comprobar vínculo de WhatsApp' }).click();
    await expect(whatsapp).toContainText('Puente sin configurar');
    await expect(whatsapp.getByRole('button', { name: 'Crear código de vinculación' })).toHaveCount(0);
    await group.getByRole('button', { name: 'Crear código de vinculación' }).click();
    await expect(code).toBeVisible();
    await page.evaluate(() => (window as any).useAppStore.setState({ userId: 'other-account' }));
    await expect(group.getByRole('textbox')).toHaveCount(0);
    await expect(page.getByTestId('integrations-modal')).not.toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event('open-integrations-modal')));
    await expect(group).toContainText('Vínculo con esta cuenta sin comprobar');
  });
  test(`assistant integration states, keyboard and layout at ${width}px`, async ({ page }, testInfo) => {
    // Windows cold startup shares the worker with application hydration.
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    // The offline fixture token must not trigger a real backend session-expiry race.
    await page.route('**/api/**', route => route.abort());
    await page.route('**/api/helen/status', route => route.fulfill({ json: { accountId: 'local_guest_e2e', syncAvailable: true } }));
    await bootApp(page);
    await page.evaluate(() => window.dispatchEvent(new Event('open-integrations-modal')));
    const dialog = page.getByTestId('integrations-modal');
    await expect(dialog).toBeVisible();
    const section = dialog.getByRole('region', { name: 'Asistentes y mensajería' });
    await expect(section.getByRole('status')).toHaveText('Conexión sin comprobar en esta sesión.');
    await section.getByRole('button', { name: 'Comprobar API de mi cuenta' }).click();
    await expect(section.getByRole('status')).toContainText('API disponible para tu cuenta');
    for (const theme of ['light', 'dark'] as const) {
      await page.evaluate(value => (window as any).useAppStore.getState().setTheme(value), theme);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      // Finish finite CSS transitions before checking the settled theme.
      await page.screenshot({ path: testInfo.outputPath(`integrations-${width}-${theme}.png`), animations: 'disabled' });
      const contrast = await new AxeBuilder({ page }).include('.assistant-integrations')
        .withRules(['color-contrast']).analyze();
      expect(contrast.passes.map(rule => rule.id)).toContain('color-contrast');
      expect(contrast.violations).toEqual([]);
      expect(contrast.incomplete).toEqual([]);
      expect(await section.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    }
    await section.locator('summary', { hasText: 'Conectar o desvincular Helen' }).focus();
    await page.keyboard.press('Enter');
    await expect(section.getByText('En el chat privado de Helen, abre Ajustes → Recordatorios.')).toBeVisible();
    await expect(section.getByRole('heading', { name: 'WhatsApp Sin configurar' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await section.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.route('**/api/helen/status', route => route.fulfill({ status: 404, json: {} }));
    await section.getByRole('button', { name: 'Comprobar API de mi cuenta' }).click();
    await expect(section.getByRole('status')).toContainText('aún no está desplegada');
    await page.route('**/api/helen/status', route => route.fulfill({ json: { accountId: 'someone-else', syncAvailable: true } }));
    await section.getByRole('button', { name: 'Comprobar API de mi cuenta' }).click();
    await expect(section.getByRole('status')).toContainText('No se pudo verificar');
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    expect(errors).toEqual([]);
  });
}
