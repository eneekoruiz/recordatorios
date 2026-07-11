export interface CustomCycle {
  id: string;
  user_id?: string; // Foreign key to users
  name: string;
  daysValue: number;
  isPinned: boolean;
  icon: string;
  recurrence_rule?: string; // RRULE format
  created_at?: string; // ISO String
  updated_at?: string;
  deleted_at?: string;
  version?: number;
}

export interface CustomList {
  id: string;
  parentId?: string; // Para jerarquía infinita (Lista -> Sublistas)
  name: string;
  color: string;
  icon?: string; // Lucide icon name
  isFinancial?: boolean; // Habilita campos de coste y modo financiero en tareas
  showCompleted?: boolean; // Persist preference to show completed tasks for this list
  isPinned?: boolean; // Pinned lists appear as large cards at the top of sidebar
  updated_at?: string;
  _is_dirty?: boolean;
}

export interface ListSection {
  id: string;
  listId: string;
  parentId?: string; // Para sub-secciones anidadas
  name: string;
  updated_at?: string;
  deleted_at?: string;
  _is_dirty?: boolean;
}

export interface AlertDef {
  id: string;
  type: 'at_time' | 'before';
  time?: string; // Format "HH:MM" para notificaciones en momento exacto
  offsetMinutes?: number; // 60 = 1 hour before, 1440 = 1 day before, etc.
}

export interface Attachment {
  id: string;
  task_id: string;
  file_url: string;
  file_type: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  version: number;
}

export interface TaskItem {
  id: string;
  user_id: string; // Foreign key to users
  categoryId?: string; // Corresponds to List in frontend
  type: 'task' | 'log'; 
  title: string;
  description?: string; // Changed from notes to match DB

  // Estructura Espacial (Subtareas y Orden)
  parentId?: string; // Si es null o undefined, es una tarea raíz
  order?: number; // Para ordenar libremente
  
  // Dependencias Topológicas (Bloqueadores)
  blockedBy?: string[]; // Opcional: dependencias complejas
  
  // Agrupación manual
  sectionId?: string; // Opcional: sección personalizada dentro de una lista
  
  // Ciclo dinámico
  cycle_id?: string; // Mapped to DB
  
  dueDate?: string; // ISO String
  status: 'pending' | 'in_progress' | 'completed'; // Mapped to DB
  alerts?: AlertDef[]; 
  completedAlerts?: string[]; // IDs of AlertDefs that have fired
  completionHistory?: number[]; // Timestamps de cuando se ha completado en el pasado
  
  // --- APPLE REMINDERS FEATURES ---
  priority?: 'none' | 'low' | 'medium' | 'high';
  flagged?: boolean;
  url?: string;
  image?: string;

  duration?: number;

  // --- SHOPPING & FINANCE FIELDS ---
  isDetailed?: boolean; 
  price?: number;       
  quantity?: number;    
  brand?: string;       

  // --- INNOVATION FIELDS ---
  location?: { lat: number; lng: number; radius: number; address: string };
  locationName?: string; 

  // --- SYNC-READY FIELDS ---
  created_at: string; // ISO String
  updated_at: string; // ISO String
  deleted_at?: string; // ISO String
  version: number;

  // --- LOCAL ONLY STATE ---
  _is_dirty?: boolean; // Flag to indicate if it needs to be synced to server
}

export interface TaskDependency {
  task_id: string;
  depends_on_task_id: string;
}

export interface LogEntry {
  id: string;
  user_id: string;
  task_id?: string;
  action: string;
  details?: Record<string, any>;
  created_at: string;
}
