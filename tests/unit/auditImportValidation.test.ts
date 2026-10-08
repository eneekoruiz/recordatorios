import { describe, expect, it } from 'vitest';
import { detectFormatAndParse } from '../../src/utils/importerParser';
import { validateJsonImport } from '../../src/utils/importValidation';

const parse = (text: string) => detectFormatAndParse(text, { cycles: [] });

describe('untrusted imports', () => {
  it('rejects incomplete JSON without turning it into a plain-text task', () => {
    expect(() => parse('{"tasks":[')).toThrow(/JSON/);
    expect(() => parse('[{"title":"A"}')).toThrow(/JSON/);
    expect(parse('[D] Limpiar').tasks[0].title).toBe('Limpiar');
  });
  it('rejects the whole JSON batch when one title has the wrong type', () => {
    expect(() => parse(JSON.stringify([{ title: 'Válida' }, { title: { bad: 'object' } }]))).toThrow(/elemento 2: campo title/);
  });
  it.each([
    { title: 'Tarea', description: [] }, { title: 'Tarea', people: [4] },
    { title: 'Tarea', status: 'broken' }, { title: 'Tarea', alerts: [{ id: 'a', type: 'at_time', time: '33:99' }] },
    { title: 'Tarea', dueDate: 'not-a-date' }, { title: 'Tarea', version: '5' },
    { title: 'Tarea', id: '__proto__' },
  ])('rejects malformed domain fields: %j', task => {
    expect(() => validateJsonImport([task])).toThrow();
  });
  it('normalizes legacy tasks and preserves rich typed fields', () => {
    const result = validateJsonImport({ tasks: { legacy: { title: 'Comprar', listId: 'casa', notes: 'Notas',
      price: 12.5, people: ['Ana'], completionHistory: [123], priority: 'high',
      location: { lat: 43, lng: -2, radius: 100, address: 'Bilbao' }, user_id: 'old-account', unknown: { bad: true },
    } } });
    expect(result.tasks[0]).toMatchObject({ id: 'legacy', user_id: '', categoryId: 'casa', description: 'Notas',
      status: 'pending', type: 'task', version: 1, price: 12.5, people: ['Ana'], priority: 'high' });
    expect(result.tasks[0]).not.toHaveProperty('unknown');
    expect(Number.isFinite(Date.parse(result.tasks[0].created_at))).toBe(true);
  });
  it('preserves skipHistory and consecutiveSkipCount during validation', () => {
    const result = validateJsonImport({
      tasks: {
        task1: {
          title: 'Regar plantas',
          skipHistory: [1700000000000],
          consecutiveSkipCount: 2,
        }
      }
    });
    expect(result.tasks[0].skipHistory).toEqual([1700000000000]);
    expect(result.tasks[0].consecutiveSkipCount).toBe(2);
  });
  it('rejects malformed lists and duplicate task identifiers before returning any tasks', () => {
    expect(() => validateJsonImport({ tasks: [{ title: 'A' }], lists: [{ id: 'x', name: {} }] })).toThrow(/Listas/);
    expect(() => validateJsonImport([{ id: 'same', title: 'A' }, { id: 'same', title: 'B' }])).toThrow(/duplicados/);
    expect(() => validateJsonImport({ tasks: { a: { id: 'b', title: 'A' } } })).toThrow(/no coincide/);
  });
});

describe('CSV and text fidelity', () => {
  it('imports Spanish thousands/decimal currency and a Spanish calendar date', () => {
    const task = parse('titulo;precio;fecha\nFactura;1.234,56 €;31/12/2026').tasks[0];
    expect(task.price).toBe(1234.56);
    const date = new Date(task.dueDate!);
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 11, 31]);
  });
  it('preserves newlines, commas and escaped quotes in a single record', () => {
    const result = parse('titulo,notas\r\n"Tarea","línea uno, con coma\nsegunda ""entre comillas"""');
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].description).toBe('línea uno, con coma\nsegunda "entre comillas"');
  });
  it('keeps state and duration from the app CSV export and supports US currency', () => {
    const task = parse('Título,Estado,Coste (€),Duración (seg)\nTarea,Completado,"1,234.56",90').tasks[0];
    expect(task).toMatchObject({ title: 'Tarea', status: 'completed', duration: 90, price: 1234.56 });
  });
  it.each(['titulo;fecha\nTarea;31/02/2026', 'titulo;precio\nTarea;1.2.34', 'titulo;notas\nTarea;"sin cierre'])('rejects a corrupt CSV field: %s', input => {
    expect(() => parse(input)).toThrow(/CSV/);
  });
  it('does not turn an empty CSV header into a task', () => {
    expect(parse('titulo,notas').tasks).toEqual([]);
  });
  it('uses a single new cycle for repeated references in one text batch', () => {
    const result = parse('Comprar #quincenal\nLimpiar #Quincenal');
    expect(result.cycles).toHaveLength(1);
    expect(result.tasks.map(task => task.cycle_id)).toEqual([result.cycles[0].id, result.cycles[0].id]);
  });
});
