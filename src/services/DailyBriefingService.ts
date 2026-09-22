// Resumen del día: una sola fuente de verdad para el saludo de bienvenida y la
// tarjeta de resumen. Devuelve frases ya redactadas (nada de "1 tarea(s)").
import type { TaskItem, CustomCycle, ListSection, CustomList } from '../models/Task';
import { isTaskCompleted } from '../store/useAppStore';
import { calculateHabitStreak, isCompletedInCurrentPeriod } from './TaskService';
import { getTaskPeriodicity } from '../utils/sectionRoutine';
import { formatLongDate, joinNatural, numberWord, pluralWord } from '../utils/format';

export type DayPeriod = 'morning' | 'afternoon' | 'evening';

export interface DailyBriefing {
  period: DayPeriod;
  greeting: string;
  date: string;
  /** Frase principal, ya redactada y personalizada. */
  headline: string;
  /** Frase secundaria opcional (urgentes, completadas, hábitos…). */
  detail: string;
  pendingToday: TaskItem[];
  pendingDaily: TaskItem[];
  pendingWeekly: TaskItem[];
  isWeeklyDay: boolean;
  /** Hasta 3 tareas sugeridas para empezar, ordenadas por urgencia. */
  focus: TaskItem[];
  completedToday: number;
  completedDailyToday: number;
  highPriorityToday: number;
  habitsDone: number;
  habitsTotal: number;
  topStreak: number;
  expiring: TaskItem[];
  /** Día sin nada que contar: no merece interrumpir al usuario. */
  isQuiet: boolean;
}

const PRIORITY_WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1, none: 0 };

const greetingFor = (hour: number): { period: DayPeriod; greeting: string } => {
  if (hour >= 6 && hour < 13) return { period: 'morning', greeting: 'Buenos días' };
  if (hour >= 13 && hour < 20) return { period: 'afternoon', greeting: 'Buenas tardes' };
  return { period: 'evening', greeting: 'Buenas noches' };
};

export function buildDailyBriefing(
  tasksMap: Record<string, TaskItem>,
  cycles: CustomCycle[],
  options: { 
    name?: string; 
    now?: Date; 
    listSections?: ListSection[]; 
    lists?: CustomList[];
    weeklyDayOfWeek?: number;
  } = {}
): DailyBriefing {
  const now = options.now || new Date();
  const name = (options.name || '').trim();
  const { period, greeting } = greetingFor(now.getHours());
  const todayStr = now.toDateString();

  const all = Object.values(tasksMap || {}).filter((t) => !t.deleted_at);
  const today = all.filter((t) => t.dueDate && new Date(t.dueDate).toDateString() === todayStr);
  const pendingToday = today.filter((t) => !isTaskCompleted(t));
  const completedToday = today.filter((t) => isTaskCompleted(t)).length;
  const highPriority = pendingToday.filter((t) => t.priority === 'high');

  // ── Detección de Tareas Diarias y Semanales ────────────────────────────────
  const dailyTasks = all.filter((t) => {
    if (t.cycle_id === 'cycle_day' || (t.targetCount && t.targetCount > 1)) return true;
    const p = getTaskPeriodicity(t, options.listSections, options.lists);
    if (p === 'day') return true;
    if (t.dueDate && new Date(t.dueDate).toDateString() === todayStr) return true;
    return false;
  });

  const pendingDaily = dailyTasks.filter(
    (t) => !isCompletedInCurrentPeriod(t, cycles, options.listSections, options.lists) && !isTaskCompleted(t)
  );
  const completedDailyToday = dailyTasks.filter(
    (t) => isCompletedInCurrentPeriod(t, cycles, options.listSections, options.lists) || (isTaskCompleted(t) && !t.cycle_id)
  ).length;

  const weeklyTasks = all.filter((t) => {
    if (t.cycle_id === 'cycle_week') return true;
    const p = getTaskPeriodicity(t, options.listSections, options.lists);
    return p === 'week';
  });

  const pendingWeekly = weeklyTasks.filter(
    (t) => !isCompletedInCurrentPeriod(t, cycles, options.listSections, options.lists)
  );

  // Día de tareas semanales (por defecto 6 = Sábado, o configurable en opciones/localStorage)
  const currentDayOfWeek = now.getDay();
  let weeklyDayPref = 6;
  try {
    const stored = localStorage.getItem('weekly_tasks_day');
    if (stored !== null) weeklyDayPref = Number(stored);
  } catch {}
  const isWeeklyDay = options.weeklyDayOfWeek !== undefined 
    ? currentDayOfWeek === options.weeklyDayOfWeek 
    : currentDayOfWeek === weeklyDayPref;

  const habits = all.filter((t) => t.cycle_id === 'cycle_day' || (t.targetCount && t.targetCount > 1));
  const habitsDone = habits.filter((t) => isCompletedInCurrentPeriod(t, cycles, options.listSections, options.lists) || isTaskCompleted(t)).length;
  const topStreak = habits.reduce((max, habit) => Math.max(max, calculateHabitStreak(habit, cycles).count), 0);

  const expiring = all.filter((t) => {
    if (!t.dueDate || isTaskCompleted(t)) return false;
    if (t.categoryId !== 'caducidades' && !t.expirationType) return false;
    const hours = (new Date(t.dueDate).getTime() - now.getTime()) / 3_600_000;
    return hours >= -12 && hours <= 48;
  });

  const focus = [...pendingToday]
    .sort((a, b) => {
      const weight = (PRIORITY_WEIGHT[b.priority || 'none'] || 0) - (PRIORITY_WEIGHT[a.priority || 'none'] || 0);
      if (weight !== 0) return weight;
      return new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime();
    })
    .slice(0, 3);

  // ── Redacción del Titular ──────────────────────────────────────────────────
  const who = name ? `, ${name}` : '';
  let headline: string;

  if (isWeeklyDay && weeklyTasks.length > 0) {
    headline = `¡Hoy es día de tareas semanales! Además de las diarias (${pendingDaily.length}), tienes que hacer las semanales (${pendingWeekly.length}).`;
  } else if (pendingToday.length > 0) {
    if (pendingToday.length === 1) {
      headline = 'Tienes una tarea para hoy.';
    } else {
      headline = `Tienes ${pluralWord(pendingToday.length, 'tarea')} para hoy.`;
    }
  } else if (pendingDaily.length === 0) {
    headline = completedDailyToday > 0 ? '¡Todo listo por hoy! Has completado todas tus tareas diarias.' : 'Hoy no tienes tareas diarias pendientes.';
  } else if (pendingDaily.length === 1) {
    headline = 'Hola, hoy te queda por hacer 1 tarea diaria.';
  } else {
    headline = `Hola, hoy te quedan por hacer ${pendingDaily.length} tareas diarias.`;
  }

  const details: string[] = [];
  if (highPriority.length === 1) details.push('una es urgente');
  else if (highPriority.length > 1) details.push(`${numberWord(highPriority.length)} son urgentes`);
  if (completedDailyToday > 0) details.push(`ya has completado ${pluralWord(completedDailyToday, 'tarea diaria')}`);
  const habitsLeft = habits.length - habitsDone;
  if (habitsLeft === 1) {
    details.push('te queda un hábito del día');
  } else if (habitsLeft > 1) {
    details.push(`te quedan ${pluralWord(habitsLeft, 'hábito')} del día`);
  } else if (habits.length > 0) {
    details.push('tus hábitos de hoy están al día');
  }
  const detail = details.length ? `${joinNatural(details).replace(/^./, (c) => c.toUpperCase())}.` : '';

  return {
    period,
    greeting: `${greeting}${who}`,
    date: formatLongDate(now),
    headline,
    detail,
    pendingToday,
    pendingDaily,
    pendingWeekly,
    isWeeklyDay,
    focus,
    completedToday,
    completedDailyToday,
    highPriorityToday: highPriority.length,
    habitsDone,
    habitsTotal: habits.length,
    topStreak,
    expiring,
    isQuiet: pendingDaily.length === 0 && completedDailyToday === 0 && habits.length === 0 && expiring.length === 0,
  };
}
