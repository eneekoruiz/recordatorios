import { useAppStore } from '../store/useAppStore';
import type { TaskItem } from '../models/Task';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const PULL_URL = `${API_BASE}/api/sync/pull`;
const PUSH_URL = `${API_BASE}/api/sync/push`;
const SYNC_INTERVAL_MS = 30 * 1000; // 30 seconds

class SyncManager {
  private syncInterval: any = null;
  private isSyncing = false;
  private isOnline = navigator.onLine;

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
  }

  async syncNow() {
    if (this.isSyncing || !this.isOnline) return;
    const { token } = useAppStore.getState();
    if (!token) return; // No auth, no sync

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
    
    // Cycles would be updated similarly
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
  }
}

export const syncManager = new SyncManager();
