import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';

interface ViewHeaderProps {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  /** Color de la vista (icono y título), como en el resto de pantallas. */
  color?: string;
  onBack: () => void;
  actions?: ReactNode;
}

/**
 * Cabecera de las pantallas de servicio (Estadísticas, Importar…): «‹ Listas» arriba solo en móvil
 * (en escritorio la barra lateral ya está a la vista) y el título con su icono, como Calendario o Papelera.
 */
export function ViewHeader({ title, subtitle, icon, color = 'var(--accent-primary)', onBack, actions }: ViewHeaderProps) {
  return (
    <header className="view-header" style={{ ['--view-color' as string]: color }}>
      <button type="button" className="view-header-back" onClick={onBack}>
        <ChevronLeft size={20} strokeWidth={2.4} aria-hidden="true" /> Listas
      </button>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="view-header-title">
            <span className="view-header-icon" aria-hidden="true">{icon}</span>
            {title}
          </h1>
          {subtitle && <p className="view-header-sub">{subtitle}</p>}
        </div>
        {actions && <div className="view-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>{actions}</div>}
      </div>
    </header>
  );
}
