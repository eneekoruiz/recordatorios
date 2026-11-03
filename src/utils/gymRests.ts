import type { ListSection, TaskItem } from '../models/Task';
import { getSectionGymSplit } from './gymExercises';
import { isTrainingDayName } from './trainingDays';

/**
 * Descansos entre ejercicios del Gimnasio (filas `isRest`).
 *
 * Reglas:
 * - Solo en los días de entrenamiento («Día 1: …», PPL, Full Body, Torso/Pierna): uno entre CADA par
 *   de ejercicios consecutivos, en el orden en que se ven.
 * - Nunca en la sección diaria/compartida (Core, Estiramientos…): ahí el usuario no los quiere.
 * - Un descanso que el usuario borró no se vuelve a crear.
 */

/** Prefijo de los descansos creados automáticamente (rutinas por defecto y limpieza de datos). */
export const GYM_REST_ID_PREFIX = 'task_gym_rest_';

export const DEFAULT_GYM_REST_MINUTES = 2;

const sectionOf = (t: TaskItem) => t.sectionId || (t as any).section_id;

/** ¿Es un día de entrenamiento (con descansos entre ejercicios) y no la sección diaria compartida? */
export function isGymTrainingDaySection(section: Pick<ListSection, 'id' | 'name'>): boolean {
  if (isTrainingDayName(section.name)) return true;
  const split = getSectionGymSplit(section as ListSection);
  return split === 'ppl_3d' || split === 'fullbody_3d' || split === 'torso_pierna_4d';
}

/** Mismo criterio que el orden manual de la lista: `order` y, a igualdad, el más antiguo antes. */
const byDisplayOrder = (a: TaskItem, b: TaskItem) => {
  const oa = a.order ?? 0;
  const ob = b.order ?? 0;
  if (oa !== ob) return oa - ob;
  return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
};

export interface GymRestPlan {
  /** Descansos nuevos que hay que crear. */
  create: TaskItem[];
  /** Órdenes que hay que reescribir (solo si había ejercicios con el mismo `order` y no cabía nada entre ellos). */
  reorder: Array<{ id: string; order: number }>;
  /** Descansos automáticos que sobran (los de la sección diaria): se borran con borrado suave. */
  remove: string[];
}

/**
 * Calcula qué hay que cambiar en una sección para que tenga un descanso entre cada par de ejercicios.
 * Es una función pura: recibe TODAS las tareas (también las borradas, para respetar los borrados).
 */
export function planGymRestsForSection(
  section: Pick<ListSection, 'id' | 'name'>,
  allTasks: TaskItem[],
  opts: { listId: string; userId?: string; createdAt?: string }
): GymRestPlan {
  const plan: GymRestPlan = { create: [], reorder: [], remove: [] };
  const inSection = allTasks.filter(t => t && sectionOf(t) === section.id && !t.parentId);
  const active = inSection.filter(t => !t.deleted_at);

  if (!isGymTrainingDaySection(section)) {
    // Sección diaria: fuera los descansos que puso la app (los que escribió el usuario se quedan).
    plan.remove = active.filter(t => t.isRest && t.id.startsWith(GYM_REST_ID_PREFIX)).map(t => t.id);
    return plan;
  }

  const sequence = [...active].sort(byDisplayOrder);
  const exercises = sequence.filter(t => !t.isRest);
  if (exercises.length < 2) return plan;

  // Si dos ejercicios comparten `order` no hay hueco entre ellos: se renumera la sección (0, 1, 2…)
  // conservando exactamente el orden que se ve.
  const orders = new Map(sequence.map(t => [t.id, t.order ?? 0]));
  const needsRenumber = exercises.some((t, i) => i > 0 && (orders.get(t.id)! <= orders.get(exercises[i - 1].id)!));
  if (needsRenumber) {
    sequence.forEach((t, i) => {
      if ((t.order ?? 0) !== i) plan.reorder.push({ id: t.id, order: i });
      orders.set(t.id, i);
    });
  }

  const existingIds = new Set(allTasks.map(t => t.id));
  const deletedRests = inSection.filter(t => t.isRest && t.deleted_at);

  // Recorre lo que se ve: entre dos ejercicios seguidos tiene que haber al menos un descanso.
  let prevExercise: TaskItem | null = null;
  let restSincePrev = false;
  for (const t of sequence) {
    if (t.isRest) { restSincePrev = true; continue; }
    if (prevExercise && !restSincePrev) {
      const lo = orders.get(prevExercise.id)!;
      const hi = orders.get(t.id)!;
      // Un descanso borrado por el usuario en este hueco: se respeta.
      const userDeletedHere = deletedRests.some(r => (r.order ?? 0) > lo && (r.order ?? 0) < hi);
      const id = `${GYM_REST_ID_PREFIX}after_${prevExercise.id}`;
      if (!userDeletedHere && !existingIds.has(id)) {
        existingIds.add(id);
        plan.create.push({
          id,
          user_id: opts.userId || '',
          type: 'task',
          categoryId: opts.listId,
          sectionId: section.id,
          title: 'Descanso entre ejercicios',
          description: 'Recuperar aire y pasar a la siguiente máquina.',
          duration: DEFAULT_GYM_REST_MINUTES,
          isRest: true,
          status: 'pending',
          order: (lo + hi) / 2,
          version: 1,
          created_at: opts.createdAt || new Date(0).toISOString(),
          updated_at: opts.createdAt || new Date(0).toISOString(),
        } as TaskItem);
      }
    }
    prevExercise = t;
    restSincePrev = false;
  }

  return plan;
}
