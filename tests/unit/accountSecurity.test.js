import { describe, it, expect } from 'vitest';
import {
  base32Encode, base32Decode, hotp, totpCode, verifyTotp, newTotpSecret, otpauthUrl, encryptSecret, decryptSecret,
  generateRecoveryCodes, hashRecoveryCode, checkSecondFactor, noteDevice, deviceId, publicPreferences, withSecurity, getSecurity,
} from '../../server/security.js';

describe('TOTP (RFC 6238)', () => {
  // Vectores de la RFC 4226/6238 con la clave «12345678901234567890» (ASCII)
  const key = Buffer.from('12345678901234567890');
  it('HOTP coincide con los vectores de la RFC 4226', () => {
    expect([0, 1, 2, 3, 4, 5].map((c) => hotp(key, c))).toEqual(['755224', '287082', '359152', '969429', '338314', '254676']);
  });
  it('TOTP coincide con el vector de la RFC 6238 (T = 59 s → 94287082 con 8 dígitos; 287082 con 6)', () => {
    const b32 = base32Encode(key);
    expect(totpCode(b32, 59_000)).toBe('287082');
  });
  it('base32 va y vuelve', () => {
    const s = newTotpSecret();
    expect(base32Encode(base32Decode(s))).toBe(s);
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
  });
  it('acepta el intervalo actual y ±1, rechaza el resto y códigos mal formados', () => {
    const s = newTotpSecret();
    const now = 1_700_000_000_000;
    const code = totpCode(s, now);
    expect(verifyTotp(s, code, { nowMs: now })).not.toBeNull();
    expect(verifyTotp(s, code, { nowMs: now + 30_000 })).not.toBeNull();
    expect(verifyTotp(s, code, { nowMs: now + 90_000 })).toBeNull();
    expect(verifyTotp(s, '12345', { nowMs: now })).toBeNull();
    expect(verifyTotp(s, 'abcdef', { nowMs: now })).toBeNull();
  });
  it('un código no se puede reutilizar (lastStep)', () => {
    const s = newTotpSecret();
    const now = 1_700_000_000_000;
    const code = totpCode(s, now);
    const step = verifyTotp(s, code, { nowMs: now });
    expect(verifyTotp(s, code, { nowMs: now, lastStep: step })).toBeNull();
  });
  it('genera la URL otpauth para las apps de autenticación', () => {
    expect(otpauthUrl('a@b.com', 'ABC')).toBe('otpauth://totp/Recordatorios:a%40b.com?secret=ABC&issuer=Recordatorios&algorithm=SHA1&digits=6&period=30');
  });
});

describe('secreto en reposo y códigos de recuperación', () => {
  it('cifra y descifra; con otra clave o manipulado no descifra', () => {
    const blob = encryptSecret('JBSWY3DPEHPK3PXP', 'servidor-secreto-largo');
    expect(blob).not.toContain('JBSWY3DPEHPK3PXP');
    expect(decryptSecret(blob, 'servidor-secreto-largo')).toBe('JBSWY3DPEHPK3PXP');
    expect(decryptSecret(blob, 'otro')).toBeNull();
    expect(decryptSecret(blob.slice(0, -3) + 'AAA', 'servidor-secreto-largo')).toBeNull();
  });
  it('los códigos de recuperación son únicos y se comparan sin guiones ni mayúsculas', () => {
    const codes = generateRecoveryCodes();
    expect(new Set(codes).size).toBe(8);
    expect(codes[0]).toMatch(/^[0-9a-f]{5}-[0-9a-f]{5}$/);
    expect(hashRecoveryCode(codes[0].toUpperCase().replace('-', ' '))).toBe(hashRecoveryCode(codes[0]));
  });
});

describe('segundo factor del inicio de sesión', () => {
  const server = 'servidor-secreto-largo';
  const secret = newTotpSecret();
  const codes = generateRecoveryCodes(2);
  const security = { totp: { enabled: true, secret: encryptSecret(secret, server), recovery: codes.map(hashRecoveryCode) } };
  const now = 1_700_000_000_000;

  it('sin 2FA no exige nada', () => {
    expect(checkSecondFactor({}, undefined, server).ok).toBe(true);
  });
  it('acepta un TOTP válido y guarda el intervalo; el mismo código ya no vale', () => {
    const first = checkSecondFactor(security, totpCode(secret, now), server, now);
    expect(first.ok).toBe(true);
    expect(checkSecondFactor(first.security, totpCode(secret, now), server, now).ok).toBe(false);
  });
  it('un código de recuperación vale una sola vez', () => {
    const r = checkSecondFactor(security, codes[0], server, now);
    expect(r.ok && r.usedRecovery).toBe(true);
    expect(r.security.totp.recovery).toHaveLength(1);
    expect(checkSecondFactor(r.security, codes[0], server, now).ok).toBe(false);
  });
  it('rechaza un código cualquiera', () => {
    expect(checkSecondFactor(security, '000000', server, now).ok).toBe(false);
    expect(checkSecondFactor(security, '', server, now).ok).toBe(false);
  });
});

describe('preferencias y dispositivos', () => {
  it('la clave de seguridad nunca sale en las preferencias públicas', () => {
    const prefs = withSecurity({ theme: 'dark' }, { totp: { enabled: true } });
    expect(publicPreferences(prefs)).toEqual({ theme: 'dark' });
    expect(getSecurity(prefs).totp.enabled).toBe(true);
    expect(publicPreferences(null)).toBeNull();
  });
  it('el primer dispositivo no avisa; uno nuevo sí; el mismo no', () => {
    const a = deviceId('Mozilla/5.0 A');
    const b = deviceId('Mozilla/5.0 B');
    const first = noteDevice({}, a);
    expect(first.isNew).toBe(false);
    expect(noteDevice(first.security, a).isNew).toBe(false);
    expect(noteDevice(first.security, b).isNew).toBe(true);
  });
});
