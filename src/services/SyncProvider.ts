import type { TaskItem } from '../models/Task';

/**
 * -------------------------------------------------------------
 * SYNC PROVIDER (Cloud Integration Skeleton)
 * -------------------------------------------------------------
 * 
 * Arquitecto Cloud: Este servicio está diseñado para conectar la app
 * a Firebase, Supabase, Cloudflare D1 o Convex en un futuro.
 * 
 * La aplicación entera ya está operando bajo el estándar CRDT Offline-First.
 * Cuando se decida el proveedor, solo hay que rellenar las implementaciones de:
 * - pushDirtyRecords()
 * - pullRemoteUpdates()
 */
export class SyncProvider {
  
  /**
   * Sube a la nube todas las tareas locales donde `is_dirty === true`.
   * Si la subida es exitosa por cada tarea, debe actualizar `is_dirty = false` en el Repositorio.
   */
  public static async pushDirtyRecords(localTasks: Record<string, TaskItem>): Promise<void> {
    const dirtyTasks = Object.values(localTasks).filter(t => t.is_dirty);
    if (dirtyTasks.length === 0) return;

    console.log(`[Cloud Sync] Preparando para subir ${dirtyTasks.length} registros...`);
    
    // TODO: Ejemplo para Supabase:
    // const { error } = await supabase.from('tasks').upsert(dirtyTasks);
    // si no hay error -> mutar el estado local (a través de Zustand) para marcar is_dirty: false
  }

  /**
   * Descarga de la nube las tareas que han sido modificadas desde el último Timestamp de sincronización.
   * Utiliza el campo `updated_at` para resolver conflictos (gana el registro más reciente).
   */
  public static async pullRemoteUpdates(lastSyncTimestamp: number): Promise<TaskItem[]> {
    console.log(`[Cloud Sync] Buscando cambios remotos desde ${new Date(lastSyncTimestamp).toISOString()}`);
    
    // TODO: Ejemplo para Supabase:
    // const { data, error } = await supabase
    //   .from('tasks')
    //   .select('*')
    //   .gt('updated_at', lastSyncTimestamp);
    //
    // return data as TaskItem[];

    return [];
  }

  /**
   * Loop de sincronización que se puede ejecutar en el 'background' o al recuperar la conexión.
   */
  public static async runSyncCycle(localTasks: Record<string, TaskItem>) {
    try {
      await this.pushDirtyRecords(localTasks);
      // const incoming = await this.pullRemoteUpdates(Date.now() - 60000); // pull
      // TODO: Hacer un 'merge' en el Repositorio de los records incoming
    } catch (e) {
      console.error('[Cloud Sync] Fallo en el ciclo de sincronización. La app sigue operando en modo Offline-First.', e);
    }
  }
}
