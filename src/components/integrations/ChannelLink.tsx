import { useEffect, useRef, useState } from 'react';
import { apiUrl } from '../../sync/syncManager';
import { useAppStore } from '../../store/useAppStore';

export function ChannelLink({ channel }: { channel: 'telegram' | 'whatsapp' }) {
  const userId = useAppStore(state => state.userId);
  const generation = useAppStore(state => state.sessionGeneration);
  const identity = `${userId}:${generation}`;
  const [state, setState] = useState<{ configured: boolean; linked: boolean } | null>(null);
  const [challenge, setChallenge] = useState<{ code: string; expiresAt: string } | null>(null);
  const [message, setMessage] = useState('Vínculo con esta cuenta sin comprobar.');
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const name = channel === 'telegram' ? 'Telegram' : 'WhatsApp';
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!challenge) return;
    const timer = window.setTimeout(() => {
      setChallenge(null);
      setMessage('El código ha caducado. Genera otro para vincular tu cuenta.');
    }, Math.max(0, Date.parse(challenge.expiresAt) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [challenge]);

  async function act(action: 'status' | 'create' | 'revoke') {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    const timer = window.setTimeout(() => request.abort(), 8000);
    const current = () => {
      const store = useAppStore.getState();
      return !request.signal.aborted && identity === `${store.userId}:${store.sessionGeneration}` && controller.current === request;
    };
    setBusy(true);
    setMessage(action === 'revoke' ? 'Revocando el vínculo…' : 'Consultando el servidor…');
    try {
      const token = useAppStore.getState().token;
      if (!token || !userId) throw new Error('Inicia sesión para gestionar el vínculo.');
      const path = action === 'status' ? '/api/channels' : `/api/channels/${channel}${action === 'create' ? '/link' : ''}`;
      const response = await fetch(apiUrl(path), { method: action === 'status' ? 'GET' : action === 'create' ? 'POST' : 'DELETE', headers: { Authorization: `Bearer ${token}` }, signal: request.signal });
      if (!response.ok) throw new Error(response.status === 401 ? 'La sesión ha caducado. Vuelve a iniciar sesión.' : response.status === 503 ? 'El puente no está configurado o no está disponible. Revísalo en el servidor de Helen.' : 'No se pudo completar la operación. Comprueba el vínculo antes de volver a intentarlo.');
      if (action === 'revoke') {
        if (response.status !== 204) throw new Error('No se pudo confirmar la revocación. Comprueba el vínculo.');
        if (current()) { setChallenge(null); setState(previous => previous && { ...previous, linked: false }); setMessage('Vínculo revocado. Las tareas se conservan.'); }
      } else {
        const result = await response.json();
        if (action === 'status') {
          const found = Array.isArray(result?.channels) ? result.channels.find((item: { channel?: string } | null) => item?.channel === channel) : undefined;
          if (result?.accountId !== userId || typeof found?.bridgeConfigured !== 'boolean' || typeof found?.linked !== 'boolean') throw new Error('El servidor no confirmó el vínculo de tu cuenta.');
          if (current()) { setState({ configured: found.bridgeConfigured, linked: found.linked }); if (found.linked) setChallenge(null); setMessage(!found.bridgeConfigured ? 'Puente sin configurar. No hay un canal externo disponible.' : found.linked ? 'Vínculo guardado para tu cuenta. El funcionamiento externo todavía no está verificado.' : 'Puente preparado; esta cuenta todavía no está vinculada.'); }
        } else {
          if (!/^[a-f0-9]{64}$/.test(result?.code) || !Number.isFinite(Date.parse(result?.expiresAt)) || Date.parse(result.expiresAt) <= Date.now() || Date.parse(result.expiresAt) > Date.now() + 11 * 60_000) throw new Error('El servidor no devolvió un código temporal válido. Comprueba el vínculo.');
          if (current()) { setChallenge(result); setState({ configured: true, linked: false }); setMessage('Código de un solo uso. El vínculo anterior ha sido revocado.'); }
        }
      }
    } catch (error) {
      const store = useAppStore.getState();
      if (identity === `${store.userId}:${store.sessionGeneration}` && controller.current === request) {
        setChallenge(null);
        setMessage(request.signal.aborted ? 'La operación tardó demasiado. Comprueba el vínculo antes de repetirla.' : (error as Error).message);
      }
    } finally { window.clearTimeout(timer); if (controller.current === request) setBusy(false); }
  }

  return <div className="channel-link" role="group" aria-label={`Vínculo de ${name}`}>
    <div className="channel-link-actions">
      <button type="button" disabled={busy} onClick={() => { void act('status'); }}>Comprobar vínculo de {name}</button>
      {state?.configured && channel === 'telegram' && <button type="button" disabled={busy} onClick={() => { void act('create'); }}>{challenge ? 'Generar otro código' : 'Crear código de vinculación'}</button>}
      {(state?.linked || challenge) && <button type="button" disabled={busy} onClick={() => { void act('revoke'); }}>Revocar vínculo de {name}</button>}
    </div>
    <p aria-live="polite" className="assistant-integration-status">{message}</p>
    {channel === 'whatsapp' && <p>La recepción de WhatsApp sigue pendiente. Aquí puedes consultar o revocar un vínculo guardado.</p>}
    {challenge && <div className="channel-link-code">
      <label>Comando para el chat privado de Helen en {name}
        <textarea readOnly rows={5} value={`/recordatorios vincular ${challenge.code}`} onFocus={event => event.currentTarget.select()} />
      </label>
      <p>Válido hasta las {new Date(challenge.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Copia el comando y envíalo solo a tu bot privado. No lo compartas. Después, comprueba el vínculo.</p>
    </div>}
  </div>;
}
