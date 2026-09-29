import { describe, it, expect } from 'vitest';
import { buildRoutineParts, buildMixParts, describeRoutineParts } from '../../src/utils/routineBreakdown';
import type { TaskItem } from '../../src/models/Task';

const T = (id: string, o: Partial<TaskItem>): TaskItem => ({ id, title: id, status: 'pending', categoryId: 'casa', ...o } as TaskItem);

describe('reparto de la duración por frecuencia', () => {
  const tasks = [
    T('d', { cycle_id: 'cycle_day', duration: 15 }),
    T('w1', { cycle_id: 'cycle_week', duration: 40 }),
    T('w2', { cycle_id: 'cycle_week', duration: 30 }),
    T('m', { cycle_id: 'cycle_month', duration: 45 }),
    T('hecha', { cycle_id: 'cycle_month', duration: 99, status: 'completed' }),
  ];

  it('agrupa lo pendiente por frecuencia, de la más larga a la más corta, sin contar lo hecho', () => {
    const parts = buildRoutineParts(tasks);
    expect(parts.map((p) => [p.periodicity, p.count, p.minutes])).toEqual([
      ['month', 1, 45],
      ['week', 2, 70],
      ['day', 1, 15],
    ]);
  });

  it('se lee como una frase: «45 min mensuales + 1 h 10 min semanales + 15 min diarias»', () => {
    expect(describeRoutineParts(buildRoutineParts(tasks))).toBe('45 min mensuales + 1 h 10 min semanales + 15 min diarias');
  });
});

describe('reparto por tipo (puntuales y frecuencias)', () => {
  it('separa las puntuales de las frecuencias cuando hay mezcla con tiempo', () => {
    const parts = buildMixParts([
      T('hoy', { dueDate: new Date().toISOString(), duration: 10 }),
      T('d', { cycle_id: 'cycle_day', duration: 15 }),
      T('w', { cycle_id: 'cycle_week', duration: 50 }),
    ])!;
    expect(parts.map((p) => [p.periodicity, p.minutes])).toEqual([['none', 10], ['day', 15], ['week', 50]]);
    expect(describeRoutineParts(parts)).toBe('10 min puntuales + 15 min diarias + 50 min semanales');
  });

  it('no hay desglose si todo es del mismo tipo o solo un tipo tiene tiempo', () => {
    expect(buildMixParts([T('a', { duration: 10 }), T('b', { duration: 20 })])).toBeNull();
    expect(buildMixParts([T('a', { duration: 10 }), T('b', { cycle_id: 'cycle_day' })])).toBeNull();
  });
});
