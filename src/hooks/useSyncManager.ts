import { useEffect } from 'react';
import { syncManager } from '../sync/syncManager';
import { syncSharedStatus } from '../services/ShareService';

export function useSyncManager(token: string | null) {
  // ── Sync Manager lifecycle and listeners ──────────────────────────
  useEffect(() => {
    if (token) {
      syncManager.start();
      syncSharedStatus();
      
      const handleFocusOrVisible = () => {
        if (document.visibilityState === 'visible') {
          syncManager.syncNow();
          syncSharedStatus();
        }
      };
      
      window.addEventListener('focus', handleFocusOrVisible);
      document.addEventListener('visibilitychange', handleFocusOrVisible);
      
      return () => {
        window.removeEventListener('focus', handleFocusOrVisible);
        document.removeEventListener('visibilitychange', handleFocusOrVisible);
        syncManager.stop();
      };
    }
  }, [token]);
}
