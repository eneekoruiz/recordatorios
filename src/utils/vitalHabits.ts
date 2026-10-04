import type { TaskItem } from '../models/Task';

/**
 * «Hábitos vitales» (beber agua, comer…): una lista propia, aislada de los quehaceres.
 * No tienen duración, ni temporizador, ni cuentan en el motor de horas: solo se marcan
 * como hechos hoy (tracker visual).
 */
export const VITAL_HABITS_LIST_ID = 'habitos_vitales';
export const VITAL_HABITS_LIST_NAME = 'Hábitos vitales';

export const isVitalHabitsList = (listId?: string | null): boolean => listId === VITAL_HABITS_LIST_ID;

export const isVitalHabitTask = (task?: Pick<TaskItem, 'categoryId'> | null): boolean => {
  if (!task) return false;
  const cat = task.categoryId ?? (task as { category_id?: string }).category_id;
  return isVitalHabitsList(cat);
};

/** Título de un hábito vital «de siempre» (para migrar los que estaban mezclados con quehaceres). */
export const VITAL_HABIT_TITLE_REGEX =
  /^\s*(beber agua|beber un vaso de agua|vaso de agua|comer|desayunar|almorzar|cenar|dormir|tomar (la )?medicaci[oó]n)\b/i;
