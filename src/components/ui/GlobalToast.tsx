import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export function GlobalToast() {
  const [globalToast, setGlobalToast] = useState<{ message: string; onUndo?: () => void } | string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const handleToast = (e: any) => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      setGlobalToast(e.detail);
      const timeoutMs = (typeof e.detail === 'object' && e.detail?.onUndo) ? 6000 : 3500;
      toastTimerRef.current = window.setTimeout(() => setGlobalToast(null), timeoutMs);
    };
    window.addEventListener('show-toast', handleToast);
    return () => {
      window.removeEventListener('show-toast', handleToast);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  if (!globalToast) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="premium-toast"
        role="status"
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 12, 
          justifyContent: 'space-between', 
          minWidth: 280, 
          maxWidth: '90vw', 
          boxSizing: 'border-box',
          zIndex: 999999 
        }}
        initial={{ opacity: 0, y: 16, x: "-50%" }}
        animate={{ opacity: 1, y: 0, x: "-50%" }}
        exit={{ opacity: 0, y: 16, x: "-50%" }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        drag="x"
        dragConstraints={{ left: -100, right: 100 }}
        onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 50) setGlobalToast(null); }}
      >
        <span style={{ fontSize: '0.86rem', fontWeight: 550, textWrap: 'pretty', minWidth: 0 }}>
          {typeof globalToast === 'string' ? globalToast : globalToast.message}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {typeof globalToast !== 'string' && globalToast.onUndo && (
            <button
              type="button"
              onClick={() => {
                globalToast.onUndo?.();
                setGlobalToast(null);
              }}
              style={{
                background: 'var(--accent-primary, #007aff)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 14,
                padding: '8px 12px',
                minHeight: 44,
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0, 122, 255, 0.3)',
                transition: 'background-color 0.15s ease'
              }}
            >
              Deshacer
            </button>
          )}
          <button
            onClick={() => setGlobalToast(null)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, minWidth: 44, minHeight: 44, borderRadius: 22, flexShrink: 0 }}
            title="Cerrar"
          >
            <X size={16} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
