import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
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
      const res = await fetch(`${API_BASE}${endpoint}`, {
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
    <div style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-base)',
      padding: 16,
    }}>
      <motion.div 
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        style={{
          width: '100%',
          maxWidth: 400,
          padding: 32,
          background: 'var(--bg-surface)',
          borderRadius: 24,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64,
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-purple))',
            borderRadius: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 24px rgba(10, 132, 255, 0.3)',
          }}>
            <CheckCircle size={32} color="white" />
          </div>
          <h1 style={{
            fontSize: '1.5rem', fontWeight: 700, margin: 0,
            fontFamily: 'var(--font-display)',
          }}>
            Recordatorios Élite
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: '0.9rem' }}>
            {isLogin ? 'Inicia sesión para sincronizar' : 'Crea tu cuenta para empezar'}
          </p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: 'rgba(255, 59, 48, 0.1)',
              color: 'var(--accent-red)',
              padding: 12,
              borderRadius: 12,
              fontSize: '0.85rem',
              textAlign: 'center',
              fontWeight: 500,
            }}
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{
              display: 'block', marginBottom: 6, fontSize: '0.85rem',
              fontWeight: 600, color: 'var(--text-secondary)',
            }}>
              Correo Electrónico
            </label>
            <input 
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={{
                width: '100%', padding: '12px 16px', borderRadius: 12,
                border: '1px solid var(--border-subtle)', background: 'var(--bg-base)',
                color: 'var(--text-primary)', fontSize: '1rem', outline: 'none',
                fontFamily: 'var(--font-sans)',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                boxSizing: 'border-box',
              }}
              placeholder="tu@email.com"
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-primary)';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(10, 132, 255, 0.15)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>
          <div>
            <label style={{
              display: 'block', marginBottom: 6, fontSize: '0.85rem',
              fontWeight: 600, color: 'var(--text-secondary)',
            }}>
              Contraseña
            </label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              style={{
                width: '100%', padding: '12px 16px', borderRadius: 12,
                border: '1px solid var(--border-subtle)', background: 'var(--bg-base)',
                color: 'var(--text-primary)', fontSize: '1rem', outline: 'none',
                fontFamily: 'var(--font-sans)',
                transition: 'border-color 0.2s, box-shadow 0.2s',
                boxSizing: 'border-box',
              }}
              placeholder="••••••••"
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-primary)';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(10, 132, 255, 0.15)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{
              width: '100%', padding: 14, borderRadius: 14,
              background: loading ? 'var(--text-tertiary)' : 'var(--accent-primary)',
              color: 'white', fontWeight: 600, fontSize: '1rem',
              border: 'none', cursor: loading ? 'wait' : 'pointer',
              marginTop: 4, transition: 'all 0.2s',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {loading ? 'Cargando...' : (isLogin ? 'Iniciar Sesión' : 'Crear Cuenta')}
          </button>
        </form>

        <div style={{ textAlign: 'center' }}>
          <button 
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            type="button"
            style={{
              background: 'none', border: 'none', color: 'var(--accent-primary)',
              cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500,
              fontFamily: 'var(--font-sans)',
            }}
          >
            {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
