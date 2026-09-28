import { describe, it, expect } from 'vitest';
import { sanitizeTaskHierarchy, sanitizeSectionHierarchy, useAppStore } from '../../src/store/useAppStore';
import type { TaskItem, ListSection } from '../../src/models/Task';

describe('Hierarchy Sanitization and Cycle Protection', () => {
  it('cures self-parenting tasks (task.parentId === task.id)', () => {
    const tasks: Record<string, TaskItem> = {
      'task-1': {
        id: 'task-1',
        title: 'Corrupted Task',
        type: 'task',
        parentId: 'task-1',
        created_at: new Date().toISOString()
      } as TaskItem
    };

    const sanitized = sanitizeTaskHierarchy(tasks);
    expect(sanitized['task-1'].parentId).toBeUndefined();
  });

  it('cures orphaned parentId when parent task does not exist or is deleted', () => {
    const tasks: Record<string, TaskItem> = {
      'child-1': {
        id: 'child-1',
        title: 'Child Task',
        type: 'task',
        parentId: 'missing-parent',
        created_at: new Date().toISOString()
      } as TaskItem,
      'child-2': {
        id: 'child-2',
        title: 'Child with deleted parent',
        type: 'task',
        parentId: 'deleted-parent',
        created_at: new Date().toISOString()
      } as TaskItem,
      'deleted-parent': {
        id: 'deleted-parent',
        title: 'Deleted Parent',
        type: 'task',
        deleted_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      } as TaskItem
    };

    const sanitized = sanitizeTaskHierarchy(tasks);
    expect(sanitized['child-1'].parentId).toBeUndefined();
    expect(sanitized['child-2'].parentId).toBeUndefined();
  });

  it('breaks task parent cycles (A -> B -> A)', () => {
    const tasks: Record<string, TaskItem> = {
      'task-a': {
        id: 'task-a',
        title: 'Task A',
        type: 'task',
        parentId: 'task-b',
        created_at: new Date().toISOString()
      } as TaskItem,
      'task-b': {
        id: 'task-b',
        title: 'Task B',
        type: 'task',
        parentId: 'task-a',
        created_at: new Date().toISOString()
      } as TaskItem
    };

    const sanitized = sanitizeTaskHierarchy(tasks);
    // Cycle is broken so at least one task is made a root and rendered
    const hasRoot = !sanitized['task-a'].parentId || !sanitized['task-b'].parentId;
    expect(hasRoot).toBe(true);
  });

  it('cures self-parenting and cyclic sections', () => {
    const sections: ListSection[] = [
      {
        id: 'sec-1',
        listId: 'list-1',
        name: 'Section 1',
        parentId: 'sec-1'
      } as ListSection,
      {
        id: 'sec-2',
        listId: 'list-1',
        name: 'Section 2',
        parentId: 'sec-3'
      } as ListSection,
      {
        id: 'sec-3',
        listId: 'list-1',
        name: 'Section 3',
        parentId: 'sec-2'
      } as ListSection
    ];

    const sanitized = sanitizeSectionHierarchy(sections);
    expect(sanitized.find(s => s.id === 'sec-1')?.parentId).toBeUndefined();
    const sec2 = sanitized.find(s => s.id === 'sec-2');
    const sec3 = sanitized.find(s => s.id === 'sec-3');
    expect(!sec2?.parentId || !sec3?.parentId).toBe(true);
  });

  it('deleteListSection unparents child sections so they do not disappear', () => {
    const store = useAppStore.getState();
    store.addListSection({
      id: 'parent-sec',
      listId: 'my-list',
      name: 'Parent Section'
    });
    store.addListSection({
      id: 'child-sec',
      listId: 'my-list',
      name: 'Child Section',
      parentId: 'parent-sec'
    });

    store.deleteListSection('parent-sec');
    const currentSections = useAppStore.getState().listSections;
    const childSec = currentSections.find(s => s.id === 'child-sec');
    expect(childSec).toBeDefined();
    expect(childSec?.parentId).toBeUndefined();
    expect(childSec?.deleted_at).toBeUndefined();
  });

  describe('las reparaciones se propagan con la sincronización', () => {
    const task = (over: Partial<TaskItem>) => ({
      id: 'x', title: 't', type: 'task', status: 'pending', version: 3, updated_at: '2026-01-01T00:00:00.000Z', created_at: '2026-01-01T00:00:00.000Z', ...over,
    }) as TaskItem;

    it('sube version y updated_at al reparar una tarea', () => {
      const tasks = { a: task({ id: 'a', parentId: 'ausente' }) };
      const fixed = sanitizeTaskHierarchy(tasks).a;
      expect(fixed.parentId).toBeUndefined();
      expect(fixed.version).toBe(4);
      expect(fixed.updated_at! > '2026-01-01T00:00:00.000Z').toBe(true);
      expect(fixed._is_dirty).toBe(true);
    });

    it('un pull con la versión anterior no deshace la reparación', async () => {
      const { mergeServerTasks } = await import('../../src/sync/merge');
      const original = task({ id: 'a', parentId: 'ausente' });
      const fixed = sanitizeTaskHierarchy({ a: original }).a;
      const { tasks } = mergeServerTasks({ a: fixed }, [original]);
      expect(tasks.a.parentId).toBeUndefined();
    });

    it('devuelve el mismo objeto si no hay nada que reparar', () => {
      const tasks = { p: task({ id: 'p' }), c: task({ id: 'c', parentId: 'p' }) };
      expect(sanitizeTaskHierarchy(tasks)).toBe(tasks);
    });

    it('con `only` solo revisa las tareas indicadas', () => {
      const tasks = { a: task({ id: 'a', parentId: 'ausente' }), b: task({ id: 'b', parentId: 'ausente' }) };
      const out = sanitizeTaskHierarchy(tasks, ['a']);
      expect(out.a.parentId).toBeUndefined();
      expect(out.b.parentId).toBe('ausente');
    });

    it('las secciones reparadas actualizan updated_at', () => {
      const sections: ListSection[] = [{ id: 's1', listId: 'l', name: 'A', parentId: 's1', updated_at: '2026-01-01T00:00:00.000Z' } as ListSection];
      const out = sanitizeSectionHierarchy(sections)[0];
      expect(out.parentId).toBeUndefined();
      expect(out.updated_at! > '2026-01-01T00:00:00.000Z').toBe(true);
    });
  });
});
