import { test, expect, type Page } from '@playwright/test';
import { bootApp } from './support/bootApp';

// Periodo ya hecho: cuando todas las de este mes (o de hoy) están hechas, la sección enseña las del
// siguiente. Antes decía «Al día · Noviembre» con esas tareas abiertas debajo y no se entendía si
// estaban pendientes ahora. Ahora la sección empieza plegada con «Octubre hecho» y, al abrirla, dice
// para cuándo son las que se ven.
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

async function seed(page: Page) {
  await bootApp(page);
  await page.evaluate(() => {
    const st = (window as any).useAppStore.getState();
    const now = Date.now();
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const doneThisMonth = Math.max(startOfMonth.getTime() + 1, now - 60_000);
    const doneToday = Math.max(startOfDay.getTime() + 1, now - 60_000);
    const created = new Date(now - 90 * 86400000).toISOString();
    st.addList({ id: 'limpieza', name: 'Limpieza', color: '#34c759', listType: 'routines' });
    st.addList({ id: 'rutinas_hechas', name: 'Rutinas', color: '#007aff', listType: 'routines' });
    st.addListSection({ id: 'sec_limpieza_diaria', listId: 'limpieza', name: 'Diarias', order: 0 });
    st.addListSection({ id: 'sec_limpieza_mensual', listId: 'limpieza', name: 'Mensuales', order: 1 });
    st.addListSection({ id: 'sec_limp_cocina_m', listId: 'limpieza', name: 'Cocina', parentId: 'sec_limpieza_mensual', order: 0 });
    st.addListSection({ id: 'rh_diarias', listId: 'rutinas_hechas', name: 'Diarias', order: 0 });
    st.addListSection({ id: 'rh_manana', listId: 'rutinas_hechas', name: 'Mañana', parentId: 'rh_diarias', order: 0 });
    st.addListSection({ id: 'rh_noche', listId: 'rutinas_hechas', name: 'Noche', parentId: 'rh_diarias', order: 1 });
    const tasks: Record<string, any> = {};
    const add = (id: string, title: string, extra: Record<string, unknown>) => {
      tasks[id] = { id, user_id: 'local_guest_e2e', type: 'task', title, status: 'pending', created_at: created, updated_at: created, version: 1, ...extra };
    };
    add('pd_platos', 'Fregar los platos', { categoryId: 'limpieza', sectionId: 'sec_limpieza_diaria', cycle_id: 'cycle_day', duration: 15 });
    add('pd_horno', 'Limpiar el horno', { categoryId: 'limpieza', sectionId: 'sec_limp_cocina_m', cycle_id: 'cycle_month', duration: 40, completionHistory: [doneThisMonth] });
    add('pd_congelador', 'Descongelar el congelador', { categoryId: 'limpieza', sectionId: 'sec_limp_cocina_m', cycle_id: 'cycle_month', duration: 30, completionHistory: [doneThisMonth] });
    add('pd_agua', 'Beber un vaso de agua', { categoryId: 'rutinas_hechas', sectionId: 'rh_manana', cycle_id: 'cycle_day', duration: 1, completionHistory: [doneToday] });
    add('pd_estirar', 'Estirar', { categoryId: 'rutinas_hechas', sectionId: 'rh_manana', cycle_id: 'cycle_day', duration: 10, completionHistory: [doneToday] });
    add('pd_leer', 'Leer 20 minutos', { categoryId: 'rutinas_hechas', sectionId: 'rh_noche', cycle_id: 'cycle_day', duration: 20 });
    (window as any).useAppStore.setState((state: any) => ({ tasks: { ...state.tasks, ...tasks } }));
  });
}

const openView = (page: Page, view: string) =>
  page.evaluate((v) => window.dispatchEvent(new CustomEvent('select-view', { detail: v })), view);

test.use({ viewport: { width: 390, height: 844 } });

test('mes hecho: «Mensuales» empieza plegada y, al abrirla, dice para qué mes son las que se ven', async ({ page }) => {
  await seed(page);
  await openView(page, 'list_limpieza');
  const month = new Date().getMonth();
  const current = capitalize(MONTHS[month]);
  const next = MONTHS[(month + 1) % 12];

  const header = page.locator('.group-header', { has: page.locator('.section-head-title', { hasText: /^Mensuales$/ }) });
  await expect(header.locator('.section-head-period.is-done')).toHaveText(`${current} hecho`);
  const chevron = header.locator('.section-head-chevron');
  await expect(chevron).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByText('Limpiar el horno')).toHaveCount(0);
  // Ni duración ni recuento: nada en la cabecera parece pendiente de ahora.
  await expect(header.locator('.section-head-count')).toHaveCount(0);
  await expect(header).not.toContainText('min');
  // Lo pendiente de hoy sigue a la vista.
  await expect(page.getByText('Fregar los platos')).toBeVisible();

  await chevron.click();
  await expect(chevron).toHaveAttribute('aria-expanded', 'true');
  await expect(header).toContainText(`para ${next}`);
  // La lista es virtual: se baja hasta la sección para que sus filas se pinten.
  await page.locator('.content-scroll').evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
  const oven = page.locator('.task-item-wrapper[data-task-id="pd_horno"]');
  await expect(oven).toBeVisible();
  // Son las del mes que viene: aparecen sin marcar.
  await expect(oven.getByRole('button', { name: 'Completar tarea' })).toBeVisible();

  await chevron.click();
  await expect(chevron).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByText('Limpiar el horno')).toHaveCount(0);
});

test('día hecho en una subsección: «Hecho por hoy», plegada, y al abrir «estas son para mañana»', async ({ page }) => {
  await seed(page);
  await openView(page, 'list_rutinas_hechas');
  const morning = page.locator('.group-header', { has: page.locator('.section-head-title', { hasText: /^Mañana$/ }) });
  await expect(morning.locator('.section-head-period.is-done')).toHaveText('Hecho por hoy');
  await expect(morning.locator('.section-head-chevron')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByText('Estirar', { exact: true })).toHaveCount(0);
  // La otra subsección, con algo pendiente, sigue abierta.
  await expect(page.getByText('Leer 20 minutos')).toBeVisible();
  // Una sección con subsecciones no lleva una fila suelta de «Nuevo recordatorio» delante.
  await expect(page.locator('.empty-section-btn')).toHaveCount(0);

  await morning.locator('.section-head-chevron').click();
  await expect(morning.locator('.section-head-period')).toHaveText('Hecho por hoy, estas son para mañana');
  await expect(page.getByText('Estirar', { exact: true })).toBeVisible();
});

test('al marcar la última de la subsección se ve la marca y luego se recoge con «Hecho por hoy»', async ({ page }) => {
  await seed(page);
  await openView(page, 'list_rutinas_hechas');
  const night = page.locator('.group-header', { has: page.locator('.section-head-title', { hasText: /^Noche$/ }) });
  const reading = page.locator('.task-item-wrapper[data-task-id="pd_leer"]');
  await reading.getByRole('button', { name: 'Completar tarea' }).click();
  // Durante el momento de gracia la fila sigue a la vista (marcada) y la sección abierta.
  await expect(reading).toBeVisible();
  await expect(night.locator('.section-head-chevron')).toHaveAttribute('aria-expanded', 'true');
  // Después se recoge: el día está hecho y lo de debajo ya sería de mañana.
  await expect(night.locator('.section-head-chevron')).toHaveAttribute('aria-expanded', 'false', { timeout: 6000 });
  await expect(night.locator('.section-head-period.is-done')).toHaveText('Hecho por hoy');
  await expect(reading).toHaveCount(0);
});
