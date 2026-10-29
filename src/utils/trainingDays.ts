import type { ListSection, TaskItem } from '../models/Task';

/**
 * Programas por días («Día 1: Tren superior A», «Día 2: …»): una lista cuyas secciones raíz se llaman
 * «Día N» se entrena en rotación. Aquí se decide qué día toca hoy, sin depender de la semana:
 * el siguiente al último que se entrenó, o el mismo si se está entrenando (o se terminó) hoy.
 */
export type TrainingDayStatus = 'today' | 'done_today' | 'next' | 'later';

export interface TrainingDayPlan {
  /** Secciones «Día N» en su orden. */
  daySectionIds: string[];
  currentId: string;
  status: Record<string, TrainingDayStatus>;
  /** Tareas de secciones que no son días (calentamiento, core diario…): van con cualquier día. */
  sharedSectionIds: string[];
}

const DAY_NAME = /^\s*d[ií]a\s*\d+\b/i;

export const isTrainingDayName = (name?: string) => Boolean(name && DAY_NAME.test(name));

const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

/** Última vez que se hizo algo de la tarea: su última compleción o, si va por series, la última serie. */
function lastActivity(task: TaskItem): number {
  const history = (task.completionHistory || []).map(Number).filter(Number.isFinite);
  const lastDone = history.length ? Math.max(...history) : 0;
  const inProgress = (task.currentCount || 0) > 0 && (task.currentCount || 0) < (task.targetCount || 0);
  const partial = inProgress && task.updated_at ? new Date(task.updated_at).getTime() : 0;
  return Math.max(lastDone, Number.isFinite(partial) ? partial : 0);
}

const doneToday = (task: TaskItem, now: number) =>
  (task.completionHistory || []).some(ts => sameDay(Number(ts), now)) || task.status === 'completed';

export function getTrainingDayPlan(
  listId: string | undefined,
  listSections: ListSection[],
  tasks: TaskItem[],
  now: number = Date.now(),
  manualOverrideSectionId?: string
): TrainingDayPlan | null {
  if (!listId) return null;
  const roots = listSections
    .filter(s => s.listId === listId && !s.parentId && !s.deleted_at)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const days = roots.filter(s => isTrainingDayName(s.name));
  if (days.length < 2) return null;

  const live = tasks.filter(t => t.categoryId === listId && !t.deleted_at);
  const childOf = new Map<string, string>();
  listSections.forEach(s => { if (s.parentId) childOf.set(s.id, s.parentId); });
  const rootOf = (sectionId?: string) => {
    let id = sectionId;
    for (let guard = 0; id && childOf.has(id) && guard < 10; guard++) id = childOf.get(id);
    return id;
  };
  const tasksOfDay = (dayId: string) => live.filter(t => rootOf(t.sectionId) === dayId);

  let lastIndex = -1;
  let lastAt = 0;
  days.forEach((day, i) => {
    const at = Math.max(0, ...tasksOfDay(day.id).map(lastActivity));
    if (at > lastAt) { lastAt = at; lastIndex = i; }
  });

  let currentIndex = 0;
  let currentDoneToday = false;
  if (manualOverrideSectionId) {
    const overrideIdx = days.findIndex(d => d.id === manualOverrideSectionId);
    if (overrideIdx >= 0) {
      currentIndex = overrideIdx;
    }
  } else if (lastIndex >= 0 && lastAt > 0 && sameDay(lastAt, now)) {
    // Se está entrenando hoy (o ya se terminó): ese es el día de hoy.
    currentIndex = lastIndex;
    const dayTasks = tasksOfDay(days[lastIndex].id);
    currentDoneToday = dayTasks.length > 0 && dayTasks.every(t => doneToday(t, now));
  } else if (lastIndex >= 0) {
    currentIndex = (lastIndex + 1) % days.length;
  }

  const status: Record<string, TrainingDayStatus> = {};
  days.forEach((day, i) => {
    if (i === currentIndex) status[day.id] = currentDoneToday ? 'done_today' : 'today';
    else if (i === (currentIndex + 1) % days.length) status[day.id] = 'next';
    else status[day.id] = 'later';
  });

  return {
    daySectionIds: days.map(d => d.id),
    currentId: days[currentIndex].id,
    status,
    sharedSectionIds: roots.filter(s => !isTrainingDayName(s.name)).map(s => s.id),
  };
}

const COOL_DOWN = /posterior|despu[eé]s|final|descarga|enfriamiento|vuelta a la calma/i;

/**
 * Orden de «Empezar» en un programa por días: lo compartido de antes (calentamiento, core…), el día
 * de hoy y, al final, lo compartido de después (estiramientos posteriores). Los otros días no entran.
 */
export function orderTrainingSession(
  plan: TrainingDayPlan,
  pending: TaskItem[],
  listSections: ListSection[]
): TaskItem[] {
  const childOf = new Map<string, string>();
  listSections.forEach(s => { if (s.parentId) childOf.set(s.id, s.parentId); });
  const rootOf = (sectionId?: string) => {
    let id = sectionId;
    for (let guard = 0; id && childOf.has(id) && guard < 10; guard++) id = childOf.get(id);
    return id;
  };
  const days = new Set(plan.daySectionIds);
  const shared = pending.filter(t => !days.has(rootOf(t.sectionId) || ''));
  const today = pending.filter(t => rootOf(t.sectionId) === plan.currentId);
  const before = shared.filter(t => !COOL_DOWN.test(t.title));
  const after = shared.filter(t => COOL_DOWN.test(t.title));
  return [...before, ...today, ...after];
}

export const TRAINING_DAY_LABEL: Record<TrainingDayStatus, string> = {
  today: 'Toca hoy',
  done_today: 'Hecho hoy',
  next: 'Siguiente',
  later: 'Otro día',
};
