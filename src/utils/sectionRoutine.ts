import type { TaskItem, CustomList, ListSection } from '../models/Task';
import type { PeriodicityType } from '../../shared/periodicity.js';
import { PERIODICITY_PREFIX_REGEX, getTaskPeriodicity } from '../../shared/periodicity.js';

// La detección de periodicidad vive en shared/ para que el servidor (avisos push)
// cuente exactamente lo mismo que la app.
export type { PeriodicityType };
export {
  PERIODICITY_PREFIX_REGEX,
  getPeriodicityFromPrefix,
  getTaskPeriodicity,
  getEffectiveCycleId,
} from '../../shared/periodicity.js';

/**
 * Detecta la periodicidad temporal de una sección a partir de su clave, título, objeto sección o lista.
 */
export const getSectionPeriodicity = (
  sectionKeyOrId: string,
  title?: string,
  sections?: ListSection[],
  lists?: CustomList[]
): PeriodicityType | null => {
  const raw = `${sectionKeyOrId || ''} ${title || ''}`.toLowerCase();

  // 1. Si es un section_id manual de la lista (con prefijo 'section_', 'sec_' o id directo)
  const safeKey = sectionKeyOrId || '';
  const secIdClean = safeKey.startsWith('section_') ? safeKey.replace('section_', '') :
                     safeKey.startsWith('sec_') ? safeKey : safeKey;
  if (sections) {
    let sec = sections.find(s => s.id === secIdClean || s.id === `sec_${secIdClean}` || s.id === `section_${secIdClean}`);
    while (sec) {
      const secNorm = `${sec.id || ''} ${sec.name || ''}`.toLowerCase();
      if (secNorm.includes('diari') || secNorm.includes('recurrent') || /\b(d[ií]as?)\b/i.test(secNorm)) return 'day';
      if (secNorm.includes('seman') || /\b(sem)\b/i.test(secNorm)) return 'week';
      if (secNorm.includes('mensu') || /\b(mes(es)?)\b/i.test(secNorm)) return 'month';
      if (secNorm.includes('anual') || /\b(a[ñn]os?)\b/i.test(secNorm)) return 'year';
      sec = sec.parentId ? sections.find(s => s.id === sec!.parentId) : undefined;
    }
  }

  // 2. Si es una lista (o sublista en carpetas, ej. limpieza_mensual)
  if (lists) {
    const listObj = lists.find(l => l.id === safeKey || (l.name || '').toLowerCase() === safeKey.toLowerCase());
    if (listObj) {
      const lNorm = `${listObj.id || ''} ${listObj.name || ''}`.toLowerCase();
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
 * Comprueba si un título contiene un prefijo de periodicidad al inicio.
 */
export const hasPeriodicityPrefix = (title?: string | null): boolean => {
  if (!title) return false;
  return PERIODICITY_PREFIX_REGEX.test(title);
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
  if (!name || typeof name !== 'string') return null;
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
  if (!title || typeof title !== 'string') return '';
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
