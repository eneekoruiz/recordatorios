// Lógica pura de fusión de datos entre el dispositivo y el servidor.
// Separada del SyncManager para poder testearla sin red ni navegador.
import type { TaskItem } from '../models/Task';

type Syncable = { id: string; updated_at?: string; version?: number; deleted_at?: string; _is_dirty?: boolean };

const toTime = (v?: string) => {
  if (!v) return 0;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/** ¿Debe el dato del servidor sustituir al local? (versión primero, luego fecha). */
export function serverWins(server: Syncable, local: Syncable | undefined): boolean {
  if (!local) return true;
  const sv = server.version || 0;
  const lv = local.version || 0;
  if (sv !== lv) return sv > lv;
  return toTime(server.updated_at) >= toTime(local.updated_at);
}

/** Normaliza campos heredados en snake_case que puedan venir del servidor. */
export function normalizeServerTask(raw: any): TaskItem {
  return {
    ...raw,
    categoryId: raw.categoryId || raw.category_id || undefined,
    sectionId: raw.sectionId || raw.section_id || undefined,
    cycle_id: raw.cycle_id || raw.cycleId || undefined,
    _is_dirty: false,
  };
}

/**
 * Fusiona las tareas recibidas. Un cambio local pendiente de subir (_is_dirty) solo se
 * sustituye si el servidor tiene una versión estrictamente más nueva.
 */
export function mergeServerTasks(local: Record<string, TaskItem>, incoming: any[]): { tasks: Record<string, TaskItem>; changed: boolean } {
  let changed = false;
  const next = { ...local };
  for (const raw of incoming) {
    if (!raw || typeof raw.id !== 'string') continue;
    const serverTask = normalizeServerTask(raw);
    const localTask = local[serverTask.id];
    if (serverWins(serverTask, localTask)) {
      next[serverTask.id] = serverTask;
      changed = true;
    }
  }
  return { tasks: changed ? next : local, changed };
}

/**
 * Fusiona colecciones en array (listas, ciclos, secciones). Los registros que llegan
 * borrados (deleted_at) se eliminan del estado local salvo que haya un cambio local más nuevo.
 */
export function mergeServerCollection<T extends Syncable>(
  local: T[],
  incoming: any[],
  opts: { skip?: (item: any) => boolean } = {}
): { items: T[]; changed: boolean } {
  let changed = false;
  const byId = new Map(local.map((item) => [item.id, item]));
  for (const raw of incoming) {
    if (!raw || typeof raw.id !== 'string' || opts.skip?.(raw)) continue;
    const current = byId.get(raw.id);
    const wins = !current || !current._is_dirty
      ? !current || toTime(raw.updated_at) >= toTime(current.updated_at) || !current.updated_at
      : toTime(raw.updated_at) > toTime(current.updated_at);
    if (!wins) continue;
    if (raw.deleted_at) {
      if (current) {
        byId.delete(raw.id);
        changed = true;
      }
      continue;
    }
    byId.set(raw.id, { ...raw, _is_dirty: false } as T);
    changed = true;
  }
  return { items: changed ? Array.from(byId.values()) : local, changed };
}

/**
 * Tras un push correcto, marca como sincronizado únicamente lo que no ha cambiado
 * mientras la petición estaba en vuelo (evita perder ediciones concurrentes).
 */
export function clearDirtyIfUnchanged<T extends Syncable>(current: T | undefined, sent: T): T | undefined {
  if (!current) return undefined;
  if (!current._is_dirty) return undefined;
  if (current.updated_at !== sent.updated_at || (current.version || 0) !== (sent.version || 0)) return undefined;
  return { ...current, _is_dirty: false };
}

/** Elimina del estado local los registros limpios que ya no existen en el servidor. */
export function reconcileTasks(local: Record<string, TaskItem>, activeIds: string[], incomingIds: Set<string>) {
  const active = new Set(activeIds);
  let changed = false;
  const next = { ...local };
  for (const [id, task] of Object.entries(local)) {
    if (!task._is_dirty && !active.has(id) && !incomingIds.has(id) && !task.deleted_at) {
      delete next[id];
      changed = true;
    }
  }
  return { tasks: changed ? next : local, changed };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
