import { describe, expect, it } from 'vitest';
import { useAppStore } from '../../src/store/useAppStore';

describe('JSON import store boundary', () => {
  it('rejects a malformed batch before replacing any current records', () => {
    const previous = {
      keep: { id: 'keep', title: 'Keep me', status: 'pending', created_at: '2026-10-01T00:00:00.000Z' },
    } as any;
    useAppStore.setState({ tasks: previous });

    expect(() => useAppStore.getState().importData(JSON.stringify({
      tasks: [{ id: 'bad', title: 42 }],
      cycles: [],
    }))).toThrow('Tareas, elemento 1');
    expect(useAppStore.getState().tasks).toEqual(previous);
  });

  it('imports validated task arrays into the id-keyed store atomically', () => {
    useAppStore.setState({ tasks: {} });
    useAppStore.getState().importData(JSON.stringify({
      tasks: [{ id: 'imported', title: 'Comprar té verde', status: 'pending' }],
      cycles: [],
      lists: [],
      listSections: [],
    }));

    expect(useAppStore.getState().tasks).toMatchObject({
      imported: { id: 'imported', title: 'Comprar té verde', categoryId: 'inbox', version: 1, _is_dirty: true },
    });
  });
});
