import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Printer, Copy } from 'lucide-react';
import { exportReportToPdf } from '../../../utils/pdfExport';
import { SheetNavBar } from '../../ui/SheetNavBar';
import { renderInlineMarkdown, stripInlineMarkdown } from '../../../utils/inlineMarkdown';

interface MonthlySummaryModalProps {
  modal: { open: boolean; title: string; text: string; loading: boolean };
  onClose: () => void;
}

export const MonthlySummaryModal: React.FC<MonthlySummaryModalProps> = ({
  modal,
  onClose
}) => {
  useEffect(() => {
    if (!modal.open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal.open, onClose]);

  if (!modal.open) return null;

  const copy = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(stripInlineMarkdown(modal.text));
      window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Resumen copiado' }));
    }
  };

  return createPortal(
    <div
      data-testid="monthly-summary-modal"
      className="premium-overlay list-config-overlay"
      style={{ position: 'fixed', inset: 0, zIndex: 99999 }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="monthly-summary-sheet form-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={modal.title}
      >
        <SheetNavBar title={modal.title} onConfirm={onClose} confirmLabel="Listo" />

        <div className="form-sheet-body">
          {modal.loading ? (
            <div className="form-group is-padded" style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
              <Sparkles size={22} className="animate-spin" style={{ margin: '0 auto 12px', color: '#ff9500' }} />
              <div>Preparando el resumen del mes…</div>
            </div>
          ) : (
            <div
              data-testid="monthly-summary-content"
              className="form-group is-padded"
              style={{ fontSize: '0.95rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}
            >
              {renderInlineMarkdown(modal.text)}
            </div>
          )}

          {!modal.loading && (
            <div className="form-group">
              <button type="button" className="form-row" onClick={copy}>
                <span className="form-row-icon" style={{ background: '#ff9500' }}><Copy size={15} /></span>
                <span className="form-row-text"><span className="form-row-title">Copiar</span></span>
              </button>
              <button
                type="button"
                className="form-row"
                onClick={() => exportReportToPdf({ title: modal.title, subtitle: 'Resumen del mes', rawText: stripInlineMarkdown(modal.text) })}
              >
                <span className="form-row-icon" style={{ background: '#8e8e93' }}><Printer size={15} /></span>
                <span className="form-row-text"><span className="form-row-title">Imprimir o guardar PDF</span></span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
