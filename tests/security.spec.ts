import { test, expect } from '@playwright/test';
import { totpCode } from '../server/security.js';

test('verificación en dos pasos: activar desde Seguridad y volver a entrar con el código', async ({ page }) => {
  const email = `dos_pasos_${Date.now()}@example.com`;
  await page.goto('/');
  await page.evaluate(() => {
    sessionStorage.setItem('__E2E__', 'true');
    sessionStorage.setItem('daily_greeting_seen_session', 'true');
    localStorage.setItem('daily_greeting_dismissed_day', new Date().toDateString());
    localStorage.setItem('hide_onboarding_guide', 'true');
    (window as any).useAppStore?.getState()?.setToken('local_offline_token', 'local_guest_e2e');
  });
  await page.reload();

  // Crear la cuenta desde el acceso
  await page.locator('.user-profile-trigger').first().click();
  await page.getByText('Crear cuenta o iniciar sesión').click();
  await page.getByRole('tab', { name: 'Crear cuenta' }).click();
  await page.locator('input[type="email"]').fill(email);
  const passwords = page.locator('input[type="password"]');
  for (let i = 0; i < await passwords.count(); i++) await passwords.nth(i).fill('Password123!');
  await page.locator('button.auth-submit').click();
  await expect(page.locator('.user-profile-trigger').first()).toBeVisible({ timeout: 8000 });

  // Seguridad → activar
  await page.evaluate(() => window.dispatchEvent(new Event('open-security-sheet')));
  const sheet = page.getByRole('dialog', { name: 'Seguridad' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: /Activar/ }).first().click();
  await expect(sheet.getByAltText('Código QR para tu app de autenticación')).toBeVisible({ timeout: 8000 });
  const secret = (await sheet.locator('.security-key').innerText()).replace(/\s/g, '');
  expect(secret).toMatch(/^[A-Z2-7]{32}$/);
  await sheet.getByLabel(/Escribe el código de 6 dígitos/).fill(totpCode(secret));
  await sheet.getByRole('button', { name: 'Activar', exact: true }).click();
  await expect(sheet.getByRole('list', { name: 'Códigos de recuperación' }).locator('li')).toHaveCount(8);
  await sheet.getByRole('button', { name: 'Ya los he guardado' }).click();
  await expect(sheet.getByText('Activada')).toBeVisible();

  // Cerrar sesión en todos los dispositivos mantiene la sesión de aquí
  await sheet.getByRole('button', { name: /Cerrar sesión en todos los dispositivos/ }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cerrar sesiones' }).click();
  await expect(page.getByText('Sesión cerrada en el resto de dispositivos')).toBeVisible();
  await sheet.getByRole('button', { name: 'Listo' }).click();

  // Volver a entrar: contraseña + código
  await page.evaluate(() => (window as any).useAppStore.getState().setToken(null, null));
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 8000 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').first().fill('Password123!');
  await page.locator('button.auth-submit').click();
  const codeField = page.getByLabel('Código de verificación');
  await expect(codeField).toBeVisible({ timeout: 8000 });
  await codeField.fill('000000');
  await page.locator('button.auth-submit').click();
  await expect(page.getByRole('alert')).toContainText('no es correcto');
  await codeField.fill(totpCode(secret, Date.now() + 30_000)); // el del intervalo siguiente (el anterior ya se usó)
  await page.locator('button.auth-submit').click();
  await expect(page.locator('.user-profile-trigger').first()).toBeVisible({ timeout: 8000 });
});
