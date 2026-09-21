import React from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, Wand2 } from 'lucide-react';

interface MonthlySummaryModalProps {
  modal: { open: boolean; title: string; text: string; loading: boolean };
  onClose: () => void;
}

export const MonthlySummaryModal: React.FC<MonthlySummaryModalProps> = ({
  modal,
  onClose
}) => {
  if (!modal.open) return null;

  return createPortal(
    <div
      data-testid="monthly-summary-modal"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)'
        }}
      />
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 520,
          background: 'var(--bg-elevated)',
          borderRadius: 20,
          border: '1px solid var(--border-subtle)',
          padding: '24px 20px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          zIndex: 100000
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'flex', width: 32, height: 32, borderRadius: '50%', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'rgba(255, 149, 0, 0.14)' }}>
              <Wand2 size={16} color="#ff9500" strokeWidth={2} />
            </span>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {modal.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Cerrar"
            aria-label="Cerrar"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '50%',
              width: 30,
              height: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-secondary)'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {modal.loading ? (
          <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            <Sparkles size={20} className="animate-spin" style={{ margin: '0 auto 10px', color: '#ff9500' }} />
            <span>Tejiendo tu memoria mensual con IA...</span>
          </div>
        ) : (
          <div 
            data-testid="monthly-summary-content"
            style={{
              fontSize: '0.92rem',
              lineHeight: '1.6',
              color: 'var(--text-primary)',
              whiteSpace: 'pre-wrap',
              background: 'var(--bg-surface)',
              padding: '16px',
              borderRadius: 14,
              border: '1px solid var(--border-subtle)',
              maxHeight: '60vh',
              overflowY: 'auto'
            }}
          >
            {modal.text}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
          <button
            type="button"
            onClick={async () => {
              if (typeof navigator !== 'undefined' && navigator.clipboard) {
                await navigator.clipboard.writeText(modal.text);
                window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Resumen mensual copiado al portapapeles' }));
              }
            }}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              background: '#ff9500',
              color: 'white',
              border: 'none',
              fontSize: '0.84rem',
              fontWeight: 650,
              cursor: 'pointer'
            }}
          >
            Copiar memoria
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
