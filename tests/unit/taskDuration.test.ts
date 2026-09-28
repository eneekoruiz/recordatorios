import { describe, it, expect } from 'vitest';
import { isParallelTask, formatDuration, calculateTasksDuration, getTaskDuration, isTaskDurationDisabled } from '../../src/utils/taskDuration';
import type { TaskItem } from '../../src/models/Task';

describe('TaskDuration & Parallel Tasks Engine', () => {
  describe('isParallelTask', () => {
    it('detects washing machine as parallel task', () => {
      expect(isParallelTask({ id: '1', title: 'Poner la lavadora con ropa blanca', status: 'pending', created_at: '', version: 1, user_id: 'u1', type: 'task' })).toBe(true);
      expect(isParallelTask({ id: '2', title: 'Lavar la ropa en la lavadora', status: 'pending', created_at: '', version: 1, user_id: 'u1', type: 'task' })).toBe(true);
    });

    it('detects dryer and dishwasher as parallel tasks', () => {
      expect(isParallelTask({ id: '3', title: 'Poner la secadora', status: 'pending', created_at: '', version: 1, user_id: 'u1', type: 'task' })).toBe(true);
      expect(isParallelTask({ id: '4', title: 'Poner lavavajillas', status: 'pending', created_at: '', version: 1, user_id: 'u1', type: 'task' })).toBe(true);
    });

    it('returns false for standard active tasks', () => {
      expect(isParallelTask({ id: '5', title: 'Fregar los platos', status: 'pending', created_at: '', version: 1, user_id: 'u1', type: 'task' })).toBe(false);
      expect(isParallelTask({ id: '6', title: 'Hacer la cama', status: 'pending', created_at: '', version: 1, user_id: 'u1', type: 'task' })).toBe(false);
    });
  });

  describe('formatDuration', () => {
    it('formats minutes under an hour', () => {
      expect(formatDuration(0)).toBe('0 min');
      expect(formatDuration(5)).toBe('5 min');
      expect(formatDuration(45)).toBe('45 min');
    });

    it('respeta los segundos por debajo de la hora', () => {
      expect(formatDuration(0.75)).toBe('45 s');
      expect(formatDuration(1.5)).toBe('1 min 30 s');
      expect(formatDuration(67 / 60)).toBe('1 min 7 s');
      expect(formatDuration(59 + 59 / 60)).toBe('59 min 59 s');
    });

    it('formats exact hours', () => {
      expect(formatDuration(60)).toBe('1 h');
      expect(formatDuration(120)).toBe('2 h');
      expect(formatDuration(180)).toBe('3 h');
    });

    it('formats hours and minutes', () => {
      expect(formatDuration(75)).toBe('1 h 15 min');
      expect(formatDuration(150)).toBe('2 h 30 min');
      expect(formatDuration(195)).toBe('3 h 15 min');
    });
  });

  describe('calculateTasksDuration', () => {
    it('calculates active and parallel duration correctly', () => {
      const tasks: TaskItem[] = [
        { id: '1', title: 'Hacer la cama', status: 'pending', created_at: '', version: 1, user_id: 'u1', type: 'task' }, // 5 min
        { id: '2', title: 'Fregar platos', status: 'pending', created_at: '', version: 1, user_id: 'u1', type: 'task' },  // 15 min
        { id: '3', title: 'Poner la lavadora', status: 'pending', created_at: '', version: 1, user_id: 'u1', type: 'task' }, // 5 min active, 150 min parallel
        { id: '4', title: 'Limpiar el polvo', status: 'completed', created_at: '', version: 1, user_id: 'u1', type: 'task' } // completed, ignored
      ];

      const summary = calculateTasksDuration(tasks);
      expect(summary.activeMinutes).toBe(25); // 5 + 15 + 5
      expect(summary.parallelMinutes).toBe(150); // 2h 30m
      expect(summary.parallelTasksCount).toBe(1);
      expect(summary.formattedActive).toBe('25 min');
      expect(summary.formattedParallel).toBe('2 h 30 min');
      expect(summary.formattedTotal).toBe('25 min (+ 2 h 30 min paralelo)');
    });

    it('calculates weekly routine cleaning to around 3 hours', () => {
      const weeklyTasks: TaskItem[] = [
        { id: '1', title: 'Aspirar toda la casa a fondo', status: 'pending', created_at: '', version: 1, user_id: 'u1', type: 'task' }, // 25
        { id: '2', title: 'Limpiar baño a fondo', status: 'pending', created_at: '', version: 1, user_id: 'u1', type: 'task' }, // 25
        { id: '3', title: 'Limpiar cocina a fondo', status: 'pending', created_at: '', version: 1, user_id: 'u1', type: 'task' }, // 25
        { id: '4', title: 'Cambiar sábanas de las camas', status: 'pending', created_at: '', version: 1, user_id: 'u1', type: 'task' }, // 25
        { id: '5', title: 'Limpiar microondas y nevera', status: 'pending', created_at: '', version: 1, user_id: 'u1', type: 'task' }, // 25
        { id: '6', title: 'Fregar a fondo los suelos', status: 'pending', created_at: '', version: 1, user_id: 'u1', type: 'task' }, // 25
        { id: '7', title: 'Limpiar cristales y espejos', status: 'pending', created_at: '', version: 1, user_id: 'u1', type: 'task' }, // 25
      ];

      const summary = calculateTasksDuration(weeklyTasks);
      expect(summary.activeMinutes).toBe(175); // ~2h 55m (aprox. 3 horas)
      expect(summary.formattedActive).toBe('2 h 55 min');
    });

    it('differentiates duration between solo annual tasks and full accumulated routine', () => {
      const annualOnlyTasks: TaskItem[] = [
        { id: 'a1', title: 'Limpieza a fondo detrás de electrodomésticos', status: 'pending', created_at: '', version: 1, user_id: 'u1', type: 'task', cycle_id: 'cycle_year', duration: 60 },
        { id: 'a2', title: 'Pintar rodapiés y retocar paredes', status: 'pending', created_at: '', version: 1, user_id: 'u1', type: 'task', cycle_id: 'cycle_year', duration: 60 },
      ];

      const monthlyTasks: TaskItem[] = [
        { id: 'm1', title: 'Descalcificar cafetera y hervidor', status: 'pending', created_at: '', version: 1, user_id: 'u1', type: 'task', cycle_id: 'cycle_month', duration: 45 },
        { id: 'm2', title: 'Limpiar filtros de campana y aire', status: 'pending', created_at: '', version: 1, user_id: 'u1', type: 'task', cycle_id: 'cycle_month', duration: 45 },
      ];

      const weeklyTasks: TaskItem[] = [
        { id: 'w1', title: 'Limpiar nevera por dentro', status: 'pending', created_at: '', version: 1, user_id: 'u1', type: 'task', cycle_id: 'cycle_week', duration: 30 },
        { id: 'w2', title: 'Aspirar sofás', status: 'pending', created_at: '', version: 1, user_id: 'u1', type: 'task', cycle_id: 'cycle_week', duration: 30 },
      ];

      const dailyTasks: TaskItem[] = [
        { id: 'd1', title: 'Fregar platos', status: 'pending', created_at: '', version: 1, user_id: 'u1', type: 'task', cycle_id: 'cycle_day', duration: 15 },
        { id: 'd2', title: 'Barrer la cocina', status: 'pending', created_at: '', version: 1, user_id: 'u1', type: 'task', cycle_id: 'cycle_day', duration: 15 },
      ];

      const accumulatedFullRoutine = [
        ...annualOnlyTasks,
        ...monthlyTasks,
        ...weeklyTasks,
        ...dailyTasks
      ];

      const soloDuration = calculateTasksDuration(annualOnlyTasks);
      const fullDuration = calculateTasksDuration(accumulatedFullRoutine);

      // Solo anuales: 120 mins = 2h
      expect(soloDuration.activeMinutes).toBe(120);
      expect(soloDuration.formattedActive).toBe('2 h');

      // Rutina acumulada: 120 + 90 + 60 + 30 = 300 mins = 5h
      expect(fullDuration.activeMinutes).toBe(300);
      expect(fullDuration.formattedActive).toBe('5 h');
      expect(fullDuration.activeMinutes).toBeGreaterThan(soloDuration.activeMinutes);
    });
  });

  describe('disableDuration (Desactivar duración por tarea)', () => {
    it('isTaskDurationDisabled detects disableDuration true or duration 0', () => {
      expect(isTaskDurationDisabled(null)).toBe(false);
      expect(isTaskDurationDisabled({ id: '1', title: 'Tarea normal', status: 'pending', created_at: '', version: 1, user_id: 'u1', type: 'task' })).toBe(false);
      expect(isTaskDurationDisabled({ id: '2', title: 'Tarea con 15m', status: 'pending', created_at: '', version: 1, user_id: 'u1', type: 'task', duration: 15 })).toBe(false);
      expect(isTaskDurationDisabled({ id: '3', title: 'Tarea desactivada flag', status: 'pending', created_at: '', version: 1, user_id: 'u1', type: 'task', disableDuration: true })).toBe(true);
      expect(isTaskDurationDisabled({ id: '4', title: 'Tarea con duracion 0', status: 'pending', created_at: '', version: 1, user_id: 'u1', type: 'task', duration: 0 })).toBe(true);
    });

    it('getTaskDuration returns 0 when disableDuration is true even for heuristic or parallel tasks', () => {
      const taskWithHeuristic: TaskItem = {
        id: 'h1',
        title: 'Limpiar baño a fondo', // Usually heuristic ~25m
        status: 'pending',
        created_at: '',
        version: 1,
        user_id: 'u1',
        type: 'task',
        disableDuration: true
      };
      const result = getTaskDuration(taskWithHeuristic);
      expect(result.activeMinutes).toBe(0);
      expect(result.parallelMinutes).toBe(0);
      expect(result.isParallel).toBe(false);

      const parallelTaskDisabled: TaskItem = {
        id: 'p1',
        title: 'Poner la lavadora con ropa blanca',
        status: 'pending',
        created_at: '',
        version: 1,
        user_id: 'u1',
        type: 'task',
        disableDuration: true
      };
      const resultParallel = getTaskDuration(parallelTaskDisabled);
      expect(resultParallel.activeMinutes).toBe(0);
      expect(resultParallel.parallelMinutes).toBe(0);
      expect(resultParallel.isParallel).toBe(false);
    });

    it('calculateTasksDuration ignores tasks with disableDuration true or duration 0', () => {
      const tasks: TaskItem[] = [
        { id: '1', title: 'Fregar platos', status: 'pending', created_at: '', version: 1, user_id: 'u1', type: 'task', duration: 15 },
        { id: '2', title: 'Aspirar alfombra', status: 'pending', created_at: '', version: 1, user_id: 'u1', type: 'task', duration: 25, disableDuration: true },
        { id: '3', title: 'Sacar basura', status: 'pending', created_at: '', version: 1, user_id: 'u1', type: 'task', duration: 0 }
      ];

      const summary = calculateTasksDuration(tasks);
      expect(summary.activeMinutes).toBe(15);
      expect(summary.formattedActive).toBe('15 min');
    });
  });
});
