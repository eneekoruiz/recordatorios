import { historyManager } from './historyManager';

export function showUndoToast(message: string, undo: () => void): void {
  historyManager.register(message, undo, { showToast: true });
}

/** Ctrl/⌘+Z: deshace la última eliminación si es reciente. Devuelve si hizo algo. */
export function undoLastDeletion(): boolean {
  return historyManager.undo();
}

/** Elimina una frecuencia y ofrece deshacerla (con los recordatorios que la tenían). */
export function deleteCycleWithUndo(
  api: { getCycleName: () => string; getTaskIds: () => string[]; remove: () => void; restore: () => void; relink: (taskId: string) => void }
): void {
  const name = api.getCycleName();
  const taskIds = api.getTaskIds();
  api.remove();
  showUndoToast(`Frecuencia «${name}» eliminada`, () => {
    api.restore();
    taskIds.forEach((id) => api.relink(id));
  });
}
