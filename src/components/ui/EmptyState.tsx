import React from 'react';
import { Sparkles, Calendar, Clock, Flag, CheckCircle2, AlertCircle, Inbox, Trash2, Folder, Sun } from 'lucide-react';
import { motion } from 'framer-motion';

const getIconByName = (name?: string, fallbackNode?: React.ReactNode) => {
  const size = 40;
  const color = "var(--accent-primary)";
  const strokeWidth = 1.5;
  switch (name) {
    case 'today':
    case 'sun': return <Sun size={size} color={color} strokeWidth={strokeWidth} />;
    case 'scheduled':
    case 'calendar': return <Calendar size={size} color={color} strokeWidth={strokeWidth} />;
    case 'flagged':
    case 'flag': return <Flag size={size} color={color} strokeWidth={strokeWidth} />;
    case 'completed':
    case 'check': return <CheckCircle2 size={size} color={color} strokeWidth={strokeWidth} />;
    case 'overdue':
    case 'alert': return <AlertCircle size={size} color={color} strokeWidth={strokeWidth} />;
    case 'trash': return <Trash2 size={size} color="var(--text-tertiary)" strokeWidth={strokeWidth} />;
    case 'inbox': return <Inbox size={size} color={color} strokeWidth={strokeWidth} />;
    case 'list':
    case 'folder': return <Folder size={size} color={color} strokeWidth={strokeWidth} />;
    case 'clock': return <Clock size={size} color={color} strokeWidth={strokeWidth} />;
    case 'sparkles': return <Sparkles size={size} color={color} strokeWidth={strokeWidth} />;
    default: return fallbackNode || <Sparkles size={size} color={color} strokeWidth={strokeWidth} />;
  }
};

interface EmptyStateProps {
  title?: string;
  message?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  iconName?: string;
  actionLabel?: string;
  ctaText?: string;
  onAction?: () => void;
}

export function EmptyState({
  title = "No hay recordatorios",
  message,
  subtitle,
  icon,
  iconName,
  actionLabel,
  ctaText,
  onAction
}: EmptyStateProps) {
  const resolvedMessage = message || subtitle || "Disfruta de la tranquilidad o añade algo nuevo para empezar.";
  const resolvedCtaText = ctaText || actionLabel;
  const resolvedIcon = getIconByName(iconName, icon);
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
        minHeight: '160px',
        padding: '16px 20px',
        textAlign: 'center',
      }}
    >
      <motion.div 
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0, ease: [0.22, 1, 0.36, 1] }}
        style={{ position: 'relative', marginBottom: 'var(--space-24)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {/* Breathing background ambient glow */}
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.35, 0.65, 0.35] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: 'absolute',
            inset: -28,
            background: 'radial-gradient(circle, var(--accent-glow) 0%, transparent 70%)',
            borderRadius: '50%',
            zIndex: 0,
            pointerEvents: 'none'
          }}
        />
        
        {/* Shimmering glass icon container */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 84,
            height: 84,
            background: 'var(--bg-surface-glass)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: '50%',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 0 0 1px var(--border-subtle)',
            border: '1.5px solid var(--border-color)',
            transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease'
          }}
        >
          {resolvedIcon}
        </div>
      </motion.div>

      <motion.h3 
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        style={{
        fontSize: '1.35rem',
        fontWeight: 700,
        color: 'var(--text-primary)',
        marginBottom: 'var(--space-8)',
        fontFamily: 'var(--font-display)',
        letterSpacing: '-0.01em'
      }}>
        {title}
      </motion.h3>
      
      <motion.p 
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        style={{
        fontSize: '1rem',
        color: 'var(--text-secondary)',
        maxWidth: 320,
        lineHeight: 1.5,
        marginBottom: resolvedCtaText && onAction ? 'var(--space-24)' : 0
      }}>
        {resolvedMessage}
      </motion.p>

      {resolvedCtaText && onAction && (
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
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
          {resolvedCtaText}
        </motion.button>
      )}
    </motion.div>
  );
}
