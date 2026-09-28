import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
      <motion.div className="premium-overlay" role="presentation"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }} onClick={onCancel}
      >
        <motion.section className="premium-sheet confirm-sheet" role="alertdialog"
          ref={modalRef}
          aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description"
          initial={{ opacity: 0, y: 26, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          onClick={(event) => event.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
            <div
              className="modal-hero-badge"
              aria-hidden="true"
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: tone === 'danger' ? 'rgba(255, 59, 48, 0.12)' : 'var(--accent-glow)',
                border: tone === 'danger' ? '1px solid rgba(255, 59, 48, 0.2)' : '1px solid var(--border-subtle)',
                marginBottom: 0
              }}
            >
              <AlertTriangle size={24} strokeWidth={2.2} color={tone === 'danger' ? 'var(--accent-red)' : 'var(--accent-primary)'} />
            </div>
            <button className="modal-close-btn" onClick={onCancel} aria-label="Cerrar">
              <X size={16} strokeWidth={2.4} />
            </button>
          </div>
          
          <div className="premium-sheet-copy">
            <h2 id="confirm-title" style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{title}</h2>
            <p id="confirm-description" style={{ fontSize: '0.94rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>{message}</p>
          </div>

          <div className="premium-sheet-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 24 }}>
            <button ref={cancelRef} type="button" className="modal-btn-secondary secondary" onClick={onCancel}>{cancelText}</button>
            <button type="button" className={tone === 'danger' ? 'modal-btn-danger danger' : 'modal-btn-primary'} onClick={onConfirm}>{confirmText}</button>
          </div>
        </motion.section>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
