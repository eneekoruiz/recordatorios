// Avisos con la app cerrada (Web Push). El servidor manda un resumen al día y las
// alertas con hora; aquí solo se pide permiso y se registra este dispositivo.
import { apiUrl } from '../sync/syncManager';
import { useAppStore } from '../store/useAppStore';

export type PushStatus = 'unsupported' | 'denied' | 'off' | 'on';

const DIGEST_HOUR = 9;

function isSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function base64UrlToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob((base64Url + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function weeklyDay(): number {
  try {
    const stored = localStorage.getItem('weekly_tasks_day');
    const day = stored === null ? 6 : Number(stored);
    return Number.isInteger(day) && day >= 0 && day <= 6 ? day : 6;
  } catch {
    return 6;
  }
}

function authHeaders(): Record<string, string> {
  const token = useAppStore.getState().token;
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export const PushService = {
  async status(): Promise<PushStatus> {
    if (!isSupported()) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      return subscription ? 'on' : 'off';
    } catch {
      return 'off';
    }
  },

  /** Pide permiso y registra el dispositivo. Devuelve un motivo legible si no se puede. */
  async enable(): Promise<{ ok: true } | { ok: false; reason: string }> {
    if (!isSupported()) {
      return { ok: false, reason: 'Este navegador no admite avisos. En iPhone, añade la app a la pantalla de inicio y ábrela desde ahí.' };
    }
    if (!useAppStore.getState().token) return { ok: false, reason: 'Inicia sesión para recibir avisos con la app cerrada.' };
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { ok: false, reason: 'Las notificaciones están bloqueadas. Actívalas en los ajustes del navegador.' };
    }
    try {
      const keyResponse = await fetch(apiUrl('/api/push/public-key'));
      if (!keyResponse.ok) return { ok: false, reason: 'Los avisos todavía no están activados en el servidor.' };
      const { publicKey } = await keyResponse.json();
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) }));
      const response = await fetch(apiUrl('/api/push/subscribe'), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          digestHour: DIGEST_HOUR,
          weeklyDay: weeklyDay(),
        }),
      });
      if (!response.ok) return { ok: false, reason: 'No se pudieron activar los avisos. Inténtalo de nuevo.' };
      return { ok: true };
    } catch {
      return { ok: false, reason: 'No se pudieron activar los avisos. Revisa la conexión e inténtalo de nuevo.' };
    }
  },

  async disable(): Promise<void> {
    if (!isSupported()) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    await fetch(apiUrl('/api/push/unsubscribe'), {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => undefined);
    await subscription.unsubscribe().catch(() => undefined);
  },
};
