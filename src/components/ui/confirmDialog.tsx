import { useEffect, useState } from 'react';
import { ConfirmModal } from './ConfirmModal';

// Sustituto accesible y con estilo propio de window.confirm(), utilizable desde cualquier parte:
//   if (await confirmDialog({ title: 'Eliminar', message: '...' })) { ... }

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: 'danger' | 'accent';
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

const EVENT = 'app-confirm-request';

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent<PendingConfirm>(EVENT, { detail: { ...options, resolve } }));
  });
}

/** Muestra un aviso breve no bloqueante (sustituye a window.alert). */
export function notify(message: string) {
  window.dispatchEvent(new CustomEvent('show-toast', { detail: message }));
}

export function ConfirmHost() {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<PendingConfirm>).detail;
      setPending((current) => {
        current?.resolve(false);
        return detail;
      });
    };
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);

  const close = (value: boolean) => {
    pending?.resolve(value);
    setPending(null);
  };

  return (
    <ConfirmModal
      isOpen={!!pending}
      title={pending?.title || ''}
      message={pending?.message || ''}
      confirmText={pending?.confirmText}
      cancelText={pending?.cancelText}
      tone={pending?.tone}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );
}
