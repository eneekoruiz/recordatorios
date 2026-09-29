// Seguridad de la cuenta sin tocar el esquema de la base de datos: todo vive en `User.preferences._security`,
// que NUNCA se envía al cliente (ver publicPreferences) ni puede sobrescribirse desde el cliente.
import crypto from 'node:crypto';

export const SECURITY_KEY = '_security';
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

// ── Preferencias ↔ datos de seguridad ────────────────────────────────────────────────────────────
const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);
export const getSecurity = (prefs) => (isObject(prefs) && isObject(prefs[SECURITY_KEY]) ? prefs[SECURITY_KEY] : {});
export const withSecurity = (prefs, security) => ({ ...(isObject(prefs) ? prefs : {}), [SECURITY_KEY]: security });
/** Lo que puede ver el cliente: las preferencias sin la clave de seguridad. */
export const publicPreferences = (prefs) => {
  if (!isObject(prefs)) return prefs ?? null;
  const { [SECURITY_KEY]: _hidden, ...rest } = prefs;
  return rest;
};
/** Lo que el cliente puede escribir: nunca la clave de seguridad. */
export const stripSecurity = publicPreferences;

// ── TOTP (RFC 6238) ──────────────────────────────────────────────────────────────────────────────
export function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error('base32 inválido');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function hotp(key, counter, digits = 6) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', key).update(msg).digest();
  const offset = h[h.length - 1] & 0xf;
  const bin = ((h[offset] & 0x7f) << 24) | (h[offset + 1] << 16) | (h[offset + 2] << 8) | h[offset + 3];
  return String(bin % 10 ** digits).padStart(digits, '0');
}

export const totpStep = (nowMs = Date.now(), period = 30) => Math.floor(nowMs / 1000 / period);
export const totpCode = (secretB32, nowMs = Date.now()) => hotp(base32Decode(secretB32), totpStep(nowMs));

/**
 * Comprueba un código de 6 dígitos con ±1 intervalo de margen (relojes desajustados). Devuelve el intervalo
 * que coincidió (para guardarlo y rechazar su reutilización: `lastStep`) o null.
 */
export function verifyTotp(secretB32, code, { nowMs = Date.now(), window = 1, lastStep = -1 } = {}) {
  const given = String(code ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(given)) return null;
  let key;
  try {
    key = base32Decode(secretB32);
  } catch {
    return null;
  }
  const current = totpStep(nowMs);
  let matched = null;
  for (let step = current - window; step <= current + window; step++) {
    const expected = hotp(key, step);
    // Se recorren todos los intervalos sin cortar antes: el tiempo no revela cuál acertó.
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(given)) && step > lastStep) matched = step;
  }
  return matched;
}

export const newTotpSecret = () => base32Encode(crypto.randomBytes(20));

export const otpauthUrl = (email, secretB32, issuer = 'Recordatorios') =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

// ── Secreto TOTP cifrado en reposo (AES-256-GCM, clave derivada del secreto del servidor) ────────
const atRestKey = (serverSecret) => crypto.createHash('sha256').update(`totp-at-rest:${serverSecret}`).digest();

export function encryptSecret(plain, serverSecret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', atRestKey(serverSecret), iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), ct.toString('base64')].join('.');
}

export function decryptSecret(blob, serverSecret) {
  try {
    const [v, iv, tag, ct] = String(blob).split('.');
    if (v !== 'v1') return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', atRestKey(serverSecret), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ct, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

// ── Códigos de recuperación (un solo uso; en la BD solo se guarda su hash) ───────────────────────
export const generateRecoveryCodes = (n = 8) =>
  Array.from({ length: n }, () => {
    const hex = crypto.randomBytes(5).toString('hex');
    return `${hex.slice(0, 5)}-${hex.slice(5)}`;
  });
export const hashRecoveryCode = (code) => sha256(String(code).toLowerCase().replace(/[^a-z0-9]/g, ''));

/**
 * Segundo factor de un inicio de sesión: código TOTP o de recuperación. Devuelve { ok, security } con los
 * datos ya actualizados (último intervalo usado / código de recuperación consumido), o { ok: false }.
 */
export function checkSecondFactor(security, code, serverSecret, nowMs = Date.now()) {
  const totp = security?.totp;
  if (!totp?.enabled) return { ok: true, security };
  const secret = decryptSecret(totp.secret, serverSecret);
  const step = secret ? verifyTotp(secret, code, { nowMs, lastStep: Number.isInteger(totp.lastStep) ? totp.lastStep : -1 }) : null;
  if (step !== null) return { ok: true, security: { ...security, totp: { ...totp, lastStep: step } } };

  const hash = hashRecoveryCode(code);
  const recovery = Array.isArray(totp.recovery) ? totp.recovery : [];
  const idx = recovery.findIndex((h) => typeof h === 'string' && h.length === hash.length && crypto.timingSafeEqual(Buffer.from(h), Buffer.from(hash)));
  if (idx >= 0) {
    return { ok: true, usedRecovery: true, security: { ...security, totp: { ...totp, recovery: recovery.filter((_, i) => i !== idx) } } };
  }
  return { ok: false };
}

// ── Dispositivos conocidos (aviso de «inicio de sesión desde un dispositivo nuevo») ──────────────
export const deviceId = (userAgent) => sha256(String(userAgent || '').slice(0, 300)).slice(0, 16);

/**
 * Añade el dispositivo (máx. 10, los más recientes). `changed` indica si hay que guardar; `isNew` solo si ya
 * había otros dispositivos: el primero de la cuenta no avisa.
 */
export function noteDevice(security, id) {
  const known = Array.isArray(security?.devices) ? security.devices : [];
  if (known.includes(id)) return { security, isNew: false, changed: false };
  return { security: { ...security, devices: [...known, id].slice(-10) }, isNew: known.length > 0, changed: true };
}
