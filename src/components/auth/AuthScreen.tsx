import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

interface AuthScreenProps {
  onSuccess: () => void;
}

export function AuthScreen({ onSuccess }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setToken = useAppStore(state => state.setToken);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(API_BASE + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error de autenticación');

      setToken(data.token, data.user.id);
      localStorage.setItem('userEmail', data.user.email || email);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-stage">
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
            Tu centro de mando para ciclos, prioridades y recordatorios inteligentes.
          </p>
        </div>
        <div className="auth-proof-grid" aria-hidden="true">
          <span><CheckCircle size={15} /> Offline first</span>
          <span><LockKeyhole size={15} /> Sesión segura</span>
          <span><Sparkles size={15} /> NLP instantáneo</span>
        </div>
      </motion.section>

      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.06 }}
      >
        <div className="auth-card-header">
          <div className="auth-icon"><CheckCircle size={26} /></div>
          <div>
            <h2>{isLogin ? 'Bienvenido de nuevo' : 'Crear espacio privado'}</h2>
            <p>{isLogin ? 'Entra y continúa justo donde lo dejaste.' : 'Empieza con una bóveda local sincronizable.'}</p>
          </div>
        </div>

        {error && (
          <motion.div
            className="auth-error"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="auth-field">
            <span>Correo electrónico</span>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="tu@email.com"
            />
          </label>

          <label className="auth-field">
            <span>Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              placeholder="••••••••"
            />
          </label>

          <button type="submit" className="auth-submit" disabled={loading}>
            <span>{loading ? 'Verificando...' : (isLogin ? 'Entrar' : 'Crear cuenta')}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        <button
          onClick={() => { setIsLogin(!isLogin); setError(''); }}
          type="button"
          className="auth-switch"
        >
          {isLogin ? 'Crear una cuenta nueva' : 'Ya tengo cuenta'}
        </button>
      </motion.div>
    </div>
  );
}
