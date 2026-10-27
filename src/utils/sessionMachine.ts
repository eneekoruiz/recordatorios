import type { PlannedExercise, SessionState, SetLog, TrainingDay, TrainingSessionLog, PersonalRecord } from '../models/Training';
import { alternativesFor, getExercise } from '../data/exerciseLibrary';
import { detectPRs, tonnage } from './strength';

/**
 * Máquina de estados de una sesión de entrenamiento. Funciones puras: cada acción lleva su `now`, así se
 * prueba sin relojes y la sesión puede guardarse y retomarse tal cual.
 *
 *   READY ──START──▶ IN_SET ──LOG_SET──▶ RESTING ──REST_DONE / SKIP_REST──▶ IN_SET (siguiente serie)
 *                      │                                                       ▲
 *                      ├─ última serie del ejercicio ▶ EXERCISE_TRANSITION ────┘ (primer set del siguiente)
 *                      └─ última serie del último ejercicio ▶ COMPLETED
 *
 * El descanso no avanza solo: al llegar a cero la interfaz avisa y espera al usuario (REST_DONE), y se mide
 * lo que de verdad descansó. Eso es lo que alimenta la detección de patrones.
 */
export type SessionAction =
  | { type: 'START'; now: number }
  | { type: 'LOG_SET'; now: number; weightKg: number; reps: number; rir?: number }
  | { type: 'ADJUST_REST'; deltaSec: number }
  | { type: 'REST_DONE'; now: number }
  | { type: 'SKIP_REST'; now: number }
  | { type: 'SWAP_EXERCISE'; exerciseId: string }
  | { type: 'FINISH'; now: number }
  | { type: 'SET_NOTES'; notes: string };

export function createSession(routineId: string, routineName: string, day: TrainingDay, now: number): SessionState {
  return {
    status: 'READY', routineId, routineName, day, startedAt: now,
    exerciseIndex: 0, setIndex: 0, setStartedAt: null,
    restStartedAt: null, restPlannedSec: 0, restAdjustSec: 0,
    sets: [], notes: '', endedAt: null,
  };
}

export const currentExercise = (s: SessionState): PlannedExercise | undefined => s.day.exercises[s.exerciseIndex];

/** Segundos de descanso que quedan (negativo si ya pasó). */
export function restRemainingSec(s: SessionState, now: number): number {
  if (s.restStartedAt === null) return 0;
  return Math.ceil((s.restStartedAt + (s.restPlannedSec + s.restAdjustSec) * 1000 - now) / 1000);
}

/** Cierra el descanso en curso anotando en la última serie lo que se tomó de verdad. */
function closeRest(s: SessionState, now: number, skipped: boolean): SetLog[] {
  if (s.restStartedAt === null || s.sets.length === 0) return s.sets;
  const sets = [...s.sets];
  const last = sets[sets.length - 1];
  sets[sets.length - 1] = {
    ...last,
    restPlannedSec: s.restPlannedSec,
    restTakenSec: Math.max(0, Math.round((now - s.restStartedAt) / 1000)),
    restAdjustSec: s.restAdjustSec,
    restSkipped: skipped,
  };
  return sets;
}

function startNextSet(s: SessionState, now: number, sets: SetLog[]): SessionState {
  const ex = currentExercise(s)!;
  const lastSetOfExercise = s.setIndex >= ex.sets - 1;
  const base = { ...s, sets, restStartedAt: null, restPlannedSec: 0, restAdjustSec: 0, setStartedAt: now, status: 'IN_SET' as const };
  return lastSetOfExercise
    ? { ...base, exerciseIndex: s.exerciseIndex + 1, setIndex: 0 }
    : { ...base, setIndex: s.setIndex + 1 };
}

export function reduceSession(s: SessionState, a: SessionAction): SessionState {
  switch (a.type) {
    case 'START':
      return s.status === 'READY' && s.day.exercises.length > 0 ? { ...s, status: 'IN_SET', startedAt: a.now, setStartedAt: a.now } : s;

    case 'LOG_SET': {
      if (s.status !== 'IN_SET') return s;
      const ex = currentExercise(s);
      if (!ex) return s;
      const log: SetLog = {
        exerciseInstanceId: ex.id, exerciseId: ex.exerciseId, exerciseName: ex.name, setIndex: s.setIndex,
        weightKg: Math.max(0, a.weightKg), reps: Math.max(0, Math.round(a.reps)), rir: a.rir,
        startedAt: s.setStartedAt ?? a.now, completedAt: a.now,
      };
      const sets = [...s.sets, log];
      const moreSets = s.setIndex < ex.sets - 1;
      const moreExercises = s.exerciseIndex < s.day.exercises.length - 1;
      if (moreSets) return { ...s, sets, status: 'RESTING', restStartedAt: a.now, restPlannedSec: ex.restSec, restAdjustSec: 0, setStartedAt: null };
      if (moreExercises) return { ...s, sets, status: 'EXERCISE_TRANSITION', restStartedAt: a.now, restPlannedSec: ex.transitionRestSec, restAdjustSec: 0, setStartedAt: null };
      return { ...s, sets, status: 'COMPLETED', endedAt: a.now, setStartedAt: null };
    }

    case 'ADJUST_REST':
      if (s.status !== 'RESTING' && s.status !== 'EXERCISE_TRANSITION') return s;
      // Nunca se puede dejar el descanso programado por debajo de cero segundos.
      return { ...s, restAdjustSec: Math.max(-s.restPlannedSec, s.restAdjustSec + a.deltaSec) };

    case 'REST_DONE':
    case 'SKIP_REST': {
      if (s.status !== 'RESTING' && s.status !== 'EXERCISE_TRANSITION') return s;
      return startNextSet(s, a.now, closeRest(s, a.now, a.type === 'SKIP_REST'));
    }

    case 'SWAP_EXERCISE': {
      // Sustituir el ejercicio actual (máquina ocupada, molestia): conserva series y descansos programados.
      const ex = currentExercise(s);
      const def = getExercise(a.exerciseId);
      if (!ex || !def || (s.status !== 'IN_SET' && s.status !== 'READY')) return s;
      const exercises = s.day.exercises.map((e, i) => (i === s.exerciseIndex ? { ...e, exerciseId: def.id, name: def.name } : e));
      return { ...s, day: { ...s.day, exercises } };
    }

    case 'FINISH':
      return s.status === 'COMPLETED' ? s : { ...s, status: 'COMPLETED', endedAt: a.now, sets: s.status === 'RESTING' || s.status === 'EXERCISE_TRANSITION' ? closeRest(s, a.now, true) : s.sets, setStartedAt: null };

    case 'SET_NOTES':
      return { ...s, notes: a.notes };
  }
}

/** Ejercicios sustitutos para el actual. */
export const swapOptions = (s: SessionState) => {
  const ex = currentExercise(s);
  return ex ? alternativesFor(ex.exerciseId, ex.alternativeIds) : [];
};

/** Registro final de la sesión: tonelaje, duración y récords respecto al historial anterior. */
export function finalizeSession(s: SessionState, history: TrainingSessionLog[], id: string): TrainingSessionLog {
  const endedAt = s.endedAt ?? Date.now();
  const prs: PersonalRecord[] = detectPRs(s.sets, history);
  return {
    id, routineId: s.routineId, routineName: s.routineName, dayId: s.day.id, dayName: s.day.name,
    startedAt: s.startedAt, endedAt, sets: s.sets, notes: s.notes.trim() || undefined,
    tonnageKg: tonnage(s.sets), durationSec: Math.max(1, Math.round((endedAt - s.startedAt) / 1000)), prs,
  };
}
