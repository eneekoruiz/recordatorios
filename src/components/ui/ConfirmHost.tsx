import { useEffect, useState } from 'react';
import { ConfirmModal } from './ConfirmModal';
import { CONFIRM_EVENT, type PendingConfirm } from './confirmDialog';

// Muestra los diálogos que pide confirmDialog() desde cualquier parte de la app.
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
    window.addEventListener(CONFIRM_EVENT, handler);
    return () => window.removeEventListener(CONFIRM_EVENT, handler);
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
