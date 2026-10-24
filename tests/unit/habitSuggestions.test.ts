import { describe, it, expect } from 'vitest';
import { detectHabitSuggestion } from '../../src/utils/habitSuggestions';

describe('detectHabitSuggestion', () => {
  it('detecta repeticiones numéricas diarias en el título', () => {
    const s1 = detectHabitSuggestion('Lavarse los dientes 3 veces al dia');
    expect(s1).not.toBeNull();
    expect(s1?.targetCount).toBe(3);
    expect(s1?.cycleId).toBe('cycle_day');
    expect(s1?.periodName).toBe('día');
    expect(s1?.cleanTitle).toBe('Lavarse los dientes');

    const s2 = detectHabitSuggestion('Lavarse las manos 4 veces al día');
    expect(s2).not.toBeNull();
    expect(s2?.targetCount).toBe(4);
    expect(s2?.cleanTitle).toBe('Lavarse las manos');

    const s3 = detectHabitSuggestion('Agua 10 veces al dia');
    expect(s3).not.toBeNull();
    expect(s3?.targetCount).toBe(10);
    expect(s3?.cleanTitle).toBe('Agua');
  });

  it('detecta números escritos en palabras en español', () => {
    const s1 = detectHabitSuggestion('Tomar medicina dos veces al día');
    expect(s1).not.toBeNull();
    expect(s1?.targetCount).toBe(2);
    expect(s1?.cleanTitle).toBe('Tomar medicina');

    const s2 = detectHabitSuggestion('Comer fruta tres veces por día');
    expect(s2).not.toBeNull();
    expect(s2?.targetCount).toBe(3);
    expect(s2?.cleanTitle).toBe('Comer fruta');
  });

  it('detecta vasos o repeticiones al día', () => {
    const s = detectHabitSuggestion('Beber agua 8 vasos al día');
    expect(s).not.toBeNull();
    expect(s?.targetCount).toBe(8);
    expect(s?.cleanTitle).toBe('Beber agua');
  });

  it('detecta repeticiones semanales', () => {
    const s = detectHabitSuggestion('Ir al gimnasio 3 veces por semana');
    expect(s).not.toBeNull();
    expect(s?.targetCount).toBe(3);
    expect(s?.cycleId).toBe('cycle_week');
    expect(s?.periodName).toBe('semana');
    expect(s?.cleanTitle).toBe('Ir al gimnasio');
  });

  it('ignora títulos sin múltiples repeticiones o que no son hábitos cuantificados', () => {
    expect(detectHabitSuggestion('Meditar una vez al día')).toBeNull(); // 1 vez no requiere contador de pasos
    expect(detectHabitSuggestion('50 curls y abs')).toBeNull();
    expect(detectHabitSuggestion('Fregar platos')).toBeNull();
    expect(detectHabitSuggestion('Comprar 3 manzanas')).toBeNull();
    expect(detectHabitSuggestion('')).toBeNull();
  });
});
