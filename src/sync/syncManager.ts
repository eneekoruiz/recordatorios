import { useAppStore } from '../store/useAppStore';
import type { TaskItem } from '../models/Task';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');
const PULL_URL = `${API_BASE}/api/sync/pull`;
const PUSH_URL = `${API_BASE}/api/sync/push`;
const SYNC_INTERVAL_MS = 30 * 1000; // 30 seconds

class SyncManager {
  private syncInterval: any = null;
  private isSyncing = false;
  private isOnline = navigator.onLine;
  private eventSource: EventSource | null = null;
  private debounceTimeout: any = null;

  triggerDebouncedSync() {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
    this.debounceTimeout = setTimeout(() => {
      this.syncNow();
    }, 1000); // 1-second debounce to group batch edits
  }

  constructor() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncNow();
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  start() {
    if (this.syncInterval) return;
    this.syncInterval = setInterval(() => this.syncNow(), SYNC_INTERVAL_MS);
    this.syncNow();
  }

  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  private setupRealtime(token: string) {
    if (this.eventSource) {
      this.eventSource.close();
    }

    const url = `${API_BASE}/api/sync/live?token=${encodeURIComponent(token)}`;
    this.eventSource = new EventSource(url);

    this.eventSource.onmessage = (event) => {
      if (event.data === 'check_sync') {
        this.pull(token).catch(err => console.error('Silent pull failed:', err));
      }
    };

    this.eventSource.onerror = () => {
      this.eventSource?.close();
      this.eventSource = null;
      // Reconnect after 5s if still logged in
      setTimeout(() => {
        const currentToken = useAppStore.getState().token;
        if (currentToken && this.isOnline) {
          this.setupRealtime(currentToken);
        }
      }, 5000);
    };
  }

  async syncNow() {
    if (this.isSyncing || !this.isOnline) return;
    const { token } = useAppStore.getState();
    if (!token) return; // No auth, no sync

    if (!this.eventSource) {
      this.setupRealtime(token);
    }

    this.isSyncing = true;

    try {
      await this.push(token);
      await this.pull(token);
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  private async push(token: string) {
    const state = useAppStore.getState();
    const tasks = Object.values(state.tasks).filter(t => t._is_dirty);
    const cycles = state.cycles.filter((c: any) => c._is_dirty);
    const lists = state.lists.filter((l: any) => l._is_dirty);

    if (tasks.length === 0 && cycles.length === 0 && lists.length === 0) return;

    // Send payload to backend
    const response = await fetch(PUSH_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ tasks, cycles, lists })
    });

    if (!response.ok) throw new Error('Push failed');

    // Remove dirty flag locally
    const updatedTasks = tasks.map(t => ({ ...t, _is_dirty: false }));
    updatedTasks.forEach(t => state.updateTaskRaw(t));
    
    if (cycles.length > 0) {
      cycles.forEach((c: any) => {
        state.updateCycle(c.id, { _is_dirty: false });
      });
    }
    
    if (lists.length > 0) {
      lists.forEach((l: any) => {
        state.updateList(l.id, { _is_dirty: false });
      });
    }
  }

  private async pull(token: string) {
    // Get highest updatedAt from local state to use as token
    const state = useAppStore.getState();
    let maxUpdatedAt = 0;
    
    Object.values(state.tasks).forEach(t => {
      if (t.updated_at) {
        const d = new Date(t.updated_at).getTime();
        if (d > maxUpdatedAt) maxUpdatedAt = d;
      }
    });

    const url = new URL(PULL_URL);
    url.searchParams.append('lastToken', maxUpdatedAt.toString());

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) throw new Error('Pull failed');

    const data = await response.json();
    
    // Upsert pulled data into Zustand
    if (data.tasks && Array.isArray(data.tasks)) {
      data.tasks.forEach((serverTask: TaskItem) => {
        const localTask = state.tasks[serverTask.id];
        // Last Write Wins
        if (!localTask || new Date(serverTask.updated_at).getTime() > new Date(localTask.updated_at).getTime()) {
           state.updateTaskRaw({ ...serverTask, _is_dirty: false });
        }
      });
    }

    // Ingest lists
    if (data.lists && Array.isArray(data.lists)) {
      data.lists.forEach((serverList: any) => {
        if (serverList.id === 'user_preferences_smart_lists') {
          try {
            const parsed = JSON.parse(serverList.icon);
            useAppStore.setState({ smartListVisibility: parsed });
          } catch (e) {
            console.error('Failed to parse smart list visibility:', e);
          }
          return;
        }

        const localList = state.lists.find(l => l.id === serverList.id);
        if (!localList) {
          state.addList({ ...serverList, _is_dirty: false });
        } else if (!localList.updated_at || new Date(serverList.updated_at).getTime() > new Date(localList.updated_at).getTime()) {
          state.updateList(serverList.id, { ...serverList, _is_dirty: false });
        }
      });
    }

    // Ingest cycles
    if (data.cycles && Array.isArray(data.cycles)) {
      data.cycles.forEach((serverCycle: any) => {
        const localCycle = state.cycles.find(c => c.id === serverCycle.id);
        if (!localCycle) {
          state.addCycle({ ...serverCycle, _is_dirty: false });
        } else if (!localCycle.updated_at || new Date(serverCycle.updated_at).getTime() > new Date(localCycle.updated_at).getTime()) {
          state.updateCycle(serverCycle.id, { ...serverCycle, _is_dirty: false });
        }
      });
    }
  }
}

export const syncManager = new SyncManager();

// Automatically trigger sync when CRUD changes flags an item as _is_dirty
useAppStore.subscribe((state) => {
  const hasDirtyTasks = Object.values(state.tasks).some(t => t._is_dirty);
  const hasDirtyCycles = state.cycles.some((c: any) => c._is_dirty);
  const hasDirtyLists = state.lists.some((l: any) => l._is_dirty);

  if (hasDirtyTasks || hasDirtyCycles || hasDirtyLists) {
    syncManager.triggerDebouncedSync();
  }
});
