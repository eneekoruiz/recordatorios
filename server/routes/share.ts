import type { AppContext } from '../context.js';
import express from 'express';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { isMailConfigured, sendPasswordResetEmail, sendSecurityEmail } from '../mail.js';
import { getSecurity, withSecurity, publicPreferences, stripSecurity, checkSecondFactor, noteDevice, deviceId, newTotpSecret, otpauthUrl, encryptSecret, decryptSecret, verifyTotp, generateRecoveryCodes, hashRecoveryCode } from '../security.js';
import { planNotifications, safeTimeZone } from '../notifications.js';
import { scopedId, clientIdOf, isValidClientId, shouldApplyIncoming, parseDeletedAt, toClientPayload, sanitizePayload } from '../syncUtils.js';
import { getJwtSecret, resetLinkBase, isAllowedPushEndpoint, MIN_PASSWORD_LENGTH } from '../app.js';


export function createShareRouter(context: AppContext) {
  const router = express.Router();
  const { 
    prisma, authenticateToken, 
    apiLimiter, publicLimiter
  } = context;

  // --- COMPARTIR LISTAS (solo lectura, por enlace) ---
  const findOwnedList = (userId: string, clientListId: string) =>
    prisma.list.findFirst({
      where: { userId, deletedAt: null, id: { in: [clientListId, scopedId(userId, clientListId)] } },
    });

  router.get('/share/shared-list-ids', apiLimiter, authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
      const userId = req.user!.id;
      const sharedLinks = await prisma.sharedLink.findMany({
        where: { list: { userId, deletedAt: null } },
        select: { listId: true }
      });
      const clientListIds = sharedLinks.map(l => clientIdOf(userId, l.listId));
      res.json({ sharedListIds: clientListIds });
    } catch (err) {
      console.error('Fetch shared list ids error:', err);
      res.status(500).json({ error: 'No se pudieron obtener las listas compartidas' });
    }
  });

  router.post('/share/generate', apiLimiter, authenticateToken, async (req: express.Request, res: express.Response) => {
    const userId = req.user!.id;
    const { listId } = req.body || {};
    if (!isValidClientId(listId)) return res.status(400).json({ error: 'Lista no válida' });
    try {
      const list = await findOwnedList(userId, listId);
      if (!list) {
        return res.status(404).json({ error: 'La lista aún no se ha sincronizado. Espera unos segundos y vuelve a intentarlo.' });
      }
      const existing = await prisma.sharedLink.findFirst({ where: { listId: list.id } });
      const link = existing || (await prisma.sharedLink.create({ data: { listId: list.id } }));
      const nextPayload = list.payload && typeof list.payload === 'object' ? { ...list.payload, isShared: true } : { isShared: true };
      await prisma.list.update({ where: { id: list.id }, data: { payload: nextPayload, updatedAt: new Date() } });
      res.json({ token: link.id });
    } catch (err) {
      console.error('Share generate error:', err);
      res.status(500).json({ error: 'No se pudo generar el enlace' });
    }
  });

  router.delete('/share/list/:listId', apiLimiter, authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
      const list = await findOwnedList(req.user!.id, req.params.listId as string);
      if (!list) return res.status(404).json({ error: 'Lista no encontrada' });
      await prisma.sharedLink.deleteMany({ where: { listId: list.id } });
      const nextPayload = list.payload && typeof list.payload === 'object' ? { ...list.payload, isShared: false } : { isShared: false };
      await prisma.list.update({ where: { id: list.id }, data: { payload: nextPayload, updatedAt: new Date() } });
      res.json({ success: true });
    } catch (err) {
      console.error('Share revoke error:', err);
      res.status(500).json({ error: 'No se pudo revocar el enlace' });
    }
  });

  router.get('/share/:token', publicLimiter, async (req: express.Request, res: express.Response) => {
    const token = req.params.token as string;
    if (!/^[0-9a-f-]{36}$/i.test(token)) return res.status(404).json({ error: 'Enlace no encontrado' });
    try {
      const link: any = await prisma.sharedLink.findUnique({ where: { id: token }, include: { list: true } });
      if (!link || !link.list || link.list.deletedAt) return res.status(404).json({ error: 'Enlace no encontrado' });

      const ownerId = link.list.userId;
      const clientListId = clientIdOf(ownerId, link.list.id);
      const [allTasks, allSections] = await Promise.all([
        prisma.task.findMany({ where: { userId: ownerId, deletedAt: null } }),
        prisma.listSection.findMany({ where: { userId: ownerId, deletedAt: null } }),
      ]);
      // Lista blanca: la vista pública solo recibe lo que necesita pintar. Notas privadas, personas,
      // ubicaciones, enlaces de gestión o datos de tarjetas nunca salen por un enlace compartido.
      const pick = (p: any, keys: string[]) => Object.fromEntries(keys.filter((k) => p[k] !== undefined).map((k) => [k, p[k]]));
      const TASK_KEYS = ['id', 'title', 'description', 'status', 'dueDate', 'sectionId', 'price', 'quantity', 'order', 'created_at'];
      const tasks = allTasks
        .map((t) => toClientPayload(ownerId, t))
        .filter((p) => (p.categoryId || p.category_id || p.listId) === clientListId && !p.deleted_at)
        .map((p) => pick(p, TASK_KEYS));
      const sections = allSections
        .map((s) => toClientPayload(ownerId, s))
        .filter((p) => p.listId === clientListId && !p.deleted_at)
        .map((p) => pick(p, ['id', 'name', 'order', 'parentId']));

      res.json({ list: pick(toClientPayload(ownerId, link.list), ['id', 'name', 'color', 'icon']), tasks, sections });
    } catch (err) {
      console.error('Share read error:', err);
      res.status(500).json({ error: 'No se pudo cargar la lista compartida' });
    }
  });


  return router;
}
