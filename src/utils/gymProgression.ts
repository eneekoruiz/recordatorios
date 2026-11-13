import type { TaskItem, TaskWeightLog } from '../models/Task';
import { getExerciseAlternatives } from './gymExercises';

/**
 * Sugerencia de carga por doble progresión (lo que hacen la mayoría de programas de fuerza):
 * con un rango de repeticiones (p. ej. 12–15), primero se suben las repeticiones con el mismo peso;
 * cuando TODAS las series de la última sesión llegan al máximo del rango, se sube el peso un salto
 * y se vuelve al mínimo. Si dos sesiones seguidas no se llega al mínimo, se baja un poco.
 *
 * Solo usa lo apuntado de verdad (peso y repeticiones por serie): sin datos no inventa un peso.
 */
export interface RepRange { min: number; max: number }

export interface LoadSuggestion {
  kind: 'first' | 'up' | 'same' | 'down';
  /** Peso propuesto (kg), si hay historial con peso. */
  weightKg?: number;
  /** Repeticiones objetivo por serie. */
  reps?: number;
  /** Explicación corta, con los datos en los que se basa. */
  reason: string;
}

export interface SessionLog {
  day: string;
  sets: TaskWeightLog[];
}

const dayKey = (iso?: string) => (iso ? new Date(iso).toDateString() : '');

/** Rango de repeticiones de la descripción («4 series de 12-15 reps», «3 × 10», «15 repeticiones»). */
export function parseRepRange(task: Pick<TaskItem, 'description' | 'title'>): RepRange | null {
  const text = `${task.description || ''} ${task.title || ''}`.toLowerCase();
  const range = text.match(/(\d{1,2})\s*(?:-|–|a)\s*(\d{1,2})\s*(?:reps?|repeticiones)/);
  if (range) {
    const a = Number(range[1]); const b = Number(range[2]);
    if (a > 0 && b >= a && b <= 50) return { min: a, max: b };
  }
  const single = text.match(/(\d{1,2})\s*(?:reps?|repeticiones)\b/);
  if (single) {
    const n = Number(single[1]);
    if (n > 0 && n <= 50) return { min: n, max: n };
  }
  return null;
}

/** Salto de peso según el tipo de ejercicio: pierna 5 kg, empujes y tirones 2,5 kg, aislamiento 1 kg. */
export function loadIncrement(title: string): number {
  const t = title.toLowerCase();
  const { category } = getExerciseAlternatives(title);
  if (['pierna', 'femoral', 'gemelos'].includes(category)) return 5;
  if (/\bpress\b|remo|jal[oó]n|dominad|peso muerto/.test(t)) return 2.5;
  if (['biceps', 'triceps', 'hombro'].includes(category) || /curl|elevaci|extensi|face pull|aperturas?/.test(t)) return 1;
  return 2.5;
}

const roundTo = (value: number, step: number) => Math.round(value / step) * step;

/** Sesiones anteriores (más reciente primero), sin la de `today`. Solo series con peso. */
export function previousSessions(task: Pick<TaskItem, 'weightLogs'>, now: number = Date.now()): SessionLog[] {
  const today = new Date(now).toDateString();
  const byDay = new Map<string, TaskWeightLog[]>();
  for (const log of task.weightLogs || []) {
    if (!log.date || !(log.weightKg > 0)) continue;
    const day = dayKey(log.date);
    if (day === today) continue;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(log);
  }
  return [...byDay.entries()]
    .map(([day, sets]) => ({ day, sets: [...sets].sort((a, b) => a.set - b.set) }))
    .sort((a, b) => new Date(b.sets[0].date!).getTime() - new Date(a.sets[0].date!).getTime());
}

/** Lo que se hizo en esa serie la última vez («40 × 12»), para la columna «Anterior». */
export function previousForSet(task: Pick<TaskItem, 'weightLogs'>, setNumber: number, now: number = Date.now()): TaskWeightLog | null {
  const [last] = previousSessions(task, now);
  if (!last) return null;
  return last.sets.find(s => s.set === setNumber) ?? last.sets[last.sets.length - 1] ?? null;
}

const formatKg = (kg: number) => `${String(Math.round(kg * 10) / 10).replace('.', ',')} kg`;

export function suggestLoad(task: Pick<TaskItem, 'title' | 'description' | 'weightLogs' | 'targetCount'>, now: number = Date.now()): LoadSuggestion {
  const range = parseRepRange(task);
  const sessions = previousSessions(task, now);
  const [last, before] = sessions;
  if (!last) {
    return { kind: 'first', reps: range?.min, reason: 'Primera vez: elige un peso con el que llegues justo a las repeticiones.' };
  }
  // Peso de trabajo: el más usado en la última sesión (a igualdad, el mayor).
  const counts = new Map<number, number>();
  last.sets.forEach(s => counts.set(s.weightKg, (counts.get(s.weightKg) || 0) + 1));
  const workWeight = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
  const workSets = last.sets.filter(s => s.weightKg === workWeight);
  const reps = workSets.map(s => s.reps).filter((r): r is number => typeof r === 'number' && r > 0);
  const repsText = reps.join('·');
  const inc = loadIncrement(task.title);
  const expectedSets = task.targetCount && task.targetCount > 1 ? task.targetCount : workSets.length;

  if (!range || reps.length === 0) {
    return { kind: 'same', weightKg: workWeight, reason: `La última vez: ${formatKg(workWeight)}. Repite el peso.` };
  }
  const completeSession = workSets.length >= expectedSets && reps.length === workSets.length;
  if (completeSession && reps.every(r => r >= range.max)) {
    const next = roundTo(workWeight + inc, 0.5);
    return { kind: 'up', weightKg: next, reps: range.min, reason: `La última vez ${repsText} con ${formatKg(workWeight)}: todas al máximo, sube a ${formatKg(next)}.` };
  }
  const belowMin = (sets: TaskWeightLog[], weight: number) => sets.some(s => s.weightKg === weight && typeof s.reps === 'number' && s.reps < range.min);
  if (belowMin(last.sets, workWeight) && before && belowMin(before.sets, workWeight)) {
    const next = Math.max(inc, roundTo(workWeight * 0.9, inc >= 2.5 ? 2.5 : 0.5));
    return { kind: 'down', weightKg: next, reps: range.min, reason: `Dos sesiones sin llegar a ${range.min} con ${formatKg(workWeight)}: baja a ${formatKg(next)}.` };
  }
  const lowest = Math.min(...reps);
  const target = Math.min(range.max, Math.max(range.min, lowest + 1));
  return { kind: 'same', weightKg: workWeight, reps: target, reason: `La última vez ${repsText} con ${formatKg(workWeight)}: mantén el peso e intenta ${target} en todas.` };
}
