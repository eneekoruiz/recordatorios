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

  // 1. Si es un section_id manual de la lista (con prefijo 'section_', 'sec_' o id directo)
  const secIdClean = sectionKeyOrId.startsWith('section_') ? sectionKeyOrId.replace('section_', '') :
                     sectionKeyOrId.startsWith('sec_') ? sectionKeyOrId : sectionKeyOrId;
  if (sections) {
    let sec = sections.find(s => s.id === secIdClean || s.id === `sec_${secIdClean}` || s.id === `section_${secIdClean}`);
    while (sec) {
      const secNorm = `${sec.id} ${sec.name}`.toLowerCase();
      if (secNorm.includes('diari') || secNorm.includes('recurrent') || /\b(d[ií]as?)\b/i.test(secNorm)) return 'day';
      if (secNorm.includes('seman') || /\b(sem)\b/i.test(secNorm)) return 'week';
      if (secNorm.includes('mensu') || /\b(mes(es)?)\b/i.test(secNorm)) return 'month';
      if (secNorm.includes('anual') || /\b(a[ñn]os?)\b/i.test(secNorm)) return 'year';
      sec = sec.parentId ? sections.find(s => s.id === sec!.parentId) : undefined;
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
 * Expresión regular para detectar prefijos de periodicidad en el título (ej. [D], [Diario], [Diaria], [S], [Semanal], [M], [Mensual], [A], [Anual] o con paréntesis).
 */
export const PERIODICITY_PREFIX_REGEX = /^\s*(\[|\()(D|Diari[oa]|S|Semanal|M|Mensual|A|Anual)(\]|\))\s*[:-]?\s*/i;

/**
 * Comprueba si un título contiene un prefijo de periodicidad al inicio.
 */
export const hasPeriodicityPrefix = (title?: string | null): boolean => {
  if (!title) return false;
  return PERIODICITY_PREFIX_REGEX.test(title);
};

/**
 * Extrae la periodicidad ('day' | 'week' | 'month' | 'year') a partir del prefijo en el título.
 */
export const getPeriodicityFromPrefix = (title?: string | null): PeriodicityType | null => {
  if (!title) return null;
  const trimmed = title.trim();
  if (/^(\[|\()(D|Diari[oa])(\]|\))/i.test(trimmed)) return 'day';
  if (/^(\[|\()(S|Semanal)(\]|\))/i.test(trimmed)) return 'week';
  if (/^(\[|\()(M|Mensual)(\]|\))/i.test(trimmed)) return 'month';
  if (/^(\[|\()(A|Anual)(\]|\))/i.test(trimmed)) return 'year';
  return null;
};

/**
 * Elimina cualquier prefijo de periodicidad en el título de la tarea (ej. "[D] Lavar rostro." -> "Lavar rostro."),
 * ya que la app dispone de una etiqueta visual dedicada con icono y nombre para identificar la frecuencia.
 */
export const stripPeriodicityPrefix = (title?: string | null): string => {
  if (!title) return '';
  return title.replace(PERIODICITY_PREFIX_REGEX, '').trim();
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
  const fromPrefix = getPeriodicityFromPrefix(task.title);
  if (fromPrefix) return fromPrefix;

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

  // 5. Sección manual asignada (con soporte para sub-secciones jerárquicas que heredan de su sección padre)
  const secId = task.sectionId || (task as any).section_id;
  if (secId) {
    const secLower = secId.toLowerCase();
    if (secLower.includes('diari')) return 'day';
    if (secLower.includes('seman')) return 'week';
    if (secLower.includes('mensu')) return 'month';
    if (secLower.includes('anual')) return 'year';

    let secObj = sections?.find(s => s.id === secId);
    while (secObj) {
      const secText = `${secObj.name || ''} ${secObj.id}`.toLowerCase();
      if (secText.includes('diari') || secText.includes('recurrent') || /\b(d[ií]as?)\b/i.test(secText)) return 'day';
      if (secText.includes('seman') || /\b(sem)\b/i.test(secText)) return 'week';
      if (secText.includes('mensu') || /\b(mes(es)?)\b/i.test(secText)) return 'month';
      if (secText.includes('anual') || /\b(a[ñn]os?)\b/i.test(secText)) return 'year';
      secObj = secObj.parentId ? sections?.find(s => s.id === secObj!.parentId) : undefined;
    }
  }

  return null;
};

/**
 * Retorna el cycle_id canónico ('cycle_day', 'cycle_week', etc.)
 * ya sea deducido de la periodicidad de la tarea (título [D]/[S]..., sección, lista)
 * o explícito en el task.cycle_id.
 */
export const getEffectiveCycleId = (
  task: Partial<TaskItem>,
  sections?: ListSection[],
  lists?: CustomList[]
): string | null => {
  const p = getTaskPeriodicity(task as TaskItem, sections, lists);
  if (p === 'day') return 'cycle_day';
  if (p === 'week') return 'cycle_week';
  if (p === 'month') return 'cycle_month';
  if (p === 'year') return 'cycle_year';
  if (task.cycle_id) return task.cycle_id;
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
 * @deprecated Agrupa las tareas en bloques por periodicidad (primero la principal, luego el
 * resto). Ya no se usa para renderizar ninguna vista de la app: agrupar en bloques es
 * precisamente el comportamiento que se reportó como no deseado ("primero todas las
 * mensuales, luego las semanales..."). Se mantiene solo por compatibilidad con código o
 * tests existentes que la importen; para ordenar vistas que mezclan periodicidades usa
 * `sortTasksByUserPreference`.
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

/**
 * Determina si un nombre de sección es EXACTAMENTE una de las cuatro periodicidades
 * estándar (Diaria/Semanal/Mensual/Anual), sin heurísticas de subcadena.
 *
 * A diferencia de `getSectionPeriodicity` (que también clasifica secciones personalizadas
 * cuyo nombre solo *menciona* la periodicidad, p. ej. "Compra semanal de fruta" → 'week'),
 * esta función solo devuelve una periodicidad cuando el nombre ES, literalmente, esa
 * periodicidad (tal y como los normaliza `formatSectionTitle`).
 *
 * Se usa para decidir de forma segura cuándo una sección manual es un duplicado literal
 * de la sección dinámica de ciclo (y debe fusionarse con ella) sin arrastrar accidentalmente
 * secciones personalizadas que solo contienen esa palabra en el nombre.
 */
export function getPureCyclicPeriodicity(name?: string | null): PeriodicityType | null {
  if (!name) return null;
  const clean = name.replace(/^⏳\s*/, '').trim().toLowerCase();
  if (['diaria', 'diarias', 'diario', 'diarios', 'recurrentes', 'recurrente'].includes(clean)) return 'day';
  if (['semanal', 'semanales'].includes(clean)) return 'week';
  if (['mensual', 'mensuales'].includes(clean)) return 'month';
  if (['anual', 'anuales'].includes(clean)) return 'year';
  return null;
}

/**
 * Unifica el formato de los títulos de sección (especialmente periódicas: Diarias, Semanales, etc.)
 * garantizando coherencia visual idéntica estilo Apple entre todas las listas (Quehaceres, Limpieza, etc.),
 * eliminando discrepancias de mayúsculas agresivas o singular/plural.
 */
export function formatSectionTitle(title?: string | null): string {
  if (!title) return '';
  const clean = title.replace(/^⏳\s*/, '').trim();

  // Periodicidades estándar unificadas en formato plural Apple (Diarias, Semanales, Mensuales, Anuales)
  const pureCyclic = getPureCyclicPeriodicity(clean);
  if (pureCyclic === 'day') return 'Diarias';
  if (pureCyclic === 'week') return 'Semanales';
  if (pureCyclic === 'month') return 'Mensuales';
  if (pureCyclic === 'year') return 'Anuales';

  const lower = clean.toLowerCase();
  if (lower === 'otra' || lower === 'otras' || lower === 'otras tareas') {
    return 'Otras';
  }

  // Si no es una periodicidad estándar y tiene prefijo temporal (ej. timeline "⏳ Marzo 2026"), preservar título
  if (title.startsWith('⏳')) {
    return title;
  }

  // Si está completamente en mayúsculas (ej. "COCINA", "NOTAS", "TARJETAS"), pasar a Title Case limpio
  if (clean.length > 2 && clean === clean.toUpperCase() && !/^\d+$/.test(clean)) {
    return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
  }

  return clean;
}

export type TaskSortMode = 'manual' | 'dueDate' | 'priority' | 'title' | 'createdAt';

/**
 * Única función de ordenación de tareas de toda la aplicación cuando se mezclan
 * periodicidades distintas (p. ej. la "rutina completa" de un día de limpieza mensual,
 * que junta diarias + semanales + mensuales + anuales).
 *
 * A propósito NO tiene en cuenta la periodicidad de la tarea: ordena únicamente según el
 * criterio que el usuario ha elegido para la lista (manual, fecha límite, prioridad, título
 * o creación), exactamente igual que para una sección normal. Así, al ver "todas" las tareas
 * de una rutina, quedan intercaladas por su valor/orden cronológico real en vez de agrupadas
 * en bloques por periodicidad (primero todas las mensuales, luego las semanales, etc.).
 *
 * Se usa tanto para las secciones normales (`MainContent.sortTaskList`, que delega aquí)
 * como para cualquier vista que combine periodicidades, garantizando que el orden entre
 * tareas es siempre el mismo en toda la app.
 */
export function sortTasksByUserPreference(taskList: TaskItem[], sortBy: TaskSortMode): TaskItem[] {
  if (sortBy === 'manual') {
    return [...taskList].sort((a, b) => {
      const orderA = a.order ?? 0;
      const orderB = b.order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }
  return [...taskList].sort((a, b) => {
    if (sortBy === 'dueDate') {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    if (sortBy === 'priority') {
      const pMap: Record<string, number> = { high: 3, medium: 2, low: 1, none: 0 };
      return (pMap[b.priority || 'none'] || 0) - (pMap[a.priority || 'none'] || 0);
    }
    if (sortBy === 'title') {
      return (a.title || '').localeCompare(b.title || '', 'es', { sensitivity: 'base' });
    }
    if (sortBy === 'createdAt') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    return 0;
  });
}
