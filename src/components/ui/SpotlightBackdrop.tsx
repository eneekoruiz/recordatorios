import React, { useEffect, useEffectEvent, useRef, useState } from 'react';
import { motion, useIsPresent, useReducedMotion } from 'framer-motion';

export interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface SpotlightBackdropProps {
  /** Área a mantener nítida mientras el menú está abierto (foto inicial). */
  rect: SpotlightRect | null;
  /** Elemento seleccionado: si se da, el hueco lo sigue aunque la lista se desplace. */
  getTarget?: () => HTMLElement | null;
  /** Hoja inferior del móvil: si tapa el elemento, la lista se desplaza para dejarlo a la vista. */
  sheetRef?: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  onWheel?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  zIndex?: number;
  /** Margen alrededor del elemento seleccionado. */
  padding?: number;
  /** Radio de esquina del hueco, a juego con el elemento. */
  radius?: number;
  background?: string;
  blur?: string;
}

const sameRect = (a: SpotlightRect | null, b: SpotlightRect | null) =>
  Boolean(a && b && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5);

const toRect = (r: DOMRect): SpotlightRect => ({ top: r.top, left: r.left, width: r.width, height: r.height });

// El contenedor con desplazamiento, aunque ahora quepa todo (se le da hueco abajo si hace falta).
function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node && node !== document.body) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
    node = node.parentElement;
  }
  return null;
}

// Listas levantadas para dejar el elemento sobre la hoja (con sus estilos previos).
const lifted = new WeakMap<HTMLElement, { transform: string; transition: string; token: number }>();
const LIFT_MS = 420;
const LIFT_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

/** Rectángulo redondeado como subtrazado SVG (para recortar el hueco del telón). */
function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}` +
    `H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
}

/**
 * Telón de los menús contextuales, como en iOS: todo se desenfoca y se atenúa menos el
 * elemento seleccionado, que queda nítido en un hueco redondeado para centrarse en él.
 * Pulsar fuera (o sobre el propio elemento) cierra el menú; el fondo no se desplaza.
 */
export function SpotlightBackdrop({
  rect: initialRect,
  getTarget,
  sheetRef,
  onClose,
  onWheel,
  onContextMenu,
  zIndex = 999990,
  padding = 4,
  radius = 12,
  background,
  blur,
}: SpotlightBackdropProps) {
  const reduceMotion = useReducedMotion();
  const isDark = typeof document !== 'undefined' && (
    document.documentElement.getAttribute('data-theme') === 'dark' || document.body.classList.contains('dark')
  );
  const [rect, setRect] = useState<SpotlightRect | null>(initialRect);
  const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  // Siempre la función más reciente, sin volver a lanzar los efectos en cada render.
  const readTarget = useEffectEvent(() => getTarget?.() ?? null);
  const readSheet = useEffectEvent(() => sheetRef?.current ?? null);

  // Seguir al elemento: con cada desplazamiento y, mientras la lista sube o baja, en cada fotograma.
  const trackRef = useRef<(ms: number) => void>(() => {});
  useEffect(() => {
    let frame = 0;
    let trackUntil = 0;
    const measureNow = () => {
      const el = readTarget();
      if (!el) return;
      const next = toRect(el.getBoundingClientRect());
      setRect((prev) => (sameRect(prev, next) ? prev : next));
    };
    const loop = () => {
      measureNow();
      frame = performance.now() < trackUntil ? requestAnimationFrame(loop) : 0;
    };
    const measure = () => {
      if (frame) return;
      frame = requestAnimationFrame(loop);
    };
    trackRef.current = (ms: number) => {
      trackUntil = Math.max(trackUntil, performance.now() + ms);
      measure();
    };
    const onResize = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
      measure();
    };
    window.addEventListener('scroll', measure, { capture: true, passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(frame);
      trackRef.current = () => {};
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // Móvil: si la hoja tapa el elemento, la lista sube lo justo para verlo (como la vista previa de
  // iOS) y baja a su sitio al cerrar. Se mueve con transform: vale también en listas cortas.
  // (Efecto pasivo: la referencia de la hoja, hermana del telón, ya está puesta.)
  const restoreLiftRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const sheet = readSheet();
    const el = readTarget();
    if (!sheet || !el) return;
    // Se mueve el contenido de la lista (no la lista): así queda recortado bajo la cabecera.
    const scrollParent = getScrollParent(el);
    const scroller = (scrollParent?.firstElementChild as HTMLElement | null) ?? scrollParent;
    if (!scroller) return;
    const sheetTop = window.innerHeight - sheet.offsetHeight;
    const target = el.getBoundingClientRect();
    const shift = Math.round(Math.min(target.bottom - (sheetTop - 12), target.top - 64));
    if (shift <= 0) return;
    const saved = lifted.get(scroller) ?? { transform: scroller.style.transform, transition: scroller.style.transition, token: 0 };
    const token = saved.token + 1;
    lifted.set(scroller, { ...saved, token });
    scroller.style.transition = reduceMotion ? 'none' : `transform ${LIFT_MS}ms ${LIFT_EASE}`;
    scroller.style.transform = `translateY(${-shift}px)`;
    trackRef.current(LIFT_MS + 40);
    let restored = false;
    const restore = () => {
      if (restored) return;
      restored = true;
      scroller.style.transform = saved.transform;
      trackRef.current(LIFT_MS + 40);
      window.setTimeout(() => {
        const now = lifted.get(scroller);
        if (!now || now.token !== token) return;
        scroller.style.transition = saved.transition;
        lifted.delete(scroller);
      }, reduceMotion ? 0 : LIFT_MS + 40);
    };
    restoreLiftRef.current = restore;
    return restore;
  }, [reduceMotion]);

  // Al empezar a cerrarse (AnimatePresence), la lista vuelve ya, a la vez que se va el telón.
  const isPresent = useIsPresent();
  useEffect(() => {
    if (!isPresent) restoreLiftRef.current?.();
  }, [isPresent]);

  // Sin desplazar el fondo mientras el menú está abierto
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
    onContextMenu: onContextMenu ?? ((e: React.MouseEvent) => { e.preventDefault(); onClose(); }),
  };

  const effectiveBg = background ?? (isDark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0.18)');
  const effectiveBlur = blur ?? 'blur(14px) saturate(140%)';

  // En el móvil, las filas de lado a lado quedan como una tarjeta flotante, separada del borde.
  const edge = sheetRef ? 8 : 0;
  const hole = rect ? (() => {
    const x = Math.max(edge, rect.left - padding);
    const y = Math.max(0, rect.top - padding);
    const w = Math.min(viewport.w - edge, rect.left + rect.width + padding) - x;
    const h = Math.min(viewport.h - y, rect.height + padding * 2);
    if (w <= 0 || h <= 0) return null;
    return { x, y, w, h, r: Math.max(0, Math.min(radius, w / 2, h / 2)) };
  })() : null;

  const clipPath = hole
    ? `path(evenodd, '${`M0 0H${viewport.w}V${viewport.h}H0Z`}${roundedRectPath(hole.x, hole.y, hole.w, hole.h, hole.r)}')`
    : undefined;

  const fade = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: reduceMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] as const },
  };

  return (
    <>
      <motion.div
        {...fade}
        aria-hidden="true"
        data-spotlight-backdrop=""
        style={{
          position: 'fixed',
          inset: 0,
          zIndex,
          background: effectiveBg,
          backdropFilter: effectiveBlur,
          WebkitBackdropFilter: effectiveBlur,
          clipPath,
          WebkitClipPath: clipPath,
          touchAction: 'none',
          overscrollBehavior: 'contain',
          pointerEvents: 'auto',
        }}
        {...sharedProps}
      />
      {hole && (
        <>
          {/* Sombra suave alrededor del hueco: el elemento parece levantarse del fondo */}
          <motion.div
            {...fade}
            aria-hidden="true"
            style={{
              position: 'fixed',
              top: hole.y,
              left: hole.x,
              width: hole.w,
              height: hole.h,
              borderRadius: hole.r,
              zIndex: zIndex + 1,
              boxShadow: isDark
                ? '0 0 0 0.5px rgba(255,255,255,0.12), 0 16px 48px rgba(0,0,0,0.5)'
                : '0 0 0 0.5px rgba(0,0,0,0.06), 0 16px 48px rgba(0,0,0,0.16)',
              pointerEvents: 'none',
            }}
          />
          {/* Pulsar sobre el elemento seleccionado también cierra el menú (queda bajo el menú) */}
          <div
            aria-hidden="true"
            style={{
              position: 'fixed',
              top: hole.y,
              left: hole.x,
              width: hole.w,
              height: hole.h,
              zIndex: zIndex + 3,
              background: 'transparent',
              touchAction: 'none',
            }}
            {...sharedProps}
          />
        </>
      )}
    </>
  );
}
