export interface ReportStat {
  label: string;
  value: string | number;
}

export interface ReportItem {
  title: string;
  category?: string;
  status?: string;
  dueDate?: string;
  price?: number;
  duration?: number;
  notes?: string;
}

export interface PdfReportOptions {
  title: string;
  subtitle?: string;
  stats?: ReportStat[];
  items?: ReportItem[];
  rawText?: string;
}

/**
 * Genera un informe maquetado con diseño editorial Apple HIG y abre el diálogo nativo
 * de impresión / Guardar como PDF del navegador.
 */
export function exportReportToPdf(options: PdfReportOptions): void {
  const { title, subtitle, stats = [], items = [], rawText } = options;

  const nowFormatted = new Date().toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const printWindow = window.open('', '_blank', 'width=840,height=960');
  if (!printWindow) {
    window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Por favor, permite las ventanas emergentes para exportar a PDF.' }));
    return;
  }

  const statsHtml = stats.length > 0 ? `
    <div class="stats-grid">
      ${stats.map(s => `
        <div class="stat-card">
          <div class="stat-value">${s.value}</div>
          <div class="stat-label">${s.label}</div>
        </div>
      `).join('')}
    </div>
  ` : '';

  let bodyHtml = '';
  if (rawText) {
    bodyHtml = `
      <div class="raw-content">
        ${rawText.replace(/\n\n/g, '<br/><br/>').replace(/\n/g, '<br/>')}
      </div>
    `;
  } else if (items.length > 0) {
    bodyHtml = `
      <table class="report-table">
        <thead>
          <tr>
            <th style="width: 45%;">Recordatorio</th>
            <th style="width: 15%;">Estado</th>
            <th style="width: 20%;">Fecha</th>
            <th style="width: 20%; text-align: right;">Coste / Tiempo</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => {
            const isDone = item.status === 'completed';
            const priceStr = item.price !== undefined ? `${item.price.toFixed(2)} €` : '';
            const durationStr = item.duration ? `${Math.round(item.duration / 60)} min` : '';
            const metaStr = [priceStr, durationStr].filter(Boolean).join(' · ');

            return `
              <tr class="${isDone ? 'done-row' : ''}">
                <td>
                  <div class="task-title ${isDone ? 'strikethrough' : ''}">${item.title}</div>
                  ${item.notes ? `<div class="task-note">${item.notes}</div>` : ''}
                  ${item.category ? `<span class="category-tag">${item.category}</span>` : ''}
                </td>
                <td>
                  <span class="status-badge ${isDone ? 'completed' : 'pending'}">
                    ${isDone ? 'Completado' : 'Pendiente'}
                  </span>
                </td>
                <td class="date-cell">${item.dueDate || '—'}</td>
                <td style="text-align: right; font-weight: 600;">${metaStr || '—'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8" />
      <title>${title} — Recordatorios</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 18mm 16mm 18mm 16mm;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #1c1c1e;
          background: #ffffff;
          margin: 0;
          padding: 24px;
          line-height: 1.5;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #007aff;
          padding-bottom: 16px;
          margin-bottom: 24px;
        }
        .title-block h1 {
          margin: 0 0 6px 0;
          font-size: 24px;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: #111;
        }
        .title-block p {
          margin: 0;
          font-size: 13px;
          color: #6c6c70;
        }
        .app-badge {
          text-align: right;
          font-size: 12px;
          color: #8e8e93;
        }
        .app-badge strong {
          color: #007aff;
          font-size: 14px;
          display: block;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 12px;
          margin-bottom: 28px;
        }
        .stat-card {
          background: #f2f2f7;
          border-radius: 12px;
          padding: 14px 16px;
          border: 0.5px solid #d1d1d6;
        }
        .stat-value {
          font-size: 20px;
          font-weight: 700;
          color: #007aff;
          font-variant-numeric: tabular-nums;
        }
        .stat-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #8e8e93;
          margin-top: 4px;
          font-weight: 600;
        }
        .report-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          margin-bottom: 30px;
        }
        .report-table th {
          text-align: left;
          padding: 10px 12px;
          border-bottom: 1.5px solid #c6c6c8;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #6c6c70;
        }
        .report-table td {
          padding: 12px;
          border-bottom: 0.5px solid #e5e5ea;
          vertical-align: top;
        }
        .task-title {
          font-weight: 600;
          color: #1c1c1e;
        }
        .strikethrough {
          text-decoration: line-through;
          color: #8e8e93;
        }
        .task-note {
          font-size: 11px;
          color: #8e8e93;
          margin-top: 3px;
        }
        .category-tag {
          display: inline-block;
          font-size: 10px;
          font-weight: 600;
          color: #007aff;
          background: rgba(0, 122, 255, 0.1);
          padding: 2px 6px;
          border-radius: 6px;
          margin-top: 4px;
        }
        .status-badge {
          display: inline-block;
          font-size: 11px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 999px;
        }
        .status-badge.completed {
          background: #d1f5d3;
          color: #198754;
        }
        .status-badge.pending {
          background: #ffe8cc;
          color: #d97706;
        }
        .date-cell {
          color: #6c6c70;
          font-size: 12px;
        }
        .raw-content {
          font-size: 14px;
          line-height: 1.7;
          background: #f8f8f9;
          padding: 20px;
          border-radius: 12px;
          border: 1px solid #e5e5ea;
          white-space: pre-wrap;
        }
        .footer {
          margin-top: 40px;
          padding-top: 14px;
          border-top: 0.5px solid #d1d1d6;
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: #8e8e93;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title-block">
          <h1>${title}</h1>
          <p>${subtitle || 'Informe generado automáticamente'}</p>
        </div>
        <div class="app-badge">
          <strong>Recordatorios</strong>
          <span>${nowFormatted}</span>
        </div>
      </div>

      ${statsHtml}
      ${bodyHtml}

      <div class="footer">
        <span>Documento generado con Recordatorios Soberano</span>
        <span>Página 1</span>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}
