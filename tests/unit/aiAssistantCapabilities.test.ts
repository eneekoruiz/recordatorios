import { describe, it, expect } from 'vitest';
import { AIService } from '../../src/services/AIService';
import type { CustomList, TaskItem, ListSection } from '../../src/models/Task';

describe('AIService - Conversación y contexto de Biblioteca de Vida y Tareas Completadas', () => {
  const lists: CustomList[] = [
    { id: 'quehaceres', name: 'Quehaceres diarios', listType: 'routines', color: '#3b82f6', icon: 'check', created_at: '', version: 1, user_id: 'u1' },
    { id: 'biblioteca_vida', name: 'Biblioteca de vida', listType: 'library', color: '#8b5cf6', icon: 'bookmark', created_at: '', version: 1, user_id: 'u1' }
  ];

  const listSections: ListSection[] = [
    { id: 'sec_pelis', listId: 'biblioteca_vida', name: 'Películas', order: 1, created_at: '', updated_at: '' },
    { id: 'sec_series', listId: 'biblioteca_vida', name: 'Series', order: 2, created_at: '', updated_at: '' },
    { id: 'sec_musica', listId: 'biblioteca_vida', name: 'Música', order: 3, created_at: '', updated_at: '' },
    { id: 'sec_apellidos', listId: 'biblioteca_vida', name: 'Apellidos', order: 4, created_at: '', updated_at: '' }
  ];

  const tasks: TaskItem[] = [
    {
      id: 't_done_1',
      title: 'Pagar factura de luz',
      categoryId: 'quehaceres',
      status: 'completed',
      completed_at: '2026-10-04T10:00:00.000Z',
      created_at: '',
      version: 1,
      user_id: 'u1',
      type: 'task'
    },
    {
      id: 't_peli_1',
      title: 'Inception',
      categoryId: 'biblioteca_vida',
      sectionId: 'sec_pelis',
      status: 'pending',
      mediaType: 'movie',
      mediaStatus: 'want_to_watch',
      mediaRating: 5,
      created_at: '',
      version: 1,
      user_id: 'u1',
      type: 'task'
    },
    {
      id: 't_serie_1',
      title: 'Breaking Bad',
      categoryId: 'biblioteca_vida',
      sectionId: 'sec_series',
      status: 'completed',
      mediaType: 'series',
      mediaStatus: 'completed',
      mediaRating: 5,
      created_at: '',
      version: 1,
      user_id: 'u1',
      type: 'task'
    },
    {
      id: 't_apel_1',
      title: 'Ruiz de Gauna',
      categoryId: 'biblioteca_vida',
      sectionId: 'sec_apellidos',
      status: 'pending',
      notes: 'Origen alavés',
      created_at: '',
      version: 1,
      user_id: 'u1',
      type: 'task'
    }
  ];

  it('responde a consultas sobre tareas completadas y logros', () => {
    const res = AIService.localSemanticExtract('¿Qué tareas he completado hoy?', lists, tasks, undefined, listSections);
    expect(res.reply).toContain('Has completado 2 recordatorios');
    expect(res.reply).toContain('Pagar factura de luz');
    expect(res.reply).toContain('Breaking Bad');
    expect(res.tasks).toHaveLength(0);
  });

  it('responde y explica qué es la biblioteca de vida', () => {
    const res = AIService.localSemanticExtract('¿Para qué sirve la biblioteca de vida?', lists, tasks, undefined, listSections);
    expect(res.reply).toContain('Tu Biblioteca de vida');
    expect(res.reply).toContain('películas y series');
  });

  it('lista películas de la biblioteca de vida con estado', () => {
    const res = AIService.localSemanticExtract('¿Qué películas tengo en la biblioteca?', lists, tasks, undefined, listSections);
    expect(res.reply).toContain('Inception');
    expect(res.reply).toContain('Películas');
  });

  it('lista apellidos guardados en la biblioteca de vida', () => {
    const res = AIService.localSemanticExtract('Dime los apellidos que tengo guardados', lists, tasks, undefined, listSections);
    expect(res.reply).toContain('Ruiz de Gauna');
    expect(res.reply).toContain('Origen alavés');
  });

  it('reconoce y asigna automáticamente a biblioteca_vida al dictar una película o serie', () => {
    const resPeli = AIService.localSemanticExtract('Apunta la película Interstellar para ver', lists, tasks, undefined, listSections);
    expect(resPeli.tasks.length).toBeGreaterThan(0);
    const peliTask = resPeli.tasks[0];
    expect(peliTask.listId).toBe('biblioteca_vida');
    expect(peliTask.sectionName).toBe('Películas');
    expect(peliTask.mediaType).toBe('movie');
    expect(peliTask.mediaStatus).toBe('want_to_watch');

    const resSerie = AIService.localSemanticExtract('Ya me he visto la serie Stranger Things', lists, tasks, undefined, listSections);
    expect(resSerie.tasks.length).toBeGreaterThan(0);
    const serieTask = resSerie.tasks[0];
    expect(serieTask.listId).toBe('biblioteca_vida');
    expect(serieTask.sectionName).toBe('Series');
    expect(serieTask.mediaType).toBe('series');
    expect(serieTask.mediaStatus).toBe('completed');
  });

  it('buildSystemInstruction incluye tareas completadas y secciones de biblioteca', () => {
    const instruction = AIService.buildSystemInstruction(lists, tasks, undefined, undefined, listSections);
    expect(instruction).toContain('Pagar factura de luz');
    expect(instruction).toContain('Inception');
    expect(instruction).toContain('Ruiz de Gauna');
    expect(instruction).toContain('Películas');
    expect(instruction).toContain('Series');
    expect(instruction).toContain('Biblioteca de vida');
  });

  it('extrae hábitos con meta de repeticiones (ej. beber agua 10 veces al día) con targetCount y cycle_day', () => {
    const res = AIService.localSemanticExtract('Beber agua 10 veces al día', lists, tasks, undefined, listSections);
    expect(res.tasks).toHaveLength(1);
    const task = res.tasks[0];
    expect(task.title.toLowerCase()).toContain('beber agua');
    expect(task.targetCount).toBe(10);
    expect(task.cycle).toBe('cycle_day');
  });
});
