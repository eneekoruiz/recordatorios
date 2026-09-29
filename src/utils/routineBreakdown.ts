import type { TaskItem, ListSection, CustomList } from '../models/Task';
import { isTaskCompleted } from '../store/useAppStore';
import { getTaskPeriodicity } from './sectionRoutine';
import { calculateTasksDuration, formatDuration } from './taskDuration';

export type RoutinePeriod = 'day' | 'week' | 'month' | 'year';
/** «none»: tareas puntuales, sin frecuencia (una fecha concreta o ninguna). */
export type MixKind = RoutinePeriod | 'none';

export interface RoutinePart {
  periodicity: MixKind;
  /** Pendientes de esta frecuencia. */
  count: number;
  /** Minutos activos de esas pendientes. */
  minutes: number;
}

const ORDER: RoutinePeriod[] = ['year', 'month', 'week', 'day'];
const MIX_ORDER: MixKind[] = ['none', 'day', 'week', 'month', 'year'];
const LABEL: Record<MixKind, string> = { none: 'puntuales', day: 'diarias', week: 'semanales', month: 'mensuales', year: 'anuales' };

export const routinePeriodLabel = (p: MixKind): string => LABEL[p];

/**
 * Reparte lo pendiente de una sección con «+ Diarias/Acumuladas» por frecuencia (de la más larga a la
 * más corta), para poder ver cuánto tiempo y cuántas tareas aporta cada una.
 */
export function buildRoutineParts(tasks: TaskItem[], sections?: ListSection[], lists?: CustomList[]): RoutinePart[] {
  const groups = new Map<RoutinePeriod, TaskItem[]>();
  for (const t of tasks) {
    if (isTaskCompleted(t)) continue;
    const p = (getTaskPeriodicity(t, sections, lists) || 'day') as RoutinePeriod;
    if (!ORDER.includes(p)) continue;
    groups.set(p, [...(groups.get(p) || []), t]);
  }
  return ORDER.filter((p) => groups.has(p)).map((p) => ({
    periodicity: p,
    count: groups.get(p)!.length,
    minutes: calculateTasksDuration(groups.get(p)!, sections, lists).activeMinutes,
  }));
}

/** «45 min mensuales + 1 h 10 min semanales + 20 min diarias» */
export function describeRoutineParts(parts: RoutinePart[]): string {
  return parts.map((p) => `${formatDuration(p.minutes)} ${LABEL[p.periodicity]}`).join(' + ');
}

/**
 * Reparte lo pendiente de una sección o vista por tipo: puntuales (con fecha o sin ella) y cada frecuencia.
 * Devuelve las partes solo si de verdad hay mezcla con tiempo en al menos dos tipos.
 */
export function buildMixParts(tasks: TaskItem[], sections?: ListSection[], lists?: CustomList[]): RoutinePart[] | null {
  const groups = new Map<MixKind, TaskItem[]>();
  for (const t of tasks) {
    if (isTaskCompleted(t)) continue;
    const p = (getTaskPeriodicity(t, sections, lists) || 'none') as MixKind;
    if (!MIX_ORDER.includes(p)) continue;
    groups.set(p, [...(groups.get(p) || []), t]);
  }
  const parts = MIX_ORDER.filter((p) => groups.has(p)).map((p) => ({
    periodicity: p,
    count: groups.get(p)!.length,
    minutes: calculateTasksDuration(groups.get(p)!, sections, lists).activeMinutes,
  }));
  return parts.filter((p) => p.minutes > 0).length >= 2 ? parts : null;
}
