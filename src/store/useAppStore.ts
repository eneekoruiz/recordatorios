import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from '../utils/idbStorage';
import type { TaskItem, CustomCycle, CustomList, ListSection } from '../models/Task';
import { TaskRepository } from '../repositories/TaskRepository';
import { isCompletedInCurrentPeriod, wouldCreateDependencyCycle } from '../services/TaskService';

export const isTaskCompleted = (t: any) => {
  // Only treat as completed if status is explicitly 'completed' or has a completed_at timestamp.
  // We do NOT use completionHistory here because recurring tasks accumulate history but reset to 'pending'.
  return t.status === 'completed' || !!t.completed_at;
};

const INITIAL_LISTS: CustomList[] = [
  { id: 'compras', name: 'Compras', color: '#ff9500' },
  { id: 'care', name: 'Care', color: '#af52de' },
  { id: 'quehaceres', name: 'Quehaceres', color: '#34c759' },
  { id: 'limpieza', name: 'Limpieza', color: '#0a84ff' }
];

const INITIAL_CYCLES: CustomCycle[] = [
  { id: 'cycle_day', name: 'Diario', daysValue: 1, isPinned: true, icon: 'sun' },
  { id: 'cycle_week', name: 'Semanal', daysValue: 7, isPinned: true, icon: 'calendar' },
  { id: 'cycle_month', name: 'Mensual', daysValue: 30, isPinned: true, icon: 'moon' },
  { id: 'cycle_year', name: 'Anual', daysValue: 365, isPinned: true, icon: 'globe' },
];

interface AppState {
  tasks: Record<string, TaskItem>;
  cycles: CustomCycle[];
  lists: CustomList[];
  listSections: ListSection[];
  smartListVisibility: Record<string, boolean>;
  cycleVisibility: Record<string, boolean>;
  
  toggleSmartList: (listId: string) => void;
  toggleCycleVisibility: (cycleId: string) => void;
  
  addTask: (task: Partial<TaskItem>) => void;
  updateTaskRaw: (task: TaskItem) => void; // Para uso interno y SyncProvider
  toggleTask: (id: string, forceReverse?: boolean) => void;
  deleteTask: (id: string) => void;
  updateTask: (id: string, updates: Partial<TaskItem>) => void;
  
  addCycle: (cycle: CustomCycle) => void;
  updateCycle: (id: string, updates: Partial<CustomCycle>) => void;
  deleteCycle: (id: string) => void;

  addList: (list: CustomList) => void;
  updateList: (id: string, data: Partial<CustomList>) => void;
  deleteList: (id: string) => void;
  removeList: (id: string) => void;

  addListSection: (section: ListSection) => void;
  updateListSection: (id: string, name: string) => void;
  deleteListSection: (id: string) => void;
  updateTaskSection: (taskId: string, sectionId: string | undefined) => void;

  purgeOldDeletedTasks: () => void;

  getTasksByCycle: (cycle_id: string, includeCompleted?: boolean, temporarilyShowIds?: string[]) => Record<string, TaskItem[]>;
  getTasksByList: (listId: string, includeCompleted?: boolean, temporarilyShowIds?: string[]) => Record<string, TaskItem[]>;
  getSmartSortTasks: () => TaskItem[]; 

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
  logout: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      tasks: {},
      cycles: INITIAL_CYCLES,
      lists: INITIAL_LISTS,
      listSections: [],
      token: null,
      userId: null,
      smartListVisibility: {
        smart_today: true,
        smart_scheduled: true,
        smart_all: true,
        smart_flagged: true,
        smart_completed: false
      },
      cycleVisibility: {},  // All hidden by default; auto-activates when a task with that cycle_id is created

      setToken: (token, userId) => set({ token, userId }),
      hasHydrated: false,
      setHasHydrated: (val) => set({ hasHydrated: val }),

      toggleSmartList: (listId) => set((state) => {
        const newVisibility = {
          ...state.smartListVisibility,
          [listId]: !state.smartListVisibility[listId]
        };
        
        // Save to lists as a settings record so it syncs
        const settingsId = 'user_preferences_smart_lists';
        const existingSettings = state.lists.find(l => l.id === settingsId);
        const updatedList: any = {
          id: settingsId,
          name: 'Settings',
          color: '#000000',
          icon: JSON.stringify(newVisibility),
          _is_dirty: true,
          updated_at: new Date().toISOString()
        };
        
        const newLists = existingSettings
          ? state.lists.map(l => l.id === settingsId ? updatedList : l)
          : [...state.lists, updatedList];

        return {
          smartListVisibility: newVisibility,
          lists: newLists
        };
      }),

      toggleCycleVisibility: (cycleId) => set((state) => ({
        cycleVisibility: {
          ...state.cycleVisibility,
          [cycleId]: !state.cycleVisibility[cycleId]
        }
      })),

      addTask: (payload) => set((state) => {
        const newTask = TaskRepository.create(payload);
        // Auto-activate the cycle view when a task with a cycle_id is first created
        let newCycleVisibility = state.cycleVisibility;
        if (newTask.cycle_id && !state.cycleVisibility[newTask.cycle_id]) {
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

      updateTaskRaw: (task) => set((state) => ({
        tasks: {
          ...state.tasks,
          [task.id]: task
        }
      })),

      toggleTask: (id, forceReverse?: boolean) => set((state) => {
        const existingTask = state.tasks[id];
        if (!existingTask) return state;
        
        let updatedTask: TaskItem;
        const alerts = existingTask.alerts || [];
        const completedAlerts = existingTask.completedAlerts || [];
        const isOneOff = !existingTask.cycle_id;
        
        // Auto-detect reverse if already completed or if forceReverse is explicitly passed
        const shouldReverse = forceReverse || isTaskCompleted(existingTask);
        
        if (shouldReverse) {
          const newHistory = [...(existingTask.completionHistory || [])];
          
          if (completedAlerts.length > 0 && !existingTask.status?.includes('completed')) {
            // Uncheck last partial alert if not fully completed
            updatedTask = TaskRepository.update(existingTask, {
              completedAlerts: completedAlerts.slice(0, -1),
              status: 'pending'
            });
          } else if (newHistory.length > 0) {
            // Uncheck full completion
            newHistory.pop();
            const restoredAlerts = alerts.length > 1 ? alerts.slice(0, -1).map(a => a.id).filter(Boolean) as string[] : [];
            updatedTask = TaskRepository.update(existingTask, {
              status: 'pending',
              completedAlerts: restoredAlerts,
              completionHistory: newHistory
            });
          } else {
            updatedTask = TaskRepository.update(existingTask, { status: 'pending', completedAlerts: [] });
          }
        } else {
          // Normal complete forward logic
          if (alerts.length > 1 && completedAlerts.length < alerts.length - 1) {
            const nextAlert = alerts[completedAlerts.length] || alerts[alerts.length - 1];
            updatedTask = TaskRepository.update(existingTask, { 
              completedAlerts: [...completedAlerts, nextAlert.id] 
            });
          } else {
            const newCompletionHistory = [...(existingTask.completionHistory || []), Date.now()];
            if (!isOneOff) {
              updatedTask = TaskRepository.update(existingTask, { 
                completedAlerts: [], 
                completionHistory: newCompletionHistory,
                status: 'pending'
              });
            } else {
              updatedTask = TaskRepository.update(existingTask, { 
                status: 'completed',
                completedAlerts: [...completedAlerts, alerts[completedAlerts.length]?.id].filter(Boolean) as string[],
                completionHistory: newCompletionHistory
              });
            }
          }
        }

        return {
          tasks: {
            ...state.tasks,
            [id]: updatedTask
          }
        };
      }),

      deleteTask: (id) => set((state) => {
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

      updateTask: (id, updates) => set((state) => {
        const task = state.tasks[id];
        if (!task) return state;
        const updated = TaskRepository.update(task, updates);
        return {
          tasks: {
            ...state.tasks,
            [id]: updated
          }
        };
      }),

      addCycle: (cycle) => set((state) => ({
        cycles: [...state.cycles, { 
          ...cycle, 
          _is_dirty: cycle._is_dirty ?? true, 
          updated_at: cycle.updated_at || new Date().toISOString() 
        }].sort((a, b) => a.daysValue - b.daysValue)
      })),

      updateCycle: (id, updates) => set((state) => ({
        cycles: state.cycles.map(c => c.id === id ? { 
          ...c, 
          ...updates, 
          _is_dirty: updates._is_dirty ?? true, 
          updated_at: new Date().toISOString() 
        } : c).sort((a, b) => a.daysValue - b.daysValue)
      })),

      deleteCycle: (id) => set((state) => ({
        cycles: state.cycles.filter(c => c.id !== id)
      })),

      addList: (list) => set((state) => ({
        lists: [...state.lists, { 
          ...list, 
          _is_dirty: list._is_dirty ?? true, 
          updated_at: list.updated_at || new Date().toISOString() 
        }]
      })),

      updateList: (id, data) => set((state) => ({
        lists: state.lists.map(l => l.id === id ? { 
          ...l, 
          ...data, 
          _is_dirty: data._is_dirty ?? true, 
          updated_at: new Date().toISOString() 
        } : l)
      })),

      removeList: (id) => set((state) => ({
        lists: state.lists.filter(l => l.id !== id && l.parentId !== id) // Remove list and its sublists
      })),

      addListSection: (section) => set((state) => ({
        listSections: [...(state.listSections || []), section]
      })),

      updateListSection: (id, name) => set((state) => ({
        listSections: (state.listSections || []).map(s => s.id === id ? { ...s, name } : s)
      })),

      deleteListSection: (id) => set((state) => {
        // Al borrar una sección, las tareas de esa sección quedan sin ella
        const updatedTasks = { ...state.tasks };
        let changed = false;
        for (const taskId in updatedTasks) {
          if (updatedTasks[taskId].sectionId === id) {
            updatedTasks[taskId] = { ...updatedTasks[taskId], sectionId: undefined, _is_dirty: true, updated_at: new Date().toISOString() };
            changed = true;
          }
        }
        return {
          listSections: (state.listSections || []).filter(s => s.id !== id),
          tasks: changed ? updatedTasks : state.tasks
        };
      }),

      updateTaskSection: (taskId, sectionId) => set((state) => {
        const task = state.tasks[taskId];
        if (!task) return state;
        return {
          tasks: {
            ...state.tasks,
            [taskId]: TaskRepository.update(task, { sectionId })
          }
        };
      }),

      purgeOldDeletedTasks: () => set((state) => {
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
        const { tasks, cycles } = get();
        const targetCycle = cycles.find(c => c.id === cycleId);
        if (!targetCycle) return {};

        const validCycles = cycles.filter(c => c.daysValue <= targetCycle.daysValue).map(c => c.id);

        // Only show tasks with an explicit cycle_id — no date-based fallback for inbox tasks
        const grouped: Record<string, TaskItem[]> = {};
        Object.values(tasks)
          .filter(t => !t.deleted_at && (includeCompleted || !isTaskCompleted(t) || temporarilyShowIds.includes(t.id)))
          .filter(t => {
            if (!t.cycle_id) return false; // Tasks without a cycle never appear in cycle views
            return validCycles.includes(t.cycle_id as string);
          })
          .filter(t => includeCompleted || temporarilyShowIds.includes(t.id) || !isCompletedInCurrentPeriod(t, cycles))
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .forEach(t => {
            const listId = t.categoryId || (t as any).category_id || 'inbox';
            if (!grouped[listId]) grouped[listId] = [];
            grouped[listId].push(t);
          });
        return grouped;
      },

      getTasksByList: (listId, includeCompleted = false, temporarilyShowIds = []) => {
        const { tasks, lists } = get();
        const validListIds = new Set(lists.map(l => l.id));
        const filtered = Object.values(tasks).filter(t => {
          if (t.deleted_at) return false;
          const taskCat = t.categoryId || (t as any).category_id;
          // If the task claims to be in a list that doesn't exist, treat it as inbox
          const effectiveCat = (taskCat && taskCat !== 'inbox' && !validListIds.has(taskCat)) 
            ? undefined 
            : taskCat;
          const matchesList = listId === 'inbox' 
            ? (effectiveCat === 'inbox' || !effectiveCat)
            : effectiveCat === listId;
          return matchesList && (includeCompleted || !isTaskCompleted(t) || temporarilyShowIds.includes(t.id));
        });
        
        const grouped: Record<string, TaskItem[]> = {};
        for (const task of filtered) {
          let groupKey = '';
          if (task.sectionId) {
            groupKey = `section_${task.sectionId}`;
          } else {
            groupKey = 'no_section';
          }

          if (!grouped[groupKey]) grouped[groupKey] = [];
          grouped[groupKey].push(task);
        }
        return grouped;
      },

      getSmartSortTasks: () => {
        const { tasks, cycles } = get();
        const tasksArray = Object.values(tasks).filter(t => t.status === 'pending' && !t.deleted_at);
        const now = new Date();
        const currentHours = now.getHours();

        const scoredTasks = tasksArray.map(task => {
          let score = 0;
          if (task.alerts.length > 0) {
            let closestDiff = 999;
            task.alerts.forEach(alert => {
              if (alert.type === 'at_time' && alert.time) {
                const [h] = alert.time.split(':');
                const alertHour = parseInt(h, 10);
                const diff = alertHour - currentHours;
                if (diff >= 0 && diff < closestDiff) closestDiff = diff;
              }
            });
            if (closestDiff <= 2) score += 50; 
            else if (closestDiff <= 5) score += 20;
          }
          
          // SmartSort: Tareas Diarias por la tarde
          const taskCycle = cycles.find(c => c.id === task.cycle_id);
          if (taskCycle && taskCycle.daysValue === 1 && currentHours > 18) {
            score += 30;
          }
          return { ...task, _score: score };
        });

        return scoredTasks.sort((a, b) => {
          if (b._score !== a._score) return b._score - a._score;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
      },

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
          let cycle_id = 'cycle_day';

          // Extract category: @Categoria
          const catMatch = title.match(/@(\w+)/);
          if (catMatch) {
            categoryId = catMatch[1].toLowerCase();
            title = title.replace(`@${catMatch[1]}`, '').trim();
          }

          // Extract cycle: #Semana o #Quincena
          const cycleMatch = title.match(/#(\w+)/);
          if (cycleMatch) {
            const rawCycle = cycleMatch[1];
            title = title.replace(`#${rawCycle}`, '').trim();
            
            // Buscar si ya existe el ciclo por nombre (case insensitive)
            const existing = cycles.find(c => c.name.toLowerCase() === rawCycle.toLowerCase());
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
          set((state) => {
            const updatedTasks = { ...state.tasks };
            newTasks.forEach(t => { updatedTasks[t.id] = t; });
            return { tasks: updatedTasks };
          });
        }
      },

      addDependency: (targetTaskId: string, blockedByTaskId: string) => set((state) => {
        if (targetTaskId === blockedByTaskId) return state; // No auto-bloqueo
        
        const targetTask = state.tasks[targetTaskId];
        if (!targetTask) return state;
        
        // Validación de Deadlock (ciclos de dependencia)
        if (wouldCreateDependencyCycle(targetTaskId, blockedByTaskId, state.tasks)) {
          alert('Error: Añadir esta dependencia crearía un ciclo infinito.');
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

      removeDependency: (targetTaskId: string, blockedByTaskId: string) => set((state) => {
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

      nestTask: (taskId: string, parentId: string | undefined) => set((state) => {
        if (taskId === parentId) return state; // Evitar auto-anidación circular básica
        
        const task = state.tasks[taskId];
        if (!task) return state;

        return {
          tasks: {
            ...state.tasks,
            [taskId]: {
              ...task,
              parentId: parentId,
              _is_dirty: true,
              updated_at: new Date().toISOString()
            }
          }
        };
      })
    }),
    {
      name: 'reminders-storage',
      storage: createJSONStorage(() => idbStorage),
      version: 4,
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => {
        const { hasHydrated, ...rest } = state;
        return rest;
      },
      merge: (persistedState: any, currentState: any) => ({
        ...currentState,
        ...persistedState,
        smartListVisibility: {
          ...currentState.smartListVisibility,
          ...(persistedState.smartListVisibility || {})
        },
        cycleVisibility: {
          ...currentState.cycleVisibility,
          ...(persistedState.cycleVisibility || {})
        }
      }),
      migrate: (persistedState: any, version: number) => {
        let state = persistedState;
        
        if (version === 0 || version === 1) {
          // Migración v1 -> v2: Transform frequencies to cycles
          const newTasks: Record<string, TaskItem> = {};
          if (state.tasks) {
            Object.entries(state.tasks).forEach(([id, t]: [string, any]) => {
              let cycle_id = 'cycle_day';
              if (t.frequencyLevel === 'weekly') cycleId = 'cycle_week';
              if (t.frequencyLevel === 'monthly') cycleId = 'cycle_month';
              if (t.frequencyLevel === 'yearly') cycleId = 'cycle_year';
              
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
        
        return state as AppState;
      },
    }
  )
);
