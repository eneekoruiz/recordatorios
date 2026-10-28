import { test, expect } from '@playwright/test';
import { bootApp } from './support/bootApp';

// Para saber qué versión corre una app instalada: el menú de usuario la enseña al pie.
test('el menú de usuario enseña la versión de la app', async ({ page }) => {
  await bootApp(page);
  await page.getByTestId('user-profile-trigger').click();
  await expect(page.getByTestId('app-version')).toHaveText(/^Versión \w{4,7} · \d{4}-\d{2}-\d{2}$/);
});
