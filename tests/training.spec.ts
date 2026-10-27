import { test, expect, type Page } from '@playwright/test';
import { bootApp } from './support/bootApp';

test.use({ viewport: { width: 390, height: 844 } });

const open = async (page: Page) => {
  await bootApp(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('select-view', { detail: 'TRAINING' })));
  await expect(page.getByRole('heading', { name: 'Entrenamiento', level: 1 })).toBeVisible();
};

test('crear rutina, entrenar una sesión con descansos y guardarla', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /Nueva rutina/ }).click();
  await page.getByRole('button', { name: /Cuerpo completo/ }).click();
  await expect(page.getByRole('region', { name: 'Rutina en curso' })).toContainText('Cuerpo completo A');
  await page.getByRole('button', { name: 'Empezar Cuerpo completo A' }).click();
  await page.getByRole('button', { name: 'Empezar', exact: true }).click();

  // Serie 1: peso y repeticiones, completar → descanso programado con cuenta atrás.
  await expect(page.getByText('Serie 1 de 4')).toBeVisible();
  await page.getByRole('textbox', { name: 'Peso', exact: true }).fill('100');
  await page.getByRole('button', { name: 'Completar serie' }).click();
  const timer = page.getByRole('timer');
  await expect(timer).toBeVisible();
  await expect(page.getByText('2:30')).toBeVisible();
  await page.getByRole('button', { name: '+30 s' }).click();
  await expect(page.getByText(/^3:00$|^2:5\d$/)).toBeVisible();
  await page.getByRole('button', { name: '−15 s' }).click();
  await page.getByRole('button', { name: 'Saltar descanso' }).click();
  await expect(page.getByText('Serie 2 de 4')).toBeVisible();
  // Mantiene el peso de la serie anterior.
  await expect(page.getByRole('textbox', { name: 'Peso', exact: true })).toHaveValue('100');

  // Cambiar de ejercicio por un equivalente conserva las series.
  await page.getByRole('button', { name: 'Cambiar ejercicio' }).click();
  await page.getByRole('button', { name: /Prensa de piernas/ }).click();
  await expect(page.getByRole('heading', { name: 'Prensa de piernas' })).toBeVisible();

  await page.getByRole('button', { name: 'Completar serie' }).click();
  await page.getByRole('button', { name: 'Terminar entrenamiento' }).click();
  await expect(page.getByRole('heading', { name: 'Entrenamiento terminado' })).toBeVisible();
  await expect(page.getByText('Volumen').locator('..')).toContainText('kg');
  await page.getByRole('textbox').last().fill('Buen día');
  await page.getByRole('button', { name: 'Guardar' }).click();

  const stored = await page.evaluate(() => (window as any).useTrainingStore.getState());
  expect(stored.sessions).toHaveLength(1);
  expect(stored.sessions[0]).toMatchObject({ notes: 'Buen día', dayName: 'Cuerpo completo A' });
  expect(stored.sessions[0].tonnageKg).toBeGreaterThan(1000);
  expect(stored.activeSession).toBeNull();
  // La rutina avanza al siguiente día.
  expect(stored.routines[0].nextDayIndex).toBe(1);
  await expect(page.getByRole('region', { name: 'Rutina en curso' })).toContainText('Cuerpo completo B');
  await expect(page.getByText('Últimas sesiones')).toBeVisible();
});

test('una sesión sin terminar se puede retomar', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /Nueva rutina/ }).click();
  await page.getByRole('button', { name: /Torso \/ Pierna/ }).click();
  await page.getByRole('button', { name: 'Empezar Torso A' }).click();
  await page.getByRole('button', { name: 'Empezar', exact: true }).click();
  await page.getByRole('button', { name: 'Completar serie' }).click();
  await page.getByRole('button', { name: 'Salir del entrenamiento' }).click();
  await page.getByRole('button', { name: 'Salir y guardar el progreso' }).click();
  const banner = page.getByRole('region', { name: 'Entrenamiento sin terminar' });
  await expect(banner).toContainText('1 series hechas');
  await banner.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText('Serie 2 de 4')).toBeVisible();
});

test('rutinas: duplicar, activar otra, pausar y archivar', async ({ page }) => {
  await open(page);
  for (const name of [/Empuje · Tirón/, /Cuerpo completo/]) {
    await page.getByRole('button', { name: /Nueva rutina/ }).click();
    await page.getByRole('button', { name: name }).click();
  }
  const state = () => page.evaluate(() => (window as any).useTrainingStore.getState().routines.map((r: any) => `${r.name}:${r.status}`));
  expect(await state()).toEqual(['Empuje · Tirón · Pierna:active', 'Cuerpo completo:saved']);
  await page.getByRole('button', { name: 'Activar' }).first().click();
  expect(await state()).toEqual(['Empuje · Tirón · Pierna:saved', 'Cuerpo completo:active']);
  await page.getByRole('button', { name: 'Opciones de Cuerpo completo' }).first().click();
  await page.getByRole('menuitem', { name: 'Duplicar' }).click();
  expect((await state()).at(-1)).toBe('Cuerpo completo (copia):saved');
  await page.getByRole('button', { name: 'Opciones de Cuerpo completo' }).first().click();
  await page.getByRole('menuitem', { name: 'Pausar' }).click();
  expect((await state())[1]).toBe('Cuerpo completo:paused');
});

test('sugerencia por patrón: aceptar actualiza el descanso de la rutina', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /Nueva rutina/ }).click();
  await page.getByRole('button', { name: /Cuerpo completo/ }).click();
  // Ocho descansos de sentadilla en dos días, casi siempre alargados 60 s sobre los 150 programados.
  await page.evaluate(() => {
    const day = 86400000, now = Date.now();
    (window as any).useTrainingStore.getState().recordEvents(
      Array.from({ length: 8 }, (_, i) => ({ at: now - (i % 2) * day - i * 60000, scope: 'training', subjectId: 'sentadilla', type: 'rest_extended', value: 60, planned: 150 })));
  });
  const card = page.getByTestId('insight-card');
  await expect(card).toContainText('Sentadilla con barra');
  await expect(card).toContainText('3:30');
  await card.getByRole('button', { name: 'Aceptar' }).click();
  await expect(card).toHaveCount(0);
  const rest = await page.evaluate(() => (window as any).useTrainingStore.getState().routines[0].days[0].exercises.find((e: any) => e.exerciseId === 'sentadilla').restSec);
  expect(rest).toBe(210);
});

test('sugerencia sobre una tarea: «Más tarde» la esconde y «Ahora no» la calla', async ({ page }) => {
  await bootApp(page);
  await page.evaluate(() => {
    const st = (window as any).useAppStore.getState();
    st.addList({ id: 'casa', name: 'Casa', color: '#ff9500' });
    st.addTask({ id: 'suelo', title: 'Fregar el suelo', categoryId: 'casa', status: 'pending', created_at: new Date().toISOString() });
    const now = Date.now();
    (window as any).useTrainingStore.getState().recordEvents([0, 1, 2].map((i) => ({ at: now - i * 3600000, scope: 'task', subjectId: 'suelo', type: 'task_postponed' })));
    window.dispatchEvent(new CustomEvent('select-view', { detail: 'list_casa' }));
  });
  const card = page.getByTestId('insight-card');
  await expect(card).toContainText('«Fregar el suelo»');
  await card.getByRole('button', { name: 'Más tarde' }).click();
  await expect(card).toHaveCount(0);
  const insights = await page.evaluate(() => (window as any).useTrainingStore.getState().insights);
  expect(insights[0]).toMatchObject({ kind: 'move_to_start', status: 'snoozed' });
});
