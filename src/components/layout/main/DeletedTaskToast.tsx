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
        className="premium-toast"
        style={{
          position: 'fixed',
          bottom: 'max(28px, env(safe-area-inset-bottom))',
          left: '50%',
          background: 'var(--bg-elevated, #1c1c1e)',
          backdropFilter: 'blur(35px) saturate(200%)',
          WebkitBackdropFilter: 'blur(35px) saturate(200%)',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.15))',
          borderRadius: '16px',
          padding: '12px 16px',
          boxShadow: '0 12px 36px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          zIndex: 999999,
          pointerEvents: 'auto',
          minWidth: '280px',
          maxWidth: '90vw',
          justifyContent: 'space-between',
          boxSizing: 'border-box'
        }}
        initial={{ opacity: 0, y: 24, x: "-50%", scale: 0.9 }}
        animate={{ opacity: 1, y: 0, x: "-50%", scale: 1 }}
        exit={{ opacity: 0, y: 20, x: "-50%", scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 450, damping: 28 }}
        drag="x"
        dragConstraints={{ left: -100, right: 100 }}
        onDragEnd={(_, info) => {
          if (Math.abs(info.offset.x) > 60) {
            onDismiss();
          }
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden', flex: 1 }}>
          <Trash2 size={18} color="var(--accent-red)" style={{ flexShrink: 0 }} />
          <span style={{ 
            fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)', 
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', 
            overflow: 'hidden', wordBreak: 'break-word', whiteSpace: 'normal'
          }}>
            Eliminado "{toast.title}"
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => {
              onUndo(toast.id);
            }}
            style={{
              background: 'var(--accent-primary)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '999px',
              padding: '6px 14px',
              fontSize: '0.9rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(10, 132, 255, 0.3)',
              transition: 'transform 0.15s ease'
            }}
            onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.93)'; }}
            onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            Deshacer
          </button>
          <button
            onClick={onDismiss}
            style={{
              background: 'transparent',
              color: 'var(--text-tertiary)',
              border: 'none',
              borderRadius: '50%',
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            title="Cerrar"
          >
            <X size={16} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};
