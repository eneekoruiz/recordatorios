import { describe, it, expect } from 'vitest';
import { runContentMigrations } from '../../src/utils/contentMigrations';
import { VITAL_HABITS_LIST_ID, VITAL_HABITS_SECTION_ID } from '../../src/utils/vitalHabits';
import { calculateTasksDuration } from '../../src/utils/taskDuration';
import type { TaskItem } from '../../src/models/Task';
import type { ContentMigrationStore } from '../../src/utils/contentMigrations';

describe('deleted routine parents', () => {
  it.each(['stored', 'tombstone'])('does not crash or recreate mirror subtasks after deleting their parent (%s)', mode => {
    const deleted = { id: 'removed-mirror', title: 'Limpiar espejos', status: 'pending', deleted_at: '2026-10-25T10:00:00Z' } as TaskItem;
    let nextId = 0;
    const store: ContentMigrationStore = {
      tasks: { live: { id: 'live', title: 'Guardar papeles', status: 'pending' } as TaskItem,
        ...(mode === 'stored' ? { [deleted.id]: deleted } : {}),
      },
      lists: [{ id: 'limpieza', name: 'Limpieza' }], listSections: [],
      tombstones: { tasks: mode === 'tombstone' ? [deleted] : [] },
      addList: list => { store.lists!.push(list); },
      addListSection: section => { store.listSections!.push(section); },
      addTask: task => {
        const id = task.id || `created-${++nextId}`;
        store.tasks[id] = { ...task, id } as TaskItem;
      },
      updateTask: (id, patch) => { store.tasks[id] = { ...store.tasks[id], ...patch }; },
    };
    expect(() => runContentMigrations(store)).not.toThrow();
    expect(() => runContentMigrations(store)).not.toThrow();
    expect(Object.values(store.tasks).some(task => !task.deleted_at && /espejo/i.test(task.title))).toBe(false);
    expect(store.tasks.live.deleted_at).toBeUndefined();
    if (mode === 'stored') expect(store.tasks[deleted.id].deleted_at).toBe(deleted.deleted_at);
  });
});

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
    expect(secNames).toContain('Recursos y Web');
    expect(secNames).not.toContain('Recuerda');

    // Segunda ejecución (Idempotencia)
    const countBefore = Object.values(tasks).filter(t => !t.deleted_at).length;
    runContentMigrations(store);
    const countAfter = Object.values(tasks).filter(t => !t.deleted_at).length;
    expect(countAfter).toBe(countBefore);
  });

  it('P1-1: reasigna tareas de hábitos vitales de la lista eliminada pero NUNCA resucita tareas borradas', () => {
    let tasks: Record<string, TaskItem> = {
      t_custom: {
        id: 't_custom',
        title: 'Tomar suplemento vitamínico',
        categoryId: VITAL_HABITS_LIST_ID,
        status: 'pending',
        created_at: '',
        version: 1,
        user_id: 'u1',
        type: 'task',
        notes: 'Con el desayuno'
      },
      t_deleted_vital: {
        id: 't_deleted_vital',
        title: 'Beber agua fresca',
        categoryId: VITAL_HABITS_LIST_ID,
        status: 'pending',
        deleted_at: '2026-10-01T12:00:00.000Z',
        created_at: '',
        version: 1,
        user_id: 'u1',
        type: 'task'
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

    // La tarea borrada DEBE permanecer borrada
    expect(tasks['t_deleted_vital'].deleted_at).toBe('2026-10-01T12:00:00.000Z');
  });

  it('respeta escrupulosamente las tareas borradas: NUNCA desmarca deleted_at ni recrea tareas eliminadas', () => {
    let tasks: Record<string, TaskItem> = {
      t_cejas_del: {
        id: 'task_hacerme_cejas_mensual',
        title: 'Hacerme las cejas',
        categoryId: 'care',
        status: 'pending',
        deleted_at: '2026-10-25T15:00:00.000Z',
        created_at: '',
        version: 1,
        user_id: 'u1',
        type: 'task'
      },
      t_horno_del: {
        id: 't_horno',
        title: 'Limpiar el horno a fondo',
        categoryId: 'limpieza',
        status: 'pending',
        deleted_at: '2026-10-25T15:00:00.000Z',
        created_at: '',
        version: 1,
        user_id: 'u1',
        type: 'task'
      },
      t_matabichos_del: {
        id: 'task_matabichos_telaranas_mensual',
        title: 'Echar matabichos por las esquinas y pasar las telarañas por las esquinas del techo',
        categoryId: 'limpieza',
        status: 'pending',
        deleted_at: '2026-10-25T15:00:00.000Z',
        created_at: '',
        version: 1,
        user_id: 'u1',
        type: 'task'
      },
      t_compra_mensual_del: {
        id: 't_compra_mensual',
        title: 'compra mensual',
        categoryId: 'compra',
        status: 'pending',
        deleted_at: '2026-10-25T15:00:00.000Z',
        created_at: '',
        version: 1,
        user_id: 'u1',
        type: 'task'
      }
    };
    let lists: any[] = [
      { id: 'care', name: 'Care', listType: 'routines' },
      { id: 'limpieza', name: 'Limpieza', listType: 'routines' },
      { id: 'compra', name: 'Compra', listType: 'shopping' }
    ];
    let listSections: any[] = [
      { id: 'sec_care_mensual', listId: 'care', name: 'Mensuales', order: 1 },
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

    runContentMigrations(store);

    // 1. deleted_at jamás se desmarca
    expect(tasks['t_cejas_del'].deleted_at).toBe('2026-10-25T15:00:00.000Z');
    expect(tasks['t_horno_del'].deleted_at).toBe('2026-10-25T15:00:00.000Z');
    expect(tasks['t_matabichos_del'].deleted_at).toBe('2026-10-25T15:00:00.000Z');
    expect(tasks['t_compra_mensual_del'].deleted_at).toBe('2026-10-25T15:00:00.000Z');

    // 2. Ninguna tarea borrada se ha recreado como activa
    const cejasActivas = Object.values(tasks).filter(t => !t.deleted_at && t.title.toLowerCase().includes('ceja'));
    expect(cejasActivas).toHaveLength(0);

    const hornoActivo = Object.values(tasks).filter(t => !t.deleted_at && t.title.toLowerCase().includes('horno'));
    expect(hornoActivo).toHaveLength(0);

    const matabichosActivo = Object.values(tasks).filter(t => !t.deleted_at && t.title.toLowerCase().includes('matabicho'));
    expect(matabichosActivo).toHaveLength(0);
  });

  it('migra y completa la rutina de ejercicios con pajita con 3 subtareas', () => {
    let tasks: Record<string, TaskItem> = {
      pajita_parent: {
        id: 'pajita_parent',
        title: 'Ejercicio con pajita',
        categoryId: 'care',
        sectionId: 'sec_care_diaria',
        status: 'pending',
        duration: 1,
        created_at: '',
        version: 1,
        user_id: 'u1',
        type: 'task'
      },
      pajita_sub1: {
        id: 'pajita_sub1',
        title: 'Ponte la pajita entre los labios',
        parentId: 'pajita_parent',
        categoryId: 'care',
        sectionId: 'sec_care_diaria',
        status: 'pending',
        created_at: '',
        version: 1,
        user_id: 'u1',
        type: 'task'
      }
    };
    let lists: any[] = [{ id: 'care', name: 'Care', listType: 'routines' }];
    let listSections: any[] = [{ id: 'sec_care_diaria', listId: 'care', name: 'Diarias', order: 0 }];

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

    runContentMigrations(store);

    const parent = tasks['pajita_parent'];
    expect(parent.title).toBe('Ejercicios con pajita');
    expect(parent.duration).toBe(3);

    const subtasks = Object.values(tasks).filter(t => t.parentId === 'pajita_parent');
    expect(subtasks).toHaveLength(3);
    expect(subtasks.some(s => s.title.includes('Papada'))).toBe(true);
    expect(subtasks.some(s => s.title.includes('Pómulos'))).toBe(true);
    expect(subtasks.some(s => s.title.includes('Labios'))).toBe(true);
  });

  it('crea tareas de cejas, manicura/pedicura y asegura fisio en compra mensual', () => {
    let tasks: Record<string, TaskItem> = {
      t_masaje: {
        id: 't_masaje',
        title: 'Masaje o fisio',
        categoryId: 'compra',
        sectionId: 'sec_compra_mensuales',
        status: 'pending',
        created_at: '',
        version: 1,
        user_id: 'u1',
        type: 'task'
      }
    };
    let lists: any[] = [
      { id: 'care', name: 'Care', listType: 'routines' },
      { id: 'compra', name: 'Compra', listType: 'shopping' }
    ];
    let listSections: any[] = [
      { id: 'sec_care_mensual', listId: 'care', name: 'Mensuales', order: 1 },
      { id: 'sec_compra_mensuales', listId: 'compra', name: 'Mensuales', order: 1 }
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

    runContentMigrations(store);

    const cejas = Object.values(tasks).find(t => t.title.toLowerCase().includes('cejas'));
    expect(cejas).toBeDefined();
    expect(cejas?.categoryId).toBe('care');
    expect(cejas?.cycle_id).toBe('cycle_month');

    const maniPedi = Object.values(tasks).find(t => t.title.toLowerCase().includes('manicura') && !t.parentId);
    expect(maniPedi).toBeDefined();
    expect(maniPedi?.categoryId).toBe('care');
    expect(maniPedi?.cycle_id).toBe('cycle_month');

    const maniPediSubs = Object.values(tasks).filter(t => t.parentId === maniPedi?.id);
    expect(maniPediSubs).toHaveLength(2);

    const fisio = tasks['t_masaje'];
    expect(fisio.title).toContain('fisio');

    const podologo = Object.values(tasks).find(t => t.title.toLowerCase().includes('podólogo') || t.title.toLowerCase().includes('podologo'));
    expect(podologo).toBeDefined();
    expect(podologo?.categoryId).toBe('care');
    expect(podologo?.cycle_id).toBe('cycle_month');
  });

  it('clasifica correctamente medios en Biblioteca de vida (Titanes como peli, series, apellidos con orden) y elimina seccion Recuerda', () => {
    let tasks: Record<string, TaskItem> = {
      t_titanes: {
        id: 't_titanes',
        title: 'Titanes',
        categoryId: 'biblioteca_vida',
        sectionId: 'sec_biblioteca_vida_recuerda',
        status: 'pending',
        created_at: '',
        version: 1,
        user_id: 'u1',
        type: 'task'
      },
      t_asesino: {
        id: 't_asesino',
        title: 'Cómo defender a un asesino',
        categoryId: 'recuerda',
        status: 'pending',
        created_at: '',
        version: 1,
        user_id: 'u1',
        type: 'task'
      },
      t_catastroficas: {
        id: 't_catastroficas',
        title: 'Una serie de catastróficas desdichas',
        categoryId: 'biblioteca_vida',
        status: 'pending',
        created_at: '',
        version: 1,
        user_id: 'u1',
        type: 'task'
      },
      t_protegidos: {
        id: 't_protegidos',
        title: 'Los protegidos',
        categoryId: 'biblioteca_vida',
        status: 'pending',
        created_at: '',
        version: 1,
        user_id: 'u1',
        type: 'task'
      },
      t_ruiz: {
        id: 't_ruiz',
        title: 'Ruiz',
        categoryId: 'biblioteca_vida',
        status: 'pending',
        created_at: '',
        version: 1,
        user_id: 'u1',
        type: 'task'
      },
      t_koldokoak: {
        id: 't_koldokoak',
        title: 'Koldokoak2005a',
        categoryId: 'recuerda',
        status: 'pending',
        created_at: '',
        version: 1,
        user_id: 'u1',
        type: 'task'
      }
    };
    let lists: any[] = [
      { id: 'biblioteca_vida', name: 'Biblioteca de vida', listType: 'library' }
    ];
    let listSections: any[] = [
      { id: 'sec_biblioteca_vida_recuerda', listId: 'biblioteca_vida', name: 'Recuerda', order: 5 }
    ];

    const store: any = {
      get tasks() { return tasks; },
      get lists() { return lists; },
      get listSections() { return listSections; },
      addList: (l: any) => { lists.push(l); },
      addListSection: (s: any) => { listSections.push(s); },
      deleteListSection: (id: string) => {
        listSections = listSections.filter(s => s.id !== id);
      },
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

    runContentMigrations(store);

    expect(tasks['t_titanes'].mediaType).toBe('movie');
    expect(tasks['t_titanes'].sectionId).toContain('peliculas');

    expect(tasks['t_asesino'].mediaType).toBe('series');
    expect(tasks['t_asesino'].sectionId).toContain('series');
    expect(tasks['t_catastroficas'].mediaType).toBe('series');
    expect(tasks['t_catastroficas'].sectionId).toContain('series');
    expect(tasks['t_protegidos'].mediaType).toBe('series');
    expect(tasks['t_protegidos'].sectionId).toContain('series');

    expect(tasks['t_ruiz'].sectionId).toContain('apellidos');
    expect(tasks['t_ruiz'].order).toBe(0);

    expect(tasks['t_koldokoak'].sectionId).toContain('recursos');

    const recuerdaSec = listSections.find(s => s.name === 'Recuerda' && !s.deleted_at);
    expect(recuerdaSec).toBeUndefined();
  });

  it('asegura las tareas mensuales de limpieza del hogar y habitación', () => {
    let tasks: Record<string, TaskItem> = {};
    let lists: any[] = [{ id: 'limpieza', name: 'Limpieza', listType: 'routines' }];
    let listSections: any[] = [
      { id: 'sec_limpieza_mensual', listId: 'limpieza', name: 'Mensuales', order: 2 },
      { id: 'sec_limp_mensual_hab', listId: 'limpieza', parentId: 'sec_limpieza_mensual', name: 'Habitación', order: 0 },
      { id: 'sec_limp_mensual_general', listId: 'limpieza', parentId: 'sec_limpieza_mensual', name: 'General', order: 1 }
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

    runContentMigrations(store);

    const taskList = Object.values(tasks);

    // 1. Matabichos y telarañas
    const matabichos = taskList.find(t => t.title.includes('matabichos') && t.title.includes('telarañas') && !t.parentId);
    expect(matabichos).toBeDefined();
    expect(matabichos?.cycle_id).toBe('cycle_month');
    expect(matabichos?.sectionId).toBe('sec_limp_mensual_general');
    expect(matabichos?.duration).toBe(10);
    const matabichosSubs = taskList.filter(t => t.parentId === matabichos?.id);
    expect(matabichosSubs).toHaveLength(2);

    // 2. Arriba del armario y arriba de la tele
    const armarioTele = taskList.find(t => t.title.includes('armario') && t.title.includes('tele') && !t.parentId);
    expect(armarioTele).toBeDefined();
    expect(armarioTele?.cycle_id).toBe('cycle_month');
    expect(armarioTele?.sectionId).toBe('sec_limp_mensual_hab');
    expect(armarioTele?.duration).toBe(10);
    const armarioSubs = taskList.filter(t => t.parentId === armarioTele?.id);
    expect(armarioSubs).toHaveLength(2);

    // 3. Baldas a fondo
    const baldas = taskList.find(t => t.title.includes('baldas') && !t.parentId);
    expect(baldas).toBeDefined();
    expect(baldas?.cycle_id).toBe('cycle_month');
    expect(baldas?.sectionId).toBe('sec_limp_mensual_hab');
    expect(baldas?.duration).toBe(15);
    const baldaSubs = taskList.filter(t => t.parentId === baldas?.id);
    expect(baldaSubs).toHaveLength(3);
  });
});
