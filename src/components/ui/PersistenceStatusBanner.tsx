import { useState, useSyncExternalStore } from 'react';
import { X, RotateCcw, Download } from 'lucide-react';
import {
  clearPersistenceRecovery,
  getPersistenceFailure,
  readPersistenceRecoveryBackup,
  restoreQuarantinedRecords,
  retryPendingStorageWrites,
  subscribePersistenceFailure,
} from '../../utils/idbStorage';
import { useAppStore } from '../../store/useAppStore';
import type { TaskItem } from '../../models/Task';

/** Mount once near the app root, including while the initial store is hydrating. */
export function PersistenceStatusBanner() {
  const recovery = useAppStore(state => state.persistenceRecovery);
  const failure = useSyncExternalStore(
    subscribePersistenceFailure,
    getPersistenceFailure,
    () => null
  );
  const [retrying, setRetrying] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || (!failure && !recovery)) return null;

  const dismiss = () => {
    setDismissed(true);
    clearPersistenceRecovery();
    useAppStore.setState({ persistenceRecovery: null });
  };

  const handleRestore = async () => {
    if (!recovery) return;
    setRestoring(true);
    try {
      const restoredState = await restoreQuarantinedRecords(recovery.backupKey);
      if (restoredState) {
        useAppStore.setState(prev => ({
          ...prev,
          tasks: {
            ...prev.tasks,
            ...((restoredState.tasks as Record<string, TaskItem>) || {}),
          },
          persistenceRecovery: null,
        }));
        setDismissed(true);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('show-toast', {
            detail: 'Registros recuperados y restaurados correctamente.'
          }));
        }
      }
    } finally {
      setRestoring(false);
    }
  };

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
    ? `${recovery.reason} Registros apartados: ${recovery.quarantined}.`
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
        maxWidth: 680,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '12px 16px',
        borderRadius: 14,
        color: '#7f1d1d',
        background: '#fff1f2',
        border: '1px solid #fecdd3',
        boxShadow: '0 8px 28px rgba(127, 29, 29, 0.16)',
        fontSize: 14,
      }}
    >
      <span style={{ flex: '1 1 240px', lineHeight: 1.4 }}>{message}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, maxWidth: '100%' }}>
        {recovery && (
          <>
            <button
              type="button"
              onClick={() => void handleRestore()}
              disabled={restoring}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                border: 0,
                borderRadius: 8,
                padding: '7px 11px',
                color: '#fff',
                background: '#15803d',
                fontWeight: 650,
                cursor: restoring ? 'wait' : 'pointer',
                fontSize: 13,
              }}
            >
              <RotateCcw size={14} />
              {restoring ? 'Restaurando…' : 'Restaurar registros'}
            </button>
            <button
              type="button"
              onClick={() => void downloadRecovery()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                border: 0,
                borderRadius: 8,
                padding: '7px 11px',
                color: '#fff',
                background: '#7f1d1d',
                fontWeight: 650,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              <Download size={14} />
              Descargar copia
            </button>
          </>
        )}
        {failure && (
          <button
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
              fontSize: 13,
            }}
          >
            {retrying ? 'Reintentando…' : 'Reintentar'}
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Cerrar aviso"
          title="Cerrar aviso"
          style={{
            border: 0,
            background: 'transparent',
            color: '#7f1d1d',
            cursor: 'pointer',
            padding: 6,
            borderRadius: 6,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.8,
            transition: 'opacity 0.15s ease',
          }}
        >
          <X size={18} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
