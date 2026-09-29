import { describe, it, expect } from 'vitest';
import { completionTimestamps, completionsByDay, currentStreak, weeklySuccess, totals } from '../../src/utils/stats';
import type { TaskItem } from '../../src/models/Task';

const NOW = new Date(2026, 8, 29, 15, 0).getTime(); // martes 29-sep-2026 15:00
const at = (daysAgo: number, h = 10) => new Date(2026, 8, 29 - daysAgo, h, 0).getTime();
const T = (id: string, o: Partial<TaskItem>): TaskItem => ({ id, title: id, status: 'pending', categoryId: 'l', ...o } as TaskItem);
const done = (id: string, daysAgo: number) => T(id, { status: 'completed', completed_at: new Date(at(daysAgo)).toISOString() });

describe('estadísticas reales', () => {
  it('cuenta cada finalización una vez (historial + completed_at coincidente)', () => {
    const t = T('r', { status: 'completed', completed_at: new Date(at(0)).toISOString(), completionHistory: [at(2), at(1), at(0)] });
    expect(completionTimestamps(t)).toHaveLength(3);
    expect(completionTimestamps(T('borrada', { status: 'completed', completed_at: new Date(at(0)).toISOString(), deleted_at: new Date().toISOString() }))).toEqual([]);
  });

  it('reparte las finalizaciones por día, de más antiguo a hoy', () => {
    const days = completionsByDay([done('a', 0), done('b', 0), done('c', 2), done('vieja', 30)], 7, NOW);
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.count)).toEqual([0, 0, 0, 0, 1, 0, 2]);
  });

  it('la racha son días seguidos; hoy vacío no rompe la de ayer', () => {
    expect(currentStreak([done('a', 0), done('b', 1), done('c', 2), done('d', 4)], NOW)).toBe(3);
    expect(currentStreak([done('b', 1), done('c', 2)], NOW)).toBe(2);
    expect(currentStreak([done('d', 3)], NOW)).toBe(0);
    expect(currentStreak([], NOW)).toBe(0);
  });

  it('el éxito semanal compara lo hecho con lo vencido sin hacer; null si no hay nada', () => {
    const tasks = [
      done('a', 0), done('b', 1), done('c', 3),
      T('vencida', { dueDate: new Date(at(2)).toISOString() }),
      T('futura', { dueDate: new Date(at(-3)).toISOString() }),
      T('antigua', { dueDate: new Date(at(20)).toISOString() }),
    ];
    expect(weeklySuccess(tasks, NOW)).toEqual({ rate: 75, done: 3, missed: 1 });
    expect(weeklySuccess([], NOW).rate).toBeNull();
  });

  it('los totales suman finalizaciones y pendientes', () => {
    expect(totals([done('a', 0), T('p', {}), T('q', {})])).toEqual({ completed: 1, pending: 2 });
  });
});
