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

describe('lenguaje natural — horas y fechas coloquiales', () => {
  const ymd = (d?: Date) => (d ? `${d.getMonth() + 1}-${d.getDate()}` : undefined);

  it('horas con «h», «y media», «y cuarto», «menos cuarto» y cero inicial', () => {
    const a = parseNaturalLanguage('Cena con Ana el viernes a las 21h');
    expect(a.times).toEqual(['21:00']);
    expect(a.cleanTitle).toBe('Cena con Ana');
    expect(parseNaturalLanguage('Reunión a las 5 y media')).toMatchObject({ times: ['17:30'], cleanTitle: 'Reunión' });
    expect(parseNaturalLanguage('Reunión a las 5 y cuarto').times).toEqual(['17:15']);
    expect(parseNaturalLanguage('Salir a las 7 menos cuarto')).toMatchObject({ times: ['06:45'], cleanTitle: 'Salir' });
    expect(parseNaturalLanguage('Vuelo a las 06:45').times).toEqual(['06:45']);
    expect(parseNaturalLanguage('Vuelo a las 18h30').times).toEqual(['18:30']);
  });

  it('«hoy a las 10 pm» no se come la «y» de «hoy»', () => {
    const r = parseNaturalLanguage('Llamar a Pedro hoy a las 10 pm');
    expect(r.times).toEqual(['22:00']);
    expect(r.cleanTitle).toBe('Llamar a Pedro');
    expect(ymd(r.suggestedDueDate)).toBe(ymd(new Date()));
  });

  it('«7am», «21h» y rangos «de las 10 a las 11» como hora suelta', () => {
    const c = parseNaturalLanguage('Correr cada martes y jueves 7am');
    expect(c).toMatchObject({ times: ['07:00'], cleanTitle: 'Correr', suggestedCycleId: 'cycle_week' });
    expect(parseNaturalLanguage('Recoger paquete 18h').times).toEqual(['18:00']);
    const r = parseNaturalLanguage('Reunión de las 10 a las 11');
    expect(r.times).toEqual(['10:00']);
    expect(r.cleanTitle).toBe('Reunión');
    expect(parseNaturalLanguage('Comprar 3h de carbón').times).toEqual([]);
  });

  it('franjas: «mañana por la tarde», «el sábado a la noche»', () => {
    const t = parseNaturalLanguage('Ir al gimnasio mañana por la tarde');
    expect(t.times).toEqual(['17:00']);
    expect(t.cleanTitle).toBe('Ir al gimnasio');
    expect(parseNaturalLanguage('Reservar mesa el sábado a la noche')).toMatchObject({ times: ['21:00'], cleanTitle: 'Reservar mesa' });
    expect(parseNaturalLanguage('Correr por la mañana').times).toEqual([]);
  });

  it('«el jueves 3 de diciembre» manda el día del mes, no el jueves', () => {
    const r = parseNaturalLanguage('Dentista el jueves 3 de diciembre');
    expect(r.suggestedDueDate?.getMonth()).toBe(11);
    expect(r.suggestedDueDate?.getDate()).toBe(3);
    expect(r.cleanTitle).toBe('Dentista');
  });

  it('«el día 12», «el 1/12», «el último día del mes» y «el fin de semana»', () => {
    const d = parseNaturalLanguage('Cumple de Luis el día 12');
    expect(d.suggestedDueDate?.getDate()).toBe(12);
    expect(d.cleanTitle).toBe('Cumple de Luis');
    const s = parseNaturalLanguage('Ir al médico el 1/12 a las 9');
    expect(ymd(s.suggestedDueDate)).toBe('12-1');
    expect(s.times).toEqual(['09:00']);
    expect(s.cleanTitle).toBe('Ir al médico');
    expect(parseNaturalLanguage('Comprar 1/2 kilo de queso').suggestedDueDate).toBeUndefined();
    const l = parseNaturalLanguage('Pagar la hipoteca el último día del mes');
    const end = new Date(l.suggestedDueDate as Date);
    end.setDate(end.getDate() + 1);
    expect(end.getDate()).toBe(1);
    const f = parseNaturalLanguage('Hacer la compra el fin de semana');
    expect(f.suggestedDueDate?.getDay()).toBe(6);
    expect(f.cleanTitle).toBe('Hacer la compra');
  });

  it('«en 2 horas», «en 45 minutos» y «el próximo mes»', () => {
    const h = parseNaturalLanguage('Revisar correo en 2 horas');
    expect(h.cleanTitle).toBe('Revisar correo');
    expect(h.times).toHaveLength(1);
    const diff = (h.suggestedDueDate as Date).getTime() - Date.now();
    expect(Math.abs(diff - 2 * 3_600_000)).toBeLessThan(60_000);
    expect(parseNaturalLanguage('Quedar con Marta en 45 minutos').cleanTitle).toBe('Quedar con Marta');
    const m = parseNaturalLanguage('Renovar seguro el próximo mes');
    expect(m.cleanTitle).toBe('Renovar seguro');
    expect(m.suggestedDueDate).toBeDefined();
  });

  it('«todas las tardes» es diario y «antes del viernes» no deja «antes»', () => {
    expect(parseNaturalLanguage('Estudiar inglés todas las tardes')).toMatchObject({ suggestedCycleId: 'cycle_day', cleanTitle: 'Estudiar inglés' });
    expect(parseNaturalLanguage('Devolver libro antes del viernes').cleanTitle).toBe('Devolver libro');
  });
});
