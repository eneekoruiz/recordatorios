import { beforeEach, describe, expect, it, vi } from 'vitest';

const { openDBMock } = vi.hoisted(() => ({ openDBMock: vi.fn() }));
vi.mock('idb', () => ({ openDB: openDBMock }));

describe('IndexedDB persistence failure recovery', () => {
  beforeEach(() => {
    openDBMock.mockReset();
    vi.resetModules();
  });

  it('retains a failed state snapshot and retries the latest value', async () => {
    const { getPersistenceFailure, idbStorage, retryPendingStorageWrites } = await import('../../src/utils/idbStorage');
    openDBMock.mockRejectedValueOnce(new Error('quota'));

    await idbStorage.setItem('reminders-storage', 'old-snapshot');
    expect(getPersistenceFailure()).toMatchObject({ operation: 'write', pendingWrites: 1 });

    const put = vi.fn().mockResolvedValue(undefined);
    const remove = vi.fn().mockResolvedValue(undefined);
    openDBMock.mockResolvedValueOnce({ put, delete: remove });
    const retried = await retryPendingStorageWrites();

    expect(retried).toBe(true);
    expect(put).toHaveBeenCalledWith('keyval', 'old-snapshot', 'reminders-storage');
    expect(getPersistenceFailure()).toBeNull();
  });

  it('rejects a failed hydration read instead of returning an empty store', async () => {
    const { getPersistenceFailure, idbStorage } = await import('../../src/utils/idbStorage');
    openDBMock.mockRejectedValueOnce(new Error('database blocked'));

    await expect(idbStorage.getItem('reminders-storage')).rejects.toThrow('database blocked');
    expect(getPersistenceFailure()).toMatchObject({ operation: 'read' });
  });

  it('reports a hanging write while keeping later snapshots serialized behind it', async () => {
    vi.useFakeTimers();
    try {
      const { getPersistenceFailure, idbStorage } = await import('../../src/utils/idbStorage');
      let finishFirstWrite!: () => void;
      const firstWrite = new Promise<void>((resolve) => { finishFirstWrite = resolve; });
      const put = vi.fn()
        .mockImplementationOnce(() => firstWrite)
        .mockResolvedValue(undefined);
      openDBMock.mockResolvedValueOnce({ put, delete: vi.fn() });

      const oldSnapshotWrite = idbStorage.setItem('reminders-storage', 'old');
      await vi.advanceTimersByTimeAsync(3501);
      expect(getPersistenceFailure()).toMatchObject({ operation: 'write', pendingWrites: 1 });

      const latestSnapshotWrite = idbStorage.setItem('reminders-storage', 'latest');
      expect(put).toHaveBeenCalledTimes(1);
      finishFirstWrite();
      await Promise.all([oldSnapshotWrite, latestSnapshotWrite]);

      expect(put.mock.calls.map((call) => call[1])).toEqual(['old', 'latest']);
      expect(getPersistenceFailure()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
