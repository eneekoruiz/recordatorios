import type { TaskItem } from '../models/Task';

/**
 * Patrón Repositorio: Desacopla la UI de la Base de Datos.
 * Actualmente usa memoria en-memoria sincronizada con Zustand (Local), pero centraliza la lógica CRDT (Cloud).
 */
export class TaskRepository {
  
  /**
   * Genera un ID único (UUID v4 simplificado para el entorno local)
   */
  public static generateId(): string {
    return Math.random().toString(36).substring(2, 9);
  }

  /**
   * Crea una nueva tarea y le inyecta los metadatos de sincronización Cloud (Sync-Ready)
   */
  public static create(payload: Omit<TaskItem, 'id' | 'status' | 'createdAt' | 'updated_at' | 'is_dirty' | 'is_deleted'>): TaskItem {
    const now = Date.now();
    return {
      ...payload,
      id: this.generateId(),
      status: 'PENDING',
      createdAt: now,
      // Metadata Offline-First:
      updated_at: now,
      is_dirty: true, // Nace sucia porque la nube aún no la tiene
      is_deleted: false
    };
  }

  /**
   * Modifica una tarea existente. Marca 'is_dirty' y actualiza el timestamp.
   */
  public static update(existingTask: TaskItem, updates: Partial<TaskItem>): TaskItem {
    return {
      ...existingTask,
      ...updates,
      updated_at: Date.now(),
      is_dirty: true // Cualquier mutación la marca para subir a la nube
    };
  }

  /**
   * Borrado Lógico (Soft Delete)
   * En un entorno Cloud, borrar registros físicos destruye la integridad referencial.
   */
  public static markAsDeleted(existingTask: TaskItem): TaskItem {
    return this.update(existingTask, { is_deleted: true });
  }
}
