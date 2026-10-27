/**
 * Entrenamiento de fuerza, patrones de comportamiento y sugerencias.
 * Todo son tipos de datos puros (sin lógica): la lógica vive en utils/strength, utils/sessionMachine
 * y utils/patternEngine, para poder probarla sin interfaz.
 */

// ── Ejercicios ───────────────────────────────────────────────────────────────
export type MuscleGroup =
  | 'pecho' | 'espalda' | 'hombros' | 'biceps' | 'triceps' | 'antebrazos'
  | 'cuadriceps' | 'isquios' | 'gluteos' | 'gemelos' | 'core';

export type ExerciseKind = 'compuesto' | 'accesorio' | 'aislamiento';
export type Equipment = 'barra' | 'mancuerna' | 'polea' | 'maquina' | 'peso_corporal' | 'kettlebell';

/** Ejercicio del catálogo: qué es y por cuáles puede sustituirse (máquina ocupada, molestia). */
export interface ExerciseDef {
  id: string;
  name: string;
  primary: MuscleGroup;
  secondary: MuscleGroup[];
  kind: ExerciseKind;
  equipment: Equipment;
  /** Ids de ejercicios equivalentes, de más a menos parecido. */
  alternatives: string[];
}

// ── Rutinas ──────────────────────────────────────────────────────────────────
/** Un ejercicio dentro de un día de la rutina, con su prescripción. */
export interface PlannedExercise {
  /** Identificador de esta instancia (el mismo ejercicio puede salir en varios días). */
  id: string;
  exerciseId: string;
  /** Copia del nombre: sigue valiendo si el ejercicio es personalizado o el catálogo cambia. */
  name: string;
  sets: number;
  repMin: number;
  repMax: number;
  /** Repeticiones en reserva objetivo (0 = fallo). */
  rir?: number;
  /** Descanso entre series de este ejercicio (s). */
  restSec: number;
  /** Descanso de transición al ejercicio siguiente (s). */
  transitionRestSec: number;
  /** Sustituto elegido para esta rutina (si no, valen las alternativas del catálogo). */
  alternativeIds?: string[];
  note?: string;
}

export interface TrainingDay {
  id: string;
  name: string;
  exercises: PlannedExercise[];
}

export type RoutineStatus = 'active' | 'saved' | 'paused' | 'archived';
export type RoutineSplit = 'ppl' | 'torso_pierna' | 'full_body' | 'five_day' | 'custom';

export interface Routine {
  id: string;
  name: string;
  split: RoutineSplit;
  status: RoutineStatus;
  days: TrainingDay[];
  /** Día que toca la próxima vez (avanza solo al terminar una sesión). */
  nextDayIndex: number;
  /** Semana de descarga en curso: se hacen menos series. */
  deload?: boolean;
  createdAt: number;
  updatedAt: number;
}

// ── Sesiones ─────────────────────────────────────────────────────────────────
export interface SetLog {
  exerciseInstanceId: string;
  exerciseId: string;
  exerciseName: string;
  /** Cuarta serie = 3. */
  setIndex: number;
  weightKg: number;
  reps: number;
  rir?: number;
  startedAt: number;
  completedAt: number;
  /** Descanso que se programó tras esta serie y el que se tomó de verdad (s). */
  restPlannedSec?: number;
  restTakenSec?: number;
  /** Segundos sumados (+) o restados (−) con los botones del temporizador. */
  restAdjustSec?: number;
  restSkipped?: boolean;
}

export interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  kind: 'e1rm' | 'weight';
  value: number;
  previous: number;
}

export interface TrainingSessionLog {
  id: string;
  routineId: string;
  routineName: string;
  dayId: string;
  dayName: string;
  startedAt: number;
  endedAt: number;
  sets: SetLog[];
  notes?: string;
  tonnageKg: number;
  durationSec: number;
  prs: PersonalRecord[];
}

export type SessionStatus = 'READY' | 'IN_SET' | 'RESTING' | 'EXERCISE_TRANSITION' | 'COMPLETED';

/** Estado de la sesión en directo: se guarda para poder retomarla si se cierra la app. */
export interface SessionState {
  status: SessionStatus;
  routineId: string;
  routineName: string;
  day: TrainingDay;
  startedAt: number;
  exerciseIndex: number;
  setIndex: number;
  /** Cuándo empezó la serie en curso. */
  setStartedAt: number | null;
  /** Descanso en curso: cuándo empezó, cuánto estaba programado y cuánto se ha ajustado. */
  restStartedAt: number | null;
  restPlannedSec: number;
  restAdjustSec: number;
  sets: SetLog[];
  notes: string;
  endedAt: number | null;
}

// ── Patrones y sugerencias ───────────────────────────────────────────────────
export type PatternEventType =
  | 'rest_ok' | 'rest_extended' | 'rest_shortened' | 'rest_skipped'
  | 'task_postponed' | 'task_skipped' | 'task_extended' | 'time_delta';

export interface PatternEvent {
  id: string;
  at: number;
  /** Dónde ocurrió: en un entrenamiento o en una tarea/lista corriente. */
  scope: 'training' | 'task' | 'list';
  /** exerciseId, taskId o listId según el ámbito. */
  subjectId: string;
  type: PatternEventType;
  /**
   * Magnitud en segundos: en descansos, lo tomado menos lo programado; en `time_delta`, lo real
   * menos lo estimado; en `task_extended`, lo añadido.
   */
  value?: number;
  /** Segundos programados/estimados, para calcular proporciones. */
  planned?: number;
}

export type InsightKind =
  | 'rest_default' | 'duration_adjust' | 'move_to_start' | 'skip_review' | 'deload';

export type InsightProposal =
  | { type: 'set_exercise_rest'; exerciseId: string; restSec: number }
  | { type: 'set_list_break'; listId: string; breakSeconds: number }
  | { type: 'set_task_duration'; taskId: string; minutes: number }
  | { type: 'move_task_first'; taskId: string }
  | { type: 'open_task'; taskId: string }
  | { type: 'start_deload'; routineId: string };

export type InsightStatus = 'pending' | 'accepted' | 'dismissed' | 'snoozed';

export interface PatternInsight {
  id: string;
  kind: InsightKind;
  scope: PatternEvent['scope'];
  subjectId: string;
  /** Frase lista para mostrar: pregunta concreta con el dato que la motiva. */
  message: string;
  /** Lo que hará «Aceptar». */
  proposal: InsightProposal;
  /** Con cuántas observaciones y qué mediana se llegó a esto (para fiarse o no de ella). */
  evidence: { observations: number; median: number };
  status: InsightStatus;
  createdAt: number;
  /** Hasta cuándo no se vuelve a mostrar (más tarde / descartada). */
  hiddenUntil?: number;
  /** Cuándo se resolvió: las observaciones anteriores ya no cuentan para volver a sugerir lo mismo. */
  resolvedAt?: number;
}
