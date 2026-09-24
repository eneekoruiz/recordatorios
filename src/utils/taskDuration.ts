/**
 * Task Duration & Parallel Tasks Engine.
 * 
 * Provides utilities to calculate, estimate, and format time investments
 * across tasks, sections, and entire lists, with dedicated support for
 * parallel/background tasks (e.g. washing machine, dishwasher, soaking).
 */

import type { TaskItem, ListSection, CustomList } from '../models/Task';
import { getTaskPeriodicity } from './sectionRoutine';

export interface TaskDurationInfo {
  activeMinutes: number;
  parallelMinutes: number;
  isParallel: boolean;
}

export interface TasksDurationSummary {
  activeMinutes: number;
  parallelMinutes: number;
  parallelTasksCount: number;
  formattedActive: string;
  formattedParallel: string;
  formattedTotal: string;
}

/**
 * Regex identifying tasks that naturally execute in background/parallel
 * while the user can proceed with other active activities.
 */
export const PARALLEL_TASK_REGEX = /\b(lavadora|poner la lavadora|lavar la ropa|secadora|poner la secadora|lavavajillas|poner lavavajillas|fregaplatos|remojo|poner en remojo|descongelar|horno|hornear|pir[oó]lisis|robot aspirador|roomba|tintorer[ií]a)\b/i;

/**
 * Checks whether a task is a parallel / background task.
 */
export function isParallelTask(task?: TaskItem | null): boolean {
  if (!task) return false;
  if ((task as any).isParallel === true) return true;
  return PARALLEL_TASK_REGEX.test(task.title || '');
}

/**
 * Calculates estimated active and parallel duration in minutes for a single task.
 */
export function getTaskDuration(
  task: TaskItem,
  sections?: ListSection[],
  lists?: CustomList[]
): TaskDurationInfo {
  if (!task) return { activeMinutes: 5, parallelMinutes: 0, isParallel: false };

  const parallel = isParallelTask(task);
  const title = (task.title || '').toLowerCase();

  // 1. Explicit duration set on the task
  if (typeof task.duration === 'number' && task.duration > 0) {
    if (parallel) {
      const pDur = (task as any).parallelDuration || 150;
      return { activeMinutes: task.duration, parallelMinutes: pDur, isParallel: true };
    }
    return { activeMinutes: task.duration, parallelMinutes: 0, isParallel: false };
  }

  // 2. Parallel tasks: small active setup time + large passive background time
  if (parallel) {
    if (title.includes('lavadora') || title.includes('lavar la ropa')) {
      return { activeMinutes: 5, parallelMinutes: 150, isParallel: true }; // 2h 30m
    }
    if (title.includes('secadora')) {
      return { activeMinutes: 3, parallelMinutes: 90, isParallel: true };  // 1h 30m
    }
    if (title.includes('lavavajillas') || title.includes('fregaplatos')) {
      return { activeMinutes: 5, parallelMinutes: 120, isParallel: true }; // 2h
    }
    if (title.includes('horno') || title.includes('hornear') || title.includes('remojo')) {
      return { activeMinutes: 5, parallelMinutes: 60, isParallel: true };  // 1h
    }
    if (title.includes('descongelar')) {
      return { activeMinutes: 2, parallelMinutes: 180, isParallel: true }; // 3h
    }
    if (title.includes('robot') || title.includes('roomba')) {
      return { activeMinutes: 3, parallelMinutes: 75, isParallel: true };  // 1h 15m
    }
    return { activeMinutes: 5, parallelMinutes: 120, isParallel: true };
  }

  // 3. Keyword-based heuristics for routine cleaning and common household tasks
  // Heavy / Deep tasks (35 - 50 min)
  if (
    title.includes('armario a fondo') || title.includes('persiana') ||
    title.includes('colchón') || title.includes('colchon') ||
    title.includes('edredón') || title.includes('edredon') ||
    title.includes('manta grande') || title.includes('reorganizar') ||
    title.includes('despensa a fondo')
  ) {
    return { activeMinutes: 40, parallelMinutes: 0, isParallel: false };
  }

  // Thorough cleaning tasks (20 - 30 min)
  if (
    title.includes('a fondo') || title.includes('aspirar toda') ||
    title.includes('ducha') || title.includes('inodoro') ||
    title.includes('nevera') || title.includes('frigorífico') ||
    title.includes('microondas') || title.includes('cristales') ||
    title.includes('ventanas') || title.includes('sábana') ||
    title.includes('sabana') || title.includes('fregar a fondo')
  ) {
    return { activeMinutes: 25, parallelMinutes: 0, isParallel: false };
  }

  // Medium tasks (10 - 15 min)
  if (
    title.includes('plato') || title.includes('fregar') ||
    title.includes('vitro') || title.includes('barrer') ||
    title.includes('fregona') || title.includes('polvo') ||
    title.includes('toalla') || title.includes('ordenar') ||
    title.includes('despensa') || title.includes('mesa')
  ) {
    return { activeMinutes: 15, parallelMinutes: 0, isParallel: false };
  }

  // Quick daily tasks (3 - 5 min)
  if (
    title.includes('cama') || title.includes('acomodar') ||
    title.includes('basura') || title.includes('ventil') ||
    title.includes('recog') || title.includes('lavabo') ||
    title.includes('grifo') || title.includes('espejo') ||
    title.includes('dientes') || title.includes('pastilla') ||
    title.includes('agua') || title.includes('desayun')
  ) {
    return { activeMinutes: 5, parallelMinutes: 0, isParallel: false };
  }

  // 4. Periodicity-based default
  const periodicity = getTaskPeriodicity(task, sections, lists);
  switch (periodicity) {
    case 'day':
      return { activeMinutes: 5, parallelMinutes: 0, isParallel: false };
    case 'week':
      return { activeMinutes: 15, parallelMinutes: 0, isParallel: false };
    case 'month':
      return { activeMinutes: 30, parallelMinutes: 0, isParallel: false };
    case 'year':
      return { activeMinutes: 45, parallelMinutes: 0, isParallel: false };
    default:
      return { activeMinutes: 10, parallelMinutes: 0, isParallel: false };
  }
}

/**
 * Formats a duration in minutes into a clean human-readable string.
 * Examples: 5 -> "5 min", 45 -> "45 min", 60 -> "1h", 90 -> "1h 30m", 150 -> "2h 30m"
 */
export function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '0 min';
  const mins = Math.round(minutes);
  if (mins < 60) return `${mins} min`;

  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  if (remainingMins === 0) return `${hours}h`;
  return `${hours}h ${remainingMins}m`;
}

/**
 * Aggregates estimated durations for a set of tasks (filtering to pending only).
 * Handles parallel tasks appropriately (parallel passive time runs concurrently).
 */
export function calculateTasksDuration(
  tasks: TaskItem[],
  sections?: ListSection[],
  lists?: CustomList[]
): TasksDurationSummary {
  if (!tasks || tasks.length === 0) {
    return {
      activeMinutes: 0,
      parallelMinutes: 0,
      parallelTasksCount: 0,
      formattedActive: '0 min',
      formattedParallel: '0 min',
      formattedTotal: '0 min'
    };
  }

  let totalActive = 0;
  let maxParallel = 0;
  let parallelCount = 0;

  for (const t of tasks) {
    // Only count active/pending tasks
    if (t.status === 'completed' || t.deleted_at) continue;

    const info = getTaskDuration(t, sections, lists);
    totalActive += info.activeMinutes;
    if (info.isParallel) {
      parallelCount++;
      if (info.parallelMinutes > maxParallel) {
        maxParallel = info.parallelMinutes;
      }
    }
  }

  const formattedActive = formatDuration(totalActive);
  const formattedParallel = formatDuration(maxParallel);
  const formattedTotal = parallelCount > 0
    ? `${formattedActive} (+ ${formattedParallel} paralelo)`
    : formattedActive;

  return {
    activeMinutes: totalActive,
    parallelMinutes: maxParallel,
    parallelTasksCount: parallelCount,
    formattedActive,
    formattedParallel,
    formattedTotal
  };
}
