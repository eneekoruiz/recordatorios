import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../src/store/useAppStore';
import { calculateTasksDuration, calculateCompletedTasksDuration } from '../../src/utils/taskDuration';
import { AIService } from '../../src/services/AIService';
import type { TaskItem, CustomList } from '../../src/models/Task';

describe('Cascade subtask completion & deleteTaskWithOptions', () => {
  beforeEach(() => {
    useAppStore.setState({
      tasks: {},
      lists: [{ id: 'compra', name: 'Compra', _is_dirty: false, updated_at: new Date().toISOString() }],
      listSections: [],
      cycles: []
    });
  });

  it('completes all child and descendant tasks recursively when parent task is completed', () => {
    const parent: TaskItem = {
      id: 'parent_1',
      title: 'Acuario',
      categoryId: 'compra',
      status: 'pending',
      created_at: new Date().toISOString()
    };
    const child1: TaskItem = {
      id: 'child_1',
      title: 'Pecera enorme',
      parentId: 'parent_1',
      categoryId: 'compra',
      status: 'pending',
      created_at: new Date().toISOString()
    };
    const child2: TaskItem = {
      id: 'child_2',
      title: 'Bomba sumergible',
      parentId: 'parent_1',
      categoryId: 'compra',
      status: 'pending',
      created_at: new Date().toISOString()
    };
    const grandChild: TaskItem = {
      id: 'grandchild_1',
      title: 'Tubo de silicona para bomba',
      parentId: 'child_2',
      categoryId: 'compra',
      status: 'pending',
      created_at: new Date().toISOString()
    };

    useAppStore.setState({
      tasks: {
        parent_1: parent,
        child_1: child1,
        child_2: child2,
        grandchild_1: grandChild
      }
    });

    // Complete the parent
    useAppStore.getState().toggleTask('parent_1');

    const state = useAppStore.getState();
    expect(state.tasks['parent_1']?.status).toBe('completed');
    expect(state.tasks['child_1']?.status).toBe('completed');
    expect(state.tasks['child_2']?.status).toBe('completed');
    expect(state.tasks['grandchild_1']?.status).toBe('completed');
  });

  it('allows unchecking a specific child inside a completed parent while leaving siblings completed and reopening parent', () => {
    const parent: TaskItem = { id: 'p_group', title: 'Viaje a Roma', categoryId: 'compra', status: 'pending', created_at: new Date().toISOString() };
    const child1: TaskItem = { id: 'c_pasaporte', title: 'Renovar pasaporte', parentId: 'p_group', categoryId: 'compra', status: 'pending', created_at: new Date().toISOString() };
    const child2: TaskItem = { id: 'c_hotel', title: 'Reservar hotel', parentId: 'p_group', categoryId: 'compra', status: 'pending', created_at: new Date().toISOString() };
    const child3: TaskItem = { id: 'c_vuelos', title: 'Comprar vuelos', parentId: 'p_group', categoryId: 'compra', status: 'pending', created_at: new Date().toISOString() };

    useAppStore.setState({
      tasks: {
        p_group: parent,
        c_pasaporte: child1,
        c_hotel: child2,
        c_vuelos: child3
      }
    });

    // 1. Tachar padre: se completan todas por defecto
    useAppStore.getState().toggleTask('p_group');
    let state = useAppStore.getState();
    expect(state.tasks['p_group']?.status).toBe('completed');
    expect(state.tasks['c_pasaporte']?.status).toBe('completed');
    expect(state.tasks['c_hotel']?.status).toBe('completed');
    expect(state.tasks['c_vuelos']?.status).toBe('completed');

    // 2. Destachar una en específico (ej. el hotel todavía no se reservó)
    useAppStore.getState().toggleTask('c_hotel');
    state = useAppStore.getState();

    // La subtarea específica pasa a pendiente
    expect(state.tasks['c_hotel']?.status).toBe('pending');
    // Las demás subtareas permanecen completadas
    expect(state.tasks['c_pasaporte']?.status).toBe('completed');
    expect(state.tasks['c_vuelos']?.status).toBe('completed');
    // El padre se reabre a pendiente para reflejar que el grupo ya no está 100% terminado
    expect(state.tasks['p_group']?.status).toBe('pending');
  });

  it('deleteTaskWithOptions with keepSubtasks: true unnests children preserving order and deletes parent', () => {
    const root1: TaskItem = { id: 'root_1', title: 'Primero', categoryId: 'compra', order: 0, status: 'pending', created_at: new Date().toISOString() };
    const parent: TaskItem = { id: 'parent_1', title: 'Padre', categoryId: 'compra', order: 1, status: 'pending', created_at: new Date().toISOString() };
    const root2: TaskItem = { id: 'root_2', title: 'Tercero', categoryId: 'compra', order: 2, status: 'pending', created_at: new Date().toISOString() };
    const child1: TaskItem = { id: 'child_1', title: 'Sub 1', parentId: 'parent_1', categoryId: 'compra', order: 0, status: 'pending', created_at: new Date().toISOString() };
    const child2: TaskItem = { id: 'child_2', title: 'Sub 2', parentId: 'parent_1', categoryId: 'compra', order: 1, status: 'pending', created_at: new Date().toISOString() };

    useAppStore.setState({
      tasks: {
        root_1: root1,
        parent_1: parent,
        root_2: root2,
        child_1: child1,
        child_2: child2
      }
    });

    useAppStore.getState().deleteTaskWithOptions('parent_1', { keepSubtasks: true });

    const state = useAppStore.getState();
    expect(state.tasks['parent_1']?.deleted_at).toBeDefined();

    // Children are unnested
    expect(state.tasks['child_1']?.parentId).toBeUndefined();
    expect(state.tasks['child_2']?.parentId).toBeUndefined();
    expect(state.tasks['child_1']?.deleted_at).toBeUndefined();
    expect(state.tasks['child_2']?.deleted_at).toBeUndefined();

    // Children are placed between root_1 and root_2
    const roots = Object.values(state.tasks)
      .filter(t => !t.deleted_at && !t.parentId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    expect(roots.map(r => r.id)).toEqual(['root_1', 'child_1', 'child_2', 'root_2']);
  });

  it('deleteTaskWithOptions with keepSubtasks: false deletes parent and all descendants', () => {
    const parent: TaskItem = { id: 'parent_1', title: 'Padre', categoryId: 'compra', status: 'pending', created_at: new Date().toISOString() };
    const child: TaskItem = { id: 'child_1', title: 'Hijo', parentId: 'parent_1', categoryId: 'compra', status: 'pending', created_at: new Date().toISOString() };
    const grandchild: TaskItem = { id: 'grandchild_1', title: 'Nieto', parentId: 'child_1', categoryId: 'compra', status: 'pending', created_at: new Date().toISOString() };

    useAppStore.setState({
      tasks: { parent_1: parent, child_1: child, grandchild_1: grandchild }
    });

    useAppStore.getState().deleteTaskWithOptions('parent_1', { keepSubtasks: false });

    const state = useAppStore.getState();
    expect(state.tasks['parent_1']?.deleted_at).toBeDefined();
    expect(state.tasks['child_1']?.deleted_at).toBeDefined();
    expect(state.tasks['grandchild_1']?.deleted_at).toBeDefined();
  });
});

describe('calculateCompletedTasksDuration', () => {
  it('correctly calculates completed duration vs pending duration', () => {
    const tasks: TaskItem[] = [
      { id: '1', title: 'Hacer cama', duration: 5, status: 'completed', created_at: new Date().toISOString() },
      { id: '2', title: 'Fregar baño', duration: 15, status: 'completed', created_at: new Date().toISOString() },
      { id: '3', title: 'Cocinar cena', duration: 25, status: 'pending', created_at: new Date().toISOString() }
    ];

    const pending = calculateTasksDuration(tasks);
    const completed = calculateCompletedTasksDuration(tasks);

    expect(pending.activeMinutes).toBe(25);
    expect(pending.formattedActive).toBe('25 min');

    expect(completed.activeMinutes).toBe(20);
    expect(completed.formattedActive).toBe('20 min');
  });
});

describe('AIService Semantic Grouping & Queries', () => {
  const lists: CustomList[] = [
    { id: 'compra', name: 'Compra', _is_dirty: false, updated_at: new Date().toISOString() }
  ];

  const existingTasks: Record<string, TaskItem> = {
    t1: { id: 't1', title: 'Desodorante AXE', categoryId: 'compra', status: 'pending', created_at: new Date().toISOString() },
    t2: { id: 't2', title: 'Jabón sin PH dermatológico', categoryId: 'compra', status: 'pending', created_at: new Date().toISOString() },
    t3: { id: 't3', title: 'Aceites esenciales de lavanda', categoryId: 'compra', status: 'pending', created_at: new Date().toISOString() },
    t4: { id: 't4', title: 'El tónico facial', categoryId: 'compra', status: 'pending', created_at: new Date().toISOString() },
    t5: { id: 't5', title: 'Jabón facial espumoso', categoryId: 'compra', status: 'pending', created_at: new Date().toISOString() }
  };

  it('correctly extracts grouping intent into mother task and matches existing items', () => {
    const prompt = 'En la lista de la compra, unifica todos los productos donde pone AXE, jabón sin PH, aceites esenciales, el tónico, jabón facial, unifícalos todos en una tarea madre que sea productos para limpieza o aseo personal.';
    const result = AIService.localSemanticExtract(prompt, lists, existingTasks);

    expect(result.action).toBeDefined();
    expect(result.action?.type).toBe('group_tasks');
    expect(result.action?.parentTitle.toLowerCase()).toContain('productos para limpieza o aseo personal');
    expect(result.action?.listId).toBe('compra');

    // Should have matched the 5 products
    expect(result.action?.children.length).toBe(5);
    expect(result.action?.children.every(c => c.isExisting)).toBe(true);

    // Should NOT have imported filler strings as tasks
    expect(result.tasks.length).toBe(0);
  });

  it('answers query for remaining tasks of today', () => {
    const todayTask: TaskItem = {
      id: 'today_1',
      title: 'Pasear al perro',
      cycle_id: 'cycle_day',
      status: 'pending',
      created_at: new Date().toISOString()
    };
    const result = AIService.localSemanticExtract('¿Qué tareas tengo para hoy?', lists, { today_1: todayTask });

    expect(result.reply).toContain('Pasear al perro');
    expect(result.tasks.length).toBe(0);
  });

  it('handles general greetings with helpful advice and suggestions without creating fake tasks', () => {
    const result = AIService.localSemanticExtract('¡Hola buenas! ¿Qué tal?', lists, {});
    expect(result.tasks.length).toBe(0);
    expect(result.reply).toContain('Asistente Inteligente de Recordatorios');
    expect(result.suggestedReplies && result.suggestedReplies.length > 0).toBe(true);
  });

  it('correctly recognizes intent to complete an existing task into taskUpdates', () => {
    const tasks = {
      t_leche: { id: 't_leche', title: 'Comprar leche entera', status: 'pending' as const, created_at: new Date().toISOString() }
    };
    const result = AIService.localSemanticExtract('Marca como hecha comprar leche entera', lists, tasks);
    expect(result.tasks.length).toBe(0);
    expect(result.taskUpdates).toBeDefined();
    expect(result.taskUpdates?.length).toBe(1);
    expect(result.taskUpdates?.[0].taskId).toBe('t_leche');
    expect(result.taskUpdates?.[0].status).toBe('completed');
  });

  it('correctly recognizes intent to delete an existing task into taskUpdates', () => {
    const tasks = {
      t_dent: { id: 't_dent', title: 'Cita con el dentista', status: 'pending' as const, created_at: new Date().toISOString() }
    };
    const result = AIService.localSemanticExtract('Elimina la cita con el dentista', lists, tasks);
    expect(result.tasks.length).toBe(0);
    expect(result.taskUpdates).toBeDefined();
    expect(result.taskUpdates?.length).toBe(1);
    expect(result.taskUpdates?.[0].taskId).toBe('t_dent');
    expect(result.taskUpdates?.[0].deleted).toBe(true);
  });

  it('correctly recognizes intent to update task price into taskUpdates', () => {
    const tasks = {
      t_pan: { id: 't_pan', title: 'Pan de masa madre', status: 'pending' as const, created_at: new Date().toISOString() }
    };
    const result = AIService.localSemanticExtract('Cambia el precio de Pan de masa madre a 2.50€', lists, tasks);
    expect(result.tasks.length).toBe(0);
    expect(result.taskUpdates).toBeDefined();
    expect(result.taskUpdates?.length).toBe(1);
    expect(result.taskUpdates?.[0].taskId).toBe('t_pan');
    expect(result.taskUpdates?.[0].price).toBe(2.5);
  });

  it('validates empty api key in testGeminiConnection', async () => {
    const res = await AIService.testGeminiConnection('   ');
    expect(res.ok).toBe(false);
    expect(res.error).toContain('vacía');
  });
});
