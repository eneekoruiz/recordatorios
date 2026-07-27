import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { ArrowLeft, ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect } from 'react';

interface NavigationFrameProps {
  children: ReactNode;
  isMobile?: boolean;
  canGoBack: boolean;
  onBack: () => void;
  backLabel?: string;
  viewKey: string;
}

export function NavigationFrame({
  children,
  canGoBack,
  onBack,
  backLabel = 'Volver',
  viewKey,
}: NavigationFrameProps) {
  const showBackBar = false; // El usuario quiere mantener solo el botón azul integrado en la cabecera del contenido y eliminar este top hood negro

  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 400;
  const dragControls = useDragControls();

  // Intercept normal browser back button / Android gesture
  useEffect(() => {
    if (!canGoBack) return;

    const handlePopState = (event: PopStateEvent) => {
      event.preventDefault();
      onBack?.();
    };

    window.history.pushState({ navigationFrame: true }, '');
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [canGoBack, onBack]);

  // Handler compartido para la retroalimentación háptica (1:1 con iOS System)
  const handleBackTrigger = () => {
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      try {
        window.navigator.vibrate(10);
      } catch (_err) {
        // Ignorar si el dispositivo/navegador restringe vibración sin interacción directa
      }
    }
    onBack?.();
  };

  return (
    <div className="navigation-frame-container" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Top Hood / Back Bar System de Apple — Gated para que no sea intrusivo pero mantenga jerarquía en sublistas si se requiere */}
      {showBackBar && canGoBack && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="navigation-frame-back-bar"
        >
          <button 
            onClick={handleBackTrigger}
            className="navigation-frame-back-btn"
            aria-label="Volver atrás"
          >
            <ChevronLeft size={22} className="back-icon" />
            <span className="back-label">{backLabel}</span>
          </button>
        </motion.div>
      )}

      {/* Contenedor con soporte nativo de gestos táctiles para Swipe de regreso */}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={viewKey || 'default_view'}
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.015 }}
          transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
          className="navigation-frame-content-wrapper"
          drag={canGoBack ? "x" : false}
          dragListener={false}
          dragControls={dragControls}
          dragConstraints={canGoBack ? { left: 0, right: screenWidth } : undefined}
          dragElastic={canGoBack ? { left: 0, right: 0.05 } : undefined}
          whileDrag={canGoBack ? {
            boxShadow: '-22px 0 52px rgba(0, 0, 0, 0.22), -4px 0 14px rgba(0, 0, 0, 0.10)',
            cursor: 'grabbing',
          } : undefined}
          onDragEnd={canGoBack ? (_e, info) => {
            const threshold = typeof window !== 'undefined' ? window.innerWidth * 0.35 : 150;
            if (info.offset.x > threshold || info.velocity.x > 300) {
              handleBackTrigger();
            }
          } : undefined}
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            minHeight: 0,
            background: 'var(--bg-base, #ffffff)',
            overflowX: 'hidden',
            overscrollBehaviorX: 'none',
          }}
        >
          {canGoBack && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                width: 28,
                zIndex: 9999,
                touchAction: 'none',
                cursor: 'grab'
              }}
              onPointerDown={(e) => {
                dragControls.start(e);
              }}
            />
          )}
          {showBackBar && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: 'var(--space-12, 12px) var(--space-24, 24px)',
                paddingTop: 'env(safe-area-inset-top)',
                borderBottom: '1px solid var(--border-subtle, #e5e5e5)',
                background: 'var(--bg-base, #ffffff)',
                position: 'sticky',
                top: 0,
                zIndex: 500,
              }}
            >
              <button
                onClick={handleBackTrigger}
                aria-label={backLabel}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-8, 8px)',
                  color: 'var(--text-primary, #111)',
                  padding: 'var(--space-8, 8px) var(--space-16, 16px)',
                  borderRadius: 'var(--radius-full, 999px)',
                  background: 'var(--bg-elevated, #fff)',
                  cursor: 'pointer',
                  border: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <ArrowLeft size={18} />
                <span>{backLabel}</span>
              </button>
            </div>
          )}

          <div
            style={{
              width: '100%',
              flex: 1,
              minHeight: 0,
              overflowX: 'hidden',
              overscrollBehaviorX: 'none',
            }}
          >
            {children}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
