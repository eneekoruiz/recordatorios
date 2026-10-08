import { validateJsonImport } from './importValidation';

export type PersistedCollection = 'tasks' | 'lists' | 'cycles' | 'listSections';

export interface SanitizedPersistedState {
  state: Record<string, unknown>;
  quarantined: number;
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
  const safeTasks: Record<string, unknown> = {};
  if (state.tasks !== undefined) {
    if (state.tasks && typeof state.tasks === 'object' && !Array.isArray(state.tasks)) {
      Object.entries(state.tasks).forEach(([id, item]) => {
        if (isPersistedRecordSafe('tasks', id, item)) safeTasks[id] = item;
        else quarantined++;
      });
    } else quarantined++;
  }
  const safeArray = (value: unknown, collection: Exclude<PersistedCollection, 'tasks'>): unknown[] | undefined => {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) { quarantined++; return []; }
    return value.filter((item, index) => {
      const id = item && typeof item === 'object' && !Array.isArray(item) && typeof (item as Record<string, unknown>).id === 'string'
        ? (item as Record<string, string>).id
        : `invalid-${index}`;
      const valid = isPersistedRecordSafe(collection, id, item);
      if (!valid) quarantined++;
      return valid;
    });
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
  };
}
