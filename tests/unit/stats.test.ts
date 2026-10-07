import { describe, it, expect } from 'vitest';
import { completionTimestamps, completionsByDay, currentStreak, weeklySuccess, totals, bestStreak, timeOfDayDistribution, calculateCyclesBreakdown, calculateListBreakdown } from '../../src/utils/stats';
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

  it('calcula la mejor racha histórica', () => {
    // Finalizaciones en días: 5, 4, 3 (racha 3) y 1, 0 (racha 2)
    const tasks = [
      done('a', 5),
      done('b', 4),
      done('c', 3),
      done('d', 1),
      done('e', 0)
    ];
    expect(bestStreak(tasks)).toBe(3);
    expect(bestStreak([])).toBe(0);
  });

  it('calcula la distribución del momento del día', () => {
    const tasks = [
      T('m1', { completionHistory: [new Date(2026, 8, 29, 9, 0).getTime()] }),
      T('m2', { completionHistory: [new Date(2026, 8, 29, 10, 0).getTime()] }),
      T('t1', { completionHistory: [new Date(2026, 8, 29, 16, 0).getTime()] }),
    ];
    const dist = timeOfDayDistribution(tasks);
    expect(dist.morning).toBe(2);
    expect(dist.afternoon).toBe(1);
    expect(dist.night).toBe(0);
    expect(dist.peakPeriod).toBe('morning');
  });

  it('desglosa ciclos por periodicidad Diarias, Semanales, Mensuales y Anuales', () => {
    const tasks = [
      T('d1', { cycle_id: 'cycle_day', status: 'completed' }),
      T('d2', { cycle_id: 'cycle_day', status: 'pending' }),
      T('w1', { cycle_id: 'cycle_week', status: 'pending' }),
      T('m1', { cycle_id: 'cycle_month', status: 'completed' }),
      T('y1', { cycle_id: 'cycle_year', status: 'completed' }),
    ];
    const breakdown = calculateCyclesBreakdown(tasks, [], [], [], new Date(NOW));
    expect(breakdown.daily.total).toBe(2);
    expect(breakdown.daily.completed).toBe(1);
    expect(breakdown.daily.rate).toBe(50);
    expect(breakdown.weekly.total).toBe(1);
    expect(breakdown.weekly.completed).toBe(0);
    expect(breakdown.monthly.total).toBe(1);
    expect(breakdown.monthly.completed).toBe(1);
    expect(breakdown.yearly.total).toBe(1);
    expect(breakdown.yearly.completed).toBe(1);
    expect(breakdown.allRoutinesGoal).toBe(5);
    expect(breakdown.allRoutinesCompleted).toBe(3);
    expect(breakdown.allRoutinesRate).toBe(60);
  });

  it('desglosa el cumplimiento por lista', () => {
    const tasks = [
      T('t1', { categoryId: 'list_limpieza', status: 'completed' }),
      T('t2', { categoryId: 'list_limpieza', status: 'pending' }),
      T('t3', { categoryId: 'list_compras', status: 'completed' }),
    ];
    const lists = [
      { id: 'list_limpieza', name: 'Limpieza', color: '#007aff' } as any,
      { id: 'list_compras', name: 'Compras', color: '#34c759' } as any,
    ];
    const res = calculateListBreakdown(tasks, lists);
    expect(res).toHaveLength(2);
    const limp = res.find(r => r.listId === 'list_limpieza');
    expect(limp?.total).toBe(2);
    expect(limp?.completed).toBe(1);
    expect(limp?.rate).toBe(50);
  });
});
