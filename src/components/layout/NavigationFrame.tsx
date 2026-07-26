import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

interface NavigationFrameProps {
  children: ReactNode;
  isMobile: boolean;
  canGoBack: boolean;
  onBack: () => void;
  backLabel?: string;
  viewKey: string;
}

const pageVariants = {
  initial: { x: '100%', boxShadow: '-12px 0 28px rgba(0,0,0,0.18)', opacity: 1, zIndex: 2 },
  animate: { x: 0, boxShadow: '0px 0 0px rgba(0,0,0,0)', opacity: 1, zIndex: 2 },
  exit: { x: '-25%', opacity: 0.75, zIndex: 1 },
};

const pageTransition = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 32,
  mass: 0.8,
};

export function NavigationFrame({
  children,
  isMobile,
  canGoBack,
  onBack,
  backLabel = 'Volver',
  viewKey,
}: NavigationFrameProps) {
  const showBackBar = canGoBack;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={viewKey}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={pageTransition}
          drag={canGoBack ? 'x' : false}
          dragConstraints={canGoBack ? { left: 0, right: 0 } : undefined}
          dragElastic={canGoBack ? { left: 0, right: 0.5 } : undefined}
          onDragEnd={canGoBack ? (e, info) => {
            const threshold = typeof window !== 'undefined' ? window.innerWidth * 0.35 : 150;
            if (info.offset.x > threshold || info.velocity.x > 300) {
              onBack();
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
            background: 'var(--bg-surface, #fafafa)',
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
                background: 'var(--bg-surface, #fafafa)',
                position: 'sticky',
                top: 0,
                zIndex: 10,
              }}
            >
              <button
                onClick={onBack}
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
            }}
          >
            {children}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
