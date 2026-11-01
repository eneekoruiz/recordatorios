import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Sparkles, Bell, X, AlertCircle } from 'lucide-react';
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
  const isError = /error|fallo|no se pudo|reintentar/i.test(messageText);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 'max(24px, calc(env(safe-area-inset-bottom) + 16px))',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        pointerEvents: 'none',
        zIndex: 1000000,
        padding: '0 16px'
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={messageText}
          className="premium-toast apple-island-toast"
          role="status"
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            justifyContent: 'space-between',
            minWidth: 260,
            maxWidth: 'min(94vw, 440px)',
            boxSizing: 'border-box',
            borderRadius: 999,
            padding: '8px 12px 8px 10px',
            background: 'var(--bg-elevated, rgba(28, 28, 30, 0.94))',
            boxShadow: '0 14px 40px rgba(0, 0, 0, 0.28), 0 2px 10px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(30px) saturate(190%)',
            WebkitBackdropFilter: 'blur(30px) saturate(190%)',
            border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
            transformOrigin: 'bottom center'
          }}
          initial={{ opacity: 0, y: 22, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 14, scale: 0.92, transition: { duration: 0.18, ease: 'easeOut' } }}
          transition={{ type: 'spring', damping: 25, stiffness: 340 }}
          drag="x"
          dragConstraints={{ left: -100, right: 100 }}
          onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 40) setGlobalToast(null); }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: isAi
                  ? 'rgba(175, 82, 222, 0.2)'
                  : isSuccess
                  ? 'rgba(52, 199, 89, 0.2)'
                  : isError
                  ? 'rgba(255, 59, 48, 0.2)'
                  : 'rgba(0, 122, 255, 0.2)',
                color: isAi
                  ? '#af52de'
                  : isSuccess
                  ? '#34c759'
                  : isError
                  ? '#ff3b30'
                  : '#007aff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {isAi ? (
                <Sparkles size={13} strokeWidth={2.4} />
              ) : isSuccess ? (
                <Check size={13} strokeWidth={2.6} />
              ) : isError ? (
                <AlertCircle size={13} strokeWidth={2.4} />
              ) : (
                <Bell size={13} strokeWidth={2.4} />
              )}
            </div>
            <span
              style={{
                fontSize: '0.86rem',
                fontWeight: 550,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
                lineHeight: 1.3,
                textWrap: 'pretty',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
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
                  background: 'var(--accent-primary, #0071e3)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 999,
                  padding: '5px 13px',
                  minHeight: 30,
                  fontSize: '0.78rem',
                  fontWeight: 650,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0, 113, 227, 0.25)',
                  transition: 'transform 0.12s ease, opacity 0.12s ease'
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
                minWidth: 28,
                minHeight: 28,
                borderRadius: '50%',
                flexShrink: 0
              }}
              title="Cerrar aviso"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body
  );
}
