import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Sparkles, Bell, X } from 'lucide-react';
import { HapticService } from '../../services/HapticService';

export function GlobalToast() {
  const [globalToast, setGlobalToast] = useState<{ message: string; onUndo?: () => void } | string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const handleToast = (e: any) => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      setGlobalToast(e.detail);
      HapticService.selection();
      const timeoutMs = (typeof e.detail === 'object' && e.detail?.onUndo) ? 6000 : 3800;
      toastTimerRef.current = window.setTimeout(() => setGlobalToast(null), timeoutMs);
    };
    window.addEventListener('show-toast', handleToast);
    return () => {
      window.removeEventListener('show-toast', handleToast);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  if (!globalToast) return null;

  const messageText = typeof globalToast === 'string' ? globalToast : globalToast.message;
  const isAi = messageText.includes('🤖') || messageText.toLowerCase().includes('ia ') || messageText.toLowerCase().includes('inteligencia');
  const isSuccess = /completad|guardad|descargad|éxito|cread|actualizad|restaurad/i.test(messageText);

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="premium-toast apple-island-toast"
        role="status"
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 10, 
          justifyContent: 'space-between', 
          minWidth: 260, 
          maxWidth: 'min(92vw, 440px)', 
          boxSizing: 'border-box',
          zIndex: 999999 
        }}
        initial={{ opacity: 0, y: 20, scale: 0.95, x: "-50%" }}
        animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
        exit={{ opacity: 0, y: 14, scale: 0.95, x: "-50%" }}
        transition={{ type: 'spring', damping: 24, stiffness: 320 }}
        drag="x"
        dragConstraints={{ left: -100, right: 100 }}
        onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 50) setGlobalToast(null); }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: isAi ? 'rgba(175, 82, 222, 0.18)' : isSuccess ? 'rgba(52, 199, 89, 0.18)' : 'rgba(0, 122, 255, 0.18)',
              color: isAi ? '#af52de' : isSuccess ? '#34c759' : '#007aff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            {isAi ? <Sparkles size={12} strokeWidth={2.5} /> : isSuccess ? <Check size={12} strokeWidth={2.5} /> : <Bell size={12} strokeWidth={2.2} />}
          </div>
          <span style={{ fontSize: '0.86rem', fontWeight: 550, textWrap: 'pretty', minWidth: 0, color: 'var(--text-primary)' }}>
            {messageText}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {typeof globalToast !== 'string' && globalToast.onUndo && (
            <button
              type="button"
              onClick={() => {
                globalToast.onUndo?.();
                setGlobalToast(null);
              }}
              style={{
                background: '#0071e3',
                color: '#ffffff',
                border: 'none',
                borderRadius: 999,
                padding: '6px 14px',
                minHeight: 34,
                fontSize: '0.78rem',
                fontWeight: 650,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0, 113, 227, 0.3)',
                transition: 'transform 0.15s ease, background-color 0.15s ease'
              }}
            >
              Deshacer
            </button>
          )}
          <button
            type="button"
            onClick={() => setGlobalToast(null)}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--text-tertiary)', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              padding: 6, 
              borderRadius: '50%', 
              flexShrink: 0 
            }}
            title="Cerrar aviso"
          >
            <X size={14} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
