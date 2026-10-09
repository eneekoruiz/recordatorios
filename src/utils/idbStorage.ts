import { openDB } from 'idb';
import type { StateStorage } from 'zustand/middleware';
import { sanitizePersistedCollections } from './persistedStateValidation';

export type PersistenceFailure = {
  operation: 'read' | 'write';
  message: string;
  pendingWrites: number;
};

export type PersistenceRecovery = {
  backupKey: string;
  reason: string;
  quarantined: number;
  accountUserId: string | null;
};

const OPEN_TIMEOUT_MS = 3500;
const WRITE_NOTICE_MS = 3500;
let dbPromiseCache: ReturnType<typeof openDB> | null = null;
let failure: PersistenceFailure | null = null;
let recovery: PersistenceRecovery | null = null;
const listeners = new Set<() => void>();
const pendingWrites = new Map<string, string | null>();
let drainPromise: Promise<void> | null = null;
let primaryHydrationPending = false;
const PRIMARY_STORAGE_KEY = 'reminders-storage';

const publish = (next: PersistenceFailure | null) => {
  failure = next ? { ...next, pendingWrites: pendingWrites.size } : null;
  listeners.forEach((listener) => listener());
};

export const getPersistenceFailure = () => failure;
export const getPersistenceRecovery = () => recovery;

/** Release only after Zustand has successfully merged and published the loaded state. */
export const completePrimaryHydration = async (): Promise<void> => {
  primaryHydrationPending = false;
  if (drainPromise) await drainPromise;
  await flushPendingWrites();
};

export const readPersistenceRecoveryBackup = async (key: string): Promise<string | null> => {
  const db = await withTimeout(getDb());
  return (await withTimeout(db.get('keyval', key))) ?? null;
};

export const clearPersistenceRecovery = () => {
  recovery = null;
};

export const restoreQuarantinedRecords = async (key: string): Promise<Record<string, unknown> | null> => {
  try {
    const raw = await readPersistenceRecoveryBackup(key);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as { state?: unknown };
    if (!envelope?.state || typeof envelope.state !== 'object') return null;
    const sanitized = sanitizePersistedCollections(envelope.state);
    const db = await withTimeout(getDb());
    await db.delete('keyval', key).catch(() => {});
    recovery = null;
    return sanitized.state;
  } catch (err) {
    console.error('Error recovering records from backup:', err);
    return null;
  }
};

export const subscribePersistenceFailure = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getDb = () => {
  if (!dbPromiseCache) {
    dbPromiseCache = openDB('app-store-db', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('keyval')) db.createObjectStore('keyval');
      },
    }).catch((error) => {
      dbPromiseCache = null;
      throw error;
    });
  }
  return dbPromiseCache;
};

const withTimeout = async <T>(operation: Promise<T>): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('IndexedDB tardó demasiado en responder')), OPEN_TIMEOUT_MS);
  });
  try {
    return await Promise.race([operation, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

/** Notify on a slow write without releasing the serialized write lock. */
const withWriteNotice = async <T>(operation: Promise<T>): Promise<T> => {
  const timeoutId = setTimeout(() => {
    publish({ operation: 'write', message: 'IndexedDB sigue guardando los cambios', pendingWrites: pendingWrites.size });
  }, WRITE_NOTICE_MS);
  try {
    return await operation;
  } finally {
    clearTimeout(timeoutId);
  }
};

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Error de almacenamiento local';

const flushPendingWrites = (): Promise<void> => {
  if (drainPromise) return drainPromise;
  const hasEligibleWrites = Array.from(pendingWrites.keys()).some(name => !primaryHydrationPending || name !== PRIMARY_STORAGE_KEY);
  if (!hasEligibleWrites) return Promise.resolve();
  drainPromise = (async () => {
    try {
      const db = await withWriteNotice(getDb());
      while (pendingWrites.size > 0) {
        const eligibleWrite = Array.from(pendingWrites.entries()).find(([name]) => !primaryHydrationPending || name !== PRIMARY_STORAGE_KEY);
        if (!eligibleWrite) break;
        const [name, value] = eligibleWrite;
        if (value === null) await withWriteNotice(db.delete('keyval', name));
        else await withWriteNotice(db.put('keyval', value, name));
        if (pendingWrites.get(name) === value) pendingWrites.delete(name);
      }
      if (failure?.operation !== 'read') publish(null);
    } catch (error) {
      publish({ operation: 'write', message: errorMessage(error), pendingWrites: pendingWrites.size });
    }
  })().finally(() => {
    drainPromise = null;
  });
  return drainPromise;
};

/** Retry the latest serialized Zustand snapshots retained after a failed write. */
export const retryPendingStorageWrites = async (): Promise<boolean> => {
  // Keep a timed-out IndexedDB operation serialized. Starting another write could
  // let a late old snapshot overwrite a newer one.
  if (drainPromise) return false;
  await flushPendingWrites();
  return pendingWrites.size === 0;
};

export const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      if (name === PRIMARY_STORAGE_KEY) {
        primaryHydrationPending = true;
        recovery = null;
      }
      const value = await withTimeout(getDb().then((db) => db.get('keyval', name)));
      let safeValue = value;
      if (typeof value === 'string' && name === 'reminders-storage') {
        const envelope = JSON.parse(value) as { state?: unknown; [key: string]: unknown };
        if (envelope?.state && typeof envelope.state === 'object' && !Array.isArray(envelope.state)) {
          let candidateState = envelope.state as Record<string, unknown>;
          const existingRecovery = candidateState.persistenceRecovery as PersistenceRecovery | undefined;

          // If there is an existing recovery backup, attempt auto-restoring records that now pass our resilient validation
          if (existingRecovery?.backupKey) {
            try {
              const db = await withTimeout(getDb());
              const backupRaw = await withTimeout(db.get('keyval', existingRecovery.backupKey));
              if (typeof backupRaw === 'string') {
                const backupEnvelope = JSON.parse(backupRaw) as { state?: unknown };
                if (backupEnvelope?.state && typeof backupEnvelope.state === 'object') {
                  const backupSanitized = sanitizePersistedCollections(backupEnvelope.state);
                  if (backupSanitized.quarantined === 0) {
                    const backupState = backupSanitized.state as Record<string, unknown>;
                    candidateState = {
                      ...candidateState,
                      ...backupState,
                      tasks: {
                        ...((backupState.tasks as Record<string, unknown>) || {}),
                        ...((candidateState.tasks as Record<string, unknown>) || {}),
                      },
                      persistenceRecovery: null,
                    };
                    recovery = null;
                    const restoredEnvelope = { ...envelope, state: candidateState };
                    const restoredRaw = JSON.stringify(restoredEnvelope);
                    // Write restored state back to primary storage so subsequent reads get the restored tasks
                    await withTimeout(db.put('keyval', restoredRaw, PRIMARY_STORAGE_KEY));
                    await db.delete('keyval', existingRecovery.backupKey).catch(() => {});
                  }
                }
              }
            } catch (recoveryErr) {
              console.warn('Error during auto-restoration of quarantined records:', recoveryErr);
            }
          }

          const sanitized = sanitizePersistedCollections(candidateState);
          if (sanitized.quarantined > 0) {
            const backupKey = `reminders-storage-recovery-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const db = await withTimeout(getDb());
            // Do not hand unsafe data to Zustand (which rewrites the merged state) until
            // a recoverable byte-for-byte copy exists under a separate IndexedDB key.
            await withTimeout(db.put('keyval', value, backupKey));
            recovery = {
              backupKey,
              reason: 'Se encontraron registros guardados con una estructura inválida; se apartaron para proteger el resto de los datos.',
              quarantined: sanitized.quarantined,
              accountUserId: typeof candidateState.userId === 'string'
                ? candidateState.userId as string
                : null,
            };
            const safeState = { ...sanitized.state, persistenceRecovery: recovery };
            safeValue = JSON.stringify({ ...envelope, state: safeState });
          } else {
            recovery = null;
            const cleanState = { ...sanitized.state, persistenceRecovery: null };
            safeValue = JSON.stringify({ ...envelope, state: cleanState });
          }
        }
      }
      if (failure?.operation === 'read') publish(null);
      return safeValue ?? null;
    } catch (error) {
      publish({ operation: 'read', message: errorMessage(error), pendingWrites: pendingWrites.size });
      // Reject hydration rather than treating a slow or failed read as an empty store.
      // Zustand then leaves persisted data untouched until the user retries hydration.
      throw error;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    pendingWrites.set(name, value);
    if (primaryHydrationPending && name === PRIMARY_STORAGE_KEY) return;
    await flushPendingWrites();
  },
  removeItem: async (name: string): Promise<void> => {
    pendingWrites.set(name, null);
    if (primaryHydrationPending && name === PRIMARY_STORAGE_KEY) return;
    await flushPendingWrites();
  },
};
