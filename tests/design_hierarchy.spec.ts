import { test, expect, type Page } from '@playwright/test';
import { bootApp } from './support/bootApp';

const event = (page: Page, name: string, detail?: unknown) => page.evaluate(
  ([name, detail]) => window.dispatchEvent(new CustomEvent(name as string, { detail })), [name, detail] as const,
);
async function seed(page: Page) {
  await bootApp(page);
  await page.evaluate(() => {
    const state = (window as any).useAppStore.getState();
    state.addList({ id: 'hierarchy', name: 'Casa tranquila', color: '#007aff' });
    state.addListSection({ id: 'hierarchy-section', listId: 'hierarchy', name: 'Cocina', order: 0 });
    state.addTask({ id: 'hierarchy-task', title: 'Revisar la cocina', categoryId: 'hierarchy', sectionId: 'hierarchy-section', status: 'pending', duration: 15, cycle_id: 'cycle_week', timeOfDay: 'morning', price: 12, quantity: 2, dueDate: new Date().toISOString() });
  });
  await event(page, 'select-view', 'list_hierarchy');
}

test('task metadata is directly actionable without a redundant disclosure', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await seed(page);
  const section = page.locator('.group-header', { hasText: 'Cocina' });
  const expand = section.getByRole('button', { name: 'Desplegar sección', exact: true });
  if (await expand.count()) await expand.click();
  const details = page.locator('[data-task-id="hierarchy-task"]').first().locator('.task-context');
  await expect(details.locator('details')).toHaveCount(0);
  for (const button of await details.getByRole('button').all()) {
    const box = await button.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
  }
  await expect(details).toContainText('15 min');
  await expect(details).toContainText('24');
  await details.getByRole('button', { name: /Mañana/ }).click();
  expect(await page.evaluate(() => (window as any).useAppStore.getState().tasks['hierarchy-task'].timeOfDay)).toBe('afternoon');
  expect(await page.evaluate(() => (window as any).useAppStore.getState().tasks['hierarchy-task'].status)).toBe('pending');
  await details.getByRole('button', { name: /15 min/ }).click();
  await expect(page.getByRole('dialog', { name: 'Detalles', exact: true })).toBeVisible();
  await expect(page.locator('#drawer-duration-row')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fecha y hora', exact: false })).toHaveAttribute('aria-expanded', 'false');
});

test('management discloses every row command and preserves pinning', async ({ page }) => {
  await seed(page);
  await event(page, 'open-manage-lists-modal');
  const row = page.getByTestId('manage-lists-item-hierarchy');
  await expect(row.getByRole('button', { name: 'Fijar lista', exact: true })).not.toBeVisible();
  await row.getByLabel('Opciones de Casa tranquila', { exact: true }).click();
  await expect(row.getByRole('button', { name: 'Subir orden' })).toBeVisible();
  await expect(row.getByRole('button', { name: 'Bajar orden' })).toBeVisible();
  await expect(row.getByRole('button', { name: 'Editar Casa tranquila' })).toBeVisible();
  await expect(row.getByRole('button', { name: 'Eliminar Casa tranquila' })).toBeVisible();
  await row.getByRole('button', { name: 'Fijar lista', exact: true }).click();
  await expect(row.getByRole('button', { name: 'Desfijar lista', exact: true })).toBeVisible();
  await row.getByRole('checkbox').click();
  await expect(row.getByRole('checkbox')).toBeChecked();
});

test('sheets contain keyboard focus and restore the trigger', async ({ page }) => {
  await seed(page);
  const trigger = page.getByTestId('user-profile-trigger').first();
  for (const name of ['open-shortcuts-modal', 'open-command-palette', 'open-ai-assistant', 'open-manage-lists-modal', 'open-new-task-drawer']) {
    await trigger.focus();
    await event(page, name);
    const dialog = page.getByRole('dialog').last();
    await expect(dialog).toBeVisible();
    await expect.poll(() => dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
    const last = dialog.locator('button:visible:not([disabled]), input:visible:not([disabled]), textarea:visible:not([disabled]), select:visible:not([disabled]), [tabindex="0"]:visible').last();
    await last.focus();
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(node => node.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
  }
});

test('mobile section options remain directly accessible', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await seed(page);
  const section = page.locator('.group-header', { hasText: 'Cocina' });
  const options = section.getByRole('button', { name: 'Opciones de sección', exact: true });
  await expect(options).toBeVisible();
  for (const target of [options]) {
    const bounds = await target.boundingBox();
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
    expect(bounds?.width).toBeGreaterThanOrEqual(44);
  }
  await options.click();
  await expect(page.getByText('Renombrar sección', { exact: true }).first()).toBeVisible();
});

 test('empty tasks have no extra metadata row and use the existing editor', async ({ page }) => {
  await seed(page);
  await page.evaluate(() => (window as any).useAppStore.getState().addTask({id:'empty-meta',title:'Sin datos secundarios',categoryId:'hierarchy',status:'pending'}));
  const row=page.locator('[data-task-id="empty-meta"]').first();
  await expect(row.locator('.task-context')).toHaveCount(0);
  await row.getByRole('button',{name:'Detalles del recordatorio',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'Detalles',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>(window as any).useAppStore.getState().tasks['empty-meta'].status)).toBe('pending');
});

test('management and configuration reflow at narrow widths and enlarged text', async ({page}) => {
  await seed(page);
  for(const [width,font] of [[320,16],[390,32],[320,32]]) {
    await page.setViewportSize({width,height:844});
    await page.evaluate(font => document.documentElement.style.fontSize=font+'px',font);
    await event(page,'open-manage-lists-modal');
    const sheet=page.getByRole('dialog',{name:'Gestionar listas',exact:true});
    await expect(sheet).toBeVisible();
    await expect.poll(() => sheet.evaluate(el=>el.scrollWidth<=el.clientWidth+1), { message: `Management overflow at ${width}px and ${font}px text` }).toBe(true);
    const row=page.getByTestId('manage-lists-item-hierarchy');
    await row.getByLabel('Opciones de Casa tranquila',{exact:true}).click();
    await row.getByRole('button',{name:'Editar Casa tranquila',exact:true}).click();
    const config=page.getByRole('dialog',{name:'Editar lista',exact:true});
    await expect(config).toBeVisible();
    await expect.poll(() => config.evaluate(el => {
      const cancel = el.querySelector<HTMLElement>('.sheet-navbar-btn:not(.is-primary)')!.getBoundingClientRect();
      const save = el.querySelector<HTMLElement>('.sheet-navbar-btn.is-primary')!.getBoundingClientRect();
      const title = el.querySelector<HTMLElement>('.sheet-navbar-title')!.getBoundingClientRect();
      return {
        actionsSeparate: cancel.right <= save.left + 1 || save.right <= cancel.left + 1 || cancel.bottom <= save.top + 1 || save.bottom <= cancel.top + 1,
        titleAboveActions: title.bottom <= Math.min(cancel.top, save.top) + 1
      };
    }), { message: `Configuration actions overlap at ${width}px and ${font}px text` }).toEqual({ actionsSeparate: true, titleAboveActions: true });
    expect(await config.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
    await config.getByRole('button',{name:'Cancelar',exact:true}).click();
    const management=page.getByRole('dialog',{name:'Gestionar listas',exact:true});
    if(await management.count()) await management.getByRole('button',{name:'Cerrar',exact:true}).click();
  }
});

test('batch sheets trap focus and Escape preserves selection and tasks', async ({page}) => {
  await seed(page);
  const section=page.locator('.group-header',{hasText:'Cocina'});
  const expand=section.getByRole('button',{name:'Desplegar sección',exact:true});
  if(await expand.count()) await expand.click();
  await event(page,'enter-selection-mode');
  await page.locator('[data-task-id="hierarchy-task"]').first().dispatchEvent('pointerdown',{pointerType:'mouse',button:0});
  for(const [label,name] of [['Mover todos a otra sección','Mover selección a una sección'],['Anidar todos como subtareas de otra tarea','Anidar selección en una tarea'],['Eliminar recordatorios seleccionados','Eliminar recordatorios seleccionados']]) {
    const trigger=page.getByRole('button',{name:label,exact:true});
    await trigger.click();
    const dialog=page.getByRole('dialog',{name,exact:true});
    await expect(dialog).toBeVisible();
    await expect.poll(()=>dialog.evaluate(node=>node.contains(document.activeElement))).toBe(true);
    for(let i=0;i<6;i++) await page.keyboard.press('Tab');
    expect(await dialog.evaluate(node=>node.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(()=>(window as any).useAppStore.getState().tasks['hierarchy-task'].status)).toBe('pending');
    expect(await page.evaluate(()=>(window as any).useAppStore.getState().tasks['hierarchy-task'].deleted_at)).toBeFalsy();
  }
});

