import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import express from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { getSecurity } from '../security.js';

const channelSchema = z.enum(['telegram', 'whatsapp']);
const actorSchema = z.object({ subject: z.string().regex(/^\d{1,20}$/) }).strict();
const redeemSchema = actorSchema.extend({ code: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const eventSchema = actorSchema.extend({ eventId: z.string().min(1).max(200), operation: z.enum(['read', 'write']), payload: z.unknown().optional() }).strict();
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const equal = (a: string, b: string) => timingSafeEqual(Buffer.from(hash(a)), Buffer.from(hash(b)));
const bridgeSecret = (channel: string) => process.env[`${channel.toUpperCase()}_BRIDGE_SECRET`] || '';
const usable = (secret: string) => secret.length >= 32;
const subjectHash = (secret: string, subject: string) => createHmac('sha256', secret).update(subject).digest('hex');

/** Trusted Helen transports supply provider-authenticated private actors, never a userId or a JWT. */
export function createChannelRouter(context: AppContext, operations: { read: express.RequestHandler; write: express.RequestHandler }) {
  const router = express.Router();
  const { prisma, authenticateToken, apiLimiter } = context;
  router.use('/channels', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.get('/channels', apiLimiter, authenticateToken, async (req, res) => {
    const links = await prisma.channelLink.findMany({ where: { userId: req.user!.id } });
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    res.json({ accountId: req.user!.id, channels: channelSchema.options.map((channel) => ({ channel, bridgeConfigured: usable(bridgeSecret(channel)), linked: links.some((link) => link.channel === channel && link.subjectHash && link.sessionVersion === (getSecurity(user?.preferences).sessionVersion || 0)), externalVerified: false, scopes: ['tasks:read', 'tasks:write'] })) });
  });
  router.post('/channels/:channel/link', apiLimiter, authenticateToken, async (req, res) => {
    const parsed = channelSchema.safeParse(req.params.channel);
    if (!parsed.success) return res.status(400).json({ error: 'Canal no válido' });
    if (!usable(bridgeSecret(parsed.data))) return res.status(503).json({ error: 'Puente del canal sin configurar' });
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    const code = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    const data = { subjectHash: null, challengeHash: hash(code), challengeExpiresAt: expiresAt, sessionVersion: getSecurity(user?.preferences).sessionVersion || 0 };
    // Relinking creates a new generation: old delivery receipts cannot authorize the new actor.
    await prisma.channelLink.deleteMany({ where: { userId: req.user!.id, channel: parsed.data } });
    await prisma.channelLink.create({ data: { userId: req.user!.id, channel: parsed.data, ...data } });
    res.json({ code, expiresAt: expiresAt.toISOString() });
  });
  router.delete('/channels/:channel', apiLimiter, authenticateToken, async (req, res) => {
    const parsed = channelSchema.safeParse(req.params.channel);
    if (!parsed.success) return res.status(400).json({ error: 'Canal no válido' });
    await prisma.channelLink.deleteMany({ where: { userId: req.user!.id, channel: parsed.data } });
    res.sendStatus(204);
  });
  router.use('/channel-bridge/:channel', apiLimiter, (req, res, next) => {
    const parsed = channelSchema.safeParse(req.params.channel);
    if (!parsed.success) return res.sendStatus(404);
    const secret = bridgeSecret(parsed.data);
    if (!usable(secret)) return res.status(503).json({ error: 'Puente del canal sin configurar' });
    const token = req.get('Authorization') || '';
    if (!equal(token, `Bearer ${secret}`)) return res.sendStatus(401);
    res.locals.channel = parsed.data;
    res.locals.bridgeSecret = secret;
    next();
  });
  router.post('/channel-bridge/:channel/redeem', async (req, res) => {
    const parsed = redeemSchema.safeParse(req.body);
    if (!parsed.success) return res.sendStatus(400);
    const challengeHash = hash(parsed.data.code);
    const link = await prisma.channelLink.findFirst({ where: { channel: res.locals.channel, challengeHash, challengeExpiresAt: { gt: new Date() } } });
    if (!link) return res.sendStatus(403);
    const user = await prisma.user.findUnique({ where: { id: link.userId } });
    if (!user || link.sessionVersion !== (getSecurity(user.preferences).sessionVersion || 0)) return res.sendStatus(403);
    try {
      const changed = await prisma.channelLink.updateMany({ where: { id: link.id, challengeHash, challengeExpiresAt: { gt: new Date() } }, data: { subjectHash: subjectHash(res.locals.bridgeSecret, parsed.data.subject), challengeHash: null, challengeExpiresAt: null } });
      if (!changed.count) return res.sendStatus(409);
      res.json({ linked: true, scopes: ['tasks:read', 'tasks:write'] });
    } catch (error) { if ((error as any)?.code === 'P2002') return res.status(409).json({ error: 'Actor ya vinculado' }); throw error; }
  });
  router.post('/channel-bridge/:channel/operations', async (req, res, next) => {
    const parsed = eventSchema.safeParse(req.body);
    if (!parsed.success) return res.sendStatus(400);
    const event = parsed.data;
    if (event.operation === 'write' && !z.object({ mutations: z.array(z.unknown()).max(200) }).strict().safeParse(event.payload).success) return res.sendStatus(400);
    if (event.operation === 'read' && event.payload !== undefined) return res.sendStatus(400);
    const link = await prisma.channelLink.findFirst({ where: { channel: res.locals.channel, subjectHash: subjectHash(res.locals.bridgeSecret, event.subject) } });
    if (!link) return res.sendStatus(403);
    const user = await prisma.user.findUnique({ where: { id: link.userId } });
    if (!user || link.sessionVersion !== (getSecurity(user.preferences).sessionVersion || 0)) return res.sendStatus(403);
    const key = hash(JSON.stringify([link.id, event.eventId]));
    const payloadHash = hash(JSON.stringify([event.operation, event.payload ?? null]));
    try { await prisma.channelEvent.create({ data: { key, linkId: link.id, payloadHash } }); }
    catch (error) {
      if ((error as any)?.code !== 'P2002') throw error;
      const previous = await prisma.channelEvent.findUnique({ where: { key } });
      if (previous?.payloadHash !== payloadHash) return res.status(409).json({ error: 'Identificador reutilizado con otra operación' });
      if (!previous.status) return res.status(202).json({ uncertain: true });
      return res.status(previous.status).json(previous.result);
    }
    req.user = { id: user.id, email: user.email };
    req.body = event.payload;
    let status = 200;
    const response = Object.create(res) as express.Response;
    response.status = (code) => { status = code; return response; };
    response.json = ((result: unknown) => {
      // A failed receipt stays uncertain; replaying a partly applied mutation is unsafe.
      void prisma.channelEvent.update({ where: { key }, data: { status, result: result as any } })
        .then(() => res.status(status).json(result)).catch(next);
      return response;
    }) as express.Response['json'];
    return operations[event.operation](req, response, next);
  });
  return router;
}
