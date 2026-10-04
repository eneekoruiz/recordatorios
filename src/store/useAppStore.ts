import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from '../utils/idbStorage';
import type { TaskItem, CustomCycle, CustomList, ListSection } from '../models/Task';
import { TaskRepository } from '../repositories/TaskRepository';
import { isCompletedInCurrentPeriod, wouldCreateDependencyCycle } from '../services/TaskService';
import { getEffectiveCycleId, getPureCyclicPeriodicity } from '../utils/sectionRoutine';
import { isValidWeekday, readStoredWeeklyDay, writeStoredWeeklyDay } from '../utils/routineDay';
import { DEFAULT_SMART_LIST_VISIBILITY } from '../constants/smartLists';
import { smartSortTasks } from '../utils/smartSort';
import { readStoredDisplayName, writeStoredDisplayName } from '../utils/userIdentity';
import { findDuplicateTask } from '../utils/taskDeduplication';
import { FREQUENCY_RESERVED_COLORS, getReservedFrequencyColor } from '../constants/colors';

const optimisticUpdate = (
  get: () => AppState,
  set: (fn: (state: AppState) => Partial<AppState>) => void,
  mutationFn: (state: AppState) => Partial<AppState>
) => {
  const previousState = { tasks: get().tasks, lists: get().lists, cycles: get().cycles };
  try {
    set(mutationFn);
  } catch (err) {
    console.error("Storage persistence error, silently rolling back state:", err);
    set(() => previousState);
  }
};

/**
 * Tema con el que arranca la app la primerísima vez (sin nada aún persistido en
 * este dispositivo/navegador). Sin esto, un usuario nuevo vería siempre claro
 * durante ese primer render, aunque su sistema esté en oscuro: la función
 * `merge` de más abajo solo corrige el tema al rehidratar datos ya guardados,
 * así que un arranque totalmente en blanco necesita este mismo cálculo aquí.
 */
const getInitialTheme = (): 'light' | 'dark' => {
  try {
    if (localStorage.getItem('user_explicit_theme') === 'dark') return 'dark';
    if (localStorage.getItem('user_explicit_theme') === 'light') return 'light';
  } catch { /* sin almacenamiento */ }
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
};

export const isTaskCompleted = (t?: TaskItem | null): boolean => {
  if (!t) return false;
  // Si la tarea tiene meta de repeticiones (ej. 3 vasos de agua), solo se considera completada si se alcanza la meta
  if (t.targetCount && t.targetCount > 1) {
    return (t.currentCount || 0) >= t.targetCount;
  }
  // Only treat as completed if status is explicitly 'completed' or has a completed_at timestamp.
  // We do NOT use completionHistory here because recurring tasks accumulate history but reset to 'pending'.
  return t.status === 'completed' || !!t.completed_at;
};

/**
 * Repara la jerarquía de tareas (auto-referencia, padre inexistente o borrado, ciclos).
 * Cada reparación pasa por TaskRepository.update para subir `version` y `updated_at`: si no,
 * el servidor la vería idéntica a la tarea que ya tiene y un pull podría deshacerla.
 * `only` limita la comprobación a las tareas que han cambiado (evita recorrer todo el mapa
 * en cada edición); sin él se revisan todas. Devuelve el mismo objeto si no hay nada que reparar.
 */
export function sanitizeTaskHierarchy(tasks: Record<string, TaskItem>, only?: Iterable<string>): Record<string, TaskItem> {
  let result = tasks;
  const detach = (id: string, task: TaskItem) => {
    if (result === tasks) result = { ...tasks };
    result[id] = TaskRepository.update(task, { parentId: undefined });
  };

  for (const id of only ?? Object.keys(tasks)) {
    const task = result[id];
    if (!task || !task.parentId) continue;

    // 1. Auto-referencia
    if (task.parentId === id) {
      detach(id, task);
      continue;
    }

    // 2. Padre inexistente o borrado
    const parent = result[task.parentId];
    if (!parent || parent.deleted_at) {
      detach(id, task);
      continue;
    }

    // 3. Detección de ciclos
    let curr: TaskItem | undefined = parent;
    const visited = new Set<string>([id]);
    let hasCycle = false;
    while (curr && curr.parentId) {
      if (visited.has(curr.parentId)) {
        hasCycle = true;
        break;
      }
      visited.add(curr.parentId);
      curr = result[curr.parentId];
    }

    if (hasCycle) detach(id, task);
  }

  return result;
}

/** Ids de las tareas cuya referencia difiere entre dos mapas (para sanear solo lo modificado). */
const changedTaskIds = (prev: Record<string, TaskItem>, next: Record<string, TaskItem>): string[] => {
  const ids: string[] = [];
  for (const id in next) if (next[id] !== prev[id]) ids.push(id);
  return ids;
};

export function sanitizeSectionHierarchy(sections: ListSection[]): ListSection[] {
  const secMap = new Map(sections.map(s => [s.id, s]));
  const detach = (s: ListSection): ListSection => ({ ...s, parentId: undefined, _is_dirty: true, updated_at: new Date().toISOString() });
  return sections.map(s => {
    if (!s.parentId) return s;
    if (s.parentId === s.id) return detach(s);
    const parent = secMap.get(s.parentId);
    if (!parent || parent.deleted_at || parent.listId !== s.listId) return detach(s);
    // Detección de ciclos
    let curr: ListSection | undefined = parent;
    const visited = new Set<string>([s.id]);
    while (curr && curr.parentId) {
      if (visited.has(curr.parentId)) return detach(s);
      visited.add(curr.parentId);
      curr = secMap.get(curr.parentId);
    }
    return s;
  });
}

/** Margen para considerar que varias tareas se borraron en el mismo borrado en cascada. */
const CASCADE_DELETE_WINDOW_MS = 5000;

const INITIAL_LISTS: CustomList[] = [];

const INITIAL_CYCLES: CustomCycle[] = [
  { id: 'cycle_day', name: 'Diario', daysValue: 1, isPinned: true, icon: 'sun', color: FREQUENCY_RESERVED_COLORS.day },
  { id: 'cycle_week', name: 'Semanal', daysValue: 7, isPinned: true, icon: 'calendar', color: FREQUENCY_RESERVED_COLORS.week },
  { id: 'cycle_month', name: 'Mensual', daysValue: 30, isPinned: true, icon: 'moon', color: FREQUENCY_RESERVED_COLORS.month },
  { id: 'cycle_year', name: 'Anual', daysValue: 365, isPinned: true, icon: 'globe', color: FREQUENCY_RESERVED_COLORS.year },
];

interface AppState {
  tasks: Record<string, TaskItem>;
  cycles: CustomCycle[];
  lists: CustomList[];
  listSections: ListSection[];
  smartListVisibility: Record<string, boolean>;
  pinnedSmartLists: string[];
  cycleVisibility: Record<string, boolean>;
  preferences_updated_at?: string;
  _preferences_dirty?: boolean;
  /** Borrados de listas/ciclos/tareas pendientes de comunicar al servidor. */
  tombstones: { lists: CustomList[]; cycles: CustomCycle[]; tasks: TaskItem[] };
  restoreTask: (id: string) => void;
  permanentDeleteTask: (id: string) => void;
  emptyTrash: () => void;
  
  toggleSmartList: (listId: string) => void;
  /** Día de las tareas semanales (0 = domingo … 6 = sábado); se sincroniza entre dispositivos. */
  weeklyTasksDay: number;
  setWeeklyTasksDay: (day: number) => void;
  /** Nombre para saludar; se sincroniza entre dispositivos. Vacío = sin nombre (no se inventa). */
  displayName: string;
  setDisplayName: (name: string) => void;
  togglePinSmartList: (listId: string) => void;
  toggleCycleVisibility: (cycleId: string) => void;
  globalCyclesEnabled: boolean;
  showDuration: boolean; // flag to display automatic duration badge
  toggleGlobalCycles: () => void;
  setShowDuration: (val: boolean) => void;
  postponeTask: (taskId: string) => void;
  trackTaskExecution: (taskId: string, elapsedSeconds: number) => void;
  inlineEditingTaskId: string | null;
  setInlineEditingTaskId: (id: string | null) => void;
  dismissOnboarding: () => void;

  
  addTask: (task: Partial<TaskItem>) => void;
  addTasksBatch: (tasks: Partial<TaskItem>[], options?: { createList?: CustomList }) => void;
  updateTaskRaw: (task: TaskItem) => void; // Para uso interno y SyncProvider
  toggleTask: (id: string, forceReverse?: boolean) => void;
  deleteTask: (id: string) => void;
  deleteTaskWithOptions: (id: string, options?: { keepSubtasks?: boolean; permanent?: boolean }) => void;
  updateTask: (id: string, updates: Partial<TaskItem>) => void;
  reorderTasks: (orderedTaskIds: string[], taskUpdates?: Record<string, Partial<TaskItem>>) => void;
  
  addCycle: (cycle: CustomCycle) => void;
  updateCycle: (id: string, updates: Partial<CustomCycle>) => void;
  deleteCycle: (id: string) => void;

  addList: (list: CustomList) => void;
  updateList: (id: string, data: Partial<CustomList>) => void;
  reorderLists: (orderedListIds: string[], targetParentId?: string) => void;
  deleteList: (id: string) => { lists: number; tasks: number; undo: () => void };
  removeList: (id: string) => { lists: number; tasks: number; undo: () => void };

  addListSection: (section: ListSection) => void;
  updateListSection: (id: string, updatesOrName: string | Partial<ListSection>) => void;
  deleteListSection: (id: string) => void;
  restoreListSection: (id: string) => void;
  restoreCycle: (id: string) => void;
  reorderListSections: (updates: { id: string; order: number }[]) => void;
  duplicateSection: (sectionId: string) => void;
  emptySection: (sectionId: string, taskIds?: string[]) => void;
  moveSectionTasks: (taskIds: string[], targetListId: string, targetSectionId?: string) => void;
  setSectionTasksCompleted: (taskIds: string[], completed: boolean) => void;
  updateTaskSection: (taskId: string, sectionId: string | undefined) => void;

  purgeOldDeletedTasks: () => void;

  getTasksByCycle: (cycle_id: string, includeCompleted?: boolean, temporarilyShowIds?: string[]) => Record<string, TaskItem[]>;
  getTasksByList: (listId: string, includeCompleted?: boolean, temporarilyShowIds?: string[]) => Record<string, TaskItem[]>;
  getSmartSortTasks: (temporarilyShowIds?: string[]) => TaskItem[]; 

  exportData: () => string;
  importData: (jsonData: string) => void;
  parsePlainTextTasks: (text: string) => void;
  addDependency: (targetTaskId: string, blockedByTaskId: string) => void;
  removeDependency: (targetTaskId: string, blockedByTaskId: string) => void;
  nestTask: (taskId: string, parentId: string | undefined) => void;

  hasHydrated: boolean;
  setHasHydrated: (val: boolean) => void;

  token: string | null;
  userId: string | null;
  setToken: (token: string | null, userId: string | null) => void;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error' | 'offline';
  lastSyncedAt: number | null;
  setSyncStatus: (status: 'idle' | 'syncing' | 'synced' | 'error' | 'offline') => void;
  setLastSyncedAt: (timestamp: number) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  useSystemTheme: boolean;
  setUseSystemTheme: (val: boolean) => void;
  learnedDurations: Record<string, number>;
  setLearnedDuration: (taskId: string, minutes: number) => void;
  logout: () => void;
  /** La sesión caducó: se pide login de nuevo pero se conservan los datos locales. */
  expireSession: () => void;
  sessionExpired: boolean;
  cleanupDataHygiene: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      tasks: {},
      cycles: INITIAL_CYCLES,
      lists: INITIAL_LISTS,
      showDuration: true, // default to show duration
      inlineEditingTaskId: null,
      listSections: [],
      tombstones: { lists: [], cycles: [], tasks: [] },
      sessionExpired: false,
      token: null,
      userId: null,
      syncStatus: 'idle',
      lastSyncedAt: null,
      setSyncStatus: (syncStatus) => set({ syncStatus }),
      setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
      theme: getInitialTheme(),
      setTheme: (theme) => {
        try { localStorage.setItem('user_explicit_theme', theme); } catch {}
        set({ theme });
      },
      toggleTheme: () => set((state: AppState) => {
        const newTheme = state.theme === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem('user_explicit_theme', newTheme); } catch {}
        return { theme: newTheme, useSystemTheme: false };
      }),
      useSystemTheme: (() => {
        try { return localStorage.getItem('user_explicit_theme') === null; } catch { return true; }
      })(),
      setUseSystemTheme: (useSystemTheme) => set({ useSystemTheme }),
      learnedDurations: {},
      setLearnedDuration: (taskId, minutes) => set((state: AppState) => {
        const next = { ...state.learnedDurations };
        if (typeof minutes === 'number' && minutes > 0) {
          next[taskId] = minutes;
        } else {
          delete next[taskId];
        }
        return { learnedDurations: next };
      }),
      smartListVisibility: { ...DEFAULT_SMART_LIST_VISIBILITY },
      pinnedSmartLists: [],
      cycleVisibility: { cycle_day: true, cycle_week: true, cycle_month: true, cycle_year: true },
      globalCyclesEnabled: true,

      setToken: (token, userId) => {
        const prevUserId = get().userId;
        const isRealUser = (id: string | null) => !!id && !id.startsWith('local_guest');
        // Si otra cuenta real inicia sesión en este dispositivo, no mezclamos sus datos.
        if (isRealUser(prevUserId) && isRealUser(userId) && prevUserId !== userId) {
          try {
            localStorage.removeItem('sync_token_' + prevUserId);
          } catch { /* sin almacenamiento */ }
          set({
            token,
            userId,
            sessionExpired: false,
            tasks: {},
            lists: INITIAL_LISTS,
            cycles: INITIAL_CYCLES,
            listSections: [],
            tombstones: { lists: [], cycles: [], tasks: [] },
            _preferences_dirty: false,
          });
          return;
        }
        set({ token, userId, sessionExpired: false });
      },
      expireSession: () => set({ token: null, sessionExpired: true }),
      logout: () => {
        // Clear sync token from localStorage before wiping state
        const currentUserId = useAppStore.getState().userId;
        const currentToken = useAppStore.getState().token;
        if (currentUserId) localStorage.removeItem('sync_token_' + currentUserId);
        if (currentToken) localStorage.removeItem('sync_token_' + currentToken.slice(-16));
        localStorage.removeItem('sync_token_null');
        set({
          token: null,
          userId: null,
          tasks: {},
          lists: INITIAL_LISTS,
          cycles: INITIAL_CYCLES,
          listSections: [],
          tombstones: { lists: [], cycles: [], tasks: [] },
          sessionExpired: false,
          _preferences_dirty: false,
        });
      },
      hasHydrated: false,
      setHasHydrated: (val) => set({ hasHydrated: val }),

      toggleGlobalCycles: () => set((state: AppState) => ({ globalCyclesEnabled: !state.globalCyclesEnabled })),

      setShowDuration: (val: boolean) => set({ showDuration: val }),

      postponeTask: (taskId: string) => optimisticUpdate(get, set, (state) => {
        const task = state.tasks[taskId];
        if (!task) return state;
        // Find max order among siblings (same list + section)
        const siblings = Object.values(state.tasks).filter(
          (t: TaskItem) => !t.deleted_at && t.categoryId === task.categoryId && t.sectionId === task.sectionId
        );
        const maxOrder = siblings.reduce((max: number, t: TaskItem) => Math.max(max, t.order ?? 0), 0);
        return {
          tasks: {
            ...state.tasks,
            [taskId]: TaskRepository.update(task, { 
              order: maxOrder + 1,
              postponeCount: (task.postponeCount || 0) + 1 
            })
          }
        };
      }),

      trackTaskExecution: (taskId: string, elapsedSeconds: number) => optimisticUpdate(get, set, (state) => {
        const task = state.tasks[taskId];
        if (!task) return state;
        if (!Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return state;
        
        // Ventana rodante acotada a las últimas 10 ejecuciones para evitar inflar IndexedDB y el payload de sync
        const history = [...(task.executionHistory || []), Math.round(elapsedSeconds)].slice(-10);
        const updates: Partial<TaskItem> = { executionHistory: history };

        if (history.length >= 2) {
          const avgSeconds = history.reduce((sum, val) => sum + val, 0) / history.length;
          // Si el promedio es inferior a 45 segundos, sugerir 0.5 min (30 seg); en otro caso, minutos enteros
          const avgMinutes = avgSeconds < 45 ? 0.5 : Math.max(1, Math.round(avgSeconds / 60));
          
          const currentDuration = task.duration || 0;
          if (currentDuration > 0) {
            const diffPercentage = Math.abs(currentDuration - avgMinutes) / currentDuration;
            if (diffPercentage > 0.3) {
              updates.suggestedDuration = avgMinutes;
            } else if (task.suggestedDuration !== undefined) {
              updates.suggestedDuration = undefined; // limpiar sugerencia si ya está dentro de margen aceptable
            }
          } else {
            updates.suggestedDuration = avgMinutes;
          }
        }

        return {
          tasks: {
            ...state.tasks,
            [taskId]: TaskRepository.update(task, updates)
          }
        };
      }),

      setInlineEditingTaskId: (id: string | null) => set({ inlineEditingTaskId: id }),


      togglePinSmartList: (listId) => optimisticUpdate(get, set, (state) => {
        const currentPinned = state.pinnedSmartLists || [];
        const pinnedSmartLists = currentPinned.includes(listId)
          ? currentPinned.filter((id: string) => id !== listId)
          : [...currentPinned, listId];
        return { 
          pinnedSmartLists, 
          preferences_updated_at: new Date().toISOString(),
          _preferences_dirty: true 
        };
      }),


      displayName: readStoredDisplayName(),
      setDisplayName: (name) => {
        const clean = name.trim().slice(0, 60);
        writeStoredDisplayName(clean);
        set({ displayName: clean, preferences_updated_at: new Date().toISOString(), _preferences_dirty: true });
      },
      weeklyTasksDay: readStoredWeeklyDay(),
      setWeeklyTasksDay: (day) => {
        if (!isValidWeekday(day)) return;
        writeStoredWeeklyDay(day);
        set({ weeklyTasksDay: day, preferences_updated_at: new Date().toISOString(), _preferences_dirty: true });
      },

      toggleSmartList: (listId) => optimisticUpdate(get, set, (state) => ({
        smartListVisibility: { ...state.smartListVisibility, [listId]: !state.smartListVisibility[listId] },
        preferences_updated_at: new Date().toISOString(),
        _preferences_dirty: true,
      })),

      toggleCycleVisibility: (cycleId) => optimisticUpdate(get, set, (state) => ({
        cycleVisibility: { ...state.cycleVisibility, [cycleId]: !state.cycleVisibility[cycleId] },
        preferences_updated_at: new Date().toISOString(),
        _preferences_dirty: true,
      })),

      dismissOnboarding: () => {
        try {
          localStorage.setItem('hide_onboarding_guide', 'true');
        } catch { /* sin almacenamiento */ }
        const state: AppState = get();
        if (state.lists.some((l) => l.id === 'primeros_pasos')) {
          get().removeList('primeros_pasos');
        }
        optimisticUpdate(get, set, (current) => {
          const now = new Date().toISOString();
          const tasks = { ...current.tasks };
          let changed = false;
          for (const t of Object.values(current.tasks) as TaskItem[]) {
            if ((t.categoryId === 'primeros_pasos' || t.id.startsWith('task_onboarding_')) && !t.deleted_at) {
              tasks[t.id] = TaskRepository.update(t, { deleted_at: now });
              changed = true;
            }
          }
          return {
            ...(changed ? { tasks } : {}),
            pinnedSmartLists: (current.pinnedSmartLists || []).filter((id: string) => id !== 'smart_primeros_pasos'),
            smartListVisibility: { ...current.smartListVisibility, smart_primeros_pasos: false },
            preferences_updated_at: new Date().toISOString(),
            _preferences_dirty: true,
          };
        });
      },

      addTask: (payload) => optimisticUpdate(get, set, (state) => {
        // ── Duplicate guard ──────────────────────────────────────────────
        // Silently skip insertion if an identical task (same normalized title,
        // same list, same section) already exists and is not deleted.
        if (findDuplicateTask(payload, state.tasks)) {
          return state; // no-op
        }
        const newTask = TaskRepository.create(payload);
        // Auto-activate the cycle view when a task with a cycle_id is first created
        let newCycleVisibility = state.cycleVisibility;
        if (newTask.cycle_id && state.cycleVisibility[newTask.cycle_id] === undefined) {
          newCycleVisibility = { ...state.cycleVisibility, [newTask.cycle_id]: true };
        }
        return { 
          tasks: { 
            ...state.tasks, 
            [newTask.id]: newTask 
          },
          cycleVisibility: newCycleVisibility
        };
      }),

      addTasksBatch: (tasksToCreate, options) => optimisticUpdate(get, set, (state) => {
        let nextLists = state.lists;
        if (options?.createList) {
          if (!nextLists.some(l => l.id === options.createList!.id)) {
            nextLists = [...nextLists, options.createList];
          }
        }

        const newTasks = { ...state.tasks };
        let newCycleVisibility = { ...state.cycleVisibility };

        tasksToCreate.forEach(payload => {
          // Skip if an identical task already exists (dedup guard)
          if (findDuplicateTask(payload, newTasks)) return;
          const newTask = TaskRepository.create(payload);
          newTasks[newTask.id] = newTask;
          if (newTask.cycle_id && newCycleVisibility[newTask.cycle_id] === undefined) {
            newCycleVisibility[newTask.cycle_id] = true;
          }
        });

        return {
          tasks: newTasks,
          lists: nextLists,
          cycleVisibility: newCycleVisibility
        };
      }),

      updateTaskRaw: (task) => optimisticUpdate(get, set, (state) => ({
        tasks: {
          ...state.tasks,
          [task.id]: task
        }
      })),

      toggleTask: (id, forceReverse?: boolean) => optimisticUpdate(get, set, (state) => {
        const existingTask = state.tasks[id];
        if (!existingTask) return state;
        
        let updatedTask: TaskItem;
        const alerts = existingTask.alerts || [];
        const completedAlerts = existingTask.completedAlerts || [];
        const effCycle = getEffectiveCycleId(existingTask, state.listSections, state.lists);
        const isOneOff = !effCycle;
        const isTargetTask = Boolean(existingTask.targetCount && existingTask.targetCount > 1);
        const currentCount = existingTask.currentCount || 0;
        const targetCount = existingTask.targetCount || 1;
        
        // Auto-detect reverse if already completed or if forceReverse is explicitly passed
        const isDone = isTaskCompleted(existingTask) || isCompletedInCurrentPeriod(existingTask, state.cycles, state.listSections, state.lists);
        const shouldReverse = forceReverse !== undefined ? forceReverse : isDone;
        
        if (shouldReverse) {
          const newHistory = [...(existingTask.completionHistory || [])];
          
          if (isTargetTask) {
            if (newHistory.length > 0 && isTaskCompleted(existingTask)) {
              newHistory.pop();
            }
            const decrementedCount = Math.max(0, currentCount > 0 ? currentCount - 1 : 0);
            updatedTask = TaskRepository.update(existingTask, {
              status: 'pending',
              currentCount: decrementedCount,
              completionHistory: newHistory
            });
          } else if (completedAlerts.length > 0 && !existingTask.status?.includes('completed')) {
            // Uncheck last partial alert if not fully completed
            updatedTask = TaskRepository.update(existingTask, {
              completedAlerts: completedAlerts.slice(0, -1),
              status: 'pending',
              currentCount: 0
            });
          } else if (newHistory.length > 0) {
            // Uncheck full completion
            newHistory.pop();
            const restoredAlerts = alerts.length > 1 ? alerts.slice(0, -1).map(a => a.id).filter(Boolean) as string[] : [];
            updatedTask = TaskRepository.update(existingTask, {
              status: 'pending',
              completedAlerts: restoredAlerts,
              completionHistory: newHistory,
              currentCount: 0
            });
          } else {
            updatedTask = TaskRepository.update(existingTask, { 
              status: 'pending', 
              completedAlerts: [], 
              currentCount: 0 
            });
          }
        } else {
          // Normal complete forward logic
          if (isTargetTask) {
            const nextCount = currentCount + 1;
            if (nextCount < targetCount) {
              // Intermediate step: stay pending, increment count, no history push yet
              updatedTask = TaskRepository.update(existingTask, {
                currentCount: nextCount,
                status: 'pending'
              });
            } else {
              // Reached target count: mark as completed (or recurring pending with history)
              const newCompletionHistory = [...(existingTask.completionHistory || []), Date.now()];
              if (!isOneOff) {
                updatedTask = TaskRepository.update(existingTask, {
                  cycle_id: existingTask.cycle_id || effCycle || undefined,
                  completedAlerts: [],
                  completionHistory: newCompletionHistory,
                  status: 'pending',
                  currentCount: targetCount
                });
              } else {
                updatedTask = TaskRepository.update(existingTask, {
                  status: 'completed',
                  completedAlerts: [...completedAlerts, alerts[completedAlerts.length]?.id].filter(Boolean) as string[],
                  completionHistory: newCompletionHistory,
                  currentCount: targetCount
                });
              }
            }
          } else if (alerts.length > 1 && completedAlerts.length < alerts.length - 1) {
            const nextAlert = alerts[completedAlerts.length] || alerts[alerts.length - 1];
            updatedTask = TaskRepository.update(existingTask, { 
              completedAlerts: [...completedAlerts, nextAlert.id] 
            });
          } else {
            const newCompletionHistory = [...(existingTask.completionHistory || []), Date.now()];
            const targetCountUpdate = existingTask.targetCount ? { currentCount: existingTask.targetCount } : {};
            if (!isOneOff) {
              updatedTask = TaskRepository.update(existingTask, { 
                cycle_id: existingTask.cycle_id || effCycle || undefined,
                completedAlerts: [], 
                completionHistory: newCompletionHistory,
                status: 'pending',
                ...targetCountUpdate
              });
            } else {
              // Si la tarea tiene autoRollover activo o es una suscripción con fecha
              const isAutoRollover = existingTask.autoRollover || (existingTask.expirationType === 'subscription' && existingTask.dueDate);
              if (isAutoRollover && existingTask.dueDate) {
                const currentDue = new Date(existingTask.dueDate);
                const period = existingTask.subscriptionPeriod || 'monthly';
                // Sumar meses sin desbordar (31 ene + 1 mes = 28/29 feb, no 3 mar).
                const monthsToAdd = period === 'yearly' ? 12 : 1;
                const day = currentDue.getDate();
                currentDue.setDate(1);
                currentDue.setMonth(currentDue.getMonth() + monthsToAdd);
                const lastDay = new Date(currentDue.getFullYear(), currentDue.getMonth() + 1, 0).getDate();
                currentDue.setDate(Math.min(day, lastDay));
                const nextDueDateStr = currentDue.toISOString();
                updatedTask = TaskRepository.update(existingTask, {
                  status: 'pending',
                  dueDate: nextDueDateStr,
                  completedAlerts: [],
                  completionHistory: newCompletionHistory,
                  ...targetCountUpdate
                });
                const formattedDate = currentDue.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
                window.dispatchEvent(new CustomEvent('show-toast', {
                  detail: `Renovación automática: próximo vencimiento el ${formattedDate}`
                }));
              } else {
                updatedTask = TaskRepository.update(existingTask, { 
                  status: 'completed',
                  completedAlerts: [...completedAlerts, alerts[completedAlerts.length]?.id].filter(Boolean) as string[],
                  completionHistory: newCompletionHistory,
                  ...targetCountUpdate
                });
              }
            }
          }
        }

        // Lógica de cascada: si se tacha un recordatorio padre, se completan también todas sus subtareas recursivamente
        const childUpdates: Record<string, TaskItem> = {};
        if (!shouldReverse && (updatedTask.status === 'completed' || isDone)) {
          const queue = [id];
          const nowTs = Date.now();
          while (queue.length > 0) {
            const curParentId = queue.shift()!;
            for (const t of Object.values(state.tasks)) {
              if (t.parentId === curParentId && !t.deleted_at && !childUpdates[t.id]) {
                queue.push(t.id);
                const childEffCycle = getEffectiveCycleId(t, state.listSections, state.lists);
                const childIsOneOff = !childEffCycle;
                const childHistory = [...(t.completionHistory || []), nowTs];
                const childTargetUpdate = t.targetCount ? { currentCount: t.targetCount } : {};
                const childAlerts = t.alerts || [];
                const childCompletedAlerts = childAlerts.map(a => a.id).filter(Boolean) as string[];

                if (!childIsOneOff) {
                  childUpdates[t.id] = TaskRepository.update(t, {
                    cycle_id: t.cycle_id || childEffCycle || undefined,
                    completedAlerts: childCompletedAlerts,
                    completionHistory: childHistory,
                    status: 'pending',
                    ...childTargetUpdate
                  });
                } else {
                  childUpdates[t.id] = TaskRepository.update(t, {
                    status: 'completed',
                    completedAlerts: childCompletedAlerts,
                    completionHistory: childHistory,
                    ...childTargetUpdate
                  });
                }
              }
            }
          }
        }

        return {
          tasks: {
            ...state.tasks,
            [id]: updatedTask,
            ...childUpdates
          }
        };
      }),

      deleteTask: (id) => optimisticUpdate(get, set, (state) => {
        const existingTask = state.tasks[id];
        if (!existingTask) return state;
        const deletedTask = TaskRepository.markAsDeleted(existingTask);
        return { 
          tasks: { 
            ...state.tasks,
            [id]: deletedTask
          } 
        };
      }),

      deleteTaskWithOptions: (id, options) => optimisticUpdate(get, set, (state) => {
        const task = state.tasks[id];
        if (!task) return state;

        const keepSubtasks = options?.keepSubtasks ?? false;
        const permanent = options?.permanent ?? false;
        const now = new Date().toISOString();
        const updatedTasks = { ...state.tasks };

        // Subtareas directas
        const directChildren = Object.values(state.tasks)
          .filter(t => t.parentId === id && !t.deleted_at)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        if (keepSubtasks && directChildren.length > 0) {
          // Desangrar subtareas: colocarlas como tareas raíz inmediatamente donde estaba el padre
          const siblingRoots = Object.values(state.tasks)
            .filter(t => !t.deleted_at && !t.parentId && t.categoryId === task.categoryId && (t.sectionId || undefined) === (task.sectionId || undefined))
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

          const parentIdx = siblingRoots.findIndex(t => t.id === id);

          // Des-anidar los hijos directos
          directChildren.forEach((child) => {
            updatedTasks[child.id] = TaskRepository.update(child, {
              parentId: undefined,
            });
          });

          // Insertar en la lista de raíces ordenadas
          const reordered = siblingRoots.filter(t => t.id !== id);
          const insertIdx = parentIdx !== -1 ? parentIdx : reordered.length;
          reordered.splice(insertIdx, 0, ...directChildren);
          reordered.forEach((t, idx) => {
            if (updatedTasks[t.id]) {
              updatedTasks[t.id] = TaskRepository.update(updatedTasks[t.id], { order: idx });
            }
          });

          // Eliminar la tarea padre
          if (permanent) {
            delete updatedTasks[id];
          } else {
            updatedTasks[id] = TaskRepository.markAsDeleted(task);
          }
        } else {
          // Eliminar la tarea padre Y todos sus descendientes recursivamente
          const doomedIds = new Set<string>([id]);
          let grew = true;
          while (grew) {
            grew = false;
            for (const t of Object.values(updatedTasks)) {
              if (t.parentId && doomedIds.has(t.parentId) && !doomedIds.has(t.id)) {
                doomedIds.add(t.id);
                grew = true;
              }
            }
          }

          if (permanent) {
            const doomedTasks: any[] = [];
            doomedIds.forEach(did => {
              const doomed = updatedTasks[did];
              if (doomed) {
                doomedTasks.push({ ...doomed, _hard_delete: true, _is_dirty: true, updated_at: now });
                delete updatedTasks[did];
              }
            });
            return {
              tasks: updatedTasks,
              tombstones: {
                ...state.tombstones,
                tasks: [...(state.tombstones.tasks || []).filter((t: any) => !doomedIds.has(t.id)), ...doomedTasks]
              }
            };
          } else {
            doomedIds.forEach(did => {
              if (updatedTasks[did]) {
                updatedTasks[did] = TaskRepository.markAsDeleted(updatedTasks[did]);
              }
            });
          }
        }

        return { tasks: updatedTasks };
      }),

      restoreTask: (id) => optimisticUpdate(get, set, (state) => {
        const existingTask = state.tasks[id];
        if (!existingTask) return state;
        const updatedTasks = { ...state.tasks };
        const parent = existingTask.parentId ? state.tasks[existingTask.parentId] : undefined;
        // Si su padre sigue en la papelera, vuelve como tarea raíz (decisión explícita, no la
        // toma en silencio el sanitizador en la siguiente hidratación).
        const detach = !!existingTask.parentId && (!parent || !!parent.deleted_at);
        updatedTasks[id] = TaskRepository.update(existingTask, {
          deleted_at: undefined,
          ...(detach ? { parentId: undefined } : {}),
        });

        // Restauración en cascada: las subtareas que se borraron junto con el padre (mismo
        // borrado en cascada, marcas de tiempo casi idénticas) vuelven con él. Las que se
        // borraron por separado, antes o después, siguen en la papelera.
        const deletedAt = existingTask.deleted_at ? new Date(existingTask.deleted_at).getTime() : NaN;
        if (Number.isFinite(deletedAt)) {
          const restoredIds = new Set<string>([id]);
          let grew = true;
          while (grew) {
            grew = false;
            for (const t of Object.values(state.tasks)) {
              if (!t.deleted_at || !t.parentId || !restoredIds.has(t.parentId) || restoredIds.has(t.id)) continue;
              if (Math.abs(new Date(t.deleted_at).getTime() - deletedAt) > CASCADE_DELETE_WINDOW_MS) continue;
              restoredIds.add(t.id);
              updatedTasks[t.id] = TaskRepository.update(t, { deleted_at: undefined });
              grew = true;
            }
          }
        }
        return { tasks: updatedTasks };
      }),

      permanentDeleteTask: (id) => optimisticUpdate(get, set, (state) => {
        const existingTask = state.tasks[id];
        const newTasks = { ...state.tasks };
        delete newTasks[id];
        const doomedTask = existingTask
          ? { ...existingTask, _hard_delete: true, _is_dirty: true, updated_at: new Date().toISOString() }
          : { id, _hard_delete: true, _is_dirty: true, updated_at: new Date().toISOString() };
        return {
          tasks: newTasks,
          tombstones: {
            ...state.tombstones,
            tasks: [...(state.tombstones.tasks || []).filter((t: any) => t.id !== id), doomedTask as any]
          }
        };
      }),

      emptyTrash: () => optimisticUpdate(get, set, (state) => {
        const newTasks = { ...state.tasks };
        const purged: any[] = [];
        const now = new Date().toISOString();
        for (const id in newTasks) {
          if (newTasks[id].deleted_at) {
            purged.push({ ...newTasks[id], _hard_delete: true, _is_dirty: true, updated_at: now });
            delete newTasks[id];
          }
        }
        if (purged.length === 0) return state;
        return {
          tasks: newTasks,
          tombstones: {
            ...state.tombstones,
            tasks: [...(state.tombstones.tasks || []), ...purged]
          }
        };
      }),

      updateTask: (id, updates) => optimisticUpdate(get, set, (state) => {
        const task = state.tasks[id];
        if (!task) return state;

        const safeUpdates = { ...updates };
        if (safeUpdates.parentId !== undefined) {
          if (safeUpdates.parentId === id) {
            safeUpdates.parentId = undefined;
          } else if (safeUpdates.parentId) {
            let curr = state.tasks[safeUpdates.parentId];
            const visited = new Set<string>();
            while (curr && curr.parentId) {
              if (curr.parentId === id) {
                safeUpdates.parentId = undefined;
                break;
              }
              if (visited.has(curr.parentId)) break;
              visited.add(curr.parentId);
              curr = state.tasks[curr.parentId];
            }
          }
        }

        const updated = TaskRepository.update(task, safeUpdates);
        const updatedTasks = {
          ...state.tasks,
          [id]: updated
        };

        // Si se cambia la lista o la sección de una tarea padre, propagar el cambio a todas sus subtareas
        if (updates.categoryId !== undefined || updates.sectionId !== undefined) {
          const targetCat = updates.categoryId !== undefined ? updates.categoryId : updated.categoryId;
          const targetSec = updates.sectionId !== undefined ? updates.sectionId : updated.sectionId;
          Object.values(state.tasks).forEach(c => {
            if (!c.deleted_at && c.parentId === id) {
              updatedTasks[c.id] = TaskRepository.update(c, {
                categoryId: targetCat,
                sectionId: targetSec
              });
            }
          });
        }

        // Si una subtarea cambia de lista o sección y difiere de su padre, desanidarla para no romper la jerarquía
        if (updated.parentId && (updates.categoryId !== undefined || updates.sectionId !== undefined)) {
          const parent = state.tasks[updated.parentId];
          if (parent && (parent.categoryId !== updated.categoryId || parent.sectionId !== updated.sectionId)) {
            updatedTasks[id] = TaskRepository.update(updatedTasks[id], { parentId: undefined });
          }
        }

        return {
          tasks: sanitizeTaskHierarchy(updatedTasks, changedTaskIds(state.tasks, updatedTasks))
        };
      }),

      reorderTasks: (orderedTaskIds, taskUpdates) => optimisticUpdate(get, set, (state) => {
        const newTasks = { ...state.tasks };
        let changed = false;

        if (taskUpdates) {
          Object.entries(taskUpdates).forEach(([id, upd]) => {
            const t = newTasks[id];
            if (t) {
              const safeUpd = { ...upd };
              if (safeUpd.parentId === id) {
                safeUpd.parentId = undefined;
              }
              newTasks[id] = TaskRepository.update(t, safeUpd);
              changed = true;
            }
          });
        }

        orderedTaskIds.forEach((id, index) => {
          const t = newTasks[id];
          if (t && t.order !== index) {
            newTasks[id] = TaskRepository.update(t, { order: index });
            changed = true;
          }
        });
        const sanitized = sanitizeTaskHierarchy(newTasks, changedTaskIds(state.tasks, newTasks));
        return changed ? { tasks: sanitized } : state;
      }),

      addCycle: (cycle) => optimisticUpdate(get, set, (state) => {
        const norm = (cycle.name || '').trim().toLowerCase();
        const days = Number(cycle.daysValue);
        let targetId = cycle.id;
        if (cycle.id === 'cycle_day' || norm === 'diario' || norm === 'diaria' || days === 1) targetId = 'cycle_day';
        else if (cycle.id === 'cycle_week' || norm === 'semanal' || days === 7) targetId = 'cycle_week';
        else if (cycle.id === 'cycle_month' || norm === 'mensual' || days === 30) targetId = 'cycle_month';
        else if (cycle.id === 'cycle_year' || norm === 'anual' || days === 365) targetId = 'cycle_year';

        const isCore = ['cycle_day', 'cycle_week', 'cycle_month', 'cycle_year'].includes(targetId);
        const cycleColor = isCore ? getReservedFrequencyColor(targetId) : (cycle.color || FREQUENCY_RESERVED_COLORS.day);

        const cleanPrior = state.cycles.filter(c => {
          if (c.id === targetId || c.id === cycle.id) return false;
          if (isCore) {
            const cNorm = (c.name || '').trim().toLowerCase();
            const cDays = Number(c.daysValue);
            if (targetId === 'cycle_day' && (cNorm === 'diario' || cNorm === 'diaria' || cDays === 1)) return false;
            if (targetId === 'cycle_week' && (cNorm === 'semanal' || cDays === 7)) return false;
            if (targetId === 'cycle_month' && (cNorm === 'mensual' || cDays === 30)) return false;
            if (targetId === 'cycle_year' && (cNorm === 'anual' || cDays === 365)) return false;
          }
          return true;
        });

        const newCycle = {
          ...cycle,
          id: targetId,
          color: cycleColor,
          _is_dirty: cycle._is_dirty ?? true,
          updated_at: cycle.updated_at || new Date().toISOString()
        };

        return {
          cycles: [...cleanPrior, newCycle].sort((a, b) => (a.daysValue || 0) - (b.daysValue || 0))
        };
      }),

      updateCycle: (id, updates) => optimisticUpdate(get, set, (state) => ({
        cycles: state.cycles.map(c => c.id === id ? { 
          ...c, 
          ...updates, 
          _is_dirty: updates._is_dirty ?? true, 
          updated_at: new Date().toISOString() 
        } : c).sort((a, b) => a.daysValue - b.daysValue)
      })),

      deleteCycle: (id) => optimisticUpdate(get, set, (state) => {
        const cycle = state.cycles.find((c) => c.id === id);
        if (!cycle) return state;
        const now = new Date().toISOString();
        const tasks = { ...state.tasks };
        let changed = false;
        for (const t of Object.values(state.tasks) as TaskItem[]) {
          if (t.cycle_id === id) {
            tasks[t.id] = TaskRepository.update(t, { cycle_id: undefined });
            changed = true;
          }
        }
        return {
          cycles: state.cycles.filter((c) => c.id !== id),
          tombstones: {
            ...state.tombstones,
            cycles: [...state.tombstones.cycles.filter((c) => c.id !== id), { ...cycle, deleted_at: now, updated_at: now, _is_dirty: true }],
          },
          ...(changed ? { tasks } : {}),
        };
      }),

      addList: (list) => optimisticUpdate(get, set, (state) => ({
        lists: [...state.lists.filter(l => l.id !== list.id), { 
          ...list, 
          _is_dirty: list._is_dirty ?? true, 
          updated_at: list.updated_at || new Date().toISOString() 
        }]
      })),

      updateList: (id, data) => optimisticUpdate(get, set, (state) => ({
        lists: state.lists.map(l => l.id === id ? { 
          ...l, 
          ...data, 
          _is_dirty: data._is_dirty ?? true, 
          updated_at: new Date().toISOString() 
        } : l)
      })),

      reorderLists: (orderedListIds, targetParentId) => optimisticUpdate(get, set, (state) => {
        const idSet = new Set(orderedListIds);
        const remaining = state.lists.filter(l => !idSet.has(l.id));
        const updatedOrdered = orderedListIds
          .map((id, index) => {
            const item = state.lists.find(l => l.id === id);
            if (!item) return null;
            return {
              ...item,
              order: index,
              parentId: targetParentId !== undefined ? targetParentId : item.parentId,
              _is_dirty: true,
              updated_at: new Date().toISOString()
            };
          })
          .filter(Boolean) as CustomList[];

        return {
          lists: [...updatedOrdered, ...remaining]
        };
      }),

      removeList: (id) => {
        const state: AppState = get();
        // Recoger la lista y todas sus sublistas (a cualquier profundidad).
        const doomed = new Set<string>([id]);
        let grew = true;
        while (grew) {
          grew = false;
          for (const l of state.lists) {
            if (l.parentId && doomed.has(l.parentId) && !doomed.has(l.id)) {
              doomed.add(l.id);
              grew = true;
            }
          }
        }
        const now = new Date().toISOString();
        const removedLists = state.lists.filter((l) => doomed.has(l.id));
        const tasks = { ...state.tasks };
        const deletedTaskIds: string[] = [];
        for (const t of Object.values(state.tasks) as TaskItem[]) {
          if (t.categoryId && doomed.has(t.categoryId) && !t.deleted_at) {
            tasks[t.id] = TaskRepository.markAsDeleted(t);
            deletedTaskIds.push(t.id);
          }
        }
        const deletedSectionIds = (state.listSections || []).filter((s) => doomed.has(s.listId) && !s.deleted_at).map((s) => s.id);
        optimisticUpdate(get, set, (current) => ({
          lists: current.lists.filter((l) => !doomed.has(l.id)),
          listSections: (current.listSections || []).map((s) =>
            doomed.has(s.listId) && !s.deleted_at ? { ...s, deleted_at: now, updated_at: now, _is_dirty: true } : s
          ),
          tasks,
          tombstones: {
            ...current.tombstones,
            lists: [
              ...current.tombstones.lists.filter((l) => !doomed.has(l.id)),
              ...removedLists.map((l) => ({ ...l, deleted_at: now, updated_at: now, _is_dirty: true })),
            ],
          },
        }));
        const undo = () => {
          const restoredAt = new Date().toISOString();
          const sectionSet = new Set(deletedSectionIds);
          optimisticUpdate(get, set, (current) => {
            const restoredTasks = { ...current.tasks };
            for (const tid of deletedTaskIds) {
              const t = restoredTasks[tid];
              if (t) restoredTasks[tid] = TaskRepository.update(t, { deleted_at: undefined });
            }
            const existing = new Set(current.lists.map((l) => l.id));
            return {
              lists: [
                ...current.lists,
                ...removedLists
                  .filter((l) => !existing.has(l.id))
                  .map((l) => ({ ...l, deleted_at: undefined, updated_at: restoredAt, _is_dirty: true })),
              ],
              listSections: (current.listSections || []).map((s) =>
                sectionSet.has(s.id) ? { ...s, deleted_at: undefined, updated_at: restoredAt, _is_dirty: true } : s
              ),
              tasks: restoredTasks,
              tombstones: { ...current.tombstones, lists: current.tombstones.lists.filter((l) => !doomed.has(l.id)) },
            };
          });
        };
        return { lists: removedLists.length, tasks: deletedTaskIds.length, undo };
      },

      deleteList: (id) => get().removeList(id),

      addListSection: (section) => set((state: AppState) => ({
        listSections: [
          ...(state.listSections || []).filter((s: ListSection) => s.id !== section.id),
          {
            ...section,
            name: (typeof section?.name === 'string' && section.name.trim()) ? section.name.trim() : 'Nueva sección',
            _is_dirty: true,
            updated_at: section.updated_at || new Date().toISOString()
          }
        ]
      })),

      updateListSection: (id, updatesOrName) => set((state: AppState) => {
        const updates: Partial<ListSection> = typeof updatesOrName === 'string'
          ? { name: updatesOrName.trim() || 'Nueva sección' }
          : { ...(updatesOrName as Partial<ListSection>) };

        if (updates.parentId !== undefined) {
          if (updates.parentId === id) {
            updates.parentId = undefined;
          } else if (updates.parentId) {
            const secMap = new Map<string, ListSection>((state.listSections || []).map((s: ListSection) => [s.id, s]));
            let curr = secMap.get(updates.parentId);
            const visited = new Set<string>();
            while (curr && curr.parentId) {
              if (curr.parentId === id) {
                updates.parentId = undefined;
                break;
              }
              if (visited.has(curr.parentId)) break;
              visited.add(curr.parentId);
              curr = secMap.get(curr.parentId);
            }
          }
        }

        return {
          listSections: (state.listSections || []).map((s: ListSection) => s.id === id ? {
            ...s,
            ...updates,
            _is_dirty: true,
            updated_at: new Date().toISOString()
          } : s)
        };
      }),

      // Deshacer «eliminar sección»: vuelve con una fecha de edición nueva (si no, el servidor, que ya puede
      // tener la sección borrada, la seguiría viendo como más antigua que su borrado).
      restoreListSection: (id) => optimisticUpdate(get, set, (state) => {
        const now = new Date().toISOString();
        return {
          listSections: (state.listSections || []).map((s) =>
            s.id === id ? { ...s, deleted_at: undefined, _is_dirty: true, updated_at: now } : s
          ),
        };
      }),

      // Deshacer «eliminar frecuencia»: sale de las lápidas y vuelve a la lista.
      restoreCycle: (id) => optimisticUpdate(get, set, (state) => {
        const gone = (state.tombstones?.cycles || []).find((c: any) => c.id === id);
        if (!gone || state.cycles.some((c) => c.id === id)) return state;
        const { deleted_at: _deleted, ...rest } = gone as any;
        return {
          cycles: [...state.cycles, { ...rest, _is_dirty: true, updated_at: new Date().toISOString() }],
          tombstones: { ...state.tombstones, cycles: state.tombstones.cycles.filter((c: any) => c.id !== id) },
        };
      }),

      deleteListSection: (id) => optimisticUpdate(get, set, (state) => {
        const updatedTasks = { ...state.tasks };
        let changed = false;
        for (const taskId in updatedTasks) {
          if (updatedTasks[taskId].sectionId === id) {
            updatedTasks[taskId] = { ...updatedTasks[taskId], sectionId: undefined, _is_dirty: true, updated_at: new Date().toISOString() };
            changed = true;
          }
        }

        const now = new Date().toISOString();
        const updatedSections = (state.listSections || []).map((s: any) => {
          if (s.id === id) {
            return { ...s, deleted_at: now, _is_dirty: true, updated_at: now };
          }
          if (s.parentId === id) {
            return { ...s, parentId: undefined, _is_dirty: true, updated_at: now };
          }
          return s;
        });

        return {
          listSections: sanitizeSectionHierarchy(updatedSections),
          tasks: changed ? updatedTasks : state.tasks
        };
      }),

      reorderListSections: (updates) => optimisticUpdate(get, set, (state) => {
        const orderMap = new Map(updates.map(u => [u.id, u.order]));
        const now = new Date().toISOString();
        return {
          listSections: (state.listSections || []).map(s => {
            if (orderMap.has(s.id)) {
              return { ...s, order: orderMap.get(s.id), _is_dirty: true, updated_at: now };
            }
            return s;
          })
        };
      }),

      duplicateSection: (sectionId) => optimisticUpdate(get, set, (state) => {
        const sec = (state.listSections || []).find(s => s.id === sectionId);
        if (!sec) return state;

        const now = new Date().toISOString();
        const newSectionId = crypto.randomUUID();
        const baseName = (typeof sec.name === 'string' && sec.name.trim()) ? sec.name.trim() : 'Sección';
        const newSection: ListSection = {
          ...sec,
          id: newSectionId,
          name: `${baseName} (copia)`,
          order: (sec.order ?? 0) + 1,
          created_at: now,
          updated_at: now,
          _is_dirty: true,
        };

        const originalTasks = Object.values(state.tasks).filter(
          t => t.sectionId === sectionId && !t.deleted_at
        );

        const newTasksMap: Record<string, TaskItem> = {};
        originalTasks.forEach(t => {
          const newTaskId = crypto.randomUUID();
          newTasksMap[newTaskId] = {
            ...t,
            id: newTaskId,
            sectionId: newSectionId,
            status: 'pending',
            completionHistory: [],
            completedAlerts: [],
            created_at: now,
            updated_at: now,
            _is_dirty: true,
          };
        });

        return {
          listSections: [...(state.listSections || []), newSection],
          tasks: { ...state.tasks, ...newTasksMap }
        };
      }),

      emptySection: (sectionId, taskIds) => optimisticUpdate(get, set, (state) => {
        const now = new Date().toISOString();
        const newTasks = { ...state.tasks };
        let changed = false;

        const targetIds = taskIds || Object.values(state.tasks)
          .filter(t => t.sectionId === sectionId && !t.deleted_at)
          .map(t => t.id);

        targetIds.forEach(id => {
          const t = newTasks[id];
          if (t && !t.deleted_at) {
            newTasks[id] = TaskRepository.update(t, { deleted_at: now });
            changed = true;
          }
        });

        return changed ? { tasks: newTasks } : state;
      }),

      moveSectionTasks: (taskIds, targetListId, targetSectionId) => optimisticUpdate(get, set, (state) => {
        const newTasks = { ...state.tasks };
        let changed = false;

        taskIds.forEach(id => {
          const t = newTasks[id];
          if (t) {
            newTasks[id] = TaskRepository.update(t, {
              categoryId: targetListId,
              sectionId: targetSectionId || undefined,
            });
            changed = true;
          }
        });

        return changed ? { tasks: newTasks } : state;
      }),

      setSectionTasksCompleted: (taskIds, completed) => optimisticUpdate(get, set, (state) => {
        const newTasks = { ...state.tasks };
        let changed = false;

        taskIds.forEach(id => {
          const t = newTasks[id];
          if (t) {
            if (completed) {
              newTasks[id] = TaskRepository.update(t, {
                status: 'completed',
                completionHistory: [...(t.completionHistory || []), Date.now()]
              });
            } else {
              const newHistory = [...(t.completionHistory || [])];
              if (newHistory.length > 0) newHistory.pop();
              newTasks[id] = TaskRepository.update(t, {
                status: 'pending',
                completionHistory: newHistory,
                currentCount: 0
              });
            }
            changed = true;
          }
        });

        return changed ? { tasks: newTasks } : state;
      }),

      updateTaskSection: (taskId, sectionId) => optimisticUpdate(get, set, (state) => {
        const task = state.tasks[taskId];
        if (!task) return state;

        const updatedTasks = { ...state.tasks };
        let parentId = task.parentId;
        if (parentId && state.tasks[parentId] && state.tasks[parentId].sectionId !== sectionId) {
          parentId = undefined;
        }

        updatedTasks[taskId] = TaskRepository.update(task, { sectionId, parentId });

        // Propagar la sección a las subtareas hijas
        Object.values(state.tasks).forEach(c => {
          if (!c.deleted_at && c.parentId === taskId) {
            updatedTasks[c.id] = TaskRepository.update(c, { sectionId });
          }
        });

        return { tasks: updatedTasks };
      }),

      purgeOldDeletedTasks: () => optimisticUpdate(get, set, (state) => {
        const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        const newTasks = { ...state.tasks };
        let purged = false;
        
        for (const taskId in newTasks) {
          const task = newTasks[taskId];
          if (task.deleted_at && task.updated_at && (now - new Date(task.updated_at).getTime() > THIRTY_DAYS_MS)) {
            delete newTasks[taskId];
            purged = true;
          }
        }
        
        return purged ? { tasks: newTasks } : state;
      }),

      // Algoritmo de Cascada Matemático
      getTasksByCycle: (cycleId, includeCompleted = false, temporarilyShowIds = []) => {
        const tasks = get().tasks as Record<string, TaskItem>;
        const cycles = get().cycles as CustomCycle[];
        const targetCycle = cycles.find((c: any) => c.id === cycleId);
        if (!targetCycle) return {};

        const validCycles = cycles.filter((c: any) => c.daysValue <= targetCycle.daysValue).map((c: any) => c.id);

        const matchedTasks = (Object.values(tasks) as TaskItem[])
          .filter((t: any) => !t.deleted_at && (includeCompleted || !isTaskCompleted(t) || temporarilyShowIds.includes(t.id)))
          .filter((t: any) => {
            if (t.categoryId === 'primeros_pasos') return false;
            const effCycle = getEffectiveCycleId(t, get().listSections, get().lists);
            if (!effCycle) return false;
            return validCycles.includes(effCycle as string);
          })
          .filter((t: any) => includeCompleted || temporarilyShowIds.includes(t.id) || !isCompletedInCurrentPeriod(t, cycles, get().listSections, get().lists));

        const tasksToInclude = new Map<string, TaskItem>();
        matchedTasks.forEach((t: any) => {
          tasksToInclude.set(t.id, t);
          let current = t;
          while (current.parentId) {
            const parent = tasks[current.parentId];
            if (!parent || parent.deleted_at) break;
            const parentEff = getEffectiveCycleId(parent, get().listSections, get().lists);
            if (!parentEff || !validCycles.includes(parentEff as string)) {
              break;
            }
            if (!tasksToInclude.has(parent.id)) {
              tasksToInclude.set(parent.id, parent);
            }
            current = parent;
          }
        });

        const grouped: Record<string, TaskItem[]> = {};
        const sortedTasks = Array.from(tasksToInclude.values())
          .sort((a: any, b: any) => {
            const cyclesList = get().cycles || [];
            const cA = cyclesList.find((c: any) => c.id === a.cycle_id)?.daysValue || 999;
            const cB = cyclesList.find((c: any) => c.id === b.cycle_id)?.daysValue || 999;
            if (cA !== cB) return cA - cB;
            
            const todOrder: Record<string, number> = { morning: 1, afternoon: 2, night: 3, none: 4 };
            const todA = todOrder[a.timeOfDay || 'none'] || 4;
            const todB = todOrder[b.timeOfDay || 'none'] || 4;
            if (todA !== todB) return todA - todB;
            
            if ((a.order ?? 0) !== (b.order ?? 0)) return (a.order ?? 0) - (b.order ?? 0);
            
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          });
          
        sortedTasks.forEach((t: any) => {
          const listId = t.categoryId || (t as any).category_id || 'inbox';
          if (!grouped[listId]) grouped[listId] = [];
          grouped[listId].push(t);
        });
        return grouped;
      },

      getTasksByList: (listId, includeCompleted = false, temporarilyShowIds = []) => {
        const tasks = get().tasks as Record<string, TaskItem>;
        const lists = get().lists as CustomList[];
        const cycles = get().cycles as CustomCycle[];
        const listSections = get().listSections as ListSection[];
        const validListIds = new Set(lists.map((l: any) => l.id));
        const filtered = (Object.values(tasks) as TaskItem[]).filter((t: any) => {
          if (t.deleted_at) return false;
          const taskCat = t.categoryId || (t as any).category_id;
          // If the task claims to be in a list that doesn't exist, treat it as inbox
          const effectiveCat = (taskCat && taskCat !== 'inbox' && !validListIds.has(taskCat)) 
            ? undefined 
            : taskCat;
          const matchesList = listId === 'inbox' 
            ? (effectiveCat === 'inbox' || !effectiveCat)
            : effectiveCat === listId;
          const isDone = isTaskCompleted(t) || isCompletedInCurrentPeriod(t, cycles, listSections, lists);
          return matchesList && (includeCompleted || !isDone || temporarilyShowIds.includes(t.id));
        });
        
        const grouped: Record<string, TaskItem[]> = {};
        
        // 1. Initialize no_section key FIRST so uncategorized tasks appear at the top
        grouped['no_section'] = [];
        
        // 2. Pre-initialize defined manual sections for this list so empty sections are visible
        const sectionsForList = (listSections || [])
          .filter((s: any) => s.listId === listId && !s.deleted_at)
          .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
        const activeSectionIds = new Set(sectionsForList.map((s: any) => s.id));
        for (const sec of sectionsForList) {
          grouped[`section_${sec.id}`] = [];
        }

        for (const task of filtered) {
          let groupKey = '';
          const taskSecId = task.sectionId || (task as any).section_id;
          
          if (task.cycle_id) {
            const purePeriod = task.cycle_id.replace('cycle_', '');
            if (taskSecId && activeSectionIds.has(taskSecId)) {
              const sec = sectionsForList.find((s: any) => s.id === taskSecId);
              const purePeriodicity = sec ? getPureCyclicPeriodicity(sec.name) : null;
              if (purePeriodicity) {
                groupKey = `cycle_cycle_${purePeriod}`;
              } else {
                groupKey = `section_${taskSecId}`;
              }
            } else {
              groupKey = `cycle_cycle_${purePeriod}`;
            }
          } else if (taskSecId && activeSectionIds.has(taskSecId)) {
            const sec = sectionsForList.find((s: any) => s.id === taskSecId);
            const purePeriodicity = sec ? getPureCyclicPeriodicity(sec.name) : null;
            groupKey = purePeriodicity ? `cycle_cycle_${purePeriodicity}` : `section_${taskSecId}`;
          } else if (taskSecId) {
            const aliasedSec = sectionsForList.find((s: any) => 
              s.id === taskSecId || 
              s.id === taskSecId.replace('sec_limp_', 'sec_limpieza_') || 
              (taskSecId.startsWith('sec_limp_') && s.id === taskSecId.replace('sec_limp_', 'sec_limpieza_')) ||
              (s.id.startsWith('sec_limp_') && taskSecId === s.id.replace('sec_limp_', 'sec_limpieza_'))
            );
            if (aliasedSec) {
              const purePeriodicity = getPureCyclicPeriodicity(aliasedSec.name);
              groupKey = purePeriodicity ? `cycle_cycle_${purePeriodicity}` : `section_${aliasedSec.id}`;
            }
          }

          if (!groupKey) {
            groupKey = 'no_section';
          }

          if (!grouped[groupKey]) grouped[groupKey] = [];
          grouped[groupKey].push(task);
        }
        
        // Clean empty no_section to keep UI clean
        if (grouped['no_section'].length === 0) {
          delete grouped['no_section'];
        }
        
        return grouped;
      },

      getSmartSortTasks: (temporarilyShowIds = []) => smartSortTasks(get().tasks, get().cycles, temporarilyShowIds),

      exportData: () => {
        const { tasks, cycles, lists, listSections, smartListVisibility } = get();
        const data = { tasks, cycles, lists, listSections, smartListVisibility, version: 3, exportedAt: new Date().toISOString() };
        return JSON.stringify(data, null, 2);
      },

      importData: (jsonData: string) => {
        try {
          const parsed = JSON.parse(jsonData);
          if (parsed.tasks && parsed.cycles) {
            set({ 
              tasks: parsed.tasks, 
              cycles: parsed.cycles,
              lists: parsed.lists || INITIAL_LISTS,
              listSections: parsed.listSections || [],
              smartListVisibility: parsed.smartListVisibility || get().smartListVisibility
            });
          }
        } catch (e) {
          console.error("Failed to import data", e);
        }
      },

      parsePlainTextTasks: (text: string) => {
        const { cycles, addCycle } = get();
        const lines = text.split('\n');
        
        const newTasks: TaskItem[] = [];
        
        lines.forEach(line => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('//')) return;
          
          let title = trimmed;
          let categoryId = 'inbox';
          let cycle_id: string | undefined = undefined;

          // Extract category: @Categoria
          const catMatch = title.match(/@(\w+)/);
          if (catMatch) {
            categoryId = (catMatch[1] || '').toLowerCase();
            title = title.replace(`@${catMatch[1]}`, '').trim();
          }

          // Extract cycle: #Semana o #Quincena
          const cycleMatch = title.match(/#(\w+)/);
          if (cycleMatch) {
            const rawCycle = cycleMatch[1];
            title = title.replace(`#${rawCycle}`, '').trim();
            
            // Buscar si ya existe el ciclo por nombre (case insensitive)
            const existing = cycles.find((c: any) => (c.name || '').toLowerCase() === (rawCycle || '').toLowerCase());
            if (existing) {
              cycle_id = existing.id;
            } else {
              // Auto-crear ciclo inferido (heurística simple, asignamos 14 días por defecto si no es conocido)
              const newCycleId = `cycle_${Date.now()}_${Math.random()}`;
              addCycle({
                id: newCycleId,
                name: rawCycle,
                daysValue: 14, // Heurística genérica
                isPinned: true,
                icon: 'sparkles'
              });
              cycle_id = newCycleId;
            }
          }

          if (title) {
            newTasks.push(TaskRepository.create({
              title,
              type: 'task', // Auto-imported from quick add is a task
              categoryId,
              cycle_id,
              blockedBy: [],
              dueDate: new Date().toISOString(),
              alerts: []
            }));
          }
        });
        
        // Update all tasks at once
        if (newTasks.length > 0) {
          optimisticUpdate(get, set, (state) => {
            const updatedTasks = { ...state.tasks };
            newTasks.forEach(t => { updatedTasks[t.id] = t; });
            return { tasks: updatedTasks };
          });
        }
      },

      addDependency: (targetTaskId: string, blockedByTaskId: string) => optimisticUpdate(get, set, (state) => {
        if (targetTaskId === blockedByTaskId) return state; // No auto-bloqueo
        
        const targetTask = state.tasks[targetTaskId];
        if (!targetTask) return state;
        
        // Validación de Deadlock (ciclos de dependencia)
        if (wouldCreateDependencyCycle(targetTaskId, blockedByTaskId, state.tasks)) {
          window.dispatchEvent(new CustomEvent('show-toast', { detail: 'No se puede: esa dependencia crearía un ciclo.' }));
          return state;
        }
        
        const currentBlockedBy = targetTask.blockedBy || [];
        if (!currentBlockedBy.includes(blockedByTaskId)) {
          return {
            tasks: {
              ...state.tasks,
              [targetTaskId]: {
                ...targetTask,
                blockedBy: [...currentBlockedBy, blockedByTaskId],
                _is_dirty: true,
                updated_at: new Date().toISOString()
              }
            }
          };
        }
        return state;
      }),

      removeDependency: (targetTaskId: string, blockedByTaskId: string) => optimisticUpdate(get, set, (state) => {
        const targetTask = state.tasks[targetTaskId];
        if (!targetTask) return state;
        
        return {
          tasks: {
            ...state.tasks,
            [targetTaskId]: {
              ...targetTask,
              blockedBy: (targetTask.blockedBy || []).filter(id => id !== blockedByTaskId),
              _is_dirty: true,
              updated_at: new Date().toISOString()
            }
          }
        };
      }),

      nestTask: (taskId: string, parentId: string | undefined) => optimisticUpdate(get, set, (state) => {
        if (!taskId || taskId === parentId) return state; // Evitar auto-anidación circular básica
        
        const task = state.tasks[taskId];
        if (!task) return state;

        const updatedTasks = { ...state.tasks };

        if (!parentId) {
          // Des-anidar (anular sangrado): mantener la posición visual justo después de su tarea padre
          const oldParentId = task.parentId;
          const oldParent = oldParentId ? state.tasks[oldParentId] : undefined;

          // Scope de tareas al mismo nivel (raíz en la misma lista y sección)
          const siblingRoots = Object.values(state.tasks)
            .filter(t => !t.deleted_at && !t.parentId && t.id !== taskId && t.categoryId === task.categoryId && (t.sectionId || undefined) === (task.sectionId || undefined))
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

          let insertIdx = siblingRoots.length;
          if (oldParent) {
            const pIdx = siblingRoots.findIndex(t => t.id === oldParent.id);
            if (pIdx !== -1) {
              insertIdx = pIdx + 1;
            }
          }

          const reordered = [...siblingRoots];
          reordered.splice(insertIdx, 0, { ...task, parentId: undefined });
          reordered.forEach((t, idx) => {
            const original = state.tasks[t.id];
            if (original) {
              updatedTasks[t.id] = TaskRepository.update(original, {
                parentId: undefined,
                order: idx
              });
            }
          });
        } else {
          // Anidar dentro de parentId
          const parent = state.tasks[parentId];
          if (!parent || parent.deleted_at) return state;

          // Si parentId ya es subtarea de otra tarea, anidar bajo el padre raíz (máximo 1 nivel de sangría estilo Apple)
          const effectiveParentId = parent.parentId ? parent.parentId : parentId;
          if (effectiveParentId === taskId) return state;

          // Verificar que taskId no sea ancestro de parentId (evitar ciclos)
          let ancestorCheck: TaskItem | undefined = parent;
          const visitedAncestors = new Set<string>();
          while (ancestorCheck) {
            if (ancestorCheck.id === taskId) return state;
            if (!ancestorCheck.parentId || visitedAncestors.has(ancestorCheck.parentId)) break;
            visitedAncestors.add(ancestorCheck.parentId);
            ancestorCheck = state.tasks[ancestorCheck.parentId];
          }

          const effectiveParent = state.tasks[effectiveParentId] || parent;

          const existingChildren = Object.values(state.tasks)
            .filter(t => !t.deleted_at && t.parentId === effectiveParentId && t.id !== taskId);
          const maxChildOrder = existingChildren.reduce((max, c) => Math.max(max, c.order ?? 0), -1);

          updatedTasks[taskId] = TaskRepository.update(task, {
            parentId: effectiveParentId,
            categoryId: effectiveParent.categoryId || task.categoryId,
            sectionId: effectiveParent.sectionId,
            order: maxChildOrder + 1
          });

          // Si la tarea tenía ya subtareas, aplanarlas para que sean hermanas bajo effectiveParentId
          Object.values(state.tasks).forEach(c => {
            if (!c.deleted_at && c.parentId === taskId) {
              updatedTasks[c.id] = TaskRepository.update(c, {
                parentId: effectiveParentId,
                categoryId: effectiveParent.categoryId || task.categoryId,
                sectionId: effectiveParent.sectionId
              });
            }
          });
        }

        return { tasks: sanitizeTaskHierarchy(updatedTasks, changedTaskIds(state.tasks, updatedTasks)) };
      }),

      cleanupDataHygiene: () => optimisticUpdate(get, set, (state) => {
        const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
        const cleanedTasks: Record<string, TaskItem> = {};
        let changed = false;

        Object.entries(state.tasks).forEach(([id, t]) => {
          // Papelera: se vacía definitivamente tras 30 días (como Recordatorios de Apple).
          if (t.deleted_at) {
            const delTimestamp = new Date(t.deleted_at).getTime();
            if (!isNaN(delTimestamp) && Date.now() - delTimestamp > RETENTION_MS && !t._is_dirty) {
              changed = true;
              return;
            }
            cleanedTasks[id] = t;
            return;
          }

          // Las vencidas conservan su fecha (antes se borraba al abrir la app y se sincronizaba:
          // se perdía el dato y «Vencidos» nunca mostraba nada).
          cleanedTasks[id] = t;
        });

        return changed ? { tasks: cleanedTasks } : state;
      })
    }),
    {
      name: 'reminders-storage',
      storage: createJSONStorage(() => idbStorage),
      version: 9,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => {
        const rest = { ...state };
        delete (rest as Partial<AppState>).hasHydrated;
        return rest;
      },
      merge: (persistedState: any, currentState: any) => {
        const rawLists = persistedState?.lists || currentState.lists || [];
        const cleanLists = rawLists.filter((l: any) => !l.id?.startsWith('user_preferences_'));
        const uniqueLists: any[] = Array.from(new Map(cleanLists.map((l: any) => [l.id, l])).values());
        const rawCycles = persistedState?.cycles || currentState.cycles || [];
        const canonicalCoreMap = new Map<string, any>();
        INITIAL_CYCLES.forEach(c => canonicalCoreMap.set(c.id, { ...c }));

        const remappedCycleIds: Record<string, string> = {};
        const validCustomCycles: any[] = [];

        rawCycles.forEach((c: any) => {
          if (!c || !c.id || c.deleted_at) return;
          const norm = (c.name || '').trim().toLowerCase();
          const days = Number(c.daysValue);

          if (c.id === 'cycle_day' || norm === 'diario' || norm === 'diaria' || days === 1) {
            if (c.id !== 'cycle_day') remappedCycleIds[c.id] = 'cycle_day';
            canonicalCoreMap.set('cycle_day', { ...canonicalCoreMap.get('cycle_day'), isPinned: c.isPinned ?? true });
            return;
          }
          if (c.id === 'cycle_week' || norm === 'semanal' || days === 7) {
            if (c.id !== 'cycle_week') remappedCycleIds[c.id] = 'cycle_week';
            canonicalCoreMap.set('cycle_week', { ...canonicalCoreMap.get('cycle_week'), isPinned: c.isPinned ?? true });
            return;
          }
          if (c.id === 'cycle_month' || norm === 'mensual' || days === 30) {
            if (c.id !== 'cycle_month') remappedCycleIds[c.id] = 'cycle_month';
            canonicalCoreMap.set('cycle_month', { ...canonicalCoreMap.get('cycle_month'), isPinned: c.isPinned ?? true });
            return;
          }
          if (c.id === 'cycle_year' || norm === 'anual' || days === 365) {
            if (c.id !== 'cycle_year') remappedCycleIds[c.id] = 'cycle_year';
            canonicalCoreMap.set('cycle_year', { ...canonicalCoreMap.get('cycle_year'), isPinned: c.isPinned ?? true });
            return;
          }

          // Genuine custom cycle
          const already = validCustomCycles.some(v => v.id === c.id || (v.name || '').trim().toLowerCase() === norm);
          if (!already) {
            validCustomCycles.push({ ...c, isPinned: c.isPinned ?? true });
          }
        });

        const uniqueCycles: any[] = [
          canonicalCoreMap.get('cycle_day'),
          canonicalCoreMap.get('cycle_week'),
          canonicalCoreMap.get('cycle_month'),
          canonicalCoreMap.get('cycle_year'),
          ...validCustomCycles
        ];
        const rawSections = persistedState?.listSections || currentState.listSections || [];
        const uniqueSections: any[] = Array.from(
          new Map(
            rawSections
              .filter((s: any) => s && s.id)
              .map((s: any) => [
                s.id,
                {
                  ...s,
                  name: (typeof s.name === 'string' && s.name.trim()) ? s.name.trim() : 'Nueva sección'
                }
              ])
          ).values()
        );

        const mergedCycleVisibility = {
          cycle_day: true,
          cycle_week: true,
          cycle_month: true,
          cycle_year: true,
          ...currentState.cycleVisibility,
          ...(persistedState?.cycleVisibility || {})
        };
        mergedCycleVisibility.cycle_day = mergedCycleVisibility.cycle_day !== false;
        mergedCycleVisibility.cycle_week = mergedCycleVisibility.cycle_week !== false;
        mergedCycleVisibility.cycle_month = mergedCycleVisibility.cycle_month !== false;
        mergedCycleVisibility.cycle_year = mergedCycleVisibility.cycle_year !== false;

        const mergedSmartListVisibility = {
          ...currentState.smartListVisibility,
          ...(persistedState?.smartListVisibility || {})
        };

        const mergedPinnedSmartLists = persistedState?.pinnedSmartLists || currentState.pinnedSmartLists || [];

        // Si el usuario nunca ha elegido tema a mano, seguimos la preferencia del sistema operativo
        // (como hace cualquier app de Apple) en lugar de forzar claro siempre.
        const userExplicitTheme = typeof localStorage !== 'undefined' ? localStorage.getItem('user_explicit_theme') : null;
        const systemPrefersDark = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
          : false;
        const resolvedTheme = userExplicitTheme === 'dark' ? 'dark' : userExplicitTheme === 'light' ? 'light' : (systemPrefersDark ? 'dark' : 'light');

        // Cargar tareas locales/persistidas sin auto-eliminación
        const cleanTasks: Record<string, TaskItem> = {
          ...((persistedState?.tasks || currentState.tasks || {}) as Record<string, TaskItem>)
        };

        if (Object.keys(remappedCycleIds).length > 0) {
          for (const [tId, t] of Object.entries(cleanTasks)) {
            if (t && t.cycle_id && remappedCycleIds[t.cycle_id]) {
              cleanTasks[tId] = {
                ...t,
                cycle_id: remappedCycleIds[t.cycle_id],
                _is_dirty: true
              };
            }
          }
        }

        return {
          ...currentState,
          ...persistedState,
          tasks: sanitizeTaskHierarchy(cleanTasks),
          globalCyclesEnabled: true,
          _preferences_dirty: false,
          theme: resolvedTheme,
          lists: uniqueLists,
          cycles: uniqueCycles,
          listSections: sanitizeSectionHierarchy(uniqueSections),
          smartListVisibility: mergedSmartListVisibility,
          cycleVisibility: mergedCycleVisibility,
          pinnedSmartLists: mergedPinnedSmartLists
        };
      },
      migrate: (persistedState: any, version: number) => {
        let state = persistedState;
        
        if (version === 0 || version === 1) {
          // Migración v1 -> v2: Transform frequencies to cycles
          const newTasks: Record<string, TaskItem> = {};
          if (state.tasks) {
            Object.entries(state.tasks).forEach(([id, t]: [string, any]) => {
              let cycle_id = 'cycle_day';
              if (t.frequencyLevel === 'weekly') cycle_id = 'cycle_week';
              if (t.frequencyLevel === 'monthly') cycle_id = 'cycle_month';
              if (t.frequencyLevel === 'yearly') cycle_id = 'cycle_year';
              
              const migratedTask: any = {
                ...t,
                cycle_id,
                blockedBy: t.blockedBy || []
              };
              delete migratedTask.frequencyLevel;
              newTasks[id] = migratedTask;
            });
          }
          state = { ...state, tasks: newTasks, cycles: INITIAL_CYCLES, lists: INITIAL_LISTS };
        }

        if (version < 3) {
          // Migración v2 -> v3: Emoji to Icon
          const migratedCycles = (state.cycles || INITIAL_CYCLES).map((c: any) => {
            const iconMap: Record<string, string> = {
              '🌅': 'sun', '📅': 'calendar', '🌙': 'moon', '🌍': 'globe',
              '🚀': 'rocket', '🔥': 'flame', '✨': 'sparkles', '🌟': 'star'
            };
            return {
              ...c,
              icon: c.icon || iconMap[c.emoji] || 'circle'
            };
          });
          state = { ...state, cycles: migratedCycles, lists: state.lists || INITIAL_LISTS };
        }

        if (version < 4) {
          // Migración v3 -> v4: Forzar sync de datos heredados marcándolos como dirty
          const dirtyTasks: Record<string, TaskItem> = {};
          if (state.tasks) {
            Object.entries(state.tasks).forEach(([id, t]: [string, any]) => {
              dirtyTasks[id] = { ...t, _is_dirty: true, version: t.version || 1 };
            });
          }
          const dirtyCycles = (state.cycles || []).map((c: any) => ({ ...c, _is_dirty: true, version: c.version || 1 }));
          const dirtyLists = (state.lists || []).map((l: any) => ({ ...l, _is_dirty: true, version: l.version || 1 }));
          state = { ...state, tasks: dirtyTasks, cycles: dirtyCycles, lists: dirtyLists };
        }
        
        if (version < 5) {
          const fixedTasks: Record<string, TaskItem> = {};
          if (state.tasks) {
            Object.entries(state.tasks).forEach(([id, t]: [string, any]) => {
              const isDefaultCycle = t.cycle_id === 'cycle_day';
              const hasRecurringHistory = t.completionHistory && t.completionHistory.length > 0;
              if (isDefaultCycle && !hasRecurringHistory) {
                fixedTasks[id] = { ...t, cycle_id: undefined, _is_dirty: true };
              } else {
                fixedTasks[id] = t;
              }
            });
          }
          state = { ...state, tasks: fixedTasks };
        }

        if (version < 6) {
          // Migration v5 -> v6: Correctly clean tasks with buggy default cycle_id.
          // In order to push the update to the server and make it stick, we MUST
          // increment the task version, set updatedAt to now, and flag as dirty.
          const fixedTasks: Record<string, TaskItem> = {};
          const nowStr = new Date().toISOString();
          if (state.tasks) {
            Object.entries(state.tasks).forEach(([id, t]: [string, any]) => {
              const isDefaultCycle = t.cycle_id === 'cycle_day';
              const hasRecurringHistory = t.completionHistory && t.completionHistory.length > 0;
              if (isDefaultCycle && !hasRecurringHistory) {
                fixedTasks[id] = { 
                  ...t,
                  cycle_id: undefined, 
                  version: (t.version || 1) + 1,
                  updated_at: nowStr,
                  _is_dirty: true 
                };
              } else {
                fixedTasks[id] = t;
              }
            });
          }
          state = { ...state, tasks: fixedTasks };
        }

        if (version < 7) {
          const now = new Date();
          now.setHours(0, 0, 0, 0);
          const todayTimestamp = now.getTime();
          
          const validListIds = new Set((state.lists || []).map((l: any) => l.id));
          const cleanedTasks: Record<string, TaskItem> = {};
          
          if (state.tasks) {
            Object.entries(state.tasks).forEach(([id, t]: [string, any]) => {
              const listId = t.categoryId || t.category_id || t.listId;
              if (!listId || listId === 'inbox' || listId === 'user_preferences_smart_lists' || (!validListIds.has(listId) && !String(listId).startsWith('cycle_'))) {
                return;
              }
              
              let updatedTask = { ...t };
              const isCompleted = isTaskCompleted(updatedTask) || updatedTask.completed;
              if (updatedTask.dueDate && !isCompleted && !updatedTask.deleted_at) {
                const dueDateTimestamp = new Date(updatedTask.dueDate).getTime();
                if (!isNaN(dueDateTimestamp) && dueDateTimestamp < todayTimestamp) {
                  delete updatedTask.dueDate;
                  updatedTask._is_dirty = true;
                  updatedTask.updated_at = new Date().toISOString();
                }
              }
              cleanedTasks[id] = updatedTask;
            });
          }
          state = { ...state, tasks: cleanedTasks };
        }
        
        if (version < 8) {
          const taggedTasks: Record<string, TaskItem> = {};
          const nowStr = new Date().toISOString();
          if (state.tasks) {
            Object.entries(state.tasks).forEach(([id, t]: [string, any]) => {
              let changed = false;
              let newCycleId = t.cycle_id;
              
              if (t.title.includes('[D]')) {
                newCycleId = 'cycle_day';
                changed = true;
              } else if (t.title.includes('[S]')) {
                newCycleId = 'cycle_week';
                changed = true;
              } else if (t.title.includes('[M]')) {
                newCycleId = 'cycle_month';
                changed = true;
              } else if (t.title.includes('[A]')) {
                newCycleId = 'cycle_year';
                changed = true;
              }

              if (changed && newCycleId !== t.cycle_id) {
                taggedTasks[id] = {
                  ...t,
                  cycle_id: newCycleId,
                  version: (t.version || 1) + 1,
                  updated_at: nowStr,
                  _is_dirty: true
                };
              } else {
                taggedTasks[id] = t;
              }
            });
          }
          state = { ...state, tasks: taggedTasks };
        }

        if (version < 9) {
          // v8 -> v9: el servidor ahora aísla los datos por usuario. Re-subimos todo una vez
          // para reconstruir en la nube cualquier registro que otra cuenta hubiera "pisado".
          // Es seguro: el servidor aplica Last-Write-Wins y descarta lo que sea más antiguo.
          const isSettings = (l: any) => typeof l?.id === 'string' && l.id.startsWith('user_preferences_');
          const markDirty = (x: any) => ({ ...x, _is_dirty: true });
          const dirtyTasks: Record<string, TaskItem> = {};
          Object.entries(state.tasks || {}).forEach(([id, t]: [string, any]) => {
            dirtyTasks[id] = markDirty(t);
          });
          state = {
            ...state,
            tasks: dirtyTasks,
            lists: (state.lists || []).filter((l: any) => !isSettings(l)).map(markDirty),
            cycles: (state.cycles || []).map(markDirty),
            listSections: (state.listSections || []).map(markDirty),
            tombstones: { lists: [], cycles: [], tasks: [] },
          };
        }

        return state as AppState;
      },
    }
  )
);

if (typeof window !== 'undefined') {
  (window as any).useAppStore = useAppStore;
}
