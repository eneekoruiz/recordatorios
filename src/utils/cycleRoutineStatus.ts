import type { TaskItem, CustomCycle, ListSection, CustomList } from '../models/Task';
import { isTaskCompleted } from '../store/useAppStore';
import { isCompletedInCurrentPeriod } from '../services/TaskService';
import { getEffectiveCycleId } from './sectionRoutine';
import { getReservedFrequencyColor } from '../constants/colors';

export interface FrequencyBreakdownItem {
  cycleId: string;
  name: string;
  singularName: string;
  color?: string;
  daysValue: number;
  total: number;
  completed: number;
  pending: number;
  isDone: boolean;
  isOwn: boolean;
}

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

  /** Total de tareas de otras frecuencias (antes llamadas genéricamente acumuladas) */
  accumulatedTotal: number;
  /** Tareas de otras frecuencias completadas */
  accumulatedCompleted: number;
  /** Tareas de otras frecuencias pendientes */
  accumulatedPending: number;

  /** Desglose de tareas diarias */
  dailyTotal: number;
  dailyCompleted: number;
  dailyPending: number;

  /** Desglose de tareas semanales */
  weeklyTotal: number;
  weeklyCompleted: number;
  weeklyPending: number;

  /** Desglose individual de todas las frecuencias activas */
  frequencyBreakdown: FrequencyBreakdownItem[];
  /** Desglose individual de las frecuencias distintas a la actual */
  otherBreakdown: FrequencyBreakdownItem[];

  /** Meta total de tareas (propias o propias + otras frecuencias según el modo) */
  totalGoal: number;
  /** Total de tareas completadas */
  totalCompleted: number;
  /** Total de tareas pendientes */
  totalPending: number;

  /** Si absolutamente todas las tareas están hechas */
  isAllDone: boolean;
  /** Si las tareas propias están al día */
  isOwnDone: boolean;
  /** Si las tareas de otras frecuencias están al día */
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

function getCycleDisplayName(id: string, customName?: string): string {
  if (id === 'cycle_day') return 'Diarias';
  if (id === 'cycle_week') return 'Semanales';
  if (id === 'cycle_month') return 'Mensuales';
  if (id === 'cycle_year') return 'Anuales';
  if (customName) return customName;
  return 'Otras';
}

function getCycleSingularName(id: string, customName?: string): string {
  if (id === 'cycle_day') return 'diaria';
  if (id === 'cycle_week') return 'semanal';
  if (id === 'cycle_month') return 'mensual';
  if (id === 'cycle_year') return 'anual';
  if (customName) return customName.toLowerCase();
  return 'otra';
}

/**
 * Calcula con precisión matemática el estado de cumplimiento de una lista de frecuencia:
 * - Distingue entre tareas del ciclo actual y cada una de las demás frecuencias individualmente.
 * - Proporciona desglose por frecuencia sin agruparlas de forma opaca.
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

  interface CycleStat {
    cycleId: string;
    name: string;
    singularName: string;
    color?: string;
    daysValue: number;
    total: number;
    completed: number;
    isOwn: boolean;
  }

  const statsMap = new Map<string, CycleStat>();

  for (const task of activeTasks) {
    const effCycleId =
      getEffectiveCycleId(task, listSections, lists) || task.cycle_id;
    if (!effCycleId) continue;

    const cycleObj =
      cycles.find((c) => c.id === effCycleId) ||
      (CORE_DAYS[effCycleId]
        ? { id: effCycleId, name: effCycleId, daysValue: CORE_DAYS[effCycleId] }
        : null);

    const taskDaysValue =
      cycleObj?.daysValue || CORE_DAYS[effCycleId] || 999;

    const isOwn = effCycleId === currentCycle.id;
    // En rutina completa se incluyen las propias y las demás frecuencias
    if (!isOwn && !isFullRoutine && taskDaysValue >= ownDaysValue) continue;

    const isDone =
      isTaskCompleted(task) ||
      isCompletedInCurrentPeriod(
        task,
        cycles,
        listSections,
        lists,
        referenceDate
      );

    const stat = statsMap.get(effCycleId) || {
      cycleId: effCycleId,
      name: getCycleDisplayName(effCycleId, cycleObj?.name),
      singularName: getCycleSingularName(effCycleId, cycleObj?.name),
      color: (cycleObj && 'color' in cycleObj && cycleObj.color) ? cycleObj.color : getReservedFrequencyColor(effCycleId),
      daysValue: taskDaysValue,
      total: 0,
      completed: 0,
      isOwn,
    };
    stat.total++;
    if (isDone) stat.completed++;
    statsMap.set(effCycleId, stat);
  }

  const allBreakdown: FrequencyBreakdownItem[] = Array.from(statsMap.values())
    .map((s) => ({
      cycleId: s.cycleId,
      name: s.name,
      singularName: s.singularName,
      color: s.color,
      daysValue: s.daysValue,
      total: s.total,
      completed: s.completed,
      pending: s.total - s.completed,
      isDone: s.total === 0 || s.total === s.completed,
      isOwn: s.isOwn,
    }))
    .sort((a, b) => a.daysValue - b.daysValue);

  const ownBreakdown = allBreakdown.find((b) => b.isOwn);
  const ownTotal = ownBreakdown?.total || 0;
  const ownCompleted = ownBreakdown?.completed || 0;
  const ownPending = ownTotal - ownCompleted;

  const otherBreakdown = allBreakdown.filter((b) => !b.isOwn && b.total > 0);
  const accumulatedTotal = otherBreakdown.reduce((sum, b) => sum + b.total, 0);
  const accumulatedCompleted = otherBreakdown.reduce((sum, b) => sum + b.completed, 0);
  const accumulatedPending = accumulatedTotal - accumulatedCompleted;

  const dailyStat = allBreakdown.find((b) => b.cycleId === 'cycle_day');
  const dailyTotal = dailyStat?.total || 0;
  const dailyCompleted = dailyStat?.completed || 0;
  const dailyPending = dailyTotal - dailyCompleted;

  const weeklyStat = allBreakdown.find((b) => b.cycleId === 'cycle_week');
  const weeklyTotal = weeklyStat?.total || 0;
  const weeklyCompleted = weeklyStat?.completed || 0;
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

  const otherMissingParts: string[] = otherBreakdown
    .filter((b) => b.pending > 0)
    .map((b) => `${b.pending} ${b.pending === 1 ? b.singularName : b.name.toLowerCase()}`);

  const allMissingParts: string[] = [];
  if (ownPending > 0) {
    allMissingParts.push(`${ownPending} ${ownPending === 1 ? ownSingular : ownLowerName}`);
  }
  allMissingParts.push(...otherMissingParts);

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
    if (isFullRoutine && otherBreakdown.length > 0) {
      headline = `¡Objetivo ${ownSingular} completado!`;
      detailText = `Todas las ${ownLowerName} (${ownCompleted}/${ownTotal}) y demás frecuencias (${accumulatedCompleted}/${accumulatedTotal}) están al día.`;
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
  // 4. Modo rutina completa: Propias hechas, pero faltan otras frecuencias
  else if (isOwnDone && accumulatedPending > 0) {
    statusState = 'own_done_accumulated_pending';
    headline = `${capitalize(ownLowerName)} al día · Faltan ${joinWithAnd(otherMissingParts)}`;
    detailText = `Todas las ${ownLowerName} (${ownCompleted}/${ownTotal}) están completadas.`;
    missingSummary = `Faltan ${joinWithAnd(otherMissingParts)}`;
  }
  // 5. Modo rutina completa: Otras frecuencias hechas, pero faltan propias
  else if (isAccumulatedDone && ownPending > 0) {
    statusState = 'accumulated_done_own_pending';
    headline = `Demás frecuencias al día · Faltan ${ownPending} ${ownPending === 1 ? ownSingular : ownLowerName}`;
    detailText = `Las demás frecuencias (${accumulatedCompleted}/${accumulatedTotal}) están al día.`;
    missingSummary = `Faltan ${ownPending} ${ownPending === 1 ? ownSingular : ownLowerName}`;
  }
  // 6. Modo rutina completa: Faltan tanto propias como otras frecuencias
  else {
    statusState = 'both_pending';
    headline = `Faltan ${joinWithAnd(allMissingParts)}`;
    detailText = `${ownCompleted}/${ownTotal} ${ownLowerName} · ${otherBreakdown.map((b) => `${b.completed}/${b.total} ${b.name.toLowerCase()}`).join(' · ')}`;
    missingSummary = `Faltan: ${joinWithAnd(allMissingParts)}`;
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

    frequencyBreakdown: allBreakdown,
    otherBreakdown,

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

function joinWithAnd(parts: string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} y ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
}
