import type { TaskItem } from '../models/Task';

/**
 * Patrón Repositorio: Desacopla la UI de la Base de Datos.
 */
export class TaskRepository {
  
  public static generateId(): string {
    return crypto.randomUUID();
  }

  public static create(payload: Partial<TaskItem>): TaskItem {
    const now = new Date().toISOString();
    return {
      id: this.generateId(),
      user_id: '', // Will be set by Supabase/SyncManager upon sync or auth state
      type: 'task',
      title: 'Nueva Tarea',
      status: 'pending',
      version: 1,
      ...payload,
      created_at: payload.created_at || now,
      updated_at: payload.updated_at || now,
      _is_dirty: true 
    } as TaskItem;
  }

  public static update(existingTask: TaskItem, updates: Partial<TaskItem>): TaskItem {
    return {
      ...existingTask,
      ...updates,
      version: (existingTask.version || 1) + 1,
      updated_at: new Date().toISOString(),
      _is_dirty: true 
    };
  }

  public static markAsDeleted(existingTask: TaskItem): TaskItem {
    return this.update(existingTask, { deleted_at: new Date().toISOString() });
  }
}
