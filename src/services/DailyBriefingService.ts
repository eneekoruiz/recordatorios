// Resumen del día: una sola fuente de verdad para el saludo de bienvenida y la
// tarjeta de resumen. Devuelve frases ya redactadas (nada de "1 tarea(s)").
import type { TaskItem, CustomCycle } from '../models/Task';
import { isTaskCompleted } from '../store/useAppStore';
import { calculateHabitStreak } from './TaskService';
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
  /** Hasta 3 tareas sugeridas para empezar, ordenadas por urgencia. */
  focus: TaskItem[];
  completedToday: number;
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
  options: { name?: string; now?: Date } = {}
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

  const habits = all.filter((t) => t.cycle_id === 'cycle_day' || (t.targetCount && t.targetCount > 1));
  const habitsDone = habits.filter((t) => isTaskCompleted(t)).length;
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

  // ── Redacción ──────────────────────────────────────────────────────────────
  const who = name ? `, ${name}` : '';
  let headline: string;
  if (pendingToday.length === 0) {
    headline = completedToday > 0 ? 'Ya está todo hecho por hoy.' : 'Hoy no tienes nada en la agenda.';
  } else if (pendingToday.length === 1) {
    headline = 'Tienes una tarea para hoy.';
  } else {
    headline = `Tienes ${pluralWord(pendingToday.length, 'tarea')} para hoy.`;
  }

  const details: string[] = [];
  if (highPriority.length === 1) details.push('una es urgente');
  else if (highPriority.length > 1) details.push(`${numberWord(highPriority.length)} son urgentes`);
  if (completedToday > 0) details.push(`ya has completado ${pluralWord(completedToday, 'tarea')}`);
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
    focus,
    completedToday,
    highPriorityToday: highPriority.length,
    habitsDone,
    habitsTotal: habits.length,
    topStreak,
    expiring,
    isQuiet: pendingToday.length === 0 && completedToday === 0 && habits.length === 0 && expiring.length === 0,
  };
}
