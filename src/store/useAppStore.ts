import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { TaskItem, FrequencyLevel } from '../models/Task';
import { TaskRepository } from '../repositories/TaskRepository';

interface AppState {
  tasks: Record<string, TaskItem>;
  
  addTask: (task: Omit<TaskItem, 'id' | 'status' | 'createdAt' | 'updated_at' | 'is_dirty' | 'is_deleted'>) => void;
  completeTask: (id: string) => void;
  deleteTask: (id: string) => void;
  
  getTasksByFrequency: (level: FrequencyLevel) => Record<string, TaskItem[]>;
  getSmartSortTasks: () => TaskItem[]; 
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      tasks: {},

      // Desacoplamiento (Patrón Repositorio)
      // La UI ya no muta crudamente los metadatos. El Repositorio orquesta la lógica CRDT.
      
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
        
        const updatedTask = TaskRepository.update(existingTask, { status: 'COMPLETED' });
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

        // Borrado Lógico: No destruimos el registro local. 
        // Cambiamos su estado para que el SyncProvider lo procese hacia la nube.
        const deletedTask = TaskRepository.markAsDeleted(existingTask);
        return { 
          tasks: { 
            ...state.tasks,
            [id]: deletedTask
          } 
        };
      }),

      getTasksByFrequency: (targetLevel) => {
        const tasksArray = Object.values(get().tasks);
        // Regla Cloud: Omitir los borrados lógicos en la UI (is_deleted: false)
        const filtered = tasksArray.filter(t => 
          t.frequencyLevel <= targetLevel && 
          t.status === 'PENDING' && 
          t.is_deleted === false
        );
        
        const grouped: Record<string, TaskItem[]> = {};
        for (const task of filtered) {
          if (!grouped[task.categoryId]) grouped[task.categoryId] = [];
          grouped[task.categoryId].push(task);
        }
        return grouped;
      },

      getSmartSortTasks: () => {
        const tasksArray = Object.values(get().tasks).filter(t => t.status === 'PENDING' && t.is_deleted === false);
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
          if (task.frequencyLevel === 1 && currentHours > 18) {
            score += 30;
          }
          return { ...task, _score: score };
        });

        return scoredTasks.sort((a, b) => {
          if (b._score !== a._score) return b._score - a._score;
          return a.createdAt - b.createdAt;
        });
      }
    }),
    {
      name: 'reminders-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
