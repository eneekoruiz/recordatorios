import { describe, expect, it } from 'vitest';
import type { TaskItem } from '../../src/models/Task';
import {
  formatRestSeconds,
  parseRepsFromDescription,
  resolveGymRoutineDays,
  splitGymDayName,
  summarizeExercise
} from '../../src/components/gym/gymRoutineData';
import { createDefaultGymRoutine } from '../../src/utils/gymExercises';

const task = (extra: Partial<TaskItem>): TaskItem => ({
  id: 't', user_id: '', type: 'task', title: 'Ejercicio', status: 'pending', version: 1, ...extra
} as TaskItem);

describe('rutinas de gimnasio: datos para verlas completas', () => {
  it('separa el nombre del día en etiqueta, enfoque y detalle', () => {
    expect(splitGymDayName('Día 1: Empuje (Pecho, Hombro, Tríceps)')).toEqual({ label: 'Día 1', focus: 'Empuje', detail: 'Pecho, Hombro, Tríceps' });
    expect(splitGymDayName('Dia 2: Tren Inferior A')).toEqual({ label: 'Día 2', focus: 'Tren Inferior A', detail: '' });
    expect(splitGymDayName('Diaria: Core y Estiramientos').label).toBe('');
  });

  it('resume series, repeticiones o tiempo y descanso', () => {
    expect(summarizeExercise(task({ targetCount: 4, duration: 2, restDuration: 120 }))).toMatchObject({ volume: '4 series × 2 min', rest: 'Descanso 2 min', sets: 4 });
    expect(summarizeExercise(task({ targetCount: 4, duration: 1, restDuration: 90, description: '4 series de 12-15 reps.' })).volume).toBe('4 × 12–15 reps');
    expect(summarizeExercise(task({ targetCount: 50, duration: 3 }))).toMatchObject({ volume: '50 repeticiones', rest: '', sets: 0 });
    expect(summarizeExercise(task({ duration: 5 })).volume).toBe('5 min');
    expect(formatRestSeconds(45)).toBe('45 s');
    expect(formatRestSeconds(75)).toBe('75 s');
    expect(parseRepsFromDescription('4 series pesadas en banco plano.')).toBe('');
  });

  it('enseña la plantilla de una rutina que aún no está en la lista, sin descansos', () => {
    const torso = createDefaultGymRoutine('');
    const tasks = Object.fromEntries(torso.tasks.map(t => [t.id, t]));
    const ppl = resolveGymRoutineDays('ppl_3d', 'gimnasio', torso.sections, tasks);
    expect(ppl.fromTemplate).toBe(true);
    expect(ppl.days.map(d => splitGymDayName(d.section.name).focus)).toEqual(['Empuje', 'Tirón', 'Pierna y Glúteo']);
    expect(ppl.days.every(d => d.exercises.length > 0 && d.exercises.every(t => !t.isRest))).toBe(true);
    expect(ppl.daily?.section.id).toBe('sec_gym_diaria');

    const own = resolveGymRoutineDays('torso_pierna_4d', 'gimnasio', torso.sections, tasks);
    expect(own.fromTemplate).toBe(false);
    expect(own.days).toHaveLength(4);
  });
});
