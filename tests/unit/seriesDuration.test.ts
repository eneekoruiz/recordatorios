import { describe, it, expect } from 'vitest';
import { getTaskDuration, calculateTasksDuration, formatSeriesDuration } from '../../src/utils/taskDuration';
import { getSeriesBreakdown, formatRestSeconds, setWorkSeconds, setRestSeconds } from '../../src/utils/seriesTasks';
import type { TaskItem } from '../../src/models/Task';

const mk = (extra: Partial<TaskItem>): TaskItem => ({
  id: 'x', title: 'Press de banca', type: 'task', status: 'pending', user_id: '', version: 1,
  created_at: '2026-01-01T00:00:00.000Z', categoryId: 'gimnasio', sectionId: 'sec_gym_sup_a', ...extra,
} as TaskItem);

describe('Ejercicios por series: duración y texto', () => {
  it('total = series × trabajo + (series − 1) × descanso', () => {
    const t = mk({ targetCount: 4, duration: 2, restDuration: 120 });
    expect(getSeriesBreakdown(t)?.totalMinutes).toBe(4 * 2 + 3 * 2);
    expect(getTaskDuration(t).activeMinutes).toBe(14);
  });

  it('el texto muestra el descanso de cada pausa (no la suma) y el total', () => {
    const t = mk({ targetCount: 4, duration: 2, restDuration: 90 });
    const text = formatSeriesDuration(getSeriesBreakdown(t)!);
    expect(text.sets).toBe('4 × 2 min');
    expect(text.rest).toBe('descanso 90 s');
    expect(text.total).toBe('12 min 30 s');
    expect([text.sets, text.rest, text.total].join(' · ')).toBe('4 × 2 min · descanso 90 s · 12 min 30 s');
    expect(text.description).toBe('4 series de 2 min, con 90 s de descanso entre series: 12 min 30 s en total');
  });

  it('sin descanso entre series no se inventa uno', () => {
    const t = mk({ targetCount: 3, duration: 1, restDuration: 0 });
    const text = formatSeriesDuration(getSeriesBreakdown(t)!);
    expect(text.rest).toBeNull();
    expect(text.total).toBe('3 min');
    expect(getTaskDuration(t).activeMinutes).toBe(3);
  });

  it('un contador sin descanso declarado sigue siendo una duración total', () => {
    expect(getSeriesBreakdown(mk({ targetCount: 3, duration: 8 }))).toBeNull();
    expect(getTaskDuration(mk({ targetCount: 3, duration: 8 })).activeMinutes).toBe(8);
    expect(getSeriesBreakdown(mk({ targetCount: 50, duration: 5, restDuration: 60 }))).toBeNull();
  });

  it('el descanso se escribe como en el gimnasio', () => {
    expect(formatRestSeconds(45)).toBe('45 s');
    expect(formatRestSeconds(60)).toBe('1 min');
    expect(formatRestSeconds(75)).toBe('75 s');
    expect(formatRestSeconds(90)).toBe('90 s');
    expect(formatRestSeconds(120)).toBe('2 min');
    expect(formatRestSeconds(150)).toBe('2 min 30 s');
    expect(formatRestSeconds(180)).toBe('3 min');
    expect(formatRestSeconds(210)).toBe('3 min 30 s');
  });

  it('la lista, la cabecera del día y el modo «Empezar» dan la misma cifra', () => {
    const tasks = [
      mk({ id: 'a', targetCount: 4, duration: 2, restDuration: 120 }),
      mk({ id: 'b', targetCount: 3, duration: 1, restDuration: 90 }),
    ];
    const header = calculateTasksDuration(tasks).activeMinutes;
    const perTask = tasks.reduce((acc, t) => acc + getTaskDuration(t).activeMinutes, 0);
    // Misma cuenta que ListSequenceMode.sequenceMinutes con todas las series pendientes.
    const sequence = tasks.reduce((acc, t) => acc + (t.targetCount! * setWorkSeconds(t) + (t.targetCount! - 1) * setRestSeconds(t)) / 60, 0);
    expect(perTask).toBe(14 + 6);
    expect(header).toBe(perTask);
    expect(sequence).toBe(perTask);
  });
});
