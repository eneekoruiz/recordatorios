import { openDB } from 'idb';
import type { StateStorage } from 'zustand/middleware';

const dbPromise = openDB('app-store-db', 1, {
  upgrade(db) {
    db.createObjectStore('keyval');
  },
});

export const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await dbPromise).get('keyval', name) || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await (await dbPromise).put('keyval', value, name);
  },
  removeItem: async (name: string): Promise<void> => {
    await (await dbPromise).delete('keyval', name);
  },
};
