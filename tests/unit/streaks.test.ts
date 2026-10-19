import { describe, expect, it } from 'vitest';
import type { TaskItem } from '../../src/models/Task';
import { calculateSectionStreaks, calculateTaskStreak } from '../../src/utils/streaks';

// Sábado 10 de octubre de 2026 (semanas de lunes a domingo).
const now = new Date(2026, 9, 10, 12);
const lists = [{ id: 'casa', name: 'Casa', color: '#000' }];
const sections = [{ id: 'limp', listId: 'casa', name: 'Limpieza' }, { id: 'compras', listId: 'casa', name: 'Compras' }];
const task = (id: string, extra: Partial<TaskItem> = {}): TaskItem => ({
  id, user_id: '', title: id, type: 'task', status: 'pending', categoryId: 'casa', sectionId: 'limp',
  cycle_id: 'cycle_week', version: 1, created_at: new Date(2026, 5, 1).toISOString(), updated_at: now.toISOString(), ...extra,
});
/** Miércoles de la semana que está `weeksAgo` semanas antes de la actual. */
const week = (weeksAgo: number) => new Date(2026, 9, 7 - weeksAgo * 7, 10).getTime();
const day = (daysAgo: number) => new Date(2026, 9, 10 - daysAgo, 9).getTime();
const month = (monthsAgo: number) => new Date(2026, 9 - monthsAgo, 5, 9).getTime();

describe('racha de una tarea según su frecuencia', () => {
  it('cuenta semanas seguidas, no días', () => {
    const streak = calculateTaskStreak(task('aspirar', { completionHistory: [week(1), week(2), week(3)] }), sections, lists, [], now);
    expect(streak).toMatchObject({ count: 3, frequency: 'week', unit: 'semanas' });
  });
  it('la semana actual pendiente no la rompe y, si ya está hecha, suma', () => {
    expect(calculateTaskStreak(task('a', { completionHistory: [week(1), week(2)] }), sections, lists, [], now)?.count).toBe(2);
    expect(calculateTaskStreak(task('a', { completionHistory: [week(0), week(1), week(2)] }), sections, lists, [], now)?.count).toBe(3);
  });
  it('una omisión explícita hace de puente; un periodo sin marcar la corta', () => {
    expect(calculateTaskStreak(task('a', { completionHistory: [week(1), week(3)], skipHistory: [week(2)] }), sections, lists, [], now)?.count).toBe(2);
    expect(calculateTaskStreak(task('a', { completionHistory: [week(1), week(3)] }), sections, lists, [], now)?.count).toBe(1);
  });
  it('diarias en días y mensuales en meses', () => {
    expect(calculateTaskStreak(task('platos', { cycle_id: 'cycle_day', completionHistory: [day(1), day(2), day(3)] }), sections, lists, [], now))
      .toMatchObject({ count: 3, unit: 'días' });
    expect(calculateTaskStreak(task('cristales', { cycle_id: 'cycle_month', completionHistory: [month(1), month(2)] }), sections, lists, [], now))
      .toMatchObject({ count: 2, unit: 'meses' });
  });
  it('sin frecuencia no hay racha', () => {
    expect(calculateTaskStreak(task('suelta', { cycle_id: undefined }), [], [], [], now)).toBeNull();
  });
});

describe('rachas por sección', () => {
  it('una semana cuenta si todas sus tareas se hicieron u omitieron, y cada sección va aparte', () => {
    const streaks = calculateSectionStreaks([
      task('aspirar', { completionHistory: [week(1), week(2), week(3)] }),
      task('fregar', { completionHistory: [week(1), week(3)], skipHistory: [week(2)] }),
      task('lista', { sectionId: 'compras', completionHistory: [week(1)] }),
    ], [], sections, lists, now);
    expect(streaks).toHaveLength(1);
    expect(streaks[0]).toMatchObject({ label: 'Casa · Limpieza', frequency: 'week', count: 3, unit: 'semanas' });
  });
  it('una semana con una tarea sin marcar corta la racha de la sección', () => {
    const streaks = calculateSectionStreaks([
      task('aspirar', { completionHistory: [week(1), week(2), week(3)] }),
      task('fregar', { completionHistory: [week(1), week(3)] }),
    ], [], sections, lists, now);
    expect(streaks).toHaveLength(0);
  });
});
