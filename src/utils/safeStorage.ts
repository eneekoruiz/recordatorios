/**
 * Utilidades de almacenamiento local seguro.
 * Inmune a modos de incógnito restrictivos, cuotas excedidas y datos corruptos.
 */

export function safeGetJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn(`[safeStorage] Error al leer "${key}":`, err);
    }
    return fallback;
  }
}

export function safeSetJSON<T>(key: string, value: T): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn(`[safeStorage] Error al persistir "${key}":`, err);
    }
    return false;
  }
}

export function safeGetItem(key: string, fallback = ''): string {
  if (typeof window === 'undefined' || !window.localStorage) return fallback;
  try {
    const val = localStorage.getItem(key);
    return val !== null ? val : fallback;
  } catch {
    return fallback;
  }
}

export function safeSetItem(key: string, value: string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
