import type { TaskItem, ListSection } from '../models/Task';
import { isTaskCompleted } from '../store/useAppStore';

const sameCalendarDay = (a: number | string | Date, b: number | string | Date): boolean => {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

/**
 * Obtiene la fecha más reciente de actividad de una tarea (logs de peso, compleción o actualización con series).
 */
export function getTaskLastActivityTimestamp(task: TaskItem): number {
  let latest = 0;

  // 1. Logs de peso
  if (Array.isArray(task.weightLogs) && task.weightLogs.length > 0) {
    for (const log of task.weightLogs) {
      if (log.date) {
        const t = new Date(log.date).getTime();
        if (Number.isFinite(t) && t > latest) latest = t;
      }
    }
  }

  // 2. Historial de compleción
  if (Array.isArray(task.completionHistory) && task.completionHistory.length > 0) {
    for (const h of task.completionHistory) {
      const t = Number(h);
      if (Number.isFinite(t) && t > latest) latest = t;
    }
  }

  // 3. completed_at
  if (task.completed_at) {
    const t = new Date(task.completed_at).getTime();
    if (Number.isFinite(t) && t > latest) latest = t;
  }

  // 4. updated_at si tiene series hechas o está completada
  if ((task.currentCount || 0) > 0 || task.status === 'completed') {
    if (task.updated_at) {
      const t = new Date(task.updated_at).getTime();
      if (Number.isFinite(t) && t > latest) latest = t;
    }
  }

  return latest;
}

/**
 * Comprueba si una sección de gimnasio tiene progreso genuino en el entrenamiento:
 * - Si solo tiene 1 serie de un ejercicio multi-serie (posible toque accidental al entrar o empezar y salir):
 *   NO se cuenta como día empezado.
 * - Cuenta como progreso genuino si:
 *   1. Cualquier ejercicio de 1 sola serie (ej: cardio) se ha completado.
 *   2. Cualquier ejercicio multi-serie tiene al menos 2 series hechas o está completado.
 *   3. Al menos 2 ejercicios distintos tienen alguna serie hecha.
 */
export function hasGenuineGymProgress(sectionTasks: TaskItem[]): boolean {
  if (!sectionTasks || sectionTasks.length === 0) return false;

  let progressExerciseCount = 0;

  for (const t of sectionTasks) {
    if (t.isRest || t.deleted_at) continue;
    const isDone = isTaskCompleted(t);
    const target = t.targetCount || 1;
    const current = t.currentCount || 0;

    // Ejercicio de serie única (ej: cardio) completado
    if (target === 1 && isDone) {
      return true;
    }

    // Ejercicio multi-serie con al menos 2 series o completado
    if (target > 1) {
      if (isDone || current >= 2) {
        return true;
      }
      if (current === 1) {
        progressExerciseCount++;
      }
    } else if (isDone) {
      return true;
    }
  }

  return progressExerciseCount >= 2;
}

/**
 * Comprueba si una sección del gimnasio se considera terminada:
 * - 100% de ejercicios completados.
 * - O al menos el 75% de las series / ejercicios completados (sesión terminada aunque falte algún ejercicio accesorio).
 * - O tiene progreso sustancial y la última actividad se registró en un día previo (entrenamiento de ayer ya concluido).
 */
export function isGymDayFullyDone(sectionTasks: TaskItem[], now: number = Date.now()): boolean {
  const exercises = sectionTasks.filter(t => !t.isRest && !t.deleted_at);
  if (exercises.length === 0) return false;

  // 1. Todo completado formalmente
  if (exercises.every(t => isTaskCompleted(t))) return true;

  // 2. Umbral de compleción alta (>= 75% de los ejercicios completados)
  const completedCount = exercises.filter(t => isTaskCompleted(t)).length;
  if (completedCount / exercises.length >= 0.75) return true;

  // 3. Umbral de series totales (>= 75% de series hechas)
  let totalTargetSets = 0;
  let totalDoneSets = 0;
  for (const t of exercises) {
    const target = t.targetCount || 1;
    totalTargetSets += target;
    totalDoneSets += isTaskCompleted(t) ? target : Math.min(target, t.currentCount || 0);
  }
  if (totalTargetSets > 0 && (totalDoneSets / totalTargetSets) >= 0.75) {
    return true;
  }

  // 4. Si tiene progreso genuino pero la actividad fue antes de hoy (ej: ayer), la sesión ya concluyó
  if (hasGenuineGymProgress(exercises)) {
    const latestActivity = Math.max(0, ...exercises.map(getTaskLastActivityTimestamp));
    if (latestActivity > 0 && !sameCalendarDay(latestActivity, now)) {
      return true;
    }
  }

  return false;
}

/**
 * Identifica qué día del gimnasio es el día activo / en curso actual:
 * 1. Anulación manual explícita (`manualOverrideSectionId`): el usuario manda en todo momento.
 * 2. Sesión activa hoy con progreso genuino que no haya terminado aún.
 * 3. Primer día pendiente en el orden de la rutina.
 * 4. Fallback al primer día.
 */
export function getActiveGymDaySectionId(
  sections: ListSection[],
  tasks: TaskItem[] | Record<string, TaskItem>,
  manualOverrideSectionId?: string | null,
  now: number = Date.now()
): string | null {
  const taskList = Array.isArray(tasks) ? tasks : Object.values(tasks || {});
  const gymDaySections = sections
    .filter(s => !s.deleted_at && /d[ií]a\s*\d/i.test(s.name))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (gymDaySections.length === 0) return null;

  // 0. Selección manual explícita del usuario
  if (manualOverrideSectionId) {
    const manualFound = gymDaySections.find(s => s.id === manualOverrideSectionId);
    if (manualFound) return manualFound.id;
  }

  // 1. Prioridad: Sección con progreso genuino realizado HOY que aún no esté completada
  for (const sec of gymDaySections) {
    const secTasks = taskList.filter(t => (t.sectionId === sec.id || (t as any).section_id === sec.id) && !t.deleted_at && !t.isRest);
    if (hasGenuineGymProgress(secTasks)) {
      const latestActivity = Math.max(0, ...secTasks.map(getTaskLastActivityTimestamp));
      const isActivityToday = latestActivity > 0 && sameCalendarDay(latestActivity, now);
      if (isActivityToday && !isGymDayFullyDone(secTasks, now)) {
        return sec.id;
      }
    }
  }

  // 2. Si no hay sesión empezada hoy, el primer día de la secuencia que no esté terminado
  for (const sec of gymDaySections) {
    const secTasks = taskList.filter(t => (t.sectionId === sec.id || (t as any).section_id === sec.id) && !t.deleted_at && !t.isRest);
    if (!isGymDayFullyDone(secTasks, now)) {
      return sec.id;
    }
  }

  // 3. Si todos los días están terminados (ciclo completado), rotar al siguiente día tras el último entrenado
  let lastTrainedIndex = -1;
  let maxTimestamp = 0;
  gymDaySections.forEach((sec, idx) => {
    const secTasks = taskList.filter(t => (t.sectionId === sec.id || (t as any).section_id === sec.id) && !t.deleted_at && !t.isRest);
    const activity = Math.max(0, ...secTasks.map(getTaskLastActivityTimestamp));
    if (activity > maxTimestamp) {
      maxTimestamp = activity;
      lastTrainedIndex = idx;
    }
  });

  if (lastTrainedIndex >= 0) {
    return gymDaySections[(lastTrainedIndex + 1) % gymDaySections.length].id;
  }

  // 4. Fallback: primer día
  return gymDaySections[0]?.id || null;
}
