import type { CustomCycle, CustomList, ListSection, TaskItem } from '../models/Task';
import { calculateRoutinePeriod, getRoutinePeriod } from './routineAnalytics';

export interface RoutineRecoveryGroup {
  id: string;
  frequency: 'week' | 'month';
  periodStart: Date;
  listId: string;
  sectionId?: string;
  label: string;
  /** Todas las tareas de esa sección que quedaron sin marcar en el periodo pasado (las que omitiría «Omitir»). */
  tasks: TaskItem[];
  /** La más breve de las que siguen pendientes ahora: por dónde empezar. */
  candidate: TaskItem;
}

const durationOf = (task: TaskItem) => task.duration && task.duration > 0 ? task.duration : Infinity;

/**
 * Sugerencias de solo lectura: secciones con tareas sin marcar en la semana o el mes anterior
 * (omisiones inferidas, no decisiones) que todavía tienen algo pendiente ahora. Cada grupo es una
 * sección y un periodo: omitirlo no toca otras secciones ni el periodo actual.
 * Orden: primero lo que se retoma con menos esfuerzo (la tarea más breve), luego por nombre.
 */
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
    const pendingNow = new Set(current.groups.flatMap(group => group.tasks.filter(row => row.status === 'pending').map(row => row.task.id)));
    for (const group of history.groups) {
      const missed = group.tasks.filter(row => row.status === 'missed').map(row => row.task);
      const available = missed.filter(task => pendingNow.has(task.id));
      if (!available.length) continue;
      const candidate = [...available].sort((a, b) => durationOf(a) - durationOf(b) || a.title.localeCompare(b.title, 'es'))[0];
      recovery.push({
        id: `${frequency}:${history.start.getTime()}:${group.id}`, frequency,
        periodStart: history.start, listId: group.listId, sectionId: group.sectionId,
        label: group.name === 'Sin sección' ? group.listName : `${group.listName} · ${group.name}`,
        tasks: missed, candidate,
      });
    }
  }
  return recovery.sort((a, b) => durationOf(a.candidate) - durationOf(b.candidate)
    || (a.frequency === b.frequency ? 0 : a.frequency === 'week' ? -1 : 1)
    || a.label.localeCompare(b.label, 'es'));
}
