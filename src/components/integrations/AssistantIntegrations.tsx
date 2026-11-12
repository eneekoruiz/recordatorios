import { useEffect, useRef, useState } from 'react';
import { Bot, MessageCircle, Cpu, Sparkles } from 'lucide-react';
import { apiUrl } from '../../sync/syncManager';
import { useAppStore } from '../../store/useAppStore';
import { ChannelLink } from './ChannelLink';
import './AssistantIntegrations.css';

export function AssistantIntegrations() {
  const userId = useAppStore(state => state.userId);
  const generation = useAppStore(state => state.sessionGeneration);
  const identity = `${userId ?? 'anonymous'}:${generation}`;
  const [status, setStatus] = useState<{ identity: string; message: string; busy: boolean } | null>(null);
  const [automationsMessage, setAutomationsMessage] = useState<string | null>(null);
  const [loadingAutomations, setLoadingAutomations] = useState(false);
  const [syncingTasks, setSyncingTasks] = useState(false);
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

  async function checkAutomationsStatus() {
    const token = useAppStore.getState().token;
    if (!token || !userId) {
      setAutomationsMessage('Inicia sesión para consultar el catálogo.');
      return;
    }
    setLoadingAutomations(true);
    setAutomationsMessage('Consultando el catálogo…');
    try {
      const res = await fetch(apiUrl('/api/automations'), {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) throw new Error('No se pudo consultar el catálogo.');
      const data = await res.json();
      if (data.verification !== 'catalog-only' || !Array.isArray(data.automations)) {
        throw new Error('El servidor devolvió un catálogo no válido.');
      }
      setAutomationsMessage(`${data.automations.length} automatizaciones en el catálogo. Estado de ejecución y avisos pendientes de verificar.`);
    } catch {
      setAutomationsMessage('No se pudo consultar el catálogo.');
    } finally {
      setLoadingAutomations(false);
    }
  }

  function syncAutomationsToTasks() {
    setSyncingTasks(true);
    try {
      const state = useAppStore.getState();
      const existing = Object.values(state.tasks || {});
      const now = new Date();
      const currentIso = now.toISOString();

      const templates = [
        {
          key: 'egela',
          title: 'Sincronizar eGela y volcar apuntes a Google Drive',
          description: 'Automatización periódica Antigravity (Lunes 05:00). Descarga moodle-dl y convierte enlaces a PDF.',
          canAiExecute: true,
          status: 'pending' as const,
          priority: 'medium' as const
        },
        {
          key: 'icloud',
          title: 'Revisar y clasificar fotos nuevas de iCloud',
          description: 'Automatización periódica Antigravity (Domingos 03:00). Smart Gallery triaje y reconciliación por IA.',
          canAiExecute: true,
          status: 'pending' as const,
          priority: 'low' as const
        },
        {
          key: 'temp',
          title: 'Limpiar archivos temporales y descargas obsoletas',
          description: 'Automatización periódica Antigravity (Día 1 de mes 04:00). Clean temp safe y mantenimiento Downloads.',
          canAiExecute: true,
          status: 'pending' as const,
          priority: 'low' as const
        }
      ];

      const toAdd = templates.filter(tmpl =>
        !existing.some(t => t && !t.deleted_at && t.title.toLowerCase().includes(tmpl.key))
      ).map(tmpl => ({
        title: tmpl.title,
        description: tmpl.description,
        canAiExecute: tmpl.canAiExecute,
        status: tmpl.status,
        priority: tmpl.priority,
        created_at: currentIso,
        updated_at: currentIso,
        type: 'task' as const,
        version: 1
      }));

      if (toAdd.length > 0) {
        state.addTasksBatch(toAdd);
        setAutomationsMessage(`Se han añadido ${toAdd.length} tareas a Recordatorios.`);
        window.dispatchEvent(new CustomEvent('show-toast', {
          detail: `${toAdd.length} tareas añadidas a Recordatorios`
        }));
      } else {
        setAutomationsMessage('Las tareas de automatización ya existen en tu lista de Recordatorios.');
        window.dispatchEvent(new CustomEvent('show-toast', {
          detail: 'Las tareas ya se encuentran enlazadas en Recordatorios'
        }));
      }
    } finally {
      setSyncingTasks(false);
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
    <article className="antigravity-automations">
      <h5><Cpu size={16} aria-hidden="true" /> Automatizaciones de Antigravity</h5>
      <p>Catálogo de tareas y horarios previstos. Consulta el ejecutor para confirmar su estado.</p>
      <div className="automations-summary-chips">
        <span className="automation-chip">🎓 eGela (Lunes 05:00)</span>
        <span className="automation-chip">📸 Fotos iCloud (Domingos 03:00)</span>
        <span className="automation-chip">🧹 Temporales & Descargas (Mensual)</span>
        <span className="automation-chip">⚡ Cuotas y batería</span>
      </div>
      <div className="automation-actions">
        <button
          type="button"
          onClick={syncAutomationsToTasks}
          disabled={syncingTasks}
          title="Añade las tareas del catálogo a Recordatorios"
        >
          <Sparkles size={14} style={{ marginRight: 6, display: 'inline', verticalAlign: '-2px' }} />
          {syncingTasks ? 'Sincronizando tareas…' : 'Añadir tareas a Recordatorios'}
        </button>
        <button
          type="button"
          onClick={() => void checkAutomationsStatus()}
          disabled={loadingAutomations}
          title="Consultar el catálogo de automatizaciones"
        >
          {loadingAutomations ? 'Consultando…' : 'Consultar catálogo'}
        </button>
      </div>
      {automationsMessage && (
        <p role="status" className="assistant-integration-status antigravity-feedback" style={{ marginTop: 8 }}>
          {automationsMessage}
        </p>
      )}
      <details>
        <summary>Tareas previstas y requisitos de ntfy</summary>
        <ol>
          <li><strong>eGela Moodle</strong>: Descarga apuntes con moodle-dl, convierte a PDF y guarda en Google Drive. Notifica resumen por ntfy.</li>
          <li><strong>Fotos iCloud (Smart Gallery)</strong>: Clasifica y reconcilia fotos revisadas con IA, organizando álbumes canónicos.</li>
          <li><strong>Mantenimiento</strong>: Elimina archivos temporales &gt;24 h y audita descargas obsoletas (&gt;30 días).</li>
          <li><strong>Control móvil</strong>: Envía /estado o /pantalla por ntfy para consultar recursos o pausar sesiones remotamente.</li>
        </ol>
      </details>
    </article>
  </section>;
}
