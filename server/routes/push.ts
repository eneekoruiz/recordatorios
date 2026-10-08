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


  return router;
}
