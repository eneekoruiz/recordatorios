// Tecla de comando según el sistema: ⌘ en Apple, Ctrl en el resto.
export const isApplePlatform = (): boolean =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);

export const modKey = (): string => (isApplePlatform() ? '⌘' : 'Ctrl');

/** "⌘K" en Mac · "Ctrl+K" en Windows/Linux. */
export const modShortcut = (key: string): string => (isApplePlatform() ? `⌘${key}` : `Ctrl+${key}`);
