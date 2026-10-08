import express from 'express';
import { randomUUID } from 'node:crypto';
import type { AppContext } from '../context.js';
import { planNotifications } from '../notifications.js';
import { toClientPayload } from '../syncUtils.js';


const CRON_LEASE_KEY = 'notify';
const CRON_LEASE_TTL_MS = 5 * 60 * 1000;

async function acquireCronLease(prisma: any, owner: string) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CRON_LEASE_TTL_MS);
  const reclaimed = await prisma.cronLease.updateMany({
    where: { key: CRON_LEASE_KEY, expiresAt: { lte: now } },
    data: { owner, expiresAt },
  });
  if (reclaimed.count === 1) return true;
  try {
    await prisma.cronLease.create({ data: { key: CRON_LEASE_KEY, owner, expiresAt } });
    return true;
  } catch (error) {
    if ((error as any)?.code === 'P2002') return false;
    throw error;
  }
}

const renewCronLease = (prisma: any, owner: string) =>
  prisma.cronLease.updateMany({
    where: { key: CRON_LEASE_KEY, owner },
    data: { expiresAt: new Date(Date.now() + CRON_LEASE_TTL_MS) },
  });

const releaseCronLease = (prisma: any, owner: string) =>
  prisma.cronLease.deleteMany({ where: { key: CRON_LEASE_KEY, owner } });

export function createCronRouter(context: AppContext) {
  const router = express.Router();
  const { prisma, pushSender, safeEqual, CRON_CONCURRENCY } = context;

  // Tarea programada (Vercel Cron o GitHub Actions): envía lo que toque desde la última pasada.
  // Se protege con CRON_SECRET (Vercel Cron manda «Authorization: Bearer <CRON_SECRET>»).
  router.all('/cron/notify', async (req: express.Request, res: express.Response) => {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || !safeEqual(req.headers['authorization'] || '', `Bearer ${cronSecret}`)) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    if (!pushSender) return res.status(503).json({ error: 'Faltan las claves VAPID' });

    const leaseOwner = randomUUID();
    try {
      if (!(await acquireCronLease(prisma, leaseOwner))) {
        return res.status(429).json({ error: 'Ejecución de avisos cron ya en curso' });
      }
    } catch (error) {
      console.error('Cron lease error:', error);
      return res.status(503).json({ error: 'No se pudo reservar la ejecución de avisos' });
    }

    let leaseLost = false;
    let renewing = false;
    const heartbeat = setInterval(async () => {
      if (renewing || leaseLost) return;
      renewing = true;
      try {
        const renewed = await renewCronLease(prisma, leaseOwner);
        if (renewed.count !== 1) leaseLost = true;
      } catch (error) {
        leaseLost = true;
        console.error('Cron lease renewal error:', error);
      } finally {
        renewing = false;
      }
    }, Math.floor(CRON_LEASE_TTL_MS / 3));
    heartbeat.unref?.();

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
          if (leaseLost) return;
          const { data, weeklyDay } = await loadUser(sub.userId as string);
          const currentSentLog = (sub as any).sentLog || {};
          const { messages, sentLog: plannedSentLog } = planNotifications({
            ...data,
            prefs: { timeZone: (sub as any).timeZone, digestHour: (sub as any).digestHour, weeklyDay: weeklyDay ?? (sub as any).weeklyDay },
            now,
            since: (sub as any).lastCheckedAt,
            sentLog: currentSentLog,
          });
          let gone = false;
          let hasTransientFailure = false;
          const successfulTags = new Set<string>();
          let successfulAlerts = false;

          for (const message of messages) {
            if (leaseLost) {
              hasTransientFailure = true;
              break;
            }
            try {
              const { deliveryKeys, ...pushMessage } = message as any;
              await pushSender({ endpoint: (sub as any).endpoint, keys: (sub as any).keys }, pushMessage);
              sent++;
              if (pushMessage.tag) successfulTags.add(pushMessage.tag);
              if (pushMessage.tag?.startsWith('alerts-') && deliveryKeys && typeof deliveryKeys === 'object') {
                successfulAlerts = true;
              }
            } catch (error) {
              // 404/410: el navegador anuló la suscripción; se borra para no reintentar.
              if ((error as any)?.statusCode === 404 || (error as any)?.statusCode === 410) {
                gone = true;
                break;
              }
              hasTransientFailure = true;
              console.error('Push send error:', (error as any)?.statusCode || error);
            }
          }

          if (gone) {
            await prisma.pushSubscription.delete({ where: { id: (sub as any).id } });
            removed++;
          } else {
            // Construir sentLog registrando ÚNICAMENTE los mensajes cuyo envío fue confirmado
            const updatedSentLog = { ...currentSentLog };
            for (const message of messages) {
              if (message.tag && successfulTags.has(message.tag)) {
                if (message.tag.startsWith('digest-')) {
                  updatedSentLog.digest = (plannedSentLog as any)?.digest;
                }
              }
            }
            if (successfulAlerts) updatedSentLog.alerts = (plannedSentLog as any)?.alerts || {};

            // El cursor solo avanza cuando todos los mensajes de este intervalo se confirmaron.
            // sentLog conserva los mensajes confirmados para reducir duplicados al reintentar.
            const nextLastCheckedAt = hasTransientFailure || leaseLost
              ? (sub as any).lastCheckedAt
              : now;

            await prisma.pushSubscription.update({
              where: { id: (sub as any).id },
              data: { lastCheckedAt: nextLastCheckedAt, sentLog: updatedSentLog as any }
            });
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
    } finally {
      clearInterval(heartbeat);
      try {
        await releaseCronLease(prisma, leaseOwner);
      } catch (error) {
        console.error('Cron lease release error:', error);
      }
    }
  });


  return router;
}
