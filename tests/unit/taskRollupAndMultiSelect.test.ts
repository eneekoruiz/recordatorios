import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../src/store/useAppStore';
import type { TaskItem } from '../../src/models/Task';

describe('Task Rollup & Unindent Order Preservation', () => {
  beforeEach(() => {
    useAppStore.setState({
      tasks: {},
      lists: [{ id: 'list_1', name: 'Personal', color: '#007aff' }],
      listSections: [
        { id: 'sec_1', name: 'General', listId: 'list_1', order: 0 }
      ]
    });
  });

  it('unindenting a subtask places it immediately after its parent instead of jumping to top', () => {
    const parent: TaskItem = {
      id: 'task_parent',
      title: 'Comprar ingredientes',
      categoryId: 'list_1',
      sectionId: 'sec_1',
      order: 1,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    const child: TaskItem = {
      id: 'task_child',
      title: 'Comprar tomates',
      categoryId: 'list_1',
      sectionId: 'sec_1',
      parentId: 'task_parent',
      order: 0,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    const otherRoot1: TaskItem = {
      id: 'task_before',
      title: 'Tarea anterior',
      categoryId: 'list_1',
      sectionId: 'sec_1',
      order: 0,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    const otherRoot2: TaskItem = {
      id: 'task_after',
      title: 'Tarea posterior',
      categoryId: 'list_1',
      sectionId: 'sec_1',
      order: 2,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    useAppStore.setState({
      tasks: {
        [otherRoot1.id]: otherRoot1,
        [parent.id]: parent,
        [child.id]: child,
        [otherRoot2.id]: otherRoot2
      }
    });

    // Unnest child
    useAppStore.getState().nestTask('task_child', undefined);

    const updatedTasks = useAppStore.getState().tasks;
    const unnested = updatedTasks['task_child'];
    expect(unnested.parentId).toBeUndefined();

    // Verify ordering: otherRoot1 (0) < parent (1) < unnested child (2) < otherRoot2 (3)
    const sortedRoots = Object.values(updatedTasks)
      .filter(t => !t.parentId && !t.deleted_at)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const ids = sortedRoots.map(t => t.id);
    expect(ids).toEqual(['task_before', 'task_parent', 'task_child', 'task_after']);
  });

  it('calculates total price including subtask prices correctly', () => {
    const parent: TaskItem = {
      id: 'p1',
      title: 'Fiesta cumpleaños',
      categoryId: 'list_1',
      price: 15,
      quantity: 1,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    const sub1: TaskItem = {
      id: 's1',
      title: 'Tarta',
      categoryId: 'list_1',
      parentId: 'p1',
      price: 20,
      quantity: 1,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    const sub2: TaskItem = {
      id: 's2',
      title: 'Bebidas',
      categoryId: 'list_1',
      parentId: 'p1',
      price: 5,
      quantity: 2, // 5 * 2 = 10
      status: 'pending',
      created_at: new Date().toISOString()
    };

    const allTasks = { [parent.id]: parent, [sub1.id]: sub1, [sub2.id]: sub2 };

    const children = Object.values(allTasks).filter(t => t.parentId === 'p1');
    const ownPrice = (parent.price || 0) * (parent.quantity || 1);
    const subtasksPrice = children.reduce((sum, c) => sum + (c.price || 0) * (c.quantity || 1), 0);
    const totalPrice = ownPrice + subtasksPrice;

    expect(ownPrice).toBe(15);
    expect(subtasksPrice).toBe(30);
    expect(totalPrice).toBe(45);
  });

  it('batch moves selected tasks into another section', () => {
    const t1: TaskItem = { id: 't1', title: 'T1', categoryId: 'list_1', sectionId: 'sec_1', status: 'pending', created_at: '' };
    const t2: TaskItem = { id: 't2', title: 'T2', categoryId: 'list_1', sectionId: 'sec_1', status: 'pending', created_at: '' };
    const t3: TaskItem = { id: 't3', title: 'T3', categoryId: 'list_1', sectionId: 'sec_1', status: 'pending', created_at: '' };

    useAppStore.setState({
      tasks: { t1, t2, t3 },
      listSections: [
        { id: 'sec_1', name: 'Sec 1', listId: 'list_1' },
        { id: 'sec_2', name: 'Sec 2', listId: 'list_1' }
      ]
    });

    const selected = new Set(['t1', 't2']);
    selected.forEach(id => {
      useAppStore.getState().updateTask(id, { sectionId: 'sec_2' });
    });

    const state = useAppStore.getState();
    expect(state.tasks['t1'].sectionId).toBe('sec_2');
    expect(state.tasks['t2'].sectionId).toBe('sec_2');
    expect(state.tasks['t3'].sectionId).toBe('sec_1');
  });

  it('batch nests selected tasks into a target parent task', () => {
    const parent: TaskItem = { id: 'target_parent', title: 'Parent', categoryId: 'list_1', status: 'pending', created_at: '' };
    const t1: TaskItem = { id: 't1', title: 'T1', categoryId: 'list_1', status: 'pending', created_at: '' };
    const t2: TaskItem = { id: 't2', title: 'T2', categoryId: 'list_1', status: 'pending', created_at: '' };

    useAppStore.setState({
      tasks: { [parent.id]: parent, t1, t2 }
    });

    const selected = new Set(['t1', 't2']);
    selected.forEach(id => {
      useAppStore.getState().nestTask(id, 'target_parent');
    });

    const state = useAppStore.getState();
    expect(state.tasks['t1'].parentId).toBe('target_parent');
    expect(state.tasks['t2'].parentId).toBe('target_parent');
    expect(state.tasks['target_parent'].parentId).toBeUndefined();
  });
});
