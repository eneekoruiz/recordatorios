import { useEffect, useRef, type RefObject } from 'react';

const layers: Array<{ element: HTMLElement; restore: HTMLElement | null }> = [];
let lastOutsideFocus: HTMLElement | null = null;
if (typeof document !== 'undefined') {
  document.addEventListener('focusin', event => {
    const target = event.target;
    if (target instanceof HTMLElement && !target.closest('[role="dialog"], [role="alertdialog"], [role="listbox"]')) lastOutsideFocus = target;
  });
}
export const isTopmostModal = (element: HTMLElement | null) => !layers.length || layers.at(-1)?.element === element;
const selector = 'button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';
const targets = (element: HTMLElement) => Array.from(element.querySelectorAll<HTMLElement>(selector))
  .filter(node => !node.matches(':disabled, [aria-disabled="true"]') && !node.closest('[hidden], [inert], [aria-hidden="true"]') && node.getClientRects().length > 0);

/** Keep keyboard interaction in the active sheet; nested sheets close independently. */
export function useModalFocus<T extends HTMLElement>(ref: RefObject<T | null>, open: boolean, onClose: () => void) {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  useEffect(() => {
    const element = ref.current;
    if (!open || !element) return;
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // React autoFocus runs during commit, before this effect; retain the actual opener.
    const layer = { element, restore: active && !element.contains(active) ? active : lastOutsideFocus };
    layers.push(layer);
    const previousTabIndex = element.getAttribute('tabindex');
    if (previousTabIndex === null) element.tabIndex = -1;
    const frame = requestAnimationFrame(() => {
      if (layers.at(-1) === layer && !element.contains(document.activeElement)) (targets(element)[0] ?? element).focus();
    });
    const handleKey = (event: KeyboardEvent) => {
      if (layers.at(-1) !== layer) return;
      // A portaled select owns its keyboard handling until it is dismissed.
      const popup = Array.from(document.querySelectorAll<HTMLElement>('.premium-select-menu[role="listbox"]')).find(node => node.getClientRects().length > 0);
      if (popup) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        close.current();
      } else if (event.key === 'Tab') {
        const items = targets(element);
        const first = items[0] ?? element;
        const last = items.at(-1) ?? element;
        const active = document.activeElement;
        if (!element.contains(active) || (event.shiftKey ? active === first : active === last) || items.length === 0) {
          event.preventDefault();
          event.stopImmediatePropagation();
          (event.shiftKey ? last : first).focus();
        }
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', handleKey, true);
      const index = layers.indexOf(layer);
      if (index >= 0) layers.splice(index, 1);
      if (previousTabIndex === null) element.removeAttribute('tabindex');
      queueMicrotask(() => {
        const current = document.activeElement;
        if (current !== document.body && current instanceof HTMLElement && current.isConnected && !element.contains(current)) return;
        const next = layers.at(-1)?.element;
        if (layer.restore?.isConnected && (!next || next.contains(layer.restore))) layer.restore.focus();
        else if (next) (targets(next)[0] ?? next).focus();
      });
    };
  }, [ref, open]);
}
