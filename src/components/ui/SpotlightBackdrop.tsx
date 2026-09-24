import React, { useEffect } from 'react';

export interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface SpotlightBackdropProps {
  /** Área a mantener nítida (sin desenfoque) mientras el menú está abierto. `null` = telón completo, sin recorte. */
  rect: SpotlightRect | null;
  onClose: () => void;
  onWheel?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  zIndex?: number;
  /** Margen alrededor del elemento seleccionado antes de aplicar el desenfoque. */
  padding?: number;
  /** Radio de esquina del "hueco", a juego con el elemento resaltado. */
  radius?: number;
  background?: string;
  blur?: string;
}

/**
 * Telón de fondo con desenfoque cinematográfico para menús contextuales.
 * Bloquea la interacción y el scroll de fondo mientras el menú está activo,
 * y enmarca nítidamente el elemento seleccionado con cero parpadeos (0 flicker).
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
  blur = 'blur(16px)'
}: SpotlightBackdropProps) {
  const isDark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
  const effectiveBg = background ?? (isDark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0.20)');

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
      {/* Panel Superior */}
      <div
        style={{
          ...panelStyle,
          top: 0,
          left: 0,
          right: 0,
          height: y
        }}
        {...sharedProps}
      />

      {/* Panel Inferior */}
      <div
        style={{
          ...panelStyle,
          top: y + h,
          left: 0,
          right: 0,
          bottom: 0
        }}
        {...sharedProps}
      />

      {/* Panel Izquierdo */}
      <div
        style={{
          ...panelStyle,
          top: y,
          left: 0,
          width: x,
          height: h
        }}
        {...sharedProps}
      />

      {/* Panel Derecho */}
      <div
        style={{
          ...panelStyle,
          top: y,
          left: x + w,
          right: 0,
          height: h
        }}
        {...sharedProps}
      />

      {/* Anillo de resalte Apple alrededor del elemento enfocado */}
      <div
        style={{
          position: 'fixed',
          top: y,
          left: x,
          width: w,
          height: h,
          borderRadius: r,
          zIndex: zIndex + 1,
          boxShadow: '0 0 0 1.5px var(--accent-primary, #007aff), 0 8px 32px rgba(0,0,0,0.18)',
          pointerEvents: 'none'
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
