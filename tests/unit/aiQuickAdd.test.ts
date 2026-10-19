import { describe, it, expect } from 'vitest';
import { buildTasksFromBatch, canAutoApply, isConversationalRequest, summarizeCreated, describeDay, plainReply } from '../../src/utils/aiQuickAdd';
import type { ProposedBatch, ProposedTask } from '../../src/services/AIService';
import type { CustomList } from '../../src/models/Task';

const lists: CustomList[] = [
  { id: 'inbox', name: 'Bandeja de entrada', color: '#007aff' },
  { id: 'compras', name: 'Compras', color: '#ff9500' },
  { id: 'limpieza', name: 'Limpieza', color: '#32ade6' },
];
const proposed = (title: string, extra: Partial<ProposedTask> = {}): ProposedTask => ({ title, listId: 'inbox', selected: true, ...extra } as ProposedTask);
const batch = (tasks: ProposedTask[], extra: Partial<ProposedBatch> = {}): ProposedBatch => ({ reply: 'Hecho', tasks, ...extra });

describe('isConversationalRequest', () => {
  it('las preguntas van al chat', () => {
    expect(isConversationalRequest('¿Qué tengo para hoy?')).toBe(true);
    expect(isConversationalRequest('qué tengo el viernes')).toBe(true);
    expect(isConversationalRequest('Cuándo era la ITV?')).toBe(true);
  });
  it('lo que hay que apuntar no', () => {
    expect(isConversationalRequest('Comprar pan mañana a las 10')).toBe(false);
    expect(isConversationalRequest('Poner la lavadora')).toBe(false);
    expect(isConversationalRequest('')).toBe(false);
  });
});

describe('canAutoApply', () => {
  it('crea directamente si solo hay recordatorios nuevos', () => {
    expect(canAutoApply(batch([proposed('Comprar pan')]))).toBe(true);
  });
  it('abre el chat si la IA pregunta, cambia algo existente o no propone nada', () => {
    expect(canAutoApply(batch([proposed('Algo')], { clarificationQuestions: ['¿Para cuándo?'] }))).toBe(false);
    expect(canAutoApply(batch([], { taskUpdates: [{ taskId: 'x', title: 'X', selected: true } as any] }))).toBe(false);
    expect(canAutoApply(batch([]))).toBe(false);
    expect(canAutoApply(batch([proposed('No', { selected: false })]))).toBe(false);
  });
});

describe('buildTasksFromBatch', () => {
  it('en una lista abierta, lo apuntado va a esa lista salvo que el texto nombre otra', () => {
    const b = batch([proposed('Pan', { listId: 'inbox' }), proposed('Lejía', { listId: 'limpieza' })]);
    const { tasks } = buildTasksFromBatch(b, lists, { defaultListId: 'compras', sourceText: 'pan y lejía' });
    expect(tasks.map(t => t.categoryId)).toEqual(['compras', 'compras']);

    const named = buildTasksFromBatch(b, lists, { defaultListId: 'compras', sourceText: 'pan, y lejía para limpieza' });
    expect(named.tasks.map(t => t.categoryId)).toEqual(['compras', 'limpieza']);
  });

  it('completa con los valores de la vista lo que la IA no da', () => {
    const b = batch([proposed('ITV'), proposed('Horno', { cycle: 'cycle_month', dueDate: '2026-11-01T10:00:00.000Z' })]);
    const { tasks } = buildTasksFromBatch(b, lists, { defaultDueDate: '2026-10-20T12:00:00.000Z', defaultCycleId: 'cycle_week' });
    expect(tasks[0].dueDate).toBe('2026-10-20T12:00:00.000Z');
    expect(tasks[0].cycle_id).toBe('cycle_week');
    expect(tasks[1].dueDate).toBe('2026-11-01T10:00:00.000Z');
    expect(tasks[1].cycle_id).toBe('cycle_month');
  });

  it('crea la lista que sugiere la IA si no existe', () => {
    const b = batch([proposed('Billetes')], { suggestedList: { name: 'Viaje a Roma' } });
    const { tasks, createList } = buildTasksFromBatch(b, lists, { newListId: () => 'list_roma' });
    expect(createList?.name).toBe('Viaje a Roma');
    expect(tasks[0].categoryId).toBe('list_roma');
  });

  it('sin lista válida usa la de reserva', () => {
    const { tasks } = buildTasksFromBatch(batch([proposed('X', { listId: 'no_existe' })]), lists, { fallbackListId: 'inbox' });
    expect(tasks[0].categoryId).toBe('inbox');
  });
});

describe('respuesta de la barra', () => {
  const now = new Date(2026, 9, 13, 17, 0);
  it('describe el día con palabras', () => {
    expect(describeDay(new Date(2026, 9, 13, 20).toISOString(), now)).toBe('hoy');
    expect(describeDay(new Date(2026, 9, 14, 10).toISOString(), now)).toBe('mañana');
    expect(describeDay(undefined, now)).toBeNull();
  });
  it('resume lo apuntado en una línea', () => {
    expect(summarizeCreated([{ title: 'Comprar pan', categoryId: 'compras', dueDate: new Date(2026, 9, 14, 10).toISOString() }], lists, now))
      .toBe('Apuntado «Comprar pan» en Compras · mañana');
    expect(summarizeCreated([{ title: 'Horno', categoryId: 'limpieza', cycle_id: 'cycle_month' }], lists, now))
      .toBe('Apuntado «Horno» en Limpieza · cada mes');
    expect(summarizeCreated([{ title: 'a', categoryId: 'compras' }, { title: 'b', categoryId: 'compras' }], lists, now))
      .toBe('Apuntados 2 recordatorios en Compras');
    expect(summarizeCreated([], lists, now)).toBe('Ya lo tenías apuntado.');
  });
  it('quita el marcado de la respuesta del modelo', () => {
    expect(plainReply('**Listo**: _añadido_ ')).toBe('Listo: añadido');
  });
});
