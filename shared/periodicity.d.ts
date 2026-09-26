import type { CustomList, ListSection, TaskItem } from '../src/models/Task';

export type PeriodicityType = 'day' | 'week' | 'month' | 'year';

export declare const PERIODICITY_PREFIX_REGEX: RegExp;
export declare function getPeriodicityFromPrefix(title?: string | null): PeriodicityType | null;
export declare function getTaskPeriodicity(
  task: Partial<TaskItem>,
  sections?: ListSection[],
  lists?: CustomList[]
): PeriodicityType | null;
export declare function getEffectiveCycleId(
  task: Partial<TaskItem>,
  sections?: ListSection[],
  lists?: CustomList[]
): string | null;

export interface RoutineRounds {
  day: boolean;
  week: boolean;
  month: boolean;
  year: boolean;
}
/** month 1-12, day 1-31, weekday 0 = domingo. */
export declare function routineRoundsOn(
  date: { month: number; day: number; weekday: number },
  weeklyDay?: number
): RoutineRounds;
