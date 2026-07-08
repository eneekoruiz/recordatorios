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
  initial: { x: 40, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: -40, opacity: 0 },
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
  const showBackBar = isMobile ? canGoBack : canGoBack;

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={viewKey}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={pageTransition}
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            flex: 1,
          }}
        >
          {showBackBar && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: 'var(--space-12, 12px) var(--space-24, 24px)',
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
            }}
          >
            {children}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
