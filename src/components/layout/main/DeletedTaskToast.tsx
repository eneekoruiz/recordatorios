import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, X } from 'lucide-react';

interface DeletedTaskToastProps {
  toast: { id: string; title: string; timeoutId: number } | null;
  onUndo: (id: string) => void;
  onDismiss: () => void;
}

export const DeletedTaskToast: React.FC<DeletedTaskToastProps> = ({
  toast,
  onUndo,
  onDismiss
}) => {
  if (!toast) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="premium-toast apple-island-pill"
        style={{
          position: 'fixed',
          bottom: 'max(20px, env(safe-area-inset-bottom))',
          left: '50%',
          background: 'var(--bg-elevated, rgba(28, 28, 30, 0.92))',
          backdropFilter: 'blur(30px) saturate(190%)',
          WebkitBackdropFilter: 'blur(30px) saturate(190%)',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
          borderRadius: '999px',
          padding: '6px 14px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          zIndex: 999999,
          pointerEvents: 'auto',
          maxWidth: '85vw',
          height: 38,
          boxSizing: 'border-box'
        }}
        initial={{ opacity: 0, y: 16, x: "-50%", scale: 0.94 }}
        animate={{ opacity: 1, y: 0, x: "-50%", scale: 1 }}
        exit={{ opacity: 0, y: 14, x: "-50%", scale: 0.94 }}
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        drag="x"
        dragConstraints={{ left: -80, right: 80 }}
        onDragEnd={(_, info) => {
          if (Math.abs(info.offset.x) > 50) {
            onDismiss();
          }
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <Trash2 size={14} color="var(--accent-red, #ff453a)" style={{ flexShrink: 0 }} />
          <span style={{ 
            fontSize: '0.84rem', fontWeight: 500, color: 'var(--text-primary)', 
            overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px'
          }}>
            {toast.title ? `«${toast.title}»` : 'Recordatorio eliminado'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => onUndo(toast.id)}
            style={{
              background: 'transparent',
              color: 'var(--accent-primary, #0a84ff)',
              border: 'none',
              padding: '2px 4px',
              fontSize: '0.84rem',
              fontWeight: 600,
              cursor: 'pointer',
              lineHeight: 1
            }}
          >
            Deshacer
          </button>
          <button
            onClick={onDismiss}
            style={{
              background: 'transparent',
              color: 'var(--text-tertiary)',
              border: 'none',
              padding: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            title="Cerrar"
          >
            <X size={13} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};
