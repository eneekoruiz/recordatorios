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
  rect,
  onClose,
  onWheel,
  onContextMenu,
  zIndex = 999990,
  padding = 4,
  radius = 12,
  background,
  blur = 'blur(20px)'
}: SpotlightBackdropProps) {
  const isDark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
  const effectiveBg = background ?? (isDark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0.18)');

  // Bloqueo total de la pantalla detrás mientras el menú está abierto
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.overscrollBehavior = prevOverscroll;
    };
  }, []);

  const sharedProps = {
    onClick: onClose,
    onWheel: onWheel ?? ((e: React.WheelEvent) => { e.preventDefault(); onClose(); }),
    onContextMenu: onContextMenu ?? ((e: React.MouseEvent) => { e.preventDefault(); onClose(); })
  };

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex,
    background: effectiveBg,
    backdropFilter: blur,
    WebkitBackdropFilter: blur,
    pointerEvents: 'auto'
  };

  if (!rect) {
    return (
      <div
        style={{
          ...panelStyle,
          inset: 0
        }}
        {...sharedProps}
      />
    );
  }

  const x = Math.max(0, rect.left - padding);
  const y = Math.max(0, rect.top - padding);
  const w = rect.width + padding * 2;
  const h = rect.height + padding * 2;
  const r = Math.min(radius, w / 2, h / 2);

  return (
    <>
      {/* Telón cinematográfico continuo: 1 único plano para garantizar cero cortes ni líneas en el blur */}
      <div
        style={{
          ...panelStyle,
          inset: 0
        }}
        {...sharedProps}
      />

      {/* Sutil halo Apple suave sobre el elemento seleccionado */}
      <div
        style={{
          position: 'fixed',
          top: y,
          left: x,
          width: w,
          height: h,
          borderRadius: r,
          zIndex: zIndex + 1,
          boxShadow: '0 0 0 1.5px var(--accent-primary, #007aff), 0 14px 44px rgba(0,0,0,0.22)',
          pointerEvents: 'none',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      />

      {/* Captador de clics sobre el elemento enfocado: pulsar fuera del menú cierra */}
      <div
        style={{
          position: 'fixed',
          top: y,
          left: x,
          width: w,
          height: h,
          zIndex: zIndex + 1,
          background: 'transparent'
        }}
        {...sharedProps}
      />
    </>
  );
}
