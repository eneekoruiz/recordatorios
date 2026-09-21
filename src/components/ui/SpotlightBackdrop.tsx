import React from 'react';

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
 * Telón de fondo con desenfoque para menús contextuales (tarea, sección, lista…)
 * que recorta un "hueco" nítido exactamente sobre el elemento que ha abierto el
 * menú, para que siempre quede claro cuál es el seleccionado mientras el resto
 * de la interfaz se atenúa. Sin `rect` se comporta como un telón normal.
 */
export function SpotlightBackdrop({
  rect,
  onClose,
  onWheel,
  onContextMenu,
  zIndex = 999990,
  padding = 6,
  radius = 14,
  background = 'rgba(0, 0, 0, 0.14)',
  blur = 'blur(8px)'
}: SpotlightBackdropProps) {
  const sharedProps = {
    onClick: onClose,
    onWheel,
    onContextMenu: onContextMenu ?? ((e: React.MouseEvent) => { e.preventDefault(); onClose(); })
  };

  if (!rect) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex,
          background,
          backdropFilter: blur,
          WebkitBackdropFilter: blur
        }}
        {...sharedProps}
      />
    );
  }

  const x = Math.max(0, rect.left - padding);
  const y = Math.max(0, rect.top - padding);
  const w = rect.width + padding * 2;
  const h = rect.height + padding * 2;
  // Use a large safe value (9999) instead of snapshotting window dimensions —
  // this guarantees the backdrop always covers the full viewport regardless of
  // orientation changes that happen after the component renders.
  const vw = 9999;
  const vh = 9999;
  const r = Math.min(radius, w / 2, h / 2);

  // Rectángulo del telón completo menos un rectángulo redondeado "hueco"
  // (regla evenodd: la intersección de ambos trazados queda sin pintar).
  const holePath = `M${x + r},${y} H${x + w - r} A${r},${r} 0 0 1 ${x + w},${y + r} V${y + h - r} A${r},${r} 0 0 1 ${x + w - r},${y + h} H${x + r} A${r},${r} 0 0 1 ${x},${y + h - r} V${y + r} A${r},${r} 0 0 1 ${x + r},${y} Z`;
  const clipPath = `path(evenodd, "M0,0 H${vw} V${vh} H0 Z ${holePath}")`;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex,
          background,
          backdropFilter: blur,
          WebkitBackdropFilter: blur,
          clipPath,
          WebkitClipPath: clipPath
        }}
        {...sharedProps}
      />
      {/* Anillo decorativo alrededor del elemento nítido, para remarcar la selección */}
      <div
        style={{
          position: 'fixed',
          top: y,
          left: x,
          width: w,
          height: h,
          borderRadius: r,
          zIndex: zIndex + 1,
          boxShadow: '0 0 0 1.5px rgba(255,255,255,0.16), 0 12px 32px rgba(0,0,0,0.28)',
          pointerEvents: 'none'
        }}
      />
      {/* Captador de clics transparente sobre el hueco: mismo comportamiento que clicar el telón */}
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
