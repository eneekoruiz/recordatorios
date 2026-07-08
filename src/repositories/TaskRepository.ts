import type { TaskItem } from '../models/Task';

/**
 * Patrón Repositorio: Desacopla la UI de la Base de Datos.
 */
export class TaskRepository {
  
  public static generateId(): string {
    return crypto.randomUUID();
  }

  public static create(payload: Omit<TaskItem, 'id' | 'status' | 'createdAt' | 'updated_at' | 'is_dirty' | 'is_deleted'>): TaskItem {
    const now = Date.now();
    return {
      ...payload,
      id: this.generateId(),
      status: 'PENDING',
      blockedBy: payload.blockedBy || [],
      createdAt: now,
      updated_at: now,
      is_dirty: true, 
      is_deleted: false
    };
  }

  public static update(existingTask: TaskItem, updates: Partial<TaskItem>): TaskItem {
    return {
      ...existingTask,
      ...updates,
      updated_at: Date.now(),
      is_dirty: true 
    };
  }

  public static markAsDeleted(existingTask: TaskItem): TaskItem {
    return this.update(existingTask, { is_deleted: true });
  }
}
