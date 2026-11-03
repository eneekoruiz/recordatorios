import type { ListSection, TaskItem } from '../../models/Task';
import { formatRestSeconds } from '../../utils/seriesTasks';
import {
  GYM_SPLITS_CONFIG,
  createDefaultGymRoutine,
  createFullBodyGymRoutine,
  createPplGymRoutine,
  getSectionGymSplit,
  type GymRoutineSplit
} from '../../utils/gymExercises';

/** Orden fijo en el que se ofrecen las rutinas. */
export const GYM_SPLIT_ORDER: GymRoutineSplit[] = ['torso_pierna_4d', 'ppl_3d', 'fullbody_3d'];

/** Nombre corto y legible de cada rutina (sin «(3 días)», que ya va en su propia etiqueta). */
const SPLIT_TITLES: Record<GymRoutineSplit, string> = {
  torso_pierna_4d: 'Torso / Pierna',
  ppl_3d: 'Empuje / Tirón / Pierna',
  fullbody_3d: 'Cuerpo completo'
};

/** Una línea que explica cómo se reparte la rutina. */
const SPLIT_TAGLINES: Record<GymRoutineSplit, string> = {
  torso_pierna_4d: 'Tren superior e inferior, alternos',
  ppl_3d: 'Pecho y hombro · Espalda · Pierna',
  fullbody_3d: 'Todo el cuerpo en cada sesión'
};

export function getGymSplitTagline(split: GymRoutineSplit): string {
  return SPLIT_TAGLINES[split] ?? '';
}

export function getGymSplitTitle(split: GymRoutineSplit): string {
  return SPLIT_TITLES[split] ?? GYM_SPLITS_CONFIG[split]?.name ?? 'Rutina';
}

export function getGymSplitDaysLabel(split: GymRoutineSplit): string {
  const days = GYM_SPLITS_CONFIG[split]?.daysCount ?? 0;
  return `${days} ${days === 1 ? 'día' : 'días'}`;
}

export interface GymDayName {
  /** «Día 1» (vacío si la sección no sigue ese patrón). */
  label: string;
  /** «Empuje» */
  focus: string;
  /** «Pecho, Hombro, Tríceps» (lo que iba entre paréntesis). */
  detail: string;
}

/** «Día 1: Empuje (Pecho, Hombro, Tríceps)» → { label: 'Día 1', focus: 'Empuje', detail: 'Pecho, Hombro, Tríceps' }. */
export function splitGymDayName(name: string): GymDayName {
  const raw = (name || '').trim();
  const match = raw.match(/^(d[ií]a\s*\d+)\s*[:·\-–]\s*(.*)$/i);
  const label = match ? match[1].replace(/^d[ií]a/i, 'Día') : '';
  const rest = match ? match[2] : raw;
  const paren = rest.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  return {
    label,
    focus: (paren ? paren[1] : rest).trim(),
    detail: paren ? paren[2].trim() : ''
  };
}

export interface GymRoutineDay {
  section: ListSection;
  exercises: TaskItem[];
}

/** Ejercicios de un día: sin borrados, sin filas de descanso y en su orden. */
export function getSectionExercises(sectionId: string, tasks: Record<string, TaskItem>): TaskItem[] {
  return Object.values(tasks)
    .filter(t => t.sectionId === sectionId && !t.deleted_at && !t.isRest && !t.parentId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function buildTemplate(split: GymRoutineSplit) {
  if (split === 'ppl_3d') return createPplGymRoutine('');
  if (split === 'fullbody_3d') return createFullBodyGymRoutine('');
  return createDefaultGymRoutine('');
}

/**
 * Días de una rutina con todos sus ejercicios. Manda lo que hay en la lista (con los cambios del
 * usuario); si esa rutina aún no se ha creado en la lista, se enseña la plantilla de fábrica para que
 * se pueda ver completa antes de activarla.
 */
export function resolveGymRoutineDays(
  split: GymRoutineSplit,
  listId: string,
  listSections: ListSection[],
  tasks: Record<string, TaskItem>
): { days: GymRoutineDay[]; daily: GymRoutineDay | null; fromTemplate: boolean } {
  const listSecs = listSections.filter(s => s.listId === listId && !s.deleted_at);
  const storeDays = listSecs
    .filter(s => getSectionGymSplit(s) === split)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const storeDaily = listSecs.find(s => getSectionGymSplit(s) === 'daily');

  if (storeDays.length > 0) {
    return {
      days: storeDays.map(section => ({ section, exercises: getSectionExercises(section.id, tasks) })),
      daily: storeDaily ? { section: storeDaily, exercises: getSectionExercises(storeDaily.id, tasks) } : null,
      fromTemplate: false
    };
  }

  const template = buildTemplate(split);
  const templateTasks = Object.fromEntries(template.tasks.map(t => [t.id, t]));
  const templateDays = template.sections
    .filter(s => getSectionGymSplit(s) === split)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const templateDaily = template.sections.find(s => getSectionGymSplit(s) === 'daily');
  const dailySource = storeDaily ? { section: storeDaily, exercises: getSectionExercises(storeDaily.id, tasks) }
    : templateDaily ? { section: templateDaily, exercises: getSectionExercises(templateDaily.id, templateTasks) } : null;

  return {
    days: templateDays.map(section => ({ section, exercises: getSectionExercises(section.id, templateTasks) })),
    daily: dailySource,
    fromTemplate: true
  };
}

/** 45 → «45 s», 60 → «1 min», 90 → «1 min 30 s». */
// Mismo formato que la fila del ejercicio en la lista («90 s», «2 min»…).
export { formatRestSeconds };

/** Más de 12 en el contador ya no son series, sino repeticiones (p. ej. «Abs 50»). */
const MAX_SETS = 12;

/** «4 series de 12-15 reps…» → «12–15»: las repeticiones solo vienen escritas en la descripción. */
export function parseRepsFromDescription(description?: string): string {
  const match = (description || '').match(/(\d+(?:\s*[-–]\s*\d+)?)\s*(?:reps\b|repeticiones)/i);
  return match ? match[1].replace(/\s*[-–]\s*/, '–') : '';
}

export interface ExerciseSummary {
  /** «4 × 12–15 reps», «4 series × 2 min», «50 repeticiones», «5 min» */
  volume: string;
  /** «Descanso 2 min» o vacío. */
  rest: string;
  /** Series para los totales del día (0 si no se cuenta por series). */
  sets: number;
}

export function summarizeExercise(task: TaskItem): ExerciseSummary {
  const count = typeof task.targetCount === 'number' && task.targetCount > 0 ? task.targetCount : 0;
  const mins = typeof task.duration === 'number' && task.duration > 0 ? task.duration : 0;
  const isReps = count > MAX_SETS;
  const sets = !isReps ? count : 0;
  let volume = '';
  if (isReps) {
    volume = `${count} repeticiones`;
  } else if (sets > 0) {
    const reps = parseRepsFromDescription(task.description);
    volume = reps
      ? `${sets} × ${reps} reps`
      : `${sets} ${sets === 1 ? 'serie' : 'series'}${mins ? ` × ${mins} min` : ''}`;
  } else if (mins) {
    volume = `${mins} min`;
  }
  const restSec = sets > 1 && typeof task.restDuration === 'number' && task.restDuration > 0 ? task.restDuration : 0;
  return { volume, rest: restSec ? `Descanso ${formatRestSeconds(restSec)}` : '', sets };
}

/** «6 ejercicios · 20 series» */
export function summarizeDay(exercises: TaskItem[]): string {
  const sets = exercises.reduce((acc, t) => acc + summarizeExercise(t).sets, 0);
  const parts = [`${exercises.length} ${exercises.length === 1 ? 'ejercicio' : 'ejercicios'}`];
  if (sets > 0) parts.push(`${sets} series`);
  return parts.join(' · ');
}

