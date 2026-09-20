import type { TaskItem, CustomList, ListSection } from '../models/Task';

export type PeriodicityType = 'day' | 'week' | 'month' | 'year';

/**
 * Detecta la periodicidad temporal de una sección a partir de su clave, título, objeto sección o lista.
 */
export const getSectionPeriodicity = (
  sectionKeyOrId: string,
  title?: string,
  sections?: ListSection[],
  lists?: CustomList[]
): PeriodicityType | null => {
  const raw = `${sectionKeyOrId} ${title || ''}`.toLowerCase();

  // 1. Si es un section_id manual de la lista
  if (sectionKeyOrId.startsWith('section_') && sections) {
    const secId = sectionKeyOrId.replace('section_', '');
    const sec = sections.find(s => s.id === secId);
    if (sec) {
      const secNorm = `${sec.id} ${sec.name}`.toLowerCase();
      if (secNorm.includes('diari') || secNorm.includes('recurrent') || secNorm.includes('día') || secNorm.includes('dia')) return 'day';
      if (secNorm.includes('seman')) return 'week';
      if (secNorm.includes('mensu') || secNorm.includes('mes')) return 'month';
      if (secNorm.includes('anual') || secNorm.includes('año')) return 'year';
    }
  }

  // 2. Si es una lista (o sublista en carpetas, ej. limpieza_mensual)
  if (lists) {
    const listObj = lists.find(l => l.id === sectionKeyOrId || l.name.toLowerCase() === sectionKeyOrId.toLowerCase());
    if (listObj) {
      const lNorm = `${listObj.id} ${listObj.name}`.toLowerCase();
      if (lNorm.includes('diari') || lNorm.includes('recurrent') || lNorm.includes('día') || lNorm.includes('dia')) return 'day';
      if (lNorm.includes('seman')) return 'week';
      if (lNorm.includes('mensu') || lNorm.includes('mes')) return 'month';
      if (lNorm.includes('anual') || lNorm.includes('año')) return 'year';
    }
  }

  // 3. Patrones generales por texto / ciclo
  if (raw.includes('cycle_day') || raw.includes('diari') || raw.includes('recurrent') || raw.includes('dia') || raw.includes('día')) return 'day';
  if (raw.includes('cycle_week') || raw.includes('seman')) return 'week';
  if (raw.includes('cycle_month') || raw.includes('mensu') || raw.includes('mes')) return 'month';
  if (raw.includes('cycle_year') || raw.includes('anual') || raw.includes('año')) return 'year';

  return null;
};

/**
 * Detecta la periodicidad de un recordatorio individual según su cycle_id,
 * repeticiones diarias de hábito, lista de procedencia o sección asignada.
 */
export const getTaskPeriodicity = (
  task: TaskItem,
  sections?: ListSection[],
  lists?: CustomList[]
): PeriodicityType | null => {
  // 0. Prefijos en el título (ej. [D], [S], [M], [A])
  const title = (task.title || '').trim();
  if (/^\[D\]/i.test(title)) return 'day';
  if (/^\[S\]/i.test(title)) return 'week';
  if (/^\[M\]/i.test(title)) return 'month';
  if (/^\[A\]/i.test(title)) return 'year';

  // 1. cycle_id explícito
  if (task.cycle_id === 'cycle_day') return 'day';
  if (task.cycle_id === 'cycle_week') return 'week';
  if (task.cycle_id === 'cycle_month') return 'month';
  if (task.cycle_id === 'cycle_year') return 'year';

  // 2. Hábitos o contador diario
  if (task.targetCount && task.targetCount > 1) return 'day';

  // 3. Sublista o lista (ej. limpieza_diaria, limpieza_semanal, etc.)
  const catId = task.categoryId || (task as any).category_id;
  if (catId) {
    if (catId === 'limpieza_diaria') return 'day';
    if (catId === 'limpieza_semanal') return 'week';
    if (catId === 'limpieza_mensual') return 'month';
    if (catId === 'limpieza_anual') return 'year';

    const listObj = lists?.find(l => l.id === catId);
    const listName = (listObj?.name || catId).toLowerCase();
    if (listName.includes('diari') || listName.includes('recurrent') || listName === 'día' || listName === 'dia') return 'day';
    if (listName.includes('seman')) return 'week';
    if (listName.includes('mensu') || listName === 'mes') return 'month';
    if (listName.includes('anual') || listName === 'año') return 'year';
  }

  // 4. Sección manual
  const secId = task.sectionId || (task as any).section_id;
  if (secId) {
    const secObj = sections?.find(s => s.id === secId);
    const secText = `${secObj?.name || ''} ${secId}`.toLowerCase();
    if (secText.includes('diari') || secText.includes('recurrent') || secText.includes('dia') || secText.includes('día')) return 'day';
    if (secText.includes('seman')) return 'week';
    if (secText.includes('mensu') || secText.includes('mes')) return 'month';
    if (secText.includes('anual') || secText.includes('año')) return 'year';
  }

  return null;
};

/**
 * Retorna el conjunto de periodicidades que corresponden a la rutina de una sección.
 * - Mensual: Mensuales + Anuales + Semanales + Diarias (el día de limpieza mensual toca hacer todo eso).
 * - Semanal: Semanales + Diarias (el día semanal también se hace lo diario).
 * - Anual: Anuales + Mensuales + Semanales + Diarias (limpieza a fondo anual).
 * - Diaria: Diarias.
 */
export const getRoutineAllowedPeriodicities = (
  periodicity: PeriodicityType
): Set<PeriodicityType> => {
  switch (periodicity) {
    case 'month':
      return new Set<PeriodicityType>(['month', 'year', 'week', 'day']);
    case 'week':
      return new Set<PeriodicityType>(['week', 'day']);
    case 'year':
      return new Set<PeriodicityType>(['year', 'month', 'week', 'day']);
    case 'day':
    default:
      return new Set<PeriodicityType>(['day']);
  }
};

/**
 * Ordena las tareas de una rutina acumulativa de manera ordenada:
 * Primero las de la periodicidad principal, luego las anuales, semanales y diarias.
 */
export const sortTasksByRoutinePriority = (
  tasks: TaskItem[],
  primaryPeriodicity: PeriodicityType,
  sections?: ListSection[],
  lists?: CustomList[]
): TaskItem[] => {
  const priorityMap: Record<PeriodicityType, number> = primaryPeriodicity === 'month'
    ? { month: 0, year: 1, week: 2, day: 3 }
    : primaryPeriodicity === 'week'
    ? { week: 0, day: 1, month: 2, year: 3 }
    : primaryPeriodicity === 'year'
    ? { year: 0, month: 1, week: 2, day: 3 }
    : { day: 0, week: 1, month: 2, year: 3 };

  return [...tasks].sort((a, b) => {
    const pA = getTaskPeriodicity(a, sections, lists);
    const pB = getTaskPeriodicity(b, sections, lists);
    const valA = pA ? priorityMap[pA] ?? 99 : 99;
    const valB = pB ? priorityMap[pB] ?? 99 : 99;
    return valA - valB;
  });
};
