import { describe, it, expect } from 'vitest';
import { parseRepRange, loadIncrement, suggestLoad, previousForSet } from '../../src/utils/gymProgression';
import type { TaskItem } from '../../src/models/Task';

const NOW = new Date('2026-11-13T18:00:00').getTime();
const DAY = 86400000;
const at = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();
const task = (extra: Partial<TaskItem>): TaskItem => ({
  id: 't', user_id: 'u', type: 'task', title: 'Press de banca', status: 'pending', targetCount: 3,
  description: '3 series de 8-12 reps', created_at: at(60), updated_at: at(60), ...extra,
}) as TaskItem;
const logs = (daysAgo: number, weight: number, reps: number[]) => reps.map((r, i) => ({ set: i + 1, weightKg: weight, reps: r, date: at(daysAgo) }));

describe('doble progresión', () => {
  it('lee el rango de repeticiones de la descripción', () => {
    expect(parseRepRange({ description: '4 series de 12-15 reps', title: '' })).toEqual({ min: 12, max: 15 });
    expect(parseRepRange({ description: '3 series de 10 a 12 repeticiones', title: '' })).toEqual({ min: 10, max: 12 });
    expect(parseRepRange({ description: '15 reps lentas', title: '' })).toEqual({ min: 15, max: 15 });
    expect(parseRepRange({ description: 'Calienta bien', title: '' })).toBeNull();
  });

  it('salto según el ejercicio', () => {
    expect(loadIncrement('Prensa de piernas')).toBe(5);
    expect(loadIncrement('Press de banca')).toBe(2.5);
    expect(loadIncrement('Elevaciones laterales')).toBe(1);
  });

  it('sin historial no inventa un peso', () => {
    const s = suggestLoad(task({}), NOW);
    expect(s.kind).toBe('first');
    expect(s.weightKg).toBeUndefined();
    expect(s.reps).toBe(8);
  });

  it('todas las series al máximo del rango: sube un salto y vuelve al mínimo', () => {
    const s = suggestLoad(task({ weightLogs: logs(3, 60, [12, 12, 12]) }), NOW);
    expect(s).toMatchObject({ kind: 'up', weightKg: 62.5, reps: 8 });
  });

  it('dentro del rango: mantiene el peso y pide una repetición más en la peor serie', () => {
    const s = suggestLoad(task({ weightLogs: logs(3, 60, [12, 10, 9]) }), NOW);
    expect(s).toMatchObject({ kind: 'same', weightKg: 60, reps: 10 });
  });

  it('una sesión incompleta (menos series) no cuenta como «todas al máximo»', () => {
    const s = suggestLoad(task({ weightLogs: logs(3, 60, [12, 12]) }), NOW);
    expect(s.kind).toBe('same');
  });

  it('dos sesiones seguidas sin llegar al mínimo: baja un 10 %', () => {
    const s = suggestLoad(task({ weightLogs: [...logs(10, 60, [7, 6, 6]), ...logs(3, 60, [7, 6, 5])] }), NOW);
    expect(s).toMatchObject({ kind: 'down', weightKg: 55 });
  });

  it('lo de hoy no cuenta como sesión anterior', () => {
    const s = suggestLoad(task({ weightLogs: [...logs(3, 60, [9, 9, 9]), ...logs(0, 62.5, [12, 12, 12])] }), NOW);
    expect(s).toMatchObject({ kind: 'same', weightKg: 60 });
  });

  it('«Anterior» de una serie: la misma serie de la última sesión', () => {
    expect(previousForSet(task({ weightLogs: logs(3, 60, [12, 10, 9]) }), 2, NOW)).toMatchObject({ weightKg: 60, reps: 10 });
  });
});
