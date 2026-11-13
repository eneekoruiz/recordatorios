import { useAppStore } from '../store/useAppStore';
import { confirmDialog } from '../components/ui/confirmDialog';
import type { TaskWeightLog } from '../models/Task';

const isToday = (iso?: string) => !!iso && new Date(iso).toDateString() === new Date().toDateString();
const fmtKg = (kg: number) => String(Math.round(kg * 10) / 10).replace('.', ',');

/** El peso apuntado hoy en esa serie, si lo hay. */
export function todayLogForSet(taskId: string, set: number): TaskWeightLog | null {
  const task = useAppStore.getState().tasks[taskId];
  return task?.weightLogs?.find(l => l.set === set && isToday(l.date) && l.weightKg > 0) ?? null;
}

/**
 * Quitar una serie hecha. Si esa serie tiene peso apuntado hoy, antes se pregunta: al quitarla se borra
 * también ese registro (si no, quedaría un peso de una serie que ya no está hecha y falsearía las sugerencias).
 * Devuelve false si la persona prefiere mantenerla.
 */
export async function undoSetKeepingDataSafe(taskId: string, set: number, undo: () => void): Promise<boolean> {
  const log = set > 0 ? todayLogForSet(taskId, set) : null;
  if (log) {
    const ok = await confirmDialog({
      title: `¿Quitar la serie ${set}?`,
      message: `Tenías apuntado ${fmtKg(log.weightKg)} kg${log.reps ? ` × ${log.reps}` : ''} en esta serie. Si la quitas, se borra también ese registro.`,
      confirmText: 'Quitar serie y peso',
      cancelText: 'Mantener',
      tone: 'danger',
    });
    if (!ok) return false;
  }
  undo();
  if (log) {
    const { tasks, updateTask } = useAppStore.getState();
    const fresh = tasks[taskId];
    if (fresh) updateTask(taskId, { weightLogs: (fresh.weightLogs || []).filter(l => !(l.set === set && isToday(l.date))) });
  }
  return true;
}
