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

  it('la coma decimal de un precio no parte la tarea en dos', () => {
    const tasks = run('comprar pan, leche 1,20€ y huevos');
    expect(tasks.map((t) => t.title)).toEqual(['Comprar pan', 'Comprar leche', 'Comprar huevos']);
    expect(tasks[1].price).toBe(1.2);
  });

  it('un elemento con su propia fecha hereda el verbo: «pan y huevos mañana»', () => {
    const tasks = run('comprar pan y huevos mañana');
    expect(tasks.map((t) => t.title)).toEqual(['Comprar pan', 'Comprar huevos']);
    expect(new Date(tasks[1].dueDate!).getDate()).toBe(new Date(Date.now() + 86400000).getDate());
  });
});

describe('asistente local — frases más largas', () => {
  const run = (text: string) => AIService.localSemanticExtract(text, [], {}).tasks;
  const at = (iso?: string) => (iso ? new Date(iso) : undefined);

  it('«apunta comprar huevos y pan mañana»: sin «apunta» y con la fecha en los dos', () => {
    const tasks = run('apunta comprar huevos y pan mañana, llamar al médico el jueves por la tarde');
    expect(tasks.map((t) => t.title)).toEqual(['Comprar huevos', 'Comprar pan', 'Llamar al médico']);
    expect(at(tasks[0].dueDate)?.getDate()).toBe(at(tasks[1].dueDate)?.getDate());
    expect(tasks[0].dueDate).toBeDefined();
    expect(at(tasks[2].dueDate)?.getDay()).toBe(4);
  });

  it('«unos 50 euros» es el precio y «tengo boda de Marta» es «Boda de Marta»', () => {
    const tasks = run('recuérdame que el sábado tengo boda de Marta y hay que comprar un regalo de unos 50 euros');
    expect(tasks.map((t) => t.title)).toEqual(['Boda de Marta', 'Comprar un regalo']);
    expect(tasks[1].price).toBe(50);
    expect(at(tasks[0].dueDate)?.getDay()).toBe(6);
  });

  it('hábitos: «todas las mañanas» y «los domingos» no se quedan en el título ni se mezclan', () => {
    const tasks = run('todas las mañanas tomar vitaminas y los domingos limpiar el baño');
    expect(tasks.map((t) => t.title)).toEqual(['Tomar vitaminas', 'Limpiar el baño']);
    expect(tasks[0].cycle).toBe('cycle_day');
    expect(tasks[0].timeOfDay).toBe('morning');
    expect(tasks[1].cycle).toBe('cycle_week');
    expect(at(tasks[1].dueDate)?.getDay()).toBe(0);
  });

  it('un horario con horas: cada elemento conserva su hora y no hereda el verbo del anterior', () => {
    const tasks = run('mañana a las 8 reunión, a las 12 comer con Irantzu, a las 18 gimnasio');
    expect(tasks.map((t) => t.title)).toEqual(['Reunión', 'Comer con Irantzu', 'Gimnasio']);
    expect(tasks.map((t) => at(t.dueDate)?.getHours())).toEqual([8, 12, 18]);
    expect(new Set(tasks.map((t) => at(t.dueDate)?.getDate())).size).toBe(1);
  });

  it('fechas como «antes del 20 de noviembre», «el mes que viene» y «el 1 de cada mes»', () => {
    const a = run('tengo que renovar el pasaporte antes del 20 de noviembre');
    expect(a[0].title).toBe('Renovar el pasaporte');
    expect(at(a[0].dueDate)?.getDate()).toBe(20);
    const b = run('revisar el coche el mes que viene y pagar el seguro el 1 de cada mes');
    expect(b.map((t) => t.title)).toEqual(['Revisar el coche', 'Pagar el seguro']);
    expect(b[1].cycle).toBe('cycle_month');
    expect(at(b[1].dueDate)?.getDate()).toBe(1);
  });

  it('«lista de la compra: …» no crea una tarea con la cabecera', () => {
    const tasks = run('lista de la compra: manzanas, yogures 2,30€, detergente 5 euros');
    expect(tasks.map((t) => t.title)).toEqual(['Manzanas', 'Yogures', 'Detergente']);
    expect(tasks[1].price).toBe(2.3);
    expect(tasks[2].price).toBe(5);
  });
});
