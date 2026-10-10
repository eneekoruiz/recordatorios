import { describe, expect, it } from 'vitest';
import type { CustomList, ListSection, TaskItem } from '../../src/models/Task';
import { calculateRoutinePeriod, getRoutinePeriod, getRoutinePeriods } from '../../src/utils/routineAnalytics';

const now = new Date(2026, 9, 10, 14);
const stamp = (month: number, day: number) => new Date(2026, month, day, 12).getTime();
const task = (id: string, overrides: Partial<TaskItem> = {}): TaskItem => ({
  id, title: id, user_id: 'u', type: 'task', status: 'pending', categoryId: 'clean',
  cycle_id: 'cycle_week', created_at: new Date(2026, 7, 1).toISOString(),
  updated_at: now.toISOString(), version: 1, ...overrides,
});
const lists: CustomList[] = [{ id: 'clean', name: 'Limpieza', color: '#f00' }, { id: 'shop', name: 'Compras', color: '#00f' }];
const sections: ListSection[] = [
  { id: 'home', listId: 'clean', name: 'Casa' },
  { id: 'kitchen', listId: 'clean', parentId: 'home', name: 'Cocina' },
  { id: 'bath', listId: 'clean', parentId: 'home', name: 'Baño' },
  { id: 'food', listId: 'shop', name: 'Comida' },
];

describe('routine period analytics', () => {
  it('shows every local day, eight Monday weeks, twelve months and five years', () => {
    expect(getRoutinePeriods('day', new Date(2024, 1, 10))).toHaveLength(29);
    const weeks = getRoutinePeriods('week', now);
    expect(weeks).toHaveLength(8);
    expect(weeks.every(period => period.start.getDay() === 1)).toBe(true);
    expect(weeks[7].start).toEqual(new Date(2026, 9, 5));
    expect(getRoutinePeriods('month', now).map(period => period.start.getMonth())).toEqual(Array.from({ length: 12 }, (_, index) => index));
    expect(getRoutinePeriods('year', now).map(period => period.start.getFullYear())).toEqual([2022, 2023, 2024, 2025, 2026]);
  });

  it('uses exclusive next-period boundaries across year and month changes', () => {
    expect(getRoutinePeriod('week', new Date(2026, 0, 1)).start).toEqual(new Date(2025, 11, 29));
    expect(getRoutinePeriod('month', new Date(2026, 11, 31)).end).toEqual(new Date(2027, 0, 1));
    expect(getRoutinePeriod('day', new Date(2026, 9, 25)).end).toEqual(new Date(2026, 9, 26));
  });

  it('separates actual list and section results without turning a skipped week into completion', () => {
    const tasks = [
      task('cocina', { sectionId: 'kitchen', skipHistory: [stamp(9, 1)] }),
      task('baño', { sectionId: 'bath', completionHistory: [stamp(9, 2)] }),
      task('compra', { categoryId: 'shop', sectionId: 'food' }),
      task('general'),
    ];
    const result = calculateRoutinePeriod(tasks, 'week', new Date(2026, 9, 1), [], sections, lists, now);
    expect(result).toMatchObject({ total: 4, completed: 1, skipped: 3, automaticSkipped: 2, missed: 0, pending: 0, unknown: 0 });
    expect(result.groups).toHaveLength(4);
    expect(result.groups.find(group => group.sectionId === 'kitchen')).toMatchObject({ name: 'Casa / Cocina', listName: 'Limpieza', skipped: 1, automaticSkipped: 0, completed: 0 });
    expect(result.groups.find(group => group.sectionId === 'bath')?.tasks[0].status).toBe('completed');
    expect(result.groups.find(group => !group.sectionId)?.name).toBe('Sin sección');
  });

  it('counts historical repetitions independently of today’s reset currentCount', () => {
    const t = task('agua', { cycle_id: 'cycle_day', targetCount: 3, currentCount: 0, completionHistory: [stamp(9, 2)] });
    expect(calculateRoutinePeriod([t], 'day', new Date(2026, 9, 2), [], [], [], now).completed).toBe(1);
    expect(calculateRoutinePeriod([t], 'day', now, [], [], [], now).pending).toBe(1);
  });

  it('never fabricates omissions before creation and distinguishes unknown legacy history', () => {
    const tasks = [
      task('new', { created_at: new Date(2026, 9, 5).toISOString() }),
      task('legacy', { created_at: '' }),
      task('existed', { created_at: new Date(2026, 9, 1).toISOString() }),
      task('deleted', { deleted_at: now.toISOString() }),
      task('onboarding', { categoryId: 'primeros_pasos' }),
    ];
    const result = calculateRoutinePeriod(tasks, 'week', new Date(2026, 9, 1), [], [], [], now);
    expect(result).toMatchObject({ total: 2, unknown: 1, skipped: 1, automaticSkipped: 1, missed: 0 });
    expect(result.groups[0].tasks.map(item => item.task.id)).toEqual(['legacy', 'existed']);
  });

  it('keeps current pending, future unknown and monthly omissions in their own month', () => {
    const tasks = [task('mensual', { cycle_id: 'cycle_month', skipHistory: [stamp(8, 20)] })];
    expect(calculateRoutinePeriod(tasks, 'month', new Date(2026, 8, 1), [], [], [], now)).toMatchObject({ skipped: 1, automaticSkipped: 0, completed: 0, missed: 0 });
    expect(calculateRoutinePeriod(tasks, 'month', now, [], [], [], now)).toMatchObject({ skipped: 0, pending: 1 });
    expect(calculateRoutinePeriod(tasks, 'month', new Date(2026, 10, 1), [], [], [], now)).toMatchObject({ unknown: 1, missed: 0, pending: 0 });
  });

  it('recognizes inherited and aliased cycles and completion timestamps after resetting status', () => {
    const t = task('mensual', { cycle_id: undefined, sectionId: 'monthly', completed_at: new Date(stamp(9, 2)).toISOString() });
    const monthly: ListSection[] = [{ id: 'monthly', listId: 'clean', name: 'Mensuales' }];
    expect(calculateRoutinePeriod([t], 'month', now, [], monthly, lists, now).completed).toBe(1);
    expect(calculateRoutinePeriod([task('alias', { cycle_id: 'week' })], 'week', now, [], [], [], now).total).toBe(1);
  });

  it('prefers actual completion when both completion and omission are recorded', () => {
    expect(calculateRoutinePeriod([task('done', { completionHistory: [stamp(9, 7)], skipHistory: [stamp(9, 8)] })], 'week', now, [], [], [], now))
      .toMatchObject({ completed: 1, skipped: 0 });
  });

  it('derives an automatic omission only when the period closes without mutating history', () => {
    const t = task('mensual', { cycle_id: 'cycle_month' });
    const reference = new Date(2026, 9, 1);
    const beforeClose = new Date(2026, 9, 31, 23, 59, 59, 999);
    expect(calculateRoutinePeriod([t], 'month', reference, [], [], [], beforeClose))
      .toMatchObject({ pending: 1, skipped: 0, automaticSkipped: 0 });
    const result = calculateRoutinePeriod([t], 'month', reference, [], [], [], new Date(2026, 10, 1));
    expect(result).toMatchObject({ pending: 0, skipped: 1, automaticSkipped: 1, missed: 0 });
    expect(result.groups[0].tasks[0]).toMatchObject({ status: 'skipped', automatic: true });
    expect(t.skipHistory).toBeUndefined();
  });
});
