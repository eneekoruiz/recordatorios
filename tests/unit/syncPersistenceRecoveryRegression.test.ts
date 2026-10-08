import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { syncManager } from '../../src/sync/syncManager';
import { useAppStore } from '../../src/store/useAppStore';

const manager = syncManager as unknown as {
  pull: (token: string, context: { userId: string | null; generation: number }, full?: boolean) => Promise<void>;
  push: (token: string, context: { userId: string | null; generation: number }) => Promise<void>;
  handleAuth: (response: Response, context: { userId: string | null; generation: number }, token: string) => void;
};

const jsonResponse = (payload: unknown, headers: Record<string, string> = {}) => ({
  ok: true,
  status: 200,
  headers: { get: (name: string) => headers[name] || null },
  json: async () => payload,
}) as Response;

describe('sync concurrency regression coverage', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { origin: 'http://localhost' } });
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    useAppStore.setState({ tasks: {}, tombstones: { tasks: [], lists: [], cycles: [] }, _preferences_dirty: false });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('discards a pull response from an account that was switched away from in flight', async () => {
    useAppStore.getState().setToken('token-A', 'user-A');
    const stateA = useAppStore.getState();
    const contextA = { userId: stateA.userId, generation: stateA.sessionGeneration };
    let resolveFetch!: (response: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve; }));
    vi.stubGlobal('fetch', fetchMock);

    const pull = manager.pull('token-A', contextA, true);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    useAppStore.getState().setToken('token-B', 'user-B');
    resolveFetch(jsonResponse({
      tasks: [{ id: 'private-A', title: 'Private to A', status: 'pending', version: 1, updated_at: '2026-10-08T10:00:00.000Z' }],
    }));
    await expect(pull).rejects.toThrow('sesión anterior');

    expect(useAppStore.getState().userId).toBe('user-B');
    expect(useAppStore.getState().tasks['private-A']).toBeUndefined();
  });

  it('does not refresh or expire a new account from an old response', () => {
    useAppStore.getState().setToken('token-A', 'user-A');
    const stateA = useAppStore.getState();
    const contextA = { userId: stateA.userId, generation: stateA.sessionGeneration };
    useAppStore.getState().setToken('token-B', 'user-B');

    expect(() => manager.handleAuth({
      status: 401,
      headers: { get: () => 'refreshed-token-A' },
    } as unknown as Response, contextA, 'token-A')).toThrow();
    expect(useAppStore.getState()).toMatchObject({ userId: 'user-B', token: 'token-B' });
  });

  it('keeps a preference edit dirty when it changes while its push is pending', async () => {
    useAppStore.getState().setToken('token-A', 'user-A');
    useAppStore.getState().setDisplayName('before');
    const initial = useAppStore.getState();
    const context = { userId: initial.userId, generation: initial.sessionGeneration };
    let resolveFetch!: (response: Response) => void;
    let sentBody: any;
    const fetchMock = vi.fn((_url: string, options: RequestInit) => {
      sentBody = JSON.parse(String(options.body));
      return new Promise<Response>((resolve) => { resolveFetch = resolve; });
    });
    vi.stubGlobal('fetch', fetchMock);

    const push = manager.push('token-A', context);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    useAppStore.getState().setDisplayName('after');
    resolveFetch(jsonResponse({}));
    await push;

    expect(sentBody.preferences.displayName).toBe('before');
    expect(useAppStore.getState()).toMatchObject({ displayName: 'after', _preferences_dirty: true });
  });

  it('keeps a newer tombstone when an older deletion push completes', async () => {
    useAppStore.getState().setToken('token-A', 'user-A');
    const deletedAt = '2026-10-08T10:00:00.000Z';
    const oldTombstone = { id: 'redeleted', title: 'Deleted', _hard_delete: true, _is_dirty: true, updated_at: deletedAt, version: 2 };
    useAppStore.setState({ tombstones: { tasks: [oldTombstone] as any, lists: [], cycles: [] } });
    const initial = useAppStore.getState();
    const context = { userId: initial.userId, generation: initial.sessionGeneration };
    let resolveFetch!: (response: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { resolveFetch = resolve; }));
    vi.stubGlobal('fetch', fetchMock);

    const push = manager.push('token-A', context);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const newerTombstone = { ...oldTombstone, updated_at: '2026-10-08T10:01:00.000Z', version: 3 };
    useAppStore.setState({ tombstones: { tasks: [newerTombstone] as any, lists: [], cycles: [] } });
    resolveFetch(jsonResponse({}));
    await push;

    expect(useAppStore.getState().tombstones.tasks).toEqual([newerTombstone]);
  });

  it('debounces a task-only permanent deletion for automatic sync', async () => {
    vi.useFakeTimers();
    try {
      useAppStore.getState().setToken('token-A', 'user-A');
      const syncNow = vi.spyOn(syncManager, 'syncNow').mockResolvedValue();
      useAppStore.setState({
        tombstones: {
          lists: [], cycles: [],
          tasks: [{ id: 'permanent-delete', title: 'Deleted', _hard_delete: true, _is_dirty: true } as any],
        },
      });

      expect(manager.hasPendingChanges()).toBe(true);
      await vi.advanceTimersByTimeAsync(400);
      expect(syncNow).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('reschedules a queued new-account sync after an old-account flight settles', async () => {
    try {
      (syncManager as any).isOnline = true;
      (syncManager as any).isSyncing = false;
      useAppStore.getState().setToken('token-A', 'user-A');
      expect(useAppStore.getState()).toMatchObject({ token: 'token-A', userId: 'user-A' });
      let resolveAccountAPull!: (response: Response) => void;
      let resolveAccountBPull!: () => void;
      const accountBPullSeen = new Promise<void>(resolve => { resolveAccountBPull = resolve; });
      const fetchMock = vi.fn((url: string, options: RequestInit) => {
        const token = (options.headers as Record<string, string>)?.Authorization;
        if (url.includes('/api/sync/pull') && token === 'Bearer token-A') {
          return new Promise<Response>(resolve => { resolveAccountAPull = resolve; });
        }
        if (url.includes('/api/sync/pull') && token === 'Bearer token-B') resolveAccountBPull();
        return Promise.resolve(jsonResponse({}));
      });
      vi.stubGlobal('fetch', fetchMock);

      const accountASync = syncManager.syncNow();
      await vi.waitFor(() => expect(fetchMock.mock.calls.some(([url, options]) => url.includes('/api/sync/pull') &&
        (options.headers as Record<string, string>)?.Authorization === 'Bearer token-A')).toBe(true));
      vi.useFakeTimers();
      useAppStore.getState().setToken('token-B', 'user-B');
      await syncManager.syncNow(); // queued while A is still in flight
      resolveAccountAPull(jsonResponse({}));
      await accountASync;

      await vi.advanceTimersByTimeAsync(400);
      await accountBPullSeen;
      await vi.waitFor(() => expect(useAppStore.getState().syncStatus).toBe('synced'));
      expect(fetchMock.mock.calls.some(([url, options]) => url.includes('/api/sync/pull') &&
        (options.headers as Record<string, string>)?.Authorization === 'Bearer token-B')).toBe(true);
      expect(useAppStore.getState().userId).toBe('user-B');
    } finally {
      (syncManager as any).isSyncing = false;
      (syncManager as any).pendingResync = false;
      if ((syncManager as any).debounceTimeout) clearTimeout((syncManager as any).debounceTimeout);
      (syncManager as any).debounceTimeout = null;
      vi.useRealTimers();
    }
  });
});
