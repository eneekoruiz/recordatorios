import React, { useEffect } from 'react';

export interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface SpotlightBackdropProps {
  /** Área a mantener nítida mientras el menú está abierto. */
  rect: SpotlightRect | null;
  onClose: () => void;
  onWheel?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  zIndex?: number;
  /** Margen alrededor del elemento seleccionado antes de aplicar el resalte. */
  padding?: number;
  /** Radio de esquina a juego con el elemento resaltado. */
  radius?: number;
  background?: string;
  blur?: string;
}

/**
 * Telón de fondo cinematográfico para menús contextuales estilo Apple.
 * Un único backdrop continuo que evita cualquier línea, costura o corte en el desenfoque,
 * bloquea la interacción de fondo y enmarca con elegancia el elemento seleccionado.
 */
export function SpotlightBackdrop({
  rect: _rect,
  onClose,
  onWheel,
  onContextMenu,
  zIndex = 999990,
  padding: _padding = 4,
  radius: _radius = 12,
  background,
  blur
}: SpotlightBackdropProps) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const isDark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';

  // En móvil bloqueamos el overscroll de fondo; en escritorio mantenemos libertad
  useEffect(() => {
    if (!isMobile) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isMobile]);

  const sharedProps = {
    onClick: onClose,
    onWheel: onWheel ?? ((e: React.WheelEvent) => { e.preventDefault(); onClose(); }),
    onContextMenu: onContextMenu ?? ((e: React.MouseEvent) => { e.preventDefault(); onClose(); })
  };

  if (!isMobile) {
    // Escritorio: backdrop invisible para capturar clics fuera sin desenfocar ni alterar la nitidez del elemento
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex,
          background: 'transparent',
          pointerEvents: 'auto'
        }}
        {...sharedProps}
      />
    );
  }

  // Móvil: telón sutil de atenuación estilo iOS Action Sheet sin caja azul falsa
  const effectiveBg = background ?? (isDark ? 'rgba(0, 0, 0, 0.40)' : 'rgba(0, 0, 0, 0.25)');
  const effectiveBlur = blur ?? 'blur(6px)';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        background: effectiveBg,
        backdropFilter: effectiveBlur,
        WebkitBackdropFilter: effectiveBlur,
        pointerEvents: 'auto'
      }}
      {...sharedProps}
    />
  );
}
