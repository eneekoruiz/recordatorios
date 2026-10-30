import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Play, Pause, CheckCircle, SkipForward, Clock, VolumeX, Zap, Share, Headphones, ArrowRight, Plus,
  Timer, Flame
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { SoundService } from '../../services/SoundService';
import { HapticService } from '../../services/HapticService';
import { getTaskDuration, formatDuration } from '../../utils/taskDuration';
import { ConfettiService } from '../../services/ConfettiService';
import { BackgroundTimers, useBackgroundTimers } from '../../services/BackgroundTimers';
import { useTrainingStore } from '../../store/useTrainingStore';
import { InsightCard } from '../training/InsightCard';
import { matchesPeriod } from '../../services/TaskService';
import { getEffectiveCycleId } from '../../utils/sectionRoutine';
import { isSeriesTask, seriesDone, setRestSeconds, setWorkSeconds, setLogProposal } from '../../utils/seriesTasks';
import type { TaskItem } from '../../models/Task';
import { calculateSessionVolume } from '../../utils/weightHistory';
import { setRestCountdownTitle, notifyRestFinished, restoreDocumentTitle } from '../../utils/timerTitleNotification';

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

type AmbientType = 'off' | 'rain' | 'waves' | 'binaural' | 'focus';

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
        Duración de la tarea
      </h3>
      <p style={{
        fontSize: '0.88rem',
        color: isDark ? 'rgba(255,255,255,0.55)' : 'var(--text-secondary, #636366)',
        margin: '0 0 24px',
        lineHeight: 1.5
      }}>
        Se guarda para las próximas veces:<br />
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
                transition: 'background-color, border-color, color, fill, opacity, transform, box-shadow 0.15s ease'
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
  const { tasks, toggleTask, updateTask, theme, listSections, lists, cycles, setLearnedDuration } = useAppStore();
  const isDark = theme === 'dark';

  const screenBackground = isDark
    ? '#000000'
    : '#f2f2f7';
  const primaryText = isDark ? 'white' : 'var(--text-primary, #1c1c1e)';

  // Sequence state
  const [index, setIndex] = useState(0);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [skippedIds, setSkippedIds] = useState<string[]>([]);

  // Timer state per active task
  const [timeLeft, setTimeLeft] = useState(0);
  const [initialDuration, setInitialDuration] = useState(0);
  // Lo estimado al empezar la tarea (sin lo que se alargue después): base para comparar con lo real.
  const [plannedSecs, setPlannedSecs] = useState(0);
  // Pausa guiada entre tareas (si la lista la tiene activada).
  const [pause, setPause] = useState<{ startedAt: number; plannedSec: number; adjustSec: number; nextTitle: string } | null>(null);
  const [pauseNow, setPauseNow] = useState(() => Date.now());
  // Descanso de un ejercicio por series: entre series («kind: set») o antes del siguiente ejercicio
  // («transition»). Hora absoluta: sigue contando aunque la app pase a segundo plano.
  const [setRest, setSetRest] = useState<{
    startedAt: number; plannedSec: number; adjustSec: number; kind: 'set' | 'transition';
    taskId: string; doneSet: number; totalSets: number; nextLabel: string; kg: string; reps: string; kgHint: string; repsHint: string;
  } | null>(null);
  const [isActive, setIsActive] = useState(false);
  const activeElapsedRef = useRef<number>(0);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const [lastStepAt, setLastStepAt] = useState(startedAt);

  // Background / Parallel running tasks
  // Viven en un servicio con hora de fin absoluta: siguen contando si se cierra esta pantalla o la app.
  const backgroundTimers = useBackgroundTimers();
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (backgroundTimers.length === 0) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [backgroundTimers.length]);
  const runningParallelTasks: RunningParallelTask[] = backgroundTimers.map(t => ({
    id: t.id,
    title: t.title,
    totalSeconds: Math.round((t.endsAt - t.startedAt) / 1000),
    secondsLeft: t.done ? 0 : Math.max(0, Math.ceil((t.endsAt - nowTick) / 1000)),
    startedAt: t.startedAt
  }));
  const [parallelToast, setParallelToast] = useState<string | null>(null);

  // Ambient sound
  const [ambient, setAmbient] = useState<AmbientType>('off');
  // Lo que no hace falta a cada momento (sonido, +1/+5/+10) está plegado hasta que se pide.
  const [showSound, setShowSound] = useState(false);
  const [showTimeTools, setShowTimeTools] = useState(false);

  // Dynamic task queue: allows postponing tasks to the end of the sequence
  const [sequenceTaskIds, setSequenceTaskIds] = useState<string[]>(() =>
    taskIds.filter(id => tasks[id] && !tasks[id].deleted_at)
  );

  const activeTaskIds = sequenceTaskIds.filter(id => tasks[id] && !tasks[id].deleted_at);
  const currentTask = activeTaskIds[index] ? tasks[activeTaskIds[index]] : null;
  const isFinished = index >= activeTaskIds.length;

  const currentDurationInfo = currentTask ? getTaskDuration(currentTask, listSections, lists) : null;

  // Series hechas en este periodo (lo de la semana pasada no cuenta).
  const doneSetsOf = useCallback((task: TaskItem) => seriesDone(task, (updatedAt) =>
    matchesPeriod([updatedAt], getEffectiveCycleId(task, listSections, lists) || 'cycle_day', new Date(), cycles)
  ), [listSections, lists, cycles]);
  const isSeries = isSeriesTask(currentTask);
  const totalSets = isSeries && currentTask ? currentTask.targetCount || 1 : 1;
  const setNumber = isSeries && currentTask ? Math.min(totalSets, doneSetsOf(currentTask) + 1) : 1;
  // Minutos que ocupa una tarea en la secuencia: en un ejercicio por series, las series que faltan y sus descansos.
  const sequenceMinutes = useCallback((t: TaskItem) => {
    if (isSeriesTask(t)) {
      const left = Math.max(1, (t.targetCount || 1) - doneSetsOf(t));
      return (left * setWorkSeconds(t) + (left - 1) * setRestSeconds(t)) / 60;
    }
    const dInfo = getTaskDuration(t, listSections, lists);
    const learned = useAppStore.getState().learnedDurations[t.id];
    const rawMins = (typeof t.duration === 'number' && t.duration > 0) ? t.duration : (learned || dInfo.activeMinutes);
    return rawMins > 0 ? rawMins : 5;
  }, [doneSetsOf, listSections, lists]);
  const sequenceList = lists.find(l => l.id === tasks[taskIds[0]]?.categoryId);
  const guidedBreaks = Boolean(sequenceList?.guidedBreaks);
  const breakSeconds = sequenceList?.breakSeconds ?? 300;
  const recordEvents = useTrainingStore(s => s.recordEvents);

  // Duración total estimada y restante de la secuencia
  const totalEstimatedMins = useMemo(() => Math.round(activeTaskIds.reduce((acc, id) => (
    tasks[id] ? acc + sequenceMinutes(tasks[id]) : acc
  ), 0)), [activeTaskIds, tasks, sequenceMinutes]);

  const remainingEstimatedMins = useMemo(() => Math.round(activeTaskIds.slice(index).reduce((acc, id) => (
    tasks[id] ? acc + sequenceMinutes(tasks[id]) : acc
  ), 0)), [activeTaskIds, index, tasks, sequenceMinutes]);

  // Al pasar a otra tarea, el temporizador arranca con su duración (la del usuario, la
  // aprendida o la estimada). Si no tiene ninguna, arranca con 5 min por defecto para
  // ofrecer una cuenta atrás razonable.
  const loadKey = currentTask ? `${index}|${currentTask.id}` : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  if (loadKey !== loadedKey) {
    setLoadedKey(loadKey);
    if (currentTask) {
      const dInfo = getTaskDuration(currentTask, listSections, lists);
      const learned = useAppStore.getState().learnedDurations[currentTask.id];
      const rawMins = (typeof currentTask.duration === 'number' && currentTask.duration > 0)
        ? currentTask.duration
        : (learned || dInfo.activeMinutes);
      const effectiveMins = rawMins > 0 ? rawMins : 5;
      // Segundos exactos para la cuenta atrás (en un ejercicio por series, lo de una serie)
      const secs = isSeriesTask(currentTask) ? setWorkSeconds(currentTask) : Math.max(10, Math.round(effectiveMins * 60));
      setShowDurationPicker(false);
      setShowTimeTools(false);
      setTimeLeft(secs);
      setInitialDuration(secs);
      setPlannedSecs(secs);
      // Si se llega con el descanso de transición en marcha, el reloj espera a que termine.
      setIsActive(!setRest);
    }
  }
  useEffect(() => {
    activeElapsedRef.current = 0;
    if (loadKey) SoundService.playPop();
  }, [loadKey]);

  // Cuenta atrás de la tarea: un paso por segundo; al llegar a cero, suena y se para.
  useEffect(() => {
    if (!isActive || timeLeft <= 0) return;
    const timer = setTimeout(() => {
      activeElapsedRef.current += 1;
      const next = timeLeft - 1;
      setTimeLeft(next);
      if (currentTask?.isRest) {
        if (next > 0) {
          setRestCountdownTitle(next, true);
        } else {
          const nextTask = activeTaskIds[index + 1] ? tasks[activeTaskIds[index + 1]] : null;
          notifyRestFinished(nextTask?.title);
        }
      }
      if (next <= 0) {
        setIsActive(false);
        SoundService.playComplete();
        SoundService.stopAmbientSound();
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [isActive, timeLeft, currentTask?.isRest, activeTaskIds, index, tasks]);

  // Ambient sound
  useEffect(() => {
    if (ambient === 'off' || !isActive) SoundService.stopAmbientSound();
    else SoundService.startAmbientSound(ambient);
    return () => SoundService.stopAmbientSound();
  }, [ambient, isActive]);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { 
        restoreDocumentTitle();
        SoundService.stopAmbientSound(); 
        onClose(); 
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleDurationConfirm = useCallback((mins: number) => {
    if (!currentTask) return;
    const valid = Math.max(1, Math.min(480, mins));
    if (!currentTask.duration || currentTask.duration === 0) {
      setLearnedDuration(currentTask.id, valid);
    }
    updateTask(currentTask.id, { duration: valid });
    const secs = valid * 60;
    setInitialDuration(secs);
    setTimeLeft(secs);
    setShowDurationPicker(false);
    setIsActive(true);
    SoundService.playPop();
  }, [currentTask, updateTask, setLearnedDuration]);

  // Hechos observados para las sugerencias: cuánto tardó de verdad y si se pospone u omite con frecuencia.
  const observeCompletion = useCallback((taskId: string) => {
    const elapsed = activeElapsedRef.current;
    if (elapsed >= 10 && plannedSecs > 0) {
      recordEvents([{ at: Date.now(), scope: 'task', subjectId: taskId, type: 'time_delta', value: elapsed - plannedSecs, planned: plannedSecs }]);
    }
  }, [plannedSecs, recordEvents]);

  // Tras una tarea, si la lista tiene pausas guiadas y quedan más, se abre la pausa.
  const maybeStartPause = useCallback(() => {
    if (!guidedBreaks || index + 1 >= activeTaskIds.length) return;
    const nextTask = tasks[activeTaskIds[index + 1]];
    setPause({ startedAt: Date.now(), plannedSec: breakSeconds, adjustSec: 0, nextTitle: nextTask?.title ?? '' });
    setPauseNow(Date.now());
  }, [guidedBreaks, index, activeTaskIds, tasks, breakSeconds]);

  const endPause = useCallback((skipped: boolean) => {
    if (!pause) return;
    const now = Date.now();
    const taken = Math.round((now - pause.startedAt) / 1000);
    const delta = taken - pause.plannedSec;
    if (sequenceList) {
      const type = skipped && taken < pause.plannedSec * 0.8 ? 'rest_skipped' : delta >= 15 || pause.adjustSec > 0 ? 'rest_extended' : delta <= -15 ? 'rest_shortened' : 'rest_ok';
      recordEvents([{ at: now, scope: 'list', subjectId: sequenceList.id, type, value: delta, planned: pause.plannedSec }]);
    }
    setPause(null);
    SoundService.playPop();
  }, [pause, sequenceList, recordEvents]);

  useEffect(() => {
    if (!pause) return;
    const id = window.setInterval(() => setPauseNow(Date.now()), 250);
    // Aviso una sola vez cuando la pausa llega a cero.
    const end = window.setTimeout(() => { SoundService.playComplete(); HapticService.notification('success'); }, Math.max(0, pause.startedAt + (pause.plannedSec + pause.adjustSec) * 1000 - Date.now()));
    return () => { window.clearInterval(id); window.clearTimeout(end); };
  }, [pause]);

  // Serie hecha: cuenta la serie y abre el descanso; tras la última, descanso antes del siguiente ejercicio.
  const handleSetDone = useCallback(() => {
    if (!currentTask) return;
    const done = setNumber;
    HapticService.notification('success');
    toggleTask(currentTask.id);
    setIsActive(false);
    SoundService.stopAmbientSound();
    setLastStepAt(Date.now());
    const { value, hint } = setLogProposal(currentTask, done);
    const restBase = {
      startedAt: Date.now(), plannedSec: setRestSeconds(currentTask), adjustSec: 0, taskId: currentTask.id, doneSet: done, totalSets,
      kg: value ? String(value.weightKg) : '', reps: value?.reps ? String(value.reps) : '',
      kgHint: hint ? String(hint.weightKg) : '', repsHint: hint?.reps ? String(hint.reps) : '',
    };
    if (done < totalSets) {
      SoundService.playPop();
      setSetRest({ ...restBase, kind: 'set', nextLabel: `Serie ${done + 1} de ${totalSets}` });
      return;
    }
    SoundService.playComplete();
    const elapsedSeconds = activeElapsedRef.current;
    if (elapsedSeconds > 0) useAppStore.getState().trackTaskExecution(currentTask.id, elapsedSeconds);
    setCompletedIds(prev => [...prev, currentTask.id]);
    const next = tasks[activeTaskIds[index + 1]];
    if (next) setSetRest({ ...restBase, kind: 'transition', nextLabel: next.title });
    setIndex(i => i + 1);
  }, [currentTask, setNumber, totalSets, toggleTask, tasks, activeTaskIds, index]);

  // Al acabar el descanso: guarda el peso de la serie (si se puso) y arranca lo siguiente.
  const endSetRest = useCallback(() => {
    if (!setRest) return;
    const task = useAppStore.getState().tasks[setRest.taskId];
    const kg = parseFloat(setRest.kg.replace(',', '.'));
    const reps = parseInt(setRest.reps, 10);
    if (task && Number.isFinite(kg) && kg > 0) {
      updateTask(task.id, {
        weightLogs: [...(task.weightLogs || []), { set: setRest.doneSet, weightKg: kg, ...(Number.isFinite(reps) && reps > 0 ? { reps } : {}), date: new Date().toISOString() }]
      });
    }
    setSetRest(null);
    setTimeLeft(initialDuration);
    setIsActive(true);
    SoundService.playPop();
  }, [setRest, updateTask, initialDuration]);

  useEffect(() => {
    if (!setRest) return;
    const id = window.setInterval(() => setPauseNow(Date.now()), 250);
    const end = window.setTimeout(() => { SoundService.playComplete(); HapticService.notification('success'); },
      Math.max(0, setRest.startedAt + (setRest.plannedSec + setRest.adjustSec) * 1000 - Date.now()));
    return () => { window.clearInterval(id); window.clearTimeout(end); };
  }, [setRest]);

  const handleCompleteTask = useCallback(() => {
    if (!currentTask) return;
    // Un contador («Abs 50») se da por hecho entero: no se avanza de uno en uno.
    if (!isSeriesTask(currentTask) && currentTask.targetCount && currentTask.targetCount > 1) {
      updateTask(currentTask.id, { currentCount: currentTask.targetCount - 1 });
    }
    SoundService.playComplete();
    HapticService.notification('success');
    
    // Registrar los segundos activos reales acumulados para la tarea en curso
    const elapsedSeconds = activeElapsedRef.current;
    if (elapsedSeconds > 0) {
      useAppStore.getState().trackTaskExecution(currentTask.id, elapsedSeconds);
    }

    observeCompletion(currentTask.id);
    toggleTask(currentTask.id);
    setCompletedIds(prev => [...prev, currentTask.id]);
    setIsActive(false);
    SoundService.stopAmbientSound();
    setLastStepAt(Date.now());
    maybeStartPause();
    setIndex(i => i + 1);
  }, [currentTask, toggleTask, updateTask, observeCompletion, maybeStartPause]);

  const handleSkipTask = useCallback(() => {
    if (!currentTask) return;
    HapticService.selection();
    SoundService.playPop();
    setSkippedIds(prev => [...prev, currentTask.id]);
    recordEvents([{ at: Date.now(), scope: 'task', subjectId: currentTask.id, type: 'task_skipped' }]);
    setIsActive(false);
    SoundService.stopAmbientSound();
    setLastStepAt(Date.now());
    setIndex(i => i + 1);
  }, [currentTask, recordEvents]);

  // Posponer tarea ("Dejar para luego"): la coloca al final de la secuencia
  const handlePostponeTask = useCallback(() => {
    if (!currentTask) return;
    HapticService.selection();
    SoundService.playPop();

    const currentId = currentTask.id;
    if (activeTaskIds.length - index <= 1) {
      setParallelToast('Esta tarea ya es la última de la lista');
      setTimeout(() => setParallelToast(null), 2500);
      return;
    }
    // Se mueve por su posición real (el índice cuenta solo las tareas que siguen existiendo).
    const position = sequenceTaskIds.indexOf(currentId);
    setSequenceTaskIds([...sequenceTaskIds.slice(0, position), ...sequenceTaskIds.slice(position + 1), currentId]);
    recordEvents([{ at: Date.now(), scope: 'task', subjectId: currentId, type: 'task_postponed' }]);
    setParallelToast(`«${currentTask.title}» pospuesta al final`);
    setTimeout(() => setParallelToast(null), 3000);
  }, [currentTask, index, activeTaskIds.length, sequenceTaskIds, recordEvents]);

  // Parallel task launcher: completes active setup and advances sequence immediately!
  const handleStartParallelAndNext = useCallback(() => {
    if (!currentTask || !currentDurationInfo) return;
    SoundService.playComplete();
    HapticService.notification('success');

    const parallelSeconds = (currentDurationInfo.parallelMinutes || 120) * 60;
    BackgroundTimers.start(currentTask.id, currentTask.title, parallelSeconds);

    const elapsedSeconds = activeElapsedRef.current;
    if (elapsedSeconds > 0) {
      useAppStore.getState().trackTaskExecution(currentTask.id, elapsedSeconds);
    }

    observeCompletion(currentTask.id);
    toggleTask(currentTask.id);
    setCompletedIds(prev => [...prev, currentTask.id]);
    setIsActive(false);
    SoundService.stopAmbientSound();
    setLastStepAt(Date.now());
    maybeStartPause();
    setIndex(i => i + 1);
  }, [currentTask, currentDurationInfo, toggleTask, observeCompletion, maybeStartPause]);

  // Dar por terminada una tarea en segundo plano sin esperar a su cuenta atrás.
  const handleFinishParallel = (id: string) => {
    HapticService.selection();
    BackgroundTimers.finish(id);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const progress = initialDuration > 0 ? (initialDuration - timeLeft) / initialDuration : 0;
  const ringSize = 232;
  const strokeR = 106;
  const strokeDash = 2 * Math.PI * strokeR;
  const strokeOffset = strokeDash * (1 - progress);

  // ── FINISHED SCREEN ─────────────────────────────────────────────────────
  useEffect(() => {
    if (isFinished) {
      ConfettiService.celebrate();
    }
  }, [isFinished]);

  if (isFinished) {
    const elapsedMins = Math.max(1, Math.ceil((lastStepAt - startedAt) / 60000));

    const handleShare = async () => {
      const text = `He completado ${listName}: ${completedIds.length} tareas en ${elapsedMins} min.`;
      if (navigator.share) {
        try {
          await navigator.share({ text });
        } catch {
          // Ignorar aborto
        }
      } else {
        navigator.clipboard.writeText(text);
        window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Copiado al portapapeles' }));
      }
    };

    const rowsMuted = isDark ? 'rgba(255,255,255,0.6)' : 'var(--text-secondary, #636366)';
    const rowLine = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
    const isGymWorkout = Boolean(
      listName.toLowerCase().includes('gimnasio') || 
      listName.toLowerCase().includes('gym') || 
      listName.toLowerCase().includes('entreno') ||
      activeTaskIds.some(id => tasks[id]?.isRest || (tasks[id]?.weightLogs && tasks[id].weightLogs!.length > 0))
    );

    const sessionVolume = isGymWorkout 
      ? calculateSessionVolume(activeTaskIds.map(id => tasks[id]).filter(Boolean)) 
      : null;

    const summary: [string, string][] = [
      [isGymWorkout ? 'Ejercicios completados' : 'Completadas', isGymWorkout ? `${sessionVolume?.exercisesCount || completedIds.length} ejercicios` : String(completedIds.length)],
      ...(skippedIds.length > 0 ? [['Omitidas', String(skippedIds.length)] as [string, string]] : []),
      ['Tiempo empleado', formatDuration(elapsedMins)],
      ...(sessionVolume && sessionVolume.totalVolumeKg > 0 ? [['Volumen levantado', `${sessionVolume.totalVolumeKg.toLocaleString('es-ES')} kg`] as [string, string]] : []),
      ...(sessionVolume && sessionVolume.setsCount > 0 ? [['Series registradas', `${sessionVolume.setsCount} series`] as [string, string]] : []),
      ['Estimado', formatDuration(totalEstimatedMins)],
    ];
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 99999, background: screenBackground,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 'max(env(safe-area-inset-top), 24px) 24px max(env(safe-area-inset-bottom), 24px)', boxSizing: 'border-box', textAlign: 'center', overflowY: 'auto'
        }}
      >
        <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            style={{ width: 72, height: 72, borderRadius: '50%', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isGymWorkout ? '#ff9500' : '#30d158' }}
          >
            {isGymWorkout ? <Flame size={40} color="#000" strokeWidth={2.2} aria-hidden="true" /> : <CheckCircle size={40} color="#000" strokeWidth={2} aria-hidden="true" />}
          </motion.div>
          <h2 style={{ fontSize: '1.9rem', fontWeight: 700, color: primaryText, margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            {isGymWorkout ? '¡Entrenamiento completado!' : 'Lista completada'}
          </h2>
          <p style={{ fontSize: '1rem', color: rowsMuted, margin: '0 0 28px', lineHeight: 1.4 }}>
            {isGymWorkout ? `Gran sesión en ${listName}. Has completado tu rutina con éxito.` : `Has terminado ${listName}.`}
          </p>

          {/* Resumen: filas con línea fina, como una lista de ajustes; sin tarjetas de colores */}
          <dl style={{ width: '100%', margin: '0 0 24px', padding: 0 }}>
            {summary.map(([label, value], i) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '12px 4px', borderTop: i === 0 ? 'none' : `0.5px solid ${rowLine}` }}>
                <dt style={{ color: rowsMuted, fontSize: '1rem' }}>{label}</dt>
                <dd style={{ margin: 0, color: primaryText, fontSize: '1.05rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</dd>
              </div>
            ))}
          </dl>

          {runningParallelTasks.length > 0 && (
            <div style={{ width: '100%', marginBottom: 20, borderRadius: 14, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', padding: '2px 4px 2px 14px', textAlign: 'left' }}>
              {runningParallelTasks.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, borderTop: i ? `0.5px solid ${rowLine}` : 'none' }}>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: primaryText, fontSize: '0.95rem' }}>{p.title}</span>
                  <span style={{ color: rowsMuted, fontSize: '0.85rem', fontVariantNumeric: 'tabular-nums' }}>{p.secondsLeft === 0 ? 'Terminó' : `quedan ${formatDuration(Math.ceil(p.secondsLeft / 60))}`}</span>
                  <button onClick={() => handleFinishParallel(p.id)} style={{ minHeight: 44, padding: '0 12px', background: 'transparent', border: 'none', cursor: 'pointer', color: primaryText, fontWeight: 600, fontSize: '0.95rem' }}
                    aria-label={`Dar por terminada «${p.title}»`}>Ya está</button>
                </div>
              ))}
            </div>
          )}

          <InsightCard scope={['task', 'list']} />
          <motion.button
            onClick={onClose} whileTap={{ scale: 0.98 }}
            style={{ width: '100%', minHeight: 52, borderRadius: 16, border: 'none', cursor: 'pointer', background: '#30d158', color: '#000', fontWeight: 600, fontSize: '1.05rem' }}
          >
            Volver
          </motion.button>
          <button onClick={handleShare} style={{ minHeight: 44, marginTop: 4, padding: '0 14px', background: 'transparent', border: 'none', cursor: 'pointer', color: rowsMuted, fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Share size={16} aria-hidden="true" /> Compartir
          </button>
        </div>
      </motion.div>
    );
  }

  // ── PAUSA GUIADA entre tareas (opcional, por lista) ──────────────────────
  if (pause) {
    const total = pause.plannedSec + pause.adjustSec;
    const left = Math.ceil((pause.startedAt + total * 1000 - pauseNow) / 1000);
    const pr = total > 0 ? Math.min(1, Math.max(0, 1 - left / total)) : 1;
    const mm = (sec: number) => `${Math.floor(Math.abs(sec) / 60)}:${String(Math.abs(sec) % 60).padStart(2, '0')}`;
    const mutedText = isDark ? 'rgba(255,255,255,0.6)' : 'var(--text-secondary, #636366)';
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="dialog" aria-modal="true" aria-label="Pausa"
        style={{ position: 'fixed', inset: 0, zIndex: 99999, background: screenBackground, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24, boxSizing: 'border-box', textAlign: 'center' }}>
        <p style={{ margin: 0, color: mutedText, fontSize: '0.95rem' }}>Pausa</p>
        <div role="timer" aria-label={left > 0 ? `Quedan ${mm(left)}` : 'Pausa terminada'} style={{ position: 'relative', width: 232, height: 232, margin: '8px 0' }}>
          <svg viewBox="0 0 232 232" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }} aria-hidden="true">
            <circle cx="116" cy="116" r="106" fill="none" stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)'} strokeWidth="6" />
            <circle cx="116" cy="116" r="106" fill="none" stroke={listColor} strokeWidth="6" strokeLinecap="round" strokeDasharray={2 * Math.PI * 106} strokeDashoffset={2 * Math.PI * 106 * (1 - pr)} style={{ transition: 'stroke-dashoffset 0.3s linear' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3.2rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: primaryText }}>{left > 0 ? mm(left) : 'Listo'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => setPause(p => p && ({ ...p, adjustSec: p.adjustSec + 60 }))} style={{ minHeight: 44, padding: '0 18px', borderRadius: 22, border: 'none', background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', color: primaryText, fontSize: '1rem', cursor: 'pointer' }}>+ 1 min</button>
        </div>
        {pause.nextTitle && <p style={{ margin: '12px 0 0', color: mutedText, fontSize: '0.95rem', maxWidth: 320 }}>Siguiente: {pause.nextTitle}</p>}
        <div style={{ width: '100%', maxWidth: 420, marginTop: 24 }}>
          <button type="button" onClick={() => endPause(left > 0)} style={{ width: '100%', minHeight: 52, borderRadius: 16, border: 'none', cursor: 'pointer', background: '#30d158', color: '#000', fontWeight: 600, fontSize: '1.05rem' }}>
            {left > 0 ? 'Saltar pausa' : 'Seguir'}
          </button>
        </div>
      </motion.div>
    );
  }

  // ── DESCANSO entre series o antes del siguiente ejercicio ───────────────
  if (setRest) {
    const total = setRest.plannedSec + setRest.adjustSec;
    const left = Math.ceil((setRest.startedAt + total * 1000 - pauseNow) / 1000);
    const pr = total > 0 ? Math.min(1, Math.max(0, 1 - left / total)) : 1;
    const mm = (sec: number) => `${Math.floor(Math.abs(sec) / 60)}:${String(Math.abs(sec) % 60).padStart(2, '0')}`;
    const mutedText = isDark ? 'rgba(255,255,255,0.6)' : 'var(--text-secondary, #636366)';
    const fieldBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
    const restTask = tasks[setRest.taskId];
    const adjust = (delta: number) => { HapticService.selection(); setSetRest(r => r && ({ ...r, adjustSec: Math.max(-r.plannedSec, r.adjustSec + delta) })); };
    const field: React.CSSProperties = { width: 84, minHeight: 44, borderRadius: 12, border: 'none', background: fieldBg, color: primaryText, fontSize: '1.05rem', textAlign: 'center', fontVariantNumeric: 'tabular-nums' };
    const pill: React.CSSProperties = { minHeight: 44, padding: '0 18px', borderRadius: 22, border: 'none', background: fieldBg, color: primaryText, fontSize: '1rem', cursor: 'pointer', fontVariantNumeric: 'tabular-nums' };
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="dialog" aria-modal="true" aria-label="Descanso" data-testid="set-rest"
        style={{ position: 'fixed', inset: 0, zIndex: 99999, background: screenBackground, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 'max(env(safe-area-inset-top), 24px) 24px max(env(safe-area-inset-bottom), 24px)', boxSizing: 'border-box', textAlign: 'center', overflowY: 'auto' }}>
        <button type="button" onClick={() => { SoundService.stopAmbientSound(); onClose(); }} aria-label="Salir del modo secuencia" title="Salir (Esc)"
          style={{ position: 'absolute', top: 'max(env(safe-area-inset-top), 8px)', left: 16, width: 44, height: 44, borderRadius: '50%', background: 'transparent', border: 'none', cursor: 'pointer', color: mutedText, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={20} />
        </button>
        <p style={{ margin: 0, color: mutedText, fontSize: '0.95rem' }}>
          {setRest.kind === 'set' ? `Descanso · ${restTask?.title ?? ''}` : 'Descanso antes del siguiente ejercicio'}
        </p>
        <div role="timer" aria-label={left > 0 ? `Quedan ${mm(left)}` : 'Descanso terminado'} style={{ position: 'relative', width: 232, height: 232, maxHeight: '34dvh', aspectRatio: '1', margin: '8px 0' }}>
          <svg viewBox="0 0 232 232" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }} aria-hidden="true">
            <circle cx="116" cy="116" r="106" fill="none" stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)'} strokeWidth="6" />
            <circle cx="116" cy="116" r="106" fill="none" stroke="#ff9f0a" strokeWidth="6" strokeLinecap="round" strokeDasharray={2 * Math.PI * 106} strokeDashoffset={2 * Math.PI * 106 * (1 - pr)} style={{ transition: 'stroke-dashoffset 0.3s linear' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3.2rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: primaryText }}>{left > 0 ? mm(left) : 'Listo'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => adjust(-15)} style={pill} aria-label="Quitar 15 segundos">− 15 s</button>
          <button type="button" onClick={() => adjust(30)} style={pill} aria-label="Añadir 30 segundos">+ 30 s</button>
        </div>

        {/* Peso de la serie recién hecha: lo de la serie anterior ya escrito; lo de la última vez, de pista. Vacío = no se apunta. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, color: mutedText, fontSize: '0.95rem' }}>
          <span>Serie {setRest.doneSet}</span>
          <input aria-label={`Kilos de la serie ${setRest.doneSet}`} inputMode="decimal" placeholder={setRest.kgHint || 'kg'} value={setRest.kg}
            onChange={e => setSetRest(r => r && ({ ...r, kg: e.target.value }))} style={field} />
          <span aria-hidden="true">×</span>
          <input aria-label={`Repeticiones de la serie ${setRest.doneSet}`} inputMode="numeric" placeholder={setRest.repsHint || 'reps'} value={setRest.reps}
            onChange={e => setSetRest(r => r && ({ ...r, reps: e.target.value }))} style={field} />
        </div>

        <p style={{ margin: '14px 0 0', color: mutedText, fontSize: '0.95rem', maxWidth: 340 }}>
          Siguiente: <span style={{ color: primaryText, fontWeight: 600 }}>{setRest.nextLabel}</span>
        </p>
        <div style={{ width: '100%', maxWidth: 420, marginTop: 20 }}>
          <button type="button" onClick={endSetRest} style={{ width: '100%', minHeight: 52, borderRadius: 16, border: 'none', cursor: 'pointer', background: left > 0 ? fieldBg : '#30d158', color: left > 0 ? primaryText : '#000', fontWeight: 600, fontSize: '1.05rem' }}>
            {left > 0 ? 'Saltar descanso' : setRest.kind === 'set' ? `Empezar serie ${setRest.doneSet + 1}` : 'Empezar siguiente'}
          </button>
        </div>
      </motion.div>
    );
  }

  // ── DESCANSO INTERMEDIO ENTRE EJERCICIOS (isRest: true) ───────────────────
  if (currentTask?.isRest) {
    const total = Math.max(10, Math.round(initialDuration || 120));
    const left = Math.max(0, timeLeft);
    const pr = total > 0 ? Math.min(1, Math.max(0, 1 - left / total)) : 1;
    const mm = (sec: number) => `${Math.floor(Math.abs(sec) / 60)}:${String(Math.abs(sec) % 60).padStart(2, '0')}`;
    const mutedText = isDark ? 'rgba(255,255,255,0.6)' : 'var(--text-secondary, #636366)';
    const fieldBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
    const nextTask = activeTaskIds[index + 1] ? tasks[activeTaskIds[index + 1]] : null;
    const adjust = (delta: number) => {
      HapticService.selection();
      setTimeLeft(t => Math.max(0, t + delta));
      setInitialDuration(d => Math.max(d, timeLeft + delta));
    };
    const pill: React.CSSProperties = { minHeight: 44, padding: '0 18px', borderRadius: 22, border: 'none', background: fieldBg, color: primaryText, fontSize: '1rem', cursor: 'pointer', fontVariantNumeric: 'tabular-nums' };

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="dialog" aria-modal="true" aria-label="Descanso entre ejercicios"
        style={{ position: 'fixed', inset: 0, zIndex: 99999, background: screenBackground, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 'max(env(safe-area-inset-top), 24px) 24px max(env(safe-area-inset-bottom), 24px)', boxSizing: 'border-box', textAlign: 'center', overflowY: 'auto' }}>
        <button type="button" onClick={() => { restoreDocumentTitle(); SoundService.stopAmbientSound(); onClose(); }} aria-label="Salir del modo secuencia" title="Salir (Esc)"
          style={{ position: 'absolute', top: 'max(env(safe-area-inset-top), 8px)', left: 16, width: 44, height: 44, borderRadius: '50%', background: 'transparent', border: 'none', cursor: 'pointer', color: mutedText, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ff9500', fontWeight: 700, fontSize: '0.95rem' }}>
          <Timer size={20} />
          <span>Descanso entre ejercicios</span>
        </div>

        <div role="timer" aria-label={left > 0 ? `Quedan ${mm(left)}` : 'Descanso terminado'} style={{ position: 'relative', width: 232, height: 232, maxHeight: '34dvh', aspectRatio: '1', margin: '12px 0' }}>
          <svg viewBox="0 0 232 232" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }} aria-hidden="true">
            <circle cx="116" cy="116" r="106" fill="none" stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)'} strokeWidth="6" />
            <circle cx="116" cy="116" r="106" fill="none" stroke="#ff9500" strokeWidth="6" strokeLinecap="round" strokeDasharray={2 * Math.PI * 106} strokeDashoffset={2 * Math.PI * 106 * (1 - pr)} style={{ transition: 'stroke-dashoffset 0.3s linear' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3.2rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: primaryText }}>
            {left > 0 ? mm(left) : 'Listo'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => adjust(-15)} style={pill} aria-label="Quitar 15 segundos">− 15 s</button>
          <button type="button" onClick={() => adjust(30)} style={pill} aria-label="Añadir 30 segundos">+ 30 s</button>
        </div>

        {nextTask && (
          <div style={{ marginTop: 16, maxWidth: 360, background: fieldBg, padding: '12px 18px', borderRadius: 16, border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#ff9500', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>A continuación</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: primaryText }}>{nextTask.title}</div>
            {nextTask.description && (
              <div style={{ fontSize: '0.80rem', color: mutedText, marginTop: 4, lineHeight: 1.3 }}>{nextTask.description}</div>
            )}
          </div>
        )}

        <div style={{ width: '100%', maxWidth: 420, marginTop: 16 }}>
          <button
            type="button"
            onClick={() => {
              restoreDocumentTitle();
              handleCompleteTask();
            }}
            style={{
              width: '100%',
              minHeight: 52,
              borderRadius: 16,
              border: 'none',
              cursor: 'pointer',
              background: left <= 0 ? '#30d158' : fieldBg,
              color: left <= 0 ? '#000' : primaryText,
              fontWeight: 600,
              fontSize: '1.05rem'
            }}
          >
            {left <= 0 ? 'Empezar siguiente ejercicio' : 'Omitir descanso / Empezar ya'}
          </button>
        </div>
      </motion.div>
    );
  }

  // ── MAIN SCREEN ──────────────────────────────────────────────────────────
  // Una sola cosa grande (el reloj), una sola acción principal (abajo) y lo demás, plegado: sonido en la
  // barra de arriba, «+1 / +5 / +10» tras «Cambiar tiempo», «Para luego» y «Omitir» como texto.
  const muted = isDark ? 'rgba(255,255,255,0.6)' : 'var(--text-secondary, #636366)';
  const faint = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)';
  const chipBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
  const isParallelTask = Boolean(currentDurationInfo?.isParallel);
  // Texto sobre el color de la lista: negro o blanco según su luminosidad (un azul claro con letra blanca no se lee).
  const onAccent = (() => {
    const m = /^#?([0-9a-f]{6})$/i.exec(listColor || '');
    if (!m) return '#fff';
    const [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#000' : '#fff';
  })();
  const titleLength = currentTask?.title?.length ?? 0;
  const SOUND_LABELS: Record<AmbientType, string> = { off: 'Sin', rain: 'Lluvia', waves: 'Olas', binaural: 'Binaural', focus: 'Foco' };
  const addTime = (secs: number) => {
    HapticService.selection();
    if (currentTask) recordEvents([{ at: Date.now(), scope: 'task', subjectId: currentTask.id, type: 'task_extended', value: secs, planned: plannedSecs }]);
    setTimeLeft(prev => prev + secs);
    setInitialDuration(prev => Math.max(prev, (timeLeft || 0) + secs));
    if (!isActive) setIsActive(true);
  };
  const quietButton: React.CSSProperties = {
    minHeight: 44, padding: '0 14px', background: 'transparent', border: 'none', cursor: 'pointer',
    color: muted, fontSize: '0.95rem', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap'
  };
  const iconButton: React.CSSProperties = {
    width: 44, height: 44, borderRadius: '50%', background: 'transparent', border: 'none', cursor: 'pointer',
    color: muted, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          height: '100dvh', maxHeight: '100dvh',
          background: screenBackground,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: 'max(env(safe-area-inset-top), 8px) 16px max(env(safe-area-inset-bottom), 16px)',
          boxSizing: 'border-box', overflow: 'hidden', touchAction: 'manipulation'
        }}
      >
        {/* Aviso (pospuesta, terminada en segundo plano…) */}
        <AnimatePresence>
          {parallelToast && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              role="status"
              style={{
                position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 12px)', left: 16, right: 16, margin: '0 auto', width: 'fit-content', maxWidth: 'calc(100% - 32px)', zIndex: 100000,
                background: isDark ? '#2c2c2e' : '#1c1c1e', color: '#fff',
                padding: '10px 8px 10px 18px', borderRadius: 14, fontWeight: 500, fontSize: '0.9rem',
                display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.25)'
              }}
            >
              <span>{parallelToast}</span>
              <button onClick={() => setParallelToast(null)} aria-label="Cerrar aviso"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', color: '#fff', opacity: 0.7, padding: 10 }}>
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Barra superior: salir · dónde vas · sonido ── */}
        <div style={{ width: '100%', maxWidth: 520, display: 'flex', alignItems: 'center', gap: 4, minHeight: 48 }}>
          <button onClick={() => { SoundService.stopAmbientSound(); onClose(); }} style={iconButton} title="Salir (Esc)" aria-label="Salir del modo secuencia">
            <X size={20} />
          </button>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'center', lineHeight: 1.25 }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: primaryText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listName}</div>
            <div style={{ fontSize: '0.8rem', color: muted, fontVariantNumeric: 'tabular-nums' }}>
              {index + 1} de {activeTaskIds.length}
              {totalEstimatedMins > 0 && remainingEstimatedMins > 0 ? `, quedan ${formatDuration(remainingEstimatedMins)}` : ''}
            </div>
          </div>
          <button
            onClick={() => setShowSound(v => !v)}
            style={{ ...iconButton, color: ambient !== 'off' ? listColor : muted }}
            title="Sonido ambiente" aria-label={`Sonido ambiente: ${SOUND_LABELS[ambient]}`} aria-expanded={showSound}
          >
            {ambient === 'off' ? <VolumeX size={20} /> : <Headphones size={20} />}
          </button>
        </div>
        <div style={{ width: '100%', maxWidth: 520, height: 3, borderRadius: 2, background: faint, overflow: 'hidden' }} aria-hidden="true">
          <div style={{ width: `${Math.min(100, (index / Math.max(1, activeTaskIds.length)) * 100)}%`, height: '100%', background: listColor, transition: 'width 0.4s ease' }} />
        </div>

        <AnimatePresence initial={false}>
          {showSound && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              style={{ width: '100%', maxWidth: 520, overflow: 'hidden' }}
            >
              <div role="radiogroup" aria-label="Sonido ambiente" style={{ display: 'flex', gap: 4, padding: '10px 0 2px', justifyContent: 'center' }}>
                {(['off', 'rain', 'waves', 'binaural', 'focus'] as AmbientType[]).map(type => (
                  <button
                    key={type} role="radio" aria-checked={ambient === type}
                    onClick={() => { setAmbient(type); setShowSound(false); }}
                    style={{
                      minHeight: 44, padding: '0 12px', borderRadius: 22, border: 'none', cursor: 'pointer',
                      background: ambient === type ? listColor : chipBg,
                      color: ambient === type ? onAccent : primaryText, fontSize: '0.85rem', fontWeight: 500
                    }}
                  >
                    {SOUND_LABELS[type]}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Centro ── */}
        <AnimatePresence mode="wait">
          {showDurationPicker && currentTask ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'center' }}>
              <DurationPicker
                key={`picker-${currentTask.id}`}
                taskTitle={currentTask.title}
                initialMins={currentDurationInfo?.activeMinutes || 15}
                onConfirm={handleDurationConfirm}
                onSkip={handleSkipTask}
                isDark={isDark}
                listColor={listColor}
              />
            </div>
          ) : (
            <motion.div
              key={`task-${currentTask?.id}`}
              initial={{ x: 32, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -32, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              style={{ flex: 1, minHeight: 0, width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 6 }}
            >
              <h2 style={{
                fontSize: titleLength > 90 ? 'clamp(1.05rem, 2.4vh, 1.4rem)' : titleLength > 45 ? 'clamp(1.25rem, 3vh, 1.75rem)' : 'clamp(1.6rem, 3.6vh, 2.2rem)',
                display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                fontWeight: 700, lineHeight: 1.18, color: primaryText, fontFamily: 'var(--font-display)',
                letterSpacing: '-0.02em', margin: 0, wordBreak: 'break-word'
              }}>
                {currentTask?.title}
              </h2>

              {isSeries && (
                <div data-testid="set-indicator" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0 4px' }}>
                  <span style={{ fontSize: '1.05rem', fontWeight: 600, color: primaryText, fontVariantNumeric: 'tabular-nums' }}>Serie {setNumber} de {totalSets}</span>
                  <span style={{ display: 'flex', gap: 5 }} aria-hidden="true">
                    {Array.from({ length: totalSets }, (_, i) => (
                      <span key={i} style={{ width: 8, height: 8, borderRadius: 4, background: i < setNumber - 1 ? '#30d158' : i === setNumber - 1 ? listColor : faint }} />
                    ))}
                  </span>
                </div>
              )}

              {currentTask?.description && (
                <p style={{ fontSize: '0.95rem', color: muted, margin: 0, lineHeight: 1.4, maxWidth: 400, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {currentTask.description}
                </p>
              )}

              {isParallelTask && currentDurationInfo && (
                <p style={{ fontSize: '0.9rem', color: muted, margin: '2px 0 0', maxWidth: 360 }}>
                  Tarea en paralelo: {formatDuration(currentDurationInfo.activeMinutes)} tuyos y luego {formatDuration(currentDurationInfo.parallelMinutes)} sola
                </p>
              )}

              {initialDuration > 0 && (
                <div
                  role="button" tabIndex={0}
                  aria-label={isActive ? 'Pausar' : 'Reanudar'}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsActive(v => !v); } }}
                  onClick={() => setIsActive(v => !v)}
                  style={{ position: 'relative', width: ringSize, height: ringSize, margin: '14px 0 4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 1, maxHeight: '36dvh', aspectRatio: '1' }}
                  title={isActive ? 'Pausar' : 'Reanudar'}
                >
                  <svg viewBox={`0 0 ${ringSize} ${ringSize}`} style={{ transform: 'rotate(-90deg)', position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                    <circle cx={ringSize / 2} cy={ringSize / 2} r={strokeR} stroke={faint} strokeWidth="6" fill="none" />
                    <circle
                      cx={ringSize / 2} cy={ringSize / 2} r={strokeR} stroke={listColor}
                      strokeWidth="6" strokeDasharray={strokeDash} strokeDashoffset={strokeOffset} strokeLinecap="round" fill="none"
                      style={{ transition: 'stroke-dashoffset 0.5s linear' }}
                    />
                  </svg>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, gap: 6 }}>
                    <span style={{ fontSize: 'clamp(2.6rem, 6vh, 3.4rem)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: primaryText, letterSpacing: '-0.02em', lineHeight: 1 }}>
                      {formatTime(timeLeft)}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.85rem', fontWeight: 500, color: isActive ? muted : listColor }}>
                      {isActive ? <><Pause size={12} fill="currentColor" /> Pausar</> : <><Play size={12} fill="currentColor" /> Reanudar</>}
                    </span>
                  </div>
                </div>
              )}

              {initialDuration > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {/* Alargar es solo de hoy; «Cambiar duración» cambia lo que dura la tarea siempre. */}
                    <button type="button" onClick={() => setShowTimeTools(v => !v)} aria-expanded={showTimeTools} style={quietButton}
                      title="Darte más tiempo solo en esta ocasión">
                      <Plus size={15} aria-hidden="true" /> Alargar hoy
                    </button>
                    <button type="button" onClick={() => setShowDurationPicker(true)} style={quietButton}
                      title="Cambiar lo que dura esta tarea siempre">
                      <Clock size={15} aria-hidden="true" /> Cambiar duración
                    </button>
                  </div>
                  <AnimatePresence initial={false}>
                    {showTimeTools && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{ display: 'flex', gap: 8, padding: '2px 0 4px', justifyContent: 'center' }}>
                          {[1, 5, 10].map(m => (
                            <button key={m} type="button" onClick={() => addTime(m * 60)} title={`Añadir ${m} ${m === 1 ? 'minuto' : 'minutos'} solo hoy`}
                              style={{ minHeight: 44, padding: '0 16px', borderRadius: 22, border: 'none', background: chipBg, color: primaryText, fontSize: '0.95rem', fontWeight: 500, cursor: 'pointer', fontVariantNumeric: 'tabular-nums' }}>
                              + {m} min
                            </button>
                          ))}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: muted, paddingBottom: 4 }}>Solo esta vez: la tarea sigue durando lo mismo.</div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── En segundo plano: lo que sigue corriendo, con control para darlo por terminado ── */}
        {runningParallelTasks.length > 0 && !showDurationPicker && (
          <div style={{ width: '100%', maxWidth: 520, marginBottom: 8, borderRadius: 14, background: chipBg, padding: '4px 4px 4px 14px' }} aria-label="En segundo plano">
            {runningParallelTasks.map((pt, i) => (
              <div key={pt.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, borderTop: i ? `0.5px solid ${faint}` : 'none' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.9rem', color: primaryText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pt.title}</div>
                  <div style={{ height: 2, borderRadius: 1, background: faint, marginTop: 4 }} aria-hidden="true">
                    <div style={{ width: `${Math.min(100, ((pt.totalSeconds - pt.secondsLeft) / Math.max(1, pt.totalSeconds)) * 100)}%`, height: '100%', background: listColor, borderRadius: 1 }} />
                  </div>
                </div>
                <span style={{ fontSize: '0.85rem', color: muted, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{pt.secondsLeft === 0 ? 'Terminó' : formatDuration(Math.ceil(pt.secondsLeft / 60))}</span>
                <button onClick={() => handleFinishParallel(pt.id)} style={{ ...quietButton, color: primaryText, fontWeight: 600, padding: '0 12px' }} aria-label={`Dar por terminada «${pt.title}»`}>
                  Ya está
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Acciones: una principal, dos discretas ── */}
        {!showDurationPicker && (
          <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {isParallelTask ? (
              <motion.button
                onClick={handleStartParallelAndNext} whileTap={{ scale: 0.98 }}
                style={{ width: '100%', minHeight: 52, borderRadius: 16, border: 'none', cursor: 'pointer', background: listColor, color: onAccent, fontWeight: 600, fontSize: '1.05rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <Zap size={18} fill="currentColor" aria-hidden="true" /> Poner en marcha y seguir
              </motion.button>
            ) : (
              <motion.button
                onClick={isSeries ? handleSetDone : handleCompleteTask} whileTap={{ scale: 0.98 }}
                style={{ width: '100%', minHeight: 52, borderRadius: 16, border: 'none', cursor: 'pointer', background: '#30d158', color: '#000', fontWeight: 600, fontSize: '1.05rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <CheckCircle size={20} aria-hidden="true" /> {isSeries ? `Serie ${setNumber} hecha` : 'Completar'}
              </motion.button>
            )}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
              {isParallelTask && (
                <button onClick={handleCompleteTask} style={quietButton} title="Marcarla como hecha sin dejarla en segundo plano">
                  <CheckCircle size={16} aria-hidden="true" /> Completar
                </button>
              )}
              <button onClick={handlePostponeTask} style={quietButton} title="Mover esta tarea al final de la lista" aria-label="Dejar para luego">
                <Clock size={16} aria-hidden="true" /> Para luego
              </button>
              <button onClick={handleSkipTask} style={quietButton} title="Pasar a la siguiente sin marcarla" aria-label="Omitir tarea">
                <SkipForward size={16} aria-hidden="true" /> Omitir
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
