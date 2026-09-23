import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../src/store/useAppStore';
import type { TaskItem } from '../../src/models/Task';

describe('useAppStore — Papelera y gestión de borrados', () => {
  const baseTask = (overrides: Partial<TaskItem>): TaskItem => ({
    id: overrides.id || Math.random().toString(36).slice(2),
    user_id: 'u1',
    categoryId: 'list_test',
    type: 'task',
    title: 'Tarea de prueba',
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: 1,
    ...overrides,
  } as TaskItem);

  beforeEach(() => {
    useAppStore.setState({
      tasks: {
        t1: baseTask({ id: 't1', title: 'Tarea activa' }),
        t2: baseTask({ id: 't2', title: 'Tarea eliminada 1', deleted_at: new Date().toISOString() }),
        t3: baseTask({ id: 't3', title: 'Tarea eliminada 2', deleted_at: new Date().toISOString() }),
      },
      tombstones: { lists: [], cycles: [], tasks: [] },
    } as any);
  });

  it('restoreTask recupera una tarea eliminada borrando deleted_at y marcándola como dirty', () => {
    const store = useAppStore.getState();
    expect(store.tasks['t2'].deleted_at).toBeDefined();

    store.restoreTask('t2');

    const updated = useAppStore.getState().tasks['t2'];
    expect(updated.deleted_at).toBeUndefined();
    expect(updated._is_dirty).toBe(true);
  });

  it('permanentDeleteTask elimina la tarea del estado y añade tombstone _hard_delete', () => {
    const store = useAppStore.getState();
    expect(store.tasks['t2']).toBeDefined();

    store.permanentDeleteTask('t2');

    const state = useAppStore.getState();
    expect(state.tasks['t2']).toBeUndefined();
    expect(state.tombstones.tasks).toBeDefined();
    const tomb = state.tombstones.tasks.find((t: any) => t.id === 't2');
    expect(tomb).toBeDefined();
    expect((tomb as any)._hard_delete).toBe(true);
  });

  it('emptyTrash vacía todas las tareas con deleted_at y las registra para eliminación definitiva en el servidor', () => {
    const store = useAppStore.getState();
    expect(Object.keys(store.tasks).length).toBe(3);

    store.emptyTrash();

    const state = useAppStore.getState();
    // Solo debe quedar la tarea activa
    expect(Object.keys(state.tasks).length).toBe(1);
    expect(state.tasks['t1']).toBeDefined();
    expect(state.tasks['t2']).toBeUndefined();
    expect(state.tasks['t3']).toBeUndefined();

    // Las 2 tareas eliminadas deben estar en tombstones con _hard_delete
    expect(state.tombstones.tasks.length).toBe(2);
    expect(state.tombstones.tasks.every((t: any) => (t as any)._hard_delete === true)).toBe(true);
  });
});
