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

describe('lenguaje natural — fechas y frecuencias más largas', () => {
  const day = (d?: Date) => (d ? `${d.getMonth() + 1}-${d.getDate()}` : undefined);
  const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return day(d); };

  it('«el 15 de octubre» (este año o el siguiente si ya pasó) y «antes del 20 de noviembre»', () => {
    const r = parseNaturalLanguage('Cumpleaños de mamá el 15 de octubre');
    expect(day(r.suggestedDueDate)).toBe('10-15');
    expect(r.cleanTitle).toBe('Cumpleaños de mamá');
    const past = parseNaturalLanguage('Vacaciones el 1 de enero');
    expect((past.suggestedDueDate as Date) >= new Date(new Date().setHours(0, 0, 0, 0))).toBe(true);
    expect(parseNaturalLanguage('Renovar pasaporte antes del 20 de noviembre').cleanTitle).toBe('Renovar pasaporte');
    expect(parseNaturalLanguage('Renovar pasaporte antes del 20 de noviembre').suggestedDueDate?.getDate()).toBe(20);
  });

  it('fechas con año y numéricas dd/mm/aaaa', () => {
    expect(parseNaturalLanguage('Boda el 3 de marzo de 2031').suggestedDueDate?.getFullYear()).toBe(2031);
    const r = parseNaturalLanguage('Reunión 3/11/2031 a las 10');
    expect(r.suggestedDueDate?.getFullYear()).toBe(2031);
    expect(r.cleanTitle).toBe('Reunión');
    expect(r.times).toEqual(['10:00']);
  });

  it('«en 3 días», «dentro de dos semanas», «la semana que viene»', () => {
    expect(day(parseNaturalLanguage('Entregar informe en 3 días').suggestedDueDate)).toBe(inDays(3));
    expect(day(parseNaturalLanguage('Quedar dentro de dos semanas').suggestedDueDate)).toBe(inDays(14));
    expect(day(parseNaturalLanguage('Llamar la semana que viene').suggestedDueDate)).toBe(inDays(7));
    expect(parseNaturalLanguage('Entregar informe en 3 días').cleanTitle).toBe('Entregar informe');
  });

  it('las frecuencias salen del título, pero no el adjetivo', () => {
    const d = parseNaturalLanguage('Regar plantas todos los días');
    expect(d.suggestedCycleId).toBe('cycle_day');
    expect(d.cleanTitle).toBe('Regar plantas');
    const m = parseNaturalLanguage('Pagar alquiler el 1 de cada mes');
    expect(m.suggestedCycleId).toBe('cycle_month');
    expect(m.suggestedDueDate?.getDate()).toBe(1);
    expect(m.cleanTitle).toBe('Pagar alquiler');
    expect(parseNaturalLanguage('Informe semanal').cleanTitle).toBe('Informe semanal');
  });

  it('«los lunes y jueves» es semanal y empieza en el próximo de esos días', () => {
    const r = parseNaturalLanguage('Correr los lunes y jueves a las 7');
    expect(r.suggestedCycleId).toBe('cycle_week');
    expect([1, 4]).toContain(r.suggestedDueDate?.getDay());
    expect(r.cleanTitle).toBe('Correr');
    expect(r.times).toEqual(['07:00']);
  });

  it('hora suelta, «esta noche» y «el próximo martes» sin dejar restos', () => {
    const t = parseNaturalLanguage('Dentista pasado mañana 9:30');
    expect(t.times).toEqual(['09:30']);
    expect(t.cleanTitle).toBe('Dentista');
    const n = parseNaturalLanguage('Llamar a Ana esta noche');
    expect(day(n.suggestedDueDate)).toBe(inDays(0));
    expect(n.cleanTitle).toBe('Llamar a Ana');
    expect(parseNaturalLanguage('Revisar coche el próximo martes').cleanTitle).toBe('Revisar coche');
  });

  it('importes con «euros» en mitad de la frase', () => {
    const a = parseNaturalLanguage('Pagar 45 euros de luz');
    expect(a.suggestedPrice).toBe(45);
    expect(a.cleanTitle).toBe('Pagar luz');
    const b = parseNaturalLanguage('Comprar regalo de unos 50 euros');
    expect(b.suggestedPrice).toBe(50);
    expect(b.cleanTitle).toBe('Comprar regalo');
    expect(parseNaturalLanguage('Comprar 2 kilos de patatas').suggestedPrice).toBeUndefined();
  });
});
