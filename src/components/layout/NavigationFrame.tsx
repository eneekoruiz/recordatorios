import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState, useRef } from 'react';

interface NavigationFrameProps {
  children: ReactNode;
  isMobile: boolean;
  canGoBack: boolean;
  onBack: () => void;
  backLabel?: string;
  viewKey: string;
}

const pageVariants = {
  initial: (direction: number) => ({
    x: direction < 0 ? '-28%' : '100%',
    opacity: direction < 0 ? 0.82 : 1,
    boxShadow: direction < 0
      ? '0px 0 0px rgba(0, 0, 0, 0)'
      : '-18px 0 42px rgba(0, 0, 0, 0.18), -3px 0 12px rgba(0, 0, 0, 0.08)',
    zIndex: direction < 0 ? 1 : 5,
  }),
  animate: {
    x: 0,
    opacity: 1,
    boxShadow: '-12px 0 32px rgba(0, 0, 0, 0.12), -2px 0 8px rgba(0, 0, 0, 0.04)',
    zIndex: 3,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? '100%' : '-28%',
    opacity: direction < 0 ? 1 : 0.82,
    boxShadow: direction < 0
      ? '-18px 0 42px rgba(0, 0, 0, 0.18), -3px 0 12px rgba(0, 0, 0, 0.08)'
      : '0px 0 0px rgba(0, 0, 0, 0)',
    zIndex: direction < 0 ? 5 : 1,
  }),
};

const pageTransition = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 38,
  mass: 0.85,
};

export function NavigationFrame({
  children,
  isMobile,
  canGoBack,
  onBack,
  backLabel = 'Volver',
  viewKey,
}: NavigationFrameProps) {
  const showBackBar = false; // El usuario quiere mantener solo el botón azul integrado en la cabecera del contenido y eliminar este top hood negro

  const [direction, setDirection] = useState(1);
  const prevKeyRef = useRef(viewKey);
  const isPoppingRef = useRef(false);

  if (viewKey !== prevKeyRef.current) {
    prevKeyRef.current = viewKey;
    if (isPoppingRef.current) {
      setDirection(-1);
      isPoppingRef.current = false;
    } else {
      setDirection(1);
    }
  }

  const handleBackTrigger = () => {
    isPoppingRef.current = true;
    setDirection(-1);
    onBack();
  };

  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        overflowX: 'hidden',
        overscrollBehaviorX: 'none',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-base, #ffffff)',
      }}
    >
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.div
          key={viewKey}
          custom={direction}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={pageTransition}
          drag={canGoBack ? 'x' : false}
          dragConstraints={canGoBack ? { left: 0, right: screenWidth } : undefined}
          dragElastic={canGoBack ? { left: 0, right: 0.05 } : undefined}
          whileDrag={canGoBack ? {
            boxShadow: '-22px 0 52px rgba(0, 0, 0, 0.22), -4px 0 14px rgba(0, 0, 0, 0.10)',
            cursor: 'grabbing',
          } : undefined}
          onDragEnd={canGoBack ? (e, info) => {
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
