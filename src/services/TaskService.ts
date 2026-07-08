import type { TaskItem, CustomCycle } from '../models/Task';

/**
 * Servicio puro para determinar si una tarea recurrente
 * ya fue completada dentro de su periodo actual.
 *
 * Centraliza la lógica que antes estaba duplicada en
 * useAppStore, TaskCard y MainContent.
 */
export function isCompletedInCurrentPeriod(task: TaskItem, cycles: CustomCycle[]): boolean {
  if (task.status === 'COMPLETED') return true;
  if (!task.cycleId || !task.completionHistory || task.completionHistory.length === 0) return false;

  const cycle = cycles.find(c => c.id === task.cycleId);
  if (!cycle) return false;

  const lastCompletion = task.completionHistory[task.completionHistory.length - 1];
  const now = new Date();
  const lastDate = new Date(lastCompletion);

  switch (cycle.daysValue) {
    case 1:
      return lastDate.toDateString() === now.toDateString();
    case 7: {
      const diffMs = Math.abs(now.getTime() - lastDate.getTime());
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return diffDays <= 7;
    }
    case 30:
      return lastDate.getMonth() === now.getMonth()
        && lastDate.getFullYear() === now.getFullYear();
    case 365:
      return lastDate.getFullYear() === now.getFullYear();
    default: {
      const cycleMs = cycle.daysValue * 24 * 60 * 60 * 1000;
      return (Date.now() - lastCompletion) < cycleMs;
    }
  }
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

    return current.blockedBy.some(depId => dfs(depId));
  }

  return dfs(blockedByTaskId);
}
