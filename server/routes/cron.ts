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


export function createCronRouter(context: AppContext) {
  const router = express.Router();
  const { prisma, pushSender, clients, hit, requireSecret, sessionResponse, authenticateToken, optionalAuthenticateToken, bumpedSessions, hashPassword, validatePassword, clientIp, apiLimiter, publicLimiter, authRateLimit, authIpLimiter, loginLimiter, changePasswordLimiter, forgotLimiter, safeEqual, emailRegex, normalizeEmail, MAX_ITEMS_PER_COLLECTION, CRON_CONCURRENCY } = context;

  // Tarea programada (Vercel Cron o GitHub Actions): envía lo que toque desde la última pasada.
  // Se protege con CRON_SECRET (Vercel Cron manda «Authorization: Bearer <CRON_SECRET>»).
  router.all('/cron/notify', async (req: express.Request, res: express.Response) => {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || !safeEqual(req.headers['authorization'] || '', `Bearer ${cronSecret}`)) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    if (!pushSender) return res.status(503).json({ error: 'Faltan las claves VAPID' });
    const now = new Date();
    let sent = 0;
    let removed = 0;
    try {
      const subscriptions = await prisma.pushSubscription.findMany({});
      // Tareas, listas y secciones de cada usuario (la frecuencia sale también de la sección).
      // Una sola carga por usuario, compartida por todas sus suscripciones.
      const userData = new Map();
      const loadUser = (userId: string) => {
        if (!userData.has(userId)) {
          userData.set(userId, (async () => {
            const where = { userId, deletedAt: null };
            const [tasks, lists, sections, user] = await Promise.all([
              prisma.task.findMany({ where }),
              prisma.list.findMany({ where }),
              prisma.listSection.findMany({ where }),
              prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } }),
            ]);
            const toClient = (rows: Record<string, unknown>[]) => rows.map((r: Record<string, unknown>) => toClientPayload(userId, r));
            // El día semanal elegido en la app (sincronizado) manda sobre el de la suscripción.
            const weeklyDay = (user?.preferences as any)?.weeklyTasksDay;
            return {
              data: { tasks: toClient(tasks), lists: toClient(lists), sections: toClient(sections) },
              weeklyDay: Number.isInteger(weeklyDay) && weeklyDay >= 0 && weeklyDay <= 6 ? weeklyDay : undefined,
            };
          })());
        }
        return userData.get(userId);
      };

      const processSubscription = async (sub: any) => {
        try {
          const { data, weeklyDay } = await loadUser(sub.userId as string);
          const { messages, sentLog } = planNotifications({
            ...data,
            prefs: { timeZone: (sub as any).timeZone, digestHour: (sub as any).digestHour, weeklyDay: weeklyDay ?? (sub as any).weeklyDay },
            now,
            since: (sub as any).lastCheckedAt,
            sentLog: (sub as any).sentLog || {},
          });
          let gone = false;
          for (const message of messages) {
            try {
              await pushSender({ endpoint: (sub as any).endpoint, keys: (sub as any).keys }, message);
              sent++;
            } catch (error) {
              // 404/410: el navegador anuló la suscripción; se borra para no reintentar.
              if ((error as any)?.statusCode === 404 || (error as any)?.statusCode === 410) { gone = true; break; }
              console.error('Push send error:', (error as any)?.statusCode || error);
            }
          }
          if (gone) {
            await prisma.pushSubscription.delete({ where: { id: (sub as any).id } });
            removed++;
          } else {
            await prisma.pushSubscription.update({ where: { id: (sub as any).id }, data: { lastCheckedAt: now, sentLog: sentLog as any } });
          }
        } catch (error) {
          // Un fallo con una suscripción no debe impedir avisar a las demás.
          console.error('Cron notify subscription error:', error);
        }
      };

      // Concurrencia acotada: en serverless el tiempo total de la función es limitado.
      const queue = [...subscriptions];
      await Promise.all(
        Array.from({ length: Math.min(CRON_CONCURRENCY, queue.length) }, async () => {
          for (let sub = queue.shift(); sub; sub = queue.shift()) await processSubscription(sub);
        })
      );
      res.json({ subscriptions: subscriptions.length, sent, removed });
    } catch (error) {
      console.error('Cron notify error:', error);
      res.status(500).json({ error: 'No se pudieron enviar los avisos' });
    }
  });


  return router;
}
