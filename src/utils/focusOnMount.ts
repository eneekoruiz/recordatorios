/**
 * Sustituto de `autoFocus` dentro de hojas y modales: enfoca al montar sin desplazar la página.
 * React llama a focus() sin `preventScroll` y, mientras la hoja sube desde abajo, iOS Safari desplaza
 * la página para mostrar el campo (la hoja parecía irse hacia arriba y volver). Es una función estable
 * a propósito: como `ref`, React solo la llama al montar y al desmontar.
 */
export function focusOnMount(element: HTMLElement | null) {
  element?.focus({ preventScroll: true });
}
