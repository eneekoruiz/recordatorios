import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { handleMcpRequest, MCP_TOOLS } from './mcp.js';
import { isMailConfigured, sendPasswordResetEmail } from './mail.js';
import {
  scopedId,
  clientIdOf,
  isValidClientId,
  shouldApplyIncoming,
  parseDeletedAt,
  toClientPayload,
  sanitizePayload,
} from './syncUtils.js';

const DAY_MS = 24 * 60 * 60 * 1000;
export const MIN_PASSWORD_LENGTH = 8;
const SESSION_TTL = '30d';
const SESSION_REFRESH_AFTER_MS = 7 * DAY_MS;
const RESET_TTL = '30m';
const MAX_ITEMS_PER_COLLECTION = 2000;
const DEV_FALLBACK_SECRET = 'dev-only-insecure-secret-change-me';

const isProduction = () => process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

/**
 * Secreto de firma de JWT. En producción es obligatorio: sin él, cualquiera podría
 * fabricar tokens válidos, así que preferimos fallar de forma explícita.
 */
export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (isProduction()) return null;
  return DEV_FALLBACK_SECRET;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalizeEmail = (email) => (typeof email === 'string' ? email.toLowerCase().trim() : '');

// --- Rate limiting en memoria (best-effort: en serverless cada instancia tiene el suyo) ---
function createRateLimiter({ windowMs, max, keyFn, message }) {
  const hits = new Map();
  return (req, res, next) => {
    const key = keyFn(req);
    const now = Date.now();
    const record = hits.get(key);
    if (!record || now > record.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
    } else {
      record.count += 1;
      if (record.count > max) {
        res.setHeader('Retry-After', Math.ceil((record.resetAt - now) / 1000));
        return res.status(429).json({ error: message });
      }
    }
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
    }
    next();
  };
}

const clientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  return (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : null) || req.socket?.remoteAddress || 'unknown';
};

export function createApp({ prisma }) {
  const app = express();
  const clients = new Map(); // userId -> Set<Response> (SSE, solo en servidores persistentes)

  app.disable('x-powered-by');
  app.set('trust proxy', true);

  // --- CORS: abierto en desarrollo; en producción solo mismo origen o ALLOWED_ORIGINS ---
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || !isProduction() || allowedOrigins.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
      exposedHeaders: ['X-Refreshed-Token'],
    })
  );

  app.use(express.json({ limit: '5mb' }));

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Cache-Control', 'no-store');
    if (isProduction()) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });

  // --- Helpers de sesión ---
  const requireSecret = (res) => {
    const secret = getJwtSecret();
    if (!secret) {
      console.error('❌ JWT_SECRET no está configurado (mínimo 16 caracteres). La autenticación está deshabilitada.');
      res.status(500).json({ error: 'El servidor no está configurado correctamente. Inténtalo más tarde.' });
      return null;
    }
    return secret;
  };

  const signSession = (user, secret) =>
    jwt.sign({ id: user.id, email: user.email }, secret, { expiresIn: SESSION_TTL, algorithm: 'HS256' });

  const sessionResponse = (user, secret) => ({
    token: signSession(user, secret),
    user: { id: user.id, email: user.email },
    preferences: user.preferences || null,
  });

  const verifySession = (token, secret) => {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (!payload || typeof payload !== 'object' || !payload.id || payload.purpose) throw new Error('invalid');
    return payload;
  };

  const authenticateToken = (req, res, next) => {
    const secret = requireSecret(res);
    if (!secret) return;
    const authHeader = req.headers['authorization'];
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'No autenticado' });
    try {
      const payload = verifySession(token, secret);
      req.user = { id: payload.id, email: payload.email };
      // Renovación deslizante: tokens antiguos o sin caducidad se reemiten de forma transparente.
      const issuedAtMs = (payload.iat || 0) * 1000;
      if (!payload.exp || Date.now() - issuedAtMs > SESSION_REFRESH_AFTER_MS) {
        res.setHeader('X-Refreshed-Token', signSession(req.user, secret));
      }
      next();
    } catch {
      return res.status(401).json({ error: 'Sesión caducada. Vuelve a iniciar sesión.' });
    }
  };

  const optionalAuthenticateToken = (req, res, next) => {
    const secret = getJwtSecret();
    const authHeader = req.headers['authorization'];
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token && secret) {
      try {
        const payload = verifySession(token, secret);
        req.user = { id: payload.id, email: payload.email };
      } catch {
        /* token inválido: se trata como anónimo */
      }
    }
    next();
  };

  const loginLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyFn: (req) => `login:${clientIp(req)}:${normalizeEmail(req.body?.email)}`,
    message: 'Demasiados intentos. Espera unos minutos antes de volver a probar.',
  });
  const authIpLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 60,
    keyFn: (req) => `auth:${clientIp(req)}`,
    message: 'Demasiadas peticiones. Espera unos minutos.',
  });
  const forgotLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 5,
    keyFn: (req) => `forgot:${clientIp(req)}`,
    message: 'Has solicitado demasiados enlaces. Inténtalo dentro de una hora.',
  });

  const validatePassword = (password) => {
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    }
    if (password.length > 200) return 'La contraseña es demasiado larga.';
    return null;
  };

  // --- HEALTH ---
  app.get(['/api/health', '/health'], (req, res) => {
    res.json({
      status: 'ok',
      serverTime: new Date().toISOString(),
      features: {
        passwordResetEmail: isMailConfigured(),
        realtime: !process.env.VERCEL,
      },
    });
  });

  // --- AUTH ---
  app.post(['/api/auth/register', '/auth/register'], authIpLimiter, async (req, res) => {
    const secret = requireSecret(res);
    if (!secret) return;
    try {
      const cleanEmail = normalizeEmail(req.body?.email);
      const { password } = req.body || {};
      if (!emailRegex.test(cleanEmail)) {
        return res.status(400).json({ error: 'El formato de correo electrónico no es válido.' });
      }
      const pwError = validatePassword(password);
      if (pwError) return res.status(400).json({ error: pwError });

      const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
      if (existing) {
        return res.status(409).json({
          error: 'Este correo ya está registrado. Inicia sesión o recupera tu contraseña.',
          existing: true,
        });
      }

      const user = await prisma.user.create({
        data: { email: cleanEmail, password: await bcrypt.hash(password, 10) },
      });
      res.json(sessionResponse(user, secret));
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'Error al registrar la cuenta. Inténtalo de nuevo.' });
    }
  });

  app.post(['/api/auth/login', '/auth/login'], authIpLimiter, loginLimiter, async (req, res) => {
    const secret = requireSecret(res);
    if (!secret) return;
    try {
      const cleanEmail = normalizeEmail(req.body?.email);
      const { password } = req.body || {};
      if (!cleanEmail || typeof password !== 'string' || !password) {
        return res.status(400).json({ error: 'Introduce tu email y contraseña.' });
      }

      const invalid = () => res.status(401).json({ error: 'Email o contraseña incorrectos.' });
      const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
      if (!user || !user.password) {
        await bcrypt.hash(password, 10); // tiempo constante: no revelar si la cuenta existe
        return invalid();
      }

      let valid = false;
      if (!user.password.startsWith('$2')) {
        // Migración silenciosa de contraseñas heredadas en texto plano.
        valid = password === user.password;
        if (valid) {
          await prisma.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash(password, 10) } });
        }
      } else {
        valid = await bcrypt.compare(password, user.password);
      }
      if (!valid) return invalid();

      res.json(sessionResponse(user, secret));
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Error en el servidor de autenticación.' });
    }
  });

  // Paso 1 de la recuperación: enviar enlace firmado al email (nunca revela si existe la cuenta).
  app.post(['/api/auth/forgot-password', '/auth/forgot-password'], forgotLimiter, async (req, res) => {
    const secret = requireSecret(res);
    if (!secret) return;
    const genericMessage = 'Si existe una cuenta con ese correo, te hemos enviado un enlace para restablecer la contraseña.';
    try {
      const cleanEmail = normalizeEmail(req.body?.email);
      if (!emailRegex.test(cleanEmail)) {
        return res.status(400).json({ error: 'Introduce un correo electrónico válido.' });
      }
      const mailReady = isMailConfigured();
      if (!mailReady && isProduction()) {
        return res.status(503).json({
          error: 'La recuperación por email todavía no está activada en este servidor. Contacta con el administrador.',
        });
      }

      const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
      if (!user) return res.json({ message: genericMessage });

      // El token se firma con el secreto + el hash actual de la contraseña: en cuanto
      // la contraseña cambia, el enlace deja de valer (un solo uso).
      const resetToken = jwt.sign({ sub: user.id, purpose: 'reset' }, secret + user.password, {
        expiresIn: RESET_TTL,
        algorithm: 'HS256',
      });
      const appUrl = process.env.APP_URL || req.headers.origin || `${req.protocol}://${req.get('host')}`;
      const resetUrl = `${appUrl.replace(/\/$/, '')}/?reset=${encodeURIComponent(resetToken)}`;

      if (mailReady) {
        await sendPasswordResetEmail(user.email, resetUrl);
        return res.json({ message: genericMessage });
      }
      // Solo desarrollo/test: sin proveedor de email devolvemos el enlace para poder probar el flujo.
      console.info(`🔑 Enlace de recuperación (dev) para ${user.email}: ${resetUrl}`);
      return res.json({ message: genericMessage, devResetUrl: resetUrl });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ error: 'No se pudo enviar el enlace. Inténtalo más tarde.' });
    }
  });

  // Paso 2: fijar nueva contraseña con el token recibido por email.
  app.post(['/api/auth/reset-password', '/auth/reset-password'], authIpLimiter, async (req, res) => {
    const secret = requireSecret(res);
    if (!secret) return;
    const invalidLink = () =>
      res.status(400).json({ error: 'El enlace no es válido o ha caducado. Solicita uno nuevo.' });
    try {
      const { token, newPassword } = req.body || {};
      if (typeof token !== 'string' || !token) return invalidLink();
      const pwError = validatePassword(newPassword);
      if (pwError) return res.status(400).json({ error: pwError });

      const decoded = jwt.decode(token);
      if (!decoded || typeof decoded !== 'object' || decoded.purpose !== 'reset' || !decoded.sub) return invalidLink();
      const user = await prisma.user.findUnique({ where: { id: String(decoded.sub) } });
      if (!user) return invalidLink();
      try {
        jwt.verify(token, secret + user.password, { algorithms: ['HS256'] });
      } catch {
        return invalidLink();
      }

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { password: await bcrypt.hash(newPassword, 10) },
      });
      res.json({ ...sessionResponse(updated, secret), message: 'Contraseña actualizada. ¡Bienvenido de nuevo!' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Error al restablecer la contraseña.' });
    }
  });

  app.post(['/api/auth/change-password', '/auth/change-password'], authenticateToken, async (req, res) => {
    const secret = requireSecret(res);
    if (!secret) return;
    try {
      const { currentPassword, newPassword } = req.body || {};
      const pwError = validatePassword(newPassword);
      if (pwError) return res.status(400).json({ error: pwError });
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user) return res.status(401).json({ error: 'Sesión no válida.' });
      const ok = user.password.startsWith('$2')
        ? await bcrypt.compare(String(currentPassword || ''), user.password)
        : currentPassword === user.password;
      if (!ok) return res.status(400).json({ error: 'La contraseña actual no es correcta.' });
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { password: await bcrypt.hash(newPassword, 10) },
      });
      res.json({ ...sessionResponse(updated, secret), message: 'Contraseña actualizada.' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'No se pudo cambiar la contraseña.' });
    }
  });

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
  async function planCollectionWrites(modelName, userId, rawItems) {
    const delegate = prisma[modelName];
    const items = (Array.isArray(rawItems) ? rawItems : []).filter(
      (it) => it && typeof it === 'object' && isValidClientId(it.id)
    );
    if (items.length === 0) return { ops: [], stale: [] };
    if (items.length > MAX_ITEMS_PER_COLLECTION) {
      const err = new Error('Demasiados elementos en una sola petición');
      err.status = 413;
      throw err;
    }

    const clientIds = items.map((i) => i.id);
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
    for (const item of items) {
      const payload = sanitizePayload(item);
      const deletedAt = parseDeletedAt(payload.deleted_at);
      const existing = byClientId.get(item.id);
      if (existing) {
        if (!shouldApplyIncoming(payload, existing.payload)) {
          stale.push(toClientPayload(userId, existing));
          continue;
        }
        ops.push(delegate.update({ where: { id: existing.id }, data: { payload, deletedAt } }));
      } else {
        const id = scopedId(userId, item.id);
        ops.push(
          delegate.upsert({
            where: { id },
            update: { payload, deletedAt },
            create: { id, userId, payload, deletedAt },
          })
        );
      }
    }
    return { ops, stale };
  }

  app.post(['/api/sync/push', '/sync/push'], authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
      const transaction = [];
      const stale = {};
      for (const { key, model } of collections) {
        const plan = await planCollectionWrites(model, userId, req.body?.[key]);
        transaction.push(...plan.ops);
        if (plan.stale.length) stale[key] = plan.stale;
      }

      const { preferences } = req.body || {};
      if (preferences && typeof preferences === 'object' && !Array.isArray(preferences)) {
        if (JSON.stringify(preferences).length > 50_000) {
          return res.status(413).json({ error: 'Preferencias demasiado grandes' });
        }
        transaction.push(prisma.user.update({ where: { id: userId }, data: { preferences } }));
      }

      if (transaction.length > 0) await prisma.$transaction(transaction);
      res.json({ success: true, applied: transaction.length, stale });

      const userClients = clients.get(userId);
      if (userClients && transaction.length > 0) {
        for (const client of userClients) client.write('data: check_sync\n\n');
      }
    } catch (error) {
      console.error('Push error:', error);
      res.status(error.status || 500).json({ error: error.status ? error.message : 'Error sincronizando datos' });
    }
  });

  app.get(['/api/sync/pull', '/sync/pull'], authenticateToken, async (req, res) => {
    const userId = req.user.id;
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
          prisma.list.findMany({ where: changedSince }),
          prisma.listSection.findMany({ where: changedSince }),
          prisma.task.findMany({ where: { userId, deletedAt: null }, select: { id: true } }),
          prisma.list.findMany({ where: { userId, deletedAt: null }, select: { id: true } }),
          prisma.listSection.findMany({ where: { userId, deletedAt: null }, select: { id: true } }),
        ]);

      const toClient = (rows) => rows.map((r) => toClientPayload(userId, r));
      const toIds = (rows) => rows.map((r) => clientIdOf(userId, r.id));

      res.json({
        tasks: toClient(tasks),
        cycles: toClient(cycles),
        lists: toClient(lists),
        listSections: toClient(listSections),
        activeTaskIds: toIds(activeTasks),
        activeListIds: toIds(activeLists),
        activeSectionIds: toIds(activeSections),
        preferences: userRecord?.preferences || null,
        serverTime,
      });
    } catch (error) {
      console.error('Pull error:', error);
      res.status(500).json({ error: 'Error obteniendo datos' });
    }
  });

  // Tiempo real por SSE. En Vercel (funciones efímeras) no es viable mantener conexiones
  // abiertas ni compartir memoria entre instancias: respondemos 204 y el cliente se queda
  // con el sondeo periódico + sincronización al volver a la pestaña.
  app.get(['/api/sync/live', '/sync/live'], (req, res) => {
    if (process.env.VERCEL) return res.status(204).end();
    const secret = getJwtSecret();
    const token = typeof req.query.token === 'string' ? req.query.token : null;
    if (!token || !secret) return res.sendStatus(401);

    let userId;
    try {
      userId = verifySession(token, secret).id;
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
    clients.get(userId).add(res);

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

  // --- COMPARTIR LISTAS (solo lectura, por enlace) ---
  const findOwnedList = (userId, clientListId) =>
    prisma.list.findFirst({
      where: { userId, deletedAt: null, id: { in: [clientListId, scopedId(userId, clientListId)] } },
    });

  app.post(['/api/share/generate', '/share/generate'], authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const { listId } = req.body || {};
    if (!isValidClientId(listId)) return res.status(400).json({ error: 'Lista no válida' });
    try {
      const list = await findOwnedList(userId, listId);
      if (!list) {
        return res.status(404).json({ error: 'La lista aún no se ha sincronizado. Espera unos segundos y vuelve a intentarlo.' });
      }
      const existing = await prisma.sharedLink.findFirst({ where: { listId: list.id } });
      const link = existing || (await prisma.sharedLink.create({ data: { listId: list.id } }));
      res.json({ token: link.id });
    } catch (err) {
      console.error('Share generate error:', err);
      res.status(500).json({ error: 'No se pudo generar el enlace' });
    }
  });

  app.delete(['/api/share/list/:listId', '/share/list/:listId'], authenticateToken, async (req, res) => {
    try {
      const list = await findOwnedList(req.user.id, req.params.listId);
      if (!list) return res.status(404).json({ error: 'Lista no encontrada' });
      await prisma.sharedLink.deleteMany({ where: { listId: list.id } });
      res.json({ success: true });
    } catch (err) {
      console.error('Share revoke error:', err);
      res.status(500).json({ error: 'No se pudo revocar el enlace' });
    }
  });

  app.get(['/api/share/:token', '/share/:token'], async (req, res) => {
    const { token } = req.params;
    if (!/^[0-9a-f-]{36}$/i.test(token)) return res.status(404).json({ error: 'Enlace no encontrado' });
    try {
      const link = await prisma.sharedLink.findUnique({ where: { id: token }, include: { list: true } });
      if (!link || !link.list || link.list.deletedAt) return res.status(404).json({ error: 'Enlace no encontrado' });

      const ownerId = link.list.userId;
      const clientListId = clientIdOf(ownerId, link.list.id);
      const [allTasks, allSections] = await Promise.all([
        prisma.task.findMany({ where: { userId: ownerId, deletedAt: null } }),
        prisma.listSection.findMany({ where: { userId: ownerId, deletedAt: null } }),
      ]);
      const strip = (p) => {
        const clean = { ...p };
        delete clean.user_id;
        delete clean.location;
        return clean;
      };
      const tasks = allTasks
        .map((t) => toClientPayload(ownerId, t))
        .filter((p) => (p.categoryId || p.category_id || p.listId) === clientListId && !p.deleted_at)
        .map(strip);
      const sections = allSections
        .map((s) => toClientPayload(ownerId, s))
        .filter((p) => p.listId === clientListId && !p.deleted_at);

      res.json({ list: strip(toClientPayload(ownerId, link.list)), tasks, sections });
    } catch (err) {
      console.error('Share read error:', err);
      res.status(500).json({ error: 'No se pudo cargar la lista compartida' });
    }
  });

  // --- MCP (Model Context Protocol) ---
  app.post(['/api/mcp', '/mcp'], optionalAuthenticateToken, async (req, res) => {
    try {
      res.json(await handleMcpRequest(req.body, prisma, req.user?.id));
    } catch (err) {
      console.error('MCP route error:', err);
      res.status(500).json({ jsonrpc: '2.0', id: req.body?.id ?? null, error: { code: -32000, message: 'Internal Server Error' } });
    }
  });

  app.get(['/api/mcp', '/mcp', '/api/mcp/tools', '/mcp/tools'], (req, res) => {
    res.json({ name: 'Recordatorios MCP Server', version: '1.1.0', protocolVersion: '2024-11-05', tools: MCP_TOOLS });
  });

  // --- 404 y errores en JSON (nunca HTML ni trazas) ---
  app.use(['/api', '/auth', '/sync', '/share', '/mcp'], (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Petición demasiado grande' });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON no válido' });
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Error interno' });
  });

  return app;
}
