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
