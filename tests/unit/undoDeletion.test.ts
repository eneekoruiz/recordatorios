import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore } from '../../src/store/useAppStore';
import { showUndoToast, undoLastDeletion, deleteCycleWithUndo } from '../../src/utils/undoToast';

const toasts: any[] = [];
beforeEach(() => {
  toasts.length = 0;
  vi.stubGlobal('window', Object.assign(globalThis.window ?? globalThis, {
    dispatchEvent: (e: CustomEvent) => { toasts.push(e.detail); return true; },
  }));
  useAppStore.setState({
    tasks: { a: { id: 'a', title: 'A', status: 'pending', categoryId: 'l', sectionId: 's1', cycle_id: 'cycle_x', version: 1 } as any },
    listSections: [{ id: 's1', listId: 'l', name: 'Sección', order: 0 } as any],
    cycles: [{ id: 'cycle_x', name: 'Cada 3 días', daysValue: 3, isPinned: false, icon: 'repeat' } as any],
    tombstones: { lists: [], cycles: [], tasks: [] },
  } as any);
});

describe('deshacer eliminaciones', () => {
  it('restoreListSection devuelve la sección con una fecha de edición nueva', () => {
    const before = new Date(Date.now() - 60_000).toISOString();
    useAppStore.setState({ listSections: [{ id: 's1', listId: 'l', name: 'Sección', order: 0, updated_at: before } as any] } as any);
    useAppStore.getState().deleteListSection('s1');
    expect(useAppStore.getState().listSections.find((s: any) => s.id === 's1')?.deleted_at).toBeTruthy();
    useAppStore.getState().restoreListSection('s1');
    const s: any = useAppStore.getState().listSections.find((x: any) => x.id === 's1');
    expect(s.deleted_at).toBeUndefined();
    expect(s._is_dirty).toBe(true);
    expect(new Date(s.updated_at).getTime()).toBeGreaterThan(new Date(before).getTime());
  });

  it('restoreCycle saca la frecuencia de las lápidas y deleteCycleWithUndo recoloca sus recordatorios', () => {
    const st = () => useAppStore.getState();
    deleteCycleWithUndo({
      getCycleName: () => 'Cada 3 días',
      getTaskIds: () => ['a'],
      remove: () => st().deleteCycle('cycle_x'),
      restore: () => st().restoreCycle('cycle_x'),
      relink: (id) => st().updateTask(id, { cycle_id: 'cycle_x' }),
    });
    expect(st().cycles.find((c) => c.id === 'cycle_x')).toBeUndefined();
    expect(st().tasks.a.cycle_id).toBeUndefined();
    expect(toasts.at(-1).message).toContain('Cada 3 días');

    toasts.at(-1).onUndo();
    expect(st().cycles.find((c) => c.id === 'cycle_x')).toBeTruthy();
    expect(st().tombstones.cycles.find((c: any) => c.id === 'cycle_x')).toBeUndefined();
    expect(st().tasks.a.cycle_id).toBe('cycle_x');
  });

  it('Ctrl/⌘+Z deshace solo la última eliminación y una sola vez', () => {
    const undo = vi.fn();
    showUndoToast('«A» eliminado', undo);
    expect(undoLastDeletion()).toBe(true);
    expect(undo).toHaveBeenCalledTimes(1);
    expect(undoLastDeletion()).toBe(false);
  });

  it('pasado el margen de 30 s ya no se deshace con el atajo', () => {
    vi.useFakeTimers();
    showUndoToast('«A» eliminado', vi.fn());
    vi.setSystemTime(Date.now() + 31_000);
    expect(undoLastDeletion()).toBe(false);
    vi.useRealTimers();
  });
});
