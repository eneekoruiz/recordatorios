import { describe, it, expect } from 'vitest';
import { serverWins, mergeServerTasks, mergeServerCollection, clearDirtyIfUnchanged, reconcileTasks, chunk } from '../../src/sync/merge';

const t = (over: any) => ({ id: 'x', title: 't', status: 'pending', type: 'task', user_id: '', version: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', ...over });

describe('merge de sincronización', () => {
  it('gana la versión más alta y, a igualdad, la fecha más reciente', () => {
    expect(serverWins({ id: 'a', version: 2 }, { id: 'a', version: 1 })).toBe(true);
    expect(serverWins({ id: 'a', version: 1 }, { id: 'a', version: 2 })).toBe(false);
    expect(serverWins({ id: 'a', version: 1, updated_at: '2026-02-01' }, { id: 'a', version: 1, updated_at: '2026-01-01' })).toBe(true);
  });

  it('no pisa un cambio local pendiente más nuevo', () => {
    const local = { a: t({ id: 'a', title: 'local', version: 3, _is_dirty: true }) } as any;
    const { tasks } = mergeServerTasks(local, [t({ id: 'a', title: 'server', version: 2 })]);
    expect(tasks.a.title).toBe('local');
  });

  it('normaliza campos snake_case del servidor', () => {
    const { tasks } = mergeServerTasks({}, [t({ id: 'b', category_id: 'compras' })]);
    expect(tasks.b.categoryId).toBe('compras');
    expect(tasks.b._is_dirty).toBe(false);
  });

  it('elimina listas borradas en otro dispositivo', () => {
    const local = [{ id: 'l1', name: 'Viaje', updated_at: '2026-01-01T00:00:00Z' }] as any[];
    const { items } = mergeServerCollection(local, [{ id: 'l1', name: 'Viaje', deleted_at: '2026-02-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z' }]);
    expect(items).toHaveLength(0);
  });

  it('ignora registros de ajustes heredados', () => {
    const { items } = mergeServerCollection([], [{ id: 'user_preferences_smart_lists', icon: '{}' }], { skip: (l) => l.id.startsWith('user_preferences_') });
    expect(items).toHaveLength(0);
  });

  it('solo limpia el flag dirty si no hubo ediciones durante el envío', () => {
    const sent = t({ id: 'a', version: 2, updated_at: '2026-01-02T00:00:00Z', _is_dirty: true });
    expect(clearDirtyIfUnchanged(sent, sent)?._is_dirty).toBe(false);
    const editedMeanwhile = { ...sent, version: 3, updated_at: '2026-01-02T00:00:05Z' };
    expect(clearDirtyIfUnchanged(editedMeanwhile, sent)).toBeUndefined();
  });

  it('la reconciliación conserva la papelera y lo pendiente de subir', () => {
    const local = {
      gone: t({ id: 'gone' }),
      trash: t({ id: 'trash', deleted_at: '2026-01-05T00:00:00Z' }),
      pending: t({ id: 'pending', _is_dirty: true }),
      alive: t({ id: 'alive' }),
    } as any;
    const { tasks } = reconcileTasks(local, ['alive'], new Set());
    expect(Object.keys(tasks).sort()).toEqual(['alive', 'pending', 'trash']);
  });

  it('trocea en lotes', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
