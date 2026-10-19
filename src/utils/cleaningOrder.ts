/**
 * Orden lógico de limpieza.
 *
 * Cuando se mezclan frecuencias (p. ej. el día de limpieza mensual, que junta mensuales,
 * semanales y diarias), el orden útil no es «primero todas las mensuales, luego las semanales…»
 * sino el orden en el que de verdad se hace el trabajo:
 *
 *   0. Preparar         — ventilar, recoger, ordenar, hacer la cama, vaciar el lavavajillas
 *   1. Arriba, en seco  — polvo, lámparas, campana, cortinas, puertas, interruptores
 *   2. Superficies      — encimera, horno, baño, espejos… (lo que no encaja en otra fase)
 *   3. Suelos, en seco  — aspirar, barrer
 *   4. Suelos, mojado   — fregar el suelo, mopa
 *   5. Para acabar      — sacar la basura, ambientador, toallas limpias
 *
 * Dentro de una misma fase se respeta el orden manual (`order`) y, a igualdad, la creación.
 * Es una heurística por palabras: si una tarea no encaja, queda en «superficies», que es la
 * fase intermedia, y nunca desaparece ni se reordena fuera de su habitación.
 */
import type { TaskItem } from '../models/Task';

export type CleaningPhase = 0 | 1 | 2 | 3 | 4 | 5;

const normalize = (text: string): string =>
  (text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// El orden de evaluación importa: «Recoger ropa del suelo» es preparar, no suelos;
// «Sacar la basura» es para acabar aunque empiece por un verbo de preparar.
const PHASE_RULES: Array<[CleaningPhase, RegExp]> = [
  [5, /\b(sacar|bajar|tirar)\b.*\b(basura|bolsas?|reciclaje|vidrio|carton|papel)\b|\bbasura\b|ambientador|\brecarga\b|\breponer\b|cambiar (las )?toallas|\btender\b|\bdoblar\b/],
  [0, /\bventila|abrir (las )?ventanas|\brecoger\b|\bordenar\b|\bdespejar\b|hacer (la )?cama|cambiar (las )?sabanas|quitar (las )?sabanas|poner (la )?lavadora|vaciar (el )?lavavajillas|(dejar|poner) (a |en )?remojo/],
  [4, /\bfregar (el |los )?suelos?\b|\bmopa\b|fregona/],
  [3, /\baspira|\bbarr(er|o)\b|\bsuelos?\b|\balfombras?\b|\bzocalos?\b/],
  [1, /\bpolvo\b|telaran|\blamparas?\b|\btechos?\b|ventilador|\bcampana\b|\bcortinas?\b|\bpersianas?\b|\bestanterias?\b|\bmarcos?\b|\bpuertas?\b|interruptor|\bpomos?\b|radiador|aire acondicionado/],
];

/** Fase de limpieza de una tarea según su título (2 = superficies si no encaja en otra). */
export function getCleaningPhase(title?: string | null): CleaningPhase {
  const text = normalize(title || '');
  for (const [phase, pattern] of PHASE_RULES) {
    if (pattern.test(text)) return phase;
  }
  return 2;
}

const byManualOrder = (a: Pick<TaskItem, 'order' | 'created_at'>, b: Pick<TaskItem, 'order' | 'created_at'>) => {
  const oa = a.order ?? 0;
  const ob = b.order ?? 0;
  if (oa !== ob) return oa - ob;
  return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
};

/**
 * Ordena por fase de limpieza y, dentro de cada fase, por el orden manual.
 * Intercala frecuencias: una diaria puede ir antes que una mensual y después otra semanal.
 */
export function sortByCleaningOrder<T extends Pick<TaskItem, 'title' | 'order' | 'created_at'>>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    const pa = getCleaningPhase(a.title);
    const pb = getCleaningPhase(b.title);
    if (pa !== pb) return pa - pb;
    return byManualOrder(a, b);
  });
}

/**
 * Las tareas sin habitación («General») se reparten en dos grupos para que el recorrido tenga
 * sentido: lo que se hace antes de entrar en las habitaciones (ventilar, recoger, quitar el polvo
 * de toda la casa…) y lo que se deja para el final (suelos de toda la casa, basura, ambientador).
 */
export function splitWholeHouseTasks<T extends Pick<TaskItem, 'title' | 'order' | 'created_at'>>(tasks: T[]): { start: T[]; end: T[] } {
  const start: T[] = [];
  const end: T[] = [];
  for (const task of sortByCleaningOrder(tasks)) {
    (getCleaningPhase(task.title) <= 2 ? start : end).push(task);
  }
  return { start, end };
}

export const WHOLE_HOUSE_START = { key: 'para_empezar', name: 'Para empezar' } as const;
export const WHOLE_HOUSE_END = { key: 'para_terminar', name: 'Para terminar' } as const;
