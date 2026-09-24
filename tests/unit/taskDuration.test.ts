import { describe, it, expect } from 'vitest';
import { isParallelTask, getTaskDuration, formatDuration, calculateTasksDuration } from '../../src/utils/taskDuration';
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

    it('formats exact hours', () => {
      expect(formatDuration(60)).toBe('1h');
      expect(formatDuration(120)).toBe('2h');
      expect(formatDuration(180)).toBe('3h');
    });

    it('formats hours and minutes', () => {
      expect(formatDuration(75)).toBe('1h 15m');
      expect(formatDuration(150)).toBe('2h 30m');
      expect(formatDuration(195)).toBe('3h 15m');
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
      expect(summary.formattedParallel).toBe('2h 30m');
      expect(summary.formattedTotal).toBe('25 min (+ 2h 30m paralelo)');
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
      expect(summary.formattedActive).toBe('2h 55m');
    });
  });
});
