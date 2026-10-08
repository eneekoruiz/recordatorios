import { beforeEach, describe, expect, it, vi } from 'vitest';

const { openDBMock } = vi.hoisted(() => ({ openDBMock: vi.fn() }));
vi.mock('idb', () => ({ openDB: openDBMock }));

describe('primary store hydration write barrier', () => {
  beforeEach(() => {
    openDBMock.mockReset();
    vi.resetModules();
  });

  it('keeps the old bytes through a failed read, then restores and flushes the successfully merged snapshot', async () => {
    const original = JSON.stringify({
      state: {
        tasks: { old: { id: 'old', title: 'Persisted task', status: 'pending', categoryId: 'inbox' } },
        cycles: [], lists: [], listSections: [], userId: 'user-A',
      },
      version: 9,
    });
    const rows = new Map([['reminders-storage', original]]);
    const get = vi.fn(async (_store: string, key: string) => {
      return rows.get(key);
    });
    const put = vi.fn(async (_store: string, value: string, key: string) => { rows.set(key, value); });
    openDBMock
      .mockRejectedValueOnce(new Error('IndexedDB open blocked'))
      .mockResolvedValue({ get, put, delete: vi.fn() });

    const { getPersistenceFailure, retryPendingStorageWrites } = await import('../../src/utils/idbStorage');
    const { useAppStore } = await import('../../src/store/useAppStore');
    await vi.waitFor(() => expect(getPersistenceFailure()).toMatchObject({ operation: 'read' }));

    await useAppStore.setState({ tasks: { early: { id: 'early', title: 'Early default', status: 'pending', categoryId: 'inbox' } as any } });
    expect(rows.get('reminders-storage')).toBe(original);
    expect(getPersistenceFailure()).toMatchObject({ operation: 'read' });
    expect(openDBMock).toHaveBeenCalledOnce();
    expect(put).not.toHaveBeenCalled();

    await useAppStore.persist.rehydrate();
    await retryPendingStorageWrites();

    expect(useAppStore.getState().tasks.old).toMatchObject({ title: 'Persisted task' });
    const finalState = JSON.parse(rows.get('reminders-storage')!).state;
    expect(finalState.tasks.old).toMatchObject({ title: 'Persisted task' });
    expect(finalState.tasks).not.toHaveProperty('early');
    expect(finalState.hasHydrated).toBeUndefined();
    expect(put).toHaveBeenCalledOnce();
    expect(openDBMock).toHaveBeenCalledTimes(2);
  });
});
