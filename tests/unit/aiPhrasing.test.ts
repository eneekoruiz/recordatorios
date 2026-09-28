import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { vi } from 'vitest';
import {
  normalizeSpokenPrompt, stripRequestFrames, isFillerOnly, asPriorityModifier,
  parseWeekdayPhrase, parseClockTime, tidyTitle, leadingInfinitive, isBareNounPhrase,
} from '../../src/utils/aiPhrasing';
import { AIService } from '../../src/services/AIService';

describe('aiPhrasing — piezas', () => {
  it('normaliza enumeraciones de días, precios unitarios y muletillas de enlace', () => {
    expect(normalizeSpokenPrompt('todos los lunes y miércoles a las 8 hacer ejercicio')).toContain('lunes/miércoles');
    expect(normalizeSpokenPrompt('cepillos que 3 euros cada uno')).toContain('3€');
    expect(normalizeSpokenPrompt('comprar pan, ah y también leche')).toBe('comprar pan, leche');
  });

  it('quita marcos conversacionales y deja lo que hay que hacer', () => {
    expect(stripRequestFrames('oye, cuando puedas recuérdame que tengo que llamar a mi madre')).toBe('llamar a mi madre');
    expect(stripRequestFrames('igual mañana debería comprar pan')).toBe('mañana comprar pan');
    expect(stripRequestFrames('no me dejes olvidar comprar pilas')).toBe('comprar pilas');
    // No toca frases normales.
    expect(stripRequestFrames('Reunión con Irantzu')).toBe('Reunión con Irantzu');
    expect(stripRequestFrames('Llamar al dentista')).toBe('Llamar al dentista');
  });

  it('distingue muletillas y modificadores de prioridad de las tareas reales', () => {
    for (const f of ['no sé', 'igual', 'ah', 'y también', 'bueno,']) expect(isFillerOnly(f), f).toBe(true);
    expect(isFillerOnly('comprar pan')).toBe(false);
    expect(asPriorityModifier('es urgente')).toBe('high');
    expect(asPriorityModifier('Que sea importante.')).toBe('high');
    expect(asPriorityModifier('es urgente llamar')).toBeNull();
  });

  it('interpreta días de la semana desde un lunes fijo', () => {
    const monday = new Date(2026, 8, 28, 10, 0); // lunes 28-sep-2026
    const thu = parseWeekdayPhrase('el jueves que viene', monday)!;
    expect(thu.date.getDay()).toBe(4);
    expect(thu.recurring).toBe(false);
    expect(parseWeekdayPhrase('antes del viernes', monday)!.date.getDay()).toBe(5);
    const rec = parseWeekdayPhrase('todos los lunes/miércoles', monday)!;
    expect(rec.recurring).toBe(true);
    expect(rec.days).toEqual(['lunes', 'miércoles']);
    expect(rec.date.getDay()).toBe(3); // hoy es lunes: el siguiente que toca es el miércoles
    expect(parseWeekdayPhrase('comprar pan', monday)).toBeNull();
  });

  it('interpreta horas habladas sin confundir la «h» de «hacer»', () => {
    expect(parseClockTime('a las 8 hacer ejercicio')).toMatchObject({ hour: 8, minute: 0, matched: 'a las 8' });
    expect(parseClockTime('sobre las 5')?.hour).toBe(17);
    expect(parseClockTime('a las 5 de la mañana')?.hour).toBe(5);
    expect(parseClockTime('a las 10:30')).toMatchObject({ hour: 10, minute: 30 });
    expect(parseClockTime('a las 9h')?.hour).toBe(9);
    expect(parseClockTime('a las 8 de la tarde')?.hour).toBe(20);
    expect(parseClockTime('sin hora')).toBeNull();
  });

  it('limpia títulos y detecta frases nominales', () => {
    expect(tidyTitle('comprar pan de')).toBe('comprar pan');
    expect(tidyTitle('llamar a mi madre por la tarde')).toBe('llamar a mi madre');
    expect(leadingInfinitive('comprar pan')).toBe('comprar');
    expect(leadingInfinitive('lugar seguro')).toBeNull();
    expect(isBareNounPhrase('cepillos de dientes')).toBe(true);
    expect(isBareNounPhrase('llamar al dentista')).toBe(false);
  });
});

describe('AIService.localSemanticExtract — frases enrevesadas', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 28, 10, 0)); // lunes
  });
  afterAll(() => vi.useRealTimers());

  const run = (text: string, lists: any[] = []) => AIService.localSemanticExtract(text, lists, {}).tasks;

  it('«oye, cuando puedas el jueves que viene por la tarde recuérdame que tengo que llamar a mi madre»', () => {
    const [t, ...rest] = run('oye, cuando puedas el jueves que viene por la tarde recuérdame que tengo que llamar a mi madre');
    expect(rest).toHaveLength(0);
    expect(t.title).toBe('Llamar a mi madre');
    expect(new Date(t.dueDate!).getDay()).toBe(4);
    expect(t.timeOfDay).toBe('afternoon');
  });

  it('comparte verbo, fecha y hora entre elementos y entiende «3 euros cada uno»', () => {
    const tasks = run('no sé, igual mañana sobre las 5 debería comprar pan y leche, ah y también cepillos de dientes que 3 euros cada uno');
    expect(tasks.map((t) => t.title)).toEqual(['Comprar pan', 'Comprar leche', 'Comprar cepillos de dientes']);
    for (const t of tasks) {
      expect(new Date(t.dueDate!).getDate()).toBe(29);
      expect(new Date(t.dueDate!).getHours()).toBe(17);
    }
    expect(tasks[2].price).toBe(3);
  });

  it('«es urgente» es la prioridad de la tarea anterior, no otra tarea; y entiende la lista pedida', () => {
    const lists = [{ id: 'trabajo', name: 'Trabajo' }];
    const tasks = run('apúntame en la lista de trabajo entregar el informe antes del viernes, es urgente', lists);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Entregar el informe');
    expect(tasks[0].listId).toBe('trabajo');
    expect(tasks[0].priority).toBe('high');
    expect(new Date(tasks[0].dueDate!).getDay()).toBe(5);
  });

  it('«todos los lunes y miércoles a las 8 hacer ejercicio» es una sola tarea semanal a las 8', () => {
    const tasks = run('todos los lunes y miércoles a las 8 hacer ejercicio');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Hacer ejercicio');
    expect(tasks[0].cycle).toBe('cycle_week');
    expect(tasks[0].description).toBe('Días: lunes y miércoles');
    expect(new Date(tasks[0].dueDate!).getHours()).toBe(8);
    expect(tasks[0].timeOfDay).toBe('morning');
  });

  it('una fecha dicha aparte completa la tarea anterior', () => {
    const tasks = run('Llamar al dentista, el viernes');
    expect(tasks).toHaveLength(1);
    expect(new Date(tasks[0].dueDate!).getDay()).toBe(5);
  });

  it('no altera las peticiones sencillas de siempre', () => {
    const tasks = run('Comprar pan por 1€, llamar al dentista mañana a las 10:00 y hacer ejercicio por la tarde');
    expect(tasks.map((t) => t.title)).toEqual(['Comprar pan', 'Llamar al dentista', 'Hacer ejercicio']);
    expect(tasks[0].price).toBe(1);
    expect(new Date(tasks[1].dueDate!).getHours()).toBe(10);
    expect(tasks[2].timeOfDay).toBe('afternoon');
  });
});
