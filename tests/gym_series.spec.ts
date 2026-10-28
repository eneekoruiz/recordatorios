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

test('la lista dice qué día toca: el de hoy abierto, los demás plegados', async ({ page }) => {
  await seedGym(page);
  await expect(header(page, /^Día 1/).getByTestId('training-day-badge')).toHaveText('Toca hoy');
  await expect(header(page, /^Día 2/).getByTestId('training-day-badge')).toHaveText('Siguiente');
  await expect(header(page, /^Día 3/).getByTestId('training-day-badge')).toHaveText('Otro día');
  await expect(page.getByText('Press de banca')).toBeVisible();
  await expect(page.getByText('Sentadilla')).toHaveCount(0);
  await expect(header(page, /^Día 2/).locator('.section-head-chevron')).toHaveAttribute('aria-expanded', 'false');

  // Abrir otro día a mano se respeta.
  await header(page, /^Día 2/).locator('.section-head-chevron').click();
  await expect(page.getByText('Sentadilla')).toBeVisible();
});

test('rotación: si el Día 1 se hizo otro día, hoy toca el Día 2', async ({ page }) => {
  await seedGym(page, Date.now() - 2 * 86400000);
  await expect(header(page, /^Día 2/).getByTestId('training-day-badge')).toHaveText('Toca hoy');
  await expect(header(page, /^Día 3/).getByTestId('training-day-badge')).toHaveText('Siguiente');
  await expect(header(page, /^Día 1/).getByTestId('training-day-badge')).toHaveText('Otro día');
});

test('«Empezar» va serie a serie con descansos y solo hace el día de hoy', async ({ page }) => {
  await seedGym(page);
  await page.getByRole('button', { name: 'Empezar lista' }).first().click();

  // Calentamiento común primero.
  await expect(page.getByRole('heading', { name: 'Estiramientos previos' })).toBeVisible();
  await page.getByRole('button', { name: 'Completar', exact: true }).click();

  // Press de banca: serie 1 → descanso → serie 2 → descanso → serie 3.
  await expect(page.getByRole('heading', { name: 'Press de banca' })).toBeVisible();
  await expect(page.getByTestId('set-indicator')).toContainText('Serie 1 de 3');
  await page.getByRole('button', { name: 'Serie 1 hecha' }).click();

  const rest = page.getByTestId('set-rest');
  await expect(rest).toBeVisible();
  await expect(rest).toContainText('Siguiente: Serie 2 de 3');
  await expect(rest.getByRole('timer')).toHaveAccessibleName(/Quedan 1:00|Quedan 0:59/);
  // Lo de la última vez, como pista; no se apunta si no se escribe.
  await expect(rest.getByLabel('Kilos de la serie 1')).toHaveAttribute('placeholder', '57.5');
  await expect(rest.getByLabel('Kilos de la serie 1')).toHaveValue('');
  await rest.getByLabel('Kilos de la serie 1').fill('60');
  await rest.getByLabel('Repeticiones de la serie 1').fill('8');
  await rest.getByRole('button', { name: 'Añadir 30 segundos' }).click();
  await expect(rest.getByRole('timer')).toHaveAccessibleName(/Quedan 1:(30|29)/);
  await rest.getByRole('button', { name: 'Saltar descanso' }).click();

  await expect(page.getByRole('heading', { name: 'Press de banca' })).toBeVisible();
  await expect(page.getByTestId('set-indicator')).toContainText('Serie 2 de 3');
  await page.getByRole('button', { name: 'Serie 2 hecha' }).click();
  await expect(rest).toContainText('Siguiente: Serie 3 de 3');
  // La serie anterior de hoy ya viene escrita (casi siempre se repite).
  await expect(rest.getByLabel('Kilos de la serie 2')).toHaveValue('60');
  await rest.getByRole('button', { name: 'Saltar descanso' }).click();
  await expect(page.getByTestId('set-indicator')).toContainText('Serie 3 de 3');
  await page.getByRole('button', { name: 'Serie 3 hecha' }).click();

  // Descanso de transición antes del siguiente ejercicio.
  await expect(rest).toContainText('Descanso antes del siguiente ejercicio');
  await expect(rest).toContainText('Siguiente: Remo con barra');
  await rest.getByRole('button', { name: 'Saltar descanso' }).click();

  await expect(page.getByRole('heading', { name: 'Remo con barra' })).toBeVisible();
  await expect(page.getByTestId('set-indicator')).toContainText('Serie 1 de 2');
  await page.getByRole('button', { name: 'Serie 1 hecha' }).click();
  await expect(rest).toContainText('Siguiente: Serie 2 de 2');
  await rest.getByRole('button', { name: 'Saltar descanso' }).click();
  await page.getByRole('button', { name: 'Serie 2 hecha' }).click();
  await expect(rest).toContainText('Siguiente: Estiramientos posteriores');
  await rest.getByRole('button', { name: 'Saltar descanso' }).click();

  // Los estiramientos de después, al final; la sentadilla (Día 2) no entra.
  await expect(page.getByRole('heading', { name: 'Estiramientos posteriores' })).toBeVisible();
  await page.getByRole('button', { name: 'Completar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Lista completada' })).toBeVisible();

  const state = await page.evaluate(() => {
    const t = (window as any).useAppStore.getState().tasks;
    return {
      banca: { count: t.g_banca.currentCount, doneToday: (t.g_banca.completionHistory || []).length, logs: t.g_banca.weightLogs.slice(1).map((l: any) => [l.set, l.weightKg, l.reps]) },
      remo: t.g_remo.currentCount,
      sentadilla: t.g_sent.currentCount || 0,
    };
  });
  expect(state.banca.count).toBe(3);
  expect(state.banca.doneToday).toBe(1);
  expect(state.banca.logs).toEqual([[1, 60, 8], [2, 60, 8], [3, 60, 8]]);
  expect(state.remo).toBe(2);
  expect(state.sentadilla).toBe(0);

  await page.getByRole('button', { name: 'Volver' }).click();
  await expect(header(page, /^Día 1/).getByTestId('training-day-badge')).toHaveText('Hecho hoy');
});
