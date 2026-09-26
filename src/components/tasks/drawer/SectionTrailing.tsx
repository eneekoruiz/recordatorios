import { ChevronRight } from 'lucide-react';

/**
 * Parte derecha de una fila del editor, como en los formularios de iOS:
 * el valor actual (con la sección plegada) y una «›» que gira al desplegar.
 */
export function SectionTrailing({ open, summary }: { open: boolean; summary?: string }) {
  return (
    <span className="section-card-trailing">
      {!open && summary ? <span className="section-card-summary">{summary}</span> : null}
      <ChevronRight
        size={17}
        className="section-card-chevron"
        aria-hidden="true"
        style={{ transform: open ? 'rotate(90deg)' : 'none' }}
      />
    </span>
  );
}
