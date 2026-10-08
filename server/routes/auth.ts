import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import { resetLinkBase } from '../app.js';
import type { AppContext } from '../context.js';
import { isMailConfigured, sendPasswordResetEmail, sendSecurityEmail } from '../mail.js';
import { checkSecondFactor, consumeSecondFactor, decryptSecret, deviceId, encryptSecret, generateRecoveryCodes, getSecurity, hashRecoveryCode, newTotpSecret, noteDevice, otpauthUrl, persistDevice, updatePreferencesIfCurrent, updateSecurity, verifyTotp } from '../security.js';
const RESET_TTL = '30m';

export function createAuthRouter(context: AppContext) {
  const router = express.Router();
  const { 
    prisma, hit, requireSecret, sessionResponse, authenticateToken, bumpedSessions, 
    hashPassword, validatePassword, clientIp, 
    apiLimiter, authRateLimit, authIpLimiter, loginLimiter, changePasswordLimiter, forgotLimiter, createRateLimiter, emailRegex, normalizeEmail, isProduction, bcryptCost
  } = context;

  // --- AUTH ---
  router.post('/auth/register', authRateLimit, authIpLimiter, async (req: express.Request, res: express.Response) => {
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
    } catch (error: any) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'Error al registrar la cuenta. Inténtalo de nuevo.' });
    }
  });

  router.post('/auth/login', authRateLimit, authIpLimiter, loginLimiter, async (req: express.Request, res: express.Response) => {
    const secret = requireSecret(res);
    if (!secret) return;
    try {
      const cleanEmail = normalizeEmail(req.body?.email);
      const { password } = req.body || {};
      if (!cleanEmail || typeof password !== 'string' || !password) {
        return res.status(400).json({ error: 'Introduce tu email y contraseña.' });
      }

      const invalid = () => res.status(401).json({ error: 'Email o contraseña incorrectos.' });
      let user = await prisma.user.findUnique({ where: { email: cleanEmail } });
      if (!user || !user.password) {
        await hashPassword(password); // tiempo constante: no revelar si la cuenta existe
        return invalid();
      }

      let valid = false;
      if (!user.password.startsWith('$2')) {
        // Migración silenciosa de contraseñas heredadas en texto plano.
        valid = password === user.password;
        if (valid) {
          const oldPassword = user.password;
          const upgraded = await hashPassword(password);
          const saved = await prisma.user.updateMany({ where: { id: user.id, password: oldPassword }, data: { password: upgraded } });
          user = saved.count === 1 ? { ...user, password: upgraded } : await prisma.user.findUnique({ where: { id: user.id } });
          if (!user?.password) valid = false;
          else valid = user.password.startsWith('$2')
            ? await bcrypt.compare(password, user.password)
            : password === user.password;
        }
      } else {
        valid = await bcrypt.compare(password, user.password);
        // Actualización silenciosa al coste actual (solo con la contraseña recién validada).
        if (valid && bcrypt.getRounds(user.password) < bcryptCost()) {
          const oldPassword = user.password;
          const upgraded = await hashPassword(password);
          const saved = await prisma.user.updateMany({ where: { id: user.id, password: oldPassword }, data: { password: upgraded } });
          user = saved.count === 1 ? { ...user, password: upgraded } : await prisma.user.findUnique({ where: { id: user.id } });
          if (!user?.password || !user.password.startsWith('$2')) valid = false;
          else valid = await bcrypt.compare(password, user.password);
        }
      }
      if (!valid) return invalid();
      if (!user) return invalid();

      // Segundo factor (solo se comprueba con la contraseña ya validada: no revela si la cuenta lo tiene).
      let security = getSecurity(user.preferences);
      let authenticatedTotpSecret: string | null = null;
      if (security.totp?.enabled) {
        const code = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
        if (!code) {
          return res.status(401).json({ error: 'Introduce el código de verificación de tu app.', twoFactorRequired: true });
        }
        const second = await consumeSecondFactor(prisma, user, code, secret);
        if (!second.ok || !second.user) {
          return res.status(401).json({ error: 'El código no es correcto o ha caducado.', twoFactorRequired: true });
        }
        security = second.security;
        authenticatedTotpSecret = security.totp?.secret || null;
        user = second.user;
        if (!user) return res.status(401).json({ error: 'Sesión no válida.' });
      }
      if (!user) return invalid();

      // Aviso de inicio de sesión desde un dispositivo nuevo
      let seen = noteDevice(security, deviceId(req.headers['user-agent']));
      try {
        const recorded = await persistDevice(prisma, user.id, deviceId(req.headers['user-agent']));
        if (recorded?.user) {
          seen = recorded;
          user = recorded.user;
        }
      } catch (error: any) {
        // El registro de dispositivo es de mejor esfuerzo y nunca bloquea entrar.
        console.error('No se pudo registrar el dispositivo:', error?.message || error);
      }
      if (!user) return invalid();

      // persistDevice can overlap a password reset/change. Revalidate against the latest
      // password and sessionVersion before minting a token, so an old credential cannot
      // inherit the fresh sessionVersion written by the concurrent password operation.
      const currentAccount = await prisma.user.findUnique({ where: { id: user.id } });
      if (!currentAccount?.password) return invalid();
      const stillAuthenticated = currentAccount.password.startsWith('$2')
        ? await bcrypt.compare(password, currentAccount.password)
        : password === currentAccount.password;
      if (!stillAuthenticated) return invalid();
      const currentTotp = getSecurity(currentAccount.preferences).totp;
      if (currentTotp?.enabled && (!authenticatedTotpSecret || currentTotp.secret !== authenticatedTotpSecret)) return invalid();
      user = currentAccount;

      if (seen.isNew) {
        try {
          sendSecurityEmail(user!.email, {
            subject: 'Nuevo inicio de sesión en Recordatorios',
            heading: 'Has iniciado sesión desde un dispositivo nuevo',
            body: 'Acabamos de detectar un inicio de sesión en tu cuenta desde un navegador o dispositivo que no habíamos visto antes.',
          });
        } catch (error: any) {
          console.error('No se pudo enviar el aviso de nuevo dispositivo:', error?.message || error);
        }
      }

      res.json(sessionResponse(user, secret));
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Error en el servidor de autenticación.' });
    }
  });

  // Paso 1 de la recuperación: enviar enlace firmado al email (nunca revela si existe la cuenta).
  router.post('/auth/forgot-password', authRateLimit, forgotLimiter, async (req: express.Request, res: express.Response) => {
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
      console.info('🔑 Enlace de recuperación generado en modo desarrollo.');
      return res.json({ message: genericMessage, devResetUrl: resetUrl });
    } catch (error: any) {
      console.error('Forgot password error:', error);
      res.status(500).json({ error: 'No se pudo enviar el enlace. Inténtalo más tarde.' });
    }
  });

  // Paso 2: fijar nueva contraseña con el token recibido por email.
  router.post('/auth/reset-password', authRateLimit, authIpLimiter, async (req: express.Request, res: express.Response) => {
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
      let updated = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        const user = await prisma.user.findUnique({ where: { id: String(decoded.sub) } });
        if (!user) return invalidLink();
        try {
          jwt.verify(token, secret + user.password, { algorithms: ['HS256'] });
        } catch {
          return invalidLink();
        }
        const saved = await updatePreferencesIfCurrent(
          prisma,
          user,
          bumpedSessions(user),
          { password: user.password },
          { password: await hashPassword(newPassword) },
        );
        if (saved.count === 1) {
          // updateMany returns a count only; read the committed row for the response.
          updated = await prisma.user.findUnique({ where: { id: user.id } });
          break;
        }
      }
      if (!updated) return res.status(409).json({ error: 'La cuenta cambió durante la operación. Vuelve a solicitar el enlace.' });
      sendSecurityEmail(updated.email, {
        subject: 'Tu contraseña de Recordatorios ha cambiado',
        heading: 'Tu contraseña se ha restablecido',
        body: 'Acabas de restablecer la contraseña de tu cuenta y se han cerrado las demás sesiones.',
      });
      res.json({ ...sessionResponse(updated, secret), message: 'Contraseña actualizada. ¡Bienvenido de nuevo!' });
    } catch (error: any) {
      console.error('Reset password error:', error);
      res.status(500).json({ error: 'Error al restablecer la contraseña.' });
    }
  });

  router.post('/auth/change-password', authRateLimit, changePasswordLimiter, authenticateToken, async (req: express.Request, res: express.Response) => {
    const secret = requireSecret(res);
    if (!secret) return;
    try {
      const { currentPassword, newPassword } = req.body || {};
      const pwError = validatePassword(newPassword);
      if (pwError) return res.status(400).json({ error: pwError });
      let updated = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
        if (!user) return res.status(401).json({ error: 'Sesión no válida.' });
        const ok = user.password.startsWith('$2')
          ? await bcrypt.compare(String(currentPassword || ''), user.password)
          : currentPassword === user.password;
        if (!ok) return res.status(400).json({ error: 'La contraseña actual no es correcta.' });
        const nextPreferences = bumpedSessions(user);
        const saved = await updatePreferencesIfCurrent(
          prisma,
          user,
          nextPreferences,
          { password: user.password },
          { password: await hashPassword(newPassword) },
        );
        if (saved.count === 1) {
          updated = await prisma.user.findUnique({ where: { id: user.id } });
          break;
        }
      }
      if (!updated) return res.status(409).json({ error: 'La cuenta cambió durante la operación. Inténtalo de nuevo.' });
      sendSecurityEmail(updated.email, {
        subject: 'Tu contraseña de Recordatorios ha cambiado',
        heading: 'Tu contraseña se ha cambiado',
        body: 'Acabas de cambiar la contraseña de tu cuenta y se han cerrado las demás sesiones.',
      });
      res.json({ ...sessionResponse(updated, secret), message: 'Contraseña actualizada.' });
    } catch (error: any) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'No se pudo cambiar la contraseña.' });
    }
  });

  // --- SEGURIDAD DE LA CUENTA: sesiones y verificación en dos pasos (datos en preferences._security) ---
  const securityLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    keyFn: (req: any) => `security:${req.user?.id || clientIp(req)}`,
    message: 'Demasiados intentos. Espera unos minutos.',
    hit,
  });

  const loadAccount = (userId: string) => prisma.user.findUnique({ where: { id: userId } });
  const passwordMatches = async (user: any, given: any) =>
    user.password.startsWith('$2') ? bcrypt.compare(String(given || ''), user.password) : given === user.password;

  router.get('/auth/security', apiLimiter, authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
      const user = await loadAccount(req.user!.id);
      if (!user) return res.status(401).json({ error: 'Sesión no válida.' });
      const security = getSecurity(user.preferences);
      res.json({
        twoFactorEnabled: Boolean(security.totp?.enabled),
        recoveryCodesLeft: Array.isArray(security.totp?.recovery) ? security.totp.recovery.length : 0,
        emailAlerts: isMailConfigured(),
      });
    } catch (error: any) {
      console.error('Security status error:', error);
      res.status(500).json({ error: 'No se pudo consultar la seguridad de la cuenta.' });
    }
  });

  // Cierra la sesión en todos los dispositivos (también en este: se devuelve un token nuevo).
  router.post('/auth/logout-all', authRateLimit, securityLimiter, authenticateToken, async (req: express.Request, res: express.Response) => {
    const secret = requireSecret(res);
    if (!secret) return;
    try {
      const updated = await updateSecurity(prisma, req.user!.id, (security) => ({
        ...security,
        sessionVersion: (security.sessionVersion || 0) + 1,
      }));
      if (!updated) return res.status(409).json({ error: 'La seguridad de la cuenta cambió. Inténtalo de nuevo.' });
      sendSecurityEmail(updated.email, {
        subject: 'Se cerró la sesión en todos tus dispositivos',
        heading: 'Sesión cerrada en todos los dispositivos',
        body: 'Se ha cerrado la sesión de tu cuenta de Recordatorios en todos los dispositivos.',
      });
      res.json({ ...sessionResponse(updated, secret), message: 'Se cerró la sesión en el resto de dispositivos.' });
    } catch (error: any) {
      console.error('Logout all error:', error);
      res.status(500).json({ error: 'No se pudo cerrar la sesión en los demás dispositivos.' });
    }
  });

  // Paso 1: genera un secreto (aún sin activar) para añadirlo a la app de autenticación.
  router.post('/auth/2fa/setup', authRateLimit, securityLimiter, authenticateToken, async (req: express.Request, res: express.Response) => {
    const secret = requireSecret(res);
    if (!secret) return;
    try {
      const user = await loadAccount(req.user!.id);
      if (!user) return res.status(401).json({ error: 'Sesión no válida.' });
      const totpSecret = newTotpSecret();
      const pending = { secret: encryptSecret(totpSecret, secret), at: Date.now() };
      const updated = await updateSecurity(prisma, user.id, (security) =>
        security.totp?.enabled ? null : { ...security, totpPending: pending }
      );
      if (!updated) return res.status(409).json({ error: 'La verificación en dos pasos ya está activada o la cuenta cambió. Inténtalo de nuevo.' });
      res.json({ secret: totpSecret, otpauthUrl: otpauthUrl(user.email, totpSecret) });
    } catch (error: any) {
      console.error('2FA setup error:', error);
      res.status(500).json({ error: 'No se pudo preparar la verificación en dos pasos.' });
    }
  });

  // Paso 2: confirma con un código de la app; entonces se activa y se entregan los códigos de recuperación (una sola vez).
  router.post('/auth/2fa/enable', authRateLimit, securityLimiter, authenticateToken, async (req: express.Request, res: express.Response) => {
    const secret = requireSecret(res);
    if (!secret) return;
    try {
      const user = await loadAccount(req.user!.id);
      if (!user) return res.status(401).json({ error: 'Sesión no válida.' });
      const security = getSecurity(user.preferences);
      const pending = security.totpPending;
      const pendingSecret = pending && Date.now() - pending.at < 15 * 60 * 1000 ? decryptSecret(pending.secret, secret) : null;
      if (!pendingSecret) return res.status(400).json({ error: 'Empieza de nuevo: el código de configuración ha caducado.' });
      const step = verifyTotp(pendingSecret, req.body?.code);
      if (step === null) return res.status(400).json({ error: 'El código no es correcto. Revisa la hora del móvil e inténtalo de nuevo.' });
      const recoveryCodes = generateRecoveryCodes();
      const updated = await updateSecurity(prisma, user.id, (latest) => {
        const currentPending = latest.totpPending;
        if (latest.totp?.enabled || currentPending?.secret !== pending.secret || currentPending?.at !== pending.at || Date.now() - currentPending.at >= 15 * 60 * 1000) return null;
        const { totpPending: _done, ...rest } = latest;
        return {
          ...rest,
          totp: { enabled: true, secret: encryptSecret(pendingSecret, secret), lastStep: step, recovery: recoveryCodes.map(hashRecoveryCode) },
        };
      });
      if (!updated) return res.status(409).json({ error: 'La configuración de la verificación en dos pasos cambió. Empieza de nuevo.' });
      sendSecurityEmail(user.email, {
        subject: 'Verificación en dos pasos activada',
        heading: 'Verificación en dos pasos activada',
        body: 'Desde ahora, al iniciar sesión te pediremos también un código de tu app de autenticación.',
      });
      res.json({ enabled: true, recoveryCodes });
    } catch (error: any) {
      console.error('2FA enable error:', error);
      res.status(500).json({ error: 'No se pudo activar la verificación en dos pasos.' });
    }
  });

  // Desactivar exige la contraseña y un código (o un código de recuperación).
  router.post('/auth/2fa/disable', authRateLimit, securityLimiter, authenticateToken, async (req: express.Request, res: express.Response) => {
    const secret = requireSecret(res);
    if (!secret) return;
    try {
      const user = await loadAccount(req.user!.id);
      if (!user) return res.status(401).json({ error: 'Sesión no válida.' });
      if (!(await passwordMatches(user, req.body?.password))) return res.status(400).json({ error: 'La contraseña no es correcta.' });
      let factorAccepted = false;
      const updated = await updateSecurity(prisma, user.id, (latest) => {
        if (!latest.totp?.enabled) return null;
        const second = checkSecondFactor(latest, String(req.body?.code || ''), secret);
        if (!second.ok) return null;
        factorAccepted = true;
        const { totp: _off, totpPending: _pending, ...rest } = second.security;
        return rest;
      });
      if (!updated) return res.status(factorAccepted ? 409 : 400).json({ error: factorAccepted ? 'La seguridad de la cuenta cambió. Inténtalo de nuevo.' : 'El código no es correcto o ha caducado.' });
      sendSecurityEmail(user.email, {
        subject: 'Verificación en dos pasos desactivada',
        heading: 'Verificación en dos pasos desactivada',
        body: 'Se ha desactivado la verificación en dos pasos de tu cuenta.',
      });
      res.json({ enabled: false });
    } catch (error: any) {
      console.error('2FA disable error:', error);
      res.status(500).json({ error: 'No se pudo desactivar la verificación en dos pasos.' });
    }
  });


  return router;
}
