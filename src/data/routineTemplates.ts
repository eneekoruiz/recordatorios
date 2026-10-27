import type { PlannedExercise, Routine, RoutineSplit, TrainingDay } from '../models/Training';
import { getExercise } from './exerciseLibrary';

let counter = 0;
export const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Prescripción por defecto según el tipo de ejercicio: compuestos pesados y descansos largos, aislamiento ligero. */
export function plannedFrom(exerciseId: string, overrides: Partial<PlannedExercise> = {}): PlannedExercise {
  const def = getExercise(exerciseId);
  const kind = def?.kind ?? 'accesorio';
  const compound = kind === 'compuesto';
  return {
    id: newId('pe'),
    exerciseId,
    name: def?.name ?? exerciseId,
    sets: compound ? 4 : 3,
    repMin: compound ? 6 : 10,
    repMax: compound ? 10 : 15,
    rir: compound ? 2 : 1,
    restSec: compound ? 150 : 75,
    transitionRestSec: compound ? 150 : 90,
    ...overrides,
  };
}

const day = (name: string, ids: string[]): TrainingDay => ({ id: newId('day'), name, exercises: ids.map((id) => plannedFrom(id)) });

export const SPLIT_LABELS: Record<RoutineSplit, string> = {
  ppl: 'Empuje · Tirón · Pierna (3 días)',
  torso_pierna: 'Torso / Pierna (4 días)',
  full_body: 'Cuerpo completo (3 días)',
  five_day: '5 días',
  custom: 'Personalizada',
};

export function buildRoutine(split: RoutineSplit, name?: string): Routine {
  const now = Date.now();
  let days: TrainingDay[] = [];
  if (split === 'ppl') {
    days = [
      day('Empuje', ['press_banca', 'press_inclinado', 'press_militar', 'elevaciones_laterales', 'extension_polea']),
      day('Tirón', ['dominadas', 'remo_barra', 'jalon_pecho', 'face_pull', 'curl_barra']),
      day('Pierna', ['sentadilla', 'peso_muerto_rumano', 'prensa', 'curl_femoral', 'gemelos_pie']),
    ];
  } else if (split === 'torso_pierna') {
    days = [
      day('Torso A', ['press_banca', 'remo_barra', 'press_militar', 'jalon_pecho', 'curl_mancuernas', 'extension_polea']),
      day('Pierna A', ['sentadilla', 'peso_muerto_rumano', 'prensa', 'gemelos_pie']),
      day('Torso B', ['press_inclinado', 'dominadas', 'press_hombro_mancuernas', 'remo_polea', 'elevaciones_laterales', 'curl_polea']),
      day('Pierna B', ['peso_muerto', 'sentadilla_bulgara', 'curl_femoral', 'hip_thrust', 'gemelos_prensa']),
    ];
  } else if (split === 'full_body') {
    days = [
      day('Cuerpo completo A', ['sentadilla', 'press_banca', 'remo_barra', 'elevaciones_laterales', 'plancha']),
      day('Cuerpo completo B', ['peso_muerto_rumano', 'press_militar', 'jalon_pecho', 'zancadas', 'curl_mancuernas']),
      day('Cuerpo completo C', ['prensa', 'press_inclinado', 'remo_mancuerna', 'hip_thrust', 'extension_polea']),
    ];
  } else if (split === 'five_day') {
    days = [
      day('Pecho', ['press_banca', 'press_inclinado', 'aperturas_polea', 'extension_polea']),
      day('Espalda', ['dominadas', 'remo_barra', 'remo_polea', 'curl_barra']),
      day('Pierna', ['sentadilla', 'peso_muerto_rumano', 'prensa', 'gemelos_pie']),
      day('Hombro y brazo', ['press_militar', 'elevaciones_laterales', 'curl_mancuernas', 'press_frances']),
      day('Pierna y glúteo', ['hip_thrust', 'sentadilla_bulgara', 'curl_femoral', 'gemelos_prensa']),
    ];
  } else {
    days = [{ id: newId('day'), name: 'Día 1', exercises: [] }];
  }
  return { id: newId('routine'), name: name || (split === 'custom' ? 'Mi rutina' : SPLIT_LABELS[split].replace(/ \(.*\)/, '')), split, status: 'saved', days, nextDayIndex: 0, createdAt: now, updatedAt: now };
}
