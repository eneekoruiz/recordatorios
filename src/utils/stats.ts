import type { TaskItem } from '../models/Task';

// Estadísticas reales a partir de lo que la persona ha completado (nada inventado).
// Un recordatorio puede aportar varias finalizaciones (las rutinas guardan su historial) y una sola
// si es puntual; las marcas casi simultáneas de un mismo recordatorio se cuentan una vez.

const DAY_MS = 86_400_000;

const toMs = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? new Date(v).getTime() : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Marcas de tiempo (ms) de cada finalización de un recordatorio, sin duplicados. */
export function completionTimestamps(task: TaskItem): number[] {
  if (task.deleted_at) return [];
  const stamps = new Set<number>();
  for (const h of task.completionHistory || []) {
    const ms = toMs(h);
    if (ms !== null) stamps.add(ms);
  }
  const done = task.status === 'completed' ? toMs(task.completed_at) : null;
  if (done !== null && ![...stamps].some((s) => Math.abs(s - done) < 2000)) stamps.add(done);
  return [...stamps];
}

export const startOfDay = (ms: number): number => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const dayKey = (ms: number): number => startOfDay(ms);

/** Finalizaciones por día, de más antiguo a hoy (por defecto los últimos 7 días). */
export function completionsByDay(tasks: TaskItem[], days = 7, now = Date.now()): { day: number; count: number }[] {
  const today = startOfDay(now);
  const counts = new Map<number, number>();
  for (const t of tasks) for (const ms of completionTimestamps(t)) counts.set(dayKey(ms), (counts.get(dayKey(ms)) || 0) + 1);
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(today);
    day.setDate(day.getDate() - (days - 1 - i));
    return { day: day.getTime(), count: counts.get(day.getTime()) || 0 };
  });
}

/** Días seguidos con al menos una finalización. Hoy sin actividad todavía no rompe la racha de ayer. */
export function currentStreak(tasks: TaskItem[], now = Date.now()): number {
  const active = new Set<number>();
  for (const t of tasks) for (const ms of completionTimestamps(t)) active.add(dayKey(ms));
  const cursor = new Date(startOfDay(now));
  if (!active.has(cursor.getTime())) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (active.has(cursor.getTime())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * Éxito de los últimos 7 días: completadas frente a completadas + las que vencían en esos días y siguen
 * sin hacer. Null si no había nada que medir.
 */
export function weeklySuccess(tasks: TaskItem[], now = Date.now()): { rate: number | null; done: number; missed: number } {
  const from = startOfDay(now) - 6 * DAY_MS;
  const to = startOfDay(now) + DAY_MS;
  const done = completionsByDay(tasks, 7, now).reduce((s, d) => s + d.count, 0);
  const missed = tasks.filter((t) => {
    if (t.deleted_at || t.status === 'completed' || !t.dueDate) return false;
    const due = toMs(t.dueDate);
    return due !== null && due >= from && due < to && due <= now;
  }).length;
  const total = done + missed;
  return { rate: total === 0 ? null : Math.round((done / total) * 100), done, missed };
}

export function totals(tasks: TaskItem[]): { completed: number; pending: number } {
  let completed = 0;
  let pending = 0;
  for (const t of tasks) {
    if (t.deleted_at) continue;
    completed += completionTimestamps(t).length;
    if (t.status !== 'completed') pending++;
  }
  return { completed, pending };
}
