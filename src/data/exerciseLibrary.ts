import type { ExerciseDef, MuscleGroup } from '../models/Training';

const E = (
  id: string, name: string, primary: MuscleGroup, secondary: MuscleGroup[],
  kind: ExerciseDef['kind'], equipment: ExerciseDef['equipment'], alternatives: string[],
): ExerciseDef => ({ id, name, primary, secondary, kind, equipment, alternatives });

/** Catálogo básico. El usuario puede añadir ejercicios propios; estos son el punto de partida. */
export const EXERCISE_LIBRARY: ExerciseDef[] = [
  // Pecho
  E('press_banca', 'Press de banca', 'pecho', ['triceps', 'hombros'], 'compuesto', 'barra', ['press_mancuernas', 'press_pecho_maquina', 'fondos']),
  E('press_inclinado', 'Press inclinado con mancuernas', 'pecho', ['hombros', 'triceps'], 'compuesto', 'mancuerna', ['press_banca', 'press_pecho_maquina']),
  E('press_mancuernas', 'Press de banca con mancuernas', 'pecho', ['triceps', 'hombros'], 'compuesto', 'mancuerna', ['press_banca', 'press_pecho_maquina']),
  E('press_pecho_maquina', 'Press de pecho en máquina', 'pecho', ['triceps'], 'compuesto', 'maquina', ['press_mancuernas', 'press_banca']),
  E('fondos', 'Fondos en paralelas', 'pecho', ['triceps', 'hombros'], 'compuesto', 'peso_corporal', ['press_banca', 'press_cierre']),
  E('aperturas_polea', 'Aperturas en polea', 'pecho', [], 'aislamiento', 'polea', ['aperturas_mancuernas', 'contractor']),
  E('aperturas_mancuernas', 'Aperturas con mancuernas', 'pecho', [], 'aislamiento', 'mancuerna', ['aperturas_polea', 'contractor']),
  E('contractor', 'Contractor (pec deck)', 'pecho', [], 'aislamiento', 'maquina', ['aperturas_polea']),
  // Espalda
  E('dominadas', 'Dominadas', 'espalda', ['biceps'], 'compuesto', 'peso_corporal', ['jalon_pecho', 'remo_polea']),
  E('jalon_pecho', 'Jalón al pecho', 'espalda', ['biceps'], 'compuesto', 'polea', ['dominadas', 'remo_polea']),
  E('remo_barra', 'Remo con barra', 'espalda', ['biceps', 'isquios'], 'compuesto', 'barra', ['remo_mancuerna', 'remo_polea', 'remo_maquina']),
  E('remo_mancuerna', 'Remo con mancuerna', 'espalda', ['biceps'], 'compuesto', 'mancuerna', ['remo_barra', 'remo_polea']),
  E('remo_polea', 'Remo en polea baja', 'espalda', ['biceps'], 'compuesto', 'polea', ['remo_maquina', 'remo_mancuerna']),
  E('remo_maquina', 'Remo en máquina', 'espalda', ['biceps'], 'compuesto', 'maquina', ['remo_polea', 'remo_mancuerna']),
  E('peso_muerto', 'Peso muerto', 'espalda', ['isquios', 'gluteos'], 'compuesto', 'barra', ['peso_muerto_rumano', 'hip_thrust']),
  // Hombros
  E('press_militar', 'Press militar', 'hombros', ['triceps'], 'compuesto', 'barra', ['press_hombro_mancuernas', 'press_hombro_maquina']),
  E('press_hombro_mancuernas', 'Press de hombro con mancuernas', 'hombros', ['triceps'], 'compuesto', 'mancuerna', ['press_militar', 'press_hombro_maquina']),
  E('press_hombro_maquina', 'Press de hombro en máquina', 'hombros', ['triceps'], 'compuesto', 'maquina', ['press_hombro_mancuernas']),
  E('elevaciones_laterales', 'Elevaciones laterales', 'hombros', [], 'aislamiento', 'mancuerna', ['elevaciones_polea']),
  E('elevaciones_polea', 'Elevaciones laterales en polea', 'hombros', [], 'aislamiento', 'polea', ['elevaciones_laterales']),
  E('pajaros', 'Pájaros (deltoide posterior)', 'hombros', ['espalda'], 'aislamiento', 'mancuerna', ['face_pull']),
  E('face_pull', 'Face pull', 'hombros', ['espalda'], 'accesorio', 'polea', ['pajaros']),
  // Brazos
  E('curl_barra', 'Curl con barra', 'biceps', ['antebrazos'], 'aislamiento', 'barra', ['curl_mancuernas', 'curl_polea']),
  E('curl_mancuernas', 'Curl con mancuernas', 'biceps', ['antebrazos'], 'aislamiento', 'mancuerna', ['curl_barra', 'curl_polea']),
  E('curl_polea', 'Curl en polea', 'biceps', [], 'aislamiento', 'polea', ['curl_mancuernas']),
  E('press_cierre', 'Press de banca agarre cerrado', 'triceps', ['pecho'], 'compuesto', 'barra', ['fondos', 'extension_polea']),
  E('extension_polea', 'Extensión de tríceps en polea', 'triceps', [], 'aislamiento', 'polea', ['press_frances']),
  E('press_frances', 'Press francés', 'triceps', [], 'aislamiento', 'barra', ['extension_polea']),
  // Piernas
  E('sentadilla', 'Sentadilla con barra', 'cuadriceps', ['gluteos', 'isquios', 'core'], 'compuesto', 'barra', ['prensa', 'sentadilla_bulgara', 'sentadilla_goblet']),
  E('sentadilla_bulgara', 'Sentadilla búlgara', 'cuadriceps', ['gluteos'], 'compuesto', 'mancuerna', ['prensa', 'zancadas']),
  E('sentadilla_goblet', 'Sentadilla goblet', 'cuadriceps', ['gluteos', 'core'], 'compuesto', 'kettlebell', ['prensa', 'sentadilla_bulgara']),
  E('prensa', 'Prensa de piernas', 'cuadriceps', ['gluteos'], 'compuesto', 'maquina', ['sentadilla_bulgara', 'sentadilla_goblet']),
  E('zancadas', 'Zancadas', 'cuadriceps', ['gluteos', 'isquios'], 'compuesto', 'mancuerna', ['sentadilla_bulgara', 'prensa']),
  E('extension_cuadriceps', 'Extensión de cuádriceps', 'cuadriceps', [], 'aislamiento', 'maquina', ['sentadilla_bulgara']),
  E('peso_muerto_rumano', 'Peso muerto rumano', 'isquios', ['gluteos', 'espalda'], 'compuesto', 'barra', ['curl_femoral', 'hip_thrust']),
  E('curl_femoral', 'Curl femoral', 'isquios', [], 'aislamiento', 'maquina', ['peso_muerto_rumano']),
  E('hip_thrust', 'Hip thrust', 'gluteos', ['isquios'], 'compuesto', 'barra', ['peso_muerto_rumano', 'puente_gluteo']),
  E('puente_gluteo', 'Puente de glúteo', 'gluteos', ['isquios'], 'accesorio', 'peso_corporal', ['hip_thrust']),
  E('gemelos_pie', 'Gemelos de pie', 'gemelos', [], 'aislamiento', 'maquina', ['gemelos_prensa']),
  E('gemelos_prensa', 'Gemelos en prensa', 'gemelos', [], 'aislamiento', 'maquina', ['gemelos_pie']),
  // Core
  E('plancha', 'Plancha', 'core', [], 'accesorio', 'peso_corporal', ['crunch_polea']),
  E('crunch_polea', 'Crunch en polea', 'core', [], 'aislamiento', 'polea', ['plancha']),
  E('elevacion_piernas', 'Elevación de piernas', 'core', [], 'accesorio', 'peso_corporal', ['crunch_polea']),
];

const BY_ID = new Map(EXERCISE_LIBRARY.map((e) => [e.id, e]));
export const getExercise = (id: string): ExerciseDef | undefined => BY_ID.get(id);

/** Alternativas equivalentes del catálogo (más las que la rutina haya fijado), sin repetir ni incluir el propio. */
export function alternativesFor(exerciseId: string, extra: string[] = []): ExerciseDef[] {
  const ids = [...extra, ...(BY_ID.get(exerciseId)?.alternatives ?? [])];
  const seen = new Set<string>([exerciseId]);
  const out: ExerciseDef[] = [];
  for (const id of ids) {
    const def = BY_ID.get(id);
    if (def && !seen.has(id)) { seen.add(id); out.push(def); }
  }
  return out;
}

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  pecho: 'Pecho', espalda: 'Espalda', hombros: 'Hombros', biceps: 'Bíceps', triceps: 'Tríceps', antebrazos: 'Antebrazos',
  cuadriceps: 'Cuádriceps', isquios: 'Isquios', gluteos: 'Glúteos', gemelos: 'Gemelos', core: 'Core',
};
