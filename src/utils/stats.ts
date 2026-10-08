import type { TaskItem, CustomCycle, ListSection, CustomList } from '../models/Task';
import { isTaskCompleted } from '../store/useAppStore';
import { isCompletedInCurrentPeriod } from '../services/TaskService';
import { getEffectiveCycleId } from './sectionRoutine';

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

/** Mejor racha histórica de días consecutivos con al menos una finalización. */
export function bestStreak(tasks: TaskItem[]): number {
  const active = new Set<number>();
  for (const t of tasks) for (const ms of completionTimestamps(t)) active.add(dayKey(ms));
  if (active.size === 0) return 0;
  const sortedDays = Array.from(active).sort((a, b) => a - b);
  let best = 1;
  let current = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1]);
    prev.setDate(prev.getDate() + 1);
    if (dayKey(prev.getTime()) === sortedDays[i]) {
      current++;
      if (current > best) best = current;
    } else {
      current = 1;
    }
  }
  return best;
}

export interface TimeDistribution {
  morning: number;   // 06:00 - 11:59
  afternoon: number; // 12:00 - 19:59
  night: number;     // 20:00 - 05:59
  peakPeriod: 'morning' | 'afternoon' | 'night' | 'none';
  peakLabel: string;
}

/** Distribución de horas del día donde el usuario completa recordatorios. */
export function timeOfDayDistribution(tasks: TaskItem[]): TimeDistribution {
  let morning = 0;
  let afternoon = 0;
  let night = 0;

  for (const t of tasks) {
    for (const ms of completionTimestamps(t)) {
      const h = new Date(ms).getHours();
      if (h >= 6 && h < 12) morning++;
      else if (h >= 12 && h < 20) afternoon++;
      else night++;
    }
  }

  const max = Math.max(morning, afternoon, night);
  if (max === 0) {
    return { morning: 0, afternoon: 0, night: 0, peakPeriod: 'none', peakLabel: 'Sin datos aún' };
  }

  if (max === morning) {
    return { morning, afternoon, night, peakPeriod: 'morning', peakLabel: 'Mañanas (06:00–12:00)' };
  }
  if (max === afternoon) {
    return { morning, afternoon, night, peakPeriod: 'afternoon', peakLabel: 'Tardes (12:00–20:00)' };
  }
  return { morning, afternoon, night, peakPeriod: 'night', peakLabel: 'Noches (20:00–06:00)' };
}

export interface CycleStatItem {
  cycleId: string;
  cycleName: string;
  periodicity: 'day' | 'week' | 'month' | 'year';
  color: string;
  total: number;
  completed: number;
  pending: number;
  rate: number | null;
  completedTasks: TaskItem[];
  pendingTasks: TaskItem[];
}

export interface CyclesBreakdownResult {
  daily: CycleStatItem;
  weekly: CycleStatItem;
  monthly: CycleStatItem;
  yearly: CycleStatItem;
  allRoutinesGoal: number;
  allRoutinesCompleted: number;
  allRoutinesPending: number;
  allRoutinesRate: number | null;
}

/**
 * Desglose minucioso de tareas según su frecuencia (Diarias, Semanales, Mensuales, Anuales)
 * teniendo en cuenta el ciclo actual de cada tarea.
 */
export function calculateCyclesBreakdown(
  tasks: TaskItem[],
  cycles: CustomCycle[] = [],
  listSections: ListSection[] = [],
  lists: CustomList[] = [],
  referenceDate = new Date()
): CyclesBreakdownResult {
  const activeTasks = tasks.filter((t) => !t.deleted_at && t.categoryId !== 'primeros_pasos');

  const createItem = (
    cycleId: string,
    cycleName: string,
    periodicity: 'day' | 'week' | 'month' | 'year',
    color: string
  ): CycleStatItem => ({
    cycleId,
    cycleName,
    periodicity,
    color,
    total: 0,
    completed: 0,
    pending: 0,
    rate: null,
    completedTasks: [],
    pendingTasks: [],
  });

  const daily = createItem('cycle_day', 'Diarias', 'day', 'var(--accent-orange, #ff9500)');
  const weekly = createItem('cycle_week', 'Semanales', 'week', 'var(--accent-blue, #007aff)');
  const monthly = createItem('cycle_month', 'Mensuales', 'month', 'var(--accent-purple, #af52de)');
  const yearly = createItem('cycle_year', 'Anuales', 'year', 'var(--accent-green, #34c759)');

  for (const t of activeTasks) {
    const effId = getEffectiveCycleId(t, listSections, lists) || t.cycle_id;
    if (!effId) continue;

    let target: CycleStatItem | null = null;
    if (effId === 'cycle_day') target = daily;
    else if (effId === 'cycle_week') target = weekly;
    else if (effId === 'cycle_month') target = monthly;
    else if (effId === 'cycle_year') target = yearly;

    if (!target) continue;

    target.total++;
    const isDone = isTaskCompleted(t) || isCompletedInCurrentPeriod(t, cycles, listSections, lists, referenceDate);
    if (isDone) {
      target.completed++;
      target.completedTasks.push(t);
    } else {
      target.pending++;
      target.pendingTasks.push(t);
    }
  }

  for (const item of [daily, weekly, monthly, yearly]) {
    item.rate = item.total === 0 ? null : Math.round((item.completed / item.total) * 100);
  }

  const allRoutinesGoal = daily.total + weekly.total + monthly.total + yearly.total;
  const allRoutinesCompleted = daily.completed + weekly.completed + monthly.completed + yearly.completed;
  const allRoutinesPending = daily.pending + weekly.pending + monthly.pending + yearly.pending;
  const allRoutinesRate = allRoutinesGoal === 0 ? null : Math.round((allRoutinesCompleted / allRoutinesGoal) * 100);

  return {
    daily,
    weekly,
    monthly,
    yearly,
    allRoutinesGoal,
    allRoutinesCompleted,
    allRoutinesPending,
    allRoutinesRate,
  };
}

export interface ListStatItem {
  listId: string;
  listName: string;
  color?: string;
  total: number;
  completed: number;
  pending: number;
  rate: number;
}

/**
 * Desglose de cumplimiento por cada lista (Limpieza, Quehaceres, Compra, etc.)
 */
export function calculateListBreakdown(
  tasks: TaskItem[],
  lists: CustomList[] = []
): ListStatItem[] {
  const listMap = new Map<string, { total: number; completed: number; pending: number }>();

  for (const t of tasks) {
    if (t.deleted_at || t.categoryId === 'primeros_pasos') continue;
    const catId = t.categoryId || 'inbox';
    const entry = listMap.get(catId) || { total: 0, completed: 0, pending: 0 };
    entry.total++;
    if (isTaskCompleted(t)) entry.completed++;
    else entry.pending++;
    listMap.set(catId, entry);
  }

  const result: ListStatItem[] = [];
  for (const [listId, counts] of listMap.entries()) {
    const listObj = lists.find((l) => l.id === listId);
    const listName = listObj?.name || (listId === 'inbox' ? 'Bandeja de entrada' : listId);
    result.push({
      listId,
      listName,
      color: listObj?.color,
      total: counts.total,
      completed: counts.completed,
      pending: counts.pending,
      rate: counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0,
    });
  }

  return result.sort((a, b) => b.total - a.total);
}

export interface CycleStreaksResult {
  weeklyStreak: number;
  monthlyStreak: number;
}

/** Calcula rachas consecutivas de cumplimiento de ciclos hacia atrás (semanas y meses). */
export function calculateCycleStreaks(
  tasks: TaskItem[],
  cycles: CustomCycle[] = [],
  listSections: ListSection[] = [],
  lists: CustomList[] = [],
  now = Date.now()
): CycleStreaksResult {
  const activeTasks = tasks.filter((t) => !t.deleted_at && t.categoryId !== 'primeros_pasos');
  const weeklyTasks = activeTasks.filter((t) => {
    const effId = getEffectiveCycleId(t, listSections, lists) || t.cycle_id;
    return effId === 'cycle_week';
  });
  const monthlyTasks = activeTasks.filter((t) => {
    const effId = getEffectiveCycleId(t, listSections, lists) || t.cycle_id;
    return effId === 'cycle_month';
  });

  let weeklyStreak = 0;
  if (weeklyTasks.length > 0) {
    const curDate = new Date(now);
    for (let w = 0; w < 52; w++) {
      const checkDate = new Date(curDate);
      checkDate.setDate(checkDate.getDate() - w * 7);
      const isCompleted = weeklyTasks.every((t) =>
        isCompletedInCurrentPeriod(t, cycles, listSections, lists, checkDate)
      );
      if (isCompleted) {
        weeklyStreak++;
      } else {
        if (w === 0) continue;
        break;
      }
    }
  }

  let monthlyStreak = 0;
  if (monthlyTasks.length > 0) {
    const curDate = new Date(now);
    for (let m = 0; m < 12; m++) {
      const checkDate = new Date(curDate);
      checkDate.setDate(1);
      checkDate.setMonth(checkDate.getMonth() - m);
      const isCompleted = monthlyTasks.every((t) =>
        isCompletedInCurrentPeriod(t, cycles, listSections, lists, checkDate)
      );
      if (isCompleted) {
        monthlyStreak++;
      } else {
        if (m === 0) continue;
        break;
      }
    }
  }

  return { weeklyStreak, monthlyStreak };
}

/** Genera un informe completo de rendimiento en formato Markdown estructurado. */
export function generatePerformanceReportMarkdown(params: {
  streak: number;
  best: number;
  weekRate: number | null;
  cyclesBreakdown: CyclesBreakdownResult;
  cycleStreaks: CycleStreaksResult;
  timeDist: TimeDistribution;
  listBreakdown: ListStatItem[];
  date?: Date;
}): string {
  const d = params.date || new Date();
  const dateStr = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  const lines = [
    '# 📊 Informe de Rendimiento y Rutinas — ' + dateStr,
    '',
    '## 🏆 Constancia y Hábitos',
    '- **Racha diaria actual:** ' + params.streak + (params.streak === 1 ? ' día' : ' días') + ' consecutivos (Récord: ' + params.best + ' días)',
    '- **Racha semanal:** ' + params.cycleStreaks.weeklyStreak + ' semanas al día',
    '- **Racha mensual:** ' + params.cycleStreaks.monthlyStreak + ' meses al día',
    '- **Éxito semanal:** ' + (params.weekRate !== null ? params.weekRate + '%' : 'Sin tareas medidas'),
    '- **Momento más productivo:** ' + params.timeDist.peakLabel,
    '',
    '## 🔄 Cumplimiento por Ciclos de Frecuencia',
    '- **Diarias:** ' + params.cyclesBreakdown.daily.completed + '/' + params.cyclesBreakdown.daily.total + ' (' + (params.cyclesBreakdown.daily.rate ?? 0) + '%)',
    '- **Semanales:** ' + params.cyclesBreakdown.weekly.completed + '/' + params.cyclesBreakdown.weekly.total + ' (' + (params.cyclesBreakdown.weekly.rate ?? 0) + '%)',
    '- **Mensuales:** ' + params.cyclesBreakdown.monthly.completed + '/' + params.cyclesBreakdown.monthly.total + ' (' + (params.cyclesBreakdown.monthly.rate ?? 0) + '%)',
    '- **Anuales:** ' + params.cyclesBreakdown.yearly.completed + '/' + params.cyclesBreakdown.yearly.total + ' (' + (params.cyclesBreakdown.yearly.rate ?? 0) + '%)',
    '- **Promedio global de rutinas:** ' + (params.cyclesBreakdown.allRoutinesRate ?? 0) + '%',
    '',
    '## 📋 Desglose por Listas Principales',
  ];

  for (const list of params.listBreakdown.slice(0, 6)) {
    lines.push('- **' + list.listName + ':** ' + list.completed + '/' + list.total + ' hechas (' + list.rate + '%)');
  }

  lines.push('', '_Generado automáticamente desde Recordatorios Apple Style._');
  return lines.join('\n');
}
