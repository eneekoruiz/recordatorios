// Sustituto accesible y con estilo propio de window.confirm(), utilizable desde cualquier parte:
//   if (await confirmDialog({ title: 'Eliminar', message: '...' })) { ... }

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: 'danger' | 'accent';
}

export interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export const CONFIRM_EVENT = 'app-confirm-request';

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent<PendingConfirm>(CONFIRM_EVENT, { detail: { ...options, resolve } }));
  });
}

/** Muestra un aviso breve no bloqueante (sustituye a window.alert). */
export function notify(message: string) {
  window.dispatchEvent(new CustomEvent('show-toast', { detail: message }));
}
