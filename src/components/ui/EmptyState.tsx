import React from 'react';
import { Sparkles } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
}

export function EmptyState({
  title = "No hay recordatorios",
  message = "Disfruta de la tranquilidad o añade algo nuevo para empezar.",
  icon = <Sparkles size={48} color="var(--border-focus)" strokeWidth={1} />
}: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      minHeight: '300px',
      padding: 'var(--space-24)',
      textAlign: 'center',
      animation: 'fadeIn 0.5s ease-out'
    }}>
      <div style={{ marginBottom: 'var(--space-16)' }}>
        {icon}
      </div>
      <h3 style={{
        fontSize: '1.25rem',
        fontWeight: 600,
        color: 'var(--text-secondary)',
        marginBottom: 'var(--space-8)'
      }}>
        {title}
      </h3>
      <p style={{
        fontSize: '0.95rem',
        color: 'var(--text-tertiary)',
        maxWidth: 300,
        lineHeight: 1.4
      }}>
        {message}
      </p>
    </div>
  );
}
