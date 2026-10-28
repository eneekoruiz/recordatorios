import type { TaskItem, TaskWeightLog } from '../models/Task';

/**
 * Ejercicios por series («Press de banca 0/4»): en el modo «Empezar» se hacen serie a serie, con el
 * descanso de la tarea entre series. Un contador grande («Abs 50», «Beber agua 10») no son series:
 * se completa de una vez.
 */
export const MAX_SERIES = 12;
export const DEFAULT_SET_REST_SEC = 90;

export const isSeriesTask = (task?: TaskItem | null): boolean =>
  Boolean(task && task.targetCount && task.targetCount > 1 && task.targetCount <= MAX_SERIES);

/**
 * Series ya hechas en este periodo. `currentCount` se queda en el total tras completar (y no se
 * pone a cero hasta la siguiente marca), así que si se tocó en otro periodo cuenta como cero.
 */
export function seriesDone(task: TaskItem, isSamePeriod: (updatedAt: string) => boolean): number {
  const count = task.currentCount || 0;
  if (count <= 0 || !task.updated_at) return 0;
  if (!isSamePeriod(task.updated_at)) return 0;
  return Math.min(count, task.targetCount || count);
}

export const setRestSeconds = (task?: TaskItem | null) =>
  Math.max(10, Math.round(task?.restDuration || DEFAULT_SET_REST_SEC));

/** Segundos de trabajo de una serie: la duración de la tarea es por serie (3 min de press = cada serie). */
export const setWorkSeconds = (task?: TaskItem | null) =>
  Math.max(10, Math.round((task?.duration && task.duration > 0 ? task.duration : 1) * 60));

/**
 * Qué proponer al apuntar el peso de una serie:
 * - `value`: lo de la serie anterior de hoy (casi siempre se repite), ya escrito.
 * - `hint`: lo de esta misma serie la última vez que se entrenó, solo como pista (no se guarda si no se escribe).
 */
export function setLogProposal(task: TaskItem, setNumber: number, now: number = Date.now()): { value: TaskWeightLog | null; hint: TaskWeightLog | null } {
  const today = new Date(now).toDateString();
  const logs = task.weightLogs || [];
  const isToday = (l: TaskWeightLog) => Boolean(l.date && new Date(l.date).toDateString() === today);
  const todays = logs.filter(isToday);
  const value = todays.length ? todays[todays.length - 1] : null;
  const before = logs.filter(l => !isToday(l));
  let hint: TaskWeightLog | null = null;
  for (let i = before.length - 1; i >= 0; i--) if (before[i].set === setNumber) { hint = before[i]; break; }
  return { value, hint };
}
