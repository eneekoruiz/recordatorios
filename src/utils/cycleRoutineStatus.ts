import type { TaskItem, CustomCycle, ListSection, CustomList } from '../models/Task';
import { isTaskCompleted } from '../store/useAppStore';
import { isCompletedInCurrentPeriod } from '../services/TaskService';
import { getEffectiveCycleId } from './sectionRoutine';

export interface CycleRoutineStatus {
  /** ID del ciclo propio de la vista (ej: 'cycle_month') */
  ownCycleId: string;
  /** Nombre del ciclo propio (ej: 'Mensual') */
  ownCycleName: string;
  /** Color del ciclo propio */
  ownColor?: string;
  /** Total de tareas del propio ciclo */
  ownTotal: number;
  /** Tareas del propio ciclo completadas en este período */
  ownCompleted: number;
  /** Tareas del propio ciclo pendientes en este período */
  ownPending: number;

  /** Total de tareas acumuladas (de frecuencias más cortas) */
  accumulatedTotal: number;
  /** Tareas acumuladas completadas en sus períodos */
  accumulatedCompleted: number;
  /** Tareas acumuladas pendientes */
  accumulatedPending: number;

  /** Desglose de tareas diarias */
  dailyTotal: number;
  dailyCompleted: number;
  dailyPending: number;

  /** Desglose de tareas semanales */
  weeklyTotal: number;
  weeklyCompleted: number;
  weeklyPending: number;

  /** Meta total de tareas (propias o propias + acumuladas según el modo) */
  totalGoal: number;
  /** Total de tareas completadas */
  totalCompleted: number;
  /** Total de tareas pendientes */
  totalPending: number;

  /** Si absolutamente todas las tareas están hechas */
  isAllDone: boolean;
  /** Si las tareas propias están al día */
  isOwnDone: boolean;
  /** Si las tareas acumuladas están al día */
  isAccumulatedDone: boolean;

  /** Diagnóstico de estado */
  statusState:
    | 'empty'
    | 'all_done'
    | 'own_done_accumulated_pending'
    | 'accumulated_done_own_pending'
    | 'both_pending'
    | 'own_pending';

  /** Titular legible para la interfaz */
  headline: string;
  /** Explicación detallada del estado */
  detailText: string;
  /** Resumen conciso de qué falta exactamente */
  missingSummary: string;
}

export interface CalculateCycleRoutineStatusParams {
  tasks: TaskItem[] | Record<string, TaskItem>;
  cycles: CustomCycle[];
  listSections?: ListSection[];
  lists?: CustomList[];
  currentCycle: CustomCycle;
  cycleRoutineMode?: 'only_section' | 'full_routine';
  referenceDate?: Date;
}

const CORE_DAYS: Record<string, number> = {
  cycle_day: 1,
  cycle_week: 7,
  cycle_month: 30,
  cycle_year: 365,
};

/**
 * Calcula con precisión matemática el estado de cumplimiento de una lista de frecuencia:
 * - Distingue entre tareas del ciclo actual (mensuales en Mensual) y tareas acumuladas (semanales y diarias).
 * - Identifica si tienes todas las mensuales hechas, las acumuladas al día, ambas hechas (objetivo global)
 *   o qué falta exactamente por completar.
 */
export function calculateCycleRoutineStatus({
  tasks,
  cycles,
  listSections = [],
  lists = [],
  currentCycle,
  cycleRoutineMode = 'full_routine',
  referenceDate = new Date(),
}: CalculateCycleRoutineStatusParams): CycleRoutineStatus {
  const allTasksArray = Array.isArray(tasks) ? tasks : Object.values(tasks);
  const activeTasks = allTasksArray.filter(
    (t) => !t.deleted_at && t.categoryId !== 'primeros_pasos'
  );

  const ownDaysValue =
    currentCycle.daysValue || CORE_DAYS[currentCycle.id] || 999;
  const isFullRoutine = cycleRoutineMode === 'full_routine';

  let ownTotal = 0;
  let ownCompleted = 0;

  let dailyTotal = 0;
  let dailyCompleted = 0;

  let weeklyTotal = 0;
  let weeklyCompleted = 0;

  let accumulatedTotal = 0;
  let accumulatedCompleted = 0;

  for (const task of activeTasks) {
    const effCycleId =
      getEffectiveCycleId(task, listSections, lists) || task.cycle_id;
    if (!effCycleId) continue;

    const cycleObj =
      cycles.find((c) => c.id === effCycleId) ||
      (CORE_DAYS[effCycleId]
        ? { id: effCycleId, daysValue: CORE_DAYS[effCycleId] }
        : null);

    const taskDaysValue =
      cycleObj?.daysValue || CORE_DAYS[effCycleId] || 999;

    const isOwn = effCycleId === currentCycle.id;
    const isAccumulated = taskDaysValue < ownDaysValue;

    if (!isOwn && !isAccumulated) continue;

    const isDone =
      isTaskCompleted(task) ||
      isCompletedInCurrentPeriod(
        task,
        cycles,
        listSections,
        lists,
        referenceDate
      );

    if (isOwn) {
      ownTotal++;
      if (isDone) ownCompleted++;
    } else if (isAccumulated) {
      accumulatedTotal++;
      if (isDone) accumulatedCompleted++;

      if (effCycleId === 'cycle_day') {
        dailyTotal++;
        if (isDone) dailyCompleted++;
      } else if (effCycleId === 'cycle_week') {
        weeklyTotal++;
        if (isDone) weeklyCompleted++;
      }
    }
  }

  const ownPending = ownTotal - ownCompleted;
  const accumulatedPending = accumulatedTotal - accumulatedCompleted;
  const dailyPending = dailyTotal - dailyCompleted;
  const weeklyPending = weeklyTotal - weeklyCompleted;

  const totalGoal = isFullRoutine ? ownTotal + accumulatedTotal : ownTotal;
  const totalCompleted = isFullRoutine
    ? ownCompleted + accumulatedCompleted
    : ownCompleted;
  const totalPending = isFullRoutine
    ? ownPending + accumulatedPending
    : ownPending;

  const isOwnDone = ownTotal > 0 && ownPending === 0;
  const isAccumulatedDone =
    accumulatedTotal === 0 || accumulatedPending === 0;
  const isAllDone =
    isFullRoutine
      ? totalGoal > 0 && totalPending === 0
      : ownTotal > 0 && ownPending === 0;

  const ownCycleName = currentCycle.name || 'Frecuencia';
  const ownLowerName =
    currentCycle.id === 'cycle_month'
      ? 'mensuales'
      : currentCycle.id === 'cycle_week'
      ? 'semanales'
      : currentCycle.id === 'cycle_year'
      ? 'anuales'
      : currentCycle.id === 'cycle_day'
      ? 'diarias'
      : ownCycleName.toLowerCase();

  const ownSingular =
    currentCycle.id === 'cycle_month'
      ? 'mensual'
      : currentCycle.id === 'cycle_week'
      ? 'semanal'
      : currentCycle.id === 'cycle_year'
      ? 'anual'
      : currentCycle.id === 'cycle_day'
      ? 'diaria'
      : ownCycleName.toLowerCase();

  // Diagnóstico
  let statusState: CycleRoutineStatus['statusState'] = 'both_pending';
  let headline = '';
  let detailText = '';
  let missingSummary = '';

  // 1. Sin tareas
  if (totalGoal === 0) {
    statusState = 'empty';
    headline = `Sin recordatorios en ${ownCycleName}`;
    detailText = `No hay tareas asignadas para esta frecuencia.`;
    missingSummary = 'Sin tareas';
  }
  // 2. Todo completado
  else if (isAllDone) {
    statusState = 'all_done';
    if (isFullRoutine && accumulatedTotal > 0) {
      headline = `¡Objetivo ${ownSingular} completado!`;
      detailText = `Todas las ${ownLowerName} (${ownCompleted}/${ownTotal}) y acumuladas (${accumulatedCompleted}/${accumulatedTotal}) están al día.`;
    } else {
      headline = `Todas las ${ownLowerName} completadas`;
      detailText = `Has completado las ${ownTotal} ${ownLowerName} de este período (${ownCompleted}/${ownTotal}).`;
    }
    missingSummary = 'Todo al día';
  }
  // 3. Solo sección activa y faltan propias
  else if (!isFullRoutine) {
    statusState = 'own_pending';
    headline = `Faltan ${ownPending} ${ownPending === 1 ? ownSingular : ownLowerName}`;
    detailText = `${ownCompleted} de ${ownTotal} ${ownLowerName} completadas este período.`;
    missingSummary = `Faltan ${ownPending} ${ownPending === 1 ? ownSingular : ownLowerName}`;
  }
  // 4. Modo rutina completa: Propias hechas, pero faltan acumuladas
  else if (isOwnDone && accumulatedPending > 0) {
    statusState = 'own_done_accumulated_pending';
    headline = `${capitalize(ownLowerName)} al día · Faltan ${accumulatedPending} acumuladas`;
    detailText = `Todas las ${ownLowerName} (${ownCompleted}/${ownTotal}) están completadas.`;

    const parts: string[] = [];
    if (dailyPending > 0) {
      parts.push(`${dailyPending} ${dailyPending === 1 ? 'diaria' : 'diarias'}`);
    }
    if (weeklyPending > 0) {
      parts.push(`${weeklyPending} ${weeklyPending === 1 ? 'semanal' : 'semanales'}`);
    }
    missingSummary = parts.length > 0 ? `Faltan ${parts.join(' y ')}` : `Faltan ${accumulatedPending} acumuladas`;
  }
  // 5. Modo rutina completa: Acumuladas hechas, pero faltan propias
  else if (isAccumulatedDone && ownPending > 0) {
    statusState = 'accumulated_done_own_pending';
    headline = `Acumuladas al día · Faltan ${ownPending} ${ownPending === 1 ? ownSingular : ownLowerName}`;
    detailText = `Las tareas acumuladas (${accumulatedCompleted}/${accumulatedTotal}) están al día.`;
    missingSummary = `Faltan ${ownPending} ${ownPending === 1 ? ownSingular : ownLowerName}`;
  }
  // 6. Modo rutina completa: Faltan tanto propias como acumuladas
  else {
    statusState = 'both_pending';
    headline = `Faltan ${ownPending} ${ownPending === 1 ? ownSingular : ownLowerName} y ${accumulatedPending} acumuladas`;
    detailText = `${ownCompleted}/${ownTotal} ${ownLowerName} · ${accumulatedCompleted}/${accumulatedTotal} acumuladas hechas`;

    const missingParts: string[] = [
      `${ownPending} ${ownPending === 1 ? ownSingular : ownLowerName}`,
    ];
    if (dailyPending > 0) {
      missingParts.push(`${dailyPending} ${dailyPending === 1 ? 'diaria' : 'diarias'}`);
    }
    if (weeklyPending > 0) {
      missingParts.push(`${weeklyPending} ${weeklyPending === 1 ? 'semanal' : 'semanales'}`);
    }
    missingSummary = `Faltan: ${missingParts.join(', ')}`;
  }

  return {
    ownCycleId: currentCycle.id,
    ownCycleName,
    ownColor: currentCycle.color,
    ownTotal,
    ownCompleted,
    ownPending,

    accumulatedTotal,
    accumulatedCompleted,
    accumulatedPending,

    dailyTotal,
    dailyCompleted,
    dailyPending,

    weeklyTotal,
    weeklyCompleted,
    weeklyPending,

    totalGoal,
    totalCompleted,
    totalPending,

    isAllDone,
    isOwnDone,
    isAccumulatedDone,

    statusState,
    headline,
    detailText,
    missingSummary,
  };
}

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
