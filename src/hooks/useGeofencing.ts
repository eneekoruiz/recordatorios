import { useEffect } from 'react';
import { GeolocationService } from '../services/GeolocationService';
import type { TaskItem } from '../models/Task';

export function useGeofencing(tasks: any) {
  // ── Geolocation / Geofencing (single instance) ───────────────────
  useEffect(() => {
    const geoService = GeolocationService.getInstance();

    const getGeoTasks = (): TaskItem[] => {
      return Object.values(tasks).filter(
        (t: any) => t.status === 'pending' && !t.deleted_at && t.location,
      ) as TaskItem[];
    };

    geoService.startGeofencing(getGeoTasks);
    
    // Cleanup no borra el watcher si no hay tareas, pero stopGeofencing lo maneja
    return () => {
      // Solo detenemos si el componente App se desmonta (casi nunca), 
      // o cuando cambian las dependencias para reiniciar con nuevas tareas.
      geoService.stopGeofencing();
    };
  }, [tasks]); // Re-evaluar cuando cambien las tareas
}
