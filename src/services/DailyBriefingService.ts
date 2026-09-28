// Resumen del día: una sola fuente de verdad para el saludo de bienvenida y la
// tarjeta de resumen. Devuelve frases ya redactadas (nada de "1 tarea(s)").
import type { TaskItem, CustomCycle, ListSection, CustomList } from '../models/Task';
import { isTaskCompleted } from '../store/useAppStore';
import { calculateHabitStreak, isCompletedInCurrentPeriod } from './TaskService';
import { getTaskPeriodicity } from '../utils/sectionRoutine';
import { formatLongDate, joinNatural, numberWord, pluralWord } from '../utils/format';
import { readStoredWeeklyDay } from '../utils/routineDay';

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

  // La guía de inicio no cuenta: son ejemplos, no cosas por hacer.
  const all = Object.values(tasksMap || {}).filter((t) => !t.deleted_at && t.categoryId !== 'primeros_pasos');
  const isDoneNow = (t: TaskItem) => isTaskCompleted(t) || isCompletedInCurrentPeriod(t, cycles, options.listSections, options.lists);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dueDay = (t: TaskItem) => {
    const d = new Date(t.dueDate!);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const today = all.filter((t) => t.dueDate && new Date(t.dueDate).toDateString() === todayStr);
  const pendingToday = today.filter((t) => !isDoneNow(t));
  const completedToday = today.filter((t) => isDoneNow(t)).length;
  const overdue = all.filter((t) => t.dueDate && !Number.isNaN(new Date(t.dueDate).getTime()) && dueDay(t) < startOfToday && !isDoneNow(t));

  // ── Rutinas: diarias (y hábitos) y semanales. Una tarea con fecha de hoy no es «diaria». ──
  const dailyTasks = all.filter((t) => {
    if (t.cycle_id === 'cycle_day' || (t.targetCount && t.targetCount > 1)) return true;
    return getTaskPeriodicity(t, options.listSections, options.lists) === 'day';
  });

  const pendingDaily = dailyTasks.filter((t) => !isDoneNow(t));
  const completedDailyToday = dailyTasks.filter((t) => isDoneNow(t)).length;

  const weeklyTasks = all.filter((t) => {
    if (t.cycle_id === 'cycle_week') return true;
    const p = getTaskPeriodicity(t, options.listSections, options.lists);
    return p === 'week';
  });

  const pendingWeekly = weeklyTasks.filter((t) => !isDoneNow(t));

  // Día de tareas semanales (por defecto 6 = Sábado, o configurable en opciones/localStorage)
  const currentDayOfWeek = now.getDay();
  const weeklyDayPref = readStoredWeeklyDay();
  const isWeeklyDay = options.weeklyDayOfWeek !== undefined 
    ? currentDayOfWeek === options.weeklyDayOfWeek 
    : currentDayOfWeek === weeklyDayPref;

  const habits = all.filter((t) => t.cycle_id === 'cycle_day' || (t.targetCount && t.targetCount > 1));
  const habitsDone = habits.filter((t) => isDoneNow(t)).length;
  const topStreak = habits.reduce((max, habit) => Math.max(max, calculateHabitStreak(habit, cycles).count), 0);

  const expiring = all.filter((t) => {
    if (!t.dueDate || isTaskCompleted(t)) return false;
    if (t.categoryId !== 'caducidades' && !t.expirationType) return false;
    const hours = (new Date(t.dueDate).getTime() - now.getTime()) / 3_600_000;
    return hours >= -12 && hours <= 48;
  });

  // Lo que toca hoy: con fecha de hoy, vencido, diarias y (en su día) semanales. Solo eso cuenta
  // para «urgentes» y para sugerir por dónde empezar (lo urgente de dentro de un mes, no).
  const onTodayPlate = new Map<string, TaskItem>();
  [...pendingToday, ...overdue, ...pendingDaily, ...(isWeeklyDay ? pendingWeekly : [])].forEach((t) => onTodayPlate.set(t.id, t));
  const plate = Array.from(onTodayPlate.values());
  const highPriority = plate.filter((t) => t.priority === 'high');

  const focus = plate
    .slice()
    .sort((a, b) => {
      const weight = (PRIORITY_WEIGHT[b.priority || 'none'] || 0) - (PRIORITY_WEIGHT[a.priority || 'none'] || 0);
      if (weight !== 0) return weight;
      return new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime();
    })
    .slice(0, 3);

  // ── Redacción: una frase que lo dice todo, sin repetirlo luego en cápsulas ──
  const who = name ? `, ${name}` : '';
  let headline: string;
  const dated = pendingToday.length ? pluralWord(pendingToday.length, 'tarea') : '';
  const daily = pendingDaily.length ? pluralWord(pendingDaily.length, 'diaria') : '';

  if (isWeeklyDay && pendingWeekly.length > 0) {
    const items = [pluralWord(pendingWeekly.length, 'semanal', 'semanales'), daily, dated && `${dated} con fecha`].filter(Boolean);
    headline = `Hoy toca la ronda semanal: ${joinNatural(items)}.`;
  } else if (pendingToday.length > 0) {
    headline = `Tienes ${dated} para hoy${daily ? ` y ${daily}` : ''}.`;
  } else if (pendingDaily.length > 0) {
    headline = pendingDaily.length === 1 ? 'Hoy te queda una diaria.' : `Hoy te quedan ${daily}.`;
  } else {
    headline = completedDailyToday + completedToday > 0 ? 'Todo hecho por hoy.' : 'Hoy no tienes nada pendiente.';
  }

  const details: string[] = [];
  if (highPriority.length === 1) details.push('una es urgente');
  else if (highPriority.length > 1) details.push(`${numberWord(highPriority.length)} son urgentes`);
  if (overdue.length > 0) details.push(overdue.length === 1 ? 'tienes una vencida' : `tienes ${pluralWord(overdue.length, 'vencida')}`);
  const doneSoFar = completedDailyToday + completedToday;
  if (doneSoFar > 0 && plate.length > 0) details.push(`llevas ${pluralWord(doneSoFar, 'hecha')}`);
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
    isQuiet: plate.length === 0 && completedDailyToday === 0 && completedToday === 0 && habits.length === 0 && expiring.length === 0,
  };
}
