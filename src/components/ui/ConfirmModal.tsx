import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: 'danger' | 'accent';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen, title, message, confirmText = 'Confirmar', cancelText = 'Cancelar',
  tone = 'danger', onConfirm, onCancel
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => cancelRef.current?.focus(), 80);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onCancel]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="premium-overlay" role="presentation"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }} onClick={onCancel}>
          <motion.section className="premium-sheet confirm-sheet" role="alertdialog"
            aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description"
            initial={{ opacity: 0, y: 34, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 22, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 430, damping: 34, mass: 0.82 }}
            onClick={(event) => event.stopPropagation()}>
            <div className={`premium-sheet-icon ${tone}`} aria-hidden="true">
              <AlertTriangle size={22} strokeWidth={2.2} />
            </div>
            <button className="premium-sheet-close" onClick={onCancel} aria-label="Cerrar"><X size={18} /></button>
            <div className="premium-sheet-copy">
              <h2 id="confirm-title">{title}</h2>
              <p id="confirm-description">{message}</p>
            </div>
            <div className="premium-sheet-actions">
              <button ref={cancelRef} className="premium-button secondary" onClick={onCancel}>{cancelText}</button>
              <button className={`premium-button ${tone}`} onClick={() => { navigator.vibrate?.(35); onConfirm(); }}>
                {confirmText}
              </button>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
