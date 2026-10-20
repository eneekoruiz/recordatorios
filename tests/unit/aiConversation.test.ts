import { describe, it, expect } from 'vitest';
import { AIService, type ProposedTask } from '../../src/services/AIService';
import type { CustomList, TaskItem } from '../../src/models/Task';

// La conversación real que falló: «Quiero añadir una vez al mes o así hacerme las cejas» acabó en la
// bandeja con el título «Añadir una vez al mes o así hacer…», y la corrección («no en la bandeja, en
// Care») creó otro recordatorio con la queja como título.
const lists: CustomList[] = [
  { id: 'care', name: 'Care', color: '#af52de' },
  { id: 'limpieza', name: 'Limpieza', color: '#34c759' },
  { id: 'compra', name: 'Compra', color: '#34c759' },
] as CustomList[];
const tasks: TaskItem[] = [
  { id: 'c1', title: 'Gimnasia facial: movimiento de labios', categoryId: 'care', status: 'pending', created_at: '2026-01-01' },
  { id: 'c2', title: 'Crema de noche', categoryId: 'care', status: 'pending', created_at: '2026-01-01' },
] as TaskItem[];
const proposed = (over: Partial<ProposedTask> = {}): ProposedTask[] => [{ id: 'p1', title: 'Hacerme las cejas', listId: 'inbox', listName: 'Bandeja de entrada', cycle: 'cycle_month', selected: true, ...over }];

describe('conversación con el asistente local', () => {
  it('entiende la petición: título limpio, cada mes, en Care, y lo pregunta antes de crear', () => {
    const batch = AIService.localSemanticExtract('Quiero añadir una vez al mes o así hacerme las cejas', lists, tasks);
    expect(batch.tasks).toHaveLength(1);
    expect(batch.tasks[0]).toMatchObject({ title: 'Hacerme las cejas', cycle: 'cycle_month', listId: 'care', listName: 'Care' });
    expect(batch.reply).toBe('¿Apunto «Hacerme las cejas» cada mes en Care?');
    expect(batch.suggestedReplies).toContain('Sí');
  });

  it('la corrección larga cambia la propuesta (no crea otra con la queja como título)', () => {
    const text = 'Pero adónde se supone que Lo va a meter yo no quiero que lo meta la bandeja de entrada quiero que lo meta en la lista de Care';
    const batch = AIService.localSemanticExtract(text, lists, tasks, proposed());
    expect(batch.supersedesPending).toBe(true);
    expect(batch.tasks).toHaveLength(1);
    expect(batch.tasks[0]).toMatchObject({ title: 'Hacerme las cejas', listId: 'care', cycle: 'cycle_month' });
    expect(batch.reply).toBe('Cambiado. ¿Apunto «Hacerme las cejas» cada mes en Care?');
  });

  it('«sí» añade lo propuesto y «no» lo descarta', () => {
    expect(AIService.localSemanticExtract('Sí, añádelo', lists, tasks, proposed()).confirmPending).toBe(true);
    expect(AIService.localSemanticExtract('vale', lists, tasks, proposed()).confirmPending).toBe(true);
    expect(AIService.localSemanticExtract('no', lists, tasks, proposed()).discardPending).toBe(true);
  });

  it('«En otra lista» ofrece las listas; «En Compra» la cambia', () => {
    const ask = AIService.localSemanticExtract('En otra lista', lists, tasks, proposed());
    expect(ask.tasks).toHaveLength(0);
    expect(ask.suggestedReplies).toEqual(expect.arrayContaining(['En Care', 'En Compra']));
    const moved = AIService.localSemanticExtract('En Compra', lists, tasks, proposed());
    expect(moved.tasks[0].listId).toBe('compra');
  });

  it('frecuencia: «Cada semana» y «Una sola vez»', () => {
    expect(AIService.localSemanticExtract('Cada semana', lists, tasks, proposed()).tasks[0].cycle).toBe('cycle_week');
    expect(AIService.localSemanticExtract('Una sola vez', lists, tasks, proposed()).tasks[0].cycle).toBeUndefined();
  });

  it('un recordatorio nuevo no se confunde con una corrección', () => {
    const batch = AIService.localSemanticExtract('Recuérdame comprar pan mañana', lists, tasks, proposed());
    expect(batch.supersedesPending).toBeFalsy();
    expect(batch.tasks[0].title).toMatch(/^Comprar pan/);
  });

  it('sin lista clara pregunta igualmente dónde, sin inventar', () => {
    const batch = AIService.localSemanticExtract('Llamar a mamá el jueves', lists, tasks);
    expect(batch.tasks[0].listId).toBe('inbox');
    expect(batch.reply).toMatch(/^¿Apunto «Llamar a mamá» el jueves/);
  });
});
