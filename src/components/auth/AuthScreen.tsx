import { useEffect, useId, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, LogIn, Mail, RotateCcw, UserPlus, WifiOff } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { apiUrl } from '../../sync/syncManager';
import { DEFAULT_SMART_LIST_VISIBILITY } from '../../constants/smartLists';
import './AuthScreen.css';

export const MIN_PASSWORD_LENGTH = 8;

type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

interface AuthScreenProps {
  onSuccess: () => void;
  /** Token recibido por email (?reset=...) para fijar una nueva contraseña. */
  resetToken?: string | null;
  onResetFinished?: () => void;
}

function applyServerPreferences(prefs: any) {
  if (!prefs || typeof prefs !== 'object') return;
  const update: Record<string, unknown> = {};
  if (prefs.smartListVisibility && typeof prefs.smartListVisibility === 'object') {
    update.smartListVisibility = { ...DEFAULT_SMART_LIST_VISIBILITY, ...prefs.smartListVisibility };
  }
  if (Array.isArray(prefs.pinnedSmartLists)) update.pinnedSmartLists = prefs.pinnedSmartLists;
  if (prefs.cycleVisibility && typeof prefs.cycleVisibility === 'object') {
    update.cycleVisibility = { ...prefs.cycleVisibility };
  }
  if (prefs.hideOnboarding) {
    try {
      localStorage.setItem('hide_onboarding_guide', 'true');
    } catch { /* sin almacenamiento */ }
  }
  update._preferences_dirty = false;
  if (prefs.updated_at) update.preferences_updated_at = prefs.updated_at;
  if (Object.keys(update).length) useAppStore.setState(update);
}

const passwordStrength = (pass: string) => {
  if (!pass) return 0;
  let score = 0;
  if (pass.length >= MIN_PASSWORD_LENGTH) score += 1;
  if (pass.length >= 12) score += 1;
  if (/[0-9]/.test(pass) && /[a-zA-Z]/.test(pass) && /[^a-zA-Z0-9]/.test(pass)) score += 1;
  return score;
};
const STRENGTH_LABELS = ['Demasiado corta', 'Aceptable', 'Buena', 'Excelente'];

const COPY: Record<AuthMode, { title: string; subtitle: string; submit: string; icon: typeof LogIn }> = {
  login: { title: 'Iniciar sesión', subtitle: 'Accede a tus recordatorios en todos tus dispositivos.', submit: 'Entrar', icon: LogIn },
  register: { title: 'Crear cuenta', subtitle: 'Sincroniza tus listas entre el móvil y el ordenador.', submit: 'Crear cuenta', icon: UserPlus },
  forgot: { title: 'Recuperar contraseña', subtitle: 'Te enviaremos un enlace seguro para elegir una nueva.', submit: 'Enviar enlace', icon: Mail },
  reset: { title: 'Nueva contraseña', subtitle: 'Elige una contraseña nueva para tu cuenta.', submit: 'Guardar y entrar', icon: KeyRound },
};

export function AuthScreen({ onSuccess, resetToken, onResetFinished }: AuthScreenProps) {
  const sessionExpired = useAppStore((s) => s.sessionExpired);
  const setToken = useAppStore((s) => s.setToken);

  const [mode, setMode] = useState<AuthMode>(resetToken ? 'reset' : 'login');
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem('userEmail') || '';
    } catch {
      return '';
    }
  });
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState(sessionExpired ? 'Tu sesión ha caducado. Vuelve a entrar: tus cambios locales se conservan.' : '');
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [suggestReset, setSuggestReset] = useState(false);
  const [loading, setLoading] = useState(false);

  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const confirmId = useId();

  useEffect(() => {
    if (resetToken) setMode('reset');
  }, [resetToken]);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError('');
    setInfo('');
    setDevResetUrl(null);
    setSuggestReset(false);
    setPassword('');
    setConfirmPassword('');
  };

  const needsPassword = mode !== 'forgot';
  const needsEmail = mode !== 'reset';
  const needsConfirm = mode === 'register' || mode === 'reset';
  const strength = passwordStrength(password);

  const completeSession = (data: any, cleanEmail?: string) => {
    setToken(data.token, data.user.id);
    try {
      localStorage.setItem('userEmail', data.user.email || cleanEmail || '');
      if (name.trim()) localStorage.setItem('userName', name.trim());
    } catch { /* sin almacenamiento */ }
    applyServerPreferences(data.preferences);
    onSuccess();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setSuggestReset(false);

    const cleanEmail = email.trim().toLowerCase();
    if (needsEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Introduce un correo electrónico válido.');
      return;
    }
    if (needsPassword && !password) {
      setError('Introduce tu contraseña.');
      return;
    }
    if (needsPassword && mode !== 'login' && password.length < MIN_PASSWORD_LENGTH) {
      setError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (needsConfirm && password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    const endpoint = {
      login: '/api/auth/login',
      register: '/api/auth/register',
      forgot: '/api/auth/forgot-password',
      reset: '/api/auth/reset-password',
    }[mode];
    const payload =
      mode === 'forgot'
        ? { email: cleanEmail }
        : mode === 'reset'
        ? { token: resetToken, newPassword: password }
        : { email: cleanEmail, password };

    setLoading(true);
    try {
      const res = await fetch(apiUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409 || (mode === 'login' && res.status === 401)) setSuggestReset(true);
        throw new Error(data.error || `No se pudo completar la operación (${res.status}).`);
      }

      if (mode === 'forgot') {
        setInfo(data.message || 'Revisa tu correo.');
        if (data.devResetUrl) setDevResetUrl(data.devResetUrl);
        return;
      }

      if (data.token && data.user) {
        if (mode === 'reset') onResetFinished?.();
        completeSession(data, cleanEmail);
      }
    } catch (err: any) {
      const offline = err instanceof TypeError;
      setError(offline ? 'No hay conexión con el servidor. Puedes usar la app sin cuenta y sincronizar más tarde.' : err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestMode = () => {
    setToken('local_offline_token', 'local_guest_' + Date.now());
    onSuccess();
  };

  const { title, subtitle, submit, icon: ModeIcon } = COPY[mode];

  return (
    <div className="auth-stage">
      <motion.section
        className="auth-hero-panel"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      >
        <img className="auth-app-icon" src="/favicon.svg" alt="" width={64} height={64} />
        <div>
          <h1 className="auth-title">
            Recordatorios <span>Élite</span>
          </h1>
          <p className="auth-lead">Tus listas, hábitos y fechas importantes, en calma y sincronizados en todos tus dispositivos.</p>
        </div>
        <ul className="auth-proof-grid" aria-label="Ventajas">
          <li><CheckCircle2 size={15} /> Funciona sin conexión</li>
          <li><CheckCircle2 size={15} /> Datos privados por cuenta</li>
          <li><CheckCircle2 size={15} /> Lenguaje natural</li>
        </ul>
      </motion.section>

      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.05 }}
      >
        <header className="auth-card-header">
          <div className="auth-icon" aria-hidden="true"><ModeIcon size={21} /></div>
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
        </header>

        {(mode === 'login' || mode === 'register') && (
          <div className="auth-segmented" role="tablist" aria-label="Tipo de acceso">
            <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'is-active' : ''} onClick={() => switchMode('login')}>
              Iniciar sesión
            </button>
            <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'is-active' : ''} onClick={() => switchMode('register')}>
              Crear cuenta
            </button>
          </div>
        )}

        <AnimatePresence initial={false}>
          {error && (
            <motion.div key="error" className="auth-alert auth-alert--error" role="alert" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <span>{error}</span>
              {suggestReset && (
                <button type="button" className="auth-inline-link" onClick={() => switchMode('forgot')}>
                  ¿Has olvidado tu contraseña?
                </button>
              )}
            </motion.div>
          )}
          {info && (
            <motion.div key="info" className="auth-alert auth-alert--info" role="status" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <span>{info}</span>
              {devResetUrl && (
                <a className="auth-inline-link" href={devResetUrl}>Abrir enlace (modo desarrollo)</a>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {mode === 'register' && (
            <label htmlFor={nameId} className="auth-field">
              <span>Tu nombre (opcional)</span>
              <input id={nameId} type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" placeholder="Para saludarte cada mañana" />
            </label>
          )}

          {needsEmail && (
            <label htmlFor={emailId} className="auth-field">
              <span>Correo electrónico</span>
              <input
                id={emailId}
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="tu@email.com"
              />
            </label>
          )}

          {needsPassword && (
            <div className="auth-field">
              <span className="auth-field-row">
                <label htmlFor={passwordId}>{mode === 'reset' ? 'Nueva contraseña' : 'Contraseña'}</label>
                {mode === 'login' && (
                  <button type="button" className="auth-inline-link" onClick={() => switchMode('forgot')}>
                    ¿La has olvidado?
                  </button>
                )}
              </span>
              <div className="auth-password">
                <input
                  id={passwordId}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder={mode === 'login' ? 'Tu contraseña' : `Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
                />
                <button type="button" className="auth-eye" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {needsConfirm && password.length > 0 && (
                <span className="auth-strength" data-level={strength}>
                  <i /><i /><i />
                  <em>{STRENGTH_LABELS[strength]}</em>
                </span>
              )}
            </div>
          )}

          {needsConfirm && (
            <label htmlFor={confirmId} className="auth-field">
              <span className="auth-field-row">
                Repite la contraseña
                {confirmPassword && (
                  <em className={password === confirmPassword ? 'auth-match' : 'auth-mismatch'}>
                    {password === confirmPassword ? 'Coinciden' : 'No coinciden'}
                  </em>
                )}
              </span>
              <input
                id={confirmId}
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                aria-invalid={!!confirmPassword && password !== confirmPassword}
              />
            </label>
          )}

          <button type="submit" className="auth-submit" disabled={loading}>
            <span>{loading ? 'Un momento…' : submit}</span>
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <footer className="auth-footer">
          {(mode === 'forgot' || mode === 'reset') && (
            <button type="button" className="auth-secondary" onClick={() => { switchMode('login'); onResetFinished?.(); }}>
              <RotateCcw size={14} /> Volver a iniciar sesión
            </button>
          )}
          {mode !== 'reset' && (
            <button type="button" className="auth-secondary auth-guest" onClick={handleGuestMode}>
              <WifiOff size={14} /> Usar sin cuenta en este dispositivo
            </button>
          )}
        </footer>
      </motion.div>
    </div>
  );
}
