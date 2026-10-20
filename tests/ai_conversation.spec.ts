import { test, expect } from '@playwright/test';
import { bootApp } from './support/bootApp';

// La conversación real que salió mal: el asistente debe entender la petición, preguntar antes de
// crear, aplicar la corrección a la propuesta (no crear otra) y añadirla con un «sí».
test('el asistente entiende, pregunta, se deja corregir y añade con un «sí»', async ({ page }) => {
  await bootApp(page);
  await page.evaluate(() => {
    const st = (window as any).useAppStore.getState();
    st.addList({ id: 'care', name: 'Care', color: '#af52de', listType: 'routines' });
    st.addTask({ id: 'c1', title: 'Gimnasia facial', categoryId: 'care', status: 'pending', created_at: new Date().toISOString() });
    window.dispatchEvent(new CustomEvent('open-ai-assistant'));
  });
  const input = page.locator('input[placeholder*="Habla o escribe"]').first();
  await expect(input).toBeVisible();
  const say = async (text: string) => { await input.fill(text); await input.press('Enter'); };

  await say('Quiero añadir una vez al mes o así hacerme las cejas');
  await expect(page.getByText('¿Apunto «Hacerme las cejas» cada mes en Care?')).toBeVisible();

  await say('Pero adónde se supone que lo va a meter yo no quiero que lo meta la bandeja de entrada quiero que lo meta en la lista de Care');
  await expect(page.getByText('Cambiado. ¿Apunto «Hacerme las cejas» cada mes en Care?')).toBeVisible();
  // La propuesta anterior ya no se puede añadir: solo queda un botón.
  await expect(page.locator('[data-testid="ai-import-all-btn"]')).toHaveCount(1);

  await say('sí');
  await expect.poll(() => page.evaluate(() => Object.values((window as any).useAppStore.getState().tasks)
    .filter((t: any) => !t.deleted_at && t.categoryId === 'care' && t.title !== 'Gimnasia facial')
    .map((t: any) => `${t.title}|${t.cycle_id}`))).toEqual(['Hacerme las cejas|cycle_month']);
});
