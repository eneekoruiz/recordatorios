import React from 'react';

/** Verde = dinero (precios); las duraciones usan el color de su frecuencia o lista. Nunca se mezclan. */
export const MONEY_COLOR = '#30d158';

export interface MetaPart {
  id: string;
  /** Magnitud (minutos, euros…): solo se usa para el ancho relativo del segmento. */
  value: number;
  /** Texto corto que se revela al pasar el ratón o enfocar («1 h», «30 min»). */
  text: string;
  color: string;
  /** Sólido = propio; rayado = acumulado desde otras frecuencias; atenuado = ya hecho/pagado. */
  tone?: 'solid' | 'striped' | 'done';
}

interface MetaSplitProps {
  /** Valor principal, siempre visible («~2 h 30 min», «84,00 €»). */
  label: React.ReactNode;
  parts: MetaPart[];
  /** Descripción completa para lectores de pantalla y tooltip. */
  description: string;
  className?: string;
}

/**
 * Cifra + microbarra segmentada (4 px de alto): distingue de un vistazo de qué se compone un
 * total sin añadir líneas de texto. El desglose numérico aparece al pasar el ratón o enfocar
 * (también con toque en móvil); la misma información va en el tooltip y en aria-label.
 * Convención visual en toda la app: sólido = propio, rayado = acumulado, atenuado = hecho.
 */
export const MetaSplit: React.FC<MetaSplitProps> = ({ label, parts, description, className }) => {
  const visible = parts.filter((p) => p.value > 0);
  return (
    <span className={`meta-split${className ? ` ${className}` : ''}`} tabIndex={0} title={description} aria-label={description} role="group">
      <span className="meta-split__label">{label}</span>
      {visible.length > 0 && (
        <span className="meta-split__bar" aria-hidden="true">
          {visible.map((p) => (
            <i key={p.id} className={`meta-split__seg meta-split__seg--${p.tone || 'solid'}`} style={{ flexGrow: p.value, ['--seg' as string]: p.color } as React.CSSProperties} />
          ))}
        </span>
      )}
      {visible.length > 1 && (
        <span className="meta-split__parts" aria-hidden="true">
          {visible.map((p, i) => (
            <span key={p.id} className="meta-split__part">
              <span style={{ color: p.color }}>{p.text}</span>
              {i < visible.length - 1 && <span className="meta-split__sep">+</span>}
            </span>
          ))}
        </span>
      )}
    </span>
  );
};
