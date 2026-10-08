import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../src/store/useAppStore';
import { isSkippedInCurrentPeriod, isCompletedInCurrentPeriod } from '../../src/services/TaskService';
import type { TaskItem } from '../../src/models/Task';

describe('Omitir tareas periódicas / por ciclo (Task Skip)', () => {
  beforeEach(() => {
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
});

