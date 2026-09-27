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
      className="premium-overlay"
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
          inset: 0
        }}
      />
      <div
        onClick={e => e.stopPropagation()}
        className="premium-sheet monthly-summary-sheet"
        style={{
          maxWidth: 520,
          gap: 16
        }}
      >
        <div className="modal-header-row" style={{ marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="modal-hero-badge" style={{ background: 'rgba(255, 149, 0, 0.14)', marginBottom: 0, width: 40, height: 40 }}>
              <Wand2 size={18} color="#ff9500" strokeWidth={2.2} />
            </div>
            <div>
              <h3 className="modal-title" style={{ fontSize: '1.2rem' }}>
                {modal.title}
              </h3>
              <p className="modal-subtitle">Resumen inteligente de hábitos y tareas</p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            title="Cerrar"
            aria-label="Cerrar"
          >
            <X size={16} strokeWidth={2.4} />
          </button>
        </div>

        {modal.loading ? (
          <div style={{ padding: '36px 10px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            <Sparkles size={22} className="animate-spin" style={{ margin: '0 auto 12px', color: '#ff9500' }} />
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
              background: 'var(--bg-elevated)',
              padding: '16px',
              borderRadius: 16,
              border: '1px solid var(--border-subtle)',
              maxHeight: '55vh',
              overflowY: 'auto'
            }}
          >
            {modal.text}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 4 }}>
          <button
            type="button"
            className="modal-btn-secondary"
            onClick={onClose}
          >
            Cerrar
          </button>
          <button
            type="button"
            className="modal-btn-primary"
            onClick={async () => {
              if (typeof navigator !== 'undefined' && navigator.clipboard) {
                await navigator.clipboard.writeText(modal.text);
                window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Resumen mensual copiado al portapapeles' }));
              }
            }}
            style={{
              background: '#ff9500',
              boxShadow: '0 4px 14px rgba(255, 149, 0, 0.35)'
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
