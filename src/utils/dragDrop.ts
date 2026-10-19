// Arrastrar para reordenar o anidar (tareas y secciones): una sola definición de las zonas
// y del umbral de movimiento, para que las dos sensaciones (soltar aquí vs. anidar dentro)
// se comporten y se vean igual en toda la app.

/**
 * Zona de la fila sobre la que se suelta, según la posición relativa (0 = arriba, 1 = abajo).
 * Anidar («inside») solo en la franja central, más pequeña que las de reordenar: así reordenar
 * es fácil de acertar y anidar es un gesto deliberado, no un accidente por unos píxeles de más.
 */
export function classifyDropZone(relY: number): 'top' | 'bottom' | 'inside' {
  if (relY < 0.35) return 'top';
  if (relY > 0.65) return 'bottom';
  return 'inside';
}

/** Movimiento (en píxeles) a partir del cual un toque mantenido pasa a ser un arrastre. Por
 * debajo, se trata como pulsación quieta (tiembla la mano, pero la intención es abrir el menú). */
export const DRAG_MOVE_THRESHOLD_PX = 10;

/** Alto del hueco que se abre en la lista para reordenar (tareas y secciones): en vez de una
 * línea o recuadro superpuestos, el propio espacio "se abre camino" hasta el punto de soltar. */
export const DROP_GAP_PX = 14;

/** Contenedor que se desplaza (la lista); si no hay ninguno, la ventana. */
export function findScrollableParent(el: HTMLElement | null): HTMLElement | Window {
  let parent = el?.parentElement;
  while (parent) {
    const style = window.getComputedStyle(parent);
    if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return window;
}

const scrollTopOf = (scroller: HTMLElement | Window) =>
  scroller === window ? window.scrollY : (scroller as HTMLElement).scrollTop;

/**
 * Parte visible de la lista mientras se arrastra. La barra «Nuevo recordatorio» (abajo) y la
 * barra de cristal (arriba) flotan sobre la lista: el borde útil para desplazar es el suyo, no
 * el de la ventana; si no, la zona que activa el desplazamiento queda tapada y nunca se alcanza.
 */
export function getVisibleListBounds(scroller: HTMLElement | Window): { top: number; bottom: number } {
  const base = scroller === window
    ? { top: 0, bottom: window.innerHeight }
    : (scroller as HTMLElement).getBoundingClientRect();
  let { top, bottom } = base;
  const bar = document.querySelector<HTMLElement>('.quick-add-shell');
  const barRect = bar?.getBoundingClientRect();
  if (barRect && barRect.height > 0 && barRect.top < bottom && barRect.top > top + (bottom - top) / 2) {
    bottom = barRect.top;
  }
  const header = document.querySelector<HTMLElement>('.glass-header');
  const headerRect = header?.getBoundingClientRect();
  if (headerRect && headerRect.height > 0 && headerRect.bottom > top && headerRect.bottom < top + (bottom - top) / 2) {
    top = headerRect.bottom;
  }
  return { top, bottom };
}

export const AUTO_SCROLL_EDGE_PX = 72;
const AUTO_SCROLL_MAX_PX = 18;

/**
 * Desplaza la lista sola mientras el dedo o el ratón están cerca de su borde superior o
 * inferior (o ya fuera de ella, sobre la barra inferior). Cuanto más cerca del borde, más
 * rápido. `onScroll` se llama tras cada paso para recalcular dónde se soltaría: con el dedo
 * quieto, las filas siguen pasando por debajo.
 */
export function createEdgeAutoScroll(scroller: HTMLElement | Window, onScroll?: () => void) {
  let speed = 0;
  let raf = 0;
  // La lista tiene scroll-behavior: smooth y cada paso suave anularía al anterior. Se fuerza «auto»
  // mientras dura el arrastre (en vez de scrollBy({ behavior: 'instant' }), que Safari no siempre admite).
  const target = scroller === window ? document.documentElement : (scroller as HTMLElement);
  const previousBehavior = target.style.scrollBehavior;
  target.style.scrollBehavior = 'auto';
  const step = () => {
    raf = 0;
    if (!speed) return;
    const before = scrollTopOf(scroller);
    if (scroller === window) window.scrollTo(0, before + speed);
    else (scroller as HTMLElement).scrollTop = before + speed;
    if (scrollTopOf(scroller) !== before) onScroll?.();
    raf = requestAnimationFrame(step);
  };
  return {
    update(clientY: number) {
      const { top, bottom } = getVisibleListBounds(scroller);
      const ratio = clientY < top + AUTO_SCROLL_EDGE_PX
        ? -Math.min(1, (top + AUTO_SCROLL_EDGE_PX - clientY) / AUTO_SCROLL_EDGE_PX)
        : clientY > bottom - AUTO_SCROLL_EDGE_PX
          ? Math.min(1, (clientY - (bottom - AUTO_SCROLL_EDGE_PX)) / AUTO_SCROLL_EDGE_PX)
          : 0;
      speed = ratio === 0 ? 0 : Math.sign(ratio) * (2 + (AUTO_SCROLL_MAX_PX - 2) * ratio * ratio);
      if (speed && !raf) raf = requestAnimationFrame(step);
    },
    stop() {
      speed = 0;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      target.style.scrollBehavior = previousBehavior;
    },
  };
}

/**
 * iOS (WebKit) decide al empezar el toque si la página puede desplazarse por su cuenta: si en ese
 * momento no hay ninguna escucha `touchmove` no pasiva bajo el dedo, el scroll nativo corre en paralelo
 * y un preventDefault posterior ya no lo para (React registra las suyas como pasivas). Por eso, al
 * arrastrar un recordatorio hacia abajo la lista subía, y al revés. Esta escucha vive en la fila desde
 * el principio y solo cancela el scroll cuando la pulsación larga ya ha «armado» el arrastre.
 */
export function guardNativeScroll(el: HTMLElement, isArmed: () => boolean): () => void {
  const onMove = (event: TouchEvent) => {
    if (isArmed() && event.cancelable) event.preventDefault();
  };
  el.addEventListener('touchmove', onMove, { passive: false });
  return () => el.removeEventListener('touchmove', onMove);
}

/**
 * Copia que sigue al dedo, como al reordenar en Recordatorios de iOS: opaca, levantada con una sombra
 * suave y sujeta por el mismo punto por el que se cogió (no salta a centrarse bajo el dedo).
 */
export function createDragGhost(source: HTMLElement, pointerY: number, stripAttributes: string[] = []) {
  const rect = source.getBoundingClientRect();
  const grabOffset = Math.min(Math.max(pointerY - rect.top, 0), rect.height);
  const clone = source.cloneNode(true) as HTMLElement;
  for (const attribute of [...stripAttributes, 'data-touch-drag-over', 'data-section-drag-over', 'data-task-drop-section', 'data-drag-over-pos']) {
    clone.removeAttribute(attribute);
  }
  clone.style.margin = '0';
  clone.style.opacity = '1';
  const ghost = document.createElement('div');
  ghost.setAttribute('data-drag-ghost', 'true');
  ghost.className = 'drag-ghost';
  ghost.style.left = `${rect.left}px`;
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  ghost.style.top = `${pointerY - grabOffset}px`;
  ghost.appendChild(clone);
  document.body.appendChild(ghost);
  // Un fotograma después: así la transición de «levantar» (escala y sombra) se ve.
  requestAnimationFrame(() => ghost.classList.add('is-lifted'));
  return {
    move(y: number) { ghost.style.top = `${y - grabOffset}px`; },
    remove() { ghost.remove(); },
  };
}

/**
 * Posición vertical (0 = arriba, 1 = abajo) del puntero dentro de una fila, sin contar el hueco que
 * la propia fila abre encima (margin-top animado): ese hueco la desplaza hacia abajo y, si contara,
 * la fila «huiría» del dedo y no se podría llegar a su centro (anidar) ni a su borde inferior.
 * Se mide en vivo, así que sigue bien a la fila si la lista se desplaza o se cierra otro hueco.
 */
export function relativeYInRow(el: HTMLElement, clientY: number): number {
  const rect = el.getBoundingClientRect();
  const ownGap = parseFloat(window.getComputedStyle(el).marginTop) || 0;
  return (clientY - (rect.top - ownGap)) / rect.height;
}

/**
 * Fila de destino bajo el puntero. Se recorren todas las capas (no solo la de arriba): al empezar a
 * arrastrar, el menú contextual de la pulsación larga aún se está cerrando por encima de la lista.
 */
export function dropTargetAt(x: number, y: number, selector: string): HTMLElement | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const row = (el as HTMLElement).closest<HTMLElement>(selector);
    if (row) return row;
  }
  return null;
}
