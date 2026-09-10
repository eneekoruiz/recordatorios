import { useState, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowRight, 
  CheckCircle, 
  LockKeyhole, 
  ShieldCheck, 
  Sparkles, 
  Eye, 
  EyeOff, 
  KeyRound, 
  UserPlus, 
  LogIn, 
  RotateCcw, 
  WifiOff 
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

const getApiBase = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (import.meta.env.DEV) {
    if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return `http://${window.location.hostname}:3001`;
    }
    return 'http://localhost:3001';
  }
  return '';
};

interface AuthScreenProps {
  onSuccess: () => void;
}

type AuthMode = 'login' | 'register' | 'reset';

export function AuthScreen({ onSuccess }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState(localStorage.getItem('userName') || '');
  const [email, setEmail] = useState(localStorage.getItem('userEmail') || 'eneekoruiz@gmail.com');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isExistingUserConflict, setIsExistingUserConflict] = useState(false);
  const [loading, setLoading] = useState(false);
  const setToken = useAppStore(state => state.setToken);

  const nameInputId = useId();
  const emailInputId = useId();
  const passwordInputId = useId();
  const confirmPasswordInputId = useId();

  // Password strength helper
  const getPasswordStrength = (pass: string) => {
    if (!pass) return 0;
    let score = 0;
    if (pass.length >= 4) score += 1;
    if (pass.length >= 8) score += 1;
    if (/[0-9]/.test(pass) && /[a-zA-Z]/.test(pass)) score += 1;
    return score; // 0, 1 (weak), 2 (medium), 3 (strong)
  };

  const strength = getPasswordStrength(password);
  const strengthLabels = ['Muy corta', 'Básica', 'Media', 'Segura'];
  const strengthColors = ['var(--accent-red)', '#ff9500', '#007aff', '#34c759'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsExistingUserConflict(false);

    // Validation
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Por favor, introduce un correo electrónico.');
      return;
    }

    if (password.length < 4) {
      setError('La contraseña debe tener al menos 4 caracteres.');
      return;
    }

    if ((mode === 'register' || mode === 'reset') && password !== confirmPassword) {
      setError('Las contraseñas no coinciden. Por favor, revísalas.');
      return;
    }

    setLoading(true);

    try {
      let endpoint = '/api/auth/login';
      let payload: any = { email: cleanEmail, password };

      if (mode === 'register') {
        endpoint = '/api/auth/register';
        payload = { email: cleanEmail, password, name: name.trim() || undefined };
      } else if (mode === 'reset') {
        endpoint = '/api/auth/reset-password';
        payload = { email: cleanEmail, newPassword: password };
      }

      const res = await fetch(getApiBase() + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        if (!res.ok) {
          throw new Error(`Error del servidor (${res.status}). Comprueba tu conexión o que el servicio esté activo.`);
        }
      }

      if (!res.ok) {
        if (res.status === 409 || (data.error && data.error.toLowerCase().includes('registrado'))) {
          setIsExistingUserConflict(true);
        }
        throw new Error(data.error || 'No se pudo completar la autenticación.');
      }

      if (data.token && data.user) {
        setToken(data.token, data.user.id);
        localStorage.setItem('userEmail', data.user.email || cleanEmail);
        if (name.trim()) localStorage.setItem('userName', name.trim());
        onSuccess();
      } else if (data.message) {
        setSuccessMsg(data.message);
        setTimeout(() => {
          if (data.token) {
            setToken(data.token, data.user.id);
            onSuccess();
          } else {
            setMode('login');
          }
        }, 1200);
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestMode = () => {
    const offlineId = 'local_guest_' + Date.now();
    setToken('local_offline_token', offlineId);
    onSuccess();
  };

  return (
    <div className="auth-stage">
      {/* Hero Panel */}
      <motion.section
        className="auth-hero-panel"
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      >
        <div className="auth-brand-lock" aria-hidden="true">
          <ShieldCheck size={30} />
        </div>
        <div>
          <span className="auth-kicker"><Sparkles size={14} /> Sincronización privada</span>
          <h1>Recordatorios Élite</h1>
          <p>
            Tu centro de mando para ciclos, prioridades y recordatorios inteligentes con diseño Apple.
          </p>
        </div>
        <div className="auth-proof-grid" aria-hidden="true">
          <span><CheckCircle size={15} /> Offline first</span>
          <span><LockKeyhole size={15} /> Sesión segura</span>
          <span><Sparkles size={15} /> NLP instantáneo</span>
        </div>
      </motion.section>

      {/* Auth Card */}
      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.06 }}
      >
        {/* Header with segmented switch */}
        <div className="auth-card-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="auth-icon">
              {mode === 'register' ? <UserPlus size={24} /> : mode === 'reset' ? <KeyRound size={24} /> : <LogIn size={24} />}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.35rem' }}>
                {mode === 'register' ? 'Crear nueva cuenta' : mode === 'reset' ? 'Restablecer contraseña' : 'Iniciar sesión'}
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: '0.84rem' }}>
                {mode === 'register'
                  ? 'Crea tu bóveda personal en la nube con acceso multiplataforma.'
                  : mode === 'reset'
                  ? 'Introduce tu correo y la nueva clave para recuperar el acceso.'
                  : 'Accede a tus tareas sincronizadas en iPhone, Mac y PC.'}
              </p>
            </div>
          </div>

          {/* Apple-style Segmented Tab Switcher */}
          {mode !== 'reset' && (
            <div style={{
              display: 'flex',
              background: 'var(--bg-material, rgba(0,0,0,0.06))',
              padding: 3,
              borderRadius: 12,
              border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
              position: 'relative'
            }}>
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setIsExistingUserConflict(false); }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 9,
                  border: 'none',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: mode === 'login' ? 'var(--bg-elevated, #fff)' : 'transparent',
                  color: mode === 'login' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: mode === 'login' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.18s ease'
                }}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                onClick={() => { setMode('register'); setError(''); setIsExistingUserConflict(false); }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 9,
                  border: 'none',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: mode === 'register' ? 'var(--bg-elevated, #fff)' : 'transparent',
                  color: mode === 'register' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: mode === 'register' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.18s ease'
                }}
              >
                Crear cuenta
              </button>
            </div>
          )}
        </div>

        {/* Error Alert */}
        <AnimatePresence>
          {error && (
            <motion.div
              className="auth-error"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
            >
              <span>{error}</span>
              {isExistingUserConflict && (
                <button
                  type="button"
                  onClick={() => { setMode('reset'); setError(''); setIsExistingUserConflict(false); }}
                  style={{
                    alignSelf: 'flex-start',
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-primary)',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    padding: 0,
                    marginTop: 4
                  }}
                >
                  ¿Deseas restablecer la contraseña de esta cuenta?
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success Alert */}
        <AnimatePresence>
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              style={{
                padding: '12px 14px',
                borderRadius: 14,
                background: 'rgba(52, 199, 89, 0.12)',
                color: '#28a745',
                border: '1px solid rgba(52, 199, 89, 0.25)',
                fontSize: '0.88rem',
                fontWeight: 650,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <CheckCircle size={16} />
              <span>{successMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {mode === 'register' && (
            <label htmlFor={nameInputId} className="auth-field">
              <span>Nombre o alias (opcional)</span>
              <input
                id={nameInputId}
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                autoComplete="name"
                placeholder="Ej. Eneko Ruiz"
              />
            </label>
          )}

          <label htmlFor={emailInputId} className="auth-field">
            <span>Correo electrónico</span>
            <input
              id={emailInputId}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="tu@email.com"
            />
          </label>

          <label htmlFor={passwordInputId} className="auth-field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{mode === 'reset' ? 'Nueva contraseña' : 'Contraseña'}</span>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => { setMode('reset'); setError(''); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    fontSize: '0.78rem',
                    color: 'var(--accent-primary)',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  ¿Has olvidado tu contraseña?
                </button>
              )}
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                id={passwordInputId}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder="••••••••"
                style={{ paddingRight: 42 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                style={{
                  position: 'absolute',
                  right: 12,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 4
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {/* Password Strength Indicator for Register */}
          {mode === 'register' && password.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: -6 }}>
              <div style={{ display: 'flex', gap: 4, height: 4 }}>
                <div style={{ flex: 1, borderRadius: 2, background: strength >= 1 ? strengthColors[strength] : 'var(--border-subtle)' }} />
                <div style={{ flex: 1, borderRadius: 2, background: strength >= 2 ? strengthColors[strength] : 'var(--border-subtle)' }} />
                <div style={{ flex: 1, borderRadius: 2, background: strength >= 3 ? strengthColors[strength] : 'var(--border-subtle)' }} />
              </div>
              <span style={{ fontSize: '0.72rem', color: strengthColors[strength], fontWeight: 600 }}>
                Seguridad: {strengthLabels[strength]} (mínimo 4 caracteres)
              </span>
            </div>
          )}

          {/* Confirm Password Field for Register & Reset */}
          {(mode === 'register' || mode === 'reset') && (
            <label htmlFor={confirmPasswordInputId} className="auth-field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Confirmar contraseña</span>
                {confirmPassword && (
                  <span style={{
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: password === confirmPassword ? '#34c759' : 'var(--accent-red)'
                  }}>
                    {password === confirmPassword ? '✓ Coinciden' : '✗ No coinciden'}
                  </span>
                )}
              </div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  id={confirmPasswordInputId}
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Repite la contraseña"
                  style={{
                    paddingRight: 42,
                    borderColor: confirmPassword && password !== confirmPassword ? 'var(--accent-red)' : undefined
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? "Ocultar confirmación" : "Ver confirmación"}
                  style={{
                    position: 'absolute',
                    right: 12,
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 4
                  }}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
          )}

          <button type="submit" className="auth-submit" disabled={loading}>
            <span>
              {loading 
                ? 'Conectando con la bóveda...' 
                : mode === 'register' 
                ? 'Crear cuenta y entrar' 
                : mode === 'reset' 
                ? 'Guardar nueva contraseña y entrar' 
                : 'Iniciar sesión'}
            </span>
            <ArrowRight size={18} />
          </button>
        </form>

        {/* Secondary Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          {mode === 'reset' ? (
            <button
              onClick={() => { setMode('login'); setError(''); setIsExistingUserConflict(false); }}
              type="button"
              className="auth-switch"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <RotateCcw size={15} /> Volver a Iniciar sesión
            </button>
          ) : (
            <button
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError('');
                setIsExistingUserConflict(false);
              }}
              type="button"
              className="auth-switch"
            >
              {mode === 'login' ? '¿No tienes cuenta? Crear una cuenta nueva' : '¿Ya tienes cuenta? Iniciar sesión'}
            </button>
          )}

          {/* Emergency Offline Guest Access */}
          <button
            type="button"
            onClick={handleGuestMode}
            title="Usar la app en este dispositivo sin sincronización en la nube"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-tertiary)',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              transition: 'color 0.15s ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
          >
            <WifiOff size={14} /> Continuar sin cuenta (Modo local offline)
          </button>
        </div>
      </motion.div>
    </div>
  );
}
