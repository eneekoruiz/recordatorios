import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { idbStorage } from '../utils/idbStorage';
import type { TaskItem, CustomCycle, CustomList, ListSection } from '../models/Task';
import { TaskRepository } from '../repositories/TaskRepository';
import { isCompletedInCurrentPeriod, wouldCreateDependencyCycle } from '../services/TaskService';

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
  
  toggleSmartList: (listId: string) => void;
  
  addTask: (task: Partial<TaskItem>) => void;
  updateTaskRaw: (task: TaskItem) => void; // Para uso interno y SyncProvider
  completeTask: (id: string) => void;
  deleteTask: (id: string) => void;
  
  addCycle: (cycle: CustomCycle) => void;
  updateCycle: (id: string, updates: Partial<CustomCycle>) => void;
  deleteCycle: (id: string) => void;

  addList: (list: CustomList) => void;
  updateList: (id: string, updates: Partial<CustomList>) => void;
  deleteList: (id: string) => void;
  removeList: (id: string) => void;

  addListSection: (section: ListSection) => void;
  updateListSection: (id: string, name: string) => void;
  deleteListSection: (id: string) => void;
  updateTaskSection: (taskId: string, sectionId: string | undefined) => void;

  purgeOldDeletedTasks: () => void;

  getTasksByCycle: (cycle_id: string, includeCompleted?: boolean) => Record<string, TaskItem[]>;
  getTasksByList: (listId: string, includeCompleted?: boolean) => Record<string, TaskItem[]>;
  getSmartSortTasks: () => TaskItem[]; 

  exportData: () => string;
  importData: (jsonData: string) => void;
  parsePlainTextTasks: (text: string) => void;
  addDependency: (targetTaskId: string, blockedByTaskId: string) => void;
  removeDependency: (targetTaskId: string, blockedByTaskId: string) => void;
  nestTask: (taskId: string, parentId: string | undefined) => void;

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

      setToken: (token, userId) => set({ token, userId }),
      logout: () => set({ token: null, userId: null, tasks: {}, lists: INITIAL_LISTS, cycles: INITIAL_CYCLES, listSections: [] }),

      toggleSmartList: (listId) => set((state) => ({
        smartListVisibility: {
          ...state.smartListVisibility,
          [listId]: !state.smartListVisibility[listId]
        }
      })),

      addTask: (payload) => set((state) => {
        const newTask = TaskRepository.create(payload);
        return { 
          tasks: { 
            ...state.tasks, 
            [newTask.id]: newTask 
          } 
        };
      }),

      updateTaskRaw: (task) => set((state) => ({
        tasks: {
          ...state.tasks,
          [task.id]: task
        }
      })),

      completeTask: (id) => set((state) => {
        const existingTask = state.tasks[id];
        if (!existingTask) return state;
        
        let updatedTask: TaskItem;
        const alerts = existingTask.alerts || [];
        const completedAlerts = existingTask.completedAlerts || [];

        // Lógica de tachado parcial (Multi-dosis)
        if (alerts.length > 1 && completedAlerts.length < alerts.length - 1) {
          // Aún quedan alertas por completar, añadimos la siguiente
          if (alerts.length > 0) {
            const nextAlert = alerts[completedAlerts.length] || alerts[alerts.length - 1];
            updatedTask = TaskRepository.update(existingTask, { 
              completedAlerts: [...completedAlerts, nextAlert.id] 
            });
          } else {
            updatedTask = TaskRepository.update(existingTask, { completedAlerts: [] });
          }
        } else {
          // Si es la última alerta, se completó la dosis de este ciclo.
          const newCompletionHistory = [...(existingTask.completionHistory || []), Date.now()];
          
          if (existingTask.cycle_id) {
            // Tarea Recurrente: Mantener PENDING, limpiar alertas parciales, añadir a historial
            updatedTask = TaskRepository.update(existingTask, { 
              completedAlerts: [], // Reset for next cycle
              completionHistory: newCompletionHistory
            });
          } else {
            // Tarea de un solo uso
            updatedTask = TaskRepository.update(existingTask, { 
              status: 'completed',
              completedAlerts: [...completedAlerts, alerts[completedAlerts.length]?.id].filter(Boolean) as string[],
              completionHistory: newCompletionHistory
            });
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

      addCycle: (cycle) => set((state) => ({
        cycles: [...state.cycles, cycle].sort((a, b) => a.daysValue - b.daysValue)
      })),

      updateCycle: (id, updates) => set((state) => ({
        cycles: state.cycles.map(c => c.id === id ? { ...c, ...updates } : c).sort((a, b) => a.daysValue - b.daysValue)
      })),

      deleteCycle: (id) => set((state) => ({
        cycles: state.cycles.filter(c => c.id !== id)
      })),

      addList: (list) => set((state) => ({
        lists: [...state.lists, list]
      })),

      updateList: (id, data) => set((state) => ({
        lists: state.lists.map(l => l.id === id ? { ...l, ...data } : l)
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
      getTasksByCycle: (cycleId, includeCompleted = false) => {
        const { tasks, cycles } = get();
        const targetCycle = cycles.find(c => c.id === cycleId);
        if (!targetCycle) return {};

        const validCycles = cycles.filter(c => c.daysValue <= targetCycle.daysValue).map(c => c.id);

        // Utilizamos la lógica centralizada de TaskService
        const grouped: Record<string, TaskItem[]> = {};
        Object.values(tasks)
          .filter(t => !t.deleted_at && (includeCompleted || t.status !== 'completed'))
          .filter(t => {
            // Regla: Hereda tareas de su propio ciclo Y de cualquier ciclo más corto.
            // NUEVO: Si no tiene ciclo (One-off), evaluamos por dueDate.
            if (!t.cycle_id) {
              const now = new Date();
              const taskDate = new Date(t.dueDate);
              const diffTime = taskDate.getTime() - now.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              return diffDays <= targetCycle.daysValue;
            }
            return validCycles.includes(t.cycle_id as string);
          })
          .filter(t => includeCompleted || !isCompletedInCurrentPeriod(t, cycles)) // Si ya se hizo, no la mostramos en pendientes de la cascada
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .forEach(t => {
            const listId = t.categoryId;
            if (!grouped[listId]) grouped[listId] = [];
            grouped[listId].push(t);
          });
        return grouped;
      },

      getTasksByList: (listId, includeCompleted = false) => {
        const { tasks, cycles, listSections } = get();
        const tasksArray = Object.values(tasks);
        
        const filtered = tasksArray.filter(t => t.categoryId === listId && !t.deleted_at && (includeCompleted || t.status === 'pending'));
        
        const grouped: Record<string, TaskItem[]> = {};
        for (const task of filtered) {
          let groupKey = '';
          if (task.sectionId) {
            groupKey = `section_${task.sectionId}`;
          } else if (task.cycle_id) {
            groupKey = `cycle_${task.cycle_id}`;
          } else {
            groupKey = 'Una Vez (One-off)';
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
      version: 3,
      merge: (persistedState: any, currentState: any) => ({
        ...currentState,
        ...persistedState,
        smartListVisibility: {
          ...currentState.smartListVisibility,
          ...(persistedState.smartListVisibility || {})
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
        
        return state as AppState;
      },
    }
  )
);
