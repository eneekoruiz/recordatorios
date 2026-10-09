import { test, expect, type Page } from '@playwright/test';
import { bootApp } from './support/bootApp';

async function unlockApp(page: Page) {
  await bootApp(page);
}

test('Integrations modal traps focus, makes the page inert, and restores focus', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('recordatorios:account-settings:v1:local_guest_e2e:notion', JSON.stringify({ apiKey: 'test-key', databaseId: 'test-db' }));
  });
  await unlockApp(page);
  const profileTrigger = page.locator('[data-testid="user-profile-trigger"]');
  await profileTrigger.click();
  await page.locator('[data-testid="profile-item-integrations"]').click();

  const modal = page.locator('[data-testid="integrations-modal"]');
  await expect(modal).toBeVisible();
  await expect.poll(() => modal.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await expect.poll(() => page.locator('#root').evaluate(element => (element as HTMLElement).inert)).toBe(true);
  await expect(modal.getByTestId('notion-configured-status')).toContainText('exportación manual');
  await expect(modal.getByText('Vinculado', { exact: true })).toHaveCount(0);

  const first = modal.locator('button').first();
  const last = modal.locator('button').last();
  await first.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(last).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(modal).not.toBeVisible();
  await expect(profileTrigger).toBeFocused();
  await expect.poll(() => page.locator('#root').evaluate(element => (element as HTMLElement).inert)).toBe(false);
});

test('integration credentials follow account switches and remain available when switching back', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('recordatorios:account-settings:v1:account-a:notion', JSON.stringify({ apiKey: 'account-a-key', databaseId: 'account-a-db' }));
    localStorage.setItem('recordatorios:account-settings:v1:account-b:notion', JSON.stringify({ apiKey: 'account-b-key', databaseId: 'account-b-db' }));
  });
  await unlockApp(page);
  const switchAccount = async (id: string) => page.evaluate((userId) => {
    const store = (window as any).useAppStore;
    store.setState((state: any) => ({ userId, sessionGeneration: state.sessionGeneration + 1 }));
  }, id);
  const openNotionConfig = async () => {
    await page.evaluate(() => window.dispatchEvent(new Event('open-integrations-modal')));
    const modal = page.getByTestId('integrations-modal');
    await expect(modal).toBeVisible();
    const input = modal.getByPlaceholder('API Key (secret_...)');
    if (!(await input.isVisible())) await modal.getByRole('button', { name: /^(Configurar|Editar) credenciales$/ }).click();
    return modal;
  };

  await switchAccount('account-a');
  let modal = await openNotionConfig();
  const tokenInput = modal.getByPlaceholder('API Key (secret_...)');
  await expect(tokenInput).toHaveValue('account-a-key');
  await switchAccount('account-b');
  await expect(modal).toBeHidden();

  modal = await openNotionConfig();
  await expect(modal.getByPlaceholder('API Key (secret_...)')).toHaveValue('account-b-key');
  await switchAccount('account-a');
  await expect(modal).toBeHidden();
  modal = await openNotionConfig();
  await expect(modal.getByPlaceholder('API Key (secret_...)')).toHaveValue('account-a-key');
});

test('Notion settings keep the draft and show an error when account storage rejects the save', async ({ page }) => {
  await page.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key.startsWith('recordatorios:account-settings:v1:')) throw new DOMException('Storage is full', 'QuotaExceededError');
      return originalSetItem.call(this, key, value);
    };
  });
  await unlockApp(page);
  await page.evaluate(() => window.dispatchEvent(new Event('open-integrations-modal')));
  const modal = page.getByTestId('integrations-modal');
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: 'Configurar credenciales' }).click();
  const tokenInput = modal.getByPlaceholder('API Key (secret_...)');
  await tokenInput.fill('retryable-draft');
  await modal.getByPlaceholder('ID de base de datos Notion').fill('draft-database');
  await expect(modal.getByTestId('notion-configured-status')).toHaveCount(0);
  await modal.getByRole('button', { name: 'Guardar credenciales' }).click();
  await expect(modal.getByRole('alert')).toContainText('No se pudieron guardar');
  await expect(modal.getByTestId('notion-configured-status')).toHaveCount(0);
  await expect(tokenInput).toHaveValue('retryable-draft');
});

test('Large task views use continuous scrolling without pagination buttons', async ({ page }) => {
  // Seed 1000 tasks and verify continuous rendering without pagination buttons
  test.setTimeout(90000);
  await unlockApp(page);
  await page.evaluate(() => {
    (window as any).useAppStore.setState({ tasks: {} });
    const store = (window as any).useAppStore.getState();
    store.addTasksBatch(Array.from({ length: 1000 }, (_, index) => ({
      title: `Scale regression task ${String(index + 1).padStart(3, '0')}`,
      type: 'task',
      status: 'pending',
    })));
    window.dispatchEvent(new CustomEvent('select-view', { detail: 'smart_all' }));
  });

  const scrollContainer = page.locator('.content-scroll');
  await expect(scrollContainer).toBeVisible({ timeout: 10000 });
  const mountedCards = page.locator('.content-scroll [data-index][data-task-id]');
  // No pagination controls are present per Apple-style continuous experience
  await expect(page.locator('[data-testid="task-pagination"]')).toHaveCount(0);
  await expect.poll(() => mountedCards.count()).toBeGreaterThanOrEqual(100);

  // Scroll to bottom to verify end of list is reached smoothly
  await scrollContainer.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await expect(page.getByText('Scale regression task 1000', { exact: true })).toBeVisible();
  await expect(page.locator('[data-testid="task-pagination"]')).toHaveCount(0);
});

test('a 300-child family renders and collapses/expands smoothly without pagination', async ({ page }) => {
  await unlockApp(page);
  await page.evaluate(() => {
    (window as any).useAppStore.setState({ tasks: {} });
    const store = (window as any).useAppStore.getState();
    store.addTasksBatch([{ title: 'Oversized family root', type: 'task', status: 'pending' }]);
    const root = Object.values((window as any).useAppStore.getState().tasks as Record<string, any>)
      .find((task: any) => task.title === 'Oversized family root');
    if (!root) throw new Error('Family root was not created');
    store.addTasksBatch(Array.from({ length: 305 }, (_, index) => ({
      title: `Family child ${String(index + 1).padStart(3, '0')}`,
      type: 'task',
      status: 'pending',
      parentId: root.id,
    })));
    window.dispatchEvent(new CustomEvent('select-view', { detail: 'smart_all' }));
  });

  const scrollContainer = page.locator('.content-scroll');
  await expect(scrollContainer).toBeVisible({ timeout: 10000 });
  const mountedCards = page.locator('.content-scroll [data-index][data-task-id]');
  await expect(page.locator('[data-testid="task-pagination"]')).toHaveCount(0);
  await expect.poll(() => mountedCards.count()).toBeGreaterThan(0);
  const familyRoot = mountedCards.filter({ hasText: 'Oversized family root' }).first();
  await expect(page.getByText('Family child 001', { exact: true })).toBeVisible();
  await familyRoot.getByRole('button', { name: 'Contraer', exact: true }).click();
  await expect(page.getByText('Family child 001', { exact: true })).toHaveCount(0);
  await familyRoot.getByRole('button', { name: 'Expandir' }).click();
  await expect(page.getByText('Family child 001', { exact: true })).toBeVisible();

  // Scroll down to verify continuous scrolling without pagination
  await scrollContainer.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await expect(page.getByText('Family child 305', { exact: true })).toBeVisible();
  await expect(page.locator('[data-testid="task-pagination"]')).toHaveCount(0);
});
