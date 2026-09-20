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
      if (secNorm.includes('diari') || secNorm.includes('recurrent') || /\b(d[ií]as?)\b/i.test(secNorm)) return 'day';
      if (secNorm.includes('seman') || /\b(sem)\b/i.test(secNorm)) return 'week';
      if (secNorm.includes('mensu') || /\b(mes(es)?)\b/i.test(secNorm)) return 'month';
      if (secNorm.includes('anual') || /\b(a[ñn]os?)\b/i.test(secNorm)) return 'year';
    }
  }

  // 2. Si es una lista (o sublista en carpetas, ej. limpieza_mensual)
  if (lists) {
    const listObj = lists.find(l => l.id === sectionKeyOrId || l.name.toLowerCase() === sectionKeyOrId.toLowerCase());
    if (listObj) {
      const lNorm = `${listObj.id} ${listObj.name}`.toLowerCase();
      if (lNorm.includes('diari') || lNorm.includes('recurrent') || /\b(d[ií]as?)\b/i.test(lNorm)) return 'day';
      if (lNorm.includes('seman') || /\b(sem)\b/i.test(lNorm)) return 'week';
      if (lNorm.includes('mensu') || /\b(mes(es)?)\b/i.test(lNorm)) return 'month';
      if (lNorm.includes('anual') || /\b(a[ñn]os?)\b/i.test(lNorm)) return 'year';
    }
  }

  // 3. Patrones generales por texto / ciclo
  if (raw.includes('cycle_day') || raw.includes('diari') || raw.includes('recurrent') || /\b(d[ií]as?)\b/i.test(raw)) return 'day';
  if (raw.includes('cycle_week') || raw.includes('seman') || /\b(sem)\b/i.test(raw)) return 'week';
  if (raw.includes('cycle_month') || raw.includes('mensu') || /\b(mes(es)?)\b/i.test(raw)) return 'month';
  if (raw.includes('cycle_year') || raw.includes('anual') || /\b(a[ñn]os?)\b/i.test(raw)) return 'year';

  return null;
};

/**
 * Detecta la periodicidad de un recordatorio individual según su cycle_id,
 * repeticiones diarias de hábito, lista de procedencia, título o sección asignada.
 */
export const getTaskPeriodicity = (
  task: TaskItem,
  sections?: ListSection[],
  lists?: CustomList[]
): PeriodicityType | null => {
  // 0. Prefijos y etiquetas en el título (ej. [D], [Diario], [Diaria], [S], [Semanal], [M], [Mensual], [A], [Anual] o en paréntesis)
  const title = (task.title || '').trim();
  if (/(\[|\()(D|Diari[oa])(\]|\))/i.test(title)) return 'day';
  if (/(\[|\()(S|Semanal)(\]|\))/i.test(title)) return 'week';
  if (/(\[|\()(M|Mensual)(\]|\))/i.test(title)) return 'month';
  if (/(\[|\()(A|Anual)(\]|\))/i.test(title)) return 'year';

  // 1. cycle_id explícito
  if (task.cycle_id) {
    const c = task.cycle_id.toLowerCase();
    if (c === 'cycle_day' || c.includes('day') || c.includes('diari')) return 'day';
    if (c === 'cycle_week' || c.includes('week') || c.includes('seman')) return 'week';
    if (c === 'cycle_month' || c.includes('month') || c.includes('mensu')) return 'month';
    if (c === 'cycle_year' || c.includes('year') || c.includes('anual')) return 'year';
  }

  // 2. frequencyLevel si viene de importación o metadato
  const freq = (((task as any).frequencyLevel || (task as any).frequency) || '').toString().toLowerCase();
  if (freq.includes('day') || freq.includes('diari')) return 'day';
  if (freq.includes('week') || freq.includes('seman')) return 'week';
  if (freq.includes('month') || freq.includes('mensu')) return 'month';
  if (freq.includes('year') || freq.includes('anual')) return 'year';

  // 3. Hábitos o contador diario
  if (task.targetCount && task.targetCount > 1) return 'day';

  // 4. Sublista o lista (ej. limpieza_diaria, limpieza_semanal, etc.)
  const catId = task.categoryId || (task as any).category_id;
  if (catId) {
    const catLower = catId.toLowerCase();
    if (catLower === 'limpieza_diaria' || catLower.includes('diari')) return 'day';
    if (catLower === 'limpieza_semanal' || catLower.includes('seman')) return 'week';
    if (catLower === 'limpieza_mensual' || catLower.includes('mensu')) return 'month';
    if (catLower === 'limpieza_anual' || catLower.includes('anual')) return 'year';

    const listObj = lists?.find(l => l.id === catId);
    if (listObj) {
      const listName = (listObj.name || catId).toLowerCase();
      if (listName.includes('diari') || listName.includes('recurrent') || /\b(d[ií]as?)\b/i.test(listName)) return 'day';
      if (listName.includes('seman') || /\b(sem)\b/i.test(listName)) return 'week';
      if (listName.includes('mensu') || /\b(mes(es)?)\b/i.test(listName)) return 'month';
      if (listName.includes('anual') || /\b(a[ñn]os?)\b/i.test(listName)) return 'year';
    }
  }

  // 5. Sección manual asignada
  const secId = task.sectionId || (task as any).section_id;
  if (secId) {
    const secLower = secId.toLowerCase();
    if (secLower.includes('diari')) return 'day';
    if (secLower.includes('seman')) return 'week';
    if (secLower.includes('mensu')) return 'month';
    if (secLower.includes('anual')) return 'year';

    const secObj = sections?.find(s => s.id === secId);
    if (secObj) {
      const secText = `${secObj.name || ''} ${secId}`.toLowerCase();
      if (secText.includes('diari') || secText.includes('recurrent') || /\b(d[ií]as?)\b/i.test(secText)) return 'day';
      if (secText.includes('seman') || /\b(sem)\b/i.test(secText)) return 'week';
      if (secText.includes('mensu') || /\b(mes(es)?)\b/i.test(secText)) return 'month';
      if (secText.includes('anual') || /\b(a[ñn]os?)\b/i.test(secText)) return 'year';
    }
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
