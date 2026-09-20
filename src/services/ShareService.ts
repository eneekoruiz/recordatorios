import { useAppStore } from '../store/useAppStore';
import { apiUrl, isOfflineToken, syncManager } from '../sync/syncManager';

const toast = (detail: unknown) => window.dispatchEvent(new CustomEvent('show-toast', { detail }));

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Genera (o reutiliza) un enlace público de solo lectura para una lista y lo copia/comparte. */
export async function shareList(listId: string, listName: string) {
  const { token } = useAppStore.getState();
  if (!token || isOfflineToken(token)) {
    toast('Inicia sesión para compartir listas mediante enlace.');
    return;
  }
  // Asegurar que la lista existe en la nube antes de pedir el enlace.
  await syncManager.syncNow();
  const res = await fetch(apiUrl('/api/share/generate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${useAppStore.getState().token}` },
    body: JSON.stringify({ listId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    toast(data.error || 'No se pudo generar el enlace.');
    return;
  }
  const url = `${window.location.origin}/?share=${data.token}`;
  if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ title: listName, text: `Lista «${listName}»`, url });
      return;
    } catch {
      /* cancelado: seguimos con copiar */
    }
  }
  const copied = await copyToClipboard(url);
  toast(copied ? `🔗 Enlace de «${listName}» copiado (solo lectura)` : url);
}

export async function unshareList(listId: string, listName: string) {
  const { token } = useAppStore.getState();
  if (!token || isOfflineToken(token)) return;
  const res = await fetch(apiUrl(`/api/share/list/${encodeURIComponent(listId)}`), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  toast(res.ok ? `«${listName}» ya no se comparte` : 'No se pudo revocar el enlace.');
}
