import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../src/store/useAppStore';
import type { TaskItem, ListSection } from '../../src/models/Task';

describe('useAppStore — Acciones avanzadas de secciones', () => {
  const baseTask = (overrides: Partial<TaskItem>): TaskItem => ({
    id: overrides.id || Math.random().toString(36).slice(2),
    user_id: 'u1',
    categoryId: 'list_1',
    type: 'task',
    title: 'Tarea de prueba',
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: 1,
    ...overrides,
  } as TaskItem);

  const baseSection = (overrides: Partial<ListSection>): ListSection => ({
    id: overrides.id || 'sec_1',
    listId: 'list_1',
    name: 'Sección Principal',
    order: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  });

  beforeEach(() => {
    useAppStore.setState({
      lists: [
        { id: 'list_1', name: 'Lista 1', color: '#007aff' },
        { id: 'list_2', name: 'Lista 2', color: '#34c759' }
      ],
      listSections: [
        baseSection({ id: 'sec_1', name: 'Sección A', order: 0 }),
        baseSection({ id: 'sec_2', name: 'Sección B', order: 1 }),
      ],
      tasks: {
        t1: baseTask({ id: 't1', sectionId: 'sec_1', title: 'Tarea 1', status: 'pending' }),
        t2: baseTask({ id: 't2', sectionId: 'sec_1', title: 'Tarea 2', status: 'completed' }),
        t3: baseTask({ id: 't3', sectionId: 'sec_2', title: 'Tarea 3', status: 'pending' }),
      },
    } as any);
  });

  it('reorderListSections actualiza el orden relativo y marca _is_dirty', () => {
    const store = useAppStore.getState();
    store.reorderListSections([
      { id: 'sec_1', order: 1 },
      { id: 'sec_2', order: 0 },
    ]);

    const sections = useAppStore.getState().listSections;
    const sec1 = sections.find(s => s.id === 'sec_1');
    const sec2 = sections.find(s => s.id === 'sec_2');

    expect(sec1?.order).toBe(1);
    expect(sec2?.order).toBe(0);
    expect(sec1?._is_dirty).toBe(true);
  });

  it('duplicateSection clona la sección con (copia) y duplica sus tareas activas en estado pendiente', () => {
    const store = useAppStore.getState();
    store.duplicateSection('sec_1');

    const state = useAppStore.getState();
    const duplicatedSec = state.listSections.find(s => s.name === 'Sección A (copia)');
    expect(duplicatedSec).toBeDefined();
    expect(duplicatedSec?.id).not.toBe('sec_1');

    // Comprobar que las tareas de sec_1 se duplicaron
    const duplicatedTasks = Object.values(state.tasks).filter(t => t.sectionId === duplicatedSec?.id);
    expect(duplicatedTasks.length).toBe(2);
    expect(duplicatedTasks.map(t => t.title)).toContain('Tarea 1');
    expect(duplicatedTasks.map(t => t.title)).toContain('Tarea 2');
    // Todas las tareas clonadas deben arrancar en estado pending
    expect(duplicatedTasks.every(t => t.status === 'pending')).toBe(true);
  });

  it('emptySection envía las tareas de la sección a la papelera sin eliminar la sección', () => {
    const store = useAppStore.getState();
    store.emptySection('sec_1');

    const state = useAppStore.getState();
    // La sección sigue existiendo
    const sec = state.listSections.find(s => s.id === 'sec_1');
    expect(sec).toBeDefined();
    expect(sec?.deleted_at).toBeUndefined();

    // Las tareas de sec_1 quedan con deleted_at
    expect(state.tasks['t1'].deleted_at).toBeDefined();
    expect(state.tasks['t2'].deleted_at).toBeDefined();
    // Tarea de sec_2 intacta
    expect(state.tasks['t3'].deleted_at).toBeUndefined();
  });

  it('moveSectionTasks reasigna lista y sección en lote', () => {
    const store = useAppStore.getState();
    store.moveSectionTasks(['t1', 't2'], 'list_2', 'sec_dest');

    const state = useAppStore.getState();
    expect(state.tasks['t1'].categoryId).toBe('list_2');
    expect(state.tasks['t1'].sectionId).toBe('sec_dest');
    expect(state.tasks['t2'].categoryId).toBe('list_2');
    expect(state.tasks['t2'].sectionId).toBe('sec_dest');
    expect(state.tasks['t3'].categoryId).toBe('list_1');
  });

  it('setSectionTasksCompleted marca o desmarca en lote todas las tareas indicadas', () => {
    const store = useAppStore.getState();
    // Marcar todas como completadas
    store.setSectionTasksCompleted(['t1', 't3'], true);

    let state = useAppStore.getState();
    expect(state.tasks['t1'].status).toBe('completed');
    expect(state.tasks['t3'].status).toBe('completed');

    // Desmarcar
    store.setSectionTasksCompleted(['t1', 't2', 't3'], false);
    state = useAppStore.getState();
    expect(state.tasks['t1'].status).toBe('pending');
    expect(state.tasks['t2'].status).toBe('pending');
    expect(state.tasks['t3'].status).toBe('pending');
  });
});
