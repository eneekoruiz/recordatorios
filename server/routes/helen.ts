import { createHash, randomUUID } from 'node:crypto';
import express from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { getTaskPeriodicity } from '../../shared/periodicity.js';
import { isDone, safeTimeZone } from '../notifications.js';
import { preferencesEqualsFilter } from '../security.js';
import { clientIdOf, scopedId, toClientPayload } from '../syncUtils.js';
import { isAllowedPushEndpoint } from '../app.js';

const date = z.iso.datetime({ offset: true });
const patchSchema = z.object({ text: z.string().trim().min(1).max(300).optional(), list: z.string().min(1).max(100).optional(), status: z.enum(['open', 'done']).optional(), priority: z.enum(['high', 'normal', 'low']).optional(), due: date.nullable().optional() }).strict();
const modeSchema = z.object({ mode: z.enum(['normal', 'examenes', 'vacaciones']), updatedAt: date, until: date.optional(), reason: z.string().max(500).optional(), expectedUpdatedAt: date }).strict();
const syncSchema = z.object({ mutations: z.array(z.object({ id: z.string().min(1).max(200), expectedVersion: z.number().int().min(0).nullable(), patch: patchSchema.optional(), deleted: z.boolean().optional() }).strict()).max(200).refine((items) => new Set(items.map((item) => item.id)).size === items.length, 'Duplicate mutation ids').refine((items) => items.every((item) => item.expectedVersion !== null || item.patch?.text), 'New tasks need text'), mode: modeSchema.optional() }).strict();
const EPOCH = new Date(0).toISOString();
const object = (value: any): Record<string, any> => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
export function helenListKey(value: string): string {
  const folded = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/^(?:la |mi |my |the )?(?:lista de (?:la )?)?/, '');
  if (['compra', 'compras', 'supermercado', 'super', 'shopping', 'shopping list', 'groceries'].includes(folded)) return 'compra';
  if (['', 'inbox', 'tasks', 'tareas', 'pendientes'].includes(folded)) return 'inbox';
  return folded.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'inbox';
}
function currentMode(preferences: any) {
  const raw = object(object(preferences).activeMode);
  const until = raw.until && Number.isFinite(new Date(raw.until).getTime()) ? new Date(raw.until).toISOString() : undefined;
  const updatedAt = raw.updatedAt && Number.isFinite(new Date(raw.updatedAt).getTime()) ? new Date(raw.updatedAt).toISOString() : EPOCH;
  return { mode: ['normal', 'examenes', 'vacaciones'].includes(raw.mode) && (!until || new Date(until).getTime() > Date.now()) ? raw.mode : 'normal', updatedAt, ...(until ? { until } : {}), ...(raw.reason ? { reason: String(raw.reason).slice(0, 500) } : {}) };
}
function done(payload: any, periodicity: string | null, now: Date, timeZone: string): boolean {
  if (periodicity && payload.targetCount > 1 && !isDone({ completionHistory: [new Date(payload.updated_at || 0).getTime()] }, periodicity, now, timeZone)) return false;
  return isDone(payload, periodicity, now, timeZone);
}
export function createHelenRouter(context: AppContext) {
  const router = express.Router();
  const { prisma, authenticateToken, apiLimiter, clients, pushSender } = context;
  async function snapshot(userId: string) {
    const [rows, listRows, sectionRows, user] = await Promise.all([
      prisma.task.findMany({ where: { userId }, take: 5001 }),
      prisma.list.findMany({ where: { userId, deletedAt: null }, take: 5001 }),
      prisma.listSection.findMany({ where: { userId, deletedAt: null }, take: 5001 }),
      prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } }),
    ]);
    if (rows.length > 5000 || listRows.length > 5000 || sectionRows.length > 5000) throw Object.assign(new Error('Demasiados registros para sincronizar con HELEN'), { status: 413 });
    const preferred = <T extends { id: string }>(items: T[]): T[] => {
      const found = new Map<string, T>();
      for (const row of items) {
        const id = clientIdOf(userId, row.id);
        if (!found.has(id) || row.id === scopedId(userId, id)) found.set(id, row);
      }
      return [...found.values()];
    };
    const lists = preferred(listRows).map((row) => toClientPayload(userId, row));
    const sections = preferred(sectionRows).map((row) => toClientPayload(userId, row));
    const preferences = object(user?.preferences);
    return { rows: preferred(rows), lists, sections, preferences, timeZone: safeTimeZone(preferences.timeZone || preferences.timezone) };
  }
  function project(userId: string, row: any, data: Awaited<ReturnType<typeof snapshot>>) {
    const payload = object(row.payload);
    const now = new Date();
    const periodicity = getTaskPeriodicity(payload, data.sections, data.lists);
    const completed = done(payload, periodicity, now, data.timeZone);
    const category = payload.categoryId || payload.category_id || 'inbox';
    const list = data.lists.find((item: any) => item.id === category);
    const iso = (value: any, fallback: string) => Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString() : fallback;
    const updated = iso(row.updatedAt, iso(payload.updated_at, EPOCH));
    const completions = [...new Set([...(Array.isArray(payload.completionHistory) ? payload.completionHistory : []), ...(payload.completed_at ? [payload.completed_at] : [])].map((value) => new Date(value).getTime()).filter((at) => Number.isFinite(at) && at >= 0 && at <= now.getTime()).map((at) => new Date(at).toISOString()))].slice(-10000);
    return { id: clientIdOf(userId, row.id), version: Math.max(0, Number.isSafeInteger(payload.version) ? payload.version : 0), deleted: Boolean(row.deletedAt || payload.deleted_at), task: { text: String(payload.title || payload.text || '(sin título)').slice(0, 300), list: helenListKey(String(list?.name || category)), status: completed ? 'done' : 'open', priority: ['high', 'normal', 'low'].includes(payload.priority) ? payload.priority : 'normal', created: iso(payload.created_at || payload.createdAt, updated), updated, completions, ...(completed ? { done: iso(payload.completed_at || payload.completionHistory?.at(-1), updated) } : {}), ...(payload.dueDate && Number.isFinite(new Date(payload.dueDate).getTime()) ? { due: new Date(payload.dueDate).toISOString() } : {}) } };
  }
  const notify = (userId: string) => { for (const response of clients.get(userId) || []) { try { response.write('data: check_sync\n\n'); } catch { /* Closed clients are removed by their SSE handler. */ } } };
  const failure = (res: express.Response, error: any) => res.status(error?.status || 503).json({ error: error?.status === 413 ? error.message : 'No se pudo completar la operación de HELEN.' });
  router.get('/helen/sync', apiLimiter, authenticateToken, async (req, res) => {
    const raw = req.query.since;
    if (raw !== undefined && (typeof raw !== 'string' || !/^\d{1,16}$/.test(raw) || !Number.isSafeInteger(Number(raw)))) return res.status(400).json({ error: 'since no válido' });
    try {
      const userId = req.user!.id;
      const serverTime = Date.now() - 5000;
      const data = await snapshot(userId);
      res.json({ accountId: userId, serverTime, tasks: data.rows.filter((row) => !raw || new Date(row.updatedAt).getTime() > Number(raw)).map((row) => project(userId, row, data)), activeIds: data.rows.filter((row) => !row.deletedAt && !object(row.payload).deleted_at).map((row) => clientIdOf(userId, row.id)), mode: currentMode(data.preferences), lists: data.lists.map((list: any) => ({ id: list.id, name: list.name, key: helenListKey(String(list.name || list.id)) })), sections: data.sections, timeZone: data.timeZone });
    } catch (error) { failure(res, error); }
  });
  router.post('/helen/sync', apiLimiter, authenticateToken, async (req, res) => {
    const parsed = syncSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Mutaciones de HELEN no válidas' });
    try {
      const userId = req.user!.id;
      const data = await snapshot(userId);
      const creates = parsed.data.mutations.filter((item) => item.expectedVersion === null && !data.rows.some((row) => clientIdOf(userId, row.id) === item.id)).length;
      const missingLists = new Set(parsed.data.mutations.map((item) => item.patch?.list).filter((name): name is string => name !== undefined).map(helenListKey).filter((key) => key !== 'inbox' && !data.lists.some((list: any) => helenListKey(String(list.name || list.id)) === key || list.id === key)));
      if (data.rows.length + creates > 5000 || data.lists.length + missingLists.size > 5000) return res.status(413).json({ error: 'Demasiados registros para sincronizar con HELEN' });
      const applied: any[] = [];
      const conflicts: any[] = [];
      for (const mutation of parsed.data.mutations) {
        const existing = data.rows.find((row) => clientIdOf(userId, row.id) === mutation.id);
        const version = existing ? project(userId, existing, data).version : null;
        if (version !== mutation.expectedVersion) { if (existing) conflicts.push(project(userId, existing, data)); else conflicts.push({ id: mutation.id, version: 0, deleted: true, task: { text: '(eliminado)', list: 'inbox', status: 'open', priority: 'normal', created: EPOCH, updated: EPOCH } }); continue; }
        const payload: any = { ...object(existing?.payload) };
        const patch = mutation.patch || {};
        const now = new Date();
        const stamp = new Date(Math.max(now.getTime(), new Date(existing?.updatedAt || 0).getTime() + 1)).toISOString();
        if (!existing && !patch.text) return res.status(400).json({ error: 'Una tarea nueva necesita texto' });
        if (patch.text !== undefined) payload.title = patch.text;
        if (patch.list !== undefined || !existing) {
          const key = helenListKey(patch.list || 'inbox');
          let list = data.lists.find((item: any) => helenListKey(String(item.name || item.id)) === key || item.id === key);
          if (!list && key !== 'inbox') {
            const id = `helen-list-${key}`;
            const created = { id, name: key === 'compra' ? 'Compra' : patch.list, version: 1, updated_at: stamp };
            try { await prisma.list.create({ data: { id: scopedId(userId, id), userId, payload: created } }); } catch (error) { if ((error as any)?.code !== 'P2002') throw error; }
            list = created;
            data.lists.push(created);
          }
          payload.categoryId = list?.id || key;
        }
        if (patch.priority !== undefined) payload.priority = patch.priority;
        if (patch.due !== undefined) payload.dueDate = patch.due;
        const periodicity = getTaskPeriodicity(payload, data.sections, data.lists);
        if (patch.status !== undefined) {
          const history = Array.isArray(payload.completionHistory) ? [...payload.completionHistory] : [];
          const already = done(payload, periodicity, now, data.timeZone);
          if (patch.status === 'done') {
            if (!already) history.push(now.getTime());
            payload.status = periodicity ? 'pending' : 'completed';
            payload.completionHistory = history;
            payload.completed_at = periodicity ? null : stamp;
            payload.completed = !periodicity;
            if (payload.targetCount > 1) payload.currentCount = payload.targetCount;
          } else {
            payload.status = 'pending'; payload.completed_at = null; payload.completed = false;
            if (periodicity) payload.completionHistory = history.filter((at) => !isDone({ completionHistory: [Number(at)] }, periodicity, now, data.timeZone));
            if (payload.targetCount > 1) payload.currentCount = 0;
          }
        }
        payload.id = mutation.id;
        payload.version = (version ?? 0) + 1;
        payload.created_at ||= stamp;
        payload.updated_at = stamp;
        const deletedAt = mutation.deleted === undefined ? existing?.deletedAt || null : mutation.deleted ? now : null;
        if (mutation.deleted !== undefined) payload.deleted_at = mutation.deleted ? stamp : null;
        let row: any;
        if (existing) {
          const changed = await prisma.task.updateMany({ where: { id: existing.id, userId, updatedAt: { equals: existing.updatedAt }, payload: { equals: existing.payload === null ? Prisma.JsonNull : existing.payload } }, data: { payload, deletedAt, updatedAt: new Date(stamp) } });
          row = await prisma.task.findFirst({ where: { id: existing.id, userId } });
          if (!changed.count) { conflicts.push(project(userId, row || existing, data)); continue; }
        } else {
          try { row = await prisma.task.create({ data: { id: scopedId(userId, mutation.id), userId, payload, deletedAt } }); }
          catch (error) {
            if ((error as any)?.code !== 'P2002') throw error;
            row = await prisma.task.findFirst({ where: { id: scopedId(userId, mutation.id), userId } });
            if (row) conflicts.push(project(userId, row, data));
            continue;
          }
          data.rows.push(row);
        }
        applied.push(project(userId, row, data));
      }
      let mode: any;
      let modeConflict: boolean | undefined;
      if (parsed.data.mode) {
        const incoming = parsed.data.mode;
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
        const old = object(user?.preferences);
        const previous = currentMode(old);
        if (previous.updatedAt !== incoming.expectedUpdatedAt) { mode = previous; modeConflict = true; }
        else {
          const activeMode = { mode: incoming.mode, updatedAt: new Date(Math.max(Date.now(), new Date(previous.updatedAt).getTime() + 1)).toISOString(), ...(incoming.until ? { until: incoming.until } : {}), ...(incoming.reason ? { reason: incoming.reason } : {}) };
          const changed = await prisma.user.updateMany({ where: { id: userId, preferences: preferencesEqualsFilter(user?.preferences) }, data: { preferences: { ...old, activeMode, updated_at: activeMode.updatedAt } } });
          modeConflict = !changed.count;
          mode = changed.count ? currentMode({ activeMode }) : currentMode((await prisma.user.findUnique({ where: { id: userId } }))?.preferences);
        }
      }
      if (applied.length || (mode && !modeConflict)) notify(userId);
      res.json({ accountId: userId, applied, conflicts, ...(mode ? { mode, modeConflict } : {}) });
    } catch (error) { failure(res, error); }
  });

  const pushSchema = z.object({ id: z.string().min(1).max(128), title: z.string().min(1).max(100), text: z.string().min(1).max(500), sensitive: z.boolean(), kind: z.enum(['reminder', 'briefing', 'test']) }).strict();
  router.post('/push/helen', apiLimiter, authenticateToken, async (req, res) => {
    const parsed = pushSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Aviso HELEN no válido' });
    if (!pushSender) return res.status(503).json({ error: 'Los avisos push no están configurados' });
    try {
      const userId = req.user!.id;
      const subs = await prisma.pushSubscription.findMany({ where: { userId } });
      if (!subs.length) return res.status(503).json({ error: 'No hay dispositivos suscritos' });
      let delivered = 0;
      let skipped = 0;
      let uncertain = false;
      let rejected = false;
      const event = parsed.data;
      for (const sub of subs) {
        if (!isAllowedPushEndpoint(sub.endpoint)) { rejected = true; continue; }
        const key = `helen:${createHash('sha256').update(JSON.stringify([userId, event.id, sub.id])).digest('hex')}`;
        const previous = await prisma.cronLease.findUnique({ where: { key } });
        if (previous) { if (previous.owner.startsWith('sent:')) skipped++; else uncertain = true; continue; }
        const owner = `inflight:${randomUUID()}`;
        try { await prisma.cronLease.create({ data: { key, owner, expiresAt: new Date(Date.now() + 48 * 3600_000) } }); }
        catch (error) { if ((error as any)?.code === 'P2002') { uncertain = true; continue; } throw error; }
        try {
          await pushSender({ endpoint: sub.endpoint, keys: sub.keys }, { title: event.sensitive ? 'HELEN' : event.title, body: event.sensitive ? 'Tienes un aviso privado. Abre tu asistente para revisarlo.' : event.text, tag: key, data: { url: '/', kind: event.kind } });
          const recorded = await prisma.cronLease.updateMany({ where: { key, owner }, data: { owner: `sent:${owner.slice(9)}` } });
          if (!recorded.count) { uncertain = true; continue; }
          delivered++;
        } catch (error) {
          const status = Number((error as any)?.statusCode);
          if ([400, 401, 403, 404, 405, 410, 413, 429].includes(status)) {
            if (status === 410) await prisma.pushSubscription.deleteMany({ where: { id: sub.id, userId } });
            await prisma.cronLease.deleteMany({ where: { key, owner } });
            rejected = true;
          } else {
            await prisma.cronLease.updateMany({ where: { key, owner }, data: { owner: `uncertain:${owner.slice(9)}` } }).catch(() => {});
            uncertain = true;
          }
        }
      }
      if (uncertain) return res.status(202).json({ delivered, uncertain: true });
      if (rejected) return res.status(503).json({ delivered, error: 'Uno o más dispositivos rechazaron el aviso' });
      res.json({ delivered, ...(skipped ? { skipped: true } : {}) });
    } catch (error) { failure(res, error); }
  });
  return router;
}
