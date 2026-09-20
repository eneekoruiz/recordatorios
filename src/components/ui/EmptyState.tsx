import React from 'react';
import { Sparkles, Calendar, Clock, Flag, CheckCircle2, AlertCircle, Inbox, Trash2, Folder, Sun } from 'lucide-react';
import { motion } from 'framer-motion';

const getIconByName = (name?: string, fallbackNode?: React.ReactNode) => {
  const size = 32;
  const color = "var(--accent-primary)";
  const strokeWidth = 1.7;
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
      transition={{ duration: 0.35, ease: "easeOut" }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: '120px',
        padding: '12px 16px',
        textAlign: 'center',
        boxSizing: 'border-box'
      }}
    >
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0, ease: [0.22, 1, 0.36, 1] }}
        style={{ position: 'relative', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {/* Breathing background ambient glow */}
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.55, 0.3] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: 'absolute',
            inset: -20,
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
            width: 66,
            height: 66,
            background: 'var(--bg-surface-glass)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: '50%',
            boxShadow: '0 6px 24px rgba(0, 0, 0, 0.08), 0 0 0 1px var(--border-subtle)',
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
        fontSize: '1.2rem',
        fontWeight: 700,
        color: 'var(--text-primary)',
        marginBottom: '6px',
        fontFamily: 'var(--font-display)',
        letterSpacing: '-0.015em'
      }}>
        {title}
      </motion.h3>
      
      <motion.p 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        style={{
        fontSize: '0.90rem',
        color: 'var(--text-secondary)',
        maxWidth: 300,
        lineHeight: 1.45,
        marginBottom: resolvedCtaText && onAction ? '18px' : 0
      }}>
        {resolvedMessage}
      </motion.p>

      {resolvedCtaText && onAction && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={onAction}
          style={{
            padding: '10px 22px',
            background: 'var(--accent-primary)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-full)',
            fontWeight: 600,
            fontSize: '0.90rem',
            cursor: 'pointer',
            boxShadow: '0 6px 16px var(--accent-glow)',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            transition: 'background 0.2s'
          }}
        >
          {resolvedCtaText}
        </motion.button>
      )}
    </motion.div>
  );
}
