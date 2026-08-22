import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, CheckCircle, X, Volume2, VolumeX, Sparkles, CloudRain, Waves, Headphones, RotateCcw } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { SoundService } from '../../services/SoundService';

interface ZenModeProps {
  taskId: string | null;
  onClose: () => void;
}

export function ZenMode({ taskId, onClose }: ZenModeProps) {
  const { tasks, toggleTask } = useAppStore();
  const task = taskId ? tasks[taskId] : null;
  
  const [initialDuration, setInitialDuration] = useState(25 * 60);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [ambientType, setAmbientType] = useState<'off' | 'rain' | 'waves'>('off');

  useEffect(() => {
    if (task && task.duration) {
      const dur = task.duration * 60;
      setInitialDuration(dur);
      setTimeLeft(dur);
    } else {
      setInitialDuration(25 * 60);
      setTimeLeft(25 * 60);
    }
    setIsActive(false);
    setAmbientType('off');
  }, [taskId, task]);

  // Manejo del timer
  useEffect(() => {
    let interval: any;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
    } else if (timeLeft === 0 && isActive) {
      setIsActive(false);
      SoundService.playComplete();
      SoundService.stopAmbientSound();
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  // Manejo del sonido ambiente
  useEffect(() => {
    if (ambientType === 'off' || !isActive) {
      SoundService.stopAmbientSound();
    } else {
      SoundService.startAmbientSound(ambientType);
    }
    return () => {
      SoundService.stopAmbientSound();
    };
  }, [ambientType, isActive]);

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        SoundService.stopAmbientSound();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!taskId || !task) return null;

  const handleComplete = () => {
    SoundService.stopAmbientSound();
    SoundService.playComplete();
    toggleTask(task.id);
    onClose();
  };

  const handleSetPreset = (minutes: number) => {
    const secs = minutes * 60;
    setInitialDuration(secs);
    setTimeLeft(secs);
    setIsActive(false);
    SoundService.playPop();
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progress = initialDuration > 0 ? (initialDuration - timeLeft) / initialDuration : 0;
  const strokeDashoffset = 2 * Math.PI * 130 * (1 - progress);

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'radial-gradient(ellipse at center, rgba(20, 24, 38, 0.98) 0%, rgba(10, 12, 18, 1) 100%)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'clamp(24px, 5vw, 56px)',
          boxSizing: 'border-box'
        }}
      >
        {/* Header Bar */}
        <div style={{ width: '100%', maxWidth: 760, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-primary)', fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            <Sparkles size={16} /> Modo Enfoque Zen
          </div>
          
          <button 
            onClick={() => {
              SoundService.stopAmbientSound();
              onClose();
            }}
            style={{ 
              width: 44, height: 44, borderRadius: 22,
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.2s ease'
            }}
            title="Cerrar (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Center Container */}
        <motion.div 
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{ textAlign: 'center', maxWidth: '680px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          {/* Título de la tarea */}
          <h2 style={{ 
            fontSize: 'clamp(1.8rem, 4vw, 3rem)', 
            fontWeight: 700,
            lineHeight: 1.15, 
            margin: '0 0 12px 0', 
            color: 'white',
            fontFamily: 'var(--font-display)',
            letterSpacing: '-0.02em',
            wordBreak: 'break-word'
          }}>
            {task.title}
          </h2>

          {task.description && (
            <p style={{ 
              fontSize: 'clamp(0.95rem, 2vw, 1.2rem)', 
              color: 'rgba(255,255,255,0.7)', 
              margin: '0 0 32px 0',
              lineHeight: 1.5,
              maxWidth: 520,
              wordBreak: 'break-word'
            }}>
              {task.description}
            </p>
          )}

          {/* Circular SVG Timer */}
          <div style={{ position: 'relative', width: 280, height: 280, margin: '16px 0 28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="280" height="280" style={{ transform: 'rotate(-90deg)', position: 'absolute', inset: 0 }}>
              {/* Background circle */}
              <circle
                cx="140"
                cy="140"
                r="130"
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth="8"
                fill="none"
              />
              {/* Progress circle */}
              <circle
                cx="140"
                cy="140"
                r="130"
                stroke="url(#zenGradient)"
                strokeWidth="8"
                strokeDasharray={2 * Math.PI * 130}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
              />
              <defs>
                <linearGradient id="zenGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--accent-primary, #0a84ff)" />
                  <stop offset="100%" stopColor="#30d158" />
                </linearGradient>
              </defs>
            </svg>

            {/* Time Display */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
              <span style={{ 
                fontSize: '4.2rem', 
                fontWeight: 800, 
                fontVariantNumeric: 'tabular-nums', 
                color: 'white', 
                letterSpacing: '-0.03em',
                lineHeight: 1
              }}>
                {formatTime(timeLeft)}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.45)', marginTop: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {isActive ? 'En progreso' : 'En pausa'}
              </span>
            </div>
          </div>

          {/* Preset Buttons */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
            {[
              { label: '15m Express', mins: 15 },
              { label: '25m Pomodoro', mins: 25 },
              { label: '50m Profundo', mins: 50 },
            ].map(p => (
              <button
                key={p.mins}
                onClick={() => handleSetPreset(p.mins)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 999,
                  background: initialDuration === p.mins * 60 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: initialDuration === p.mins * 60 ? 'white' : 'rgba(255,255,255,0.6)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => {
                setTimeLeft(initialDuration);
                setIsActive(false);
                SoundService.playPop();
              }}
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.6)',
                fontSize: '0.82rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                cursor: 'pointer'
              }}
              title="Reiniciar temporizador"
            >
              <RotateCcw size={13} /> Reiniciar
            </button>
          </div>

          {/* Ambient Sound Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32, padding: '8px 16px', background: 'rgba(255,255,255,0.04)', borderRadius: 999, border: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Ambiente:</span>
            <button
              onClick={() => setAmbientType('off')}
              style={{
                background: ambientType === 'off' ? 'rgba(255,255,255,0.2)' : 'transparent',
                color: ambientType === 'off' ? 'white' : 'rgba(255,255,255,0.5)',
                border: 'none', borderRadius: 999, padding: '4px 10px', fontSize: '0.78rem', cursor: 'pointer'
              }}
            >
              Silencio
            </button>
            <button
              onClick={() => setAmbientType('rain')}
              style={{
                background: ambientType === 'rain' ? 'var(--accent-primary)' : 'transparent',
                color: ambientType === 'rain' ? 'white' : 'rgba(255,255,255,0.5)',
                border: 'none', borderRadius: 999, padding: '4px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer'
              }}
            >
              <CloudRain size={13} /> Lluvia
            </button>
            <button
              onClick={() => setAmbientType('waves')}
              style={{
                background: ambientType === 'waves' ? 'var(--accent-primary)' : 'transparent',
                color: ambientType === 'waves' ? 'white' : 'rgba(255,255,255,0.5)',
                border: 'none', borderRadius: 999, padding: '4px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer'
              }}
            >
              <Waves size={13} /> Olas
            </button>
          </div>

          {/* Primary Action Controls */}
          <div style={{ display: 'flex', gap: 14, width: '100%', maxWidth: 440 }}>
            <button 
              onClick={() => {
                SoundService.playPop();
                setIsActive(!isActive);
              }}
              style={{
                flex: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '16px 24px',
                background: isActive ? 'rgba(255, 255, 255, 0.12)' : 'var(--accent-primary)',
                color: 'white', border: 'none', borderRadius: 16,
                fontSize: '1.05rem', fontWeight: 700, cursor: 'pointer',
                boxShadow: isActive ? 'none' : '0 8px 24px rgba(10, 132, 255, 0.4)',
                transition: 'all 0.18s ease'
              }}
            >
              {isActive ? <><Pause size={18} /> Pausar</> : <><Play size={18} /> Iniciar Enfoque</>}
            </button>

            <button 
              onClick={handleComplete}
              style={{
                flex: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '16px 24px',
                background: '#30d158',
                color: '#000000', border: 'none', borderRadius: 16,
                fontSize: '1.05rem', fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(48, 209, 88, 0.4)',
                transition: 'all 0.18s ease'
              }}
            >
              <CheckCircle size={20} /> Completar
            </button>
          </div>
        </motion.div>

        {/* Footer Hint */}
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem' }}>
          Pulsa <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4, color: 'white' }}>Esc</kbd> para salir en cualquier momento
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
