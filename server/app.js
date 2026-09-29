import rateLimit from 'express-rate-limit';
import express from 'express';
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
const hashPassword = (password) => bcrypt.hash(password, bcryptCost());
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
export function resetLinkBase({ appUrl, production, origin, protocol, host }) {
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

export function isAllowedPushEndpoint(endpoint, extraSuffixes = (process.env.PUSH_ALLOWED_HOSTS || '').split(',')) {
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

const safeEqual = (a, b) => {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalizeEmail = (email) => (typeof email === 'string' ? email.toLowerCase().trim() : '');

// --- Límites de peticiones ---
// Con base de datos, los contadores viven en la tabla RateLimit y valen para todas las instancias
// (en serverless, cada instancia tiene su propia memoria). Si la BD falla, se limita en memoria:
// preferimos un límite por instancia a dejar el login sin ninguna protección.
function createMemoryHitStore() {
  const hits = new Map();
  return async (key, windowMs) => {
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

function createDbHitStore(prisma) {
  const fallback = createMemoryHitStore();
  const table = prisma.rateLimit;
  // Interruptor: si la BD falla (p. ej. la tabla aún no existe porque falta `prisma db push`), se
  // limita en memoria durante un minuto sin volver a intentarlo ni registrar un error por petición.
  let dbRetryAt = 0;
  return async (key, windowMs) => {
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
      console.error('Rate limit store no disponible (¿falta `prisma db push`?). Se limita en memoria durante 1 min:', error?.message || error);
      return fallback(key, windowMs);
    }
  };
}

function createRateLimiter({ windowMs, max, keyFn, message, hit }) {
  return async (req, res, next) => {
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
const clientIp = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

/** Envío real con Web Push si hay claves VAPID; null si el servidor no está configurado. */
function defaultPushSender() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:avisos@recordatorios.app', publicKey, privateKey);
  return (subscription, message) =>
    webpush.sendNotification(subscription, JSON.stringify(message), { TTL: 6 * 60 * 60, urgency: 'normal' });
}

export function createApp({ prisma, pushSender = defaultPushSender() }) {
  const app = express();
  const hit = prisma?.rateLimit ? createDbHitStore(prisma) : createMemoryHitStore();
  const clients = new Map(); // userId -> Set<Response> (SSE, solo en servidores persistentes)

  // Límites generosos para el resto de la API (evitan abusos sin estorbar a la sincronización normal: una
  // pestaña hace unas 4 peticiones por minuto). Van en memoria: un acceso a la BD por petición sería un coste
  // mayor que el que se quiere evitar.
  // express-rate-limit (memoria por instancia): por IP, antes de autenticar, para que también frene la fuerza bruta de tokens.
  const generic = (max) =>
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

  // `sv` (versión de sesión) sube con «cerrar sesión en todos los dispositivos» y al cambiar o restablecer la
  // contraseña: los tokens anteriores dejan de valer. `user` debe traer sus preferencias.
  const signSession = (user, secret) =>
    jwt.sign({ id: user.id, email: user.email, sv: getSecurity(user.preferences).sessionVersion || 0 }, secret, {
      expiresIn: SESSION_TTL,
      algorithm: 'HS256',
    });

  const sessionResponse = (user, secret) => ({
    token: signSession(user, secret),
    user: { id: user.id, email: user.email },
    preferences: publicPreferences(user.preferences),
  });

  const verifySession = (token, secret) => {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (!payload || typeof payload !== 'object' || !payload.id || payload.purpose) throw new Error('invalid');
    return payload;
  };

  /**
   * Devuelve el usuario de un token válido cuya versión de sesión sigue vigente; null si
   * la sesión ya no vale (contraseña cambiada, cierre global, usuario borrado o token
   * anterior a las versiones de sesión). Los fallos de base de datos se propagan: no
   * deben confundirse con una sesión caducada.
   */
  const sessionUser = async (payload) => {
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
  const bumpedSessions = (user) => {
    const security = getSecurity(user.preferences);
    return withSecurity(user.preferences, { ...security, sessionVersion: (security.sessionVersion || 0) + 1 });
  };

  const bearerToken = (req) => {
    const authHeader = req.headers['authorization'];
    return typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  };

  const authenticateToken = async (req, res, next) => {
    const secret = requireSecret(res);
    if (!secret) return;
    const token = bearerToken(req);
    if (!token) return res.status(401).json({ error: 'No autenticado' });
    let payload;
    try {
      payload = verifySession(token, secret);
    } catch {
      return res.status(401).json({ error: 'Sesión caducada. Vuelve a iniciar sesión.' });
    }
    let user;
    try {
      user = await sessionUser(payload);
    } catch (error) {
      console.error('Session check error:', error);
      return res.status(503).json({ error: 'Servicio no disponible. Inténtalo de nuevo en unos segundos.' });
    }
    if (!user) return res.status(401).json({ error: 'Sesión caducada. Vuelve a iniciar sesión.' });
    req.user = { id: user.id, email: user.email };
    // Renovación deslizante: los tokens con más de 7 días se reemiten de forma transparente.
    const issuedAtMs = (payload.iat || 0) * 1000;
    if (!payload.exp || Date.now() - issuedAtMs > SESSION_REFRESH_AFTER_MS) {
      res.setHeader('X-Refreshed-Token', signSession(user, secret));
    }
    next();
  };

  const optionalAuthenticateToken = async (req, res, next) => {
    const secret = getJwtSecret();
    const token = bearerToken(req);
    if (token && secret) {
      try {
        const user = await sessionUser(verifySession(token, secret));
        if (user) req.user = { id: user.id, email: user.email };
      } catch {
        /* token inválido o sesión cerrada: se trata como anónimo */
      }
    }
    next();
  };

  const loginLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyFn: (req) => `login:${clientIp(req)}:${normalizeEmail(req.body?.email)}`,
    message: 'Demasiados intentos. Espera unos minutos antes de volver a probar.',
    hit,
  });
  const authIpLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 60,
    keyFn: (req) => `auth:${clientIp(req)}`,
    message: 'Demasiadas peticiones. Espera unos minutos.',
    hit,
  });
  const changePasswordLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyFn: (req) => `change:${clientIp(req)}`,
    message: 'Demasiados intentos. Espera unos minutos.',
    hit,
  });
  const forgotLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 5,
    keyFn: (req) => `forgot:${clientIp(req)}`,
    message: 'Has solicitado demasiados enlaces. Inténtalo dentro de una hora.',
    hit,
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
  app.post(['/api/auth/register', '/auth/register'], authRateLimit, authIpLimiter, async (req, res) => {
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
        data: { email: cleanEmail, password: await hashPassword(password) },
      });
      res.json(sessionResponse(user, secret));
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'Error al registrar la cuenta. Inténtalo de nuevo.' });
    }
  });

  app.post(['/api/auth/login', '/auth/login'], authRateLimit, authIpLimiter, loginLimiter, async (req, res) => {
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
        await hashPassword(password); // tiempo constante: no revelar si la cuenta existe
        return invalid();
      }

      let valid = false;
      if (!user.password.startsWith('$2')) {
        // Migración silenciosa de contraseñas heredadas en texto plano.
        valid = password === user.password;
        if (valid) {
          await prisma.user.update({ where: { id: user.id }, data: { password: await hashPassword(password) } });
        }
      } else {
        valid = await bcrypt.compare(password, user.password);
        // Actualización silenciosa al coste actual (solo con la contraseña recién validada).
        if (valid && bcrypt.getRounds(user.password) < bcryptCost()) {
          const upgraded = await hashPassword(password);
          await prisma.user.update({ where: { id: user.id }, data: { password: upgraded } });
          user.password = upgraded;
        }
      }
      if (!valid) return invalid();

      // Segundo factor (solo se comprueba con la contraseña ya validada: no revela si la cuenta lo tiene).
      let security = getSecurity(user.preferences);
      let securityChanged = false;
      if (security.totp?.enabled) {
        const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
        if (!code) {
          return res.status(401).json({ error: 'Introduce el código de verificación de tu app.', twoFactorRequired: true });
        }
        const second = checkSecondFactor(security, code, secret);
        if (!second.ok) {
          return res.status(401).json({ error: 'El código no es correcto o ha caducado.', twoFactorRequired: true });
        }
        security = second.security;
        securityChanged = true; // último código usado / código de recuperación consumido
      }

      // Aviso de inicio de sesión desde un dispositivo nuevo (al mejor esfuerzo: nunca impide entrar).
      const seen = noteDevice(security, deviceId(req.headers['user-agent']));
      if (seen.changed || securityChanged) {
        try {
          user.preferences = withSecurity(user.preferences, seen.security);
          await prisma.user.update({ where: { id: user.id }, data: { preferences: user.preferences } });
          if (seen.isNew) {
            sendSecurityEmail(user.email, {
              subject: 'Nuevo inicio de sesión en Recordatorios',
              heading: 'Has iniciado sesión desde un dispositivo nuevo',
              body: 'Acabamos de detectar un inicio de sesión en tu cuenta desde un navegador o dispositivo que no habíamos visto antes.',
            });
          }
        } catch (error) {
          console.error('No se pudo registrar el dispositivo:', error?.message || error);
        }
      }

      res.json(sessionResponse(user, secret));
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Error en el servidor de autenticación.' });
    }
  });

  // Paso 1 de la recuperación: enviar enlace firmado al email (nunca revela si existe la cuenta).
  app.post(['/api/auth/forgot-password', '/auth/forgot-password'], authRateLimit, forgotLimiter, async (req, res) => {
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
      const appUrl = resetLinkBase({
        appUrl: process.env.APP_URL,
        production: isProduction(),
        origin: req.headers.origin,
        protocol: req.protocol,
        host: req.get('host'),
      });
      const resetUrl = `${appUrl}/?reset=${encodeURIComponent(resetToken)}`;

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
  app.post(['/api/auth/reset-password', '/auth/reset-password'], authRateLimit, authIpLimiter, async (req, res) => {
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
        data: { password: await hashPassword(newPassword), preferences: bumpedSessions(user) },
      });
      sendSecurityEmail(updated.email, {
        subject: 'Tu contraseña de Recordatorios ha cambiado',
        heading: 'Tu contraseña se ha restablecido',
        body: 'Acabas de restablecer la contraseña de tu cuenta y se han cerrado las demás sesiones.',
      });
      res.json({ ...sessionResponse(updated, secret), message: 'Contraseña actualizada. ¡Bienvenido de nuevo!' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Error al restablecer la contraseña.' });
    }
  });

  app.post(['/api/auth/change-password', '/auth/change-password'], authRateLimit, changePasswordLimiter, authenticateToken, async (req, res) => {
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
        data: { password: await hashPassword(newPassword), preferences: bumpedSessions(user) },
      });
      sendSecurityEmail(updated.email, {
        subject: 'Tu contraseña de Recordatorios ha cambiado',
        heading: 'Tu contraseña se ha cambiado',
        body: 'Acabas de cambiar la contraseña de tu cuenta y se han cerrado las demás sesiones.',
      });
      res.json({ ...sessionResponse(updated, secret), message: 'Contraseña actualizada.' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'No se pudo cambiar la contraseña.' });
    }
  });

  // --- SEGURIDAD DE LA CUENTA: sesiones y verificación en dos pasos (datos en preferences._security) ---
  const securityLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    keyFn: (req) => `security:${req.user?.id || clientIp(req)}`,
    message: 'Demasiados intentos. Espera unos minutos.',
    hit,
  });

  const loadAccount = (userId) => prisma.user.findUnique({ where: { id: userId } });
  const saveSecurity = (user, security) =>
    prisma.user.update({ where: { id: user.id }, data: { preferences: withSecurity(user.preferences, security) } });
  const passwordMatches = async (user, given) =>
    user.password.startsWith('$2') ? bcrypt.compare(String(given || ''), user.password) : given === user.password;

  app.get(['/api/auth/security', '/auth/security'], apiLimiter, authenticateToken, async (req, res) => {
    try {
      const user = await loadAccount(req.user.id);
      if (!user) return res.status(401).json({ error: 'Sesión no válida.' });
      const security = getSecurity(user.preferences);
      res.json({
        twoFactorEnabled: Boolean(security.totp?.enabled),
        recoveryCodesLeft: Array.isArray(security.totp?.recovery) ? security.totp.recovery.length : 0,
        emailAlerts: isMailConfigured(),
      });
    } catch (error) {
      console.error('Security status error:', error);
      res.status(500).json({ error: 'No se pudo consultar la seguridad de la cuenta.' });
    }
  });

  // Cierra la sesión en todos los dispositivos (también en este: se devuelve un token nuevo).
  app.post(['/api/auth/logout-all', '/auth/logout-all'], authRateLimit, securityLimiter, authenticateToken, async (req, res) => {
    const secret = requireSecret(res);
    if (!secret) return;
    try {
      const user = await loadAccount(req.user.id);
      if (!user) return res.status(401).json({ error: 'Sesión no válida.' });
      const security = getSecurity(user.preferences);
      const next = { ...security, sessionVersion: (security.sessionVersion || 0) + 1 };
      const updated = await saveSecurity(user, next);
      sendSecurityEmail(updated.email, {
        subject: 'Se cerró la sesión en todos tus dispositivos',
        heading: 'Sesión cerrada en todos los dispositivos',
        body: 'Se ha cerrado la sesión de tu cuenta de Recordatorios en todos los dispositivos.',
      });
      res.json({ ...sessionResponse(updated, secret), message: 'Se cerró la sesión en el resto de dispositivos.' });
    } catch (error) {
      console.error('Logout all error:', error);
      res.status(500).json({ error: 'No se pudo cerrar la sesión en los demás dispositivos.' });
    }
  });

  // Paso 1: genera un secreto (aún sin activar) para añadirlo a la app de autenticación.
  app.post(['/api/auth/2fa/setup', '/auth/2fa/setup'], authRateLimit, securityLimiter, authenticateToken, async (req, res) => {
    const secret = requireSecret(res);
    if (!secret) return;
    try {
      const user = await loadAccount(req.user.id);
      if (!user) return res.status(401).json({ error: 'Sesión no válida.' });
      const security = getSecurity(user.preferences);
      if (security.totp?.enabled) return res.status(409).json({ error: 'La verificación en dos pasos ya está activada.' });
      const totpSecret = newTotpSecret();
      await saveSecurity(user, { ...security, totpPending: { secret: encryptSecret(totpSecret, secret), at: Date.now() } });
      res.json({ secret: totpSecret, otpauthUrl: otpauthUrl(user.email, totpSecret) });
    } catch (error) {
      console.error('2FA setup error:', error);
      res.status(500).json({ error: 'No se pudo preparar la verificación en dos pasos.' });
    }
  });

  // Paso 2: confirma con un código de la app; entonces se activa y se entregan los códigos de recuperación (una sola vez).
  app.post(['/api/auth/2fa/enable', '/auth/2fa/enable'], authRateLimit, securityLimiter, authenticateToken, async (req, res) => {
    const secret = requireSecret(res);
    if (!secret) return;
    try {
      const user = await loadAccount(req.user.id);
      if (!user) return res.status(401).json({ error: 'Sesión no válida.' });
      const security = getSecurity(user.preferences);
      const pending = security.totpPending;
      const pendingSecret = pending && Date.now() - pending.at < 15 * 60 * 1000 ? decryptSecret(pending.secret, secret) : null;
      if (!pendingSecret) return res.status(400).json({ error: 'Empieza de nuevo: el código de configuración ha caducado.' });
      const step = verifyTotp(pendingSecret, req.body?.code);
      if (step === null) return res.status(400).json({ error: 'El código no es correcto. Revisa la hora del móvil e inténtalo de nuevo.' });
      const recoveryCodes = generateRecoveryCodes();
      const { totpPending: _done, ...rest } = security;
      await saveSecurity(user, {
        ...rest,
        totp: { enabled: true, secret: encryptSecret(pendingSecret, secret), lastStep: step, recovery: recoveryCodes.map(hashRecoveryCode) },
      });
      sendSecurityEmail(user.email, {
        subject: 'Verificación en dos pasos activada',
        heading: 'Verificación en dos pasos activada',
        body: 'Desde ahora, al iniciar sesión te pediremos también un código de tu app de autenticación.',
      });
      res.json({ enabled: true, recoveryCodes });
    } catch (error) {
      console.error('2FA enable error:', error);
      res.status(500).json({ error: 'No se pudo activar la verificación en dos pasos.' });
    }
  });

  // Desactivar exige la contraseña y un código (o un código de recuperación).
  app.post(['/api/auth/2fa/disable', '/auth/2fa/disable'], authRateLimit, securityLimiter, authenticateToken, async (req, res) => {
    const secret = requireSecret(res);
    if (!secret) return;
    try {
      const user = await loadAccount(req.user.id);
      if (!user) return res.status(401).json({ error: 'Sesión no válida.' });
      const security = getSecurity(user.preferences);
      if (!security.totp?.enabled) return res.status(400).json({ error: 'La verificación en dos pasos no está activada.' });
      if (!(await passwordMatches(user, req.body?.password))) return res.status(400).json({ error: 'La contraseña no es correcta.' });
      const second = checkSecondFactor(security, String(req.body?.code || ''), secret);
      if (!second.ok) return res.status(400).json({ error: 'El código no es correcto o ha caducado.' });
      const { totp: _off, totpPending: _pending, ...rest } = second.security;
      await saveSecurity(user, rest);
      sendSecurityEmail(user.email, {
        subject: 'Verificación en dos pasos desactivada',
        heading: 'Verificación en dos pasos desactivada',
        body: 'Se ha desactivado la verificación en dos pasos de tu cuenta.',
      });
      res.json({ enabled: false });
    } catch (error) {
      console.error('2FA disable error:', error);
      res.status(500).json({ error: 'No se pudo desactivar la verificación en dos pasos.' });
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
        if (payload._hard_delete) {
          ops.push(delegate.delete({ where: { id: existing.id } }));
          continue;
        }
        if (!shouldApplyIncoming(payload, existing.payload)) {
          stale.push(toClientPayload(userId, existing));
          continue;
        }
        ops.push(delegate.update({ where: { id: existing.id }, data: { payload, deletedAt } }));
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
      }
    }
    return { ops, stale };
  }

  app.post(['/api/sync/push', '/sync/push'], apiLimiter, authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
      const transaction = [];
      const stale = {};
      for (const { key, model } of collections) {
        const plan = await planCollectionWrites(model, userId, req.body?.[key]);
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
        const existingUpdatedAt = existing?.preferences?.updated_at ? new Date(existing.preferences.updated_at).getTime() : 0;
        const incomingUpdatedAt = preferences.updated_at ? new Date(preferences.updated_at).getTime() : Date.now();
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
    } catch (error) {
      console.error('Push error:', error);
      res.status(error.status || 500).json({ error: error.status ? error.message : 'Error sincronizando datos' });
    }
  });

  app.get(['/api/sync/pull', '/sync/pull'], apiLimiter, authenticateToken, async (req, res) => {
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
          prisma.list.findMany({ where: changedSince, include: { sharedLinks: { select: { id: true } } } }),
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
        preferences: publicPreferences(userRecord?.preferences),
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
  // El EventSource no puede mandar cabeceras, y poner el token de sesión (30 días) en la URL lo
  // dejaría en logs y proxies. En su lugar, el cliente pide un ticket de 60 s y un solo propósito.
  app.post(['/api/sync/live-ticket', '/sync/live-ticket'], apiLimiter, authenticateToken, (req, res) => {
    const secret = requireSecret(res);
    if (!secret) return;
    const ticket = jwt.sign({ sub: req.user.id, purpose: 'live' }, secret, { expiresIn: '60s', algorithm: 'HS256' });
    res.json({ ticket });
  });

  app.get(['/api/sync/live', '/sync/live'], publicLimiter, async (req, res) => {
    if (process.env.VERCEL) return res.status(204).end();
    const secret = getJwtSecret();
    const ticket = typeof req.query.ticket === 'string' ? req.query.ticket : null;
    if (!ticket || !secret) return res.sendStatus(401);

    let userId;
    try {
      const payload = jwt.verify(ticket, secret, { algorithms: ['HS256'] });
      if (payload?.purpose !== 'live' || !payload.sub) return res.sendStatus(401);
      const user = await prisma.user.findUnique({ where: { id: String(payload.sub) }, select: { id: true } });
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

  app.get(['/api/share/shared-list-ids', '/share/shared-list-ids'], apiLimiter, authenticateToken, async (req, res) => {
    try {
      const userId = req.user.id;
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

  app.post(['/api/share/generate', '/share/generate'], apiLimiter, authenticateToken, async (req, res) => {
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
      const nextPayload = list.payload && typeof list.payload === 'object' ? { ...list.payload, isShared: true } : { isShared: true };
      await prisma.list.update({ where: { id: list.id }, data: { payload: nextPayload, updatedAt: new Date() } });
      res.json({ token: link.id });
    } catch (err) {
      console.error('Share generate error:', err);
      res.status(500).json({ error: 'No se pudo generar el enlace' });
    }
  });

  app.delete(['/api/share/list/:listId', '/share/list/:listId'], apiLimiter, authenticateToken, async (req, res) => {
    try {
      const list = await findOwnedList(req.user.id, req.params.listId);
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

  app.get(['/api/share/:token', '/share/:token'], publicLimiter, async (req, res) => {
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
      // Lista blanca: la vista pública solo recibe lo que necesita pintar. Notas privadas, personas,
      // ubicaciones, enlaces de gestión o datos de tarjetas nunca salen por un enlace compartido.
      const pick = (p, keys) => Object.fromEntries(keys.filter((k) => p[k] !== undefined).map((k) => [k, p[k]]));
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

  // --- AVISOS CON LA APP CERRADA (Web Push) ---
  app.get(['/api/push/public-key', '/push/public-key'], (req, res) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    if (!publicKey || !pushSender) return res.status(503).json({ error: 'Los avisos todavía no están activados en este servidor.' });
    res.json({ publicKey });
  });

  app.post(['/api/push/subscribe', '/push/subscribe'], apiLimiter, authenticateToken, async (req, res) => {
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
        update: { userId: req.user.id, keys: { p256dh: keys.p256dh, auth: keys.auth }, ...prefs },
        create: { userId: req.user.id, endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, ...prefs, lastCheckedAt: new Date() },
      });
      res.json({ success: true, ...prefs });
    } catch (error) {
      console.error('Push subscribe error:', error);
      res.status(503).json({ error: 'No se pudieron activar los avisos. Inténtalo más tarde.' });
    }
  });

  app.post(['/api/push/unsubscribe', '/push/unsubscribe'], apiLimiter, authenticateToken, async (req, res) => {
    const endpoint = req.body?.endpoint;
    if (typeof endpoint !== 'string') return res.status(400).json({ error: 'Suscripción no válida' });
    try {
      await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.user.id } });
      res.json({ success: true });
    } catch (error) {
      console.error('Push unsubscribe error:', error);
      res.status(503).json({ error: 'No se pudieron desactivar los avisos.' });
    }
  });

  // Tarea programada (Vercel Cron o GitHub Actions): envía lo que toque desde la última pasada.
  // Se protege con CRON_SECRET (Vercel Cron manda «Authorization: Bearer <CRON_SECRET>»).
  app.all(['/api/cron/notify', '/cron/notify'], async (req, res) => {
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
      const loadUser = (userId) => {
        if (!userData.has(userId)) {
          userData.set(userId, (async () => {
            const where = { userId, deletedAt: null };
            const [tasks, lists, sections, user] = await Promise.all([
              prisma.task.findMany({ where }),
              prisma.list.findMany({ where }),
              prisma.listSection.findMany({ where }),
              prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } }),
            ]);
            const toClient = (rows) => rows.map((r) => toClientPayload(userId, r));
            // El día semanal elegido en la app (sincronizado) manda sobre el de la suscripción.
            const weeklyDay = user?.preferences?.weeklyTasksDay;
            return {
              data: { tasks: toClient(tasks), lists: toClient(lists), sections: toClient(sections) },
              weeklyDay: Number.isInteger(weeklyDay) && weeklyDay >= 0 && weeklyDay <= 6 ? weeklyDay : undefined,
            };
          })());
        }
        return userData.get(userId);
      };

      const processSubscription = async (sub) => {
        try {
          const { data, weeklyDay } = await loadUser(sub.userId);
          const { messages, sentLog } = planNotifications({
            ...data,
            prefs: { timeZone: sub.timeZone, digestHour: sub.digestHour, weeklyDay: weeklyDay ?? sub.weeklyDay },
            now,
            since: sub.lastCheckedAt,
            sentLog: sub.sentLog || {},
          });
          let gone = false;
          for (const message of messages) {
            try {
              await pushSender({ endpoint: sub.endpoint, keys: sub.keys }, message);
              sent++;
            } catch (error) {
              // 404/410: el navegador anuló la suscripción; se borra para no reintentar.
              if (error?.statusCode === 404 || error?.statusCode === 410) { gone = true; break; }
              console.error('Push send error:', error?.statusCode || error);
            }
          }
          if (gone) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } });
            removed++;
          } else {
            await prisma.pushSubscription.update({ where: { id: sub.id }, data: { lastCheckedAt: now, sentLog } });
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

  // --- MCP (Model Context Protocol) ---
  app.post(['/api/mcp', '/mcp'], apiLimiter, optionalAuthenticateToken, async (req, res) => {
    try {
      res.json(await handleMcpRequest(req.body, prisma, req.user?.id));
    } catch (err) {
      console.error('MCP route error:', err);
      res.status(500).json({ jsonrpc: '2.0', id: req.body?.id ?? null, error: { code: -32000, message: 'Internal Server Error' } });
    }
  });

  app.get(['/api/mcp', '/mcp', '/api/mcp/tools', '/mcp/tools'], publicLimiter, (req, res) => {
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
