import { test, expect, type Page } from '@playwright/test';
import { bootApp } from './support/bootApp';

// «Otras rutinas» del Gimnasio: una fila por rutina; cada una se abre completa (todos los días con sus
// ejercicios, series y descansos) y desde ahí se activa tras confirmarlo.
test.use({ viewport: { width: 390, height: 844 } });

async function seedGym(page: Page) {
  await bootApp(page);
  await page.evaluate(async () => {
    const mod = await import('/src/utils/gymExercises.ts');
    const useAppStore = (window as any).useAppStore;
    const st = useAppStore.getState();
    const r = mod.createDefaultGymRoutine('local_guest_e2e');
    st.addList(r.list);
    r.sections.forEach((s: any) => st.addListSection(s));
    useAppStore.setState((s: any) => ({ tasks: { ...s.tasks, ...Object.fromEntries(r.tasks.map((t: any) => [t.id, t])) } }));
    window.dispatchEvent(new CustomEvent('select-view', { detail: 'list_gimnasio' }));
  });
}

const otherRoutines = (page: Page) => page.getByTestId('gym-other-routines');
const detail = (page: Page) => page.getByTestId('gym-routine-detail');
const activeSplit = (page: Page) => page.evaluate(() => (window as any).useAppStore.getState().lists.find((l: any) => l.id === 'gimnasio')?.activeRoutineSplit);

test('«Otras rutinas» es una lista con una fila por rutina que abre la rutina completa', async ({ page }) => {
  await seedGym(page);
  const section = otherRoutines(page);
  await section.scrollIntoViewIfNeeded();
  await expect(section.getByRole('heading', { name: 'Otras rutinas' })).toBeVisible();
  await expect(section.locator('.gym-other-row')).toHaveCount(2);
  const ppl = section.getByTestId('gym-other-row-ppl_3d');
  await expect(ppl).toContainText('Empuje / Tirón / Pierna');
  await expect(ppl).toContainText('3 días');

  await ppl.click();
  const sheet = detail(page);
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('heading', { name: 'Empuje / Tirón / Pierna' })).toBeVisible();
  // Los tres días y la parte diaria, cada uno con todos sus ejercicios.
  await expect(sheet.getByTestId('gym-rd-day')).toHaveCount(4);
  await expect(sheet.getByRole('button', { name: /Día 1: Empuje/ })).toHaveAttribute('aria-expanded', 'true');
  await expect(sheet.getByRole('button', { name: /Día 2: Tirón/ })).toHaveAttribute('aria-expanded', 'true');
  await expect(sheet.getByRole('button', { name: /Día 3: Pierna/ })).toHaveAttribute('aria-expanded', 'true');
  const banca = sheet.getByTestId('gym-ex-row').filter({ hasText: 'Press de banca plano' });
  await expect(banca).toContainText('4 series × 2 min · Descanso 2 min');
  await expect(sheet.getByRole('list', { name: /Día 3 · Pierna/ }).getByTestId('gym-ex-row').first()).toBeVisible();

  // Los días se pliegan y despliegan.
  await sheet.getByRole('button', { name: /Día 1: Empuje/ }).click();
  await expect(banca).toHaveCount(0);
  await sheet.getByRole('button', { name: /Día 1: Empuje/ }).click();
  await expect(banca).toBeVisible();

  // «Listo» cierra sin cambiar nada.
  await sheet.getByRole('button', { name: 'Listo' }).click();
  await expect(detail(page)).toHaveCount(0);
  expect(await activeSplit(page)).not.toBe('ppl_3d');
});

test('desde la rutina completa se activa tras confirmarlo (y cancelar no cambia nada)', async ({ page }) => {
  await seedGym(page);
  await otherRoutines(page).scrollIntoViewIfNeeded();
  await otherRoutines(page).getByTestId('gym-other-row-fullbody_3d').click();
  await expect(detail(page).getByRole('heading', { name: 'Cuerpo completo' })).toBeVisible();

  await detail(page).getByRole('button', { name: 'Usar esta rutina' }).click();
  const alert = page.getByRole('alertdialog');
  await expect(alert).toContainText('¿Usar «Cuerpo completo»?');
  await alert.getByRole('button', { name: 'Cancelar' }).click();
  await expect(detail(page)).toBeVisible();
  expect(await activeSplit(page)).not.toBe('fullbody_3d');

  await detail(page).getByRole('button', { name: 'Usar esta rutina' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Usar rutina' }).click();
  await expect(detail(page)).toHaveCount(0);
  await expect.poll(() => activeSplit(page)).toBe('fullbody_3d');

  // Ahora la de antes es una de las «otras».
  await otherRoutines(page).scrollIntoViewIfNeeded();
  await expect(otherRoutines(page).getByTestId('gym-other-row-torso_pierna_4d')).toBeVisible();
  await expect(otherRoutines(page).getByTestId('gym-other-row-fullbody_3d')).toHaveCount(0);
});

test('la rutina en uso también se ve completa desde «Rutina de gimnasio», sin botón de activar', async ({ page }) => {
  await seedGym(page);
  await page.getByTestId('gym-hub').getByRole('button', { name: /Cambiar de rutina/ }).click();
  const modal = page.getByTestId('gym-routine-modal');
  await expect(modal).toBeVisible();
  await modal.getByTestId('gym-routine-row-torso_pierna_4d').click();
  const sheet = detail(page);
  await expect(sheet.getByText('Rutina en uso')).toBeVisible();
  await expect(sheet.getByTestId('gym-rd-day')).toHaveCount(5);
  await expect(sheet.getByRole('button', { name: 'Usar esta rutina' })).toHaveCount(0);
});
