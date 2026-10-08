import { useState, useSyncExternalStore } from 'react';
import {
  getPersistenceFailure,
  readPersistenceRecoveryBackup,
  retryPendingStorageWrites,
  subscribePersistenceFailure,
} from '../../utils/idbStorage';
import { useAppStore } from '../../store/useAppStore';

/** Mount once near the app root, including while the initial store is hydrating. */
export function PersistenceStatusBanner() {
  const recovery = useAppStore(state => state.persistenceRecovery);
  const failure = useSyncExternalStore(
    subscribePersistenceFailure,
    getPersistenceFailure,
    () => null
  );
  const [retrying, setRetrying] = useState(false);

  if (!failure && !recovery) return null;

  const retry = async () => {
    setRetrying(true);
    try {
      if (failure?.operation === 'read') {
        await useAppStore.persist.rehydrate();
      } else {
        await retryPendingStorageWrites();
      }
    } finally {
      setRetrying(false);
    }
  };

  const downloadRecovery = async () => {
    if (!recovery) return;
    const raw = await readPersistenceRecoveryBackup(recovery.backupKey);
    if (!raw || useAppStore.getState().persistenceRecovery?.backupKey !== recovery.backupKey) return;
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `recordatorios-respaldo-original-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const message = recovery
    ? `${recovery.reason} Registros apartados: ${recovery.quarantined}. Descarga la copia original para recuperarlos.`
    : failure?.operation === 'read'
      ? 'No se pudieron cargar tus datos guardados. La app esperará antes de abrirlos para protegerlos.'
      : `Los últimos cambios siguen pendientes en este dispositivo${failure && failure.pendingWrites > 1 ? ` (${failure.pendingWrites} cambios)` : ''}. Mantén esta pestaña abierta hasta que el aviso desaparezca.`;

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: 'fixed',
        zIndex: 1000000,
        insetInline: 16,
        top: 12,
        marginInline: 'auto',
        maxWidth: 640,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 12,
        color: '#7f1d1d',
        background: '#fff1f2',
        border: '1px solid #fecdd3',
        boxShadow: '0 8px 28px rgba(127, 29, 29, 0.18)',
        fontSize: 14,
      }}
    >
      <span style={{ flex: '1 1 240px' }}>{message}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxWidth: '100%' }}>
      {recovery && <button
        type="button"
        onClick={() => void downloadRecovery()}
        style={{
          border: 0,
          borderRadius: 8,
          padding: '7px 11px',
          color: '#fff',
          background: '#7f1d1d',
          fontWeight: 650,
          cursor: 'pointer',
        }}
      >Descargar copia original</button>}
      {failure && <button
        type="button"
        onClick={retry}
        disabled={retrying}
        style={{
          flexShrink: 0,
          border: 0,
          borderRadius: 8,
          padding: '7px 11px',
          color: '#fff',
          background: '#b91c1c',
          fontWeight: 650,
          cursor: retrying ? 'wait' : 'pointer',
        }}
      >
        {retrying ? 'Reintentando…' : 'Reintentar'}
      </button>}
      </div>
    </div>
  );
}
