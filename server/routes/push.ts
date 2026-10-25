import type { AppContext } from '../context.js';
import express from 'express';
import { safeTimeZone } from '../notifications.js';
import { isAllowedPushEndpoint } from '../app.js';

export function createPushRouter(context: AppContext) {
  const router = express.Router();
  const { prisma, pushSender, authenticateToken, apiLimiter } = context;

  // --- AVISOS CON LA APP CERRADA (Web Push) ---
  router.get('/push/public-key', (req: express.Request, res: express.Response) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    if (!publicKey || !pushSender) return res.status(503).json({ error: 'Los avisos todavía no están activados en este servidor.' });
    res.json({ publicKey });
  });

  router.post('/push/subscribe', apiLimiter, authenticateToken, async (req: express.Request, res: express.Response) => {
    const { subscription, timeZone, digestHour, weeklyDay } = req.body || {};
    const endpoint = subscription?.endpoint;
    const keys = subscription?.keys;
    if (!isAllowedPushEndpoint(endpoint)
      || typeof keys?.p256dh !== 'string' || typeof keys?.auth !== 'string') {
      return res.status(400).json({ error: 'Suscripción no válida' });
    }
    const prefs = {
      timeZone: safeTimeZone(timeZone),
      digestHour: Number.isInteger(digestHour) && digestHour >= 0 && digestHour <= 23 ? digestHour : 9,
      weeklyDay: Number.isInteger(weeklyDay) && weeklyDay >= 0 && weeklyDay <= 6 ? weeklyDay : 6,
    };
    try {
      await prisma.pushSubscription.upsert({
        where: { endpoint },
        update: { userId: req.user!.id, keys: { p256dh: keys.p256dh, auth: keys.auth }, ...prefs },
        create: { userId: req.user!.id, endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, ...prefs, lastCheckedAt: new Date() },
      });
      res.json({ success: true, ...prefs });
    } catch (error) {
      console.error('Push subscribe error:', error);
      res.status(503).json({ error: 'No se pudieron activar los avisos. Inténtalo más tarde.' });
    }
  });

  router.post('/push/unsubscribe', apiLimiter, authenticateToken, async (req: express.Request, res: express.Response) => {
    const endpoint = req.body?.endpoint;
    if (typeof endpoint !== 'string') return res.status(400).json({ error: 'Suscripción no válida' });
    try {
      await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.user!.id } });
      res.json({ success: true });
    } catch (error) {
      console.error('Push unsubscribe error:', error);
      res.status(503).json({ error: 'No se pudieron desactivar los avisos.' });
    }
  });

  router.post('/push/test', apiLimiter, authenticateToken, async (req: express.Request, res: express.Response) => {
    if (!pushSender) {
      return res.status(503).json({ error: 'El servidor no tiene configuradas las claves VAPID.' });
    }
    try {
      const subscriptions = await prisma.pushSubscription.findMany({
        where: { userId: req.user!.id }
      });
      if (!subscriptions || subscriptions.length === 0) {
        return res.status(404).json({ error: 'No tienes ningún dispositivo suscrito a las notificaciones en este usuario.' });
      }
      let successCount = 0;
      for (const sub of subscriptions) {
        const keys = sub.keys as any;
        if (!keys?.p256dh || !keys?.auth) continue;
        try {
          await pushSender(
            { endpoint: sub.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
            {
              title: 'Recordatorios',
              body: '🔔 ¡Prueba de notificación recibida con éxito!',
              tag: 'test-push',
              url: '/'
            }
          );
          successCount++;
        } catch (err: any) {
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
          }
        }
      }
      res.json({ success: true, sent: successCount, total: subscriptions.length });
    } catch (error) {
      console.error('Push test error:', error);
      res.status(500).json({ error: 'Error al enviar la prueba de notificación.' });
    }
  });

  // Tareas que siguen solas (lavadora, horno…): el dispositivo avisa de cuándo terminan y el planificador
  // manda el aviso aunque la app esté cerrada. Se guardan en el registro de la suscripción (sin migración).
  router.post('/push/timers', apiLimiter, authenticateToken, async (req: express.Request, res: express.Response) => {
    const { endpoint, timers } = req.body || {};
    if (typeof endpoint !== 'string' || !Array.isArray(timers) || timers.length > 10) {
      return res.status(400).json({ error: 'Datos no válidos' });
    }
    const now = Date.now();
    const clean = timers
      .filter((t: any) => t && typeof t.id === 'string' && t.id.length <= 80 && typeof t.title === 'string'
        && Number.isFinite(t.endsAt) && t.endsAt > now - 60_000 && t.endsAt < now + 48 * 3_600_000)
      .map((t: any) => ({ id: t.id, title: t.title.slice(0, 120), endsAt: Math.round(t.endsAt) }));
    try {
      const sub = await prisma.pushSubscription.findFirst({ where: { endpoint, userId: req.user!.id } });
      if (!sub) return res.status(404).json({ error: 'Este dispositivo no tiene los avisos activados' });
      const sentLog = { ...((sub as any).sentLog || {}), timers: clean };
      await prisma.pushSubscription.update({ where: { id: (sub as any).id }, data: { sentLog: sentLog as any } });
      res.json({ success: true, count: clean.length });
    } catch (error) {
      console.error('Push timers error:', error);
      res.status(503).json({ error: 'No se pudo guardar el aviso.' });
    }
  });

  return router;
}
