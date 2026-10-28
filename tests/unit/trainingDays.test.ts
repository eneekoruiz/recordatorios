import { describe, it, expect } from 'vitest';
import { getTrainingDayPlan, orderTrainingSession } from '../../src/utils/trainingDays';
import { isSeriesTask, seriesDone, setLogProposal } from '../../src/utils/seriesTasks';
import type { ListSection, TaskItem } from '../../src/models/Task';

const DAY = 86400000;
const NOW = new Date('2026-10-28T18:00:00').getTime();
const sections: ListSection[] = [
  { id: 'd0', listId: 'gym', name: 'Diaria: Core y Estiramientos', order: 0 },
  { id: 'd1', listId: 'gym', name: 'Día 1: Tren Superior A', order: 1 },
  { id: 'd2', listId: 'gym', name: 'Día 2: Tren Inferior A', order: 2 },
  { id: 'd3', listId: 'gym', name: 'Día 3: Tren Superior B', order: 3 },
] as ListSection[];
const task = (id: string, sectionId: string, extra: Partial<TaskItem> = {}): TaskItem => ({
  id, user_id: 'u', type: 'task', title: id, status: 'pending', categoryId: 'gym', sectionId,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', ...extra,
}) as TaskItem;

describe('programa por días', () => {
  it('sin nada hecho toca el Día 1; el resto, siguiente u otro día', () => {
    const plan = getTrainingDayPlan('gym', sections, [task('a', 'd1'), task('b', 'd2'), task('c', 'd3')], NOW)!;
    expect(plan.currentId).toBe('d1');
    expect(plan.status).toEqual({ d1: 'today', d2: 'next', d3: 'later' });
    expect(plan.sharedSectionIds).toEqual(['d0']);
  });

  it('rota tras el último día entrenado (y vuelve al 1 tras el último)', () => {
    const tasks = [task('a', 'd1', { completionHistory: [NOW - 4 * DAY] }), task('b', 'd2', { completionHistory: [NOW - 2 * DAY] }), task('c', 'd3')];
    expect(getTrainingDayPlan('gym', sections, tasks, NOW)!.currentId).toBe('d3');
    tasks[2].completionHistory = [NOW - DAY];
    expect(getTrainingDayPlan('gym', sections, tasks, NOW)!.currentId).toBe('d1');
  });

  it('el día que se está entrenando hoy sigue siendo el de hoy, y al acabarlo dice «Hecho hoy»', () => {
    const partial = [task('a', 'd1', { targetCount: 4, currentCount: 2, updated_at: new Date(NOW - 3600000).toISOString() }), task('b', 'd1'), task('c', 'd2')];
    expect(getTrainingDayPlan('gym', sections, partial, NOW)!.status.d1).toBe('today');
    const done = [task('a', 'd1', { completionHistory: [NOW - 3600000] }), task('b', 'd1', { completionHistory: [NOW - 1800000] }), task('c', 'd2')];
    expect(getTrainingDayPlan('gym', sections, done, NOW)!.status.d1).toBe('done_today');
  });

  it('una lista sin días no es un programa', () => {
    expect(getTrainingDayPlan('gym', [sections[0]], [], NOW)).toBeNull();
  });

  it('«Empezar» hace lo común de antes, el día de hoy y los estiramientos de después', () => {
    const plan = getTrainingDayPlan('gym', sections, [], NOW)!;
    const order = orderTrainingSession(plan, [
      task('Estiramientos posteriores', 'd0'), task('Movilidad', 'd0'), task('Press', 'd1'), task('Sentadilla', 'd2'),
    ], sections).map(t => t.id);
    expect(order).toEqual(['Movilidad', 'Press', 'Estiramientos posteriores']);
  });
});

describe('ejercicios por series', () => {
  it('series de 2 a 12; un contador grande no son series', () => {
    expect(isSeriesTask(task('p', 'd1', { targetCount: 4 }))).toBe(true);
    expect(isSeriesTask(task('abs', 'd0', { targetCount: 50 }))).toBe(false);
    expect(isSeriesTask(task('x', 'd0'))).toBe(false);
  });

  it('las series de otro periodo no cuentan', () => {
    const t = task('p', 'd1', { targetCount: 4, currentCount: 4, updated_at: '2026-10-20T10:00:00Z' });
    expect(seriesDone(t, () => false)).toBe(0);
    expect(seriesDone({ ...t, currentCount: 2 }, () => true)).toBe(2);
  });

  it('peso: lo de la serie anterior de hoy escrito, lo de la última vez como pista', () => {
    const t = task('p', 'd1', { weightLogs: [
      { set: 2, weightKg: 55, reps: 8, date: new Date(NOW - 3 * DAY).toISOString() },
      { set: 1, weightKg: 60, reps: 8, date: new Date(NOW - 600000).toISOString() },
    ] });
    const { value, hint } = setLogProposal(t, 2, NOW);
    expect(value?.weightKg).toBe(60);
    expect(hint?.weightKg).toBe(55);
  });
});
