import type { AppContext } from '../context.js';
import express from 'express';
import jwt from 'jsonwebtoken';
import { publicPreferences, stripSecurity } from '../security.js';
import { scopedId, clientIdOf, isValidClientId, shouldApplyIncoming, parseDeletedAt, toClientPayload, sanitizePayload } from '../syncUtils.js';
import { getJwtSecret } from '../app.js';


export function createSyncRouter(context: AppContext) {
  const router = express.Router();
  const { 
    prisma, clients, requireSecret, authenticateToken, 
    apiLimiter, publicLimiter, MAX_ITEMS_PER_COLLECTION
  } = context;

  // --- SYNC ---
  const collections = [
    { key: 'tasks', model: 'task' },
    { key: 'cycles', model: 'cycle' },
    { key: 'lists', model: 'list' },
    { key: 'listSections', model: 'listSection' },
  ];

  /**
   * Prepara las escrituras de una colección respetando propiedad y LWW.
   * Devuelve las operaciones Prisma y los payloads del servidor que ganaron al entrante.
   */
  async function planCollectionWrites(modelName: "task" | "cycle" | "list" | "listSection", userId: string, rawItems: any) {
    const delegate = prisma[modelName] as any;
    const items = (Array.isArray(rawItems) ? rawItems : []).filter(
      (it) => it && typeof it === 'object' && isValidClientId(it.id)
    );
    if (items.length === 0) return { ops: [], stale: [] };
    if (items.length > MAX_ITEMS_PER_COLLECTION) {
      const err: any = new Error('Demasiados elementos en una sola petición');
      err.status = 413;
      throw err;
    }

    // Deduplicar elementos dentro del mismo lote por clientId asegurando que gane la versión más reciente según LWW
    const deduplicatedMap = new Map<string, any>();
    for (const item of items) {
      const prev = deduplicatedMap.get(item.id);
      if (!prev) {
        deduplicatedMap.set(item.id, item);
      } else {
        const prevPayload = sanitizePayload(prev);
        const currPayload = sanitizePayload(item);
        if (shouldApplyIncoming(currPayload, prevPayload)) {
          deduplicatedMap.set(item.id, item);
        }
      }
    }
    const deduplicatedItems = Array.from(deduplicatedMap.values());

    const clientIds = deduplicatedItems.map((i) => i.id);
    const existingRows = await delegate.findMany({
      where: { userId, id: { in: [...clientIds, ...clientIds.map((id) => scopedId(userId, id))] } },
      select: { id: true, payload: true, deletedAt: true },
    });
    const byClientId = new Map();
    for (const row of existingRows) {
      const cid = clientIdOf(userId, row.id);
      // Si coexistieran fila heredada y fila con ámbito, preferimos la de ámbito.
      if (!byClientId.has(cid) || row.id !== cid) byClientId.set(cid, row);
    }

    const ops = [];
    const stale = [];
    for (const item of deduplicatedItems) {
      const payload = sanitizePayload(item);
      const deletedAt = parseDeletedAt(payload.deleted_at);
      const existing = byClientId.get(item.id);
      if (existing) {
        if (payload._hard_delete) {
          ops.push(delegate.delete({ where: { id: existing.id } }));
          byClientId.delete(item.id);
          continue;
        }
        if (!shouldApplyIncoming(payload, existing.payload)) {
          stale.push(toClientPayload(userId, existing));
          continue;
        }
        ops.push(delegate.update({ where: { id: existing.id }, data: { payload, deletedAt } }));
        byClientId.set(item.id, { id: existing.id, payload, deletedAt });
      } else {
        if (payload._hard_delete) continue;
        const id = scopedId(userId, item.id);
        ops.push(
          delegate.upsert({
            where: { id },
            update: { payload, deletedAt },
            create: { id, userId, payload, deletedAt },
          })
        );
        byClientId.set(item.id, { id, payload, deletedAt });
      }
    }
    return { ops, stale };
  }

  router.post('/sync/push', apiLimiter, authenticateToken, async (req: express.Request, res: express.Response) => {
    const userId = req.user!.id;
    try {
      const transaction: any[] = [];
      const stale: Record<string, any> = {};
      for (const { key, model } of collections) {
        const plan = await planCollectionWrites(model as any, userId, req.body?.[key]);
        transaction.push(...plan.ops);
        if (plan.stale.length) stale[key] = plan.stale;
      }

      // El cliente nunca escribe los datos de seguridad (2FA, versión de sesión…): se descartan.
      const preferences = req.body?.preferences && typeof req.body.preferences === 'object' && !Array.isArray(req.body.preferences)
        ? stripSecurity(req.body.preferences)
        : undefined;
      if (preferences) {
        if (JSON.stringify(preferences).length > 50_000) {
          return res.status(413).json({ error: 'Preferencias demasiado grandes' });
        }
        const existing = await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } });
        const existingUpdatedAt = (existing?.preferences as any)?.updated_at ? new Date((existing!.preferences as any).updated_at).getTime() : 0;
        const incomingUpdatedAt = (preferences as any)?.updated_at ? new Date((preferences as any).updated_at).getTime() : Date.now();
        if (incomingUpdatedAt >= existingUpdatedAt) {
          const merged = {
            ...(existing?.preferences && typeof existing.preferences === 'object' ? existing.preferences : {}),
            ...preferences,
          };
          // Cada push trae ≤50 kB, pero la fusión acumula claves: se acota también el resultado.
          if (JSON.stringify(merged).length > 50_000) {
            return res.status(413).json({ error: 'Preferencias demasiado grandes' });
          }
          transaction.push(prisma.user.update({ where: { id: userId }, data: { preferences: merged } }));
        }
      }

      if (transaction.length > 0) await prisma.$transaction(transaction);
      res.json({ success: true, applied: transaction.length, stale });

      const userClients = clients.get(userId);
      if (userClients && transaction.length > 0) {
        for (const client of userClients) client.write('data: check_sync\n\n');
      }
    } catch (error: any) {
      console.error('Push error:', error);
      res.status(error.status || 500).json({ error: error.status ? error.message : 'Error sincronizando datos' });
    }
  });

  router.get('/sync/pull', apiLimiter, authenticateToken, async (req: express.Request, res: express.Response) => {
    const userId = req.user!.id;
    const rawToken = Number.parseInt(String(req.query.lastToken || '0'), 10);
    const lastToken = Number.isFinite(rawToken) && rawToken > 0 ? rawToken : 0;
    const lastDate = new Date(lastToken);
    // Margen de seguridad frente a relojes desincronizados entre instancias: preferimos
    // reenviar algún registro (LWW lo hace inocuo) antes que perder uno.
    const serverTime = Date.now() - 5000;

    try {
      const changedSince = { userId, updatedAt: { gt: lastDate } };
      const [userRecord, tasks, cycles, lists, listSections, activeTasks, activeLists, activeSections] =
        await Promise.all([
          prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } }),
          prisma.task.findMany({ where: changedSince }),
          prisma.cycle.findMany({ where: changedSince }),
          prisma.list.findMany({ where: changedSince, include: { sharedLinks: { select: { id: true } } } }),
          prisma.listSection.findMany({ where: changedSince }),
          prisma.task.findMany({ where: { userId, deletedAt: null }, select: { id: true } }),
          prisma.list.findMany({ where: { userId, deletedAt: null }, select: { id: true } }),
          prisma.listSection.findMany({ where: { userId, deletedAt: null }, select: { id: true } }),
        ]);

      const toClient = (rows: any[]) => rows.map((r: any) => toClientPayload(userId, r));
      const toIds = (rows: any[]) => rows.map((r: any) => clientIdOf(userId, r.id));

      res.json({
        tasks: toClient(tasks),
        cycles: toClient(cycles),
        lists: toClient(lists),
        listSections: toClient(listSections),
        activeTaskIds: toIds(activeTasks),
        activeListIds: toIds(activeLists),
        activeSectionIds: toIds(activeSections),
        preferences: publicPreferences(userRecord?.preferences),
        serverTime,
      });
    } catch (error: any) {
      console.error('Pull error:', error);
      res.status(500).json({ error: 'Error obteniendo datos' });
    }
  });

  // Tiempo real por SSE. En Vercel (funciones efímeras) no es viable mantener conexiones
  // abiertas ni compartir memoria entre instancias: respondemos 204 y el cliente se queda
  // con el sondeo periódico + sincronización al volver a la pestaña.
  // El EventSource no puede mandar cabeceras, y poner el token de sesión (30 días) en la URL lo
  // dejaría en logs y proxies. En su lugar, el cliente pide un ticket de 60 s y un solo propósito.
  router.post('/sync/live-ticket', apiLimiter, authenticateToken, (req: express.Request, res: express.Response) => {
    const secret = requireSecret(res);
    if (!secret) return;
    const ticket = jwt.sign({ sub: req.user!.id, purpose: 'live' }, secret, { expiresIn: '60s', algorithm: 'HS256' });
    res.json({ ticket });
  });

  router.get('/sync/live', publicLimiter, async (req: express.Request, res: express.Response) => {
    if (process.env.VERCEL) return res.status(204).end();
    const secret = getJwtSecret();
    const ticket = typeof req.query.ticket === 'string' ? req.query.ticket : null;
    if (!ticket || !secret) return res.sendStatus(401);

    let userId;
    try {
      const payload = jwt.verify(ticket, secret, { algorithms: ['HS256'] });
      if (typeof payload === 'string' || payload?.purpose !== 'live' || !(payload as any).sub) return res.sendStatus(401);
      const user = await prisma.user.findUnique({ where: { id: String((payload as any).sub) }, select: { id: true } });
      if (!user) return res.sendStatus(401);
      userId = user.id;
    } catch {
      return res.sendStatus(401);
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('data: connected\n\n');

    if (!clients.has(userId)) clients.set(userId, new Set());
    clients.get(userId)!.add(res);

    const heartbeat = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => {
      clearInterval(heartbeat);
      const set = clients.get(userId);
      if (set) {
        set.delete(res);
        if (set.size === 0) clients.delete(userId);
      }
    });
  });


  return router;
}
