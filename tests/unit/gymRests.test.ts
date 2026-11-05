import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../src/store/useAppStore';
import { planGymRestsForSection, isGymTrainingDaySection, GYM_REST_ID_PREFIX } from '../../src/utils/gymRests';
import { createDefaultGymRoutine, createPplGymRoutine, createFullBodyGymRoutine, ensureAllGymRoutinesExist } from '../../src/utils/gymExercises';
import { deduplicateTaskList, findDuplicateTask } from '../../src/utils/taskDeduplication';
import type { TaskItem } from '../../src/models/Task';

const EPOCH = new Date(0).toISOString();
const day1 = { id: 'sec_d1', name: 'Día 1: Tren Superior A' };
const diaria = { id: 'sec_diaria', name: 'Diaria: Core y Estiramientos' };

const ex = (id: string, order: number | undefined, extra: Partial<TaskItem> = {}): TaskItem => ({
  id, title: `Ejercicio ${id}`, type: 'task', status: 'pending', categoryId: 'gimnasio', sectionId: day1.id,
  order, created_at: EPOCH, updated_at: EPOCH, version: 1, user_id: '', ...extra,
} as TaskItem);
const rest = (id: string, order: number, extra: Partial<TaskItem> = {}) =>
  ex(id, order, { title: 'Descanso entre ejercicios', isRest: true, duration: 2, ...extra });

/** Aplica el plan y devuelve la secuencia visible (orden manual) como letras: E = ejercicio, R = descanso. */
function applyAndShape(section: { id: string; name: string }, tasks: TaskItem[]): string {
  const plan = planGymRestsForSection(section, tasks, { listId: 'gimnasio', createdAt: EPOCH });
  const byId = new Map(tasks.map(t => [t.id, { ...t }]));
  plan.reorder.forEach(({ id, order }) => { byId.get(id)!.order = order; });
  plan.create.forEach(t => byId.set(t.id, t));
  plan.remove.forEach(id => { byId.get(id)!.deleted_at = '2026-01-01T00:00:00.000Z'; });
  return [...byId.values()]
    .filter(t => !t.deleted_at && t.sectionId === section.id)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map(t => (t.isRest ? 'R' : 'E')).join('');
}

describe('Gimnasio: descansos entre ejercicios', () => {
  it('pone un descanso entre CADA par de ejercicios, no solo entre el primero y el segundo', () => {
    const tasks = [ex('a', 0), ex('b', 1), ex('c', 2), ex('d', 3), ex('e', 4)];
    expect(applyAndShape(day1, tasks)).toBe('ERERERERE');
  });

  it('completa los huecos que faltan sin duplicar los que ya hay', () => {
    const tasks = [ex('a', 0), rest('r1', 0.5), ex('b', 1), ex('c', 2), rest('r3', 2.5), ex('d', 3)];
    const plan = planGymRestsForSection(day1, tasks, { listId: 'gimnasio' });
    expect(plan.create).toHaveLength(1);
    expect(plan.create[0].order).toBe(1.5);
    expect(applyAndShape(day1, tasks)).toBe('ERERERE');
  });

  it('funciona con órdenes repetidos o sin orden (renumera conservando lo que se ve)', () => {
    const tasks = [
      ex('a', undefined, { created_at: '2026-01-01T00:00:00.000Z' }),
      ex('b', undefined, { created_at: '2026-01-02T00:00:00.000Z' }),
      ex('c', 5, { created_at: '2026-01-03T00:00:00.000Z' }),
      ex('d', 5, { created_at: '2026-01-04T00:00:00.000Z' }),
    ];
    expect(applyAndShape(day1, tasks)).toBe('ERERERE');
  });

  it('funciona con órdenes fraccionarios y separados', () => {
    const tasks = [ex('a', 0.25), ex('b', 0.3), ex('c', 10), ex('d', 1000)];
    expect(applyAndShape(day1, tasks)).toBe('ERERERE');
  });

  it('nunca crea descansos en la sección diaria y quita los automáticos que quedaran', () => {
    const tasks = [
      ex('core', 0, { sectionId: diaria.id }), ex('estir', 1, { sectionId: diaria.id }), ex('abs', 2, { sectionId: diaria.id }),
      rest(`${GYM_REST_ID_PREFIX}${diaria.id}_0`, 0.5, { sectionId: diaria.id }),
      rest('descanso_mio', 1.5, { sectionId: diaria.id }),
    ];
    const plan = planGymRestsForSection(diaria, tasks, { listId: 'gimnasio' });
    expect(plan.create).toHaveLength(0);
    expect(plan.remove).toEqual([`${GYM_REST_ID_PREFIX}${diaria.id}_0`]);
    expect(isGymTrainingDaySection(diaria)).toBe(false);
    expect(isGymTrainingDaySection({ id: 'x', name: 'Día 4: Tren Inferior B + Core' })).toBe(true);
    expect(isGymTrainingDaySection({ id: 'sec_gym_ppl_push', name: 'Empuje' })).toBe(true);
  });

  it('no resucita un descanso que el usuario borró', () => {
    const tasks = [ex('a', 0), rest('r1', 0.5, { deleted_at: '2026-10-01T00:00:00.000Z' }), ex('b', 1), ex('c', 2)];
    const plan = planGymRestsForSection(day1, tasks, { listId: 'gimnasio' });
    expect(plan.create.map(t => t.order)).toEqual([1.5]);

    // Tampoco el creado automáticamente (misma id) si se borró.
    const auto = plan.create[0];
    const again = planGymRestsForSection(day1, [...tasks, { ...auto, deleted_at: '2026-10-02T00:00:00.000Z' }], { listId: 'gimnasio' });
    expect(again.create).toHaveLength(0);
  });

  it('las rutinas por defecto ya traen un descanso entre todos los ejercicios de cada día y ninguno en la diaria', () => {
    for (const r of [createDefaultGymRoutine(), createPplGymRoutine(), createFullBodyGymRoutine()]) {
      for (const sec of r.sections) {
        const plan = planGymRestsForSection(sec, r.tasks, { listId: 'gimnasio' });
        expect(plan.create, sec.name).toHaveLength(0);
        expect(plan.remove, sec.name).toHaveLength(0);
      }
    }
  });
});

describe('Gimnasio: los descansos no son duplicados', () => {
  beforeEach(() => {
    useAppStore.setState({ tasks: {}, lists: [{ id: 'gimnasio', name: 'Gimnasio' } as any], listSections: [] } as any);
  });

  it('se pueden crear varios descansos con el mismo título en la misma sección', () => {
    const st = useAppStore.getState();
    st.addTask(rest('r1', 0.5));
    st.addTask(rest('r2', 1.5));
    st.addTask(rest('r3', 2.5));
    const rests = Object.values(useAppStore.getState().tasks).filter(t => t.isRest);
    expect(rests).toHaveLength(3);
    expect(findDuplicateTask(rest('r4', 3.5), useAppStore.getState().tasks)).toBeNull();
  });

  it('la lista visible conserva todos los descansos (antes solo quedaba el primero)', () => {
    const list = [ex('a', 0), rest('r1', 0.5), ex('b', 1), rest('r2', 1.5), ex('c', 2)];
    expect(deduplicateTaskList(list).map(t => t.id)).toEqual(['a', 'r1', 'b', 'r2', 'c']);
  });

  it('ensureAllGymRoutinesExist no resucita lo borrado', () => {
    ensureAllGymRoutinesExist('gimnasio');
    const total = Object.keys(useAppStore.getState().tasks).length;
    const restsDay1 = Object.values(useAppStore.getState().tasks).filter(t => t.isRest && t.sectionId === 'sec_gym_sup_a');
    expect(restsDay1.length).toBeGreaterThan(1);
    useAppStore.getState().deleteTask(restsDay1[2].id);
    ensureAllGymRoutinesExist('gimnasio');
    expect(useAppStore.getState().tasks[restsDay1[2].id].deleted_at).toBeTruthy();
    expect(Object.keys(useAppStore.getState().tasks).length).toBe(total);
  });
  it('modificar la duracion de un descanso en Dia 1 altera el tiempo total agregado', async () => {
    ensureAllGymRoutinesExist('gimnasio');
    const store = useAppStore.getState();
    const day1Tasks = Object.values(store.tasks).filter(t => !t.deleted_at && t.sectionId === 'sec_gym_sup_a');
    const restTask = day1Tasks.find(t => t.isRest);
    expect(restTask).toBeDefined();

    const { calculateTasksDuration } = await import('../../src/utils/taskDuration');
    const durBefore = calculateTasksDuration(day1Tasks, store.listSections, store.lists);

    store.updateTask(restTask.id, { duration: (restTask.duration || 1) + 3 });

    const updatedTasks = Object.values(useAppStore.getState().tasks).filter(t => !t.deleted_at && t.sectionId === 'sec_gym_sup_a');
    const durAfter = calculateTasksDuration(updatedTasks, store.listSections, store.lists);

    expect(durAfter.activeMinutes).toBe(durBefore.activeMinutes + 3);
  });
});
