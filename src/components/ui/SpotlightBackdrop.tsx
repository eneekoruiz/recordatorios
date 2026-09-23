import React, { useId } from 'react';

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
 * de la interfaz se atenúa con un blur cinematográfico estilo iOS/macOS.
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
  blur = 'blur(12px)'
}: SpotlightBackdropProps) {
  const clipId = useId().replace(/:/g, '_');
  const isDark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
  const effectiveBg = background ?? (isDark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0.18)');

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
          background: effectiveBg,
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
  const clipPathD = `M0,0 H${vw} V${vh} H0 Z ${holePath}`;

  return (
    <>
      {/* SVG Defs para garantizar soporte total de clip-rule: evenodd en todos los navegadores */}
      <svg width="0" height="0" style={{ position: 'fixed', top: 0, left: 0, pointerEvents: 'none', opacity: 0, zIndex: -1 }}>
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <path clipRule="evenodd" fillRule="evenodd" d={clipPathD} />
          </clipPath>
        </defs>
      </svg>

      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex,
          background: effectiveBg,
          backdropFilter: blur,
          WebkitBackdropFilter: blur,
          clipPath: `url(#${clipId})`,
          WebkitClipPath: `url(#${clipId})`
        }}
        {...sharedProps}
      />
      {/* Anillo decorativo sutil alrededor del elemento nítido, para remarcar la selección */}
      <div
        style={{
          position: 'fixed',
          top: y,
          left: x,
          width: w,
          height: h,
          borderRadius: r,
          zIndex: zIndex + 1,
          boxShadow: '0 0 0 1.5px rgba(255,255,255,0.25), 0 8px 32px rgba(0,0,0,0.2)',
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
