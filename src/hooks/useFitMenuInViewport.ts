import { useLayoutEffect } from 'react';
import type { RefObject } from 'react';
import type { SpotlightRect } from '../components/ui/SpotlightBackdrop';

/**
 * Menú flotante del escritorio: con su altura real (no una estimación), si no cabe debajo de lo
 * que lo abrió se coloca encima, y si tampoco, pegado al borde de la pantalla. Así nunca se corta.
 * Vuelve a encajarlo si cambia de tamaño (p. ej. al entrar en un submenú).
 */
export function useFitMenuInViewport(
  ref: RefObject<HTMLElement | null>,
  trigger: SpotlightRect | null | undefined,
  enabled: boolean,
) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const margin = 12;
    // Posición pedida por el componente, antes de corregirla (si no, se corregiría sobre lo corregido).
    const wantedTop = parseFloat(el.style.top) || 0;
    const fit = () => {
      const height = el.scrollHeight;
      const viewportH = window.innerHeight;
      let top = wantedTop;
      if (top < margin || top + height > viewportH - margin) {
        const above = trigger ? trigger.top - height - 6 : -1;
        top = above >= margin ? above : Math.max(margin, Math.min(wantedTop, viewportH - height - margin));
      }
      el.style.top = `${top}px`;
      el.style.maxHeight = `${viewportH - top - margin}px`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    for (const child of Array.from(el.children)) observer.observe(child);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, trigger, enabled]);
}
