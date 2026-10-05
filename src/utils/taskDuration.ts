/**
 * Task Duration & Parallel Tasks Engine.
 * 
 * Provides utilities to calculate, estimate, and format time investments
 * across tasks, sections, and entire lists, with dedicated support for
 * parallel/background tasks (e.g. washing machine, dishwasher, soaking).
 */

import type { TaskItem, ListSection, CustomList } from '../models/Task';
import { getTaskPeriodicity } from './sectionRoutine';
import { getListType, doesListSupportDuration } from './specialLists';
import { useAppStore, isTaskCompleted } from '../store/useAppStore';
import { isVitalHabitTask } from './vitalHabits';

export interface TaskDurationInfo {
  activeMinutes: number;
  parallelMinutes: number;
  isParallel: boolean;
}

export interface TasksDurationSummary {
  activeMinutes: number;
  parallelMinutes: number;
  parallelTasksCount: number;
  formattedActive: string;
  formattedParallel: string;
  formattedTotal: string;
}

/**
 * Regex identifying tasks that naturally execute in background/parallel
 * while the user can proceed with other active activities.
 */
export const PARALLEL_TASK_REGEX = /\b(lavadora|poner la lavadora|lavar la ropa|secadora|poner la secadora|lavavajillas|poner lavavajillas|fregaplatos|remojo|poner en remojo|descongelar|horno|hornear|pir[oó]lisis|robot aspirador|roomba|tintorer[ií]a|cortinas?|edred[oó]n|fundas? de sof[aá]|ropa de cama|almohadas?|mantas?|colada|mascarilla|mascarilla de cara|mascarilla facial|tinte|tinte de pelo|marinar|macerar|esmalte|pintar u[ñn]as|dejar secar|ventilar|ventilaci[oó]n)\b/i;

/**
 * Checks whether a task is a parallel / background task.
 */
export function isParallelTask(task?: TaskItem | null): boolean {
  if (!task) return false;
  if (task.isParallel === true) return true;
  return PARALLEL_TASK_REGEX.test(task.title || '');
}

/**
 * Checks whether a task has its duration explicitly disabled.
 */
export function isTaskDurationDisabled(task?: TaskItem | null): boolean {
  if (!task) return false;
  return task.disableDuration === true || task.duration === 0;
}

/**
 * Calculates estimated active and parallel duration in minutes for a single task.
 */
export function getTaskDuration(
  task: TaskItem,
  sectionsOrList?: ListSection[] | CustomList,
  lists?: CustomList[]
): TaskDurationInfo {
  if (!task) return { activeMinutes: 0, parallelMinutes: 0, isParallel: false };
  // Hábitos vitales: sin duración ni temporizador, aunque conserven un valor heredado.
  if (isVitalHabitTask(task)) return { activeMinutes: 0, parallelMinutes: 0, isParallel: false };

  const currentPassedList = sectionsOrList && !Array.isArray(sectionsOrList) ? (sectionsOrList as CustomList) : undefined;
  const sections = Array.isArray(sectionsOrList) ? sectionsOrList : undefined;
  const taskCat = task.categoryId || (task as any).category_id;
  const secId = task.sectionId || (task as any).section_id;

  let sectionName = '';
  if (secId && sections) {
    const sObj = sections.find(s => s.id === secId || s.id === `sec_${secId}` || s.id === `section_${secId}`);
    if (sObj) sectionName = (sObj.name || '').toLowerCase();
  }
  if (!sectionName && secId) {
    try {
      const allSecs = useAppStore.getState()?.listSections;
      const sObj = allSecs?.find(s => s.id === secId || s.id === `sec_${secId}` || s.id === `section_${secId}`);
      if (sObj) sectionName = (sObj.name || '').toLowerCase();
    } catch {}
  }

  const title = (task.title || '').toLowerCase();

  // 0a. Sección "¿Te aburres?" o lista de entretenimiento/ocio: NUNCA sumar duración
  const isBoredom = sectionName.includes('aburr') || title.includes('aburr') || (taskCat && String(taskCat).toLowerCase().includes('aburr'));
  if (isBoredom) {
    return { activeMinutes: 0, parallelMinutes: 0, isParallel: false };
  }

  // 0b. Sección "Recurrentes" o micro-hábitos recurrentes (beber agua, lavarse las manos/dientes):
  // No inflan la rutina diaria de quehaceres con horas artificiales.
  const isRecurrentSection = sectionName.includes('recurrent');
  const isExcludedMicroHabit = /\b(beber agua|vaso de agua|lavarse los dientes|lavar los dientes|cepillarse los dientes|lavarse las manos|lavar las manos)\b/i.test(title);
  if (isRecurrentSection || isExcludedMicroHabit) {
    return { activeMinutes: 0, parallelMinutes: 0, isParallel: false };
  }

  // 0c. Explicit duration set to 0 or disableDuration flag means the user intentionally disabled duration for this task
  if (isTaskDurationDisabled(task)) {
    return { activeMinutes: 0, parallelMinutes: 0, isParallel: false };
  }

  const parallel = isParallelTask(task);

  // 1. Explicit duration set on the task
  if (typeof task.duration === 'number' && task.duration > 0) {
    if (parallel) {
      const pDur = task.parallelDuration || (title.includes('mascarilla') ? 15 : 120);
      return { activeMinutes: task.duration, parallelMinutes: pDur, isParallel: true };
    }
    return { activeMinutes: task.duration, parallelMinutes: 0, isParallel: false };
  }

  // 1a. Explicit parallel flag without explicit duration
  if (task.isParallel) {
    const active = typeof task.duration === 'number' && task.duration > 0 ? task.duration : 3;
    const pDur = typeof task.parallelDuration === 'number' && task.parallelDuration > 0
      ? task.parallelDuration
      : (title.includes('mascarilla') ? 15 : 60);
    return { activeMinutes: active, parallelMinutes: pDur, isParallel: true };
  }

  // 1b. Duración aprendida previamente del usuario para esta tarea en el store
  if (task.id) {
    try {
      const learned = useAppStore.getState()?.learnedDurations?.[task.id];
      if (typeof learned === 'number' && learned > 0) {
        if (parallel) {
          const pDur = (task as any).parallelDuration || 120;
          return { activeMinutes: learned, parallelMinutes: pDur, isParallel: true };
        }
        return { activeMinutes: learned, parallelMinutes: 0, isParallel: false };
      }
    } catch {
      // Ignorar fuera de entorno React/Zustand
    }
  }

  // 1c. Comprobar si la lista a la que pertenece la tarea admite estimación de duración
  let allLists = lists || (currentPassedList ? [currentPassedList] : undefined);
  if (!allLists) {
    try {
      allLists = useAppStore.getState()?.lists;
    } catch {}
  }
  const currentList = currentPassedList || allLists?.find(l => l.id === taskCat);
  const listType = getListType(currentList, taskCat);

  // Si la lista tiene desactivada la estimación automática de duración, NO calculamos duraciones heurísticas
  if (currentList?.autoEstimateDuration === false) {
    return { activeMinutes: 0, parallelMinutes: 0, isParallel: false };
  }

  // Si la lista es de eventos, propósitos o lista simple (para apuntar cosas y ya está), NO inventamos duraciones
  if ((currentList || taskCat) && !doesListSupportDuration(listType)) {
    return { activeMinutes: 0, parallelMinutes: 0, isParallel: false };
  }

  // 2. Parallel tasks: small active setup time + large passive background time
  if (parallel) {
    if (title.includes('mascarilla') || title.includes('tinte')) {
      return { activeMinutes: 2, parallelMinutes: 15, isParallel: true }; // 2 min colocación + 15 min espera
    }
    if (title.includes('esmalte') || title.includes('uñas') || title.includes('dejar secar')) {
      return { activeMinutes: 2, parallelMinutes: 20, isParallel: true };
    }
    if (title.includes('marinar') || title.includes('macerar')) {
      return { activeMinutes: 3, parallelMinutes: 60, isParallel: true };
    }
    if (title.includes('ventilar') || title.includes('ventilacion') || title.includes('ventilación')) {
      return { activeMinutes: 1, parallelMinutes: 20, isParallel: true };
    }
    if (title.includes('lavadora') || title.includes('lavar la ropa') || title.includes('colada')) {
      return { activeMinutes: 5, parallelMinutes: 150, isParallel: true }; // 2h 30m
    }
    if (title.includes('secadora')) {
      return { activeMinutes: 3, parallelMinutes: 90, isParallel: true };  // 1h 30m
    }
    if (title.includes('lavavajillas') || title.includes('fregaplatos')) {
      return { activeMinutes: 5, parallelMinutes: 120, isParallel: true }; // 2h
    }
    if (title.includes('cortina') || title.includes('edred') || title.includes('manta') || title.includes('ropa de cama') || title.includes('funda') || title.includes('almohada')) {
      return { activeMinutes: 5, parallelMinutes: 120, isParallel: true }; // 2h en lavadora
    }
    if (title.includes('horno') || title.includes('hornear') || title.includes('remojo')) {
      return { activeMinutes: 5, parallelMinutes: 60, isParallel: true };  // 1h
    }
    if (title.includes('descongelar')) {
      return { activeMinutes: 2, parallelMinutes: 180, isParallel: true }; // 3h
    }
    if (title.includes('robot') || title.includes('roomba')) {
      return { activeMinutes: 3, parallelMinutes: 75, isParallel: true };  // 1h 15m
    }
    return { activeMinutes: 5, parallelMinutes: 120, isParallel: true };
  }

  // 3. Keyword-based heuristics for routine cleaning and common household tasks
  // Heavy / Deep tasks (30 - 40 min)
  if (
    title.includes('armario a fondo') || title.includes('persiana') ||
    title.includes('colchón') || title.includes('colchon') ||
    title.includes('reorganizar') || title.includes('despensa a fondo')
  ) {
    return { activeMinutes: 35, parallelMinutes: 0, isParallel: false };
  }

  // Thorough cleaning tasks (20 - 25 min)
  if (
    title.includes('a fondo') || title.includes('aspirar toda') ||
    title.includes('ducha') || title.includes('inodoro') ||
    title.includes('nevera') || title.includes('frigorífico') ||
    title.includes('microondas') || title.includes('cristales') ||
    title.includes('ventanas') || title.includes('sábana') ||
    title.includes('sabana') || title.includes('fregar a fondo')
  ) {
    return { activeMinutes: 25, parallelMinutes: 0, isParallel: false };
  }

  // Medium tasks (10 - 15 min)
  if (
    title.includes('plato') || title.includes('fregar') ||
    title.includes('vitro') || title.includes('barrer') ||
    title.includes('fregona') || title.includes('polvo') ||
    title.includes('toalla') || title.includes('ordenar') ||
    title.includes('despensa') || title.includes('mesa')
  ) {
    return { activeMinutes: 15, parallelMinutes: 0, isParallel: false };
  }

  // Quick daily tasks (3 - 5 min)
  if (
    title.includes('cama') || title.includes('acomodar') ||
    title.includes('basura') || title.includes('ventil') ||
    title.includes('recog') || title.includes('lavabo') ||
    title.includes('grifo') || title.includes('espejo') ||
    title.includes('dientes') || title.includes('pastilla') ||
    title.includes('agua') || title.includes('desayun')
  ) {
    return { activeMinutes: 5, parallelMinutes: 0, isParallel: false };
  }

  // 4. Periodicity-based realistic default (únicamente para listas de rutinas o tareas con periodicidad explícita)
  const periodicity = getTaskPeriodicity(task, sections, lists);
  if (periodicity && doesListSupportDuration(listType)) {
    switch (periodicity) {
      case 'day':
        return { activeMinutes: 5, parallelMinutes: 0, isParallel: false };
      case 'week':
        return { activeMinutes: 15, parallelMinutes: 0, isParallel: false };
      case 'month':
        return { activeMinutes: 20, parallelMinutes: 0, isParallel: false };
      case 'year':
        return { activeMinutes: 25, parallelMinutes: 0, isParallel: false };
    }
  }

  // Si está en una lista de rutinas/quehaceres/compra y no coincidió con ninguna palabra clave, asignar 10 min
  if (doesListSupportDuration(listType)) {
    return { activeMinutes: 10, parallelMinutes: 0, isParallel: false };
  }

  // Tareas estándar en listas de eventos, propósitos o checklist sin duración: 0 min
  return { activeMinutes: 0, parallelMinutes: 0, isParallel: false };
}

/**
 * Formats a duration in minutes into a clean human-readable string.
 * Examples: 5 -> "5 min", 45 -> "45 min", 60 -> "1 h", 90 -> "1 h 30 min", 150 -> "2 h 30 min"
 */
export function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '0 min';
  // Por debajo de la hora se respetan los segundos (hay tareas de casa de 45 s).
  const totalSeconds = Math.round(minutes * 60);
  if (totalSeconds < 60) return `${totalSeconds} s`;
  if (totalSeconds < 3600) {
    const wholeMinutes = Math.floor(totalSeconds / 60);
    const restSeconds = totalSeconds % 60;
    return restSeconds ? `${wholeMinutes} min ${restSeconds} s` : `${wholeMinutes} min`;
  }
  const mins = Math.round(minutes);

  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  // Como en iOS: «1 h 15 min», igual que «32 min 45 s» por debajo de la hora.
  if (remainingMins === 0) return `${hours} h`;
  return `${hours} h ${remainingMins} min`;
}

/**
 * Formato de duración para resúmenes de cabeceras y secciones al estilo Apple:
 * - Omite segundos ruidosos cuando la duración es >= 1 min (ej. 40.5 min -> 41 min, 4.5 min -> 5 min).
 * - Muestra segundos solo para microtareas < 1 min (ej. 0.75 min -> 45 s).
 * - No incluye tildes '~'.
 * - Formato limpio y humano: "41 min", "18 min", "1 min", "4 h 3 min".
 */
export function formatSummaryDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '0 min';
  if (minutes < 1) {
    const totalSeconds = Math.round(minutes * 60);
    return `${Math.max(1, totalSeconds)} s`;
  }
  const roundMins = Math.round(minutes);
  const hours = Math.floor(roundMins / 60);
  const remainingMins = roundMins % 60;
  if (hours === 0) return `${remainingMins} min`;
  if (remainingMins === 0) return `${hours} h`;
  return `${hours} h ${remainingMins} min`;
}

/** Minutos válidos: finitos y no negativos (nunca NaN/Infinity en un sumatorio). */
const safeMinutes = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);

const hasExplicitDuration = (t: TaskItem): boolean =>
  typeof t.duration === 'number' && Number.isFinite(t.duration) && t.duration > 0;

const EMPTY_SUMMARY: TasksDurationSummary = {
  activeMinutes: 0,
  parallelMinutes: 0,
  parallelTasksCount: 0,
  formattedActive: '0 min',
  formattedParallel: '0 min',
  formattedTotal: '0 min',
};

/**
 * Suma las duraciones de las tareas que cumplen `include`, evitando el doble conteo jerárquico:
 *  - si una tarea (o un ancestro) tiene duración explícita, esa cifra es el total del bloque y
 *    sus subtareas no se vuelven a sumar («Limpiar espejos» = 10 min en total, no 10 + 3 × 5);
 *  - si una tarea con subtareas presentes no tiene duración propia, solo suman sus subtareas.
 */
function aggregateDurations(
  tasks: TaskItem[],
  include: (t: TaskItem) => boolean,
  sections?: ListSection[],
  lists?: CustomList[]
): TasksDurationSummary {
  if (!tasks || tasks.length === 0) return { ...EMPTY_SUMMARY };

  const byId = new Map<string, TaskItem>();
  try {
    for (const t of Object.values(useAppStore.getState()?.tasks ?? {})) byId.set(t.id, t);
  } catch {
    // Fuera de un entorno con store (tests puros): se usa solo lo recibido.
  }
  for (const t of tasks) byId.set(t.id, t);

  const childrenInSet = new Set<string>();
  for (const t of tasks) if (t.parentId && !t.deleted_at) childrenInSet.add(t.parentId);

  const coveredByAncestor = (t: TaskItem): boolean => {
    const seen = new Set<string>([t.id]);
    let parentId = t.parentId;
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = byId.get(parentId);
      if (!parent || parent.deleted_at) return false;
      if (hasExplicitDuration(parent)) return true;
      parentId = parent.parentId;
    }
    return false;
  };

  let totalActive = 0;
  let maxParallel = 0;
  let parallelCount = 0;

  for (const t of tasks) {
    if (t.deleted_at || !include(t)) continue;
    if (coveredByAncestor(t)) continue;
    // Contenedor sin tiempo propio: lo aportan sus subtareas.
    if (childrenInSet.has(t.id) && !hasExplicitDuration(t)) continue;

    const info = getTaskDuration(t, sections, lists);
    totalActive += safeMinutes(info.activeMinutes);
    if (info.isParallel) {
      parallelCount++;
      maxParallel = Math.max(maxParallel, safeMinutes(info.parallelMinutes));
    }
  }

  const formattedActive = formatDuration(totalActive);
  const formattedParallel = formatDuration(maxParallel);
  return {
    activeMinutes: totalActive,
    parallelMinutes: maxParallel,
    parallelTasksCount: parallelCount,
    formattedActive,
    formattedParallel,
    formattedTotal: parallelCount > 0 ? `${formattedActive} (+ ${formattedParallel} paralelo)` : formattedActive,
  };
}

/**
 * Tiempo activo de lo PENDIENTE. Usa `isTaskCompleted` (el mismo criterio que la interfaz), de modo
 * que tachar/destachar —también metas con contador— recalcula el restante al instante.
 */
export function calculateTasksDuration(
  tasks: TaskItem[],
  sections?: ListSection[],
  lists?: CustomList[]
): TasksDurationSummary {
  return aggregateDurations(tasks, t => !isTaskCompleted(t), sections, lists);
}

/** Tiempo activo de lo ya COMPLETADO, con los mismos criterios que `calculateTasksDuration`. */
export function calculateCompletedTasksDuration(
  tasks: TaskItem[],
  sections?: ListSection[],
  lists?: CustomList[]
): TasksDurationSummary {
  return aggregateDurations(tasks, t => isTaskCompleted(t), sections, lists);
}
