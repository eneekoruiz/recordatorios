import rateLimit from 'express-rate-limit';
import express from 'express';
import { createAuthRouter } from './routes/auth.js';
import { createSyncRouter } from './routes/sync.js';
import { createShareRouter } from './routes/share.js';
import { createPushRouter } from './routes/push.js';
import { createCronRouter } from './routes/cron.js';
import { createMcpRouter } from './routes/mcp.js';

import crypto from 'node:crypto';
import net from 'node:net';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { handleMcpRequest, MCP_TOOLS } from './mcp.js';
import { isMailConfigured, sendPasswordResetEmail, sendSecurityEmail } from './mail.js';
import {
  getSecurity, withSecurity, publicPreferences, stripSecurity, checkSecondFactor, noteDevice, deviceId, newTotpSecret,
  otpauthUrl, encryptSecret, decryptSecret, verifyTotp, generateRecoveryCodes, hashRecoveryCode,
} from './security.js';
import webpush from 'web-push';
import { planNotifications, safeTimeZone } from './notifications.js';
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
// Coste de bcrypt: 12 (unos 250 ms). Las contraseñas guardadas con menos coste se actualizan solas al iniciar sesión.
const bcryptCost = () => Math.max(4, Number(process.env.BCRYPT_COST) || 12);
const hashPassword = (password: any) => bcrypt.hash(password, bcryptCost());
const SESSION_REFRESH_AFTER_MS = 7 * DAY_MS;
const RESET_TTL = '30m';
const MAX_ITEMS_PER_COLLECTION = 2000;
const CRON_CONCURRENCY = 8;
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

/**
 * Origen de los enlaces de recuperación de contraseña. En producción nunca se usa la
 * cabecera Origin: la controla quien hace la petición y permitiría enviar a la víctima
 * un enlace legítimo (con un token válido) que apunta a un dominio ajeno.
 */
export function resetLinkBase({ appUrl, production, origin, protocol, host }: any) {
  if (appUrl) return appUrl.replace(/\/$/, '');
  if (!production && origin) return origin.replace(/\/$/, '');
  return `${protocol}://${host}`;
}

// Servicios de push de los navegadores. El servidor hace POST al endpoint que envía el cliente,
// así que solo se aceptan estos dominios (más los de PUSH_ALLOWED_HOSTS): de lo contrario,
// cualquier usuario podría usar el cron para lanzar peticiones a hosts arbitrarios (SSRF).
const PUSH_HOST_SUFFIXES = [
  'fcm.googleapis.com',
  'android.googleapis.com',
  'push.services.mozilla.com',
  'push.apple.com',
  'notify.windows.com',
];

export function isAllowedPushEndpoint(endpoint: any, extraSuffixes = (process.env.PUSH_ALLOWED_HOSTS || '').split(',')) {
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return false;
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return false;
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (net.isIP(host) || host === 'localhost') return false;
  return [...PUSH_HOST_SUFFIXES, ...extraSuffixes.map((h) => h.trim().toLowerCase()).filter(Boolean)]
    .some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

const safeEqual = (a: any, b: any) => {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalizeEmail = (email: any) => (typeof email === 'string' ? email.toLowerCase().trim() : '');

// --- Límites de peticiones ---
// Con base de datos, los contadores viven en la tabla RateLimit y valen para todas las instancias
// (en serverless, cada instancia tiene su propia memoria). Si la BD falla, se limita en memoria:
// preferimos un límite por instancia a dejar el login sin ninguna protección.
function createMemoryHitStore() {
  const hits = new Map();
  return async (key: any, windowMs: any) => {
    const now = Date.now();
    const record = hits.get(key);
    if (!record || now > record.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
    } else {
      record.count += 1;
    }
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
    }
    return hits.get(key);
  };
}

const RATE_LIMIT_DB_COOLDOWN_MS = 60_000;

function createDbHitStore(prisma: any) {
  const fallback = createMemoryHitStore();
  const table = prisma.rateLimit;
  // Interruptor: si la BD falla (p. ej. la tabla aún no existe porque falta `prisma db push`), se
  // limita en memoria durante un minuto sin volver a intentarlo ni registrar un error por petición.
  let dbRetryAt = 0;
  return async (key: any, windowMs: any) => {
    if (Date.now() < dbRetryAt) return fallback(key, windowMs);
    try {
      const now = new Date();
      const resetAt = new Date(now.getTime() + windowMs);
      // Ventana caducada: se reinicia. Después, el incremento es atómico en la BD.
      await table.updateMany({ where: { key, resetAt: { lt: now } }, data: { count: 0, resetAt } });
      let row;
      try {
        row = await table.upsert({ where: { key }, create: { key, count: 1, resetAt }, update: { count: { increment: 1 } } });
      } catch {
        // Dos peticiones crearon la fila a la vez: la segunda ya puede incrementarla.
        row = await table.update({ where: { key }, data: { count: { increment: 1 } } });
      }
      if (Math.random() < 0.01) table.deleteMany({ where: { resetAt: { lt: now } } }).catch(() => {});
      return { count: row.count, resetAt: new Date(row.resetAt).getTime() };
    } catch (error) {
      dbRetryAt = Date.now() + RATE_LIMIT_DB_COOLDOWN_MS;
      console.error('Rate limit store no disponible (¿falta `prisma db push`?). Se limita en memoria durante 1 min:', (error as any)?.message || error);
      return fallback(key, windowMs);
    }
  };
}

function createRateLimiter({ windowMs, max, keyFn, message, hit }: any) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { count, resetAt } = await hit(keyFn(req), windowMs);
    if (count > max) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)));
      return res.status(429).json({ error: message });
    }
    next();
  };
}

// Con `trust proxy` activo, `req.ip` ya resuelve la IP real a partir de X-Forwarded-For de forma
// segura (sin fiarse ciegamente de la primera entrada, que el cliente puede fijar a su gusto).
const clientIp = (req: any) => req.ip || req.socket?.remoteAddress || 'unknown';

/** Envío real con Web Push si hay claves VAPID; null si el servidor no está configurado. */
function defaultPushSender() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:avisos@recordatorios.app', publicKey, privateKey);
  return (subscription: any, message: any) =>
    webpush.sendNotification(subscription, JSON.stringify(message), { TTL: 6 * 60 * 60, urgency: 'normal' });
}

export function createApp({ prisma, pushSender = defaultPushSender() }: any) {
  const app = express();
  const hit = prisma?.rateLimit ? createDbHitStore(prisma) : createMemoryHitStore();
  const clients = new Map(); // userId -> Set<Response> (SSE, solo en servidores persistentes)

  // Límites generosos para el resto de la API (evitan abusos sin estorbar a la sincronización normal: una
  // pestaña hace unas 4 peticiones por minuto). Van en memoria: un acceso a la BD por petición sería un coste
  // mayor que el que se quiere evitar.
  // express-rate-limit (memoria por instancia): por IP, antes de autenticar, para que también frene la fuerza bruta de tokens.
  const generic = (max: any) =>
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: max,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Demasiadas peticiones. Espera un momento.' },
    });
  const apiLimiter = generic(900);
  // Rutas de cuenta: tope por IP con express-rate-limit, además de los límites por correo/usuario respaldados en BD.
  const authRateLimit = generic(120);
  const publicLimiter = generic(300);

  app.disable('x-powered-by');
  // Un salto de proxy (Vercel / balanceador). Con `true` se confiaría en toda la cadena de X-Forwarded-For.
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS) || 1);

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

  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Cache-Control', 'no-store');
    if (isProduction()) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });

  // --- Helpers de sesión ---
  const requireSecret = (res: any) => {
    const secret = getJwtSecret();
    if (!secret) {
      console.error('❌ JWT_SECRET no está configurado (mínimo 16 caracteres). La autenticación está deshabilitada.');
      res.status(500).json({ error: 'El servidor no está configurado correctamente. Inténtalo más tarde.' });
      return null;
    }
    return secret;
  };

  // `sv` (versión de sesión) sube con «cerrar sesión en todos los dispositivos» y al cambiar o restablecer la
  // contraseña: los tokens anteriores dejan de valer. `user` debe traer sus preferencias.
  const signSession = (user: any, secret: any) =>
    jwt.sign({ id: user.id, email: user.email, sv: getSecurity(user.preferences).sessionVersion || 0 }, secret, {
      expiresIn: SESSION_TTL,
      algorithm: 'HS256',
    });

  const sessionResponse = (user: any, secret: any) => ({
    token: signSession(user, secret),
    user: { id: user.id, email: user.email },
    preferences: publicPreferences(user.preferences),
  });

  const verifySession = (token: any, secret: any) => {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] }) as any;
    if (!payload || typeof payload !== 'object' || !payload.id || payload.purpose) throw new Error('invalid');
    return payload;
  };

  /**
   * Devuelve el usuario de un token válido cuya versión de sesión sigue vigente; null si
   * la sesión ya no vale (contraseña cambiada, cierre global, usuario borrado o token
   * anterior a las versiones de sesión). Los fallos de base de datos se propagan: no
   * deben confundirse con una sesión caducada.
   */
  const sessionUser = async (payload: any) => {
    // Los tokens sin `pv` ni `sv` son anteriores a las huellas: se vuelve a entrar una vez.
    if (payload.pv === undefined && payload.sv === undefined) return null;
    const user = await prisma.user.findUnique({
      where: { id: String(payload.id) },
      select: { id: true, email: true, password: true, preferences: true },
    });
    if (!user) return null;
    if ((payload.sv || 0) !== (getSecurity(user.preferences).sessionVersion || 0)) return null;
    return user;
  };

  // Subir la versión de sesión cierra todas las sesiones abiertas (cambio o restablecimiento de contraseña).
  const bumpedSessions = (user: any) => {
    const security = getSecurity(user.preferences);
    return withSecurity(user.preferences, { ...security, sessionVersion: (security.sessionVersion || 0) + 1 });
  };

  const bearerToken = (req: any) => {
    const authHeader = req.headers['authorization'];
    return typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  };

  const authenticateToken = async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
    const secret = requireSecret(res);
    if (!secret) return;
    const token = bearerToken(req);
    if (!token) { res.status(401).json({ error: 'No autenticado' }); return; }
    let payload;
    try {
      payload = verifySession(token, secret);
    } catch {
      res.status(401).json({ error: 'Sesión caducada. Vuelve a iniciar sesión.' }); return;
    }
    let user;
    try {
      user = await sessionUser(payload);
    } catch (error) {
      console.error('Session check error:', error);
      res.status(503).json({ error: 'Servicio no disponible. Inténtalo de nuevo en unos segundos.' }); return;
    }
    if (!user) { res.status(401).json({ error: 'Sesión caducada. Vuelve a iniciar sesión.' }); return; }
    (req as any).user = { id: user.id, email: user.email };
    // Renovación deslizante: los tokens con más de 7 días se reemiten de forma transparente.
    const issuedAtMs = (payload.iat || 0) * 1000;
    if (!payload.exp || Date.now() - issuedAtMs > SESSION_REFRESH_AFTER_MS) {
      res.setHeader('X-Refreshed-Token', signSession(user, secret));
    }
    next();
  };

  const optionalAuthenticateToken = async (req: express.Request, res: express.Response, next: express.NextFunction): Promise<void> => {
    const secret = getJwtSecret();
    const token = bearerToken(req);
    if (token && secret) {
      try {
        const user = await sessionUser(verifySession(token, secret));
        if (user) (req as any).user = { id: user.id, email: user.email };
      } catch {
        /* token inválido o sesión cerrada: se trata como anónimo */
      }
    }
    next();
  };

  const loginLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyFn: (req: any) => `login:${clientIp(req)}:${normalizeEmail(req.body?.email)}`,
    message: 'Demasiados intentos. Espera unos minutos antes de volver a probar.',
    hit,
  });
  const authIpLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 60,
    keyFn: (req: any) => `auth:${clientIp(req)}`,
    message: 'Demasiadas peticiones. Espera unos minutos.',
    hit,
  });
  const changePasswordLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyFn: (req: any) => `change:${clientIp(req)}`,
    message: 'Demasiados intentos. Espera unos minutos.',
    hit,
  });
  const forgotLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 5,
    keyFn: (req: any) => `forgot:${clientIp(req)}`,
    message: 'Has solicitado demasiados enlaces. Inténtalo dentro de una hora.',
    hit,
  });

  const validatePassword = (password: any) => {
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    }
    if (password.length > 200) return 'La contraseña es demasiado larga.';
    return null;
  };

  // --- HEALTH ---
  app.get(['/api/health', '/health'], (req: express.Request, res: express.Response) => {
    res.json({
      status: 'ok',
      serverTime: new Date().toISOString(),
      features: {
        passwordResetEmail: isMailConfigured(),
        realtime: !process.env.VERCEL,
      },
    });
  });


  const context = {
    prisma, pushSender, clients, hit, requireSecret, sessionResponse, authenticateToken, optionalAuthenticateToken, bumpedSessions,
    hashPassword, validatePassword, clientIp,
    apiLimiter, publicLimiter, authRateLimit, authIpLimiter, loginLimiter, changePasswordLimiter, forgotLimiter, createRateLimiter,
    safeEqual, emailRegex, normalizeEmail, MAX_ITEMS_PER_COLLECTION, CRON_CONCURRENCY, isProduction, bcryptCost
  };

  app.use('/api', createAuthRouter(context));
  app.use('/', createAuthRouter(context));

  app.use('/api', createSyncRouter(context));
  app.use('/', createSyncRouter(context));

  app.use('/api', createShareRouter(context));
  app.use('/', createShareRouter(context));

  app.use('/api', createPushRouter(context));
  app.use('/', createPushRouter(context));

  app.use('/api', createCronRouter(context));
  app.use('/', createCronRouter(context));

  app.use('/api', createMcpRouter(context));
  app.use('/', createMcpRouter(context));

  // --- 404 y errores en JSON (nunca HTML ni trazas) ---
  app.use(['/api', '/auth', '/sync', '/share', '/mcp'], (req: express.Request, res: express.Response) => res.status(404).json({ error: 'Ruta no encontrada' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction): void => {
    if ((err as any)?.type === 'entity.too.large') { res.status(413).json({ error: 'Petición demasiado grande' }); return; }
    if ((err as any)?.type === 'entity.parse.failed') { res.status(400).json({ error: 'JSON no válido' }); return; }
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Error interno' });
  });

  return app;
}
