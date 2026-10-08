// Implementación en memoria del subconjunto de Prisma que usa el servidor.
// Sirve para tests rápidos de la API y para levantar un backend local sin PostgreSQL.
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { Prisma } from '@prisma/client';

const clone = (v) => (v === undefined ? v : structuredClone(v));

function matches(row, where = {}) {
  for (const [key, cond] of Object.entries(where)) {
    const value = row[key];
    if (cond === Prisma.DbNull) {
      if (value !== null && value !== undefined) return false;
      continue;
    }
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('in' in cond && !cond.in.includes(value)) return false;
      if ('lt' in cond && !(value instanceof Date && value.getTime() < new Date(cond.lt).getTime())) return false;
      if ('lte' in cond && !(value instanceof Date && value.getTime() <= new Date(cond.lte).getTime())) return false;
      if ('gt' in cond && !(value instanceof Date && value.getTime() > new Date(cond.gt).getTime())) return false;
      if ('equals' in cond && cond.equals === Prisma.DbNull && value !== null && value !== undefined) return false;
      if ('equals' in cond && cond.equals !== Prisma.DbNull && !isDeepStrictEqual(value, cond.equals)) return false;
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
      if (data.id && rows.some((r) => r.id === data.id)) {
        const error = new Error(`Unique constraint failed on id ${data.id}`);
        error.code = 'P2002';
        throw error;
      }
      if (data.key && rows.some((r) => r.key === data.key)) {
        const error = new Error(`Unique constraint failed on key ${data.key}`);
        error.code = 'P2002';
        throw error;
      }
      const row = touch({ ...defaults, id: data.id || randomUUID(), createdAt: new Date(), deletedAt: null, ...clone(data) });
      rows.push(row);
      return clone(row);
    },
    async update({ where, data }) {
      const row = rows.find((r) => matches(r, where));
      if (!row) throw new Error('Record to update not found');
      for (const [k, v] of Object.entries(clone(data))) {
        row[k] = v && typeof v === 'object' && 'increment' in v ? (row[k] || 0) + v.increment : v;
      }
      touch(row);
      return clone(row);
    },
    async updateMany({ where, data }) {
      let count = 0;
      for (const row of rows) {
        if (!matches(row, where)) continue;
        Object.assign(row, clone(data));
        touch(row);
        count++;
      }
      return { count };
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
    limits: { rows: [] },
    cronLeases: { rows: [] },
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
    rateLimit: createDelegate(stores.limits, { hasUpdatedAt: false }),
    cronLease: createDelegate(stores.cronLeases, { hasUpdatedAt: false }),
    async $transaction(ops) {
      return Promise.all(ops);
    },
  };
}
