import { HapticService } from '../services/HapticService';

export interface HistoryAction {
  id: string;
  type: 'delete_task' | 'complete_task' | 'delete_section' | 'delete_cycle' | 'delete_list' | 'batch_action' | 'custom';
  description: string;
  timestamp: number;
  undo: () => void;
  redo?: () => void;
}

class GlobalHistoryManager {
  private undoStack: HistoryAction[] = [];
  private redoStack: HistoryAction[] = [];
  private readonly windowMs: number = 30_000;
  private isExecuting = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e: KeyboardEvent) => {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable)
        ) {
          return;
        }

        const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform || '');
        const isModifier = isMac ? e.metaKey : e.ctrlKey;

        if (isModifier && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            this.redo();
          } else {
            this.undo();
          }
        }
      });
    }
  }

  /** Registra una acción reversible en el historial y dispara un toast interactivo. */
  public register(
    description: string,
    undo: () => void,
    options?: {
      type?: HistoryAction['type'];
      redo?: () => void;
      showToast?: boolean;
    }
  ): string {
    let undone = false;
    const safeUndo = () => {
      if (undone) return;
      undone = true;
      undo();
      HapticService.selection();
    };

    const action: HistoryAction = {
      id: `action_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: options?.type || 'custom',
      description,
      timestamp: Date.now(),
      undo: safeUndo,
      redo: options?.redo
    };

    this.undoStack.push(action);
    this.redoStack = [];

    if (options?.showToast !== false && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('show-toast', {
          detail: {
            message: description,
            onUndo: () => this.undoAction(action.id)
          }
        })
      );
    }

    return action.id;
  }

  public undoAction(id: string): boolean {
    if (this.isExecuting) return false;
    const index = this.undoStack.findIndex(a => a.id === id);
    if (index === -1) return false;

    const [action] = this.undoStack.splice(index, 1);
    if (Date.now() - action.timestamp > this.windowMs) return false;

    this.isExecuting = true;
    try {
      action.undo();
      if (action.redo) this.redoStack.push(action);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('show-toast', {
            detail: `Deshecho: ${action.description}`
          })
        );
      }
      return true;
    } finally {
      this.isExecuting = false;
    }
  }

  public undo(): boolean {
    if (this.isExecuting) return false;
    this.pruneExpired();

    const action = this.undoStack.pop();
    if (!action) return false;

    this.isExecuting = true;
    try {
      action.undo();
      if (action.redo) this.redoStack.push(action);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('show-toast', {
            detail: `Acción deshecha`
          })
        );
      }
      return true;
    } finally {
      this.isExecuting = false;
    }
  }

  public redo(): boolean {
    if (this.isExecuting) return false;
    const action = this.redoStack.pop();
    if (!action || !action.redo) return false;

    this.isExecuting = true;
    try {
      action.redo();
      HapticService.selection();
      this.undoStack.push(action);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('show-toast', {
            detail: `Rehecho: ${action.description}`
          })
        );
      }
      return true;
    } finally {
      this.isExecuting = false;
    }
  }

  public canUndo(): boolean {
    this.pruneExpired();
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  private pruneExpired(): void {
    const now = Date.now();
    this.undoStack = this.undoStack.filter(a => now - a.timestamp <= this.windowMs);
  }
}

export const historyManager = new GlobalHistoryManager();
