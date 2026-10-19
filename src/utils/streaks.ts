import type { CustomCycle, CustomList, ListSection, TaskItem } from '../models/Task';
import { matchesPeriod } from '../services/TaskService';
import { calculateRoutinePeriod, getRoutinePeriod, type RoutineFrequency } from './routineAnalytics';
import { getEffectiveCycleId } from './sectionRoutine';

export interface Streak {
  count: number;
  frequency: RoutineFrequency;
  /** «días», «semanas», «meses», «años» (o singular con count 1). */
  unit: string;
}

const UNITS: Record<RoutineFrequency, [string, string]> = {
  day: ['día', 'días'],
  week: ['semana', 'semanas'],
  month: ['mes', 'meses'],
  year: ['año', 'años'],
};
const unitFor = (frequency: RoutineFrequency, count: number) => UNITS[frequency][count === 1 ? 0 : 1];

// Límite de periodos que se recorren hacia atrás: suficiente para cualquier racha razonable.
const MAX_PERIODS = 400;

/** Inicio del periodo anterior al que empieza en `start`. */
function previousPeriodStart(frequency: RoutineFrequency, start: Date): Date {
  const date = new Date(start);
  if (frequency === 'day') date.setDate(date.getDate() - 1);
  if (frequency === 'week') date.setDate(date.getDate() - 7);
  if (frequency === 'month') date.setMonth(date.getMonth() - 1);
  if (frequency === 'year') date.setFullYear(date.getFullYear() - 1);
  return date;
}

export function taskFrequency(task: TaskItem, sections: ListSection[] = [], lists: CustomList[] = []): RoutineFrequency | null {
  const cycleId = getEffectiveCycleId(task, sections, lists) || (task.targetCount && task.targetCount > 1 ? 'cycle_day' : null);
  const match = /^cycle_(day|week|month|year)$/.exec(cycleId || '');
  return match ? (match[1] as RoutineFrequency) : null;
}

/**
 * Racha de una tarea repetitiva: periodos seguidos (días, semanas o meses, según su frecuencia) en
 * los que se marcó.
 * - El periodo actual, si aún está pendiente, no la rompe (todavía hay tiempo).
 * - Un periodo omitido a propósito tampoco: es una decisión, no un olvido. No suma, pero no corta.
 * - Un periodo cerrado sin marcar sí la corta.
 */
export function calculateTaskStreak(
  task: TaskItem,
  sections: ListSection[] = [],
  lists: CustomList[] = [],
  cycles: CustomCycle[] = [],
  now = new Date(),
): Streak | null {
  const frequency = taskFrequency(task, sections, lists);
  if (!frequency) return null;
  const cycleId = `cycle_${frequency}`;
  const completions: (number | string)[] = [...(task.completionHistory || [])];
  if (task.completed_at) completions.push(task.completed_at);
  const created = new Date(task.created_at).getTime();

  let count = 0;
  let start = getRoutinePeriod(frequency, now).start;
  for (let index = 0; index < MAX_PERIODS; index++) {
    const isCurrent = index === 0;
    if (matchesPeriod(completions, cycleId, start, cycles)) count++;
    else if (matchesPeriod(task.skipHistory, cycleId, start, cycles)) { /* omitido a propósito: puente */ }
    else if (!isCurrent) break;
    // Antes de existir la tarea no hay nada que contar.
    if (Number.isFinite(created) && start.getTime() <= created) break;
    start = previousPeriodStart(frequency, start);
  }
  return { count, frequency, unit: unitFor(frequency, count) };
}

export interface SectionStreak extends Streak {
  id: string;
  label: string;
  listId: string;
  sectionId?: string;
}

/**
 * Rachas por sección y frecuencia («Limpieza · 4 semanas»): un periodo cuenta cuando todas las
 * tareas de esa frecuencia en la sección se hicieron u omitieron a propósito, con al menos una hecha.
 * El periodo actual solo suma si ya está completo; si no, no corta. Solo rachas de 2 o más.
 */
export function calculateSectionStreaks(
  tasks: TaskItem[],
  cycles: CustomCycle[] = [],
  sections: ListSection[] = [],
  lists: CustomList[] = [],
  now = new Date(),
  maxPeriods = 104,
): SectionStreak[] {
  const result: SectionStreak[] = [];
  for (const frequency of ['day', 'week', 'month'] as const) {
    const state = new Map<string, { count: number; open: boolean; label: string; listId: string; sectionId?: string }>();
    let start = getRoutinePeriod(frequency, now).start;
    for (let index = 0; index < maxPeriods; index++) {
      const summary = calculateRoutinePeriod(tasks, frequency, start, cycles, sections, lists, now);
      if (summary.total === 0) break;
      let anyOpen = false;
      for (const group of summary.groups) {
        let entry = state.get(group.id);
        if (!entry) {
          // Un grupo que aparece por primera vez en un periodo pasado no tenía racha viva.
          if (index > 1) continue;
          entry = {
            count: 0, open: true, listId: group.listId, sectionId: group.sectionId,
            label: group.name === 'Sin sección' ? group.listName : `${group.listName} · ${group.name}`,
          };
          state.set(group.id, entry);
        }
        if (!entry.open) continue;
        const done = group.missed === 0 && group.unknown === 0 && group.pending === 0 && group.completed > 0;
        if (done) entry.count++;
        else if (index === 0 || (group.missed === 0 && group.unknown === 0 && group.pending === 0)) { /* en curso u omitido entero */ }
        else entry.open = false;
        if (entry.open) anyOpen = true;
      }
      if (!anyOpen && index > 0) break;
      start = previousPeriodStart(frequency, start);
    }
    for (const [id, entry] of state) {
      if (entry.count < 2) continue;
      result.push({ id: `${frequency}:${id}`, label: entry.label, listId: entry.listId, sectionId: entry.sectionId, frequency, count: entry.count, unit: unitFor(frequency, entry.count) });
    }
  }
  return result.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'es'));
}
