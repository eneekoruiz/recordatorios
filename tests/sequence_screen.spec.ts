import { test, expect } from '@playwright/test';
import { bootApp } from './support/bootApp';

// Cuenta atrás: una sola acción principal a la vista; sonido y «+1/+5/+10» plegados; lo que corre en segundo
// plano se ve aparte y se puede dar por terminado.
test.use({ viewport: { width: 390, height: 844 } });

test('pantalla de cuenta atrás: acciones plegadas y tareas en segundo plano con control', async ({ page }) => {
  await bootApp(page);
  await page.evaluate(() => {
    const st = (window as any).useAppStore.getState();
    st.addList({ id: 'colada', name: 'Colada', color: '#5ac8fa', listType: 'routines' });
    const now = new Date().toISOString();
    st.addTask({ id: 'c1', title: 'Poner la lavadora', categoryId: 'colada', duration: 5, isParallel: true, parallelDuration: 90, status: 'pending', created_at: now });
    st.addTask({ id: 'c2', title: 'Barrer la cocina', categoryId: 'colada', duration: 10, status: 'pending', created_at: now });
    window.dispatchEvent(new CustomEvent('select-view', { detail: 'list_colada' }));
  });
  await page.getByRole('button', { name: 'Empezar lista' }).first().click();

  // Tarea en paralelo: la acción principal es ponerla en marcha; nada de +1/+5/+10 ni de sonido a la vista.
  await expect(page.getByRole('heading', { name: 'Poner la lavadora' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Poner en marcha y seguir/ })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ 5 min' })).toHaveCount(0);
  await expect(page.getByRole('radio', { name: 'Lluvia' })).toHaveCount(0);

  // El tiempo y el sonido se abren a petición.
  await page.getByRole('button', { name: 'Cambiar tiempo' }).click();
  await expect(page.getByRole('button', { name: '+ 5 min' })).toBeVisible();
  await page.getByRole('button', { name: /Sonido ambiente/ }).click();
  await expect(page.getByRole('radio', { name: 'Lluvia' })).toBeVisible();
  await page.getByRole('radio', { name: 'Lluvia' }).click();
  await expect(page.getByRole('radio', { name: 'Lluvia' })).toHaveCount(0);

  // La lavadora sigue en segundo plano con su propio control.
  await page.getByRole('button', { name: /Poner en marcha y seguir/ }).click();
  await expect(page.getByRole('heading', { name: 'Barrer la cocina' })).toBeVisible();
  const background = page.getByLabel('En segundo plano');
  await expect(background).toContainText('Poner la lavadora');
  await background.getByRole('button', { name: /Dar por terminada/ }).click();
  await expect(background).toHaveCount(0);

  // Y la pantalla cabe sin desbordar.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
