import type { TaskItem } from '../models/Task';

/**
 * «Hábitos vitales» (beber agua, comer…): una sección especial o lista, aislada de los quehaceres temporizados.
 * No tienen duración, ni temporizador, ni cuentan en el motor de horas: solo se marcan
 * como hechos hoy (tracker visual de cumplimiento).
 */
export const VITAL_HABITS_LIST_ID = 'habitos_vitales';
export const VITAL_HABITS_LIST_NAME = 'Hábitos vitales';
export const VITAL_HABITS_SECTION_ID = 'sec_habitos_vitales';
export const VITAL_HABITS_SECTION_NAME = 'Hábitos vitales';

export const isVitalHabitsList = (listId?: string | null): boolean => listId === VITAL_HABITS_LIST_ID;

export const isVitalHabitsSection = (sectionId?: string | null, sectionName?: string | null): boolean => {
  if (sectionId === VITAL_HABITS_SECTION_ID || sectionId === 'sec_habitos') return true;
  if (!sectionName) return false;
  return /h[aá]bitos vitales|h[aá]bitos de vida|h[aá]bito vital/i.test(sectionName);
};

/** Título de un hábito vital «de siempre» (para identificar los hábitos esenciales). */
export const VITAL_HABIT_TITLE_REGEX =
  /^\s*(beber agua|beber un vaso de agua|vaso de agua|comer|desayunar|almorzar|cenar|dormir|tomar (la )?medicaci[oó]n)\b/i;

export const isVitalHabitTask = (task?: Pick<TaskItem, 'categoryId' | 'sectionId' | 'title'> | null): boolean => {
  if (!task) return false;
  const cat = task.categoryId ?? (task as { category_id?: string }).category_id;
  if (isVitalHabitsList(cat)) return true;
  const sec = task.sectionId;
  if (sec && (sec === VITAL_HABITS_SECTION_ID || String(sec).includes('habitos_vitales'))) return true;
  if (task.title && VITAL_HABIT_TITLE_REGEX.test(task.title)) return true;
  return false;
};
