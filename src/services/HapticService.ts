/**
 * HapticService.ts
 * Proporciona respuesta háptica táctil tipo Apple Taptic Engine
 * para navegadores móviles (iOS PWA / WebKit y Android Chrome).
 */

class HapticServiceClass {
  private _enabled: boolean = true;

  constructor() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('recordatorios_haptic_enabled');
      this._enabled = stored !== null ? stored === 'true' : true;
    }
  }

  public get enabled(): boolean {
    return this._enabled;
  }

  public set enabled(val: boolean) {
    this._enabled = val;
    if (typeof window !== 'undefined') {
      localStorage.setItem('recordatorios_haptic_enabled', String(val));
    }
  }

  public toggle(): boolean {
    this.enabled = !this.enabled;
    if (this.enabled) this.impact('light');
    return this.enabled;
  }

  private canVibrate(): boolean {
    return (
      this._enabled &&
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      'vibrate' in navigator &&
      typeof navigator.vibrate === 'function'
    );
  }

  /**
   * Micro-impacto físico para interacciones de interfaz
   */
  public impact(style: 'light' | 'medium' | 'heavy' = 'light') {
    if (!this.canVibrate()) return;
    try {
      switch (style) {
        case 'light':
          navigator.vibrate(8);
          break;
        case 'medium':
          navigator.vibrate(18);
          break;
        case 'heavy':
          navigator.vibrate(32);
          break;
      }
    } catch {
      // Ignorar errores en navegadores restrictivos
    }
  }

  /**
   * Respuesta para eventos clave (completar tarea, error, advertencia)
   */
  public notification(type: 'success' | 'warning' | 'error' = 'success') {
    if (!this.canVibrate()) return;
    try {
      switch (type) {
        case 'success':
          // Doble pulso armónico característico de iOS Reminders
          navigator.vibrate([12, 45, 16]);
          break;
        case 'warning':
          navigator.vibrate([18, 30, 18]);
          break;
        case 'error':
          navigator.vibrate([30, 60, 30, 60, 30]);
          break;
      }
    } catch {
      // Ignorar
    }
  }

  /**
   * Pulsación sutil de selección (para switches, sliders, cambio de tabs)
   */
  public selection() {
    if (!this.canVibrate()) return;
    try {
      navigator.vibrate(6);
    } catch {
      // Ignorar
    }
  }
}

export const HapticService = new HapticServiceClass();
