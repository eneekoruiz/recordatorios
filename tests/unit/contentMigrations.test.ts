import { describe, it, expect } from 'vitest';
import { runContentMigrations } from '../../src/utils/contentMigrations';
import { VITAL_HABITS_LIST_ID, VITAL_HABITS_SECTION_ID } from '../../src/utils/vitalHabits';
import { calculateTasksDuration } from '../../src/utils/taskDuration';
import type { TaskItem } from '../../src/models/Task';

describe('runContentMigrations (Misiones 4 y 5)', () => {
  it('ejecuta todas las migraciones correctamente e idempotentemente', () => {
    let tasks: Record<string, TaskItem> = {
      t1: {
        id: 't1',
        title: 'Beber agua fresca 3 vasos',
        categoryId: 'quehaceres',
        status: 'pending',
        duration: 5,
        created_at: '',
        version: 1,
        user_id: 'u1',
        type: 'task'
      },
      t2: {
        id: 't2',
        title: 'Regar las plantas del salón',
        categoryId: 'limpieza',
        status: 'pending',
        created_at: '',
        version: 1,
        user_id: 'u1',
        type: 'task'
      }
    };
    let lists: any[] = [
      { id: 'limpieza', name: 'Limpieza', listType: 'routines' },
      { id: 'quehaceres', name: 'Quehaceres', listType: 'routines' }
    ];
    let listSections: any[] = [
      { id: 'sec_limpieza_semanal', listId: 'limpieza', name: 'Semanales', order: 1 },
      { id: 'sec_limpieza_mensual', listId: 'limpieza', name: 'Mensuales', order: 2 }
    ];

    const store: any = {
      get tasks() { return tasks; },
      get lists() { return lists; },
      get listSections() { return listSections; },
      addList: (l: any) => { lists.push(l); },
      addListSection: (s: any) => { listSections.push(s); },
      addTask: (t: any) => {
        const id = t.id || 'gen_' + Math.random().toString(36).slice(2);
        tasks[id] = { id, ...t };
      },
      updateTask: (id: string, updates: any) => {
        if (tasks[id]) {
          tasks[id] = { ...tasks[id], ...updates };
        }
      }
    };

    // Primera ejecución
    runContentMigrations(store);

    const taskValues = Object.values(tasks).filter(t => !t.deleted_at);

    // 1. Hábitos vitales integrados en sección de quehaceres (sin lista separada)
    const vitalList = lists.find(l => l.id === VITAL_HABITS_LIST_ID && !l.deleted_at);
    expect(vitalList).toBeUndefined();

    const habitSec = listSections.find(s => s.id === VITAL_HABITS_SECTION_ID || s.name === 'Hábitos vitales');
    expect(habitSec).toBeDefined();

    const habitTasks = taskValues.filter(t => t.sectionId === habitSec?.id);
    expect(habitTasks.some(t => t.title.toLowerCase().includes('beber agua'))).toBe(true);
    expect(habitTasks.some(t => t.title.toLowerCase().includes('comer'))).toBe(true);
    // Verificar que los hábitos vitales suman 0 minutos en el motor de duración
    const habitDuration = calculateTasksDuration(habitTasks, listSections, lists);
    expect(habitDuration.activeMinutes).toBe(0);

    // 2. Horno mensual
    const horno = taskValues.find(t => t.title.toLowerCase().includes('horno'));
    expect(horno).toBeDefined();
    expect(horno?.sectionId).toBe('sec_limpieza_mensual');

    // 3. Regar plantas con abono
    const plantas = taskValues.find(t => t.title.toLowerCase().includes('regar'));
    expect(plantas).toBeDefined();
    const abonoSubtask = taskValues.find(t => t.parentId === plantas?.id);
    expect(abonoSubtask).toBeDefined();
    expect(abonoSubtask?.title).toBe('Añadir abono para que crezcan más rápido');

    // 4. Limpiar espejos semanal con 10 min y 3 subtareas exactas
    const espejos = taskValues.find(t => t.title === 'Limpiar espejos');
    expect(espejos).toBeDefined();
    expect(espejos?.duration).toBe(10);
    expect(espejos?.sectionId).toBe('sec_limpieza_semanal');

    const espejosSubtasks = taskValues.filter(t => t.parentId === espejos?.id);
    expect(espejosSubtasks).toHaveLength(3);
    const subtaskTitles = espejosSubtasks.map(s => s.title).sort();
    expect(subtaskTitles).toEqual(['Espejo de la entrada', 'Espejo de mi cuarto', 'Espejo del baño'].sort());
    // Verificar que las subtareas no duplican duración: total debe ser 10 minutos
    const espejosFamilyDuration = calculateTasksDuration([espejos!, ...espejosSubtasks], listSections, lists);
    expect(espejosFamilyDuration.activeMinutes).toBe(10);

    // 5. Albornoz a la lavadora
    const albornoz = taskValues.find(t => t.title === 'Tirar el albornoz a la lavadora');
    expect(albornoz).toBeDefined();
    expect(albornoz?.sectionId).toBe('sec_limpieza_semanal');

    // 6. Biblioteca de Vida
    const biblio = lists.find(l => l.id === 'biblioteca_vida' || l.name === 'Biblioteca de vida');
    expect(biblio).toBeDefined();
    expect(biblio?.listType).toBe('library');
    const biblioSections = listSections.filter(s => s.listId === biblio?.id);
    const secNames = biblioSections.map(s => s.name);
    expect(secNames).toContain('Películas');
    expect(secNames).toContain('Series');
    expect(secNames).toContain('Música');
    expect(secNames).toContain('Libros');
    expect(secNames).toContain('Apellidos');
    expect(secNames).toContain('Recuerda');

    // Segunda ejecución (Idempotencia)
    const countBefore = Object.values(tasks).filter(t => !t.deleted_at).length;
    runContentMigrations(store);
    const countAfter = Object.values(tasks).filter(t => !t.deleted_at).length;
    expect(countAfter).toBe(countBefore);
  });

  it('P1-1: restaura tareas personalizadas de hábitos vitales que estuvieran en la lista eliminada o con deleted_at', () => {
    let tasks: Record<string, TaskItem> = {
      t_custom: {
        id: 't_custom',
        title: 'Tomar suplemento vitamínico',
        categoryId: VITAL_HABITS_LIST_ID,
        status: 'pending',
        deleted_at: '2026-10-01T12:00:00.000Z',
        created_at: '',
        version: 1,
        user_id: 'u1',
        type: 'task',
        notes: 'Con el desayuno'
      }
    };
    let lists: any[] = [
      { id: 'quehaceres', name: 'Quehaceres diarios', listType: 'routines' },
      { id: VITAL_HABITS_LIST_ID, name: 'Hábitos vitales', listType: 'simple' }
    ];
    let listSections: any[] = [];

    const store: any = {
      get tasks() { return tasks; },
      get lists() { return lists; },
      get listSections() { return listSections; },
      addList: (l: any) => { lists.push(l); },
      addListSection: (s: any) => { listSections.push(s); },
      addTask: (t: any) => {
        const id = t.id || 'gen_' + Math.random().toString(36).slice(2);
        tasks[id] = { id, ...t };
      },
      updateTask: (id: string, updates: any) => {
        if (tasks[id]) {
          tasks[id] = { ...tasks[id], ...updates };
        }
      },
      deleteList: (id: string) => {
        lists = lists.filter(l => l.id !== id);
      }
    };

    runContentMigrations(store);

    const migrated = tasks['t_custom'];
    expect(migrated).toBeDefined();
    expect(migrated.deleted_at).toBeUndefined();
    expect(migrated.categoryId).toBe('quehaceres');
    expect(migrated.sectionId).toBe(VITAL_HABITS_SECTION_ID);
    expect(migrated.disableDuration).toBe(true);
    expect(migrated.notes).toBe('Con el desayuno');
    expect(lists.some(l => l.id === VITAL_HABITS_LIST_ID)).toBe(false);
  });
});
