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

  it('entrada vacía', () => {
    expect(parseNaturalLanguage('')).toEqual({ times: [], cleanTitle: '' });
  });
});
