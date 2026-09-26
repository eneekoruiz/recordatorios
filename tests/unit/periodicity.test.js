import { describe, it, expect } from 'vitest';
import { routineRoundsOn, getEffectiveCycleId } from '../../shared/periodicity.js';

describe('rondas de rutina de un día', () => {
  it('las semanales tocan en su día; la mensual, el primero de esos días del mes; la anual, el de enero', () => {
    expect(routineRoundsOn({ month: 9, day: 26, weekday: 6 }, 6)).toEqual({ day: true, week: true, month: false, year: false });
    expect(routineRoundsOn({ month: 10, day: 3, weekday: 6 }, 6)).toEqual({ day: true, week: true, month: true, year: false });
    expect(routineRoundsOn({ month: 1, day: 2, weekday: 6 }, 6)).toEqual({ day: true, week: true, month: true, year: true });
    expect(routineRoundsOn({ month: 1, day: 1, weekday: 5 }, 6)).toEqual({ day: true, week: false, month: false, year: false });
  });

  it('respeta el día semanal elegido', () => {
    expect(routineRoundsOn({ month: 3, day: 2, weekday: 1 }, 1).month).toBe(true);
    expect(routineRoundsOn({ month: 3, day: 7, weekday: 6 }, 1).week).toBe(false);
  });
});

describe('frecuencia efectiva', () => {
  it('no se queda colgada con secciones que se apuntan entre sí', () => {
    const sections = [
      { id: 'a', listId: 'l', name: 'Cocina', parentId: 'b' },
      { id: 'b', listId: 'l', name: 'Baño', parentId: 'a' },
    ];
    expect(getEffectiveCycleId({ title: 'Barrer', sectionId: 'a' }, sections, [])).toBeNull();
  });
});
