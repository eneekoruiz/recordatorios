import { useAppStore } from '../store/useAppStore';
import type { CustomList, CustomCycle, ListSection } from '../models/Task';
import {
  mergeServerTasks,
  mergeServerCollection,
  clearDirtyIfUnchanged,
  reconcileTasks,
  normalizeServerTask,
  serverWins,
  chunk,
} from './merge';

// En producción se usan URLs relativas (mismo dominio). En desarrollo, el backend corre en :3001
// del mismo host para que los móviles de la red local también puedan conectarse.
const getApiBase = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (!import.meta.env.DEV) return '';
  if (typeof window !== 'undefined' && window.location.hostname) {
    return `http://${window.location.hostname}:3001`;
  }
  return 'http://localhost:3001';
};
export const apiUrl = (path: string) => `${getApiBase()}${path}`;

const SYNC_INTERVAL_MS = 30 * 1000;
const PUSH_CHUNK_SIZE = 400;
const SETTINGS_LIST_PREFIX = 'user_preferences_';

export const isOfflineToken = (token: string | null | undefined) =>
  !token || token.startsWith('local_offline') || token.startsWith('offline_');

class AuthExpiredError extends Error {}

type Syncable = { id: string; updated_at?: string; version?: number; _is_dirty?: boolean };

class SyncManager {
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;
  private pendingResync = false;
  private isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
  private eventSource: EventSource | null = null;
  private realtimeUnsupported = false;
  private realtimeFailures = 0;
  private debounceTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncNow();
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
      useAppStore.getState().setSyncStatus('offline');
    });
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          if (this.hasPendingChanges()) this.syncNow();
        } else if (document.visibilityState === 'visible') {
          this.syncNow();
        }
      });
      window.addEventListener('pagehide', () => {
        if (this.hasPendingChanges()) this.syncNow();
      });
    }
  }

  triggerDebouncedSync() {
    if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
    this.debounceTimeout = setTimeout(() => this.syncNow(), 400);
  }

  start() {
    if (this.syncInterval) return;
    this.syncInterval = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') this.syncNow();
    }, SYNC_INTERVAL_MS);
    this.syncNow(true); // reconciliación completa al abrir la app
  }

  stop() {
    if (this.syncInterval) clearInterval(this.syncInterval);
    this.syncInterval = null;
    this.eventSource?.close();
    this.eventSource = null;
  }

  /** Gestiona la respuesta común: renovación de token y sesión caducada. */
  private handleAuth(response: Response) {
    const refreshed = response.headers.get('X-Refreshed-Token');
    if (refreshed) {
      const { userId } = useAppStore.getState();
      useAppStore.getState().setToken(refreshed, userId);
    }
    if (response.status === 401 || response.status === 403) {
      useAppStore.getState().expireSession();
      throw new AuthExpiredError('Sesión caducada');
    }
  }

  private setupRealtime(token: string) {
    if (this.realtimeUnsupported || isOfflineToken(token) || typeof EventSource === 'undefined') return;
    this.eventSource?.close();

    const source = new EventSource(`${apiUrl('/api/sync/live')}?token=${encodeURIComponent(token)}`);
    this.eventSource = source;
    let opened = false;

    source.onopen = () => {
      opened = true;
      this.realtimeFailures = 0;
    };
    source.onmessage = (event) => {
      if (event.data === 'check_sync') this.syncNow();
    };
    source.onerror = () => {
      source.close();
      if (this.eventSource === source) this.eventSource = null;
      // Un 204 (servidor sin tiempo real, p. ej. Vercel) cierra sin llegar a abrir: dejamos de insistir.
      if (!opened) this.realtimeFailures += 1;
      if (this.realtimeFailures >= 2) {
        this.realtimeUnsupported = true;
        return;
      }
      setTimeout(() => {
        const current = useAppStore.getState().token;
        if (current && this.isOnline && !isOfflineToken(current) && !this.eventSource) this.setupRealtime(current);
      }, 5000);
    };
  }

  async syncNow(forceFullPull = false) {
    if (!this.isOnline) {
      useAppStore.getState().setSyncStatus('offline');
      return;
    }
    const { token } = useAppStore.getState();
    if (!token || isOfflineToken(token)) {
      useAppStore.getState().setSyncStatus('idle');
      return;
    }
    if (this.isSyncing) {
      // Llegan cambios mientras sincronizamos: repetir al terminar.
      this.pendingResync = true;
      return;
    }

    if (!this.eventSource) this.setupRealtime(token);

    this.isSyncing = true;
    useAppStore.getState().setSyncStatus('syncing');
    try {
      await this.push(token);
      await this.pull(useAppStore.getState().token || token, forceFullPull);
      useAppStore.getState().setSyncStatus('synced');
      useAppStore.getState().setLastSyncedAt(Date.now());
    } catch (error) {
      if (!(error instanceof AuthExpiredError)) console.error('Sync failed:', error);
      useAppStore.getState().setSyncStatus('error');
    } finally {
      this.isSyncing = false;
      if (this.pendingResync) {
        this.pendingResync = false;
        this.triggerDebouncedSync();
      }
    }
  }

  /** ¿Quedan cambios locales sin subir? */
  hasPendingChanges() {
    const s = useAppStore.getState();
    return (
      !!s._preferences_dirty ||
      s.tombstones.lists.length > 0 ||
      s.tombstones.cycles.length > 0 ||
      s.lists.some((l) => l._is_dirty) ||
      s.cycles.some((c) => c._is_dirty) ||
      (s.listSections || []).some((x) => x._is_dirty) ||
      Object.values(s.tasks).some((t) => t._is_dirty)
    );
  }

  private async push(token: string) {
    const state = useAppStore.getState();
    const tasks = Object.values(state.tasks).filter((t) => t._is_dirty);
    const cycles = state.cycles.filter((c) => c._is_dirty);
    const lists = state.lists.filter((l) => l._is_dirty && !l.id.startsWith(SETTINGS_LIST_PREFIX));
    const listSections = (state.listSections || []).filter((s) => s._is_dirty);
    const tombstones = state.tombstones || { lists: [], cycles: [], tasks: [] };
    const hasDirtyPrefs = !!state._preferences_dirty;

    const allTasks = [...tasks, ...(tombstones.tasks || [])];
    const allLists = [...lists, ...tombstones.lists];
    const allCycles = [...cycles, ...tombstones.cycles];
    if (!allTasks.length && !allCycles.length && !allLists.length && !listSections.length && !hasDirtyPrefs) return;

    const preferences = hasDirtyPrefs
      ? {
          smartListVisibility: state.smartListVisibility,
          pinnedSmartLists: state.pinnedSmartLists,
          cycleVisibility: state.cycleVisibility,
          hideOnboarding: safeLocalStorageGet('hide_onboarding_guide') === 'true',
          updated_at: state.preferences_updated_at || new Date().toISOString(),
        }
      : undefined;

    // Listas, ciclos y secciones viajan en la primera petición; las tareas, en lotes.
    const taskChunks = allTasks.length ? chunk(allTasks, PUSH_CHUNK_SIZE) : [[]];
    const staleTasks: any[] = [];
    let staleLists: any[] = [];
    let staleCycles: any[] = [];
    let staleSections: any[] = [];

    for (let i = 0; i < taskChunks.length; i++) {
      const first = i === 0;
      const body = first
        ? { tasks: taskChunks[i], cycles: allCycles, lists: allLists, listSections, preferences }
        : { tasks: taskChunks[i] };
      const response = await fetch(apiUrl('/api/sync/push'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      this.handleAuth(response);
      if (!response.ok) throw new Error(`Push failed (${response.status})`);
      const data = await response.json().catch(() => ({}));
      if (data?.stale?.tasks) staleTasks.push(...data.stale.tasks);
      if (first) {
        staleLists = data?.stale?.lists || [];
        staleCycles = data?.stale?.cycles || [];
        staleSections = data?.stale?.listSections || [];
      }
    }

    // Marcar como sincronizado solo lo que no cambió mientras la petición estaba en vuelo.
    useAppStore.setState((current) => {
      const nextTasks = { ...current.tasks };
      for (const sent of tasks) {
        const cleared = clearDirtyIfUnchanged(current.tasks[sent.id], sent);
        if (cleared) nextTasks[sent.id] = cleared;
      }
      // El servidor conservaba una versión más nueva: la adoptamos.
      for (const raw of staleTasks) {
        const local = nextTasks[raw.id];
        if (!local || !local._is_dirty || serverWins(raw, local)) nextTasks[raw.id] = normalizeServerTask(raw);
      }

      const clearArray = <T extends Syncable>(arr: T[], sent: T[]): T[] => {
        if (!sent.length) return arr;
        const sentById = new Map(sent.map((s) => [s.id, s]));
        return arr.map((item) => {
          const s = sentById.get(item.id);
          return (s && clearDirtyIfUnchanged(item, s)) || item;
        });
      };

      const nextLists = mergeServerCollection(clearArray(current.lists, lists), staleLists).items;
      const nextCycles = mergeServerCollection(clearArray(current.cycles, cycles), staleCycles).items;
      const nextSections = mergeServerCollection(clearArray(current.listSections || [], listSections), staleSections).items;

      const sentTombLists = new Set(tombstones.lists.map((t) => t.id));
      const sentTombCycles = new Set(tombstones.cycles.map((t) => t.id));
      const sentTombTasks = new Set((tombstones.tasks || []).map((t) => t.id));

      return {
        tasks: nextTasks,
        lists: nextLists,
        cycles: nextCycles,
        listSections: nextSections,
        tombstones: {
          lists: current.tombstones.lists.filter((t) => !sentTombLists.has(t.id)),
          cycles: current.tombstones.cycles.filter((t) => !sentTombCycles.has(t.id)),
          tasks: (current.tombstones.tasks || []).filter((t) => !sentTombTasks.has(t.id)),
        },
        ...(hasDirtyPrefs ? { _preferences_dirty: false } : {}),
      };
    });
  }

  private async pull(token: string, forceFullPull = false) {
    const state = useAppStore.getState();
    const tokenKey = `sync_token_${state.userId || token.slice(-16)}`;
    const isLocalEmpty = Object.keys(state.tasks).length === 0;
    const lastToken = forceFullPull || isLocalEmpty ? '0' : safeLocalStorageGet(tokenKey) || '0';

    const url = new URL(apiUrl('/api/sync/pull'), window.location.origin);
    url.searchParams.set('lastToken', lastToken);
    const response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
    this.handleAuth(response);
    if (!response.ok) throw new Error(`Pull failed (${response.status})`);
    const data = await response.json();

    useAppStore.setState((current) => {
      const update: Record<string, unknown> = {};
      const isSettings = (l: any) => typeof l?.id === 'string' && l.id.startsWith(SETTINGS_LIST_PREFIX);

      // Tareas
      let tasks = current.tasks;
      if (Array.isArray(data.tasks) && data.tasks.length) tasks = mergeServerTasks(tasks, data.tasks).tasks;
      if (Array.isArray(data.activeTaskIds)) {
        const incomingIds = new Set<string>((data.tasks || []).map((t: any) => t.id));
        tasks = reconcileTasks(tasks, data.activeTaskIds, incomingIds).tasks;
      }
      if (tasks !== current.tasks) update.tasks = tasks;

      // Listas (los antiguos registros de ajustes "user_preferences_*" se ignoran)
      let lists = current.lists;
      if (Array.isArray(data.lists) && data.lists.length) {
        lists = mergeServerCollection<CustomList>(lists, data.lists, { skip: isSettings }).items;
      }
      if (Array.isArray(data.activeListIds)) {
        const active = new Set<string>(data.activeListIds);
        const filtered = lists.filter((l) => l._is_dirty || active.has(l.id) || isSettings(l));
        if (filtered.length !== lists.length) lists = filtered;
      }
      if (lists !== current.lists) update.lists = lists;

      // Ciclos
      if (Array.isArray(data.cycles) && data.cycles.length) {
        const merged = mergeServerCollection<CustomCycle>(current.cycles, data.cycles);
        if (merged.changed) update.cycles = [...merged.items].sort((a, b) => a.daysValue - b.daysValue);
      }

      // Secciones
      const currentSections = current.listSections || [];
      let sections = currentSections;
      if (Array.isArray(data.listSections) && data.listSections.length) {
        sections = mergeServerCollection<ListSection>(sections, data.listSections).items;
      }
      if (Array.isArray(data.activeSectionIds)) {
        const active = new Set<string>(data.activeSectionIds);
        const filtered = sections.filter((s) => s._is_dirty || active.has(s.id));
        if (filtered.length !== sections.length) sections = filtered;
      }
      if (sections !== currentSections) update.listSections = sections;

      // Preferencias (columna User.preferences); LWW frente a cambios locales
      const prefs = data.preferences;
      if (prefs && typeof prefs === 'object') {
        const localUpdatedAt = current.preferences_updated_at ? new Date(current.preferences_updated_at).getTime() : 0;
        const serverUpdatedAt = prefs.updated_at ? new Date(prefs.updated_at).getTime() : 0;
        const shouldApply = !current._preferences_dirty || (serverUpdatedAt >= localUpdatedAt);

        if (shouldApply) {
          if (prefs.smartListVisibility && typeof prefs.smartListVisibility === 'object') {
            update.smartListVisibility = { 
              smart_primeros_pasos: false,
              smart_today: true,
              smart_scheduled: true,
              smart_all: true,
              smart_flagged: true,
              smart_completed: false,
              ...prefs.smartListVisibility 
            };
          }
          if (Array.isArray(prefs.pinnedSmartLists)) update.pinnedSmartLists = prefs.pinnedSmartLists;
          if (prefs.cycleVisibility && typeof prefs.cycleVisibility === 'object') {
            update.cycleVisibility = { ...prefs.cycleVisibility };
          }
          if (prefs.hideOnboarding) safeLocalStorageSet('hide_onboarding_guide', 'true');
          if (serverUpdatedAt >= localUpdatedAt) {
            update._preferences_dirty = false;
            update.preferences_updated_at = prefs.updated_at;
          }
        }
      }

      return update;
    });

    if (data.serverTime) safeLocalStorageSet(tokenKey, String(data.serverTime));
  }
}

function safeLocalStorageGet(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeLocalStorageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* almacenamiento no disponible */
  }
}

export const syncManager = new SyncManager();

// Sincroniza automáticamente cuando alguna colección o preferencia cambia y contiene cambios pendientes.
useAppStore.subscribe((state, prev) => {
  if (
    state.tasks === prev.tasks &&
    state.lists === prev.lists &&
    state.cycles === prev.cycles &&
    state.listSections === prev.listSections &&
    state.tombstones === prev.tombstones &&
    state._preferences_dirty === prev._preferences_dirty &&
    state.smartListVisibility === prev.smartListVisibility &&
    state.pinnedSmartLists === prev.pinnedSmartLists &&
    state.cycleVisibility === prev.cycleVisibility
  ) {
    return;
  }
  if (syncManager.hasPendingChanges()) syncManager.triggerDebouncedSync();
});

