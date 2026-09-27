import type { TaskItem } from '../models/Task';
import { stripPeriodicityPrefix, getPeriodicityFromPrefix, hasPeriodicityPrefix } from '../utils/sectionRoutine';

/**
 * Patrón Repositorio: Desacopla la UI de la Base de Datos.
 */
export class TaskRepository {
  
  public static generateId(): string {
    return crypto.randomUUID();
  }

  public static create(payload: Partial<TaskItem>): TaskItem {
    const now = new Date().toISOString();
    let title = payload.title !== undefined ? payload.title : 'Nueva Tarea';
    let cycle_id = payload.cycle_id;

    if (hasPeriodicityPrefix(title)) {
      const p = getPeriodicityFromPrefix(title);
      if (p && !cycle_id) {
        cycle_id = p === 'day' ? 'cycle_day' : p === 'week' ? 'cycle_week' : p === 'month' ? 'cycle_month' : 'cycle_year';
      }
      title = stripPeriodicityPrefix(title);
    }

    return {
      id: this.generateId(),
      user_id: '', // Will be set by Supabase/SyncManager upon sync or auth state
      type: 'task',
      status: 'pending',
      version: 1,
      ...payload,
      title,
      cycle_id,
      created_at: payload.created_at || now,
      updated_at: payload.updated_at || now,
      _is_dirty: true 
    } as TaskItem;
  }

  public static update(existingTask: TaskItem, updates: Partial<TaskItem>): TaskItem {
    let title = 'title' in updates ? (updates.title ?? '') : existingTask.title;
    let cycle_id = 'cycle_id' in updates ? updates.cycle_id : existingTask.cycle_id;

    if (updates.title && hasPeriodicityPrefix(updates.title)) {
      const p = getPeriodicityFromPrefix(updates.title);
      if (p && !('cycle_id' in updates)) {
        cycle_id = p === 'day' ? 'cycle_day' : p === 'week' ? 'cycle_week' : p === 'month' ? 'cycle_month' : 'cycle_year';
      }
      title = stripPeriodicityPrefix(updates.title);
    }

    const result: TaskItem = {
      ...existingTask,
      ...updates,
      title,
      cycle_id,
      version: (existingTask.version || 1) + 1,
      updated_at: new Date().toISOString(),
      _is_dirty: true 
    };

    if (cycle_id === undefined) {
      delete (result as any).cycle_id;
    }

    return result;
  }

  public static markAsDeleted(existingTask: TaskItem): TaskItem {
    return this.update(existingTask, { deleted_at: new Date().toISOString() });
  }
}
