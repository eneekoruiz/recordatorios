import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { TaskItem, CustomCycle, CustomList, ListSection } from '../models/Task';
import { TaskRepository } from '../repositories/TaskRepository';

const INITIAL_LISTS: CustomList[] = [
  { id: 'compras', name: 'Compras', color: '#ff9500' },
  { id: 'care', name: 'Care', color: '#af52de' },
  { id: 'quehaceres', name: 'Quehaceres', color: '#34c759' },
  { id: 'limpieza', name: 'Limpieza', color: '#0a84ff' }
];

const INITIAL_CYCLES: CustomCycle[] = [
  { id: 'cycle_day', name: 'Mi Día', daysValue: 1, isPinned: true, icon: 'sun' },
  { id: 'cycle_week', name: 'Mi Semana', daysValue: 7, isPinned: true, icon: 'calendar' },
  { id: 'cycle_month', name: 'Mi Mes', daysValue: 30, isPinned: true, icon: 'moon' },
  { id: 'cycle_year', name: 'Mi Año', daysValue: 365, isPinned: true, icon: 'globe' },
];

interface AppState {
  tasks: Record<string, TaskItem>;
  cycles: CustomCycle[];
  lists: CustomList[];
  listSections: ListSection[];
  smartListVisibility: Record<string, boolean>;
  
  toggleSmartList: (listId: string) => void;
  
  addTask: (task: Omit<TaskItem, 'id' | 'status' | 'createdAt' | 'updated_at' | 'is_dirty' | 'is_deleted'>) => void;
  completeTask: (id: string) => void;
  deleteTask: (id: string) => void;
  
  addCycle: (cycle: CustomCycle) => void;
  updateCycle: (id: string, updates: Partial<CustomCycle>) => void;
  deleteCycle: (id: string) => void;

  addList: (list: CustomList) => void;
  deleteList: (id: string) => void;

  addListSection: (section: ListSection) => void;
  updateListSection: (id: string, name: string) => void;
  deleteListSection: (id: string) => void;
  updateTaskSection: (taskId: string, sectionId: string | undefined) => void;

  getTasksByCycle: (cycleId: string) => Record<string, TaskItem[]>;
  getTasksByList: (listId: string) => Record<string, TaskItem[]>;
  getSmartSortTasks: () => TaskItem[]; 

  exportData: () => string;
  importData: (jsonData: string) => void;
  parsePlainTextTasks: (text: string) => void;
  addDependency: (targetTaskId: string, blockedByTaskId: string) => void;
  removeDependency: (targetTaskId: string, blockedByTaskId: string) => void;
  nestTask: (taskId: string, parentId: string | undefined) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      tasks: {},
      cycles: INITIAL_CYCLES,
      lists: INITIAL_LISTS,
      listSections: [],
      smartListVisibility: {
        smart_today: true,
        smart_scheduled: true,
        smart_all: true,
        smart_flagged: true,
        smart_completed: false
      },

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

      completeTask: (id) => set((state) => {
        const existingTask = state.tasks[id];
        if (!existingTask) return state;
        
        let updatedTask: TaskItem;
        const alerts = existingTask.alerts || [];
        const completedAlerts = existingTask.completedAlerts || [];

        // Lógica de tachado parcial (Multi-dosis)
        if (alerts.length > 1 && completedAlerts.length < alerts.length - 1) {
          // Aún quedan alertas por completar, añadimos la siguiente
          const nextAlert = alerts[completedAlerts.length];
          updatedTask = TaskRepository.update(existingTask, { 
            completedAlerts: [...completedAlerts, nextAlert] 
          });
        } else {
          // Es la última o la única alerta, completamos la tarea entera
          updatedTask = TaskRepository.update(existingTask, { 
            status: 'COMPLETED',
            completedAlerts: [...completedAlerts, alerts[completedAlerts.length]].filter(Boolean)
          });
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
        lists: [...(state.lists || INITIAL_LISTS), list]
      })),

      deleteList: (id) => set((state) => ({
        lists: (state.lists || INITIAL_LISTS).filter(l => l.id !== id)
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
            updatedTasks[taskId] = { ...updatedTasks[taskId], sectionId: undefined, is_dirty: true, updated_at: Date.now() };
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
            [taskId]: {
              ...task,
              sectionId,
              is_dirty: true,
              updated_at: Date.now()
            }
          }
        };
      }),

      // Algoritmo de Cascada Matemático
      getTasksByCycle: (cycleId) => {
        const { tasks, cycles } = get();
        const targetCycle = cycles.find(c => c.id === cycleId);
        if (!targetCycle) return {};

        const tasksArray = Object.values(tasks);
        
        // Regla: Hereda tareas de su propio ciclo Y de cualquier ciclo más corto.
        // NUEVO: Si no tiene ciclo (One-off), evaluamos por dueDate.
        const filtered = tasksArray.filter(t => {
          if (t.status !== 'PENDING' || t.is_deleted) return false;
          
          if (!t.cycleId) {
            // Es un "One-off". Evaluamos según el dueDate y el targetCycle.
            const now = new Date();
            const taskDate = new Date(t.dueDate);
            const diffTime = taskDate.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            // Si vence en un rango menor o igual a la duración del ciclo, lo mostramos.
            // Para 'Mi Día' (1 día), mostrará las de hoy o vencidas.
            return diffDays <= targetCycle.daysValue;
          }

          const taskCycle = cycles.find(c => c.id === t.cycleId);
          // Si el ciclo de la tarea ya no existe, por fallback lo mostramos
          if (!taskCycle) return true;
          
          return taskCycle.daysValue <= targetCycle.daysValue;
        });
        
        const grouped: Record<string, TaskItem[]> = {};
        for (const task of filtered) {
          if (!grouped[task.categoryId]) grouped[task.categoryId] = [];
          grouped[task.categoryId].push(task);
        }
        return grouped;
      },

      getTasksByList: (listId) => {
        const { tasks, cycles, listSections } = get();
        const tasksArray = Object.values(tasks);
        
        const filtered = tasksArray.filter(t => t.categoryId === listId && t.status === 'PENDING' && !t.is_deleted);
        
        const grouped: Record<string, TaskItem[]> = {};
        for (const task of filtered) {
          let groupName = '';
          if (task.sectionId) {
            const section = (listSections || []).find(s => s.id === task.sectionId);
            groupName = section ? `section_${section.name}` : 'Personalizado';
          } else if (task.cycleId) {
            groupName = cycles.find(c => c.id === task.cycleId)?.name || 'Personalizado';
          } else {
            groupName = 'Una Vez (One-off)';
          }

          if (!grouped[groupName]) grouped[groupName] = [];
          grouped[groupName].push(task);
        }
        return grouped;
      },

      getSmartSortTasks: () => {
        const { tasks, cycles } = get();
        const tasksArray = Object.values(tasks).filter(t => t.status === 'PENDING' && t.is_deleted === false);
        const now = new Date();
        const currentHours = now.getHours();

        const scoredTasks = tasksArray.map(task => {
          let score = 0;
          if (task.alerts.length > 0) {
            let closestDiff = 999;
            task.alerts.forEach(alert => {
              const [h] = alert.split(':');
              const alertHour = parseInt(h, 10);
              const diff = alertHour - currentHours;
              if (diff >= 0 && diff < closestDiff) closestDiff = diff;
            });
            if (closestDiff <= 2) score += 50; 
            else if (closestDiff <= 5) score += 20;
          }
          
          // SmartSort: Tareas Diarias por la tarde
          const taskCycle = cycles.find(c => c.id === task.cycleId);
          if (taskCycle && taskCycle.daysValue === 1 && currentHours > 18) {
            score += 30;
          }
          return { ...task, _score: score };
        });

        return scoredTasks.sort((a, b) => {
          if (b._score !== a._score) return b._score - a._score;
          return a.createdAt - b.createdAt;
        });
      },

      exportData: () => {
        const { tasks, cycles } = get();
        const data = { tasks, cycles, version: 3, exportedAt: new Date().toISOString() };
        return JSON.stringify(data, null, 2);
      },

      importData: (jsonData: string) => {
        try {
          const parsed = JSON.parse(jsonData);
          if (parsed.tasks && parsed.cycles) {
            set({ tasks: parsed.tasks, cycles: parsed.cycles });
          }
        } catch (e) {
          // Silencioso
        }
      },

      parsePlainTextTasks: (text: string) => {
        const { addTask, cycles, addCycle } = get();
        const lines = text.split('\n');
        
        lines.forEach(line => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('//')) return;
          
          let title = trimmed;
          let categoryId = 'inbox';
          let cycleId = 'cycle_day';

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
              cycleId = existing.id;
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
              cycleId = newCycleId;
            }
          }

          if (title) {
            addTask({
              title,
              categoryId,
              cycleId,
              blockedBy: [],
              dueDate: new Date(),
              alerts: []
            });
          }
        });
      },

      addDependency: (targetTaskId: string, blockedByTaskId: string) => set((state) => {
        if (targetTaskId === blockedByTaskId) return state; // No auto-bloqueo
        
        const targetTask = state.tasks[targetTaskId];
        if (!targetTask) return state;
        
        const currentBlockedBy = targetTask.blockedBy || [];
        if (!currentBlockedBy.includes(blockedByTaskId)) {
          return {
            tasks: {
              ...state.tasks,
              [targetTaskId]: {
                ...targetTask,
                blockedBy: [...currentBlockedBy, blockedByTaskId]
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
              is_dirty: true,
              updated_at: Date.now()
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
              is_dirty: true,
              updated_at: Date.now()
            }
          }
        };
      })
    }),
    {
      name: 'reminders-storage',
      storage: createJSONStorage(() => localStorage),
      version: 3,
      migrate: (persistedState: any, version: number) => {
        let state = persistedState;
        
        if (version === 0 || version === 1) {
          // Migración v1 -> v2: Transform frequencies to cycles
          const newTasks: Record<string, TaskItem> = {};
          if (state.tasks) {
            Object.entries(state.tasks).forEach(([id, t]: [string, any]) => {
              let cycleId = 'cycle_day';
              if (t.frequencyLevel === 'weekly') cycleId = 'cycle_week';
              if (t.frequencyLevel === 'monthly') cycleId = 'cycle_month';
              if (t.frequencyLevel === 'yearly') cycleId = 'cycle_year';
              
              const migratedTask: any = {
                ...t,
                cycleId,
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
