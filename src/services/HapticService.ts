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
   * Safari en iPhone no tiene `navigator.vibrate`, pero desde iOS 18 un interruptor nativo
   * (`<input type="checkbox" switch>`) da un toque del Taptic Engine al cambiar. Se usa uno oculto
   * fuera de la pantalla; sin iOS 18 no hace nada.
   */
  private switchLabel: HTMLLabelElement | null = null;
  private tick(times = 1, gap = 70) {
    if (!this._enabled || typeof document === 'undefined' || !document.body) return;
    try {
      if (!this.switchLabel) {
        const label = document.createElement('label');
        label.setAttribute('aria-hidden', 'true');
        label.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.setAttribute('switch', '');
        input.tabIndex = -1;
        label.appendChild(input);
        document.body.appendChild(label);
        this.switchLabel = label;
      }
      const label = this.switchLabel;
      for (let i = 0; i < times; i++) window.setTimeout(() => label.click(), i * gap);
    } catch {
      // Ignorar
    }
  }

  /**
   * Micro-impacto físico para interacciones de interfaz
   */
  public impact(style: 'light' | 'medium' | 'heavy' = 'light') {
    if (!this.canVibrate()) { this.tick(); return; }
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
    if (!this.canVibrate()) { this.tick(type === 'error' ? 3 : 2); return; }
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
    if (!this.canVibrate()) { this.tick(); return; }
    try {
      navigator.vibrate(6);
    } catch {
      // Ignorar
    }
  }
}

export const HapticService = new HapticServiceClass();
