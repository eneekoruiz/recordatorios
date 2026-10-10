import type { CustomCycle, CustomList, ListSection, TaskItem } from '../models/Task';
import { calculateRoutinePeriod, getRoutinePeriod } from './routineAnalytics';

export interface RoutineRecoveryGroup {
  id: string;
  frequency: 'week' | 'month';
  periodStart: Date;
  listId: string;
  sectionId?: string;
  label: string;
  tasks: TaskItem[];
  candidate: TaskItem;
}

/** Read-only suggestions: unresolved previous periods, with a useful current action. */
export function buildRoutineRecovery(
  tasks: TaskItem[], cycles: CustomCycle[] = [], sections: ListSection[] = [],
  lists: CustomList[] = [], now = new Date(),
): RoutineRecoveryGroup[] {
  const recovery: RoutineRecoveryGroup[] = [];
  for (const frequency of ['week', 'month'] as const) {
    const previous = getRoutinePeriod(frequency, now).start;
    if (frequency === 'week') previous.setDate(previous.getDate() - 7);
    else previous.setMonth(previous.getMonth() - 1);
    const history = calculateRoutinePeriod(tasks, frequency, previous, cycles, sections, lists, now);
    const current = calculateRoutinePeriod(tasks, frequency, now, cycles, sections, lists, now);
    const available = new Set(current.groups.flatMap(group => group.tasks.filter(row => row.status === 'pending').map(row => row.task.id)));
    for (const group of history.groups) {
      const remaining = group.tasks.filter(row => row.automatic && available.has(row.task.id)).map(row => row.task);
      if (!remaining.length) continue;
      const ranked = [...remaining].sort((a, b) => {
        const duration = (task: TaskItem) => task.duration && task.duration > 0 ? task.duration : Infinity;
        return duration(a) - duration(b) || a.title.localeCompare(b.title, 'es');
      });
      recovery.push({
        id: `${frequency}:${history.start.getTime()}:${group.id}`, frequency,
        periodStart: history.start, listId: group.listId, sectionId: group.sectionId,
        label: group.name === 'Sin sección' ? group.listName : `${group.listName} · ${group.name}`,
        tasks: remaining, candidate: ranked[0],
      });
    }
  }
  const weekly = recovery.find(group => group.frequency === 'week');
  const monthly = recovery.find(group => group.frequency === 'month');
  return weekly && monthly ? [weekly, monthly] : recovery.slice(0, 2);
}
