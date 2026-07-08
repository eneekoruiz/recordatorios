import { useAppStore } from '../store/useAppStore';
import type { TaskItem } from '../models/Task';

/**
 * ============================================================================
 * ☁️ CLOUD SYNC PROVIDER (Cloud-Ready Architecture)
 * ============================================================================
 * 
 * Este módulo está diseñado con el patrón Repository/Provider para ser un
 * puente directo hacia cualquier Backend-as-a-Service (BaaS) como Supabase,
 * Firebase o un backend personalizado.
 * 
 * Actualmente funciona en modo "Mock" (simulando red), pero la lógica
 * de resolución de conflictos y detección de mutaciones ('is_dirty')
 * ya está lista para producción comercial.
 * 
 * PARA ACTIVAR LA NUBE:
 * 1. Reemplaza el contenido de `uploadToCloud` con tu SDK (ej. supabase.from('tasks').upsert(...))
 * 2. Reemplaza `fetchFromCloud` con tu GET request.
 * 3. Ejecuta `SyncProvider.initialize()` en App.tsx.
 */

export class SyncProvider {
  private static isSyncing = false;
  private static syncInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Inicia el demonio de sincronización bidireccional.
   * Por defecto, revisa cambios locales cada 30 segundos.
   */
  static initialize(intervalMs: number = 30000) {
    if (this.syncInterval) clearInterval(this.syncInterval);
    
    // Escuchar eventos online/offline nativos del navegador
    window.addEventListener('online', this.handleOnline);
    
    this.syncInterval = setInterval(() => {
      if (navigator.onLine) {
        this.sync();
      }
    }, intervalMs);
    
    console.log('[SyncProvider] Cloud sync initialized.');
  }

  /**
   * Detiene el demonio de sincronización y limpia los event listeners.
   */
  static destroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    window.removeEventListener('online', this.handleOnline);
    console.log('[SyncProvider] Cloud sync destroyed.');
  }

  private static handleOnline = () => {
    this.sync();
  };

  /**
   * Ejecuta un ciclo de sincronización completo (Push -> Pull).
   */
  static async sync() {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const store = useAppStore.getState();
      const allTasks = Object.values(store.tasks);

      // 1. PUSH: Buscar tareas modificadas localmente
      const dirtyTasks = allTasks.filter(t => t.is_dirty);
      if (dirtyTasks.length > 0) {
        await this.uploadToCloud(dirtyTasks);
        
        // Limpiar la bandera localmente una vez subido con éxito
        dirtyTasks.forEach(t => {
          store.updateTaskRaw({ ...t, is_dirty: false }); 
        });
      }

      // 2. PULL: Bajar cambios externos
      const cloudTasks = await this.fetchFromCloud();
      if (cloudTasks && cloudTasks.length > 0) {
        this.resolveConflicts(cloudTasks, store);
      }

    } catch (error) {
      console.error('[SyncProvider] Error syncing with cloud:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * [TODO: Insertar SDK de Supabase/Firebase aquí]
   */
  private static async uploadToCloud(_tasks: TaskItem[]): Promise<void> {
    // Ejemplo Supabase:
    // const { error } = await supabase.from('tasks').upsert(tasks);
    // if (error) throw error;
    
    return new Promise(resolve => setTimeout(resolve, 500)); // Mock delay
  }

  /**
   * [TODO: Insertar SDK de Supabase/Firebase aquí]
   */
  private static async fetchFromCloud(): Promise<TaskItem[]> {
    // Ejemplo Supabase:
    // const { data } = await supabase.from('tasks').select('*');
    // return data as TaskItem[];
    
    return new Promise(resolve => setTimeout(() => resolve([]), 500)); // Mock delay
  }

  /**
   * Resuelve conflictos usando Last-Write-Wins (LWW) basado en `updated_at`.
   */
  private static resolveConflicts(cloudTasks: TaskItem[], store: any) {
    const localTasks = store.tasks as Record<string, TaskItem>;
    
    cloudTasks.forEach(cloudTask => {
      const localTask = localTasks[cloudTask.id];
      
      // Si no existe localmente, o la de la nube es más reciente:
      if (!localTask || cloudTask.updated_at > localTask.updated_at) {
        store.updateTaskRaw({ ...cloudTask, is_dirty: false });
      }
    });
  }
}
