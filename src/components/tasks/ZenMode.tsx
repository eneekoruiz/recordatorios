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
  const { tasks, toggleTask, updateTask, theme } = useAppStore();
  const isDark = theme === 'dark';
  const task = taskId ? tasks[taskId] : null;

  // Tokens de color reutilizados en varios puntos de la pantalla, para no repetir
  // el mismo ternario isDark en cada estilo individual.
  const surfaceBg = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';
  const surfaceBorder = isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.08)';
  const mutedText = isDark ? 'rgba(255, 255, 255, 0.6)' : 'var(--text-secondary, #636366)';
  const ambientChipBgInactive = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)';

  const [initialDuration, setInitialDuration] = useState<number>(25 * 60);
  const [timeLeft, setTimeLeft] = useState<number>(25 * 60);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [ambientType, setAmbientType] = useState<'off' | 'rain' | 'waves' | 'binaural' | 'focus'>('off');
  
  // Prompt Modal if task has no duration set
  const [showDurationPrompt, setShowDurationPrompt] = useState<boolean>(false);
  const [promptMinutes, setPromptMinutes] = useState<string>('25');

  // Al abrir una tarea (o cambiar su duración) se prepara el temporizador, durante el render.
  const timerKey = task ? `${task.id}|${task.duration ?? ''}` : null;
  const [loadedTimerKey, setLoadedTimerKey] = useState<string | null>(null);
  if (timerKey !== loadedTimerKey) {
    setLoadedTimerKey(timerKey);
    if (task) {
      if (!task.duration || task.duration <= 0) {
        setShowDurationPrompt(true);
        setInitialDuration(25 * 60);
        setTimeLeft(25 * 60);
        setIsActive(false);
      } else {
        setShowDurationPrompt(false);
        const secs = Math.round(task.duration * 60); // la duración puede llevar segundos
        setInitialDuration(secs);
        setTimeLeft(secs);
        setIsActive(true); // Iniciar automáticamente cuando ya tiene duración definida
      }
      setAmbientType('off');
    }
  }

  // Manejo del temporizador: un paso por segundo; al llegar a cero, suena y se para.
  useEffect(() => {
    if (!isActive || timeLeft <= 0) return;
    const timer = setTimeout(() => {
      const next = timeLeft - 1;
      setTimeLeft(next);
      if (next <= 0) {
        setIsActive(false);
        SoundService.playComplete();
        SoundService.stopAmbientSound();
      }
    }, 1000);
    return () => clearTimeout(timer);
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
  const strokeDashoffset = 2 * Math.PI * 100 * (1 - progress);

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
          height: '100dvh',
          maxHeight: '100dvh',
          background: isDark
            ? 'radial-gradient(ellipse at center, rgba(20, 24, 38, 0.98) 0%, rgba(10, 12, 18, 1) 100%)'
            : 'radial-gradient(ellipse at center, rgba(246, 248, 252, 0.98) 0%, rgba(235, 238, 245, 1) 100%)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'clamp(16px, 3vh, 32px) clamp(20px, 4vw, 40px)',
          boxSizing: 'border-box',
          overflow: 'hidden'
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
              background: surfaceBg,
              border: surfaceBorder,
              color: mutedText,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            title="Cerrar (Esc)"
            aria-label="Cerrar modo zen"
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
              background: isDark ? 'rgba(30, 35, 52, 0.85)' : 'var(--bg-elevated, #ffffff)',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
              borderRadius: 24,
              padding: '32px 28px',
              maxWidth: 480,
              width: '100%',
              boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.5)' : '0 20px 50px rgba(0, 0, 0, 0.1)',
              textAlign: 'center',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              margin: 'auto'
            }}
          >
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: isDark ? 'rgba(10, 132, 255, 0.15)' : 'rgba(10, 132, 255, 0.1)', color: 'var(--accent-primary, #0a84ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Clock size={28} />
            </div>

            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: isDark ? 'white' : 'var(--text-primary, #1c1c1e)', margin: '0 0 8px' }}>
              ¿Cuánto durará este recordatorio?
            </h3>
            <p style={{ fontSize: '0.95rem', color: isDark ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary, #636366)', margin: '0 0 24px', lineHeight: 1.4 }}>
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
                    background: promptMinutes === mins.toString()
                      ? 'var(--accent-primary, #0a84ff)'
                      : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
                    color: promptMinutes === mins.toString()
                      ? 'white'
                      : (isDark ? 'rgba(255,255,255,0.85)' : 'var(--text-secondary, #636366)'),
                    border: promptMinutes === mins.toString()
                      ? 'none'
                      : (isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.08)'),
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
                  background: isDark ? 'rgba(0,0,0,0.3)' : 'var(--bg-surface, #f2f2f7)',
                  border: isDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.15)',
                  color: isDark ? 'white' : 'var(--text-primary, #1c1c1e)',
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  textAlign: 'center',
                  outline: 'none'
                }}
              />
              <span style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary, #636366)', fontWeight: 600 }}>minutos</span>
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
              color: isDark ? 'white' : 'var(--text-primary, #1c1c1e)',
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.02em',
              wordBreak: 'break-word'
            }}>
              {task.title}
            </h2>

            {task.description && (
              <p style={{
                fontSize: 'clamp(0.95rem, 2vw, 1.15rem)',
                color: isDark ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary, #636366)',
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
                width: 220, 
                height: 220, 
                margin: '6px 0 16px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              title={isActive ? "Pausar temporizador" : "Iniciar/Reanudar temporizador"}
            >
              <svg width="220" height="220" style={{ transform: 'rotate(-90deg)', position: 'absolute', inset: 0 }}>
                {/* Background circle */}
                <circle cx="110" cy="110" r="100" stroke={isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.07)"} strokeWidth="7" fill="none" />
                {/* Progress circle */}
                <circle
                  cx="110"
                  cy="110"
                  r="100"
                  stroke="url(#zenGradient)"
                  strokeWidth="7"
                  strokeDasharray={2 * Math.PI * 100}
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
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, gap: 6 }}>
                <span style={{
                  fontSize: 'clamp(2.8rem, 5vh, 3.6rem)',
                  fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                  color: isDark ? 'white' : 'var(--text-primary, #1c1c1e)',
                  letterSpacing: '-0.03em',
                  lineHeight: 1
                }}>
                  {formatTime(timeLeft)}
                </span>
                
                {/* Botón flotante central dentro del anillo */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 12px',
                  borderRadius: 999,
                  background: isActive 
                    ? (isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)') 
                    : 'var(--accent-primary, #0a84ff)',
                  color: isActive ? (isDark ? 'white' : 'var(--text-secondary, #636366)') : 'white',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  boxShadow: isActive ? 'none' : '0 4px 14px rgba(10, 132, 255, 0.4)',
                  transition: 'all 0.2s ease'
                }}>
                  {isActive ? <><Pause size={12} fill={isDark ? "white" : "currentColor"} /> EN PROGRESO</> : <><Play size={12} fill="white" style={{ marginLeft: 2 }} /> REANUDAR</>}
                </div>
              </div>
            </div>

            {/* --- SECCIÓN DE SONIDO AMBIENTAL VISIBLE Y MEJORADA --- */}
            <div style={{
              width: '100%',
              maxWidth: 500,
              margin: '0 0 20px 0',
              padding: '12px 16px',
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
              borderRadius: 20,
              border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.06)',
              boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.2)' : '0 8px 24px rgba(0,0,0,0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: isDark ? 'white' : 'var(--text-primary, #1c1c1e)', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Headphones size={15} color="var(--accent-primary, #0a84ff)" /> SONIDO AMBIENTAL ZEN
                </span>
                {ambientType !== 'off' && isActive && (
                  <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    <span style={{ width: 3, height: 12, background: 'var(--accent-primary)', borderRadius: 2, animation: 'pulse 1s infinite alternate' }} />
                    <span style={{ width: 3, height: 18, background: '#30d158', borderRadius: 2, animation: 'pulse 0.8s infinite alternate' }} />
                    <span style={{ width: 3, height: 10, background: 'var(--accent-primary)', borderRadius: 2, animation: 'pulse 1.2s infinite alternate' }} />
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                <button
                  onClick={() => setAmbientType('off')}
                  style={{
                    padding: '7px 4px',
                    borderRadius: 12,
                    background: ambientType === 'off' ? (isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.12)') : ambientChipBgInactive,
                    border: ambientType === 'off' ? (isDark ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(0,0,0,0.15)') : '1px solid transparent',
                    color: ambientType === 'off' ? (isDark ? 'white' : 'var(--text-primary, #1c1c1e)') : mutedText,
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 3,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <VolumeX size={15} /> Silencio
                </button>

                <button
                  onClick={() => setAmbientType('rain')}
                  style={{
                    padding: '7px 4px',
                    borderRadius: 12,
                    background: ambientType === 'rain' ? 'var(--accent-primary, #0a84ff)' : ambientChipBgInactive,
                    border: ambientType === 'rain' ? '1px solid rgba(10,132,255,0.5)' : '1px solid transparent',
                    color: ambientType === 'rain' ? 'white' : mutedText,
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 3,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <CloudRain size={15} /> Lluvia
                </button>

                <button
                  onClick={() => setAmbientType('waves')}
                  style={{
                    padding: '7px 4px',
                    borderRadius: 12,
                    background: ambientType === 'waves' ? 'var(--accent-primary, #0a84ff)' : ambientChipBgInactive,
                    border: ambientType === 'waves' ? '1px solid rgba(10,132,255,0.5)' : '1px solid transparent',
                    color: ambientType === 'waves' ? 'white' : mutedText,
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 3,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Waves size={15} /> Olas
                </button>

                <button
                  onClick={() => setAmbientType('binaural')}
                  style={{
                    padding: '7px 4px',
                    borderRadius: 12,
                    background: ambientType === 'binaural' ? 'var(--accent-primary, #0a84ff)' : ambientChipBgInactive,
                    border: ambientType === 'binaural' ? '1px solid rgba(10,132,255,0.5)' : '1px solid transparent',
                    color: ambientType === 'binaural' ? 'white' : mutedText,
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 3,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Volume2 size={15} /> Binaural
                </button>

                <button
                  onClick={() => setAmbientType('focus')}
                  style={{
                    padding: '7px 4px',
                    borderRadius: 12,
                    background: ambientType === 'focus' ? 'var(--accent-primary, #0a84ff)' : ambientChipBgInactive,
                    border: ambientType === 'focus' ? '1px solid rgba(10,132,255,0.5)' : '1px solid transparent',
                    color: ambientType === 'focus' ? 'white' : mutedText,
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 3,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Headphones size={15} /> Foco
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
                  background: isActive ? (isDark ? 'rgba(255, 149, 0, 0.2)' : 'rgba(255, 149, 0, 0.15)') : 'var(--accent-primary, #0a84ff)',
                  color: isActive ? '#ff9500' : 'white',
                  border: isActive ? '1px solid rgba(255, 149, 0, 0.4)' : 'none',
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
                  background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                  border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.08)',
                  color: isDark ? 'white' : 'var(--text-primary, #1c1c1e)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Cambiar tiempo asignado"
                aria-label="Cambiar tiempo asignado"
              >
                <Clock size={20} />
              </button>
            </div>
          </motion.div>
        )}

        {/* Footer Hint */}
        <div style={{ color: isDark ? 'rgba(255,255,255,0.35)' : 'var(--text-tertiary, #8e8e93)', fontSize: '0.8rem', textAlign: 'center' }}>
          Pulsa <kbd style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', padding: '2px 6px', borderRadius: 4, color: isDark ? 'white' : 'var(--text-primary, #1c1c1e)' }}>Esc</kbd> para salir en cualquier momento
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
