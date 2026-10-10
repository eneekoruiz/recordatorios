import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAppStore } from '../../src/store/useAppStore';
import { isSkippedInCurrentPeriod, isCompletedInCurrentPeriod } from '../../src/services/TaskService';
import type { TaskItem } from '../../src/models/Task';

describe('Omitir tareas periódicas / por ciclo (Task Skip)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 10, 12));
    useAppStore.setState({
      tasks: {},
      cycles: [
        { id: 'cycle_day', name: 'Diario', daysValue: 1, isPinned: true, icon: 'sun' },
        { id: 'cycle_week', name: 'Semanal', daysValue: 7, isPinned: true, icon: 'calendar' },
        { id: 'cycle_month', name: 'Mensual', daysValue: 30, isPinned: true, icon: 'moon' },
        { id: 'cycle_year', name: 'Anual', daysValue: 365, isPinned: true, icon: 'globe' },
      ],
      tombstones: { lists: [], tasks: [], tags: [], sections: [], cycles: [], habits: [] },
    });
  });

  afterEach(() => vi.useRealTimers());

  it('detecta correctamente si una tarea está omitida en el período actual', () => {
    const now = new Date();
    const task: TaskItem = {
      id: 'task-month-1',
      title: 'Limpiar filtro aire',
      cycle_id: 'cycle_month',
      status: 'pending',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      skipHistory: [now.getTime()],
    };

    expect(isSkippedInCurrentPeriod(task, now)).toBe(true);
    // Para un mes anterior o posterior no debe constar como omitida
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    expect(isSkippedInCurrentPeriod(task, lastMonth)).toBe(false);
  });

  it('una tarea omitida en el período cuenta como resuelta/completada para ese período', () => {
    const now = new Date();
    const task: TaskItem = {
      id: 'task-month-2',
      title: 'Revisar caldera',
      cycle_id: 'cycle_month',
      status: 'pending',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      skipHistory: [now.getTime()],
    };

    // isCompletedInCurrentPeriod debe devolver true si está omitida en este período
    expect(isCompletedInCurrentPeriod(task, now)).toBe(true);
  });

  it('store.skipTask omite la tarea, añade fecha a skipHistory e incrementa consecutiveSkipCount', () => {
    const now = new Date();
    const initialTask: TaskItem = {
      id: 'task-month-3',
      title: 'Descalcificar cafetera',
      cycle_id: 'cycle_month',
      status: 'pending',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    useAppStore.setState({ tasks: { [initialTask.id]: initialTask } });

    // Primera omisión
    useAppStore.getState().skipTask(initialTask.id, false, now);

    let updated = useAppStore.getState().tasks[initialTask.id];
    expect(updated.skipHistory).toHaveLength(1);
    expect(updated.consecutiveSkipCount).toBe(1);
    expect(isSkippedInCurrentPeriod(updated, now)).toBe(true);

    // Deshacer omisión (reactivar)
    useAppStore.getState().skipTask(initialTask.id, true, now);

    updated = useAppStore.getState().tasks[initialTask.id];
    expect(updated.skipHistory).toHaveLength(0);
    expect(updated.consecutiveSkipCount).toBe(0);
    expect(isSkippedInCurrentPeriod(updated, now)).toBe(false);
  });

  it('acumula omisiones consecutivas si se omiten períodos sucesivos', () => {
    const baseDate = new Date(2026, 0, 15); // Enero 2026
    const initialTask: TaskItem = {
      id: 'task-month-4',
      title: 'Pintar zócalo',
      cycle_id: 'cycle_month',
      status: 'pending',
      consecutiveSkipCount: 1,
      skipHistory: [baseDate.getTime()],
      created_at: baseDate.toISOString(),
      updated_at: baseDate.toISOString(),
    };

    useAppStore.setState({ tasks: { [initialTask.id]: initialTask } });

    // Siguiente mes (Febrero 2026)
    const febDate = new Date(2026, 1, 15);
    vi.setSystemTime(febDate);
    useAppStore.getState().skipTask(initialTask.id, false, febDate);

    const updated = useAppStore.getState().tasks[initialTask.id];
    expect(updated.consecutiveSkipCount).toBe(2);
    expect(updated.skipHistory).toHaveLength(2);
  });

  it('completar la tarea resetea consecutiveSkipCount a 0 y limpia la omisión del período', () => {
    const now = new Date();
    const initialTask: TaskItem = {
      id: 'task-month-5',
      title: 'Revisar neumáticos',
      cycle_id: 'cycle_month',
      status: 'pending',
      consecutiveSkipCount: 4,
      skipHistory: [now.getTime()],
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    useAppStore.setState({ tasks: { [initialTask.id]: initialTask } });

    // El usuario la completa este mes
    useAppStore.getState().toggleTask(initialTask.id);

    const updated = useAppStore.getState().tasks[initialTask.id];
    expect(updated.consecutiveSkipCount).toBe(0);
    // skipHistory para el período actual se limpia al completarse de verdad
    expect(isSkippedInCurrentPeriod(updated, now)).toBe(false);
    expect(isCompletedInCurrentPeriod(updated, now)).toBe(true);
  });

  it('soporta ciclos semanales y diarios correctamente para omitir', () => {
    const now = new Date();
    const taskWeek: TaskItem = {
      id: 'task-week-1',
      title: 'Cambiar sábanas',
      cycle_id: 'cycle_week',
      status: 'pending',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    useAppStore.setState({ tasks: { [taskWeek.id]: taskWeek } });

    useAppStore.getState().skipTask(taskWeek.id, false, now);

    const updated = useAppStore.getState().tasks[taskWeek.id];
    expect(updated.consecutiveSkipCount).toBe(1);
    expect(isSkippedInCurrentPeriod(updated, now)).toBe(true);
    expect(isCompletedInCurrentPeriod(updated, now)).toBe(true);
  });

  it('determina si una tarea supera el umbral de aviso consecutivo (>= 2)', () => {
    const taskOnce: TaskItem = {
      id: 'task-w1',
      title: 'Podar setos',
      cycle_id: 'cycle_month',
      status: 'pending',
      consecutiveSkipCount: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const taskTwice: TaskItem = {
      id: 'task-w2',
      title: 'Revisar tejado',
      cycle_id: 'cycle_month',
      status: 'pending',
      consecutiveSkipCount: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    expect((taskOnce.consecutiveSkipCount || 0) >= 2).toBe(false);
    expect((taskTwice.consecutiveSkipCount || 0) >= 2).toBe(true);
  });

  it.each([
    ['cycle_day', new Date(2026, 9, 9, 12)],
    ['cycle_week', new Date(2026, 9, 2, 12)],
    ['cycle_month', new Date(2026, 8, 15, 12)],
  ])('registrar y restaurar una omisión histórica de %s conserva la tarea actual', (cycleId, pastDate) => {
    const now = new Date();
    const unrelatedDate = new Date(2026, 7, 1, 12).getTime();
    const task: TaskItem = {
      id: 'historical-skip', title: 'Limpiar', cycle_id: cycleId,
      status: 'completed', consecutiveSkipCount: 3,
      completed_at: now.toISOString(), completionHistory: [now.getTime()],
      skipHistory: [unrelatedDate],
      created_at: new Date(2026, 0, 1).toISOString(), updated_at: now.toISOString(),
    };
    useAppStore.setState({ tasks: { [task.id]: task } });

    useAppStore.getState().skipTask(task.id, false, pastDate);
    const omitted = useAppStore.getState().tasks[task.id];
    expect(omitted.skipHistory).toEqual([unrelatedDate, pastDate.getTime()]);
    expect(omitted.status).toBe('completed');
    expect(omitted.consecutiveSkipCount).toBe(3);
    expect(omitted.completed_at).toBe(task.completed_at);
    expect(omitted.completionHistory).toEqual(task.completionHistory);

    useAppStore.getState().skipTask(task.id, true, pastDate);
    const restored = useAppStore.getState().tasks[task.id];
    expect(restored.skipHistory).toEqual([unrelatedDate]);
    expect(restored.status).toBe('completed');
    expect(restored.consecutiveSkipCount).toBe(3);
    expect(restored.completed_at).toBe(task.completed_at);
    expect(restored.completionHistory).toEqual(task.completionHistory);

    useAppStore.getState().skipTask(task.id, true, pastDate);
    expect(useAppStore.getState().tasks[task.id]).toBe(restored);
  });

  it('omitir explícitamente dos veces el mismo período no duplica el historial ni el contador', () => {
    const now = new Date();
    const task: TaskItem = {
      id: 'idempotent-skip', title: 'Limpiar', cycle_id: 'cycle_week', status: 'pending',
      created_at: now.toISOString(), updated_at: now.toISOString(),
    };
    useAppStore.setState({ tasks: { [task.id]: task } });
    useAppStore.getState().skipTask(task.id, false, now);
    const omitted = useAppStore.getState().tasks[task.id];
    useAppStore.getState().skipTask(task.id, false, now);
    expect(useAppStore.getState().tasks[task.id]).toBe(omitted);
    expect(omitted.skipHistory).toEqual([now.getTime()]);
    expect(omitted.consecutiveSkipCount).toBe(1);
  });

  it('respeta períodos de ciclos personalizados al restaurar y no elimina omisiones de otros períodos', () => {
    const now = new Date();
    const monday = new Date(2026, 9, 5, 12);
    const previousWeek = new Date(2026, 9, 2, 12).getTime();
    const task: TaskItem = {
      id: 'custom-week-skip', title: 'Limpiar', cycle_id: 'custom_week', status: 'pending',
      consecutiveSkipCount: 2, skipHistory: [previousWeek, monday.getTime()],
      created_at: now.toISOString(), updated_at: now.toISOString(),
    };
    useAppStore.setState({ tasks: { [task.id]: task }, cycles: [
      ...useAppStore.getState().cycles, { id: 'custom_week', name: 'Cada semana', daysValue: 7, isPinned: false, icon: 'calendar' },
    ] });
    useAppStore.getState().skipTask(task.id, false, now);
    expect(useAppStore.getState().tasks[task.id]).toBe(task);
    useAppStore.getState().skipTask(task.id, true, now);
    expect(useAppStore.getState().tasks[task.id].skipHistory).toEqual([previousWeek]);
    expect(useAppStore.getState().tasks[task.id].consecutiveSkipCount).toBe(1);
  });
});

