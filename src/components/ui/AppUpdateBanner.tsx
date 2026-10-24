import React, { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';

export const AppUpdateBanner: React.FC = () => {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    let registrationRef: ServiceWorkerRegistration | null = null;

    const checkWaitingWorker = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting) {
        setWaitingWorker(reg.waiting);
        setHasUpdate(true);
      }
    };

    navigator.serviceWorker.ready.then((reg) => {
      registrationRef = reg;
      checkWaitingWorker(reg);

      reg.addEventListener('updatefound', () => {
        const installingWorker = reg.installing;
        if (!installingWorker) return;

        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingWorker(installingWorker);
            setHasUpdate(true);
          }
        });
      });
    });

    // Escuchar cuando el nuevo ServiceWorker toma el control para recargar limpiamente
    let refreshing = false;
    const onControllerChange = () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    // Comprobar actualizaciones al volver a la pestaña
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && registrationRef) {
        registrationRef.update().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const handleUpdate = () => {
    setIsUpdating(true);
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  };

  if (!hasUpdate || dismissed) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 'calc(12px + env(safe-area-inset-top))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 999998,
        maxWidth: '92vw',
        width: '420px',
        background: 'var(--bg-material, rgba(28, 28, 30, 0.92))',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        color: 'var(--text-primary, #ffffff)',
        border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.15))',
        borderRadius: '16px',
        padding: '10px 14px',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        fontSize: '0.88rem',
        fontWeight: 500,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
        <RefreshCw size={17} className={isUpdating ? 'spin' : ''} style={{ color: 'var(--accent-primary, #0a84ff)', flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Nueva versión disponible
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <button
          type="button"
          onClick={handleUpdate}
          disabled={isUpdating}
          style={{
            background: 'var(--accent-primary, #0a84ff)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '9999px',
            padding: '5px 12px',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'opacity 0.2s',
            opacity: isUpdating ? 0.7 : 1,
          }}
        >
          {isUpdating ? 'Actualizando...' : 'Actualizar'}
        </button>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Cerrar aviso de actualización"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary, rgba(255,255,255,0.6))',
            padding: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={16} />
        </button>
      </div>
    </aside>
  );
};
