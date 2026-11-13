import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Minus, Plus, TrendingDown, TrendingUp, Equal, Trophy, X } from 'lucide-react';
import { undoSetKeepingDataSafe } from '../../utils/gymUndo';
import { useAppStore } from '../../store/useAppStore';
import type { TaskItem, TaskWeightLog } from '../../models/Task';
import { HapticService } from '../../services/HapticService';
import { SoundService } from '../../services/SoundService';
import { NotificationService } from '../../services/NotificationService';
import { isCompletedInCurrentPeriod, matchesPeriod } from '../../services/TaskService';
import { getEffectiveCycleId } from '../../utils/sectionRoutine';
import { isSeriesTask, seriesDone, setRestSeconds, formatRestSeconds } from '../../utils/seriesTasks';
import { previousForSet, previousSessions, suggestLoad, parseRepRange } from '../../utils/gymProgression';
import './gym-session.css';

interface GymSessionProps {
  taskIds: string[];
  title: string;
  onClose: () => void;
}

interface Rest { endsAt: number; total: number; next: string }

const DEFAULT_TRANSITION_SEC = 120;
const fmtClock = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
};
const fmtKg = (kg: number) => String(Math.round(kg * 10) / 10).replace('.', ',');
const parseNum = (v: string) => { const n = parseFloat(v.replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : null; };
const isToday = (iso?: string) => Boolean(iso && new Date(iso).toDateString() === new Date().toDateString());
const e1rm = (kg: number, reps: number) => kg * (1 + reps / 30);
// Reloj fuera del render (en manejadores de eventos).
const clockNow = () => Date.now();
const nowIso = () => new Date().toISOString();

/**
 * Entreno del día, al estilo de las apps de gimnasio: cada ejercicio con su tabla de series
 * (Serie · Anterior · kg · Reps · ✓). Las series se marcan en orden (solo la siguiente; se deshace
 * la última), al marcar arranca el descanso en la barra de abajo y los kg y reps vienen propuestos
 * con la sugerencia de carga (lo de la última vez y si toca subir). Al terminar, un resumen.
 */
export function GymSession({ taskIds, title, onClose }: GymSessionProps) {
  const { tasks, toggleTask, updateTask, listSections, lists, cycles } = useAppStore();
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [rest, setRest] = useState<Rest | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { kg?: string; reps?: string }>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const notifiedRef = useRef<number | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), rest ? 250 : 1000);
    return () => window.clearInterval(id);
  }, [rest]);

  const items = useMemo(() => taskIds.map(id => tasks[id]).filter((t): t is TaskItem => Boolean(t && !t.deleted_at)), [taskIds, tasks]);
  const exercises = useMemo(() => items.filter(t => !t.isRest), [items]);

  const doneSetsOf = useCallback((task: TaskItem) => seriesDone(task, (updatedAt) =>
    matchesPeriod([updatedAt], getEffectiveCycleId(task, listSections, lists) || 'cycle_day', new Date(), cycles)
  ), [listSections, lists, cycles]);
  const isDone = useCallback((task: TaskItem) => (
    isSeriesTask(task) ? doneSetsOf(task) >= (task.targetCount || 1) : isCompletedInCurrentPeriod(task, cycles, listSections, lists)
  ), [doneSetsOf, cycles, listSections, lists]);

  // El ejercicio abierto: el elegido o, si no, el primero con series sin terminar.
  const activeId = openId ?? exercises.find(t => isSeriesTask(t) && !isDone(t))?.id ?? null;

  // ── Descanso ──────────────────────────────────────────────────────────
  const restLeft = rest ? Math.ceil((rest.endsAt - now) / 1000) : 0;
  useEffect(() => {
    if (!rest) return;
    const ms = rest.endsAt - Date.now();
    const done = window.setTimeout(() => {
      if (notifiedRef.current === rest.endsAt) return;
      notifiedRef.current = rest.endsAt;
      SoundService.playComplete();
      HapticService.notification('success');
      // Un aviso por descanso, solo en segundo plano y si llega a tiempo (bloqueado, iOS para los temporizadores).
      if (document.hidden && Date.now() - rest.endsAt < 5000) {
        try {
          NotificationService.getInstance().show('Descanso terminado', { body: `Siguiente: ${rest.next}`, tag: 'gym-rest', icon: '/icons/icon-192.png' });
        } catch { /* sin permiso */ }
      }
    }, Math.max(0, ms));
    const hide = window.setTimeout(() => setRest(r => (r && r.endsAt === rest.endsAt ? null : r)), Math.max(0, ms) + 4000);
    return () => { window.clearTimeout(done); window.clearTimeout(hide); };
  }, [rest]);

  const startRest = (seconds: number, next: string) => {
    const start = clockNow();
    const endsAt = start + seconds * 1000;
    setNow(start);
    setRest({ endsAt, total: seconds, next });
  };
  const adjustRest = (delta: number) => {
    HapticService.selection();
    const at = clockNow();
    setRest(r => (r ? { ...r, endsAt: Math.max(at + 1000, r.endsAt + delta * 1000), total: Math.max(1, r.total + delta) } : r));
  };

  /** Descanso tras el último set de un ejercicio: el de la fila de descanso que lo sigue, o 2 min. */
  const transitionAfter = (taskId: string): { seconds: number; next?: TaskItem } => {
    const i = items.findIndex(t => t.id === taskId);
    let seconds = DEFAULT_TRANSITION_SEC;
    for (let j = i + 1; j < items.length; j++) {
      const t = items[j];
      if (t.isRest) { seconds = Math.round((t.duration || 2) * 60); continue; }
      if (!isDone(t)) return { seconds, next: t };
    }
    return { seconds };
  };

  // ── Series ────────────────────────────────────────────────────────────
  const key = (taskId: string, set: number) => `${taskId}:${set}`;
  const fieldValues = (task: TaskItem, set: number) => {
    const draft = drafts[key(task.id, set)] || {};
    const todayLog = (task.weightLogs || []).find(l => l.set === set && isToday(l.date));
    if (todayLog) return { kg: draft.kg ?? fmtKg(todayLog.weightKg), reps: draft.reps ?? (todayLog.reps ? String(todayLog.reps) : '') };
    const suggestion = suggestLoad(task);
    const prev = previousForSet(task, set);
    const kg = suggestion.weightKg ?? prev?.weightKg;
    const reps = suggestion.reps ?? prev?.reps ?? parseRepRange(task)?.min;
    return { kg: draft.kg ?? (kg ? fmtKg(kg) : ''), reps: draft.reps ?? (reps ? String(reps) : '') };
  };

  const completeSet = (task: TaskItem, set: number) => {
    const total = task.targetCount || 1;
    const { kg, reps } = fieldValues(task, set);
    const weightKg = parseNum(kg);
    const repsN = parseNum(reps);
    HapticService.impact('medium');
    SoundService.playPop();
    toggleTask(task.id);
    if (weightKg || repsN) {
      const fresh = useAppStore.getState().tasks[task.id] || task;
      const log: TaskWeightLog = { set, weightKg: weightKg ?? 0, ...(repsN ? { reps: Math.round(repsN) } : {}), date: nowIso() };
      updateTask(task.id, { weightLogs: [...(fresh.weightLogs || []).filter(l => !(l.set === set && isToday(l.date))), log] });
    }
    if (set < total) {
      startRest(setRestSeconds(task), `Serie ${set + 1} · ${task.title}`);
    } else {
      const { seconds, next } = transitionAfter(task.id);
      if (next) { startRest(seconds, next.title); setOpenId(next.id); } else { setRest(null); setOpenId(null); }
    }
  };

  const undoSet = (task: TaskItem, set: number) => {
    HapticService.selection();
    void undoSetKeepingDataSafe(task.id, set, () => {
      SoundService.playUncomplete();
      toggleTask(task.id, true);
      setRest(null);
    });
  };

  const toggleSimple = (task: TaskItem) => {
    const done = isDone(task);
    HapticService.impact(done ? 'light' : 'medium');
    if (!done && task.targetCount && task.targetCount > 1) updateTask(task.id, { currentCount: task.targetCount - 1 });
    toggleTask(task.id, done ? true : undefined);
  };

  // ── Resumen ───────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let volume = 0; let setsDone = 0; let setsTotal = 0; let prevVolume = 0;
    const records: string[] = [];
    for (const t of exercises) {
      if (!isSeriesTask(t)) continue;
      setsTotal += t.targetCount || 0;
      setsDone += Math.min(doneSetsOf(t), t.targetCount || 0);
      const today = (t.weightLogs || []).filter(l => isToday(l.date));
      volume += today.reduce((sum, l) => sum + l.weightKg * (l.reps || 0), 0);
      const [last] = previousSessions(t);
      if (last && today.length) prevVolume += last.sets.reduce((sum, l) => sum + l.weightKg * (l.reps || 0), 0);
      const bestToday = today.filter(l => l.reps).sort((a, b) => e1rm(b.weightKg, b.reps!) - e1rm(a.weightKg, a.reps!))[0];
      const before = (t.weightLogs || []).filter(l => !isToday(l.date) && l.reps);
      const bestBefore = Math.max(0, ...before.map(l => e1rm(l.weightKg, l.reps!)));
      if (bestToday && before.length && e1rm(bestToday.weightKg, bestToday.reps!) > bestBefore + 0.01) {
        records.push(`${t.title}: ${fmtKg(bestToday.weightKg)} kg × ${bestToday.reps}`);
      }
    }
    return { volume, setsDone, setsTotal, prevVolume, records };
  }, [exercises, doneSetsOf]);

  const elapsed = (now - startedAt) / 1000;
  const allDone = exercises.length > 0 && exercises.every(isDone);

  if (showSummary) {
    const diff = stats.prevVolume > 0 ? Math.round(((stats.volume - stats.prevVolume) / stats.prevVolume) * 100) : null;
    return (
      <div className="gym-session" role="dialog" aria-modal="true" aria-label="Resumen del entreno">
        <div className="gym-summary">
          <span className="gym-summary-check" aria-hidden="true"><Check size={32} strokeWidth={3} /></span>
          <h2>Entreno terminado</h2>
          <p className="gym-summary-sub">{title}</p>
          <dl className="gym-summary-stats">
            <div><dt>Duración</dt><dd>{fmtClock(elapsed)}</dd></div>
            <div><dt>Series</dt><dd>{stats.setsDone} de {stats.setsTotal}</dd></div>
            <div><dt>Volumen</dt><dd>{Math.round(stats.volume).toLocaleString('es-ES')} kg</dd></div>
            {diff !== null && <div><dt>Frente a la última vez</dt><dd>{diff > 0 ? '+' : ''}{diff} %</dd></div>}
          </dl>
          {stats.records.length > 0 && (
            <section className="gym-summary-records" aria-label="Récords">
              <h3><Trophy size={15} aria-hidden="true" /> Récords de hoy</h3>
              <ul>{stats.records.map(r => <li key={r}>{r}</li>)}</ul>
            </section>
          )}
          <button type="button" className="gym-primary" onClick={onClose}>Listo</button>
        </div>
      </div>
    );
  }

  return (
    <div className="gym-session" role="dialog" aria-modal="true" aria-label={`Entreno: ${title}`}>
      <header className="gym-session-bar">
        <button type="button" className="gym-icon-btn" onClick={onClose} aria-label="Cerrar (el progreso se guarda)">
          <X size={20} />
        </button>
        <div className="gym-session-title">
          <strong>{title}</strong>
          <span aria-label={`Tiempo de entreno ${fmtClock(elapsed)}`}>{fmtClock(elapsed)} · {stats.setsDone}/{stats.setsTotal} series · {Math.round(stats.volume).toLocaleString('es-ES')} kg</span>
        </div>
        <button type="button" className={`gym-finish${allDone ? ' is-ready' : ''}`} onClick={() => { HapticService.selection(); setShowSummary(true); }}>
          Terminar
        </button>
      </header>

      <div className="gym-session-scroll">
        {exercises.map(task => {
          const done = isDone(task);
          const open = task.id === activeId;
          if (!isSeriesTask(task)) {
            return (
              <div key={task.id} className={`gym-simple${done ? ' is-done' : ''}`}>
                <span className="gym-simple-title">{task.title}</span>
                <button type="button" className={`gym-check${done ? ' is-done' : ''}`} onClick={() => toggleSimple(task)}
                  aria-pressed={done} aria-label={done ? `Desmarcar ${task.title}` : `Hecho: ${task.title}`}>
                  <Check size={18} strokeWidth={3} aria-hidden="true" />
                </button>
              </div>
            );
          }
          const total = task.targetCount || 1;
          const doneSets = Math.min(doneSetsOf(task), total);
          const suggestion = suggestLoad(task);
          const range = parseRepRange(task);
          const SuggestIcon = suggestion.kind === 'up' ? TrendingUp : suggestion.kind === 'down' ? TrendingDown : Equal;
          return (
            <section key={task.id} className={`gym-ex${open ? ' is-open' : ''}${done ? ' is-done' : ''}`} data-testid="gym-exercise">
              <button type="button" className="gym-ex-head" onClick={() => setOpenId(open ? '__none__' : task.id)} aria-expanded={open}>
                <span className="gym-ex-name">{task.title}</span>
                <span className="gym-ex-meta">
                  {doneSets}/{total}{range ? ` · ${range.min === range.max ? range.min : `${range.min}–${range.max}`} reps` : ''} · descanso {formatRestSeconds(setRestSeconds(task))}
                </span>
                <ChevronDown size={18} className="gym-ex-chevron" aria-hidden="true" />
              </button>
              {open && (
                <>
                  {!done && (
                    <p className={`gym-suggest is-${suggestion.kind}`}>
                      <SuggestIcon size={14} aria-hidden="true" /> {suggestion.reason}
                    </p>
                  )}
                  <div className="gym-table" role="table" aria-label={`Series de ${task.title}`}>
                    <div className="gym-row gym-row-head" role="row">
                      <span role="columnheader">Serie</span>
                      <span role="columnheader">Anterior</span>
                      <span role="columnheader">kg</span>
                      <span role="columnheader">Reps</span>
                      <span role="columnheader" className="sr-only">Hecha</span>
                    </div>
                    {Array.from({ length: total }, (_, i) => {
                      const set = i + 1;
                      const isDoneSet = set <= doneSets;
                      const isNext = set === doneSets + 1;
                      const prev = previousForSet(task, set);
                      const values = fieldValues(task, set);
                      const setDraft = (field: 'kg' | 'reps', value: string) =>
                        setDrafts(d => ({ ...d, [key(task.id, set)]: { ...d[key(task.id, set)], [field]: value } }));
                      return (
                        <div key={set} role="row" className={`gym-row${isDoneSet ? ' is-done' : ''}${isNext ? ' is-next' : ''}`}>
                          <span role="cell" className="gym-set-n">{set}</span>
                          <span role="cell" className="gym-prev">{prev ? `${fmtKg(prev.weightKg)} × ${prev.reps ?? '—'}` : '—'}</span>
                          <span role="cell">
                            <input className="gym-input" inputMode="decimal" enterKeyHint="next" aria-label={`Kilos de la serie ${set}`}
                              value={values.kg} placeholder="kg" disabled={!isNext && !isDoneSet}
                              onChange={e => setDraft('kg', e.target.value)} />
                          </span>
                          <span role="cell">
                            <input className="gym-input" inputMode="numeric" enterKeyHint="done" aria-label={`Repeticiones de la serie ${set}`}
                              value={values.reps} placeholder="reps" disabled={!isNext && !isDoneSet}
                              onChange={e => setDraft('reps', e.target.value)} />
                          </span>
                          <span role="cell">
                            <button type="button" className={`gym-check${isDoneSet ? ' is-done' : ''}`}
                              disabled={!isNext && !(isDoneSet && set === doneSets)}
                              onClick={() => (isDoneSet ? undoSet(task, set) : completeSet(task, set))}
                              aria-label={isDoneSet ? `Deshacer la serie ${set}` : isNext ? `Serie ${set} hecha` : `Serie ${set}: primero la ${doneSets + 1}`}>
                              <Check size={18} strokeWidth={3} aria-hidden="true" />
                            </button>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </section>
          );
        })}
        {allDone && (
          <button type="button" className="gym-primary gym-finish-all" onClick={() => setShowSummary(true)}>Ver el resumen</button>
        )}
      </div>

      {rest && (
        <div className={`gym-rest${restLeft <= 0 ? ' is-over' : ''}`} role="timer" aria-live="polite"
          aria-label={restLeft > 0 ? `Descanso: quedan ${fmtClock(restLeft)}` : 'Descanso terminado'}>
          <div className="gym-rest-progress" style={{ transform: `scaleX(${Math.min(1, Math.max(0, 1 - restLeft / rest.total))})` }} aria-hidden="true" />
          <div className="gym-rest-body">
            <div className="gym-rest-text">
              <strong>{restLeft > 0 ? fmtClock(restLeft) : 'A por ella'}</strong>
              <span>Siguiente: {rest.next}</span>
            </div>
            {restLeft > 0 && (
              <>
                <button type="button" className="gym-rest-btn" onClick={() => adjustRest(-15)} aria-label="Quitar 15 segundos"><Minus size={14} /> 15</button>
                <button type="button" className="gym-rest-btn" onClick={() => adjustRest(15)} aria-label="Añadir 15 segundos"><Plus size={14} /> 15</button>
              </>
            )}
            <button type="button" className="gym-rest-btn gym-rest-skip" onClick={() => setRest(null)}>{restLeft > 0 ? 'Saltar' : 'Cerrar'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
