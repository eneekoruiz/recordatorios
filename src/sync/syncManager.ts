import { useAppStore } from '../store/useAppStore';
import type { TaskItem } from '../models/Task';

const PULL_URL = '/api/sync/pull';
const PUSH_URL = '/api/sync/push';
const SYNC_INTERVAL_MS = 10 * 1000; // 10 seconds for testing

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
    this.isSyncing = true;

    try {
      await this.push();
      await this.pull();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  private async push() {
    const state = useAppStore.getState();
    const tasks = Object.values(state.tasks).filter(t => t._is_dirty);
    const cycles = state.cycles.filter((c: any) => c._is_dirty);

    if (tasks.length === 0 && cycles.length === 0) return;

    // Send payload to backend
    const response = await fetch(PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'temp-user-id', // En prod sacaríamos del Auth Provider
        tasks,
        cycles
      })
    });

    if (!response.ok) throw new Error('Push failed');

    // Remove dirty flag locally
    const updatedTasks = tasks.map(t => ({ ...t, _is_dirty: false }));
    updatedTasks.forEach(t => state.updateTaskRaw(t));
    
    // Cycles would be updated similarly
  }

  private async pull() {
    // Get highest updatedAt from local state to use as token
    const state = useAppStore.getState();
    let maxUpdatedAt = 0;
    
    Object.values(state.tasks).forEach(t => {
      if (t.updated_at) {
        const d = new Date(t.updated_at).getTime();
        if (d > maxUpdatedAt) maxUpdatedAt = d;
      }
    });

    const url = new URL(PULL_URL, window.location.origin);
    url.searchParams.append('userId', 'temp-user-id');
    url.searchParams.append('lastToken', maxUpdatedAt.toString());

    const response = await fetch(url.toString());
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
