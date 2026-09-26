// Implementación en memoria del subconjunto de Prisma que usa el servidor.
// Sirve para tests rápidos de la API y para levantar un backend local sin PostgreSQL.
import { randomUUID } from 'node:crypto';

const clone = (v) => (v === undefined ? v : structuredClone(v));

function matches(row, where = {}) {
  for (const [key, cond] of Object.entries(where)) {
    const value = row[key];
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('in' in cond && !cond.in.includes(value)) return false;
      if ('gt' in cond && !(value instanceof Date && value.getTime() > new Date(cond.gt).getTime())) return false;
    } else if (cond === null) {
      if (value !== null && value !== undefined) return false;
    } else if (value !== cond) {
      return false;
    }
  }
  return true;
}

function project(row, select) {
  if (!row) return row;
  if (!select) return clone(row);
  const out = {};
  for (const [k, on] of Object.entries(select)) if (on) out[k] = clone(row[k]);
  return out;
}

function createDelegate(store, { hasUpdatedAt = true, defaults = {} } = {}) {
  const touch = (row) => {
    if (hasUpdatedAt) {
      // Garantiza timestamps estrictamente crecientes, como haría la BD en la práctica.
      const now = Date.now();
      store.clock = Math.max(now, (store.clock || 0) + 1);
      row.updatedAt = new Date(store.clock);
    }
    return row;
  };
  const rows = store.rows;
  return {
    async findUnique({ where, select, include }) {
      const row = rows.find((r) => matches(r, where));
      if (!row) return null;
      const out = project(row, select);
      if (include?.list) out.list = clone(store.lists?.rows.find((l) => l.id === row.listId) || null);
      return out;
    },
    async findFirst({ where, select } = {}) {
      return project(rows.find((r) => matches(r, where)) || null, select);
    },
    async findMany({ where, select } = {}) {
      return rows.filter((r) => matches(r, where)).map((r) => project(r, select));
    },
    async create({ data }) {
      if (data.id && rows.some((r) => r.id === data.id)) throw new Error(`Unique constraint failed on id ${data.id}`);
      const row = touch({ ...defaults, id: data.id || randomUUID(), createdAt: new Date(), deletedAt: null, ...clone(data) });
      rows.push(row);
      return clone(row);
    },
    async update({ where, data }) {
      const row = rows.find((r) => matches(r, where));
      if (!row) throw new Error('Record to update not found');
      Object.assign(row, clone(data));
      touch(row);
      return clone(row);
    },
    async upsert({ where, create, update }) {
      const row = rows.find((r) => matches(r, where));
      if (row) return this.update({ where, data: update });
      return this.create({ data: create });
    },
    async delete({ where }) {
      const idx = rows.findIndex((r) => matches(r, where));
      if (idx === -1) throw new Error('Record to delete not found');
      const [removed] = rows.splice(idx, 1);
      return clone(removed);
    },
    async deleteMany({ where }) {
      const before = rows.length;
      for (let i = rows.length - 1; i >= 0; i--) if (matches(rows[i], where)) rows.splice(i, 1);
      return { count: before - rows.length };
    },
  };
}

export function createMemoryPrisma() {
  const stores = {
    users: { rows: [] },
    tasks: { rows: [] },
    cycles: { rows: [] },
    lists: { rows: [] },
    sections: { rows: [] },
    links: { rows: [] },
    push: { rows: [] },
  };
  stores.links.lists = stores.lists;
  return {
    _stores: stores,
    user: createDelegate(stores.users, { hasUpdatedAt: false, defaults: { preferences: null } }),
    task: createDelegate(stores.tasks),
    cycle: createDelegate(stores.cycles),
    list: createDelegate(stores.lists),
    listSection: createDelegate(stores.sections),
    sharedLink: createDelegate(stores.links, { hasUpdatedAt: false }),
    pushSubscription: createDelegate(stores.push, { hasUpdatedAt: false }),
    async $transaction(ops) {
      return Promise.all(ops);
    },
  };
}
