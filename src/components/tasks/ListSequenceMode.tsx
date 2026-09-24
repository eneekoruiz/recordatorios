import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Play, Pause, CheckCircle, SkipForward, Clock, ArrowRight,
  Sparkles, CloudRain, Waves, Volume2, VolumeX, ListChecks,
  Zap
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { SoundService } from '../../services/SoundService';
import { HapticService } from '../../services/HapticService';
import { getTaskDuration, formatDuration } from '../../utils/taskDuration';

interface ListSequenceModeProps {
  /** IDs de las tareas a recorrer en orden */
  taskIds: string[];
  listName: string;
  listColor?: string;
  onClose: () => void;
}

export interface RunningParallelTask {
  id: string;
  title: string;
  totalSeconds: number;
  secondsLeft: number;
  startedAt: number;
}

type AmbientType = 'off' | 'rain' | 'waves' | 'binaural';

// ────────────────────────────────────────────────────────────────────────────
// Sub-component: duration picker shown when customizing task duration
// ────────────────────────────────────────────────────────────────────────────
function DurationPicker({
  taskTitle,
  initialMins = 15,
  onConfirm,
  onSkip,
  isDark,
  listColor = '#0a84ff'
}: {
  taskTitle: string;
  initialMins?: number;
  onConfirm: (mins: number) => void;
  onSkip: () => void;
  isDark: boolean;
  listColor?: string;
}) {
  const [mins, setMins] = useState(String(initialMins || 15));
  const PRESETS = [5, 10, 15, 25, 45, 60];

  return (
    <motion.div
      initial={{ scale: 0.92, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.92, opacity: 0 }}
      transition={{ type: 'spring', damping: 26, stiffness: 350 }}
      style={{
        background: isDark ? 'rgba(28, 30, 46, 0.92)' : 'var(--bg-elevated, #ffffff)',
        border: isDark ? '1px solid rgba(255,255,255,0.14)' : '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
        borderRadius: 28,
        padding: '32px 28px 28px',
        maxWidth: 420,
        width: '100%',
        boxShadow: isDark 
          ? '0 24px 64px rgba(0,0,0,0.6)' 
          : '0 24px 64px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.04)',
        backdropFilter: 'blur(28px) saturate(180%)',
        WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        textAlign: 'center',
        margin: 'auto'
      }}
    >
      <div style={{
        width: 60, height: 60, borderRadius: '50%',
        background: isDark ? 'rgba(10,132,255,0.15)' : `color-mix(in srgb, ${listColor} 14%, transparent)`,
        color: listColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 20px'
      }}>
        <Clock size={28} />
      </div>

      <h3 style={{
        fontSize: '1.35rem',
        fontWeight: 700,
        color: isDark ? 'white' : 'var(--text-primary, #1c1c1e)',
        margin: '0 0 6px',
        letterSpacing: '-0.025em'
      }}>
        ¿Cuánto tiempo?
      </h3>
      <p style={{
        fontSize: '0.88rem',
        color: isDark ? 'rgba(255,255,255,0.55)' : 'var(--text-secondary, #636366)',
        margin: '0 0 24px',
        lineHeight: 1.5
      }}>
        Duración estimada para<br />
        <strong style={{ color: isDark ? 'rgba(255,255,255,0.85)' : 'var(--text-primary, #1c1c1e)', fontWeight: 600 }}>
          "{taskTitle}"
        </strong>
      </p>

      {/* Presets */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 18 }}>
        {PRESETS.map(p => {
          const isSelected = mins === String(p);
          return (
            <button
              key={p}
              onClick={() => setMins(String(p))}
              style={{
                padding: '8px 14px',
                borderRadius: 999,
                background: isSelected 
                  ? listColor 
                  : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
                color: isSelected 
                  ? 'white' 
                  : (isDark ? 'white' : 'var(--text-primary, #1c1c1e)'),
                border: isSelected 
                  ? 'none' 
                  : (isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)'),
                fontWeight: 600,
                fontSize: '0.88rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {p} min
            </button>
          );
        })}
      </div>

      {/* Custom input */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
        <input
          type="number" min="1" max="480"
          value={mins}
          onChange={e => setMins(e.target.value)}
          style={{
            width: 86, padding: '10px 12px', borderRadius: 14,
            background: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.04)',
            border: isDark ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(0,0,0,0.12)',
            color: isDark ? 'white' : 'var(--text-primary, #1c1c1e)',
            fontSize: '1.25rem', fontWeight: 700, textAlign: 'center', outline: 'none'
          }}
        />
        <span style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'var(--text-secondary, #636366)', fontWeight: 500, fontSize: '0.9rem' }}>
          minutos
        </span>
      </div>

      <motion.button
        onClick={() => onConfirm(parseInt(mins, 10) || 15)}
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
        style={{
          width: '100%', padding: '15px 0', borderRadius: 18,
          background: listColor, color: 'white', border: 'none',
          fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: `0 8px 24px ${listColor}45`
        }}
      >
        Empezar <ArrowRight size={18} />
      </motion.button>

      <button
        onClick={onSkip}
        style={{
          marginTop: 12, width: '100%', padding: '10px 0',
          borderRadius: 12, background: 'transparent',
          color: isDark ? 'rgba(255,255,255,0.4)' : 'var(--text-tertiary, #8e8e93)',
          border: 'none',
          fontSize: '0.85rem', fontWeight: 500, cursor: 'pointer'
        }}
      >
        Omitir esta tarea
      </button>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────
export function ListSequenceMode({ taskIds, listName, listColor = '#0a84ff', onClose }: ListSequenceModeProps) {
  const { tasks, toggleTask, updateTask, theme, listSections, lists } = useAppStore();
  const isDark = theme === 'dark';

  const screenBackground = isDark
    ? 'radial-gradient(ellipse at center, rgba(18,22,38,0.98) 0%, rgba(8,10,18,1) 100%)'
    : 'radial-gradient(ellipse at center, rgba(246,248,252,0.98) 0%, rgba(235,238,245,1) 100%)';
  const primaryText = isDark ? 'white' : 'var(--text-primary, #1c1c1e)';
  const secondaryText = isDark ? 'rgba(255,255,255,0.6)' : 'var(--text-secondary, #636366)';

  // Sequence state
  const [index, setIndex] = useState(0);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [skippedIds, setSkippedIds] = useState<string[]>([]);

  // Timer state per active task
  const [timeLeft, setTimeLeft] = useState(0);
  const [initialDuration, setInitialDuration] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [showDurationPicker, setShowDurationPicker] = useState(false);

  // Background / Parallel running tasks
  const [runningParallelTasks, setRunningParallelTasks] = useState<RunningParallelTask[]>([]);
  const [parallelToast, setParallelToast] = useState<string | null>(null);

  // Ambient sound
  const [ambient, setAmbient] = useState<AmbientType>('off');

  // Derived current task
  const activeTaskIds = taskIds.filter(id => tasks[id] && !tasks[id].deleted_at);
  const currentTask = activeTaskIds[index] ? tasks[activeTaskIds[index]] : null;
  const isFinished = index >= activeTaskIds.length;

  const currentDurationInfo = currentTask ? getTaskDuration(currentTask, listSections, lists) : null;

  // Load task on index change: start immediately with heuristic or user-set duration
  useEffect(() => {
    if (!currentTask) return;
    setIsActive(false);

    const dInfo = getTaskDuration(currentTask, listSections, lists);
    const activeMins = (typeof currentTask.duration === 'number' && currentTask.duration > 0)
      ? currentTask.duration
      : dInfo.activeMinutes;

    const secs = Math.max(60, activeMins * 60);
    setShowDurationPicker(false);
    setTimeLeft(secs);
    setInitialDuration(secs);
    setIsActive(true);
    SoundService.playPop();
  }, [index, currentTask?.id, listSections, lists]);

  // Main task countdown
  useEffect(() => {
    if (!isActive || timeLeft <= 0) {
      if (timeLeft === 0 && isActive && initialDuration > 0) {
        setIsActive(false);
        SoundService.playComplete();
        SoundService.stopAmbientSound();
      }
      return;
    }
    const id = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(id);
  }, [isActive, timeLeft, initialDuration]);

  // Parallel background countdown interval
  useEffect(() => {
    if (runningParallelTasks.length === 0) return;
    const interval = setInterval(() => {
      setRunningParallelTasks(prev => {
        let finishedTitle: string | null = null;
        const updated = prev.map(p => {
          const nextSecs = p.secondsLeft - 1;
          if (nextSecs <= 0 && p.secondsLeft > 0) {
            finishedTitle = p.title;
          }
          return { ...p, secondsLeft: Math.max(0, nextSecs) };
        }).filter(p => p.secondsLeft > 0);

        if (finishedTitle) {
          SoundService.playComplete();
          HapticService.notification('success');
          setParallelToast(`🧺 ¡"${finishedTitle}" ha completado su ciclo!`);
        }
        return updated;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [runningParallelTasks.length]);

  // Ambient sound
  useEffect(() => {
    if (ambient === 'off' || !isActive) SoundService.stopAmbientSound();
    else SoundService.startAmbientSound(ambient);
    return () => SoundService.stopAmbientSound();
  }, [ambient, isActive]);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { SoundService.stopAmbientSound(); onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleDurationConfirm = useCallback((mins: number) => {
    if (!currentTask) return;
    const valid = Math.max(1, Math.min(480, mins));
    updateTask(currentTask.id, { duration: valid });
    const secs = valid * 60;
    setInitialDuration(secs);
    setTimeLeft(secs);
    setShowDurationPicker(false);
    setIsActive(true);
    SoundService.playPop();
  }, [currentTask, updateTask]);

  const handleCompleteTask = useCallback(() => {
    if (!currentTask) return;
    SoundService.playComplete();
    HapticService.notification('success');
    toggleTask(currentTask.id);
    setCompletedIds(prev => [...prev, currentTask.id]);
    setIsActive(false);
    SoundService.stopAmbientSound();
    setIndex(i => i + 1);
  }, [currentTask, toggleTask]);

  const handleSkipTask = useCallback(() => {
    if (!currentTask) return;
    HapticService.selection();
    SoundService.playPop();
    setSkippedIds(prev => [...prev, currentTask.id]);
    setIsActive(false);
    SoundService.stopAmbientSound();
    setIndex(i => i + 1);
  }, [currentTask]);

  // Parallel task launcher: completes active setup and advances sequence immediately!
  const handleStartParallelAndNext = useCallback(() => {
    if (!currentTask || !currentDurationInfo) return;
    SoundService.playComplete();
    HapticService.notification('success');

    const parallelSeconds = (currentDurationInfo.parallelMinutes || 120) * 60;
    setRunningParallelTasks(prev => [
      ...prev.filter(p => p.id !== currentTask.id),
      {
        id: currentTask.id,
        title: currentTask.title,
        totalSeconds: parallelSeconds,
        secondsLeft: parallelSeconds,
        startedAt: Date.now()
      }
    ]);

    toggleTask(currentTask.id);
    setCompletedIds(prev => [...prev, currentTask.id]);
    setIsActive(false);
    SoundService.stopAmbientSound();
    setIndex(i => i + 1);
  }, [currentTask, currentDurationInfo, toggleTask]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const progress = initialDuration > 0 ? (initialDuration - timeLeft) / initialDuration : 0;
  const strokeR = 110;
  const strokeDash = 2 * Math.PI * strokeR;
  const strokeOffset = strokeDash * (1 - progress);

  // ── FINISHED SCREEN ─────────────────────────────────────────────────────
  if (isFinished) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: screenBackground,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: 32, boxSizing: 'border-box', textAlign: 'center'
        }}
      >
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 18, stiffness: 280, delay: 0.1 }}
          style={{
            width: 88, height: 88, borderRadius: '50%', marginBottom: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(52, 199, 89, 0.14)'
          }}
        >
          <CheckCircle size={44} color="#34c759" strokeWidth={2} />
        </motion.div>
        <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: primaryText, margin: '0 0 12px', letterSpacing: '-0.03em' }}>
          ¡Lista completada!
        </h2>
        <p style={{ fontSize: '1rem', color: secondaryText, marginBottom: 24, maxWidth: 360, lineHeight: 1.5 }}>
          Has recorrido <strong style={{ color: primaryText }}>{listName}</strong> de principio a fin.{' '}
          {completedIds.length} tarea{completedIds.length !== 1 ? 's' : ''} completada{completedIds.length !== 1 ? 's' : ''}.
          {skippedIds.length > 0 && ` ${skippedIds.length} omitida${skippedIds.length !== 1 ? 's' : ''}.`}
        </p>

        {runningParallelTasks.length > 0 && (
          <div style={{
            marginBottom: 28, padding: '12px 18px', borderRadius: 16,
            background: isDark ? 'rgba(0,122,255,0.12)' : 'rgba(0,122,255,0.06)',
            border: '1px solid rgba(0,122,255,0.25)', maxWidth: 400
          }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#007aff', marginBottom: 6 }}>
              🧺 Tareas en curso en segundo plano:
            </div>
            {runningParallelTasks.map(p => (
              <div key={p.id} style={{ fontSize: '0.8rem', color: secondaryText }}>
                • {p.title}: <strong>{formatDuration(Math.ceil(p.secondsLeft / 60))}</strong> restante
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
          <motion.button
            onClick={onClose}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            style={{
              padding: '14px 32px', borderRadius: 20,
              background: listColor, color: 'white', border: 'none',
              fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
              boxShadow: `0 8px 28px ${listColor}55`
            }}
          >
            Volver a la lista
          </motion.button>
        </div>
      </motion.div>
    );
  }

  // ── MAIN SCREEN ──────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: screenBackground,
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'space-between',
          padding: 'clamp(20px, 4vw, 40px)',
          boxSizing: 'border-box', overflowY: 'auto'
        }}
      >
        {/* Toast for completed background parallel tasks */}
        <AnimatePresence>
          {parallelToast && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              style={{
                position: 'fixed', top: 24, zIndex: 100000,
                background: '#30d158', color: '#000',
                padding: '10px 20px', borderRadius: 999,
                fontWeight: 700, fontSize: '0.9rem',
                display: 'flex', alignItems: 'center', gap: 10,
                boxShadow: '0 10px 30px rgba(48,209,88,0.5)'
              }}
            >
              <span>{parallelToast}</span>
              <button
                onClick={() => setParallelToast(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#000' }}
              >
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── TOP BAR ─────────────────────────────────────────────────────── */}
        <div style={{ width: '100%', maxWidth: 720, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          {/* List name + progress */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: listColor, fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              <ListChecks size={16} />
              {listName}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {activeTaskIds.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: i < index ? 20 : (i === index ? 28 : 12),
                    height: 4, borderRadius: 2,
                    background: i < index ? '#30d158' : i === index ? listColor : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)'),
                    transition: 'all 0.3s ease'
                  }}
                />
              ))}
            </div>
          </div>

          {/* Running parallel tasks pills */}
          {runningParallelTasks.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
              {runningParallelTasks.map(pt => (
                <div
                  key={pt.id}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '5px 12px', borderRadius: 999,
                    background: isDark ? 'rgba(0, 122, 255, 0.18)' : 'rgba(0, 122, 255, 0.1)',
                    border: '1px solid rgba(0, 122, 255, 0.35)',
                    color: '#007aff', fontSize: '0.78rem', fontWeight: 600
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#30d158' }} />
                  🧺 {pt.title}: {formatDuration(Math.ceil(pt.secondsLeft / 60))}
                </div>
              ))}
            </div>
          )}

          {/* Close */}
          <button
            onClick={() => { SoundService.stopAmbientSound(); onClose(); }}
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.08)',
              color: isDark ? 'rgba(255,255,255,0.6)' : 'var(--text-secondary, #636366)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer'
            }}
            title="Salir (Esc)"
            aria-label="Salir del modo secuencia"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {showDurationPicker && currentTask ? (
            <DurationPicker
              key={`picker-${currentTask.id}`}
              taskTitle={currentTask.title}
              initialMins={currentDurationInfo?.activeMinutes || 15}
              onConfirm={handleDurationConfirm}
              onSkip={handleSkipTask}
              isDark={isDark}
              listColor={listColor}
            />
          ) : (
            <motion.div
              key={`task-${currentTask?.id}`}
              initial={{ x: 40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -40, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              style={{ textAlign: 'center', maxWidth: 660, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', margin: 'auto 0', gap: 0 }}
            >
              {/* Step indicator */}
              <div style={{ fontSize: '0.8rem', color: isDark ? 'rgba(255,255,255,0.4)' : 'var(--text-tertiary, #8e8e93)', fontWeight: 600, marginBottom: 8, letterSpacing: '0.05em' }}>
                {index + 1} / {activeTaskIds.length}
              </div>

              {/* Parallel Task Badge */}
              {currentDurationInfo?.isParallel && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 999,
                  background: isDark ? 'rgba(0, 122, 255, 0.16)' : 'rgba(0, 122, 255, 0.08)',
                  border: '1px solid rgba(0, 122, 255, 0.28)',
                  color: '#007aff', fontSize: '0.82rem', fontWeight: 600,
                  marginBottom: 14
                }}>
                  <Zap size={14} fill="currentColor" />
                  <span>Tarea en paralelo</span>
                  <span style={{ opacity: 0.5 }}>·</span>
                  <span>~{currentDurationInfo.activeMinutes} min activo + ~{formatDuration(currentDurationInfo.parallelMinutes)} segundo plano</span>
                </div>
              )}

              {/* Task title */}
              <h2 style={{
                fontSize: 'clamp(1.6rem, 4vw, 2.6rem)',
                fontWeight: 700, lineHeight: 1.18,
                color: primaryText,
                fontFamily: 'var(--font-display)',
                letterSpacing: '-0.025em', margin: '0 0 8px', wordBreak: 'break-word'
              }}>
                {currentTask?.title}
              </h2>

              {currentTask?.description && (
                <p style={{
                  fontSize: '0.95rem',
                  color: isDark ? 'rgba(255,255,255,0.55)' : 'var(--text-secondary, #636366)',
                  margin: '0 0 20px',
                  lineHeight: 1.5,
                  maxWidth: 480
                }}>
                  {currentTask.description}
                </p>
              )}

              {/* Circular timer */}
              {initialDuration > 0 && (
                <div
                  onClick={() => setIsActive(v => !v)}
                  style={{ position: 'relative', width: 240, height: 240, margin: '6px 0 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title={isActive ? 'Pausar' : 'Reanudar'}
                >
                  <svg width="240" height="240" style={{ transform: 'rotate(-90deg)', position: 'absolute', inset: 0 }}>
                    <circle cx="120" cy="120" r={strokeR} stroke={isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)"} strokeWidth="8" fill="none" />
                    <circle
                      cx="120" cy="120" r={strokeR}
                      stroke={`url(#seqGrad-${listColor.replace('#', '')})`}
                      strokeWidth="8" strokeDasharray={strokeDash}
                      strokeDashoffset={strokeOffset} strokeLinecap="round" fill="none"
                      style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                    />
                    <defs>
                      <linearGradient id={`seqGrad-${listColor.replace('#', '')}`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={listColor} />
                        <stop offset="100%" stopColor="#30d158" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, gap: 6 }}>
                    <span style={{ fontSize: '3.4rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: primaryText, letterSpacing: '-0.03em', lineHeight: 1 }}>
                      {formatTime(timeLeft)}
                    </span>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '4px 12px', borderRadius: 999,
                      background: isActive ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)') : listColor,
                      color: isActive ? (isDark ? 'white' : 'var(--text-secondary, #636366)') : 'white',
                      fontSize: '0.78rem', fontWeight: 700,
                      boxShadow: isActive ? 'none' : `0 4px 14px ${listColor}60`,
                      transition: 'all 0.2s ease'
                    }}>
                      {isActive ? <><Pause size={12} fill={isDark ? "white" : "currentColor"} /> EN PROGRESO</> : <><Play size={12} fill="white" style={{ marginLeft: 2 }} /> REANUDAR</>}
                    </div>
                  </div>
                </div>
              )}

              {/* Adjust duration trigger */}
              <button
                onClick={() => setShowDurationPicker(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: 'transparent', border: 'none',
                  color: isDark ? 'rgba(255,255,255,0.45)' : 'var(--text-tertiary, #8e8e93)',
                  fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer',
                  marginBottom: 20
                }}
              >
                <Clock size={13} /> Ajustar tiempo ({Math.ceil(timeLeft / 60)} min)
              </button>

              {/* Ambient sound mini bar */}
              <div style={{
                width: '100%', maxWidth: 460, padding: '10px 14px',
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                borderRadius: 16,
                border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
                display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20
              }}>
                <Sparkles size={14} color={listColor} />
                <span style={{ fontSize: '0.76rem', color: isDark ? 'rgba(255,255,255,0.4)' : 'var(--text-tertiary, #8e8e93)', fontWeight: 600, marginRight: 'auto' }}>SONIDO</span>
                {(['off', 'rain', 'waves', 'binaural'] as AmbientType[]).map(type => (
                  <button
                    key={type}
                    onClick={() => setAmbient(type)}
                    style={{
                      padding: '4px 10px', borderRadius: 999,
                      background: ambient === type ? listColor : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
                      border: 'none',
                      color: ambient === type ? 'white' : (isDark ? 'white' : 'var(--text-secondary, #636366)'),
                      fontSize: '0.76rem', fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 4,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {type === 'off' && <VolumeX size={12} />}
                    {type === 'rain' && <CloudRain size={12} />}
                    {type === 'waves' && <Waves size={12} />}
                    {type === 'binaural' && <Volume2 size={12} />}
                    {type === 'off' ? 'Sin' : type === 'rain' ? 'Lluvia' : type === 'waves' ? 'Olas' : 'Binaural'}
                  </button>
                ))}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 460 }}>
                {/* Dedicated Parallel Task Action Button */}
                {currentDurationInfo?.isParallel && (
                  <motion.button
                    onClick={handleStartParallelAndNext}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    style={{
                      flex: 2, padding: '15px 12px', borderRadius: 18,
                      background: '#007aff', color: 'white',
                      border: 'none', fontWeight: 700, fontSize: '0.92rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: '0 8px 24px rgba(0,122,255,0.45)'
                    }}
                  >
                    <Zap size={18} fill="white" /> Poner en marcha y seguir
                  </motion.button>
                )}

                {initialDuration > 0 && !currentDurationInfo?.isParallel && (
                  <button
                    onClick={() => setIsActive(v => !v)}
                    style={{
                      flex: 1, padding: '15px 0', borderRadius: 18,
                      background: isActive ? (isDark ? 'rgba(255,149,0,0.18)' : 'rgba(255,149,0,0.12)') : listColor,
                      color: isActive ? '#ff9500' : 'white',
                      border: isActive ? '1px solid rgba(255,149,0,0.4)' : 'none',
                      fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: isActive ? 'none' : `0 8px 24px ${listColor}50`,
                      transition: 'all 0.18s ease'
                    }}
                  >
                    {isActive ? <><Pause size={20} fill="#ff9500" /> Pausar</> : <><Play size={20} fill="white" style={{ marginLeft: 2 }} /> Reanudar</>}
                  </button>
                )}

                <motion.button
                  onClick={handleCompleteTask}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  style={{
                    flex: currentDurationInfo?.isParallel ? 1 : 1, padding: '15px 0', borderRadius: 18,
                    background: '#30d158', color: '#000',
                    border: 'none', fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: '0 8px 24px rgba(48,209,88,0.45)'
                  }}
                >
                  <CheckCircle size={20} /> Completar
                </motion.button>

                <button
                  onClick={handleSkipTask}
                  style={{
                    width: 52, height: 52, borderRadius: 16,
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                    border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
                    color: isDark ? 'rgba(255,255,255,0.5)' : 'var(--text-secondary, #636366)',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0
                  }}
                  title="Omitir tarea"
                  aria-label="Omitir tarea"
                >
                  <SkipForward size={20} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── FOOTER ──────────────────────────────────────────────────────── */}
        <div style={{ color: isDark ? 'rgba(255,255,255,0.28)' : 'var(--text-tertiary, #8e8e93)', fontSize: '0.78rem', textAlign: 'center' }}>
          <kbd style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', padding: '2px 6px', borderRadius: 4, color: isDark ? 'rgba(255,255,255,0.5)' : 'var(--text-secondary, #636366)' }}>Esc</kbd> para salir
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
