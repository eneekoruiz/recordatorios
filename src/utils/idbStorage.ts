import { openDB } from 'idb';
import type { StateStorage } from 'zustand/middleware';

// Apertura perezosa: importar el store no debe tocar IndexedDB (y así también
// funciona en entornos sin navegador, como los tests unitarios).
let dbPromiseCache: ReturnType<typeof openDB> | null = null;
const getDb = () => {
  if (!dbPromiseCache) {
    dbPromiseCache = openDB('app-store-db', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('keyval')) db.createObjectStore('keyval');
      },
    });
  }
  return dbPromiseCache;
};

const withTimeout = async <T>(operation: Promise<T>, fallback: T): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(fallback), 1800);
  });
  try {
    return await Promise.race([operation, timeout]);
  } catch {
    return fallback;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

export const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return withTimeout(getDb().then((db) => db.get('keyval', name)), null);
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await (await getDb()).put('keyval', value, name);
    } catch {
      // Persistence must never block the usable interface.
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await (await getDb()).delete('keyval', name);
    } catch {
      // Keep logout/reset resilient in restricted browser contexts.
    }
  },
};
