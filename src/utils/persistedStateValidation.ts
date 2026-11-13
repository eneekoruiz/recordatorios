import { validateJsonImport, repairPersistedRecord } from './importValidation';

export type PersistedCollection = 'tasks' | 'lists' | 'cycles' | 'listSections';

export interface SanitizedPersistedState {
  state: Record<string, unknown>;
  quarantined: number;
  /** Registros que se quedaron, sin algún campo opcional que no era válido. */
  repaired?: number;
}

/** El registro tal cual si es válido; reparado (sin los campos opcionales inválidos) si se puede; si no, null. */
function keepOrRepair(collection: PersistedCollection, id: string, value: unknown): { item: unknown; repaired: boolean } | null {
  if (isPersistedRecordSafe(collection, id, value)) return { item: value, repaired: false };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (collection === 'tasks' && record.id !== undefined && record.id !== id) return null;
  const fixed = repairPersistedRecord(collection, collection === 'tasks' ? { ...record, id } : record);
  if (!fixed) return null;
  const item = collection === 'tasks' && record.id === undefined ? (({ id: _drop, ...rest }) => rest)(fixed) : fixed;
  return isPersistedRecordSafe(collection, id, item) ? { item, repaired: true } : null;
}

/** Validate known persisted fields without replacing/normalizing legacy records. */
export function isPersistedRecordSafe(collection: PersistedCollection, id: string, value: unknown): boolean {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    if (collection === 'tasks') validateJsonImport({ tasks: { [id]: value } });
    else validateJsonImport({ [collection]: [value] });
    return true;
  } catch {
    return false;
  }
}

/** Remove only invalid known collection rows before legacy Zustand migrations run. */
export function sanitizePersistedCollections(input: unknown): SanitizedPersistedState {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { state: {}, quarantined: 1 };
  const state = input as Record<string, unknown>;
  let quarantined = 0;
  let repaired = 0;
  const safeTasks: Record<string, unknown> = {};
  if (state.tasks !== undefined) {
    if (state.tasks && typeof state.tasks === 'object' && !Array.isArray(state.tasks)) {
      Object.entries(state.tasks).forEach(([id, item]) => {
        const kept = keepOrRepair('tasks', id, item);
        if (kept) { safeTasks[id] = kept.item; if (kept.repaired) repaired++; }
        else quarantined++;
      });
    } else quarantined++;
  }
  const safeArray = (value: unknown, collection: Exclude<PersistedCollection, 'tasks'>): unknown[] | undefined => {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) { quarantined++; return []; }
    const out: unknown[] = [];
    value.forEach((item, index) => {
      const id = item && typeof item === 'object' && !Array.isArray(item) && typeof (item as Record<string, unknown>).id === 'string'
        ? (item as Record<string, string>).id
        : `invalid-${index}`;
      const kept = keepOrRepair(collection, id, item);
      if (!kept) { quarantined++; return; }
      if (kept.repaired) repaired++;
      out.push(kept.item);
    });
    return out;
  };
  const lists = safeArray(state.lists, 'lists');
  const cycles = safeArray(state.cycles, 'cycles');
  const listSections = safeArray(state.listSections, 'listSections');
  return {
    state: {
      ...state,
      ...(state.tasks === undefined ? {} : { tasks: safeTasks }),
      ...(lists === undefined ? {} : { lists }),
      ...(cycles === undefined ? {} : { cycles }),
      ...(listSections === undefined ? {} : { listSections }),
    },
    quarantined,
    repaired,
  };
}
