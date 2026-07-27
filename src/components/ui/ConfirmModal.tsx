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
        style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.section className="premium-sheet confirm-sheet" role="alertdialog"
          ref={modalRef}
          aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description"
          initial={{ opacity: 0, y: 34, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 22, scale: 0.97 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          onClick={(event) => event.stopPropagation()}
          style={{ position: 'relative', width: '100%', maxWidth: '440px', margin: '16px', background: 'var(--bg-surface)', borderRadius: '24px', padding: '24px', paddingBottom: 'calc(16px + env(safe-area-inset-bottom))', boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }}>
          <div className={`premium-sheet-icon ${tone}`} aria-hidden="true" style={{ marginBottom: '16px' }}>
            <AlertTriangle size={24} strokeWidth={2} color={tone === 'danger' ? 'var(--accent-red)' : 'var(--accent-primary)'} />
          </div>
          <button className="premium-sheet-close" onClick={onCancel} aria-label="Cerrar" style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}><X size={20} /></button>
          <div className="premium-sheet-copy">
            <h2 id="confirm-title" style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>{title}</h2>
            <p id="confirm-description" style={{ fontSize: '0.95rem', color: 'var(--text-secondary)' }}>{message}</p>
          </div>
          <div className="premium-sheet-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '24px' }}>
            <button ref={cancelRef} className="premium-button secondary" onClick={onCancel} style={{ padding: '12px', borderRadius: '12px', background: 'var(--bg-elevated)', border: 'none', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }}>{cancelText}</button>
            <button className={`premium-button ${tone}`} onClick={onConfirm} style={{ padding: '12px', borderRadius: '12px', background: tone === 'danger' ? 'var(--accent-red)' : 'var(--accent-primary)', border: 'none', color: 'white', fontWeight: 600, cursor: 'pointer' }}>{confirmText}</button>
          </div>
        </motion.section>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
