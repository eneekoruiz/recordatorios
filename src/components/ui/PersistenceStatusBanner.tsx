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
        padding: '14px 18px',
        borderRadius: 18,
        color: 'var(--text-primary, #1c1c1e)',
        background: 'var(--bg-surface-glass, rgba(255, 255, 255, 0.85))',
        backdropFilter: 'blur(30px) saturate(180%)',
        WebkitBackdropFilter: 'blur(30px) saturate(180%)',
        border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.04)',
        fontSize: '0.9rem',
        fontWeight: 500
      }}
    >
      <span style={{ flex: '1 1 240px', lineHeight: 1.4, textWrap: 'pretty', color: 'var(--accent-red, #ff3b30)', fontWeight: 600 }}>{message}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, maxWidth: '100%' }}>
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
                borderRadius: 14,
                padding: '10px 14px',
                minHeight: 44,
                color: 'var(--text-primary, #1c1c1e)',
                background: 'var(--bg-secondary, rgba(0,0,0,0.05))',
                fontWeight: 650,
                cursor: restoring ? 'wait' : 'pointer',
                fontSize: '0.85rem',
                transition: 'background-color 0.15s ease'
              }}
            >
              <RotateCcw size={14} />
              {restoring ? 'Restaurando…' : 'Restaurar'}
            </button>
            <button
              type="button"
              onClick={() => void downloadRecovery()}
              aria-label="Descargar copia original"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                border: 0,
                borderRadius: 14,
                padding: '10px 14px',
                minHeight: 44,
                color: 'var(--accent-primary, #007aff)',
                background: 'rgba(0, 122, 255, 0.12)',
                fontWeight: 650,
                cursor: 'pointer',
                fontSize: '0.85rem',
                transition: 'background-color 0.15s ease'
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
              borderRadius: 14,
              padding: '10px 14px',
              minHeight: 44,
              color: 'var(--accent-primary, #007aff)',
              background: 'rgba(0, 122, 255, 0.12)',
              fontWeight: 650,
              cursor: retrying ? 'wait' : 'pointer',
              fontSize: '0.85rem',
              transition: 'background-color 0.15s ease'
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
            color: 'var(--text-tertiary, #c7c7cc)',
            cursor: 'pointer',
            padding: 12,
            minWidth: 44,
            minHeight: 44,
            borderRadius: 22,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.15s ease'
          }}
        >
          <X size={18} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}
