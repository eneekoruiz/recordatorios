import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../src/store/useAppStore';
import type { TaskItem, CustomList, ListSection } from '../../src/models/Task';

/**
 * Reproduce el bug reportado por el usuario: la lista "Limpieza" mostraba dos
 * cabeceras "Diarias" (una vacía y otra con tareas) y dos "Semanales", porque las
 * tareas asignadas a una sección manual literalmente llamada "Diarias"/"Semanales"
 * se agrupaban en una clave distinta (`section_<id>`) a la de las tareas con
 * `cycle_id` (`cycle_<id>`), aunque representan la misma periodicidad.
 */
describe('getTasksByList — fusión de secciones manuales puramente periódicas', () => {
  const listId = 'list_limpieza';

  const baseTask = (overrides: Partial<TaskItem>): TaskItem => ({
    id: overrides.id || Math.random().toString(36).slice(2),
    user_id: 'u1',
    categoryId: listId,
    type: 'task',
    title: 'Tarea',
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: 1,
    ...overrides,
  } as TaskItem);

  beforeEach(() => {
    const lists: CustomList[] = [{ id: listId, name: 'Limpieza', color: '#34c759' }];
    const listSections: ListSection[] = [
      { id: 'sec_diarias', listId, name: 'Diarias', order: 0 },
      { id: 'sec_semanales', listId, name: 'Semanales', order: 1 },
      { id: 'sec_cocina', listId, name: 'Cocina', order: 2 },
    ];
    const tasks: Record<string, TaskItem> = {};

    // 3 tareas "legacy" asignadas a mano a la sección "Diarias" (sin cycle_id)
    for (let i = 0; i < 3; i++) {
      const t = baseTask({ id: `legacy_daily_${i}`, sectionId: 'sec_diarias', title: `Legacy diaria ${i}` });
      tasks[t.id] = t;
    }
    // 2 tareas nuevas con cycle_id de ciclo dinámico diario (sin sectionId)
    for (let i = 0; i < 2; i++) {
      const t = baseTask({ id: `cycle_daily_${i}`, cycle_id: 'cycle_day', title: `Ciclo diario ${i}` });
      tasks[t.id] = t;
    }
    // 1 tarea semanal asignada a la sección manual "Semanales"
    tasks['legacy_weekly_0'] = baseTask({ id: 'legacy_weekly_0', sectionId: 'sec_semanales', title: 'Legacy semanal' });

    // 2 tareas en una sección personalizada normal (no debe verse afectada)
    for (let i = 0; i < 2; i++) {
      const t = baseTask({ id: `cocina_${i}`, sectionId: 'sec_cocina', title: `Tarea cocina ${i}` });
      tasks[t.id] = t;
    }

    useAppStore.setState({ lists, listSections, tasks } as any);
  });

  it('fusiona las tareas de la sección manual "Diarias" con el cubo dinámico de ciclo diario', () => {
    const grouped = useAppStore.getState().getTasksByList(listId, true);

    // El cubo propio de la sección manual "Diarias" queda vacío (sigue existiendo,
    // preinicializado, pero sin tareas): todas se fusionan con el cubo del ciclo
    // dinámico equivalente, así que en el render (MainContent) nunca llega a
    // pintarse como una cabecera "Diarias" separada.
    expect(grouped['section_sec_diarias'] || []).toEqual([]);

    // El cubo dinámico diario contiene TODAS las diarias (legacy + nuevas): 3 + 2 = 5
    const dailyBucket = grouped['cycle_cycle_day'] || [];
    expect(dailyBucket.length).toBe(5);
    const dailyIds = dailyBucket.map(t => t.id).sort();
    expect(dailyIds).toEqual(['cycle_daily_0', 'cycle_daily_1', 'legacy_daily_0', 'legacy_daily_1', 'legacy_daily_2'].sort());
  });

  it('fusiona igualmente la sección manual "Semanales" con su ciclo dinámico', () => {
    const grouped = useAppStore.getState().getTasksByList(listId, true);
    expect(grouped['section_sec_semanales'] || []).toEqual([]);
    expect((grouped['cycle_cycle_week'] || []).map(t => t.id)).toEqual(['legacy_weekly_0']);
  });

  it('NO toca secciones personalizadas normales (p. ej. "Cocina")', () => {
    const grouped = useAppStore.getState().getTasksByList(listId, true);
    expect((grouped['section_sec_cocina'] || []).map(t => t.id).sort()).toEqual(['cocina_0', 'cocina_1']);
  });

  it('el total de tareas activas de la lista no cambia por la fusión (nadie se duplica ni se pierde)', () => {
    const grouped = useAppStore.getState().getTasksByList(listId, true);
    const total = Object.values(grouped).flat().length;
    expect(total).toBe(8); // 3 legacy diarias + 2 ciclo diarias + 1 semanal + 2 cocina
  });
});

describe('getTasksByCycle — aislamiento estricto de ciclos temporales', () => {
  it('no incluye una tarea padre anual en la vista diaria aunque su subtarea sea diaria', () => {
    const lists: CustomList[] = [{ id: 'limpieza', name: 'Limpieza', color: '#34c759' }];
    const parentTask: TaskItem = {
      id: 'parent_room_anual',
      user_id: 'u1',
      categoryId: 'limpieza',
      type: 'task',
      title: 'HABITACIÓN',
      cycle_id: 'cycle_year',
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
    } as TaskItem;

    const childTask: TaskItem = {
      id: 'child_hacer_cama_diaria',
      user_id: 'u1',
      categoryId: 'limpieza',
      type: 'task',
      title: 'Hacer la cama',
      cycle_id: 'cycle_day',
      parentId: 'parent_room_anual',
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
    } as TaskItem;

    useAppStore.setState({
      lists,
      listSections: [],
      tasks: {
        [parentTask.id]: parentTask,
        [childTask.id]: childTask,
      },
    } as any);

    const dailyGrouped = useAppStore.getState().getTasksByCycle('cycle_day', true);
    const allDailyTasks = Object.values(dailyGrouped).flat();

    // La subtarea diaria DEBE estar incluida en la vista diaria
    expect(allDailyTasks.some(t => t.id === 'child_hacer_cama_diaria')).toBe(true);

    // La tarea padre anual NO DEBE estar incluida en la vista diaria
    expect(allDailyTasks.some(t => t.id === 'parent_room_anual')).toBe(false);
  });
});
