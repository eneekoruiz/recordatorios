import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, Pause, CheckCircle, X, Sparkles, CloudRain, Waves, 
  Headphones, Volume2, VolumeX, Clock, ArrowRight 
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { SoundService } from '../../services/SoundService';

interface ZenModeProps {
  taskId: string | null;
  onClose: () => void;
}

export function ZenMode({ taskId, onClose }: ZenModeProps) {
  const { tasks, toggleTask, updateTask } = useAppStore();
  const task = taskId ? tasks[taskId] : null;

  const [initialDuration, setInitialDuration] = useState<number>(25 * 60);
  const [timeLeft, setTimeLeft] = useState<number>(25 * 60);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [ambientType, setAmbientType] = useState<'off' | 'rain' | 'waves' | 'binaural'>('off');
  
  // Prompt Modal if task has no duration set
  const [showDurationPrompt, setShowDurationPrompt] = useState<boolean>(false);
  const [promptMinutes, setPromptMinutes] = useState<string>('25');

  // Sync state on task open
  useEffect(() => {
    if (!task) return;

    if (!task.duration || task.duration <= 0) {
      setShowDurationPrompt(true);
      setInitialDuration(25 * 60);
      setTimeLeft(25 * 60);
      setIsActive(false);
    } else {
      setShowDurationPrompt(false);
      const secs = task.duration * 60;
      setInitialDuration(secs);
      setTimeLeft(secs);
      setIsActive(true); // Iniciar automáticamente cuando ya tiene duración definida
    }
    setAmbientType('off');
  }, [taskId, task?.id, task?.duration]);

  // Manejo del temporizador
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    } else if (timeLeft === 0 && isActive) {
      setIsActive(false);
      SoundService.playComplete();
      SoundService.stopAmbientSound();
    }
    return () => {
      if (interval) clearInterval(interval);
    };
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

  // Cerrar con tecla Escape
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

  const handleStartWithDuration = (mins: number) => {
    const validMins = Math.max(1, Math.min(480, mins));
    updateTask(task.id, { duration: validMins });
    const secs = validMins * 60;
    setInitialDuration(secs);
    setTimeLeft(secs);
    setShowDurationPrompt(false);
    setIsActive(true);
    SoundService.playPop();
  };

  const handleComplete = () => {
    SoundService.stopAmbientSound();
    SoundService.playComplete();
    toggleTask(task.id);
    onClose();
  };

  const handleToggleTimer = () => {
    SoundService.playPop();
    setIsActive(!isActive);
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
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(ellipse at center, rgba(20, 24, 38, 0.98) 0%, rgba(10, 12, 18, 1) 100%)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'clamp(24px, 5vw, 48px)',
          boxSizing: 'border-box',
          overflowY: 'auto'
        }}
      >
        {/* Top Header Bar */}
        <div style={{ width: '100%', maxWidth: 760, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-primary, #0a84ff)', fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            <Sparkles size={16} /> Modo Enfoque Zen
          </div>

          <button
            onClick={() => {
              SoundService.stopAmbientSound();
              onClose();
            }}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            title="Cerrar (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* --- MODAL DE SELECCIÓN DE DURACIÓN SI NO TIENE DURACIÓN ASIGNADA --- */}
        {showDurationPrompt ? (
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            style={{
              background: 'rgba(30, 35, 52, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 24,
              padding: '32px 28px',
              maxWidth: 480,
              width: '100%',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              textAlign: 'center',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              margin: 'auto'
            }}
          >
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(10, 132, 255, 0.15)', color: 'var(--accent-primary, #0a84ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Clock size={28} />
            </div>

            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'white', margin: '0 0 8px' }}>
              ¿Cuánto durará este recordatorio?
            </h3>
            <p style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.7)', margin: '0 0 24px', lineHeight: 1.4 }}>
              Define el tiempo estimado para "{task.title}". Guardaremos esta duración para futuras sesiones de enfoque.
            </p>

            {/* Chips de duración rápida */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 }}>
              {[10, 15, 25, 45, 60].map((mins) => (
                <button
                  key={mins}
                  onClick={() => setPromptMinutes(mins.toString())}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 999,
                    background: promptMinutes === mins.toString() ? 'var(--accent-primary, #0a84ff)' : 'rgba(255,255,255,0.08)',
                    color: 'white',
                    border: promptMinutes === mins.toString() ? 'none' : '1px solid rgba(255,255,255,0.12)',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {mins} min
                </button>
              ))}
            </div>

            {/* Custom Minutes Input */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <input
                type="number"
                min="1"
                max="480"
                value={promptMinutes}
                onChange={(e) => setPromptMinutes(e.target.value)}
                style={{
                  width: 90,
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: 'white',
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  textAlign: 'center',
                  outline: 'none'
                }}
              />
              <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>minutos</span>
            </div>

            <button
              onClick={() => handleStartWithDuration(parseInt(promptMinutes, 10) || 25)}
              style={{
                width: '100%',
                padding: '14px 20px',
                borderRadius: 16,
                background: 'var(--accent-primary, #0a84ff)',
                color: 'white',
                border: 'none',
                fontWeight: 700,
                fontSize: '1.05rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 8px 24px rgba(10, 132, 255, 0.4)'
              }}
            >
              Establecer e Iniciar Enfoque <ArrowRight size={18} />
            </button>
          </motion.div>
        ) : (
          /* --- PANTALLA PRINCIPAL DEL MODO ZEN --- */
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{ textAlign: 'center', maxWidth: '680px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', margin: 'auto 0' }}
          >
            {/* Título de la tarea */}
            <h2 style={{
              fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
              fontWeight: 700,
              lineHeight: 1.15,
              margin: '0 0 8px 0',
              color: 'white',
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.02em',
              wordBreak: 'break-word'
            }}>
              {task.title}
            </h2>

            {task.description && (
              <p style={{
                fontSize: 'clamp(0.95rem, 2vw, 1.15rem)',
                color: 'rgba(255,255,255,0.7)',
                margin: '0 0 24px 0',
                lineHeight: 1.4,
                maxWidth: 520,
                wordBreak: 'break-word'
              }}>
                {task.description}
              </p>
            )}

            {/* Circular SVG Timer (INTERACTIVO al hacer clic en el anillo) */}
            <div 
              onClick={handleToggleTimer}
              style={{ 
                position: 'relative', 
                width: 280, 
                height: 280, 
                margin: '12px 0 24px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              title={isActive ? "Pausar temporizador" : "Iniciar/Reanudar temporizador"}
            >
              <svg width="280" height="280" style={{ transform: 'rotate(-90deg)', position: 'absolute', inset: 0 }}>
                {/* Background circle */}
                <circle cx="140" cy="140" r="130" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="8" fill="none" />
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

              {/* Display central con Botón de Play/Pause interactivo */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, gap: 8 }}>
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
                
                {/* Botón flotante central dentro del anillo */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 14px',
                  borderRadius: 999,
                  background: isActive ? 'rgba(255, 255, 255, 0.12)' : 'var(--accent-primary, #0a84ff)',
                  color: 'white',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  boxShadow: isActive ? 'none' : '0 4px 14px rgba(10, 132, 255, 0.4)',
                  transition: 'all 0.2s ease'
                }}>
                  {isActive ? <><Pause size={14} fill="white" /> EN PROGRESO</> : <><Play size={14} fill="white" style={{ marginLeft: 2 }} /> REANUDAR</>}
                </div>
              </div>
            </div>

            {/* --- SECCIÓN DE SONIDO AMBIENTAL VISIBLE Y MEJORADA --- */}
            <div style={{
              width: '100%',
              maxWidth: 500,
              margin: '0 0 28px 0',
              padding: '14px 20px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: 20,
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Headphones size={16} color="var(--accent-primary, #0a84ff)" /> SONIDO AMBIENTAL ZEN
                </span>
                {ambientType !== 'off' && isActive && (
                  <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    <span style={{ width: 3, height: 12, background: 'var(--accent-primary)', borderRadius: 2, animation: 'pulse 1s infinite alternate' }} />
                    <span style={{ width: 3, height: 18, background: '#30d158', borderRadius: 2, animation: 'pulse 0.8s infinite alternate' }} />
                    <span style={{ width: 3, height: 10, background: 'var(--accent-primary)', borderRadius: 2, animation: 'pulse 1.2s infinite alternate' }} />
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                <button
                  onClick={() => setAmbientType('off')}
                  style={{
                    padding: '8px 6px',
                    borderRadius: 12,
                    background: ambientType === 'off' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                    border: ambientType === 'off' ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent',
                    color: ambientType === 'off' ? 'white' : 'rgba(255, 255, 255, 0.6)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <VolumeX size={16} /> Silencio
                </button>

                <button
                  onClick={() => setAmbientType('rain')}
                  style={{
                    padding: '8px 6px',
                    borderRadius: 12,
                    background: ambientType === 'rain' ? 'var(--accent-primary, #0a84ff)' : 'rgba(255, 255, 255, 0.04)',
                    border: ambientType === 'rain' ? '1px solid rgba(10,132,255,0.5)' : '1px solid transparent',
                    color: 'white',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <CloudRain size={16} /> Lluvia
                </button>

                <button
                  onClick={() => setAmbientType('waves')}
                  style={{
                    padding: '8px 6px',
                    borderRadius: 12,
                    background: ambientType === 'waves' ? 'var(--accent-primary, #0a84ff)' : 'rgba(255, 255, 255, 0.04)',
                    border: ambientType === 'waves' ? '1px solid rgba(10,132,255,0.5)' : '1px solid transparent',
                    color: 'white',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Waves size={16} /> Olas
                </button>

                <button
                  onClick={() => setAmbientType('binaural')}
                  style={{
                    padding: '8px 6px',
                    borderRadius: 12,
                    background: ambientType === 'binaural' ? 'var(--accent-primary, #0a84ff)' : 'rgba(255, 255, 255, 0.04)',
                    border: ambientType === 'binaural' ? '1px solid rgba(10,132,255,0.5)' : '1px solid transparent',
                    color: 'white',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Volume2 size={16} /> Binaural
                </button>
              </div>
            </div>

            {/* Primary Action Controls */}
            <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 500 }}>
              <button
                onClick={handleToggleTimer}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '16px 20px',
                  background: isActive ? 'rgba(255, 149, 0, 0.2)' : 'var(--accent-primary, #0a84ff)',
                  color: isActive ? '#ff9500' : 'white',
                  border: isActive ? '1px solid rgba(255, 149, 0, 0.5)' : 'none',
                  borderRadius: 16,
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: isActive ? 'none' : '0 8px 24px rgba(10, 132, 255, 0.4)',
                  transition: 'all 0.18s ease'
                }}
              >
                {isActive ? <><Pause size={20} fill="#ff9500" /> Pausar</> : <><Play size={20} fill="white" style={{ marginLeft: 2 }} /> Reanudar</>}
              </button>

              <button
                onClick={handleComplete}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '16px 20px',
                  background: '#30d158',
                  color: '#000000',
                  border: 'none',
                  borderRadius: 16,
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(48, 209, 88, 0.4)',
                  transition: 'all 0.18s ease'
                }}
              >
                <CheckCircle size={20} /> Completar
              </button>

              <button
                onClick={() => setShowDurationPrompt(true)}
                style={{
                  padding: '16px',
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Cambiar tiempo asignado"
              >
                <Clock size={20} />
              </button>
            </div>
          </motion.div>
        )}

        {/* Footer Hint */}
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem', textAlign: 'center' }}>
          Pulsa <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4, color: 'white' }}>Esc</kbd> para salir en cualquier momento
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
