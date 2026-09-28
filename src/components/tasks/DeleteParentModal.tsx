import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, CornerDownRight, X } from 'lucide-react';

interface DeleteParentModalProps {
  isOpen: boolean;
  parentTitle: string;
  childCount: number;
  isPermanent?: boolean;
  onDeleteAll: () => void;
  onKeepSubtasks: () => void;
  onCancel: () => void;
}

export function DeleteParentModal({
  isOpen,
  parentTitle,
  childCount,
  isPermanent = false,
  onDeleteAll,
  onKeepSubtasks,
  onCancel
}: DeleteParentModalProps) {
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
      <motion.div
        className="premium-overlay"
        role="presentation"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onCancel}
      >
        <motion.section
          className="premium-sheet"
          role="alertdialog"
          ref={modalRef}
          aria-modal="true"
          aria-labelledby="delete-parent-title"
          aria-describedby="delete-parent-description"
          initial={{ opacity: 0, y: 26, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
            <div
              className="modal-hero-badge"
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255, 59, 48, 0.12)',
                border: '1px solid rgba(255, 59, 48, 0.2)',
                marginBottom: 0
              }}
              aria-hidden="true"
            >
              <AlertTriangle size={24} strokeWidth={2.2} color="var(--accent-red)" />
            </div>

            <button
              className="modal-close-btn"
              onClick={onCancel}
              aria-label="Cerrar"
            >
              <X size={16} strokeWidth={2.4} />
            </button>
          </div>

          <h2
            id="delete-parent-title"
            style={{
              fontSize: '1.25rem',
              fontWeight: 700,
              margin: '0 0 8px 0',
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)'
            }}
          >
            {isPermanent ? 'Eliminar definitivamente' : 'Eliminar recordatorio con subtareas'}
          </h2>

          <p
            id="delete-parent-description"
            style={{
              fontSize: '0.94rem',
              lineHeight: '1.5',
              color: 'var(--text-secondary)',
              margin: '0 0 20px 0'
            }}
          >
            <strong>&quot;{parentTitle || 'Este recordatorio'}&quot;</strong> contiene{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {childCount} {childCount === 1 ? 'subtarea' : 'subtareas'}
            </strong>
            . ¿Qué deseas hacer con las subtareas?
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Opción 1: Eliminar todo */}
            <button
              type="button"
              onClick={onDeleteAll}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                borderRadius: 16,
                background: 'rgba(255, 59, 48, 0.1)',
                border: '1px solid rgba(255, 59, 48, 0.22)',
                color: 'var(--accent-red, #ff453a)',
                fontSize: '0.94rem',
                fontWeight: 650,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.18s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 59, 48, 0.16)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 59, 48, 0.1)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <Trash2 size={18} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div>Eliminar todo</div>
                <div style={{ fontSize: '0.78rem', fontWeight: 400, opacity: 0.85, marginTop: 2 }}>
                  {isPermanent
                    ? 'Borrará permanentemente el recordatorio y sus subtareas'
                    : 'Moverá el recordatorio y todas sus subtareas a la papelera'}
                </div>
              </div>
            </button>

            {/* Opción 2: Conservar subtareas (anular sangrado) */}
            <button
              type="button"
              onClick={onKeepSubtasks}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                borderRadius: 16,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: '0.94rem',
                fontWeight: 650,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.18s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-hover)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-elevated)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <CornerDownRight size={18} style={{ flexShrink: 0, color: 'var(--accent-primary, #0a84ff)' }} />
              <div style={{ flex: 1 }}>
                <div>Conservar subtareas</div>
                <div style={{ fontSize: '0.78rem', fontWeight: 400, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Anula el sangrado en su misma posición y elimina solo la tarea principal
                </div>
              </div>
            </button>

            {/* Opción 3: Cancelar */}
            <button
              ref={cancelRef}
              type="button"
              className="modal-btn-secondary"
              onClick={onCancel}
              style={{ marginTop: 6, width: '100%' }}
            >
              Cancelar
            </button>
          </div>
        </motion.section>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
