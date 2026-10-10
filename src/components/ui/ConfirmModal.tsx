import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

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
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => cancelRef.current?.focus(), 80);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
        return;
      }
      
      if (event.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length > 0) {
          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];

          if (event.shiftKey) {
            if (document.activeElement === firstElement) {
              lastElement.focus();
              event.preventDefault();
            }
          } else {
            if (document.activeElement === lastElement) {
              firstElement.focus();
              event.preventDefault();
            }
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div className="premium-overlay alert-overlay" role="presentation"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }} onClick={onCancel}
      >
        {/* Alerta al estilo de iOS: centrada, compacta, sin «×» (ya está «Cancelar») y con los
            botones de texto separados por líneas de pelo; la acción destructiva, en rojo. */}
        <motion.section className="app-alert" role="alertdialog"
          ref={modalRef}
          aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description"
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="app-alert-copy">
            <h2 id="confirm-title" style={{ letterSpacing: '-0.025em', textWrap: 'balance' }}>{title}</h2>
            <p id="confirm-description" style={{ textWrap: 'pretty' }}>{message}</p>
          </div>
          <div className="app-alert-actions premium-sheet-actions">
            <button ref={cancelRef} type="button" className="secondary" onClick={onCancel}>{cancelText}</button>
            <button type="button" className={tone === 'danger' ? 'danger' : 'is-preferred'} onClick={onConfirm}>{confirmText}</button>
          </div>
        </motion.section>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
