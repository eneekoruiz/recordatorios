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

  public checkAndSendWeeklyNotification(pendingDaily: number, pendingWeekly: number) {
    if (!this.hasPermission && Notification.permission !== 'granted') return;
    this.hasPermission = true;

    const todayStr = new Date().toDateString();
    try {
      const lastSent = localStorage.getItem('weekly_notif_sent_date');
      if (lastSent === todayStr) return; // Solo una vez al día

      this.show('Hoy te tocan los recordatorios semanales', {
        body: `Pendientes: ${pendingWeekly} semanales y ${pendingDaily} diarios.`,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: `weekly-${todayStr}`,
      });

      localStorage.setItem('weekly_notif_sent_date', todayStr);
    } catch {
      // Silencioso
    }
  }

  private fireNotification(title: string, taskId: string) {
    this.show('Recordatorio', { body: title, icon: '/icons/icon-192.png', tag: `alert-${taskId}` });
  }

  /**
   * En Android `new Notification()` lanza «Illegal constructor»: allí solo vale el
   * service worker. Se usa siempre que exista y el constructor queda de respaldo.
   */
  private show(title: string, options: NotificationOptions) {
    const fallback = () => {
      try {
        const notification = new Notification(title, options);
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch {
        // Silencioso
      }
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration()
        .then((registration) => (registration ? registration.showNotification(title, options) : fallback()))
        .catch(fallback);
    } else {
      fallback();
    }
  }
}
