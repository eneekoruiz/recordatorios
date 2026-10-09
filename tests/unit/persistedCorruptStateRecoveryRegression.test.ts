import { beforeEach, describe, expect, it, vi } from 'vitest';

const { openDBMock } = vi.hoisted(() => ({ openDBMock: vi.fn() }));
vi.mock('idb', () => ({ openDB: openDBMock }));

describe('malformed persisted state recovery', () => {
  beforeEach(() => {
    openDBMock.mockReset();
    vi.resetModules();
  });

  it('backs up the exact old payload before quarantining a task with a non-string title', async () => {
    const rows = new Map<string, string>();
    const original = JSON.stringify({
      state: {
        tasks: {
          safe: { id: 'safe', title: 'Conservar', status: 'pending', categoryId: 'inbox' },
          broken: { id: 'broken', title: { imported: true }, status: 'pending' },
        },
        cycles: [], lists: [{ id: 'broken-list', name: { imported: true }, color: '#fff' }], listSections: [],
        userId: 'user-A',
      },
      version: 7,
    });
    rows.set('reminders-storage', original);
    openDBMock.mockResolvedValue({
      get: vi.fn(async (_store: string, key: string) => rows.get(key)),
      put: vi.fn(async (_store: string, value: string, key: string) => { rows.set(key, value); }),
      delete: vi.fn(async (_store: string, key: string) => { rows.delete(key); }),
    });

    const { useAppStore } = await import('../../src/store/useAppStore');
    await useAppStore.persist.rehydrate();

    const state = useAppStore.getState();
    expect(state.tasks).toMatchObject({ safe: { title: 'Conservar' } });
    expect(state.tasks.safe).toBeDefined();
    expect(state.tasks.broken).toBeUndefined();
    expect(state.lists).toEqual([]);
    expect(state.persistenceRecovery).toMatchObject({ quarantined: 2 });
    const backup = rows.get(state.persistenceRecovery!.backupKey);
    expect(backup).toBe(original);
    const sanitizedSnapshot = JSON.parse(rows.get('reminders-storage')!).state;
    expect(sanitizedSnapshot.tasks.broken).toBeUndefined();
    expect(sanitizedSnapshot.persistenceRecovery.backupKey).toBe(state.persistenceRecovery!.backupKey);
    expect(state.userId).toBe('user-A');

    state.setToken('token-B', 'user-B');
    expect(useAppStore.getState().persistenceRecovery).toBeNull();
    expect(useAppStore.getState().tasks.safe).toBeUndefined();
  });

  it('does not permit a logout snapshot to be overtaken by an older queued write', async () => {
    const rows = new Map<string, string>();
    let finishFirst!: () => void;
    const firstWrite = new Promise<void>(resolve => { finishFirst = resolve; });
    const put = vi.fn(async (_store: string, value: string, key: string) => {
      if (value === 'account-A-snapshot') await firstWrite;
      rows.set(key, value);
    });
    openDBMock.mockResolvedValue({ put, get: vi.fn(async (_store: string, key: string) => rows.get(key)), delete: vi.fn() });
    const { idbStorage } = await import('../../src/utils/idbStorage');

    const oldWrite = idbStorage.setItem('reminders-storage', 'account-A-snapshot');
    await vi.waitFor(() => expect(put).toHaveBeenCalledOnce());
    const logoutWrite = idbStorage.setItem('reminders-storage', 'logged-out-local-state');
    finishFirst();
    await Promise.all([oldWrite, logoutWrite]);

    expect(put.mock.calls.map(call => call[1])).toEqual(['account-A-snapshot', 'logged-out-local-state']);
    expect(rows.get('reminders-storage')).toBe('logged-out-local-state');
  });

  it('automatically restores quarantined tasks from backup if they pass resilient validation upon hydration', async () => {
    const rows = new Map<string, string>();
    const backupPayload = JSON.stringify({
      state: {
        tasks: {
          t1: { id: 't1', title: 'Tarea previamente apartada', parentId: '', cycle_id: '', dueDate: 1712839200000, status: 'pending', categoryId: 'list-1' },
          t2: { id: 't2', title: 'Segunda tarea', parentId: '', status: 'completed', categoryId: 'list-1' },
        },
        cycles: [], lists: [{ id: 'list-1', name: 'Lista' }], listSections: [],
        userId: 'user-A',
      },
      version: 9,
    });
    const backupKey = 'reminders-storage-recovery-test-key';
    rows.set(backupKey, backupPayload);

    const currentPayload = JSON.stringify({
      state: {
        tasks: {},
        cycles: [], lists: [{ id: 'list-1', name: 'Lista' }], listSections: [],
        userId: 'user-A',
        persistenceRecovery: {
          backupKey,
          reason: 'Se encontraron registros guardados con una estructura inválida',
          quarantined: 2,
          accountUserId: 'user-A',
        },
      },
      version: 9,
    });
    rows.set('reminders-storage', currentPayload);

    openDBMock.mockResolvedValue({
      get: vi.fn(async (_store: string, key: string) => rows.get(key)),
      put: vi.fn(async (_store: string, value: string, key: string) => { rows.set(key, value); }),
      delete: vi.fn(async (_store: string, key: string) => { rows.delete(key); }),
    });

    const { idbStorage } = await import('../../src/utils/idbStorage');
    await idbStorage.getItem('reminders-storage');
    const { useAppStore } = await import('../../src/store/useAppStore');
    await useAppStore.persist.rehydrate();

    const state = useAppStore.getState();
    expect(state.tasks.t1).toBeDefined();
    expect(state.tasks.t1.title).toBe('Tarea previamente apartada');
    expect(state.tasks.t2).toBeDefined();
    expect(state.persistenceRecovery).toBeNull();
  });
});
