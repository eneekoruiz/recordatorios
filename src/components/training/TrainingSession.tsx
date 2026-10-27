import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { X, Check, SkipForward, Repeat2, Trophy } from 'lucide-react';
import type { Routine, SessionState, TrainingDay } from '../../models/Training';
import { useTrainingStore } from '../../store/useTrainingStore';
import { createSession, currentExercise, finalizeSession, reduceSession, restRemainingSec, swapOptions } from '../../utils/sessionMachine';
import { applyDeload, estimate1RM, lastPerformance, suggestNextLoad, tonnage } from '../../utils/strength';
import { fmtDuration } from '../../utils/patternEngine';
import { HapticService } from '../../services/HapticService';
import { SoundService } from '../../services/SoundService';
import { Stepper } from './Stepper';
import './Training.css';

const fmtClock = (sec: number) => `${Math.floor(Math.abs(sec) / 60)}:${String(Math.abs(sec) % 60).padStart(2, '0')}`;
const fmtKg = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1).replace('.', ',')} kg`;

/**
 * Modo entrenamiento: una serie a la vez. Serie → descanso (cuenta atrás con +30 s / −15 s / saltar) →
 * siguiente serie, y descanso de transición entre ejercicios. Todo pasa por `reduceSession` (puro).
 */
export function TrainingSession({ routine, day, resume, onClose }: { routine: Routine; day: TrainingDay; resume?: SessionState | null; onClose: () => void }) {
  const sessions = useTrainingStore((s) => s.sessions);
  const setActive = useTrainingStore((s) => s.setActiveSession);
  const finish = useTrainingStore((s) => s.finishSession);
  const [state, dispatch] = useReducer(reduceSession, undefined, () =>
    resume ?? createSession(routine.id, routine.name, routine.deload ? applyDeload(day) : day, Date.now()));
  const [now, setNow] = useState(() => Date.now());
  const [swapOpen, setSwapOpen] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const beeped = useRef<string | null>(null);

  // La sesión se guarda en cada paso: si se cierra la app, se puede retomar.
  useEffect(() => { setActive(state.status === 'COMPLETED' ? null : state); }, [state, setActive]);
  useEffect(() => {
    if (state.status !== 'RESTING' && state.status !== 'EXERCISE_TRANSITION') return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [state.status]);

  const ex = currentExercise(state);
  const remaining = restRemainingSec(state, now);
  // Sonido y vibración una vez al llegar a cero.
  useEffect(() => {
    if ((state.status === 'RESTING' || state.status === 'EXERCISE_TRANSITION') && remaining <= 0 && beeped.current !== String(state.restStartedAt)) {
      beeped.current = String(state.restStartedAt);
      SoundService.playComplete();
      HapticService.notification('success');
    }
  }, [remaining, state.status, state.restStartedAt]);

  // Valores iniciales de la serie: lo propuesto por la sobrecarga progresiva, o lo último que se hizo.
  const exKey = ex ? `${state.exerciseIndex}-${state.setIndex}-${ex.exerciseId}` : '';
  const suggestion = useMemo(() => (ex ? suggestNextLoad(ex, sessions) : null), [ex, sessions]);
  const last = useMemo(() => (ex ? lastPerformance(ex.exerciseId, sessions) : null), [ex, sessions]);
  const previousInSession = [...state.sets].reverse().find((s) => s.exerciseInstanceId === ex?.id);
  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(0);
  const [rir, setRir] = useState<number | undefined>(undefined);
  const [inputsKey, setInputsKey] = useState('');
  if (ex && inputsKey !== exKey) {
    setInputsKey(exKey);
    setWeight(previousInSession?.weightKg ?? suggestion?.weightKg ?? last?.weightKg ?? 0);
    setReps(previousInSession?.reps ?? Math.min(ex.repMax, Math.max(ex.repMin, last?.reps ?? ex.repMin)));
    setRir(undefined);
  }

  const next = state.day.exercises[state.exerciseIndex + (state.status === 'IN_SET' ? 1 : 0)];
  const doneSets = state.sets.length;
  const totalSets = state.day.exercises.reduce((n, e) => n + e.sets, 0);

  const exit = () => { setActive(state.status === 'COMPLETED' ? null : state); onClose(); };

  // ── Resumen final ──
  if (state.status === 'COMPLETED') {
    const log = finalizeSession(state, sessions, 'preview');
    return (
      <div className="tr-screen" role="dialog" aria-modal="true" aria-label="Entrenamiento terminado">
        <div className="tr-screen-body tr-summary">
          <div className="tr-badge-done"><Check size={36} aria-hidden="true" /></div>
          <h2>Entrenamiento terminado</h2>
          <p className="tr-muted">{routine.name}, {state.day.name}</p>
          <dl className="tr-rows">
            <div><dt>Volumen</dt><dd>{log.tonnageKg.toLocaleString('es-ES')} kg</dd></div>
            <div><dt>Duración</dt><dd>{fmtDuration(log.durationSec)}</dd></div>
            <div><dt>Series</dt><dd>{state.sets.length}</dd></div>
          </dl>
          {log.prs.length > 0 && (
            <ul className="tr-prs" aria-label="Récords">
              {log.prs.map((p) => (
                <li key={p.exerciseId}><Trophy size={16} aria-hidden="true" />
                  <span>{p.exerciseName}: {p.kind === 'weight' ? `${fmtKg(p.value)} (antes ${fmtKg(p.previous)})` : `1RM estimado ${fmtKg(p.value)} (antes ${fmtKg(p.previous)})`}</span>
                </li>
              ))}
            </ul>
          )}
          <label className="tr-notes">
            <span>Notas de la sesión</span>
            <textarea value={state.notes} onChange={(e) => dispatch({ type: 'SET_NOTES', notes: e.target.value })} rows={3} placeholder="Cómo fue, molestias, sensaciones…" />
          </label>
        </div>
        <div className="tr-dock">
          <button type="button" className="tr-primary" onClick={() => { finish(state); onClose(); }}>Guardar</button>
          <button type="button" className="tr-quiet" onClick={() => { setActive(null); onClose(); }}>Descartar</button>
        </div>
      </div>
    );
  }

  const resting = state.status === 'RESTING' || state.status === 'EXERCISE_TRANSITION';
  const total = state.restPlannedSec + state.restAdjustSec;
  const progress = resting && total > 0 ? Math.min(1, Math.max(0, 1 - remaining / total)) : 0;
  const R = 104, C = 2 * Math.PI * R;

  return (
    <div className="tr-screen" role="dialog" aria-modal="true" aria-label="Entrenamiento en curso">
      <header className="tr-topbar">
        <button type="button" className="tr-icon" onClick={() => setConfirmExit(true)} aria-label="Salir del entrenamiento"><X size={20} aria-hidden="true" /></button>
        <div className="tr-topbar-title">
          <strong>{state.day.name}</strong>
          <span>{Math.min(doneSets + 1, totalSets)} de {totalSets} series{routine.deload ? ', descarga' : ''}</span>
        </div>
        <span className="tr-topbar-spacer" />
      </header>
      <div className="tr-progress" aria-hidden="true"><div style={{ width: `${(doneSets / Math.max(1, totalSets)) * 100}%` }} /></div>

      {state.status === 'READY' && (
        <div className="tr-screen-body tr-center">
          <h2>{state.day.name}</h2>
          <p className="tr-muted">{state.day.exercises.length} ejercicios, {totalSets} series{routine.deload ? ' (semana de descarga)' : ''}</p>
          <ol className="tr-plan">{state.day.exercises.map((e) => <li key={e.id}><span>{e.name}</span><span>{e.sets} × {e.repMin}–{e.repMax}</span></li>)}</ol>
          <div className="tr-dock-inline"><button type="button" className="tr-primary" onClick={() => dispatch({ type: 'START', now: Date.now() })}>Empezar</button></div>
        </div>
      )}

      {state.status === 'IN_SET' && ex && (
        <>
          <div className="tr-screen-body tr-center">
            <p className="tr-eyebrow">Serie {state.setIndex + 1} de {ex.sets}</p>
            <h2 className="tr-exercise">{ex.name}</h2>
            <p className="tr-muted">{ex.repMin}–{ex.repMax} repeticiones{ex.rir !== undefined ? `, RIR ${ex.rir}` : ''}</p>
            {last && <p className="tr-last">Última vez: {fmtKg(last.weightKg)} × {last.reps}</p>}
            {suggestion && !previousInSession && <p className="tr-hint">{suggestion.reason}</p>}
            <div className="tr-inputs">
              <Stepper label="Peso" value={weight} onChange={setWeight} step={2.5} unit="kg" decimals={1} />
              <Stepper label="Repeticiones" value={reps} onChange={setReps} step={1} />
            </div>
            <div className="tr-rir" role="radiogroup" aria-label="Repeticiones en reserva">
              <span>Te sobraban</span>
              {[0, 1, 2, 3, 4].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={rir === n} className={rir === n ? 'is-on' : ''} onClick={() => setRir(rir === n ? undefined : n)}>{n === 4 ? '4+' : n}</button>
              ))}
            </div>
            {weight > 0 && reps > 0 && <p className="tr-muted tr-e1rm">1RM estimado: {fmtKg(Math.round(estimate1RM(weight, reps) * 10) / 10)}</p>}
          </div>
          <div className="tr-dock">
            <button type="button" className="tr-primary" onClick={() => { HapticService.impact('light'); dispatch({ type: 'LOG_SET', now: Date.now(), weightKg: weight, reps, rir }); }}>
              <Check size={20} aria-hidden="true" /> Completar serie
            </button>
            <div className="tr-dock-row">
              <button type="button" className="tr-quiet" onClick={() => setSwapOpen(true)}><Repeat2 size={16} aria-hidden="true" /> Cambiar ejercicio</button>
              <button type="button" className="tr-quiet" onClick={() => dispatch({ type: 'FINISH', now: Date.now() })}>Terminar</button>
            </div>
          </div>
        </>
      )}

      {resting && (
        <>
          <div className="tr-screen-body tr-center">
            <p className="tr-eyebrow">{state.status === 'EXERCISE_TRANSITION' ? 'Cambio de ejercicio' : 'Descanso'}</p>
            <div className="tr-ring" role="timer" aria-label={`Descanso: ${remaining > 0 ? fmtClock(remaining) : 'terminado'}`}>
              <svg viewBox="0 0 232 232" aria-hidden="true">
                <circle cx="116" cy="116" r={R} className="tr-ring-track" />
                <circle cx="116" cy="116" r={R} className="tr-ring-fill" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} />
              </svg>
              <div className="tr-ring-time">{remaining > 0 ? fmtClock(remaining) : 'Listo'}</div>
            </div>
            <div className="tr-adjust">
              <button type="button" onClick={() => dispatch({ type: 'ADJUST_REST', deltaSec: -15 })}>−15 s</button>
              <button type="button" onClick={() => dispatch({ type: 'ADJUST_REST', deltaSec: 30 })}>+30 s</button>
            </div>
            {next ? (
              <p className="tr-next">Ahora: {state.status === 'EXERCISE_TRANSITION' ? `${next.name}, serie 1 de ${next.sets}` : `${ex?.name}, serie ${state.setIndex + 2} de ${ex?.sets}`}</p>
            ) : (
              <p className="tr-next">Ahora: {ex?.name}, serie {state.setIndex + 2} de {ex?.sets}</p>
            )}
          </div>
          <div className="tr-dock">
            <button type="button" className="tr-primary" onClick={() => dispatch({ type: remaining > 0 ? 'SKIP_REST' : 'REST_DONE', now: Date.now() })}>
              {remaining > 0 ? <><SkipForward size={20} aria-hidden="true" /> Saltar descanso</> : 'Empezar serie'}
            </button>
            <button type="button" className="tr-quiet" onClick={() => dispatch({ type: 'FINISH', now: Date.now() })}>Terminar entrenamiento</button>
          </div>
        </>
      )}

      {swapOpen && (
        <div className="tr-sheet-backdrop" onClick={() => setSwapOpen(false)}>
          <div className="tr-sheet" role="dialog" aria-label="Cambiar ejercicio" onClick={(e) => e.stopPropagation()}>
            <h3>Cambiar {ex?.name}</h3>
            <p className="tr-muted">Equivalentes para hoy (máquina ocupada o molestia). Se conservan series y descansos.</p>
            <ul className="tr-list">
              {swapOptions(state).map((alt) => (
                <li key={alt.id}><button type="button" onClick={() => { dispatch({ type: 'SWAP_EXERCISE', exerciseId: alt.id }); setSwapOpen(false); }}>
                  <span>{alt.name}</span><span className="tr-muted">{alt.equipment.replace('_', ' ')}</span></button></li>
              ))}
              {swapOptions(state).length === 0 && <li className="tr-muted">No hay equivalentes para este ejercicio.</li>}
            </ul>
            <button type="button" className="tr-quiet" onClick={() => setSwapOpen(false)}>Cancelar</button>
          </div>
        </div>
      )}
      {confirmExit && (
        <div className="tr-sheet-backdrop" onClick={() => setConfirmExit(false)}>
          <div className="tr-sheet" role="alertdialog" aria-label="Salir del entrenamiento" onClick={(e) => e.stopPropagation()}>
            <h3>¿Salir del entrenamiento?</h3>
            <p className="tr-muted">Puedes retomarlo después desde Entrenamiento: se guarda lo hecho hasta ahora ({state.sets.length} series, {tonnage(state.sets).toLocaleString('es-ES')} kg).</p>
            <button type="button" className="tr-primary" onClick={exit}>Salir y guardar el progreso</button>
            <button type="button" className="tr-quiet" onClick={() => { setActive(null); onClose(); }}>Descartar el entrenamiento</button>
            <button type="button" className="tr-quiet" onClick={() => setConfirmExit(false)}>Seguir entrenando</button>
          </div>
        </div>
      )}
    </div>
  );
}
