import React from 'react';
import { Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title = "No hay recordatorios",
  message = "Disfruta de la tranquilidad o añade algo nuevo para empezar.",
  icon = <Sparkles size={40} color="var(--accent-primary)" strokeWidth={1.5} />,
  actionLabel,
  onAction
}: EmptyStateProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: '350px',
        padding: 'var(--space-32)',
        textAlign: 'center',
      }}
    >
      <div style={{ position: 'relative', marginBottom: 'var(--space-24)' }}>
        {/* Animated background glow */}
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3]
          }}
          transition={{ 
            duration: 4, 
            repeat: Infinity,
            ease: "easeInOut" 
          }}
          style={{
            position: 'absolute',
            inset: -20,
            background: 'radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)',
            borderRadius: '50%',
            zIndex: 0
          }}
        />
        
        {/* Floating icon */}
        <motion.div
          animate={{ y: [-4, 4, -4] }}
          transition={{ 
            duration: 4, 
            repeat: Infinity,
            ease: "easeInOut" 
          }}
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 80,
            height: 80,
            background: 'var(--bg-surface)',
            borderRadius: '50%',
            boxShadow: 'var(--shadow-md)',
            border: '1px solid var(--border-subtle)'
          }}
        >
          {icon}
        </motion.div>
      </div>

      <h3 style={{
        fontSize: '1.35rem',
        fontWeight: 700,
        color: 'var(--text-primary)',
        marginBottom: 'var(--space-8)',
        fontFamily: 'var(--font-display)',
        letterSpacing: '-0.01em'
      }}>
        {title}
      </h3>
      
      <p style={{
        fontSize: '1rem',
        color: 'var(--text-secondary)',
        maxWidth: 320,
        lineHeight: 1.5,
        marginBottom: actionLabel && onAction ? 'var(--space-24)' : 0
      }}>
        {message}
      </p>

      {actionLabel && onAction && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onAction}
          style={{
            padding: '12px 24px',
            background: 'var(--accent-primary)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-full)',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
            boxShadow: '0 8px 20px var(--accent-glow)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'background 0.2s'
          }}
        >
          {actionLabel}
        </motion.button>
      )}
    </motion.div>
  );
}
