import type { MuscleGroup, PersonalRecord, PlannedExercise, SetLog, TrainingDay, TrainingSessionLog } from '../models/Training';
import { getExercise } from '../data/exerciseLibrary';

/** 1RM estimado (Epley). Con una sola repetición es el propio peso. */
export function estimate1RM(weightKg: number, reps: number): number {
  if (!(weightKg > 0) || !(reps > 0)) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

/** Tonelaje: suma de peso × repeticiones. */
export function tonnage(sets: Pick<SetLog, 'weightKg' | 'reps'>[]): number {
  return Math.round(sets.reduce((sum, s) => sum + (s.weightKg > 0 ? s.weightKg * s.reps : 0), 0));
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Mejores marcas históricas por ejercicio (1RM estimado y peso máximo). */
export function bestMarks(history: TrainingSessionLog[]): Map<string, { e1rm: number; weight: number }> {
  const best = new Map<string, { e1rm: number; weight: number }>();
  for (const session of history) {
    for (const s of session.sets) {
      const cur = best.get(s.exerciseId) ?? { e1rm: 0, weight: 0 };
      best.set(s.exerciseId, {
        e1rm: Math.max(cur.e1rm, estimate1RM(s.weightKg, s.reps)),
        weight: Math.max(cur.weight, s.weightKg),
      });
    }
  }
  return best;
}

/** Récords que bate una sesión respecto a lo anterior. Sin historial previo no hay «récord» que celebrar. */
export function detectPRs(sets: SetLog[], history: TrainingSessionLog[]): PersonalRecord[] {
  const before = bestMarks(history);
  const prs: PersonalRecord[] = [];
  const byExercise = new Map<string, SetLog[]>();
  sets.forEach((s) => byExercise.set(s.exerciseId, [...(byExercise.get(s.exerciseId) ?? []), s]));
  for (const [exerciseId, list] of byExercise) {
    const prev = before.get(exerciseId);
    if (!prev) continue;
    const name = list[0].exerciseName;
    const e1rm = Math.max(...list.map((s) => estimate1RM(s.weightKg, s.reps)));
    const weight = Math.max(...list.map((s) => s.weightKg));
    if (weight > prev.weight) prs.push({ exerciseId, exerciseName: name, kind: 'weight', value: weight, previous: prev.weight });
    else if (e1rm > prev.e1rm + 0.05) prs.push({ exerciseId, exerciseName: name, kind: 'e1rm', value: round1(e1rm), previous: round1(prev.e1rm) });
  }
  return prs;
}

/** Lo último que se hizo en un ejercicio (la mejor serie de la última sesión en que apareció). */
export function lastPerformance(exerciseId: string, history: TrainingSessionLog[]): { weightKg: number; reps: number; sets: SetLog[]; at: number } | null {
  const sessions = [...history].sort((a, b) => b.endedAt - a.endedAt);
  for (const session of sessions) {
    const sets = session.sets.filter((s) => s.exerciseId === exerciseId);
    if (sets.length) {
      const top = sets.reduce((a, b) => (estimate1RM(b.weightKg, b.reps) > estimate1RM(a.weightKg, a.reps) ? b : a));
      return { weightKg: top.weightKg, reps: top.reps, sets, at: session.endedAt };
    }
  }
  return null;
}

/**
 * Sobrecarga progresiva: si en la última sesión se llegó al máximo del rango en todas las series y sobraba
 * margen (RIR ≥ objetivo), se sube la carga; si no se llegó al mínimo, se mantiene o baja un poco; si no,
 * se mantiene y se busca una repetición más.
 */
export function suggestNextLoad(
  planned: Pick<PlannedExercise, 'exerciseId' | 'repMin' | 'repMax' | 'sets' | 'rir'>,
  history: TrainingSessionLog[],
): { weightKg: number; reason: string } | null {
  const last = lastPerformance(planned.exerciseId, history);
  if (!last) return null;
  const def = getExercise(planned.exerciseId);
  const working = last.sets.filter((s) => s.weightKg === last.weightKg || s.weightKg >= last.weightKg * 0.9);
  const allTop = working.length >= Math.min(planned.sets, 2) && working.every((s) => s.reps >= planned.repMax);
  const targetRir = planned.rir ?? 0;
  const hadMargin = working.every((s) => s.rir === undefined || s.rir >= targetRir);
  const increment = def?.kind === 'compuesto' && (def.primary === 'cuadriceps' || def.primary === 'isquios' || def.primary === 'gluteos' || def.id === 'peso_muerto') ? 5 : def?.kind === 'aislamiento' ? 1 : 2.5;
  if (allTop && hadMargin) {
    return { weightKg: round1(last.weightKg + increment), reason: `Hiciste ${planned.repMax} repeticiones en todas las series: sube ${increment} kg.` };
  }
  if (working.some((s) => s.reps < planned.repMin)) {
    return { weightKg: round1(Math.max(0, last.weightKg - increment)), reason: `No llegaste a ${planned.repMin} repeticiones: baja ${increment} kg para recuperar el rango.` };
  }
  return { weightKg: last.weightKg, reason: `Mismo peso: busca una repetición más que la última vez.` };
}

/** Series por grupo muscular en los últimos 7 días (el principal cuenta 1 y los secundarios, 0,5). */
export function weeklyVolume(history: TrainingSessionLog[], now = Date.now()): Partial<Record<MuscleGroup, number>> {
  const from = now - 7 * 86400000;
  const out: Partial<Record<MuscleGroup, number>> = {};
  for (const session of history) {
    if (session.endedAt < from) continue;
    for (const s of session.sets) {
      const def = getExercise(s.exerciseId);
      if (!def) continue;
      out[def.primary] = (out[def.primary] ?? 0) + 1;
      def.secondary.forEach((m) => { out[m] = (out[m] ?? 0) + 0.5; });
    }
  }
  return out;
}

/**
 * Fatiga: si el 1RM estimado de al menos dos ejercicios principales baja en dos sesiones seguidas
 * (cada vez menos que en la anterior), conviene una semana de descarga.
 */
export function detectFatigue(history: TrainingSessionLog[], minExercises = 2): { exercises: string[] } | null {
  const sessions = [...history].sort((a, b) => a.endedAt - b.endedAt);
  const perExercise = new Map<string, number[]>();
  for (const session of sessions) {
    const top = new Map<string, number>();
    session.sets.forEach((s) => top.set(s.exerciseId, Math.max(top.get(s.exerciseId) ?? 0, estimate1RM(s.weightKg, s.reps))));
    top.forEach((value, id) => perExercise.set(id, [...(perExercise.get(id) ?? []), value]));
  }
  const falling: string[] = [];
  for (const [id, values] of perExercise) {
    const v = values.slice(-3);
    if (v.length === 3 && v[1] < v[0] * 0.98 && v[2] < v[1] * 0.98 && getExercise(id)?.kind !== 'aislamiento') falling.push(id);
  }
  return falling.length >= minExercises ? { exercises: falling } : null;
}

/** Día de descarga: mismas rutinas con alrededor del 60 % de las series (al menos una). */
export function applyDeload(day: TrainingDay): TrainingDay {
  return { ...day, exercises: day.exercises.map((e) => ({ ...e, sets: Math.max(1, Math.round(e.sets * 0.6)) })) };
}
