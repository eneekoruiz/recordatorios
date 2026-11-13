import { test, expect, type Page } from '@playwright/test';
import { bootApp } from './support/bootApp';

// Gimnasio con días («Día 1», «Día 2»…): la lista dice qué día toca hoy y «Empezar» hace solo ese día,
// ejercicio a ejercicio y serie a serie: serie 1, descanso, serie 2, descanso… y descanso antes del siguiente.
test.use({ viewport: { width: 390, height: 844 } });

async function seedGym(page: Page, lastDay1At?: number) {
  await bootApp(page);
  await page.evaluate((lastDay1) => {
    const st = (window as any).useAppStore.getState();
    const created = new Date(Date.now() - 30 * 86400000).toISOString();
    st.addList({ id: 'gym', name: 'Gimnasio', color: '#ff3b30', listType: 'routines' });
    st.addListSection({ id: 'g_diaria', listId: 'gym', name: 'Diaria: Core y Estiramientos', order: 0 });
    st.addListSection({ id: 'g_d1', listId: 'gym', name: 'Día 1: Tren Superior A', order: 1 });
    st.addListSection({ id: 'g_d2', listId: 'gym', name: 'Día 2: Tren Inferior A', order: 2 });
    st.addListSection({ id: 'g_d3', listId: 'gym', name: 'Día 3: Tren Superior B', order: 3 });
    const tasks: Record<string, any> = {};
    const add = (id: string, title: string, extra: Record<string, unknown>) => {
      tasks[id] = { id, user_id: 'local_guest_e2e', type: 'task', title, status: 'pending', created_at: created, updated_at: created, version: 1, categoryId: 'gym', ...extra };
    };
    add('g_cal', 'Estiramientos previos', { sectionId: 'g_diaria', cycle_id: 'cycle_day', duration: 1, order: 0 });
    add('g_post', 'Estiramientos posteriores', { sectionId: 'g_diaria', cycle_id: 'cycle_day', duration: 1, order: 1 });
    add('g_banca', 'Press de banca', { sectionId: 'g_d1', cycle_id: 'cycle_week', duration: 1, targetCount: 3, currentCount: 0, restDuration: 60, order: 0,
      weightLogs: [{ set: 1, weightKg: 57.5, reps: 8, date: created }] });
    add('g_remo', 'Remo con barra', { sectionId: 'g_d1', cycle_id: 'cycle_week', duration: 1, targetCount: 2, currentCount: 0, restDuration: 45, order: 1 });
    add('g_sent', 'Sentadilla', { sectionId: 'g_d2', cycle_id: 'cycle_week', duration: 1, targetCount: 4, currentCount: 0, restDuration: 120, order: 0 });
    add('g_mil', 'Press militar', { sectionId: 'g_d3', cycle_id: 'cycle_week', duration: 1, targetCount: 3, currentCount: 0, restDuration: 90, order: 0 });
    if (lastDay1) {
      // El Día 1 se entrenó hace unos días: hoy toca el Día 2.
      tasks.g_banca.completionHistory = [lastDay1];
      tasks.g_remo.completionHistory = [lastDay1];
    }
    (window as any).useAppStore.setState((state: any) => ({ tasks: { ...state.tasks, ...tasks } }));
    window.dispatchEvent(new CustomEvent('select-view', { detail: 'list_gym' }));
  }, lastDay1At);
}

const header = (page: Page, title: RegExp) => page.locator('.group-header', { has: page.locator('.section-head-title', { hasText: title }) });

const hub = (page: Page) => page.getByTestId('gym-hub');

test('la tarjeta «Hoy» dice qué día toca: el de hoy abierto, los demás plegados y sin etiquetas repetidas', async ({ page }) => {
  await seedGym(page);
  await expect(hub(page).getByTestId('gym-hub-title')).toContainText('Día 1');
  await expect(hub(page)).toContainText('2 ejercicios');
  await expect(hub(page).getByRole('radio', { name: /^Día 1/ })).toHaveAttribute('aria-checked', 'true');
  await expect(hub(page).getByRole('radiogroup')).toHaveAttribute('aria-label', /0 de 3 hechos esta semana/);
  // Ninguna cabecera repite «Toca hoy» ni lleva «Hacer hoy».
  await expect(page.getByText('Toca hoy')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Hacer hoy' })).toHaveCount(0);
  await expect(page.getByText('Press de banca')).toBeVisible();
  await expect(page.getByText('Sentadilla')).toHaveCount(0);
  await expect(header(page, /^Día 2/).locator('.section-head-chevron')).toHaveAttribute('aria-expanded', 'false');

  // Abrir otro día a mano se respeta.
  await header(page, /^Día 2/).locator('.section-head-chevron').click();
  await expect(page.getByText('Sentadilla')).toBeVisible();
});

test('tocar otro día lo hace el de hoy (solo hoy) y se puede volver al que tocaba', async ({ page }) => {
  await seedGym(page);
  await hub(page).getByRole('radio', { name: /^Día 3/ }).click();
  await expect(hub(page).getByTestId('gym-hub-title')).toContainText('Día 3');
  await expect(page.getByText('Press militar')).toBeVisible();
  await expect(page.getByText('Press de banca')).toHaveCount(0);
  const setAt = await page.evaluate(() => (window as any).useAppStore.getState().lists.find((l: any) => l.id === 'gym').activeGymDaySetAt);
  expect(new Date(setAt).toDateString()).toBe(new Date().toDateString());
  await hub(page).getByRole('button', { name: 'Volver al que tocaba' }).click();
  await expect(hub(page).getByTestId('gym-hub-title')).toContainText('Día 1');
});

test('una elección de otro día ya no manda: vuelve la rotación', async ({ page }) => {
  await seedGym(page);
  await page.evaluate(() => (window as any).useAppStore.getState().updateList('gym', { activeGymDaySectionId: 'g_d3', activeGymDaySetAt: Date.now() - 2 * 86400000 }));
  await expect(hub(page).getByTestId('gym-hub-title')).toContainText('Día 1');
});

test('rotación: si el Día 1 se hizo otro día, hoy toca el Día 2', async ({ page }) => {
  await seedGym(page, Date.now() - 2 * 86400000);
  await expect(hub(page).getByTestId('gym-hub-title')).toContainText('Día 2');
  // El Día 1 se hizo hace dos días: si fue esta semana, cuenta como hecho.
  const sameWeek = await page.evaluate(() => { const d = new Date(); const day = (d.getDay() + 6) % 7; return day >= 2; });
  if (sameWeek) await expect(hub(page).getByRole('radio', { name: /^Día 1.*hecho esta semana/ })).toBeVisible();
});

test('«Empezar»: la cuenta atrás manda, el peso de cada serie se guarda al marcarla y la tabla se abre aparte', async ({ page }) => {
  await seedGym(page);
  const store = () => page.evaluate(() => {
    const t = (window as any).useAppStore.getState().tasks.g_banca;
    return [t.currentCount, (t.weightLogs || []).filter((l: any) => new Date(l.date).toDateString() === new Date().toDateString()).map((l: any) => [l.set, l.weightKg, l.reps])];
  });
  const goToBanca = async () => {
    const title = page.locator('h2').first();
    for (let i = 0; i < 6; i++) {
      await expect(title).not.toHaveText('');
      const current = await title.textContent();
      if (current === 'Press de banca') break;
      await page.getByRole('button', { name: 'Omitir tarea' }).click();
      await expect(title).not.toHaveText(current || '');
    }
    await expect(page.getByRole('heading', { name: 'Press de banca' })).toBeVisible();
  };
  await page.getByRole('button', { name: 'Empezar lista' }).first().click();
  await goToBanca();

  // Cuenta atrás de la serie en el centro, con lo de la última vez ya propuesto.
  await expect(page.getByRole('button', { name: /Pausar|Reanudar/ }).first()).toBeVisible();
  await expect(page.getByTestId('set-indicator')).toContainText('Serie 1 de 3');
  await expect(page.getByLabel('Kilos de la serie 1')).toHaveValue('57,5');
  await expect(page.getByTestId('sequence-next')).toContainText('serie 2');
  await page.getByLabel('Kilos de la serie 1').fill('60');
  await page.getByLabel('Repeticiones de la serie 1').fill('8');
  await page.getByRole('button', { name: 'Serie 1 hecha' }).click();

  // Guardado al momento; en el descanso se puede corregir y también se guarda.
  await expect.poll(store).toEqual([1, [[1, 60, 8]]]);
  await expect(page.getByTestId('set-rest')).toBeVisible();
  await page.getByLabel('Repeticiones de la serie 1').fill('9');
  await expect.poll(store).toEqual([1, [[1, 60, 9]]]);

  // Salir en mitad del descanso no pierde nada; al volver toca la serie 2 con el peso de la 1.
  await page.getByRole('button', { name: 'Salir del modo secuencia' }).click();
  await page.getByRole('button', { name: 'Empezar lista' }).first().click();
  await goToBanca();
  await expect(page.getByTestId('set-indicator')).toContainText('Serie 2 de 3');
  await expect(page.getByLabel('Kilos de la serie 2')).toHaveValue('60');

  // La tabla de todas las series, aparte; deshacer con peso apuntado pregunta.
  await page.getByRole('button', { name: 'Ver todas las series' }).click();
  const table = page.getByRole('dialog', { name: /^Entreno/ });
  const banca = table.getByRole('table', { name: 'Series de Press de banca' });
  await banca.getByRole('button', { name: 'Deshacer la serie 1' }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText('60 kg × 9');
  await confirm.getByRole('button', { name: 'Mantener' }).click();
  await table.getByRole('button', { name: /^Cerrar/ }).click();
  await expect(table).toHaveCount(0);
  await expect(page.getByTestId('set-indicator')).toContainText('Serie 2 de 3');
  await expect.poll(store).toEqual([1, [[1, 60, 9]]]);
});

test('cada ejercicio dice sus series, el descanso entre series y el total, sin «Semanal»', async ({ page }) => {
  await seedGym(page);
  const meta = page.getByTestId('series-duration').first().locator('xpath=..');
  // Press de banca: 3 series de 1 min con 1 min de descanso entre series → 3 + 2 = 5 min.
  await expect(page.getByTestId('series-duration').first()).toHaveAttribute('title', 'Duración: 3 series de 1 min, con 1 min de descanso entre series: 5 min en total');
  await expect(meta).toContainText('5 min');
  await expect(meta).not.toContainText('Semanal');
});
