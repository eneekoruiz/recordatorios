// Calendario: qué toca cada día. Lógica pura (sin React) para poder probarla.
//  · Recordatorios con fecha, en su día; los pendientes de días pasados salen vencidos.
//  · Suscripciones con renovación automática: también sus próximas renovaciones.
//  · Rondas de rutina: las diarias cada día; las semanales en su día; la mensual, el primer
//    día semanal del mes; y la anual, el de enero (ver shared/periodicity.js). Se cuenta lo
//    que quedará pendiente ese día: lo hecho en el periodo en curso no vuelve a salir.
import type { CustomCycle, CustomList, ListSection, TaskItem } from '../models/Task';
import type { PeriodicityType } from '../../shared/periodicity.js';
import { routineRoundsOn } from '../../shared/periodicity.js';
import { getTaskPeriodicity } from './sectionRoutine';
import { getStartOfWeek, isCompletedInCurrentPeriod } from '../services/TaskService';

export interface CalendarItem {
  key: string;
  task: TaskItem;
  /** 'renewal': próxima renovación prevista de una suscripción (aún no es una tarea). */
  kind: 'dated' | 'renewal';
  /** Hora del primer aviso ("09:30"), si tiene. */
  time: string | null;
  done: boolean;
  overdue: boolean;
}

export interface CalendarRound {
  periodicity: PeriodicityType;
  pending: number;
}

export interface CalendarDay {
  items: CalendarItem[];
  rounds: CalendarRound[];
}

export interface CalendarOptions {
  /** Primer y último día (incluidos) que se calculan. */
  from: Date;
  to: Date;
  now?: Date;
  weeklyDay: number;
  lists?: CustomList[];
  sections?: ListSection[];
  cycles?: CustomCycle[];
}

const ROUND_ORDER: PeriodicityType[] = ['year', 'month', 'week', 'day'];

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-09-26" en hora local. */
export const dayKey = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const parseDayKey = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** Semanas (de lunes a domingo) que cubren el mes: 4, 5 o 6 filas, como en Calendario. */
export function monthWeeks(year: number, month: number): Date[][] {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const rows = Math.ceil((offset + daysInMonth) / 7);
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: 7 }, (_, col) => new Date(year, month, 1 - offset + row * 7 + col))
  );
}

/** Suma meses sin desbordar (31 ene + 1 mes = 28/29 feb), igual que la renovación automática. */
export function addMonthsClamped(date: Date, months: number): Date {
  const next = new Date(date);
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return next;
}

/** Hora del primer aviso a hora fija ("09:30"), o null. */
export function firstAlertTime(task: Partial<TaskItem>): string | null {
  const times = (task.alerts || [])
    .filter((a) => a?.type === 'at_time' && typeof a.time === 'string' && /^\d{1,2}:\d{2}$/.test(a.time))
    .map((a) => a.time!.padStart(5, '0'))
    .sort();
  return times[0] || null;
}

// Mismo criterio que isTaskCompleted (store) sin importar el store en una utilidad pura.
const isMarkedDone = (task: TaskItem): boolean =>
  task.targetCount && task.targetCount > 1
    ? (task.currentCount || 0) >= task.targetCount
    : task.status === 'completed' || Boolean((task as { completed_at?: string }).completed_at);

const isAutoRollover = (task: TaskItem): boolean =>
  Boolean(task.autoRollover || (task.expirationType === 'subscription' && task.dueDate));

const samePeriod = (a: Date, b: Date, periodicity: PeriodicityType): boolean => {
  if (periodicity === 'day') return dayKey(a) === dayKey(b);
  if (periodicity === 'week') return getStartOfWeek(a).getTime() === getStartOfWeek(b).getTime();
  if (periodicity === 'month') return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  return a.getFullYear() === b.getFullYear();
};

const byTimeThenTitle = (a: CalendarItem, b: CalendarItem): number => {
  // Sin hora primero (como los eventos de todo el día), luego por hora y por título.
  if (a.time !== b.time) {
    if (a.time === null) return -1;
    if (b.time === null) return 1;
    return a.time < b.time ? -1 : 1;
  }
  return (a.task.title || '').localeCompare(b.task.title || '', 'es', { sensitivity: 'base' });
};

export function buildCalendar(tasks: TaskItem[], options: CalendarOptions): Map<string, CalendarDay> {
  const now = options.now || new Date();
  const today = startOfDay(now);
  const from = startOfDay(options.from);
  const to = startOfDay(options.to);
  const days = new Map<string, CalendarDay>();
  const dayOf = (key: string): CalendarDay => {
    let day = days.get(key);
    if (!day) {
      day = { items: [], rounds: [] };
      days.set(key, day);
    }
    return day;
  };
  const inRange = (date: Date) => date >= from && date <= to;

  // Pendientes de cada ronda: ahora (periodo en curso) y en periodos futuros.
  const pendingNow: Record<PeriodicityType, number> = { day: 0, week: 0, month: 0, year: 0 };
  const pendingLater: Record<PeriodicityType, number> = { day: 0, week: 0, month: 0, year: 0 };

  for (const task of tasks) {
    if (!task || task.deleted_at) continue;

    const due = task.dueDate ? new Date(task.dueDate) : null;
    if (due && !Number.isNaN(due.getTime())) {
      const dueDay = startOfDay(due);
      const done = isMarkedDone(task);
      const time = firstAlertTime(task);
      if (inRange(dueDay)) {
        dayOf(dayKey(dueDay)).items.push({
          key: `${task.id}@${dayKey(dueDay)}`,
          task,
          kind: 'dated',
          time,
          done,
          overdue: !done && dueDay < today,
        });
      }
      if (!done && isAutoRollover(task)) {
        const step = task.subscriptionPeriod === 'yearly' ? 12 : 1;
        for (let k = 1; k <= 240; k++) {
          const next = startOfDay(addMonthsClamped(due, k * step));
          if (next > to) break;
          if (next >= from) {
            dayOf(dayKey(next)).items.push({ key: `${task.id}@${dayKey(next)}`, task, kind: 'renewal', time, done: false, overdue: false });
          }
        }
      }
    }

    if (task.categoryId === 'primeros_pasos') continue;
    const periodicity = getTaskPeriodicity(task, options.sections, options.lists);
    if (!periodicity) continue;
    const doneNow = isMarkedDone(task) || isCompletedInCurrentPeriod(task, options.cycles, options.sections, options.lists);
    // Una periódica marcada como completada (datos antiguos) no vuelve; un hábito sí.
    const doneForever = !(task.targetCount && task.targetCount > 1) && isMarkedDone(task);
    if (!doneNow) pendingNow[periodicity]++;
    if (!doneForever) pendingLater[periodicity]++;
  }

  // Rondas: solo de hoy en adelante (el pasado no se «debe»).
  const cursor = new Date(Math.max(from.getTime(), today.getTime()));
  while (cursor <= to) {
    const rounds = routineRoundsOn({ month: cursor.getMonth() + 1, day: cursor.getDate(), weekday: cursor.getDay() }, options.weeklyDay);
    for (const periodicity of ROUND_ORDER) {
      if (!rounds[periodicity]) continue;
      const pending = samePeriod(cursor, now, periodicity) ? pendingNow[periodicity] : pendingLater[periodicity];
      if (pending > 0) dayOf(dayKey(cursor)).rounds.push({ periodicity, pending });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const day of days.values()) day.items.sort(byTimeThenTitle);
  return days;
}
