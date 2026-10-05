import { lazy, type ComponentType } from 'react';

/**
 * Resilient lazy loader for dynamic imports.
 * Automatically recovers from:
 * 1. Stale chunk hashes after deployments on Vercel / PWA.
 * 2. MIME type mismatch errors (server returning index.html for missing JS chunks).
 * 3. Network glitches during module fetching.
 */
export function lazyWithRetry<T extends Record<string, any>>(
  componentImport: () => Promise<T>,
  name?: keyof T
): React.LazyExoticComponent<ComponentType<any>> {
  return lazy(async () => {
    const hasRetried = typeof window !== 'undefined' && sessionStorage.getItem('chunk_reload_retry') === 'true';

    try {
      const module = await componentImport();
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('chunk_reload_retry');
      }
      const component = name ? module[name] : (module.default || module);
      return { default: component };
    } catch (error: any) {
      const errorMessage = String(error?.message || error || '');
      const isChunkOrMimeError =
        errorMessage.includes('Failed to fetch dynamically imported module') ||
        errorMessage.includes('MIME type') ||
        errorMessage.includes('Loading chunk') ||
        errorMessage.includes('Failed to load module script') ||
        error?.name === 'ChunkLoadError';

      console.warn('[lazyWithRetry] Error importing component chunk:', error);

      if (isChunkOrMimeError && !hasRetried && typeof window !== 'undefined') {
        sessionStorage.setItem('chunk_reload_retry', 'true');
        // Force refresh from server without cache
        window.location.reload();
        // Return a pending promise to prevent React rendering crash during navigation
        return new Promise(() => {});
      }

      throw error;
    }
  });
}
