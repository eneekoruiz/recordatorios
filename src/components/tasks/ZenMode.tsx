import { useState, useEffect, useRef } from 'react';
import { useModalFocus } from '../../hooks/useModalFocus';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, CheckCircle, X, Sparkles, CloudRain, Waves,
  Headphones, Volume2, VolumeX, Clock, ArrowRight, Plus,
  Dumbbell, Shuffle, Timer, Flame
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { SoundService } from '../../services/SoundService';
import { HapticService } from '../../services/HapticService';
import { ConfettiService } from '../../services/ConfettiService';
import { getExerciseAlternatives } from '../../utils/gymExercises';

interface ZenModeProps {
  taskId: string | null;
  onClose: () => void;
}

export function ZenMode({ taskId, onClose }: ZenModeProps) {
  const { tasks, toggleTask, updateTask, theme } = useAppStore();
  const isDark = theme === 'dark';
  const task = taskId ? tasks[taskId] : null;

  // Tokens de color reutilizados en varios puntos de la pantalla
  const surfaceBg = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';
  const surfaceBorder = isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.08)';
  const mutedText = isDark ? 'rgba(255, 255, 255, 0.6)' : 'var(--text-secondary, #636366)';
  const ambientChipBgInactive = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)';

  const [initialDuration, setInitialDuration] = useState<number>(25 * 60);
  const [timeLeft, setTimeLeft] = useState<number>(25 * 60);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [ambientType, setAmbientType] = useState<'off' | 'rain' | 'waves' | 'binaural' | 'focus'>('off');

  // --- MODO GIMNASIO / SERIES Y DESCANSO ---
  const isGymSeries = Boolean(task && task.targetCount && task.targetCount > 1);
  const targetSeries = task?.targetCount || 1;
  const currentCount = task?.currentCount || 0;
  const currentSeriesNumber = Math.min(targetSeries, currentCount + 1);
  const restSeconds = task?.restDuration || 90;

  const [gymPhase, setGymPhase] = useState<'work' | 'rest'>('work');
  const [showAlternativesModal, setShowAlternativesModal] = useState<boolean>(false);
  const [customAltText, setCustomAltText] = useState<string>('');
  const [weightKgInput, setWeightKgInput] = useState<string>('');
  const [repsInput, setRepsInput] = useState<string>('');

  // Acumulador de segundos activos trabajados (inmune a pausas y a botones de +1 min / +5 min)
  const activeElapsedRef = useRef<number>(0);

  // Prompt Modal if task has no duration set
  const [showDurationPrompt, setShowDurationPrompt] = useState<boolean>(false);
  const [promptMinutes, setPromptMinutes] = useState<string>('25');

  // Al abrir una tarea (o cambiar su duración) se prepara el temporizador
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
        const secs = Math.round(task.duration * 60);
        setInitialDuration(secs);
        setTimeLeft(secs);
        setIsActive(true);
      }
      setGymPhase('work');
      setAmbientType('off');
      if (task.weightLogs && task.weightLogs.length > 0) {
        const lastLog = task.weightLogs[task.weightLogs.length - 1];
        setWeightKgInput(lastLog.weightKg.toString());
        if (lastLog.reps) setRepsInput(lastLog.reps.toString());
      } else {
        setWeightKgInput('');
        setRepsInput('');
      }
    }
  }

  useEffect(() => {
    activeElapsedRef.current = 0;
  }, [timerKey]);

  // Manejo del temporizador (trabajo y descanso)
  useEffect(() => {
    if (!isActive || timeLeft <= 0) return;
    const timer = setTimeout(() => {
      activeElapsedRef.current += 1;
      const next = timeLeft - 1;
      setTimeLeft(next);
      if (next <= 0) {
        if (isGymSeries && gymPhase === 'work') {
          // Ha concluido la serie de trabajo activa
          const nextCount = (task?.currentCount || 0) + 1;
          const wKg = parseFloat(weightKgInput);
          const rCount = parseInt(repsInput, 10) || undefined;
          let nextWeightLogs = task?.weightLogs ? [...task.weightLogs] : [];
          if (!isNaN(wKg) && wKg > 0) {
            nextWeightLogs.push({
              set: currentSeriesNumber,
              weightKg: wKg,
              reps: rCount,
              date: new Date().toISOString()
            });
          }

          if (nextCount >= targetSeries) {
            if (nextWeightLogs.length > (task?.weightLogs?.length || 0)) {
              updateTask(task!.id, { currentCount: nextCount, weightLogs: nextWeightLogs });
            }
            handleComplete();
          } else {
            SoundService.playComplete();
            updateTask(task!.id, {
              currentCount: nextCount,
              ...(nextWeightLogs.length > (task?.weightLogs?.length || 0) ? { weightLogs: nextWeightLogs } : {})
            });
            setGymPhase('rest');
            setInitialDuration(restSeconds);
            setTimeLeft(restSeconds);
            setIsActive(true);
          }
        } else if (isGymSeries && gymPhase === 'rest') {
          // Ha concluido el descanso entre series: aviso acústico y háptico
          SoundService.playRestEnd();
          setGymPhase('work');
          const workSecs = Math.max(10, Math.round((task?.duration || 3) * 60));
          setInitialDuration(workSecs);
          setTimeLeft(workSecs);
          setIsActive(true);
        } else {
          setIsActive(false);
          SoundService.playComplete();
          SoundService.stopAmbientSound();
        }
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [isActive, timeLeft, isGymSeries, gymPhase, task, targetSeries, restSeconds]);

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
        if (showAlternativesModal) {
          setShowAlternativesModal(false);
          return;
        }
        SoundService.stopAmbientSound();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, showAlternativesModal]);

  const focusRef = useRef<HTMLDivElement>(null);
  useModalFocus(focusRef, Boolean(taskId && task), () => {
    SoundService.stopAmbientSound();
    onClose();
  });

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
    ConfettiService.fire({ count: 65 });

    const elapsedSeconds = activeElapsedRef.current;
    if (elapsedSeconds > 0) {
      useAppStore.getState().trackTaskExecution(task.id, elapsedSeconds);
    }

    toggleTask(task.id);
    onClose();
  };

  const handleToggleTimer = () => {
    SoundService.playPop();
    setIsActive(!isActive);
  };

  // Terminar serie manualmente y pasar de inmediato a descanso (o completar si es la última)
  const handleFinishSetEarly = () => {
    const wKg = parseFloat(weightKgInput);
    const rCount = parseInt(repsInput, 10) || undefined;
    let nextWeightLogs = task.weightLogs ? [...task.weightLogs] : [];
    if (!isNaN(wKg) && wKg > 0) {
      nextWeightLogs.push({
        set: currentSeriesNumber,
        weightKg: wKg,
        reps: rCount,
        date: new Date().toISOString()
      });
    }

    const nextCount = (task.currentCount || 0) + 1;
    if (nextCount >= targetSeries) {
      if (nextWeightLogs.length > (task.weightLogs?.length || 0)) {
        updateTask(task.id, { currentCount: nextCount, weightLogs: nextWeightLogs });
      }
      handleComplete();
    } else {
      SoundService.playPop();
      updateTask(task.id, {
        currentCount: nextCount,
        ...(nextWeightLogs.length > (task.weightLogs?.length || 0) ? { weightLogs: nextWeightLogs } : {})
      });
      setGymPhase('rest');
      setInitialDuration(restSeconds);
      setTimeLeft(restSeconds);
      setIsActive(true);
    }
  };

  // Saltar descanso y empezar la siguiente serie ya
  const handleSkipRest = () => {
    SoundService.playPop();
    setGymPhase('work');
    const workSecs = Math.max(10, Math.round((task.duration || 3) * 60));
    setInitialDuration(workSecs);
    setTimeLeft(workSecs);
    setIsActive(true);
  };

  // Sustituir ejercicio por una alternativa
  const handleSelectAlternative = (newTitle: string) => {
    if (!newTitle.trim()) return;
    SoundService.playPop();
    updateTask(task.id, { title: newTitle.trim() });
    setShowAlternativesModal(false);
    setCustomAltText('');
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progress = initialDuration > 0 ? (initialDuration - timeLeft) / initialDuration : 0;
  const strokeDashoffset = 2 * Math.PI * 100 * (1 - progress);

  // Obtener alternativas conocidas para este ejercicio
  const exerciseInfo = getExerciseAlternatives(task.title);
  const previousRecordedWeight = task?.weightLogs && task.weightLogs.length > 0
    ? task.weightLogs[task.weightLogs.length - 1].weightKg
    : null;

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
            ? (gymPhase === 'rest'
                ? 'radial-gradient(ellipse at center, rgba(32, 24, 16, 0.98) 0%, rgba(14, 12, 10, 1) 100%)'
                : 'radial-gradient(ellipse at center, rgba(20, 24, 38, 0.98) 0%, rgba(10, 12, 18, 1) 100%)')
            : (gymPhase === 'rest'
                ? 'radial-gradient(ellipse at center, rgba(255, 248, 238, 0.98) 0%, rgba(246, 238, 225, 1) 100%)'
                : 'radial-gradient(ellipse at center, rgba(246, 248, 252, 0.98) 0%, rgba(235, 238, 245, 1) 100%)'),
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'clamp(16px, 3vh, 32px) clamp(20px, 4vw, 40px)',
          boxSizing: 'border-box',
          overflow: 'hidden',
          transition: 'background 0.5s ease'
        }}
        ref={focusRef}
        role="dialog"
        aria-modal="true"
        aria-label="Modo Enfoque Zen"
      >
        {/* Top Header Bar */}
        <div style={{ width: '100%', maxWidth: 760, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: gymPhase === 'rest' ? '#ff9500' : 'var(--accent-primary, #0a84ff)', fontSize: '0.9rem', fontWeight: 700 }}>
            {gymPhase === 'rest' ? <Timer size={16} /> : (isGymSeries ? <Dumbbell size={16} /> : <Sparkles size={16} />)}
            {isGymSeries ? (gymPhase === 'rest' ? 'Fase de Descanso' : 'Modo Entrenamiento Gym') : 'Modo Enfoque Zen'}
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
              transition: 'background-color, border-color, color, fill, opacity, transform, box-shadow 0.2s ease'
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
              ¿Cuánto durará {isGymSeries ? 'cada serie' : 'este recordatorio'}?
            </h3>
            <p style={{ fontSize: '0.95rem', color: isDark ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary, #636366)', margin: '0 0 24px', lineHeight: 1.4 }}>
              Define el tiempo estimado para "{task.title}". Lo guardaremos para futuras sesiones.
            </p>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 }}>
              {[2, 3, 5, 10, 15, 25].map((mins) => (
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
                    cursor: 'pointer'
                  }}
                >
                  {mins} min
                </button>
              ))}
            </div>

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
              Establecer e Iniciar <ArrowRight size={18} />
            </button>
          </motion.div>
        ) : (
          /* --- PANTALLA PRINCIPAL DEL MODO ZEN / GIMNASIO --- */
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{ textAlign: 'center', maxWidth: '680px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', margin: 'auto 0' }}
          >
            {/* Header de serie para gimnasio */}
            {isGymSeries && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span
                  style={{
                    padding: '5px 14px',
                    borderRadius: 999,
                    background: gymPhase === 'rest' ? 'rgba(255, 149, 0, 0.16)' : 'rgba(10, 132, 255, 0.16)',
                    color: gymPhase === 'rest' ? '#ff9500' : 'var(--accent-primary, #0a84ff)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  {gymPhase === 'rest' ? (
                    <>⏳ Descanso post-serie {currentCount}</>
                  ) : (
                    <>🔥 Serie {currentSeriesNumber} de {targetSeries}</>
                  )}
                </span>

                {/* Dots visuales de series */}
                <div style={{ display: 'flex', gap: 5 }}>
                  {Array.from({ length: targetSeries }).map((_, idx) => {
                    const isDone = idx < currentCount;
                    const isCurrent = idx === currentCount;
                    return (
                      <div
                        key={idx}
                        title={`Serie ${idx + 1}`}
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: isDone
                            ? '#30d158'
                            : (isCurrent
                                ? (gymPhase === 'rest' ? '#ff9500' : 'var(--accent-primary, #0a84ff)')
                                : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.14)')),
                          transition: 'all 0.25s ease'
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Título de la tarea / ejercicio */}
            <h2 style={{
              fontSize: 'clamp(1.7rem, 4vw, 2.7rem)',
              fontWeight: 700,
              lineHeight: 1.15,
              margin: '0 0 8px 0',
              color: isDark ? 'white' : 'var(--text-primary, #1c1c1e)',
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.02em',
              wordBreak: 'break-word'
            }}>
              {gymPhase === 'rest' ? `Descanso (${task.title})` : task.title}
            </h2>

            {/* Botón "¿No te apetece este ejercicio? Cambiar por alternativa" */}
            <button
              type="button"
              onClick={() => setShowAlternativesModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 999,
                background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.14)' : '1px solid rgba(0, 0, 0, 0.08)',
                color: isDark ? 'rgba(255, 255, 255, 0.85)' : 'var(--text-secondary, #636366)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                marginBottom: 16,
                transition: 'all 0.15s ease'
              }}
            >
              <Shuffle size={13} color="var(--accent-primary, #0a84ff)" />
              ¿No te apetece este? Cambiar por alternativa
            </button>

            {task.description && gymPhase === 'work' && (
              <p style={{
                fontSize: 'clamp(0.9rem, 2vw, 1.05rem)',
                color: isDark ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary, #636366)',
                margin: '0 0 16px 0',
                lineHeight: 1.4,
                maxWidth: 520,
                wordBreak: 'break-word'
              }}>
                {task.description}
              </p>
            )}

            {/* Circular SVG Timer */}
            <button
              onClick={handleToggleTimer}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                font: "inherit",
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
              type="button"
              aria-label={isActive ? "Pausar temporizador" : "Reanudar temporizador"}
            >
              <svg width="220" height="220" style={{ transform: 'rotate(-90deg)', position: 'absolute', inset: 0 }}>
                {/* Background circle */}
                <circle cx="110" cy="110" r="100" stroke={isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.07)"} strokeWidth="7" fill="none" />
                {/* Progress circle */}
                <circle
                  cx="110"
                  cy="110"
                  r="100"
                  stroke={`url(#${gymPhase === 'rest' ? 'zenRestGradient' : 'zenWorkGradient'})`}
                  strokeWidth="7"
                  strokeDasharray={2 * Math.PI * 100}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="none"
                  style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
                <defs>
                  <linearGradient id="zenWorkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--accent-primary, #0a84ff)" />
                    <stop offset="100%" stopColor="#30d158" />
                  </linearGradient>
                  <linearGradient id="zenRestGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ff9500" />
                    <stop offset="100%" stopColor="#ffcc00" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Display central */}
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

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 12px',
                  borderRadius: 999,
                  background: gymPhase === 'rest'
                    ? (isActive ? 'rgba(255, 149, 0, 0.2)' : '#ff9500')
                    : (isActive ? (isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)') : 'var(--accent-primary, #0a84ff)'),
                  color: gymPhase === 'rest'
                    ? (isActive ? '#ff9500' : 'white')
                    : (isActive ? (isDark ? 'white' : 'var(--text-secondary, #636366)') : 'white'),
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  boxShadow: isActive ? 'none' : '0 4px 14px rgba(10, 132, 255, 0.4)',
                  transition: 'background-color, border-color, color, fill, opacity, transform, box-shadow 0.2s ease'
                }}>
                  {gymPhase === 'rest' ? (
                    isActive ? <><Timer size={12} /> DESCANSO</> : <><Play size={12} fill="white" /> REANUDAR</>
                  ) : (
                    isActive ? <><Pause size={12} fill={isDark ? "white" : "currentColor"} /> EN PROGRESO</> : <><Play size={12} fill="white" style={{ marginLeft: 2 }} /> REANUDAR</>
                  )}
                </div>
              </div>
            </button>

            {/* Botones de ajuste de tiempo rápido (+30s / +1 min / +5 min) */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
              {gymPhase === 'rest' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      HapticService.selection();
                      setTimeLeft(prev => prev + 30);
                      setInitialDuration(prev => Math.max(prev, (timeLeft || 0) + 30));
                      if (!isActive) setIsActive(true);
                    }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 999,
                      background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                      border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.08)',
                      color: isDark ? 'white' : 'var(--text-primary, #1c1c1e)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                    title="Añadir 30 segundos más de descanso"
                  >
                    <Plus size={12} strokeWidth={2.6} /> 30s
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      HapticService.selection();
                      setTimeLeft(prev => prev + 120);
                      setInitialDuration(prev => Math.max(prev, (timeLeft || 0) + 120));
                      if (!isActive) setIsActive(true);
                    }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 999,
                      background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                      border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.08)',
                      color: isDark ? 'white' : 'var(--text-primary, #1c1c1e)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                    title="Añadir 2 minutos más de descanso (Jaca / Sentadilla pesada)"
                  >
                    <Plus size={12} strokeWidth={2.6} /> 2 min
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => {
                  HapticService.selection();
                  setTimeLeft(prev => prev + 60);
                  setInitialDuration(prev => Math.max(prev, (timeLeft || 0) + 60));
                  if (!isActive) setIsActive(true);
                }}
                style={{
                  padding: '5px 12px',
                  borderRadius: 999,
                  background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                  border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.08)',
                  color: isDark ? 'white' : 'var(--text-primary, #1c1c1e)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4
                }}
                title="Añadir 1 minuto más"
              >
                <Plus size={12} strokeWidth={2.6} /> 1 min
              </button>

              {gymPhase === 'work' && (
                <button
                  type="button"
                  onClick={() => {
                    HapticService.selection();
                    setTimeLeft(prev => prev + 300);
                    setInitialDuration(prev => Math.max(prev, (timeLeft || 0) + 300));
                    if (!isActive) setIsActive(true);
                  }}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 999,
                    background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                    border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.08)',
                    color: isDark ? 'white' : 'var(--text-primary, #1c1c1e)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                  title="Añadir 5 minutos más"
                >
                  <Plus size={12} strokeWidth={2.6} /> 5 min
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowDurationPrompt(true)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 999,
                  background: 'transparent',
                  border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.08)',
                  color: mutedText,
                  fontSize: '0.78rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <Clock size={12} /> Ajustar
              </button>
            </div>

            {/* Input de Peso y Reps para gimnasio */}
            {isGymSeries && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginBottom: 16,
                  flexWrap: 'wrap'
                }}
              >
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 12,
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    border: surfaceBorder
                  }}
                >
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: mutedText }}>🏋️ Peso:</span>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="kg"
                    value={weightKgInput}
                    onChange={(e) => setWeightKgInput(e.target.value)}
                    style={{
                      width: 58,
                      padding: '3px 4px',
                      borderRadius: 6,
                      background: isDark ? 'rgba(0,0,0,0.4)' : '#ffffff',
                      border: isDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.15)',
                      color: isDark ? 'white' : 'var(--text-primary)',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      textAlign: 'center',
                      outline: 'none'
                    }}
                    aria-label="Peso en kilogramos"
                  />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: mutedText }}>kg</span>
                </div>

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 12,
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    border: surfaceBorder
                  }}
                >
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: mutedText }}>🔁 Reps:</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    placeholder="reps"
                    value={repsInput}
                    onChange={(e) => setRepsInput(e.target.value)}
                    style={{
                      width: 50,
                      padding: '3px 4px',
                      borderRadius: 6,
                      background: isDark ? 'rgba(0,0,0,0.4)' : '#ffffff',
                      border: isDark ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.15)',
                      color: isDark ? 'white' : 'var(--text-primary)',
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      textAlign: 'center',
                      outline: 'none'
                    }}
                    aria-label="Repeticiones"
                  />
                </div>

                {previousRecordedWeight !== null && (
                  <span
                    style={{
                      fontSize: '0.74rem',
                      color: 'var(--accent-primary, #0a84ff)',
                      fontWeight: 600,
                      background: isDark ? 'rgba(10, 132, 255, 0.12)' : 'rgba(10, 132, 255, 0.08)',
                      padding: '4px 10px',
                      borderRadius: 999
                    }}
                  >
                    Último: {previousRecordedWeight} kg
                  </span>
                )}
              </div>
            )}

            {/* --- SECCIÓN DE SONIDO AMBIENTAL ZEN --- */}
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
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: isDark ? 'white' : 'var(--text-primary, #1c1c1e)', display: 'flex', alignItems: 'center', gap: 6 }}>
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
                {[
                  { type: 'off', label: 'Silencio', icon: VolumeX },
                  { type: 'rain', label: 'Lluvia', icon: CloudRain },
                  { type: 'waves', label: 'Olas', icon: Waves },
                  { type: 'binaural', label: 'Binaural', icon: Volume2 },
                  { type: 'focus', label: 'Foco', icon: Headphones }
                ].map(item => {
                  const Icon = item.icon;
                  const isSelected = ambientType === item.type;
                  return (
                    <button
                      key={item.type}
                      onClick={() => setAmbientType(item.type as any)}
                      style={{
                        padding: '7px 4px',
                        borderRadius: 12,
                        background: isSelected
                          ? (item.type === 'off' ? (isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.12)') : 'var(--accent-primary, #0a84ff)')
                          : ambientChipBgInactive,
                        border: isSelected
                          ? (isDark ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(0,0,0,0.15)')
                          : '1px solid transparent',
                        color: isSelected ? 'white' : mutedText,
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 3,
                        transition: 'background-color, border-color, color, fill, opacity, transform, box-shadow 0.15s ease'
                      }}
                    >
                      <Icon size={15} /> {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Botones principales de acción */}
            <div style={{ display: 'flex', gap: 12, width: '100%', maxWidth: 500 }}>
              {isGymSeries && gymPhase === 'rest' ? (
                /* ACCIONES EN FASE DE DESCANSO */
                <>
                  <button
                    onClick={handleToggleTimer}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '16px 20px',
                      background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                      color: isDark ? 'white' : 'var(--text-primary)',
                      border: surfaceBorder,
                      borderRadius: 16,
                      fontSize: '1rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {isActive ? <><Pause size={18} /> Pausar descanso</> : <><Play size={18} /> Reanudar</>}
                  </button>

                  <button
                    onClick={handleSkipRest}
                    style={{
                      flex: 1.3,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '16px 20px',
                      background: 'var(--accent-primary, #0a84ff)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 16,
                      fontSize: '1.02rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 8px 24px rgba(10, 132, 255, 0.4)'
                    }}
                  >
                    <Flame size={18} /> Empezar Serie {currentSeriesNumber}
                  </button>
                </>
              ) : isGymSeries && gymPhase === 'work' ? (
                /* ACCIONES EN FASE DE SERIE ACTIVA */
                <>
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
                      color: isActive ? (isDark ? '#ff9f0a' : '#a35400') : 'white',
                      border: isActive ? '1px solid rgba(255, 149, 0, 0.4)' : 'none',
                      borderRadius: 16,
                      fontSize: '1rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {isActive ? <><Pause size={18} /> Pausar</> : <><Play size={18} /> Reanudar</>}
                  </button>

                  <button
                    onClick={handleFinishSetEarly}
                    style={{
                      flex: 1.4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      padding: '16px 20px',
                      background: '#30d158',
                      color: '#000000',
                      border: 'none',
                      borderRadius: 16,
                      fontSize: '1.02rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 8px 24px rgba(48, 209, 88, 0.4)'
                    }}
                  >
                    <CheckCircle size={18} />
                    {currentSeriesNumber >= targetSeries ? 'Completar Ejercicio' : `Terminar Serie ${currentSeriesNumber}`}
                  </button>
                </>
              ) : (
                /* ACCIONES DE TAREA ZEN ESTÁNDAR */
                <>
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
                      color: isActive ? (isDark ? '#ff9f0a' : '#a35400') : 'white',
                      border: isActive ? '1px solid rgba(255, 149, 0, 0.4)' : 'none',
                      borderRadius: 16,
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: isActive ? 'none' : '0 8px 24px rgba(10, 132, 255, 0.4)'
                    }}
                  >
                    {isActive ? <><Pause size={20} fill="currentColor" /> Pausar</> : <><Play size={20} fill="white" style={{ marginLeft: 2 }} /> Reanudar</>}
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
                      boxShadow: '0 8px 24px rgba(48, 209, 88, 0.4)'
                    }}
                  >
                    <CheckCircle size={20} /> Completar
                  </button>
                </>
              )}

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

        {/* --- MODAL DE SUSTITUCIÓN DE EJERCICIO ("¿No te apetece este?") --- */}
        <AnimatePresence>
          {showAlternativesModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.65)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                zIndex: 100000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 20
              }}
              onClick={() => setShowAlternativesModal(false)}
            >
              <motion.div
                initial={{ scale: 0.93, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.93, opacity: 0, y: 10 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: isDark ? 'rgba(30, 34, 48, 0.95)' : '#ffffff',
                  border: isDark ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(0,0,0,0.1)',
                  borderRadius: 24,
                  padding: '28px 24px',
                  maxWidth: 520,
                  width: '100%',
                  boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Dumbbell size={20} color="var(--accent-primary, #0a84ff)" />
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: isDark ? 'white' : 'var(--text-primary)' }}>
                      ¿Cambiar «{task.title}» hoy?
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowAlternativesModal(false)}
                    style={{ background: 'transparent', border: 'none', color: mutedText, cursor: 'pointer', padding: 4 }}
                  >
                    <X size={20} />
                  </button>
                </div>

                <p style={{ margin: 0, fontSize: '0.88rem', color: isDark ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)' }}>
                  Grupo muscular: <strong style={{ color: 'var(--accent-primary, #0a84ff)' }}>{exerciseInfo.categoryLabel}</strong>.
                  Elige una alternativa equivalente con diferente equipamiento o máquina:
                </p>

                {/* Lista de alternativas verificadas */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                  {exerciseInfo.alternatives.map((alt) => (
                    <button
                      key={alt.name}
                      type="button"
                      onClick={() => handleSelectAlternative(alt.name)}
                      style={{
                        textAlign: 'left',
                        padding: '12px 14px',
                        borderRadius: 14,
                        background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                        border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: isDark ? 'white' : 'var(--text-primary)' }}>
                          {alt.name}
                        </span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'var(--accent-primary, #0a84ff)', color: 'white' }}>
                          {alt.equipment}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.8rem', color: isDark ? 'rgba(255,255,255,0.6)' : 'var(--text-secondary)' }}>
                        {alt.note}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Entrada para escribir un ejercicio personalizado */}
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <input
                    type="text"
                    placeholder="O escribe otro ejercicio..."
                    value={customAltText}
                    onChange={(e) => setCustomAltText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSelectAlternative(customAltText);
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: isDark ? 'rgba(0,0,0,0.3)' : 'var(--bg-surface, #f2f2f7)',
                      border: isDark ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(0,0,0,0.12)',
                      color: isDark ? 'white' : 'var(--text-primary)',
                      fontSize: '0.9rem',
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleSelectAlternative(customAltText)}
                    disabled={!customAltText.trim()}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 12,
                      background: customAltText.trim() ? 'var(--accent-primary, #0a84ff)' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
                      color: 'white',
                      border: 'none',
                      fontWeight: 600,
                      cursor: customAltText.trim() ? 'pointer' : 'default'
                    }}
                  >
                    Cambiar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer Hint */}
        <div style={{ color: isDark ? 'rgba(255,255,255,0.35)' : 'var(--text-tertiary, #8e8e93)', fontSize: '0.8rem', textAlign: 'center' }}>
          Pulsa <kbd style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', padding: '2px 6px', borderRadius: 4, color: isDark ? 'white' : 'var(--text-primary, #1c1c1e)' }}>Esc</kbd> para salir en cualquier momento
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
