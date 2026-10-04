import { describe, it, expect } from 'vitest';
import { calculateTasksDuration, calculateCompletedTasksDuration, getTaskDuration } from '../../src/utils/taskDuration';
import { VITAL_HABITS_LIST_ID } from '../../src/utils/vitalHabits';
import type { TaskItem } from '../../src/models/Task';

const mk = (over: Partial<TaskItem> & { id: string }): TaskItem => ({
  title: over.id,
  status: 'pending',
  created_at: '',
  version: 1,
  user_id: 'u1',
  type: 'task',
  categoryId: 'quehaceres',
  ...over,
} as TaskItem);

describe('motor de horas: totales exactos y reactivos', () => {
  it('30 min registrados devuelven 30 min, no 1,5 h', () => {
    const t = mk({ id: 'a', title: 'Hacer algo', duration: 30 });
    expect(calculateTasksDuration([t]).activeMinutes).toBe(30);
  });

  it('una tarea con duración propia no suma además sus subtareas (sin doble conteo)', () => {
    const parent = mk({ id: 'p', title: 'Limpiar espejos', duration: 10 });
    const kids = ['Espejo de mi cuarto', 'Espejo de la entrada', 'Espejo del baño'].map((title, i) =>
      mk({ id: `c${i}`, title, parentId: 'p' }));
    expect(calculateTasksDuration([parent, ...kids]).activeMinutes).toBe(10);
  });

  it('un contenedor sin tiempo propio solo aporta sus subtareas', () => {
    const parent = mk({ id: 'p', title: 'Rutina' });
    const kids = [mk({ id: 'c1', parentId: 'p', duration: 4 }), mk({ id: 'c2', parentId: 'p', duration: 6 })];
    expect(calculateTasksDuration([parent, ...kids]).activeMinutes).toBe(10);
  });

  it('tachar y destachar recalcula el restante al instante', () => {
    const a = mk({ id: 'a', duration: 20 });
    const b = mk({ id: 'b', duration: 15 });
    expect(calculateTasksDuration([a, b]).activeMinutes).toBe(35);
    const aDone = { ...a, status: 'completed' as const };
    expect(calculateTasksDuration([aDone, b]).activeMinutes).toBe(15);
    expect(calculateCompletedTasksDuration([aDone, b]).activeMinutes).toBe(20);
    expect(calculateTasksDuration([a, b]).activeMinutes).toBe(35);
  });

  it('respeta completed_at y las metas con contador, igual que la interfaz', () => {
    const doneByDate = mk({ id: 'd', duration: 12, completed_at: '2026-10-01T10:00:00.000Z' });
    const partialGoal = mk({ id: 'g', duration: 8, targetCount: 3, currentCount: 1 });
    expect(calculateTasksDuration([doneByDate, partialGoal]).activeMinutes).toBe(8);
  });

  it('los hábitos vitales no aportan tiempo aunque arrastren una duración', () => {
    const habit = mk({ id: 'h', title: 'Beber agua', categoryId: VITAL_HABITS_LIST_ID, duration: 5 });
    expect(getTaskDuration(habit).activeMinutes).toBe(0);
    expect(calculateTasksDuration([habit]).activeMinutes).toBe(0);
  });

  it('valores corruptos nunca producen NaN', () => {
    const bad = mk({ id: 'x', duration: Number.NaN });
    const total = calculateTasksDuration([bad]).activeMinutes;
    expect(Number.isFinite(total)).toBe(true);
  });
});
