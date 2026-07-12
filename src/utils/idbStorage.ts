import { openDB } from 'idb';
import type { StateStorage } from 'zustand/middleware';

const dbPromise = openDB('app-store-db', 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('keyval')) db.createObjectStore('keyval');
  },
});

const withTimeout = async <T>(operation: Promise<T>, fallback: T): Promise<T> => {
  let timeoutId: number | undefined;
  const timeout = new Promise<T>((resolve) => {
    timeoutId = window.setTimeout(() => resolve(fallback), 1800);
  });
  try {
    return await Promise.race([operation, timeout]);
  } catch {
    return fallback;
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
};

export const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return withTimeout(dbPromise.then(db => db.get('keyval', name)), null);
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await (await dbPromise).put('keyval', value, name);
    } catch {
      // Persistence must never block the usable interface.
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await (await dbPromise).delete('keyval', name);
    } catch {
      // Keep logout/reset resilient in restricted browser contexts.
    }
  },
};
