import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { bootApp } from './support/bootApp';

async function readPersistedSnapshot(page: Page): Promise<string | null> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('app-store-db', 1);
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    try {
      return await new Promise<string | null>((resolve, reject) => {
        const storage = db.transaction('keyval').objectStore('keyval');
        const nativeGet = (window as any).auditNativeGet || IDBObjectStore.prototype.get;
        const request = nativeGet.call(storage, 'reminders-storage') as IDBRequest;
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  });
}

test('invalid JSON is rejected before preview or persisted mutation', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await bootApp(page);
  const before = await page.evaluate(() => JSON.stringify((window as any).useAppStore.getState().tasks));
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('select-view', { detail: 'DATA' })));
  await page.getByRole('textbox', { name: 'Datos para importar' }).fill('[{"id":"audit-bad","title":{"bad":"object"},"status":"pending"}]');
  await page.getByRole('button', { name: 'Procesar Datos' }).click();
  await expect(page.getByRole('status')).toContainText('campo title inválido');
  expect(await page.evaluate(() => JSON.stringify((window as any).useAppStore.getState().tasks))).toBe(before);
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a failed local write is visible, retryable and durable after retry', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await bootApp(page);
  await page.evaluate(async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const original = IDBObjectStore.prototype.put;
    (window as any).restoreAuditPut = () => { IDBObjectStore.prototype.put = original; };
    IDBObjectStore.prototype.put = () => { throw new DOMException('audit quota', 'QuotaExceededError'); };
    (window as any).useAppStore.getState().addTask({ id: 'audit-write', title: 'Guardado tras reintento', status: 'pending' });
  });
  await expect(page.getByRole('alert')).toContainText('pendientes');
  // Keep writes failing until the user's retry click; a background update after
  // restoring storage could otherwise finish the pending save before the click.
  await page.evaluate(() => {
    document.addEventListener('click', function restoreOnRetry(event) {
      const button = (event.target as Element | null)?.closest('button');
      if (button?.textContent?.trim() !== 'Reintentar') return;
      (window as any).restoreAuditPut();
      document.removeEventListener('click', restoreOnRetry, true);
    }, true);
  });
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.reload();
  await expect.poll(() => page.evaluate(() => (window as any).useAppStore?.getState().tasks['audit-write']?.title)).toBe('Guardado tras reintento');
  expect(errors).toEqual([]);
});

test('a failed startup read cannot overwrite saved data with defaults and can be retried', async ({ page }) => {
  test.setTimeout(60000);
  await bootApp(page);
  await page.evaluate(() => (window as any).useAppStore.getState().addTask({
    id: 'audit-read-safe', title: 'Conservar antes de abrir', status: 'pending',
  }));
  await expect.poll(async () => JSON.parse(await readPersistedSnapshot(page) || '{}').state?.tasks?.['audit-read-safe']?.title)
    .toBe('Conservar antes de abrir');
  const original = await readPersistedSnapshot(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__audit_read_block') !== '1') return;
    const nativeGet = IDBObjectStore.prototype.get;
    (window as any).auditNativeGet = nativeGet;
    IDBObjectStore.prototype.get = function (key: IDBValidKey | IDBKeyRange) {
      if (this.name === 'keyval' && key === 'reminders-storage') throw new DOMException('Read denied for audit', 'AbortError');
      return nativeGet.call(this, key);
    };
  });
  await page.evaluate(() => sessionStorage.setItem('__audit_read_block', '1'));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('No se pudieron cargar');
  // Cover the former 4.5-second fallback that opened defaults after a failed read.
  await page.waitForTimeout(6000);
  expect(await page.evaluate(() => (window as any).useAppStore.getState().hasHydrated)).toBe(false);
  expect(await readPersistedSnapshot(page)).toBe(original);
  await page.evaluate(() => {
    document.addEventListener('click', function restoreOnRetry(event) {
      const button = (event.target as Element | null)?.closest('button');
      if (button?.textContent?.trim() !== 'Reintentar') return;
      IDBObjectStore.prototype.get = (window as any).auditNativeGet;
      sessionStorage.removeItem('__audit_read_block');
      document.removeEventListener('click', restoreOnRetry, true);
    }, true);
  });
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.app-container')).toBeVisible();
  expect(await page.evaluate(() => (window as any).useAppStore.getState().tasks['audit-read-safe']?.title))
    .toBe('Conservar antes de abrir');
});

test('legacy damaged records recover with an exact downloadable backup and account isolation', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await bootApp(page);
  await page.evaluate(() => (window as any).useAppStore.getState().addTask({
    id: 'audit-recovery-safe', title: 'Registro conservado', status: 'pending',
  }));
  await expect.poll(() => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('app-store-db', 1);
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    try {
      return await new Promise<boolean>((resolve, reject) => {
        const request = db.transaction('keyval').objectStore('keyval').get('reminders-storage');
        request.onsuccess = () => resolve(Boolean(JSON.parse(request.result || '{}').state?.tasks?.['audit-recovery-safe']));
        request.onerror = () => reject(request.error);
      });
    } finally { db.close(); }
  })).toBe(true);
  const original = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('app-store-db', 1);
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    try {
      return await new Promise<string>((resolve, reject) => {
        const transaction = db.transaction('keyval', 'readwrite');
        const storage = transaction.objectStore('keyval');
        const request = storage.get('reminders-storage');
        let raw = '';
        request.onsuccess = () => {
          const snapshot = JSON.parse(request.result);
          snapshot.version = 7;
          snapshot.state.tasks['audit-recovery-broken'] = { id: 'audit-recovery-broken', title: { unsafe: true }, status: 'pending' };
          raw = JSON.stringify(snapshot);
          storage.put(raw, 'reminders-storage');
        };
        transaction.oncomplete = () => resolve(raw);
        transaction.onerror = () => reject(transaction.error);
      });
    } finally { db.close(); }
  });
  await page.reload();
  await expect(page.locator('.app-container')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Registros apartados: 1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => Boolean((window as any).useAppStore.getState().tasks['audit-recovery-safe']))).toBe(true);
  expect(await page.evaluate(() => Boolean((window as any).useAppStore.getState().tasks['audit-recovery-broken']))).toBe(false);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar copia original' }).click();
  const path = await (await downloadPromise).path();
  expect(path).toBeTruthy();
  expect(await readFile(path!, 'utf8')).toBe(original);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Descargar copia original' })).toBeVisible();
  await page.evaluate(() => (window as any).useAppStore.getState().setToken('local_offline_account_b', 'local_guest_account_b'));
  await expect(page.getByRole('button', { name: 'Descargar copia original' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('PDF export displays an HTML task title as literal text under production CSP', async ({ page }) => {
  await bootApp(page);
  const payload = '<img id="audit-injected" src=x onerror="opener.hacked=true">';
  await page.evaluate(title => {
    (window as any).useAppStore.getState().addTask({ title, status: 'pending' });
    window.dispatchEvent(new CustomEvent('select-view', { detail: 'DATA' }));
  }, payload);
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Imprimir / PDF' }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');
  await expect(popup.locator('#audit-injected')).toHaveCount(0);
  await expect(popup.locator('.task-title', { hasText: payload })).toHaveCount(1);
});

test('GitHub verification is allowed by the deployed CSP', async ({ page }) => {
  const violations: string[] = [];
  await page.addInitScript(() => {
    (window as any).auditCspViolations = [];
    document.addEventListener('securitypolicyviolation', event => (window as any).auditCspViolations.push(event.blockedURI));
  });
  await page.route('https://api.github.com/user', route => route.fulfill({ json: { login: 'audit-user' } }));
  await bootApp(page);
  await page.evaluate(() => window.dispatchEvent(new Event('open-integrations-modal')));
  const dialog = page.getByTestId('integrations-modal');
  await dialog.getByRole('button', { name: 'Vincular Token' }).click();
  await dialog.getByPlaceholder('GitHub PAT (ghp_... o token clásico/fine-grained)').fill('test-only-token');
  await dialog.getByRole('button', { name: 'Probar conexión' }).click();
  await expect(dialog.getByText('✓ @audit-user', { exact: true })).toBeVisible();
  violations.push(...await page.evaluate(() => (window as any).auditCspViolations));
  expect(violations).not.toContain('https://api.github.com/user');
});

for (const width of [375, 768, 1440]) {
  test.describe(`production UI at ${width}px with reduced motion`, () => {
    test.use({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    test('import and integrations stay usable without horizontal overflow or browser errors', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      await bootApp(page);
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('select-view', { detail: 'DATA' })));
      await expect(page.getByRole('textbox', { name: 'Datos para importar' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      await page.evaluate(() => window.dispatchEvent(new Event('open-integrations-modal')));
      const dialog = page.getByTestId('integrations-modal');
      await expect(dialog).toBeVisible();
      await expect.poll(() => dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  });
}
