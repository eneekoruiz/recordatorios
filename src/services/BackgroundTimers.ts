import { useSyncExternalStore } from 'react';
import { NotificationService } from './NotificationService';
import { SoundService } from './SoundService';
import { HapticService } from './HapticService';

/**
 * Tareas que siguen solas mientras tú haces otra (lavadora, horno, mascarilla…).
 *
 * Se guardan con su hora de FIN absoluta, no con una cuenta atrás: así el tiempo es correcto aunque el
 * navegador congele la página (pestaña en segundo plano, móvil bloqueado) y sobreviven a cerrar el modo
 * secuencia o la app. Una PWA no puede ejecutar código con la app cerrada; lo que sí hace es avisar en
 * cuanto vuelve a ejecutarse (o con una notificación si el sistema la mantiene viva) y, al abrirla,
 * poner al día lo que terminó mientras tanto. Lo terminado se queda a la vista hasta que se da por visto.
 */
export interface BackgroundTimer {
  id: string;
  title: string;
  startedAt: number;
  endsAt: number;
  /** Ya se avisó de que terminó. */
  done?: boolean;
}

const KEY = 'background_timers_v1';
let timers: BackgroundTimer[] = [];
const listeners = new Set<() => void>();
let ticker: number | null = null;

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (Array.isArray(raw)) {
      timers = raw.filter((t) => t && typeof t.id === 'string' && typeof t.endsAt === 'number');
    }
  } catch { timers = []; }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(timers)); } catch { /* sin almacenamiento: sigue en memoria */ }
}
function emit() {
  timers = [...timers];
  save();
  listeners.forEach((l) => l());
}

/** Marca lo que ya terminó, avisa una vez y deja de latir cuando no queda nada en marcha. */
function tick() {
  const now = Date.now();
  let changed = false;
  for (const t of timers) {
    if (!t.done && t.endsAt <= now) {
      t.done = true;
      changed = true;
      SoundService.playComplete();
      HapticService.notification('success');
      NotificationService.getInstance().show(`«${t.title}» ha terminado`, {
        body: 'Ya puedes volver a ella.',
        icon: '/icons/icon-192.png',
        tag: `background-${t.id}`,
      });
      window.dispatchEvent(new CustomEvent('show-toast', { detail: `«${t.title}» ha terminado` }));
    }
  }
  if (changed) emit();
  if (!timers.some((t) => !t.done) && ticker !== null) {
    window.clearInterval(ticker);
    ticker = null;
  }
}
function ensureTicker() {
  if (typeof window === 'undefined') return;
  if (ticker === null && timers.some((t) => !t.done)) ticker = window.setInterval(tick, 1000);
}

if (typeof window !== 'undefined') {
  load();
  ensureTicker();
  // Al volver a la app se pone al día al instante (los temporizadores se congelan con la pantalla apagada).
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); ensureTicker(); } });
  window.addEventListener('focus', () => { tick(); ensureTicker(); });
  tick();
}

export const BackgroundTimers = {
  start(id: string, title: string, seconds: number) {
    const now = Date.now();
    timers = [...timers.filter((t) => t.id !== id), { id, title, startedAt: now, endsAt: now + seconds * 1000 }];
    emit();
    ensureTicker();
    // Pedir permiso de avisos justo al poner en marcha (hay un gesto del usuario y se entiende para qué).
    void NotificationService.getInstance().requestPermissions();
  },
  finish(id: string) {
    timers = timers.filter((t) => t.id !== id);
    emit();
  },
  list: () => timers,
};

const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
export const useBackgroundTimers = () => useSyncExternalStore(subscribe, () => timers, () => timers);
