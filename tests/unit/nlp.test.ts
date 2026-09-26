import { describe, it, expect } from 'vitest';
import { parseNaturalLanguage } from '../../src/utils/nlp';

describe('lenguaje natural', () => {
  it('extrae prioridad, lista y hora del ejemplo del onboarding', () => {
    const r = parseNaturalLanguage('Reunión mañana a las 10:00 !alta @Trabajo');
    expect(r.suggestedPriority).toBe('high');
    expect(r.suggestedCategory?.toLowerCase()).toBe('trabajo');
    expect(r.times).toContain('10:00');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(r.suggestedDueDate?.getDate()).toBe(tomorrow.getDate());
    expect(r.cleanTitle.toLowerCase()).toContain('reunión');
    expect(r.cleanTitle).not.toContain('!alta');
    expect(r.cleanTitle).not.toContain('@Trabajo');
  });

  it('no inventa datos en textos simples', () => {
    const r = parseNaturalLanguage('Comprar pan');
    expect(r.cleanTitle).toBe('Comprar pan');
    expect(r.suggestedPriority).toBeUndefined();
    expect(r.times).toHaveLength(0);
  });

  it('extrae precio en lenguaje natural', () => {
    const r = parseNaturalLanguage('Ropa interior 100 e');
    expect(r.suggestedPrice).toBe(100);
    expect(r.cleanTitle).toBe('Ropa interior');

    const r2 = parseNaturalLanguage('Zapatillas 200 e !alta');
    expect(r2.suggestedPrice).toBe(200);
    expect(r2.suggestedPriority).toBe('high');
    expect(r2.cleanTitle).toBe('Zapatillas');
  });

  it('entrada vacía', () => {
    expect(parseNaturalLanguage('')).toEqual({ times: [], cleanTitle: '' });
  });

  it('saca del título la fecha y la hora detectadas', () => {
    const r = parseNaturalLanguage('Reunión mañana a las 10:00 !alta @Trabajo');
    expect(r.cleanTitle).toBe('Reunión');
    expect(r.times).toEqual(['10:00']);
    expect(parseNaturalLanguage('Comprar pan para mañana').cleanTitle).toBe('Comprar pan');
    expect(parseNaturalLanguage('Llamar al médico el lunes a las 9').cleanTitle).toBe('Llamar al médico');
  });

  it('lee el precio aunque vaya seguido de una fecha', () => {
    const r = parseNaturalLanguage('Leche entera 1,20€ mañana a las 10:00 !alta');
    expect(r.cleanTitle).toBe('Leche entera');
    expect(r.suggestedPrice).toBe(1.2);
    expect(r.suggestedPriority).toBe('high');
    expect(r.suggestedDueDate).toBeDefined();
  });

  it('«de la mañana» o «por la mañana» no significan «mañana»', () => {
    const pastillas = parseNaturalLanguage('Tomar pastillas a las 9 de la mañana');
    expect(pastillas.suggestedDueDate).toBeUndefined();
    expect(pastillas.times).toEqual(['09:00']);
    expect(pastillas.cleanTitle).toBe('Tomar pastillas');
    expect(parseNaturalLanguage('Correr por la mañana').suggestedDueDate).toBeUndefined();
  });

  it('nunca deja el título vacío', () => {
    expect(parseNaturalLanguage('mañana a las 10').cleanTitle).toBe('mañana a las 10');
  });
});
