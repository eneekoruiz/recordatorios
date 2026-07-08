export interface CustomCycle {
  id: string;
  name: string;
  daysValue: number; // Duración en días para la cascada matemática
  isPinned: boolean;
  icon: string; // Nombre del icono de Lucide (ej. 'sun', 'calendar')
}

export interface CustomList {
  id: string;
  name: string;
  color: string;
}

export interface ListSection {
  id: string;
  listId: string;
  name: string;
}

export interface TaskItem {
  id: string;
  categoryId: string;
  title: string;
  notes?: string;

  // Estructura Espacial (Subtareas y Orden)
  parentId?: string; // Si es null o undefined, es una tarea raíz
  order?: number; // Para ordenar libremente
  
  // Dependencias Topológicas (Bloqueadores)
  blockedBy?: string[]; // Opcional: dependencias complejas ocultas por defecto
  
  // Agrupación manual
  sectionId?: string; // Opcional: sección personalizada dentro de una lista
  
  // Nuevo: Referencia al ciclo dinámico (sustituye a frequencyLevel)
  cycleId?: string; // Opcional: si no está presente, es un recordatorio de un solo uso (One-off)
  
  dueDate: Date;
  status: 'PENDING' | 'COMPLETED' | 'SKIPPED';
  alerts: string[]; 
  completedAlerts?: string[]; // Para tachado parcial
  createdAt: number; 

  // --- APPLE REMINDERS FEATURES ---
  priority?: 'none' | 'low' | 'medium' | 'high';
  flagged?: boolean;
  url?: string;
  image?: string; // base64 o URL de imagen adjunta

  // --- INNOVATION FIELDS ---
  /** Coordenadas de Geofencing para disparar notificaciones basadas en ubicación */
  location?: { lat: number; lng: number; radius: number; address: string };
  locationName?: string; // Nombre amigable para UI

  // --- SYNC-READY FIELDS (Cloud Architect) ---
  updated_at: number; 
  is_dirty: boolean;  
  is_deleted: boolean; 
}
