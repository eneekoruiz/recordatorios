import type { TaskItem, ListSection } from '../models/Task';
import { isTaskCompleted } from '../store/useAppStore';

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
 * Comprueba si una sección del gimnasio está completamente terminada.
 */
export function isGymDayFullyDone(sectionTasks: TaskItem[]): boolean {
  const exercises = sectionTasks.filter(t => !t.isRest && !t.deleted_at);
  if (exercises.length === 0) return false;
  return exercises.every(t => isTaskCompleted(t));
}

/**
 * Identifica qué día del gimnasio es el día activo / en curso actual:
 * Si el usuario decide hacer el Día 2 en vez del Día 1 y empieza a registrar series,
 * la aplicación detecta el progreso genuino y se adapta automáticamente.
 */
export function getActiveGymDaySectionId(
  sections: ListSection[],
  tasks: TaskItem[] | Record<string, TaskItem>
): string | null {
  const taskList = Array.isArray(tasks) ? tasks : Object.values(tasks || {});
  const gymDaySections = sections
    .filter(s => /d[ií]a\s*\d/i.test(s.name))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (gymDaySections.length === 0) return null;

  // 1. Prioridad: Sección con progreso genuino que aún no esté terminada
  for (const sec of gymDaySections) {
    const secTasks = taskList.filter(t => (t.sectionId === sec.id || (t as any).section_id === sec.id) && !t.deleted_at && !t.isRest);
    if (!isGymDayFullyDone(secTasks) && hasGenuineGymProgress(secTasks)) {
      return sec.id;
    }
  }

  // 2. Si no hay ninguna con progreso en curso, el primer día pendiente
  for (const sec of gymDaySections) {
    const secTasks = taskList.filter(t => (t.sectionId === sec.id || (t as any).section_id === sec.id) && !t.deleted_at && !t.isRest);
    if (!isGymDayFullyDone(secTasks)) {
      return sec.id;
    }
  }

  // 3. Fallback: primer día
  return gymDaySections[0]?.id || null;
}
