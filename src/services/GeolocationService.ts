import type { TaskItem } from '../models/Task';

export class GeolocationService {
  private static instance: GeolocationService;
  private watchId: number | null = null;
  private lastFiredIds: Set<string> = new Set();
  
  // Optimizaciones de Batería (QA)
  private readonly POLLING_INTERVAL_MS = 30000; 
  private lastPollTime = 0;

  private constructor() {}

  public static getInstance(): GeolocationService {
    if (!GeolocationService.instance) {
      GeolocationService.instance = new GeolocationService();
    }
    return GeolocationService.instance;
  }

  /**
   * Fórmula de Haversine para calcular distancia en Metros entre dos coordenadas
   */
  private getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Radio de la Tierra en metros
    const p1 = lat1 * Math.PI/180;
    const p2 = lat2 * Math.PI/180;
    const dp = (lat2-lat1) * Math.PI/180;
    const dl = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(dp/2) * Math.sin(dp/2) +
              Math.cos(p1) * Math.cos(p2) *
              Math.sin(dl/2) * Math.sin(dl/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Arranca el engine de Geofencing
   */
  public startGeofencing(getGeoTasks: () => TaskItem[]) {
    if (this.watchId !== null) return;
    if (!('geolocation' in navigator)) return;
    if (sessionStorage.getItem('geoDenied') === 'true') return;

    // Solo pedir ubicación si hay tareas que la necesiten o si el usuario ya dio permiso
    const tasks = getGeoTasks();
    if (tasks.length === 0) return;

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        // Optimización de Batería: Procesamos máximo cada 30 segundos
        if (now - this.lastPollTime < this.POLLING_INTERVAL_MS) return;
        this.lastPollTime = now;

        const tasks = getGeoTasks();
        if (tasks.length === 0) return;

        const { latitude, longitude } = position.coords;

        tasks.forEach(task => {
          if (!task.location) return;
          
          const distance = this.getDistanceInMeters(
            latitude, longitude, 
            task.location.lat, task.location.lng
          );

          if (distance <= task.location.radius) {
            // El usuario entró en el radio
            if (!this.lastFiredIds.has(task.id)) {
              this.fireLocationAlert(task.title);
              this.lastFiredIds.add(task.id);
            }
          } else {
            // Salió del radio, lo reseteamos por si vuelve a entrar más tarde
            this.lastFiredIds.delete(task.id);
          }
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          sessionStorage.setItem('geoDenied', 'true');
          this.stopGeofencing();
        }
      },
      {
        enableHighAccuracy: false, // Ahorro masivo de batería
        maximumAge: 10000,
        timeout: 5000
      }
    );
  }

  public stopGeofencing() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  private fireLocationAlert(title: string) {
    try {
      if (Notification.permission === 'granted') {
        new Notification('Has llegado a tu destino', {
          body: title,
          icon: '/vite.svg',
          requireInteraction: true
        });
      }
    } catch {
      // Error silencioso en background
    }
  }
}
