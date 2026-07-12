export class NotificationService {
  private static instance: NotificationService;
  private intervalId: number | null = null;
  public hasPermission = false;
  public permissionDenied = false;

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // 1. Manejo Resiliente de Permisos (Fallback)
  public async requestPermissions(): Promise<boolean> {
    try {
      if (!('Notification' in window)) {
        // Silencioso
        this.permissionDenied = true;
        return false;
      }

      if (Notification.permission === 'granted') {
        this.hasPermission = true;
        this.permissionDenied = false;
        return true;
      }

      if (Notification.permission === 'denied') {
        this.permissionDenied = true;
        this.hasPermission = false;
        // Silencioso
        return false;
      }

      const permission = await Notification.requestPermission();
      this.hasPermission = permission === 'granted';
      this.permissionDenied = permission === 'denied';
      return this.hasPermission;
    } catch {
      // Silencioso
      this.permissionDenied = true;
      return false; // Zero crashes
    }
  }

  // 2. Scheduler con Try/Catch de alto nivel
  public startScheduler(getPendingAlerts: () => { taskId: string, title: string, time: string }[]) {
    if (this.intervalId) return;

    this.intervalId = window.setInterval(() => {
      try {
        this.checkAndFireAlerts(getPendingAlerts());
      } catch {
        // Silencioso
      }
    }, 60000);
    
    // Ejecución inicial segura
    try {
      this.checkAndFireAlerts(getPendingAlerts());
    } catch {}
  }

  public stopScheduler() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private checkAndFireAlerts(alerts: { taskId: string, title: string, time: string }[]) {
    // Fallback: Si no hay permisos, simplemente no se dispara, pero la app no muere.
    if (!this.hasPermission) return;

    const now = new Date();
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${currentHours}:${currentMinutes}`;

    alerts.forEach(alert => {
      if (alert.time === currentTime) {
        this.fireNotification(alert.title, alert.taskId);
      }
    });
  }

  private fireNotification(title: string, _taskId: string) {
    try {
      const notification = new Notification('Recordatorio', {
        body: title,
        icon: '/vite.svg',
        requireInteraction: true 
      });

      notification.onclick = () => {
        window.focus(); 
        notification.close();
      };
    } catch {
      // Silencioso
    }
  }
}
