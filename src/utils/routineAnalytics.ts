import type { CustomCycle, CustomList, ListSection, TaskItem } from '../models/Task';
import { getStartOfWeek, matchesPeriod } from '../services/TaskService';
import { getEffectiveCycleId } from './sectionRoutine';

export type RoutineFrequency = 'day' | 'week' | 'month' | 'year';
export type RoutineTaskStatus = 'completed' | 'skipped' | 'pending' | 'missed' | 'unknown';

export interface RoutinePeriod {
  id: string;
  label: string;
  start: Date;
  /** Exclusive local-calendar boundary (including daylight-saving changes). */
  end: Date;
}

export interface RoutineCounts {
  total: number;
  completed: number;
  skipped: number;
  automaticSkipped: number;
  pending: number;
  missed: number;
  unknown: number;
}

export interface RoutineGroup extends RoutineCounts {
  id: string;
  name: string;
  listName: string;
  listId: string;
  sectionId?: string;
  tasks: { task: TaskItem; status: RoutineTaskStatus; automatic?: boolean }[];
}

export interface RoutinePeriodSummary extends RoutineCounts {
  start: Date;
  end: Date;
  groups: RoutineGroup[];
}

const emptyCounts = (): RoutineCounts => ({ total: 0, completed: 0, skipped: 0, automaticSkipped: 0, pending: 0, missed: 0, unknown: 0 });
const localDateId = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function getRoutinePeriod(frequency: RoutineFrequency, referenceDate: Date): RoutinePeriod {
  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);
  if (frequency === 'week') start.setTime(getStartOfWeek(start).getTime());
  if (frequency === 'month') start.setDate(1);
  if (frequency === 'year') start.setMonth(0, 1);
  const end = new Date(start);
  if (frequency === 'day') end.setDate(end.getDate() + 1);
  if (frequency === 'week') end.setDate(end.getDate() + 7);
  if (frequency === 'month') end.setMonth(end.getMonth() + 1);
  if (frequency === 'year') end.setFullYear(end.getFullYear() + 1);
  const options: Intl.DateTimeFormatOptions = frequency === 'year' ? { year: 'numeric' }
    : frequency === 'month' ? { month: 'long', year: 'numeric' }
      : { day: 'numeric', month: 'short' };
  let label = start.toLocaleDateString('es-ES', options);
  if (frequency === 'week') {
    const last = new Date(end);
    last.setDate(last.getDate() - 1);
    label = `${label} – ${last.toLocaleDateString('es-ES', options)}`;
  }
  return { id: `${frequency}:${localDateId(start)}`, label, start, end };
}

/** Visible calendar periods, oldest first. No fixed-millisecond day arithmetic. */
export function getRoutinePeriods(frequency: RoutineFrequency, referenceDate: Date): RoutinePeriod[] {
  if (frequency === 'day') {
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: days }, (_, index) => getRoutinePeriod(frequency, new Date(year, month, index + 1)));
  }
  if (frequency === 'month') {
    return Array.from({ length: 12 }, (_, month) => getRoutinePeriod(frequency, new Date(referenceDate.getFullYear(), month, 1)));
  }
  const length = frequency === 'week' ? 8 : 5;
  return Array.from({ length }, (_, index) => {
    const date = getRoutinePeriod(frequency, referenceDate).start;
    if (frequency === 'week') date.setDate(date.getDate() - (length - 1 - index) * 7);
    else date.setFullYear(date.getFullYear() - (length - 1 - index));
    return getRoutinePeriod(frequency, date);
  });
}

function sectionPath(sectionId: string | undefined, listId: string, sections: ListSection[]): string {
  const names: string[] = [];
  const visited = new Set<string>();
  let section = sections.find(item => item.id === sectionId && item.listId === listId && !item.deleted_at);
  while (section && !visited.has(section.id)) {
    visited.add(section.id);
    names.unshift(section.name);
    section = sections.find(item => item.id === section?.parentId && item.listId === listId && !item.deleted_at);
  }
  return names.join(' / ') || 'Sin sección';
}

/**
 * Read-only analytics: marks are evidence; today's count cannot invalidate past history.
 * Unmarked closed periods are automatically omitted, without changing the saved history.
 * Without a creation timestamp, an unrecorded closed period remains unknown.
 * Grouping reflects the currently saved list/section; historical moves are not recorded.
 */
export function calculateRoutinePeriod(
  tasks: TaskItem[],
  frequency: RoutineFrequency,
  referenceDate: Date,
  cycles: CustomCycle[] = [],
  sections: ListSection[] = [],
  lists: CustomList[] = [],
  now = new Date()
): RoutinePeriodSummary {
  const { start, end } = getRoutinePeriod(frequency, referenceDate);
  const result: RoutinePeriodSummary = { ...emptyCounts(), start, end, groups: [] };
  const groups = new Map<string, RoutineGroup>();
  for (const task of tasks) {
    if (task.deleted_at || task.categoryId === 'primeros_pasos') continue;
    const cycleId = getEffectiveCycleId(task, sections, lists);
    if (cycleId !== `cycle_${frequency}`) continue;
    const created = new Date(task.created_at).getTime();
    if (Number.isFinite(created) && created >= end.getTime()) continue;
    const completions: (number | string)[] = [...(task.completionHistory || [])];
    if (task.completed_at) completions.push(task.completed_at);
    let status: RoutineTaskStatus;
    let automatic = false;
    if (start.getTime() > now.getTime()) status = 'unknown';
    else if (matchesPeriod(completions, cycleId, referenceDate, cycles)) status = 'completed';
    else if (matchesPeriod(task.skipHistory, cycleId, referenceDate, cycles)) status = 'skipped';
    else if (end.getTime() <= now.getTime()) {
      status = Number.isFinite(created) ? 'skipped' : 'unknown';
      automatic = status === 'skipped';
    }
    else status = 'pending';
    const listId = task.categoryId || 'inbox';
    const sectionId = task.sectionId;
    const id = JSON.stringify([listId, sectionId || null]);
    let group = groups.get(id);
    if (!group) {
      group = {
        ...emptyCounts(), id, name: sectionPath(sectionId, listId, sections), listId, sectionId,
        listName: lists.find(list => list.id === listId)?.name || (listId === 'inbox' ? 'Bandeja de entrada' : listId),
        tasks: [],
      };
      groups.set(id, group);
    }
    group.total++;
    group[status]++;
    group.tasks.push({ task, status, ...(automatic ? { automatic: true } : {}) });
    result.total++;
    result[status]++;
    if (automatic) {
      group.automaticSkipped++;
      result.automaticSkipped++;
    }
  }
  result.groups = [...groups.values()].sort((a, b) => a.listName.localeCompare(b.listName, 'es') || a.name.localeCompare(b.name, 'es'));
  return result;
}
