import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';

interface ViewHeaderProps {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  /** Color de la vista (icono y título), como en el resto de pantallas. */
  color?: string;
  onBack: () => void;
}

/**
 * Cabecera de las pantallas de servicio (Estadísticas, Importar…): «‹ Listas» arriba solo en móvil
 * (en escritorio la barra lateral ya está a la vista) y el título con su icono, como Calendario o Papelera.
 */
export function ViewHeader({ title, subtitle, icon, color = 'var(--accent-primary)', onBack }: ViewHeaderProps) {
  return (
    <header className="view-header" style={{ ['--view-color' as string]: color }}>
      <button type="button" className="view-header-back" onClick={onBack}>
        <ChevronLeft size={20} strokeWidth={2.4} aria-hidden="true" /> Listas
      </button>
      <h1 className="view-header-title">
        <span className="view-header-icon" aria-hidden="true">{icon}</span>
        {title}
      </h1>
      {subtitle && <p className="view-header-sub">{subtitle}</p>}
    </header>
  );
}
