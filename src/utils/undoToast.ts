import { HapticService } from '../services/HapticService';

// Aviso con «Deshacer» tras una eliminación, y el mismo deshacer con Ctrl/⌘+Z durante medio minuto.
const WINDOW_MS = 30_000;
let pending: { undo: () => void; at: number } | null = null;

export function showUndoToast(message: string, undo: () => void): void {
  const run = () => {
    if (pending?.undo === run) pending = null;
    undo();
    HapticService.selection();
  };
  pending = { undo: run, at: Date.now() };
  window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, onUndo: run } }));
}

/** Ctrl/⌘+Z: deshace la última eliminación si es reciente. Devuelve si hizo algo. */
export function undoLastDeletion(): boolean {
  if (!pending || Date.now() - pending.at > WINDOW_MS) {
    pending = null;
    return false;
  }
  const { undo } = pending;
  undo();
  window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Hecho: eliminación deshecha' }));
  return true;
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
