import type { TaskItem, CustomCycle } from '../models/Task';

/**
 * Servicio puro para determinar si una tarea recurrente
 * ya fue completada dentro de su periodo actual.
 *
 * Aplica principios de Clean Code, Guard Clauses y tipado estricto.
 */
export function isCompletedInCurrentPeriod(task: Partial<TaskItem>, cycles: CustomCycle[]): boolean {
  const isDone = task.status === 'completed' || !!(task as any).completed_at || !!(task as any).completed;
  
  if (isDone && !task.cycle_id) {
    return true;
  }

  if (!task.cycle_id || !task.completionHistory || task.completionHistory.length === 0) {
    return false;
  }

  const cycle = cycles.find((c) => c.id === task.cycle_id);
  if (!cycle) {
    return false;
  }

  const lastCompletion = task.completionHistory[task.completionHistory.length - 1];
  const now = new Date();
  const lastDate = new Date(lastCompletion);

  return checkCyclePeriodMatch(cycle.daysValue, lastDate, now, lastCompletion);
}

/**
 * Función auxiliar pura para reducir complejidad cognitivo-ciclomática
 */
function checkCyclePeriodMatch(daysValue: number, lastDate: Date, now: Date, lastCompletion: number): boolean {
  if (daysValue === 1) {
    return lastDate.toDateString() === now.toDateString();
  }

  if (daysValue === 7) {
    const diffMs = Math.abs(now.getTime() - lastDate.getTime());
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  }

  if (daysValue === 30) {
    return lastDate.getMonth() === now.getMonth() && lastDate.getFullYear() === now.getFullYear();
  }

  if (daysValue === 365) {
    return lastDate.getFullYear() === now.getFullYear();
  }

  const cycleMs = daysValue * 24 * 60 * 60 * 1000;
  return (Date.now() - lastCompletion) < cycleMs;
}

/**
 * Detecta ciclos de dependencia usando DFS.
 * Retorna `true` si añadir `blockedByTaskId` como dependencia de
 * `targetTaskId` crearía un ciclo (deadlock).
 */
export function wouldCreateDependencyCycle(
  targetTaskId: string,
  blockedByTaskId: string,
  tasks: Record<string, TaskItem>
): boolean {
  const visited = new Set<string>();

  function dfs(currentId: string): boolean {
    if (currentId === targetTaskId) return true;
    if (visited.has(currentId)) return false;
    visited.add(currentId);

    const current = tasks[currentId];
    if (!current?.blockedBy) return false;

    return current.blockedBy.some((depId) => dfs(depId));
  }

  return dfs(blockedByTaskId);
}
