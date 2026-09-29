import { useCallback, useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, LogOut, KeyRound, Copy, Smartphone } from 'lucide-react';
import { SheetNavBar } from '../ui/SheetNavBar';
import { confirmDialog, notify } from '../ui/confirmDialog';
import { apiUrl } from '../../sync/syncManager';
import { useAppStore } from '../../store/useAppStore';

type Status = { twoFactorEnabled: boolean; recoveryCodesLeft: number; emailAlerts: boolean };
type Step = 'idle' | 'setup' | 'codes' | 'disable' | 'password';

const groupKey = (secret: string) => secret.replace(/(.{4})/g, '$1 ').trim();

export function SecuritySheet({ onClose }: { onClose: () => void }) {
  const token = useAppStore((s) => s.token);
  const setToken = useAppStore((s) => s.setToken);
  const userId = useAppStore((s) => s.userId);

  const [status, setStatus] = useState<Status | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [setup, setSetup] = useState<{ secret: string; url: string; qr: string } | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const codeId = useId();
  const pwId = useId();
  const newPwId = useId();

  const call = useCallback(async (path: string, body?: unknown) => {
    const res = await fetch(apiUrl(path), {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `No se pudo completar la operación (${res.status}).`);
    return data;
  }, [token]);

  const refresh = useCallback(() => call('/api/auth/security').then(setStatus).catch((e) => setError(e.message)), [call]);
  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try { await fn(); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };

  const startSetup = () => run(async () => {
    const data = await call('/api/auth/2fa/setup', {});
    // El QR se genera en el navegador (el secreto no sale a ningún servicio) y la librería solo se descarga aquí.
    const { toDataURL } = await import('qrcode');
    const qr = await toDataURL(data.otpauthUrl, { margin: 1, width: 168 });
    setSetup({ secret: data.secret, url: data.otpauthUrl, qr });
    setCode('');
    setStep('setup');
  });

  const enable = () => run(async () => {
    const data = await call('/api/auth/2fa/enable', { code });
    setRecoveryCodes(data.recoveryCodes);
    setSetup(null);
    setCode('');
    setStep('codes');
    await refresh();
  });

  const disable = () => run(async () => {
    await call('/api/auth/2fa/disable', { password, code });
    setPassword(''); setCode(''); setStep('idle');
    notify('Verificación en dos pasos desactivada');
    await refresh();
  });

  const logoutAll = async () => {
    const ok = await confirmDialog({
      title: '¿Cerrar sesión en todos los dispositivos?',
      message: 'Tendrás que volver a entrar en el resto. Aquí seguirás conectado.',
      confirmText: 'Cerrar sesiones',
      tone: 'danger',
    });
    if (!ok) return;
    void run(async () => {
      const data = await call('/api/auth/logout-all', {});
      setToken(data.token, userId);
      notify('Sesión cerrada en el resto de dispositivos');
    });
  };

  const changePassword = () => run(async () => {
    const data = await call('/api/auth/change-password', { currentPassword: password, newPassword });
    setToken(data.token, userId);
    setPassword(''); setNewPassword(''); setStep('idle');
    notify('Contraseña actualizada');
  });

  const copyCodes = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCodes.join('\n'));
      notify('Códigos copiados');
    } catch { notify('No se pudieron copiar: anótalos a mano'); }
  };

  return createPortal(
    <div className="premium-overlay list-config-overlay" style={{ position: 'fixed', inset: 0, zIndex: 100000 }} onClick={onClose}>
      <div className="security-sheet form-sheet" role="dialog" aria-modal="true" aria-label="Seguridad" onClick={(e) => e.stopPropagation()}>
        <SheetNavBar title="Seguridad" onConfirm={onClose} confirmLabel="Listo" />
        <div className="form-sheet-body">
          {error && <div className="form-group is-padded security-error" role="alert">{error}</div>}

          <div>
            <p className="form-group-label">Verificación en dos pasos</p>
            <div className="form-group">
              {step === 'idle' && (
                <button type="button" className="form-row" disabled={busy || !status} onClick={status?.twoFactorEnabled ? () => { setError(''); setCode(''); setPassword(''); setStep('disable'); } : startSetup}>
                  <span className="form-row-icon" style={{ background: status?.twoFactorEnabled ? '#34c759' : '#8e8e93' }}><ShieldCheck size={15} /></span>
                  <span className="form-row-text">
                    <span className="form-row-title">{status?.twoFactorEnabled ? 'Activada' : 'Activar'}</span>
                    <span className="form-row-sub">
                      {status?.twoFactorEnabled
                        ? `${status.recoveryCodesLeft} códigos de recuperación disponibles · Toca para desactivar`
                        : 'Pide un código de tu app de autenticación al iniciar sesión'}
                    </span>
                  </span>
                </button>
              )}

              {step === 'setup' && setup && (
                <div className="security-setup">
                  <p className="security-help">1. Escanea el código con tu app de autenticación (Google Authenticator, 1Password, Authy…).</p>
                  <img className="security-qr" src={setup.qr} alt="Código QR para tu app de autenticación" width={168} height={168} />
                  <p className="security-help">¿No puedes escanearlo? Escribe esta clave: <code className="security-key">{groupKey(setup.secret)}</code></p>
                  <a className="security-link" href={setup.url}><Smartphone size={14} /> Abrir en la app de este dispositivo</a>
                  <label htmlFor={codeId} className="security-help">2. Escribe el código de 6 dígitos que muestra la app</label>
                  <input id={codeId} className="security-input" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123 456" autoFocus />
                  <div className="security-actions">
                    <button type="button" className="security-btn" onClick={() => { setStep('idle'); setSetup(null); }}>Cancelar</button>
                    <button type="button" className="security-btn is-primary" disabled={busy || code.replace(/\s/g, '').length !== 6} onClick={enable}>Activar</button>
                  </div>
                </div>
              )}

              {step === 'codes' && (
                <div className="security-setup">
                  <p className="security-help"><strong>Guarda estos códigos de recuperación.</strong> Cada uno sirve una vez si pierdes el móvil. No volverán a mostrarse.</p>
                  <ul className="security-codes" aria-label="Códigos de recuperación">
                    {recoveryCodes.map((c) => <li key={c}>{c}</li>)}
                  </ul>
                  <div className="security-actions">
                    <button type="button" className="security-btn" onClick={copyCodes}><Copy size={14} /> Copiar</button>
                    <button type="button" className="security-btn is-primary" onClick={() => { setRecoveryCodes([]); setStep('idle'); }}>Ya los he guardado</button>
                  </div>
                </div>
              )}

              {step === 'disable' && (
                <div className="security-setup">
                  <p className="security-help">Para desactivarla, confirma tu contraseña y un código de la app (o de recuperación).</p>
                  <label htmlFor={pwId} className="security-help">Contraseña</label>
                  <input id={pwId} className="security-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  <label htmlFor={codeId} className="security-help">Código</label>
                  <input id={codeId} className="security-input" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
                  <div className="security-actions">
                    <button type="button" className="security-btn" onClick={() => setStep('idle')}>Cancelar</button>
                    <button type="button" className="security-btn is-danger" disabled={busy || !password || !code.trim()} onClick={disable}>Desactivar</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <p className="form-group-label">Sesiones y contraseña</p>
            <div className="form-group">
              <button type="button" className="form-row" disabled={busy} onClick={logoutAll}>
                <span className="form-row-icon" style={{ background: '#ff3b30' }}><LogOut size={15} /></span>
                <span className="form-row-text">
                  <span className="form-row-title">Cerrar sesión en todos los dispositivos</span>
                  <span className="form-row-sub">Útil si has perdido un dispositivo o usaste uno ajeno</span>
                </span>
              </button>
              {step === 'password' ? (
                <div className="security-setup">
                  <label htmlFor={pwId} className="security-help">Contraseña actual</label>
                  <input id={pwId} className="security-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
                  <label htmlFor={newPwId} className="security-help">Contraseña nueva (mínimo 8 caracteres)</label>
                  <input id={newPwId} className="security-input" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                  <div className="security-actions">
                    <button type="button" className="security-btn" onClick={() => { setStep('idle'); setPassword(''); setNewPassword(''); }}>Cancelar</button>
                    <button type="button" className="security-btn is-primary" disabled={busy || !password || newPassword.length < 8} onClick={changePassword}>Cambiar</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="form-row" disabled={busy} onClick={() => { setError(''); setStep('password'); }}>
                  <span className="form-row-icon" style={{ background: '#007aff' }}><KeyRound size={15} /></span>
                  <span className="form-row-text"><span className="form-row-title">Cambiar contraseña</span></span>
                </button>
              )}
            </div>
            {status && (
              <p className="form-group-footer">
                {status.emailAlerts
                  ? 'Te avisamos por correo si cambia la contraseña o entras desde un dispositivo nuevo.'
                  : 'Los avisos por correo no están activados en este servidor.'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
