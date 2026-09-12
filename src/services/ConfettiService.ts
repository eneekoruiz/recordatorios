/**
 * ConfettiService.ts
 * Motor nativo de confeti estilo Apple (Canvas 60fps, cero dependencias externas).
 * Diseñado para micro-interacciones de logro, finalización de rachas y celebraciones.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  wobble: number;
  wobbleSpeed: number;
  alpha: number;
  shape: 'rect' | 'circle';
}

const APPLE_CONFETTI_COLORS = [
  '#FF2D55', // Apple Pink
  '#FF9500', // Apple Orange
  '#FFCC00', // Apple Yellow
  '#34C759', // Apple Green
  '#007AFF', // Apple Blue
  '#5856D6', // Apple Purple
  '#AF52DE', // Apple Indigo
  '#5AC8FA'  // Apple Teal
];

export class ConfettiService {
  private static activeAnimationId: number | null = null;
  private static canvas: HTMLCanvasElement | null = null;
  private static ctx: CanvasRenderingContext2D | null = null;
  private static particles: Particle[] = [];

  private static getOrCreateCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
    if (typeof window === 'undefined' || typeof document === 'undefined') return null;

    if (!this.canvas) {
      const existing = document.getElementById('apple-confetti-canvas') as HTMLCanvasElement;
      if (existing) {
        this.canvas = existing;
      } else {
        const c = document.createElement('canvas');
        c.id = 'apple-confetti-canvas';
        c.style.position = 'fixed';
        c.style.inset = '0';
        c.style.width = '100vw';
        c.style.height = '100vh';
        c.style.pointerEvents = 'none';
        c.style.zIndex = '999999';
        document.body.appendChild(c);
        this.canvas = c;
      }
    }

    this.canvas.width = window.innerWidth * window.devicePixelRatio;
    this.canvas.height = window.innerHeight * window.devicePixelRatio;

    if (!this.ctx) {
      this.ctx = this.canvas.getContext('2d');
    }

    if (!this.ctx) return null;
    return { canvas: this.canvas, ctx: this.ctx };
  }

  /**
   * Dispara una ráfaga sutil y elegante de confeti.
   * @param options.count Número de confetis (por defecto 45)
   * @param options.origin Coordenadas relativas 0..1 (por defecto centro-inferior)
   */
  public static fire(options: { count?: number; origin?: { x?: number; y?: number } } = {}): void {
    const setup = this.getOrCreateCanvas();
    if (!setup) return;

    const count = options.count ?? 50;
    const originX = (options.origin?.x ?? 0.5) * window.innerWidth * window.devicePixelRatio;
    const originY = (options.origin?.y ?? 0.65) * window.innerHeight * window.devicePixelRatio;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.8;
      const speed = Math.random() * 9 + 4;
      const vy = Math.sin(angle) * speed - Math.random() * 4 - 3;
      const vx = Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1) * 0.8;

      this.particles.push({
        x: originX,
        y: originY,
        vx,
        vy,
        size: Math.random() * 7 + 5,
        color: APPLE_CONFETTI_COLORS[Math.floor(Math.random() * APPLE_CONFETTI_COLORS.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 8,
        wobble: Math.random() * 10,
        wobbleSpeed: Math.random() * 0.1 + 0.05,
        alpha: 1,
        shape: Math.random() > 0.35 ? 'rect' : 'circle'
      });
    }

    if (this.activeAnimationId === null) {
      this.animate();
    }
  }

  public static celebrate(): void {
    this.fire({ count: 65, origin: { x: 0.5, y: 0.6 } });
  }

  private static animate = (): void => {
    if (!this.ctx || !this.canvas) {
      this.activeAnimationId = null;
      return;
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const gravity = 0.22;
    const drag = 0.985;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.vy += gravity;
      p.vx *= drag;
      p.vy *= drag;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;
      p.wobble += p.wobbleSpeed;
      p.alpha -= 0.012;

      if (p.alpha <= 0 || p.y > this.canvas.height) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, p.alpha);
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate((p.rotation * Math.PI) / 180);
      this.ctx.fillStyle = p.color;

      const scaleX = Math.cos(p.wobble);

      if (p.shape === 'rect') {
        this.ctx.fillRect(-p.size / 2, (-p.size * scaleX) / 2, p.size, p.size * scaleX * 1.5);
      } else {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, (p.size * Math.abs(scaleX)) / 2, 0, Math.PI * 2);
        this.ctx.fill();
      }

      this.ctx.restore();
    }

    if (this.particles.length > 0) {
      this.activeAnimationId = requestAnimationFrame(this.animate);
    } else {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.activeAnimationId = null;
    }
  };
}
