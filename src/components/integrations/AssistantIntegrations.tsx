import { useEffect, useRef, useState } from 'react';
import { Bot, MessageCircle } from 'lucide-react';
import { apiUrl } from '../../sync/syncManager';
import { useAppStore } from '../../store/useAppStore';
import { ChannelLink } from './ChannelLink';
import './AssistantIntegrations.css';

export function AssistantIntegrations() {
  const userId = useAppStore(state => state.userId);
  const generation = useAppStore(state => state.sessionGeneration);
  const identity = `${userId ?? 'anonymous'}:${generation}`;
  const [status, setStatus] = useState<{ identity: string; message: string; busy: boolean } | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), [identity]);
  const current = status?.identity === identity ? status : null;

  async function checkAccount() {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    const timer = window.setTimeout(() => request.abort(), 8000);
    setStatus({ identity, message: 'Comprobando la API de tu cuenta…', busy: true });
    const stillCurrent = () => {
      const state = useAppStore.getState();
      return identity === `${state.userId ?? 'anonymous'}:${state.sessionGeneration}` && controller.current === request;
    };
    try {
      const token = useAppStore.getState().token;
      if (!token || !userId) throw new Error('Inicia sesión para comprobar tu cuenta.');
      const response = await fetch(apiUrl('/api/helen/status'), { headers: { Authorization: `Bearer ${token}` }, signal: request.signal });
      if (!response.ok) throw new Error(response.status === 404
        ? 'La API de Helen aún no está desplegada en este servidor.'
        : response.status === 401 ? 'La sesión ha caducado. Vuelve a iniciar sesión.' : 'No se pudo comprobar la API. Inténtalo de nuevo.');
      const result: unknown = await response.json();
      if (!result || typeof result !== 'object' || !('accountId' in result) || result.accountId !== userId
        || !('syncAvailable' in result) || result.syncAvailable !== true) throw new Error('No se pudo verificar que la API pertenece a tu cuenta.');
      if (stillCurrent()) setStatus({ identity, message: 'API disponible para tu cuenta. Conecta Helen desde sus ajustes; esto no confirma un bot ni un Echo conectados.', busy: false });
    } catch (error) {
      if (stillCurrent()) setStatus({ identity, message: request.signal.aborted ? 'La comprobación tardó demasiado. Puedes volver a intentarlo.' : (error as Error).message, busy: false });
    } finally {
      window.clearTimeout(timer);
    }
  }

  return <section className="assistant-integrations" aria-labelledby="assistant-integrations-title">
    <h4 id="assistant-integrations-title"><Bot size={20} aria-hidden="true" /> Asistentes y mensajería</h4>
    <article>
      <h5>Helen + Alexa</h5>
      <p>Sincronización privada de tareas con tu cuenta. Alexa utiliza la conexión y los permisos de Helen.</p>
      <button type="button" onClick={() => { void checkAccount(); }} disabled={current?.busy === true}>
        {current?.busy ? 'Comprobando…' : 'Comprobar API de mi cuenta'}
      </button>
      <p role="status" className="assistant-integration-status">{current?.message ?? 'Conexión sin comprobar en esta sesión.'}</p>
      <details><summary>Conectar o desvincular Helen</summary><ol>
        <li>En el chat privado de Helen, abre Ajustes → Recordatorios.</li>
        <li>Usa la dirección de esta aplicación e inicia sesión allí con tu cuenta. Completa el segundo factor si se solicita.</li>
        <li>Para revocar el vínculo local, pulsa Desconectar Recordatorios en Helen. Las tareas se conservan.</li>
      </ol><p>El servidor de Helen debe seguir en ejecución. El Echo necesita además una skill de Alexa vinculada y probada con tu identidad.</p></details>
    </article>
    <article>
      <h5><MessageCircle size={16} aria-hidden="true" /> Telegram</h5>
      <p>Se gestiona mediante el bot de Helen; su estado no se puede verificar desde esta aplicación.</p>
      <ChannelLink key={`${identity}:telegram`} channel="telegram" />
      <details><summary>Requisitos y revocación de Telegram</summary><p>Configura en Helen el token de tu bot y la lista de identificadores autorizados. Vincula primero Helen a esta cuenta de Recordatorios. Prueba crear, consultar y completar una tarea desde tu chat privado. Para revocar el acceso, retira el identificador autorizado o detén el bot desde Helen.</p><p>No pegues tokens ni contraseñas en un chat con una IA. Los audios necesitan una transcripción configurada; no se anuncian como disponibles aquí.</p></details>
    </article>
    <article>
      <h5>WhatsApp <span>Sin configurar</span></h5>
      <p>No hay un conector de WhatsApp activo en esta aplicación.</p>
      <ChannelLink key={`${identity}:whatsapp`} channel="whatsapp" />
      <details><summary>Qué falta para usar WhatsApp</summary><p>Configurar un número y una cuenta de WhatsApp Business Platform, permisos y un webhook autenticado. Antes de activarlo hay que verificar los costes, las reglas de mensajería y la vinculación de cada usuario. Finanzas necesitará un permiso separado del acceso a tareas.</p></details>
    </article>
  </section>;
}
