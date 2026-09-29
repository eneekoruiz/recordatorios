import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

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

  const subtareas = `${childCount} ${childCount === 1 ? 'subtarea' : 'subtareas'}`;
  return createPortal(
    <AnimatePresence>
      <motion.div
        className="premium-overlay alert-overlay"
        role="presentation"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onCancel}
      >
        {/* Alerta de iOS con tres opciones apiladas: la destructiva en rojo y «Cancelar» en negrita. */}
        <motion.section
          className="app-alert"
          role="alertdialog"
          ref={modalRef}
          aria-modal="true"
          aria-labelledby="delete-parent-title"
          aria-describedby="delete-parent-description"
          initial={{ opacity: 0, scale: 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="app-alert-copy">
            <h2 id="delete-parent-title">
              {isPermanent ? `¿Eliminar definitivamente «${parentTitle || 'este recordatorio'}»?` : `¿Eliminar «${parentTitle || 'este recordatorio'}»?`}
            </h2>
            <p id="delete-parent-description">
              {childCount === 1
                ? 'Tiene 1 subtarea. Puedes eliminarla con él o conservarla como recordatorio suelto en el mismo sitio.'
                : `Tiene ${subtareas}. Puedes eliminarlas con él o conservarlas como recordatorios sueltos en el mismo sitio.`}
            </p>
          </div>
          <div className="app-alert-actions is-stacked">
            <button type="button" className="danger" onClick={onDeleteAll}>
              {isPermanent ? 'Eliminar todo definitivamente' : childCount === 1 ? 'Eliminar con su subtarea' : `Eliminar con sus ${subtareas}`}
            </button>
            <button type="button" onClick={onKeepSubtasks}>
              {childCount === 1 ? 'Conservar la subtarea' : 'Conservar las subtareas'}
            </button>
            <button ref={cancelRef} type="button" className="is-preferred" onClick={onCancel}>
              Cancelar
            </button>
          </div>
        </motion.section>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
