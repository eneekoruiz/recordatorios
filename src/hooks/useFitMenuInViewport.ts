import { useLayoutEffect } from 'react';
import type { RefObject } from 'react';
import type { SpotlightRect } from '../components/ui/SpotlightBackdrop';

/**
 * Menú flotante del escritorio:
 * - NUNCA se solapa con el elemento que lo activó (trigger: tarea o sección).
 * - Si cabe debajo del trigger, se coloca abajo (top = trigger.bottom + 6).
 * - Si cabe arriba, se coloca arriba (bottom = trigger.top - 6).
 * - Si no cabe completo en ninguno de los dos lados, se coloca en el lado con más espacio
 *   disponible y se ajusta su maxHeight con scroll interno, garantizando que el elemento
 *   activador permanezca 100% visible e intacto en su posición.
 * - Asegura que horizontalmente tampoco se salga de la pantalla.
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
    const gap = 6;

    // Posición pedida inicialmente por el componente
    const wantedTop = parseFloat(el.style.top) || 0;
    const wantedLeft = parseFloat(el.style.left) || margin;

    const fit = () => {
      const viewportH = window.innerHeight;
      const viewportW = window.innerWidth;
      const menuWidth = el.offsetWidth || 260;
      const menuHeight = el.scrollHeight;

      // 1. Ajuste horizontal: dentro de los márgenes de la pantalla
      const left = Math.max(margin, Math.min(wantedLeft, viewportW - menuWidth - margin));
      el.style.left = `${left}px`;

      // 2. Ajuste vertical
      if (trigger && trigger.height > 0) {
        const triggerTop = trigger.top;
        const triggerBottom = trigger.top + trigger.height;

        const spaceBelow = Math.max(0, viewportH - (triggerBottom + gap) - margin);
        const spaceAbove = Math.max(0, triggerTop - gap - margin);

        // ¿Prefiere abajo o arriba el invocador?
        const prefersBelow = wantedTop >= triggerBottom - 1;

        let placeBelow = true;
        if (prefersBelow) {
          if (spaceBelow >= menuHeight) {
            placeBelow = true;
          } else if (spaceAbove >= menuHeight) {
            placeBelow = false;
          } else {
            // Ningún lado tiene espacio completo: elegir el lado con más espacio disponible
            placeBelow = spaceBelow >= spaceAbove;
          }
        } else {
          if (spaceAbove >= menuHeight) {
            placeBelow = false;
          } else if (spaceBelow >= menuHeight) {
            placeBelow = true;
          } else {
            placeBelow = spaceBelow > spaceAbove;
          }
        }

        if (placeBelow) {
          const top = triggerBottom + gap;
          const maxH = Math.max(120, spaceBelow);
          el.style.top = `${top}px`;
          el.style.maxHeight = `${maxH}px`;
        } else {
          const maxH = Math.max(120, spaceAbove);
          const actualH = Math.min(menuHeight, maxH);
          const top = triggerTop - gap - actualH;
          el.style.top = `${top}px`;
          el.style.maxHeight = `${maxH}px`;
        }
      } else {
        // Sin trigger: ajuste clásico dentro del viewport
        let top = wantedTop;
        if (top < margin || top + menuHeight > viewportH - margin) {
          top = Math.max(margin, Math.min(wantedTop, viewportH - menuHeight - margin));
        }
        el.style.top = `${top}px`;
        el.style.maxHeight = `${Math.max(120, viewportH - top - margin)}px`;
      }
    };

    fit();
    const observer = new ResizeObserver(fit);
    for (const child of Array.from(el.children)) observer.observe(child);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, trigger, enabled]);
}
