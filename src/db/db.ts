import Dexie, { type Table } from 'dexie';
import type { TaskItem, CustomCycle, LogEntry, Attachment } from '../models/Task';

export class AppDatabase extends Dexie {
  tasks!: Table<TaskItem, string>;
  cycles!: Table<CustomCycle, string>;
  logs!: Table<LogEntry, string>;
  attachments!: Table<Attachment, string>;

  constructor() {
    super('ProductivityAppDB');
    
    // Schema definition
    // '&id' means primary key, 'updated_at' is indexed for sync queries, '_is_dirty' for push queries
    this.version(1).stores({
      tasks: '&id, user_id, cycle_id, status, categoryId, created_at, updated_at, _is_dirty',
      cycles: '&id, user_id, updated_at, _is_dirty',
      logs: '&id, user_id, task_id, created_at, _is_dirty',
      attachments: '&id, task_id, updated_at, _is_dirty'
    });
  }
}

export const db = new AppDatabase();
