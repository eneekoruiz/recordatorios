import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, useMotionValue, useTransform, AnimatePresence, useMotionValueEvent } from 'framer-motion';
import {
  Lock, MoreHorizontal,
  ChevronDown, X, Info, RotateCcw, Flag,
  ShieldAlert, Clock, CheckCircle2, CreditCard,
  Flame, User, MapPin, Link2, Check
} from 'lucide-react';
import type { TaskItem } from '../../models/Task';
import { useAppStore, isTaskCompleted } from '../../store/useAppStore';
import { isCompletedInCurrentPeriod, calculateHabitStreak, calculateExpirationStatus } from '../../services/TaskService';
import { SoundService } from '../../services/SoundService';
import { HapticService } from '../../services/HapticService';
import { ConfettiService } from '../../services/ConfettiService';
import { ConfirmModal } from '../ui/ConfirmModal';
import type { SpotlightRect } from '../ui/SpotlightBackdrop';
import { isCaducidadesList } from '../../utils/specialLists';
import { TaskContextMenu } from './card/TaskContextMenu';
import { TaskSwipeBackground } from './card/TaskSwipeBackground';
import { TaskMetaBadges } from './card/TaskMetaBadges';
import { TaskHabitCounter } from './card/TaskHabitCounter';
import { TaskNoteEditor } from './card/TaskNoteEditor';
import { getTaskPeriodicity, stripPeriodicityPrefix } from '../../utils/sectionRoutine';
import { extractPrice } from '../../utils/priceExtractor';

interface TaskCardProps {
  task: TaskItem;
  virtualStyle: React.CSSProperties;
  onToggle: (id: string, forceReverse?: boolean) => void;
  onDelete: (id: string) => void;
  onOpenZenMode?: (id: string) => void;
  onEdit: (id: string) => void;
  index?: number;
  showListName?: boolean;
  /** Oculta la fecha en vistas donde ya es obvia (p. ej. «Hoy»). */
  hideDueDate?: boolean;
  isFirstInSection?: boolean;
  isLastInSection?: boolean;
  previousTaskId?: string;
  hasChildren?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  indent?: number;
  onNavigateView?: (view: string) => void;
  onPersonClick?: (person: string) => void;
  isGracePeriod?: boolean;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onReorderTasks?: (sourceId: string, targetId: string, position: 'before' | 'after') => void;
}

export const TaskCard = React.memo(function TaskCard({
  task, virtualStyle, onToggle, onDelete, onOpenZenMode, onEdit, showListName = true, hideDueDate = false, isFirstInSection, isLastInSection, previousTaskId, hasChildren, isExpanded, onToggleExpand, indent = 0, onNavigateView, onPersonClick, isGracePeriod,
  onMoveUp, onMoveDown, canMoveUp, canMoveDown, onReorderTasks
}: TaskCardProps) {
  const cycles = useAppStore(state => state.cycles);
  const tasks = useAppStore(state => state.tasks);
  const nestTask = useAppStore(state => state.nestTask);
  const lists = useAppStore(state => state.lists);
  const listSections = useAppStore(state => state.listSections);
  const taskList = lists?.find(l => l.id === task.categoryId);
  const taskColor = taskList?.color || 'var(--accent-primary, #007aff)';

  let dueDateColor = 'var(--text-tertiary)';
  if (task.dueDate) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = new Date(task.dueDate); due.setHours(0, 0, 0, 0);
    if (due < today) dueDateColor = '#ff3b30'; // Apple Red
    else if (due.getTime() === today.getTime()) dueDateColor = '#007aff'; // Apple Blue
    else dueDateColor = 'var(--text-tertiary)';
  }

  // Helper para franja horaria diaria: solo si el usuario la configuró explícitamente en la tarea
  const timeOfDayInfo = (() => {
    if (!task.timeOfDay) return null;

    switch (task.timeOfDay) {
      case 'morning':
        return { tag: 'morning' as const, label: 'Mañana', next: 'afternoon' as const };
      case 'afternoon':
        return { tag: 'afternoon' as const, label: 'Tarde', next: 'night' as const };
      case 'night':
        return { tag: 'night' as const, label: 'Noche', next: 'morning' as const };
    }
  })();

  // Helper para etiqueta de frecuencia sobria: según periodicidad detectada o ciclo asignado
  const cycleBadge = (() => {
    // 1. Detección vía periodicidad calculada (cubre cycle_id, prefijos en título, sección manual, lista y frecuencia)
    const periodicity = getTaskPeriodicity(task, listSections, lists);
    if (periodicity) {
      const labelMap: Record<string, string> = {
        day: 'Diaria',
        week: 'Semanal',
        month: 'Mensual',
        year: 'Anual'
      };
      return { 
        type: periodicity as 'day' | 'week' | 'month' | 'year', 
        label: labelMap[periodicity] || periodicity 
      };
    }

    // 2. Ciclo explícito o personalizado
    const cycleId = task.cycle_id;
    if (cycleId) {
      if (cycleId === 'cycle_day' || cycleId === 'day') return { type: 'day' as const, label: 'Diaria' };
      if (cycleId === 'cycle_week' || cycleId === 'week') return { type: 'week' as const, label: 'Semanal' };
      if (cycleId === 'cycle_month' || cycleId === 'month') return { type: 'month' as const, label: 'Mensual' };
      if (cycleId === 'cycle_year' || cycleId === 'year') return { type: 'year' as const, label: 'Anual' };
      const custom = cycles.find(c => c.id === cycleId);
      return { type: 'custom' as const, label: custom?.name || cycleId };
    }

    return null;
  })();

  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number; maxHeight: number }>({ x: 0, y: 0, maxHeight: 400 });
  const [contextMenuTriggerRect, setContextMenuTriggerRect] = useState<SpotlightRect | null>(null);

  useEffect(() => {
    if (!contextMenuOpen) return;
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest && target.closest('.ios-dropdown-menu')) {
        return; // Permite hacer scroll interno dentro del menú desplegable
      }
      setContextMenuOpen(false);
    };
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [contextMenuOpen]);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isHovered, setIsHovered] = useState(false);
  const longPressTimer = useRef<number | null>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const hasCrossedLeftThreshold = useRef(false);
  const hasCrossedRightThreshold = useRef(false);
  const didLongPressRef = useRef(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title || '');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [editNote, setEditNote] = useState(task.description || '');
  const cardRef = useRef<HTMLDivElement>(null);
  const updateTask = useAppStore(state => state.updateTask);

  const [isPriorityPopoverOpen, setIsPriorityPopoverOpen] = useState(false);
  const [priorityPopoverPos, setPriorityPopoverPos] = useState<{ x: number; y: number } | null>(null);

  const handlePriorityBadgeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    HapticService.selection();
    if (isPriorityPopoverOpen) {
      setIsPriorityPopoverOpen(false);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 165;
    const menuHeight = 175;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let x = rect.left;
    if (x + menuWidth > viewportW - 12) {
      x = viewportW - menuWidth - 12;
    }
    x = Math.max(12, x);

    let y = rect.bottom + 6;
    if (y + menuHeight > viewportH - 12) {
      y = Math.max(12, rect.top - menuHeight - 6);
    }

    setPriorityPopoverPos({ x, y });
    setIsPriorityPopoverOpen(true);
  }, [isPriorityPopoverOpen]);

  useEffect(() => {
    if (!isPriorityPopoverOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsPriorityPopoverOpen(false);
    };
    const handleScroll = (e: Event) => {
      if ((e.target as HTMLElement)?.closest?.('.priority-picker-popover')) return;
      setIsPriorityPopoverOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isPriorityPopoverOpen]);


  // --- SWIPE (iOS-style: card physically moves) ---
  const x = useMotionValue(0);

  const openContextMenu = useCallback(() => {
    HapticService.impact('medium');
    x.set(0); // Reset any active horizontal swipe offset immediately
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      setContextMenuTriggerRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
      const viewportH = window.innerHeight;
      const viewportW = window.innerWidth;
      const menuWidth = Math.min(260, viewportW - 24);
      const estimatedMenuHeight = 440;
      const padding = 12;
      
      const spaceBelow = viewportH - rect.bottom - padding;
      const spaceAbove = rect.top - padding;
      
      let top: number;
      let maxH: number;
      
      if (spaceBelow >= 220) {
        // Place strictly below the card — never covers the task!
        top = rect.bottom + 8;
        maxH = Math.min(estimatedMenuHeight, spaceBelow - 8);
      } else if (spaceAbove >= 220) {
        // Place strictly above the card — never covers the task!
        maxH = Math.min(estimatedMenuHeight, spaceAbove - 8);
        top = Math.max(padding, rect.top - maxH - 8);
      } else {
        // Very tight vertical space: position beside if wide screen, otherwise place below clamped
        if (viewportW - rect.right >= menuWidth + 16) {
          top = Math.max(padding, Math.min(viewportH - estimatedMenuHeight - padding, rect.top));
          maxH = viewportH - top - padding;
        } else {
          top = Math.max(padding, rect.bottom + 4);
          maxH = Math.max(140, viewportH - top - padding);
        }
      }

      let left = rect.right - menuWidth;
      if (viewportW <= 640) {
        left = Math.max(padding, (viewportW - menuWidth) / 2);
      } else {
        left = Math.max(padding, Math.min(viewportW - menuWidth - 16, left));
      }

      setContextMenuPosition({ x: left, y: top, maxHeight: maxH });
    }
    setContextMenuOpen(true);
  }, [x]);

  // Sync state if task changes externally but not while editing
  useEffect(() => {
    if (!isEditingTitle) setEditTitle(task.title || '');
    if (!isEditingNote) setEditNote(task.description || '');
  }, [task.title, task.description, isEditingTitle, isEditingNote]);

  const handleTitleSubmit = () => {
    // Delay setting isEditingTitle to false to prevent race condition with clicking "Añadir nota..."
    setTimeout(() => {
      setIsEditingTitle(false);
      const raw = editTitle.trim();
      if (!raw) {
        // Si el recordatorio queda vacío, se elimina ("como si no se hubiera creado")
        HapticService.selection();
        if (onDelete) {
          onDelete(task.id);
        } else {
          useAppStore.getState().deleteTask(task.id);
        }
        return;
      }
      if (raw !== task.title) {
        const extracted = extractPrice(raw, false);
        if (extracted && extracted.price > 0) {
          updateTask(task.id, {
            title: extracted.cleanText || raw,
            price: extracted.price
          });
        } else {
          updateTask(task.id, { title: raw });
        }
      }
    }, 150);
  };

  const startEditingNote = () => {
    const raw = editTitle.trim();
    if (raw && raw !== task.title) {
      const extracted = extractPrice(raw, false);
      if (extracted && extracted.price > 0) {
        updateTask(task.id, {
          title: extracted.cleanText || raw,
          price: extracted.price
        });
      } else {
        updateTask(task.id, { title: raw });
      }
    }
    setIsEditingTitle(false);
    setIsEditingNote(true);
  };

  const handleNoteSubmit = () => {
    setIsEditingNote(false);
    const rawNote = editNote.trim();
    if (rawNote !== (task.description || '')) {
      const extracted = extractPrice(rawNote, true);
      if (extracted && extracted.price > 0) {
        updateTask(task.id, {
          description: extracted.cleanText || undefined,
          price: extracted.price
        });
      } else {
        updateTask(task.id, { description: rawNote });
      }
    }
  };

  const isBlocked = task.blockedBy && task.blockedBy.some(id => tasks[id] && tasks[id].status === 'pending');
  const isCompletedPeriod = isCompletedInCurrentPeriod(task, cycles, listSections, lists);
  const isEffectivelyDone = isCompletedPeriod || !!isGracePeriod || isTaskCompleted(task);

  // Background reveal: opacity tied to card x position
  const leftBgOpacity = useTransform(x, [0, 40, 80], [0, 0.7, 1]);
  const rightBgOpacity = useTransform(x, [0, -40, -80], [0, 0.7, 1]);
  const leftIconScale = useTransform(x, [20, 80], [0.6, 1]);
  const rightIconScale = useTransform(x, [-20, -80], [0.6, 1]);
  const leftIconX = useTransform(x, [0, 100], [-30, 10]);
  const rightIconX = useTransform(x, [0, -100], [30, -10]);

  const SWIPE_COMPLETE_THRESHOLD = 65;
  const SWIPE_DELETE_THRESHOLD = -65;

  useMotionValueEvent(x, "change", (latest) => {
    if (latest > SWIPE_COMPLETE_THRESHOLD) {
      if (!hasCrossedLeftThreshold.current) {
        HapticService.impact('light');
        hasCrossedLeftThreshold.current = true;
      }
    } else {
      hasCrossedLeftThreshold.current = false;
    }

    if (latest < SWIPE_DELETE_THRESHOLD) {
      if (!hasCrossedRightThreshold.current) {
        HapticService.impact('light');
        hasCrossedRightThreshold.current = true;
      }
    } else {
      hasCrossedRightThreshold.current = false;
    }
  });

  const handleSwipeEnd = useCallback((offsetX: number) => {
    if (offsetX > SWIPE_COMPLETE_THRESHOLD && !isBlocked) {
      HapticService.notification('success');
      // Always toggle: if completed → uncomplete, if pending → complete
      if (!isEffectivelyDone) SoundService.playComplete(); else SoundService.playUncomplete();
      onToggle(task.id, isEffectivelyDone);
    } else if (offsetX < SWIPE_DELETE_THRESHOLD) {
      HapticService.impact('heavy');
      setIsDeleteConfirmOpen(true);
    }
  }, [isBlocked, isEffectivelyDone, onToggle, task.id]);

  const totalAlerts = task.alerts?.length || 0;
  const completedAlertsCount = task.completedAlerts?.length || 0;
  const hasTargetCount = Boolean(task.targetCount && task.targetCount > 1);
  const targetCount = task.targetCount || 1;
  const effectiveCurrentCount = (task.cycle_id && !isCompletedPeriod && (task.currentCount || 0) >= targetCount)
    ? 0
    : (task.currentCount || 0);

  const isTargetPartial = hasTargetCount && effectiveCurrentCount > 0 && effectiveCurrentCount < targetCount;
  const isPartial = (totalAlerts > 1 && completedAlertsCount > 0 && completedAlertsCount < totalAlerts) || isTargetPartial;
  const percentage = hasTargetCount
    ? (Math.min(effectiveCurrentCount, targetCount) / targetCount) * 100
    : (totalAlerts > 1 ? (completedAlertsCount / totalAlerts) * 100 : 0);

  const habitStreak = calculateHabitStreak(task, cycles);
  const isCaducidad = isCaducidadesList(task.categoryId) || !!task.expirationType;
  const expirationStatus = isCaducidad ? calculateExpirationStatus(task.dueDate) : null;

  const [dragOverPosition, setDragOverPosition] = useState<'top' | 'bottom' | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    if (!onReorderTasks) return;
    if (e.dataTransfer.types.includes('text/task-id') || e.dataTransfer.types.includes('text/plain')) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      const rect = e.currentTarget.getBoundingClientRect();
      const isBottom = e.clientY > rect.top + rect.height / 2;
      setDragOverPosition(isBottom ? 'bottom' : 'top');
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPosition(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!onReorderTasks) return;
    e.preventDefault();
    e.stopPropagation();
    const sourceId = e.dataTransfer.getData('text/task-id') || e.dataTransfer.getData('text/plain');
    const pos = dragOverPosition || (e.clientY > e.currentTarget.getBoundingClientRect().top + e.currentTarget.getBoundingClientRect().height / 2 ? 'bottom' : 'top');
    setDragOverPosition(null);
    if (sourceId && sourceId !== task.id) {
      onReorderTasks(sourceId, task.id, pos === 'bottom' ? 'after' : 'before');
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.setData('text/task-id', task.id);
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      className="task-item-wrapper"
      draggable={!isBlocked && !isEditingTitle && !isEditingNote && !contextMenuOpen && Boolean(onReorderTasks)}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        ...virtualStyle,
        position: 'relative',
        margin: 0,
        boxSizing: 'border-box',
        zIndex: contextMenuOpen ? 999992 : 1,
        touchAction: 'pan-y',
        WebkitTouchCallout: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
      onPointerDown={(e) => {
        if (isEditingTitle || isEditingNote) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        didLongPressRef.current = false;
        touchStartX.current = e.clientX;
        touchStartY.current = e.clientY;
        if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
        longPressTimer.current = window.setTimeout(() => {
          didLongPressRef.current = true;
          openContextMenu();
        }, 380);
      }}
      onClickCapture={(e) => {
        if (didLongPressRef.current) {
          e.stopPropagation();
          e.preventDefault();
        }
      }}
      onPointerMove={(e) => {
        if (!longPressTimer.current) return;
        const dx = Math.abs(e.clientX - touchStartX.current);
        const dy = Math.abs(e.clientY - touchStartY.current);
        if (dx > 20 || dy > 20) {
          window.clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      }}
      onPointerUp={() => {
        if (longPressTimer.current) {
          window.clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      }}
      onPointerCancel={() => {
        if (longPressTimer.current) {
          window.clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (longPressTimer.current) {
          window.clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
        openContextMenu();
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Drop Target Indicator Line for manual reordering (Apple Native Style) */}
      {dragOverPosition === 'top' && (
        <div 
          style={{
            position: 'absolute', top: -1, left: 12, right: 12, height: 2,
            background: 'var(--accent-primary, #007aff)', zIndex: 9999,
            pointerEvents: 'none'
          }} 
        >
          <div style={{ position: 'absolute', left: -4, top: -3, width: 8, height: 8, borderRadius: '50%', border: '2px solid var(--accent-primary, #007aff)', background: 'var(--bg-elevated)', boxSizing: 'border-box' }} />
        </div>
      )}
      {dragOverPosition === 'bottom' && (
        <div 
          style={{
            position: 'absolute', bottom: -1, left: 12, right: 12, height: 2,
            background: 'var(--accent-primary, #007aff)', zIndex: 9999,
            pointerEvents: 'none'
          }} 
        >
          <div style={{ position: 'absolute', left: -4, top: -3, width: 8, height: 8, borderRadius: '50%', border: '2px solid var(--accent-primary, #007aff)', background: 'var(--bg-elevated)', boxSizing: 'border-box' }} />
        </div>
      )}

      {/* Fixed swipe action backgrounds - hidden during context menu to prevent bleed-through */}
      {!contextMenuOpen && (
        <TaskSwipeBackground
          isEffectivelyDone={isEffectivelyDone}
          leftBgOpacity={leftBgOpacity}
          leftIconScale={leftIconScale}
          leftIconX={leftIconX}
          rightBgOpacity={rightBgOpacity}
          rightIconScale={rightIconScale}
          rightIconX={rightIconX}
        />
      )}

      {/* Main card — physically slides */}
      <motion.div
        ref={cardRef}
        drag={contextMenuOpen ? false : "x"}
        dragSnapToOrigin
        dragConstraints={{ left: -140, right: 140 }}
        dragElastic={0.25}
        dragTransition={{ bounceStiffness: 500, bounceDamping: 35 }}
        onDragEnd={(_, info) => handleSwipeEnd(info.offset.x)}
        animate={{
          scale: 1,
          boxShadow: contextMenuOpen 
            ? '0 12px 32px rgba(0,0,0,0.18), 0 0 0 1px var(--border-subtle)' 
            : 'none',
          borderRadius: contextMenuOpen ? 12 : (isFirstInSection ? 10 : isLastInSection ? 10 : 0),
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 400 }}
        style={{
          x,
          position: 'relative',
          zIndex: contextMenuOpen ? 999992 : 1,
          minHeight: 52,
          display: 'flex',
          alignItems: 'center',
          padding: `8px 12px 8px ${8 + indent}px`,
          margin: 0,
          width: '100%',
          boxSizing: 'border-box',
          background: 'var(--bg-elevated)',
          borderRadius: `${isFirstInSection ? 10 : 0}px ${isFirstInSection ? 10 : 0}px ${isLastInSection ? 10 : 0}px ${isLastInSection ? 10 : 0}px`,
          borderBottom: 'none',
          opacity: isBlocked ? 0.5 : 1,
          pointerEvents: 'auto',
          touchAction: 'pan-y',
          cursor: 'default',
        }}
      >
        {/* Separador fino estilo iOS: se dibuja arriba de cada fila (salvo la primera) para que
            ninguna fila vecina lo tape por redondeo de subpíxeles. */}
        {!isFirstInSection && !contextMenuOpen && (
          <div aria-hidden="true" className="task-row-separator" style={{ left: `${40 + indent}px` }} />
        )}

        {/* Checkbox o Botón Restaurar en Papelera */}
        {task.deleted_at ? (
          <motion.button
            whileTap={{ scale: 0.85 }}
            whileHover={{ scale: 1.15 }}
            aria-label="Restaurar recordatorio"
            title="Restaurar recordatorio"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              HapticService.notification('success');
              SoundService.playUncomplete();
              useAppStore.getState().restoreTask(task.id);
            }}
            style={{
              width: 24, height: 24,
              padding: 0,
              background: 'rgba(0, 122, 255, 0.12)',
              border: '1px solid rgba(0, 122, 255, 0.28)',
              borderRadius: '50%',
              marginRight: 8,
              cursor: 'pointer',
              flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--accent-primary, #007aff)',
              WebkitTapHighlightColor: 'transparent',
              outline: 'none'
            }}
          >
            <RotateCcw size={12} strokeWidth={2.5} />
          </motion.button>
        ) : (
          <motion.button
            whileTap={{ scale: 0.85 }}
            aria-label={isEffectivelyDone ? 'Marcar como pendiente' : 'Completar tarea'}
            disabled={!!isBlocked}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              if (isBlocked) return;
              if (typeof navigator !== 'undefined' && 'vibrate' in navigator && navigator.vibrate) navigator.vibrate([8]);
              
              if (isEffectivelyDone) {
                SoundService.playUncomplete();
                onToggle(task.id, true);
              } else {
                const isNextFinal = hasTargetCount
                  ? (effectiveCurrentCount + 1 >= targetCount)
                  : (!task.alerts || task.alerts.length <= 1 || completedAlertsCount + 1 >= totalAlerts);
                
                if (isNextFinal) {
                  SoundService.playComplete();
                  if (hasTargetCount || task.vibe?.includes('Celebración') || task.vibe?.includes('Especial')) {
                    ConfettiService.fire({ count: 55 });
                  }
                } else {
                  SoundService.playPop();
                }
                onToggle(task.id, false);
              }
            }}
            style={{
              width: 26, height: 26,
              padding: 0,
              background: 'transparent',
              border: 'none',
              marginRight: 8,
              cursor: isBlocked ? 'default' : 'pointer',
              flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
              WebkitTapHighlightColor: 'transparent',
              outline: 'none'
            }}
          >
            {/* Halo expansivo al completar */}
            <AnimatePresence>
              {isEffectivelyDone && (
                <motion.div
                  key="complete-glow-burst"
                  initial={{ scale: 0.6, opacity: 0.75 }}
                  animate={{ scale: 1.65, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    position: 'absolute',
                    width: 22, height: 22,
                    borderRadius: '50%',
                    background: taskColor,
                    pointerEvents: 'none'
                  }}
                />
              )}
            </AnimatePresence>

            {isPartial && !isEffectivelyDone && (
              <div style={{
                position: 'absolute',
                width: 22, height: 22,
                borderRadius: '50%',
                background: `conic-gradient(${taskColor} ${percentage}%, var(--border-subtle) ${percentage}%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 1
              }}>
                <div style={{ 
                  width: 17, height: 17, 
                  background: 'var(--bg-elevated)', 
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {hasTargetCount && (
                    <span style={{ 
                      fontSize: '0.62rem', 
                      fontWeight: 700, 
                      color: taskColor, 
                      lineHeight: 1, 
                      transform: 'translateY(-0.5px)' 
                    }}>
                      {effectiveCurrentCount}
                    </span>
                  )}
                </div>
              </div>
            )}

            <motion.div
              animate={{
                scale: isEffectivelyDone ? [1, 1.25, 0.94, 1] : 1,
                backgroundColor: isEffectivelyDone ? taskColor : 'rgba(0,0,0,0)'
              }}
              transition={{
                scale: { type: 'spring', stiffness: 500, damping: 22 },
                backgroundColor: { duration: 0.2, ease: 'easeOut' }
              }}
              style={{
                width: 22, height: 22,
                borderRadius: '50%',
                border: (isEffectivelyDone || isPartial) ? 'none' : `1.5px solid ${isHovered ? taskColor : 'var(--border-color)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: isEffectivelyDone ? `0 2px 8px ${taskColor}40` : 'none',
                transition: 'border-color 0.15s ease'
              }}
            >
              <svg viewBox="0 0 24 24" width={14} height={14} style={{ overflow: 'visible' }}>
                <motion.path
                  d="M5 12L10 17L19 7"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ 
                    pathLength: isEffectivelyDone ? 1 : 0,
                    opacity: isEffectivelyDone ? 1 : 0
                  }}
                  transition={{
                    pathLength: { type: 'spring', stiffness: 420, damping: 26, delay: 0.02 },
                    opacity: { duration: 0.15 }
                  }}
                />
              </svg>
            </motion.div>
          </motion.button>
        )}

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0, padding: '2px 0', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {isBlocked && <Lock size={15} color="var(--accent-red)" />}
            {Boolean(task.priority && task.priority !== 'none' && (task.priority as any) !== 0) && (
              <button
                type="button"
                className={`priority-badge ${typeof task.priority === 'number' ? ((task.priority as any) === 1 ? 'high' : (task.priority as any) === 5 ? 'medium' : 'low') : task.priority}`}
                onClick={handlePriorityBadgeClick}
                onPointerDown={(e) => e.stopPropagation()}
                title="Cambiar urgencia"
                aria-label="Cambiar urgencia"
                style={{
                  cursor: 'pointer',
                  border: 'none',
                  background: 'none',
                  padding: 0,
                  outline: 'none',
                  color: '#ff3b30',
                  fontWeight: 700,
                  fontSize: '1rem',
                  lineHeight: '1.4',
                  letterSpacing: '-0.5px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  WebkitTapHighlightColor: 'transparent',
                  transition: 'transform 0.15s ease, filter 0.15s ease',
                  userSelect: 'none'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; e.currentTarget.style.filter = 'brightness(1.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.filter = 'none'; }}
              >
                {task.priority === 'low' || (task.priority as any) === 9 ? '!' : task.priority === 'medium' || (task.priority as any) === 5 ? '!!' : '!!!'}
              </button>
            )}
            {isEditingTitle ? (
              <motion.input
                className="task-title-input"
                value={editTitle}
                autoFocus
                onChange={e => setEditTitle(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={e => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!editTitle.trim()) {
                      setIsEditingTitle(false);
                      HapticService.selection();
                      if (onDelete) onDelete(task.id);
                      else useAppStore.getState().deleteTask(task.id);
                    } else {
                      e.currentTarget.blur();
                    }
                  } else if (e.key === 'Backspace' && !editTitle) {
                    e.preventDefault();
                    setIsEditingTitle(false);
                    HapticService.selection();
                    if (onDelete) onDelete(task.id);
                    else useAppStore.getState().deleteTask(task.id);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setIsEditingTitle(false);
                    if (!editTitle.trim()) {
                      if (onDelete) onDelete(task.id);
                      else useAppStore.getState().deleteTask(task.id);
                    } else {
                      setEditTitle(task.title || '');
                    }
                  }
                }}
                onClick={e => e.stopPropagation()}
                onPointerDown={e => e.stopPropagation()}
                onPointerDownCapture={e => e.stopPropagation()}
                onPaste={e => {
                  const pasted = e.clipboardData.getData('text');
                  if (pasted.includes('\n')) {
                    e.preventDefault();
                    const lines = pasted.split('\n').map(l => l.trim()).filter(Boolean);
                    if (lines.length > 0) {
                      setEditTitle(lines[0]);
                      const { addTask } = useAppStore.getState();
                      lines.slice(1).forEach(line => {
                        addTask({
                          id: crypto.randomUUID(),
                          title: line,
                          categoryId: task.categoryId,
                          type: 'task',
                          completed: false,
                          created_at: new Date().toISOString()
                        } as any);
                      });
                    }
                  }
                }}
                style={{
                  fontSize: '1.05rem', fontWeight: 400, width: '100%',
                  border: 'none', background: 'transparent', outline: 'none',
                  boxShadow: 'none', WebkitBoxShadow: 'none',
                  color: 'var(--text-primary)', padding: 0, lineHeight: '1.4', boxSizing: 'border-box'
                }}
              />
            ) : (
              <motion.span
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
                onClick={() => setIsEditingTitle(true)}
                className="task-title"
                animate={{
                  color: isEffectivelyDone ? 'var(--text-tertiary)' : 'var(--text-primary)',
                  opacity: isEffectivelyDone ? 0.65 : 1
                }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                style={{
                  fontWeight: 400,
                  fontSize: '1.05rem',
                  lineHeight: '1.4',
                  whiteSpace: 'normal',
                  wordBreak: 'normal',
                  overflowWrap: 'anywhere',
                  overflow: 'visible',
                  cursor: 'text',
                  position: 'relative',
                  display: 'inline-block',
                  flex: '1 1 12ch',
                  minWidth: 0
                }}
              >
                {stripPeriodicityPrefix(task.title || '').split(/(https?:\/\/[^\s]+)/g).map((part, i) => 
                  part.match(/^https?:\/\//) ? (
                    <a key={i} href={part} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>
                      {part}
                    </a>
                  ) : part
                )}

                {/* Línea de tachado animada de izquierda a derecha */}
                <motion.span
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: isEffectivelyDone ? 1 : 0 }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    position: 'absolute',
                    top: '52%',
                    left: 0,
                    right: 0,
                    height: '1.5px',
                    background: 'var(--text-tertiary)',
                    transformOrigin: 'left center',
                    pointerEvents: 'none'
                  }}
                />
              </motion.span>
            )}
            {isGracePeriod && (
              <motion.button
                initial={{ opacity: 0, scale: 0.85, x: -4 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.85 }}
                transition={{ duration: 0.2 }}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  HapticService.impact('light');
                  SoundService.playUncomplete();
                  onToggle(task.id, true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: 999,
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  background: 'rgba(0, 122, 255, 0.1)',
                  border: '1px solid rgba(0, 122, 255, 0.25)',
                  color: 'var(--accent-primary, #007aff)',
                  cursor: 'pointer',
                  marginLeft: 4,
                  verticalAlign: 'middle',
                  lineHeight: '1.2'
                }}
                title="Deshacer y mantener pendiente"
              >
                <RotateCcw size={11} />
                <span>Deshacer</span>
              </motion.button>
            )}
            {task.flagged && <Flag size={13} color="var(--accent-orange)" fill="var(--accent-orange)" />}
            
            {task.price !== undefined && task.price > 0 && (
              <span 
                className="apple-price-pill"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(task.id);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 2.5,
                  padding: 0,
                  background: 'none',
                  border: 'none',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                  color: 'var(--text-secondary)',
                  verticalAlign: 'middle',
                  lineHeight: '1.2',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
                title={`Precio: ${task.price} €${task.quantity && task.quantity > 1 ? ` (${task.quantity} uds)` : ''} (Toca para editar)`}
              >
                {task.quantity && task.quantity > 1 && (
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>{task.quantity}×</span>
                )}
                <span>{task.price.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €</span>
              </span>
            )}
            {task.targetCount && task.targetCount > 1 && (
              <TaskHabitCounter
                task={task}
                effectiveCurrentCount={effectiveCurrentCount}
                isEffectivelyDone={isEffectivelyDone}
                targetCount={targetCount}
                onToggle={onToggle}
              />
            )}
            {habitStreak.count >= 2 && (
              <span
                className="apple-streak-pill"
                title={`¡Racha activa! Has completado esta tarea ${habitStreak.count} ${habitStreak.unit} consecutivos.`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 2.5,
                  padding: 0,
                  background: 'none',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 650,
                  color: '#ff6200',
                  verticalAlign: 'middle',
                  lineHeight: '1.2',
                  userSelect: 'none'
                }}
              >
                <Flame size={11} strokeWidth={2.4} style={{ color: '#ff6200', flexShrink: 0 }} />
                <span>{habitStreak.count} {habitStreak.unit}</span>
              </span>
            )}
            {expirationStatus && (
              <span
                className="apple-expiration-pill"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(task.id);
                }}
                title={`Estado de caducidad: ${expirationStatus.label} (${expirationStatus.daysRemaining} días restantes) (Toca para editar)`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: 0,
                  background: 'none',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: expirationStatus.badgeColor,
                  verticalAlign: 'middle',
                  lineHeight: '1.2',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                  {expirationStatus.status === 'expired' ? <ShieldAlert size={11} strokeWidth={2.4} /> :
                   expirationStatus.status === 'imminent' ? <ShieldAlert size={11} strokeWidth={2.4} /> :
                   expirationStatus.status === 'warning' ? <Clock size={11} strokeWidth={2.2} /> : 
                   <CheckCircle2 size={11} strokeWidth={2.2} />}
                </span>
                <span>{expirationStatus.label}</span>
              </span>
            )}
            {task.issuerMask && (
              <span
                className="apple-card-chip"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3.5,
                  padding: 0,
                  background: 'none',
                  border: 'none',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  verticalAlign: 'middle',
                  lineHeight: '1.2',
                  userSelect: 'none'
                }}
                title={`Identificador de tarjeta/documento: ${task.issuerMask}`}
              >
                <CreditCard size={11} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                <span>{task.issuerMask}</span>
              </span>
            )}
            {task.vibe && (
              <span
                className="apple-vibe-pill"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: 0,
                  background: 'none',
                  border: 'none',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  color: '#ff9500',
                  verticalAlign: 'middle',
                  lineHeight: '1.2',
                  userSelect: 'none'
                }}
                title={`Estado de ánimo / Vibe: ${task.vibe}`}
              >
                <span>{task.vibe}</span>
              </span>
            )}
            {task.people && task.people.length > 0 && (
              <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center', verticalAlign: 'middle' }}>
                {task.people.map(person => (
                  <span
                    key={person}
                    className="apple-person-pill"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPersonClick?.(person);
                    }}
                    title={`Ver relación y momentos compartidos con ${person}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                      padding: 0,
                      background: 'none',
                      border: 'none',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      lineHeight: '1.2',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <User size={11} strokeWidth={2.4} style={{ color: '#5856D6', flexShrink: 0 }} />
                    <span>{person}</span>
                  </span>
                ))}
              </div>
            )}
            {task.locationName && (
              <span
                className="apple-location-pill"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: 0,
                  background: 'none',
                  border: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  lineHeight: '1.2',
                  userSelect: 'none'
                }}
                title={`Ubicación: ${task.locationName}`}
              >
                <MapPin size={11} strokeWidth={2.4} style={{ color: '#34c759', flexShrink: 0 }} />
                <span>{task.locationName}</span>
              </span>
            )}
            {task.managementUrl && (
              <a
                href={task.managementUrl.startsWith('http') ? task.managementUrl : `https://${task.managementUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="apple-manage-url-btn"
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: 0,
                  background: 'none',
                  border: 'none',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  color: 'var(--accent-primary)',
                  textDecoration: 'none',
                  lineHeight: '1.2'
                }}
                title="Gestionar o cancelar suscripción en la web oficial"
              >
                <Link2 size={11} strokeWidth={2.4} style={{ flexShrink: 0 }} />
                <span>Gestionar</span>
              </a>
            )}
          </div>

          {/* Note */}
          <TaskNoteEditor
            task={task}
            isEditingNote={isEditingNote}
            isEditingTitle={isEditingTitle}
            editNote={editNote}
            setEditNote={setEditNote}
            handleNoteSubmit={handleNoteSubmit}
            startEditingNote={startEditingNote}
            isHovered={isHovered}
            isEffectivelyDone={isEffectivelyDone}
            lists={lists}
            onNavigateView={onNavigateView}
          />

          {/* Meta row - Native iOS HIG Style */}
          <TaskMetaBadges
            task={task}
            showListName={showListName}
            hideDueDate={hideDueDate}
            taskList={taskList}
            dueDateColor={dueDateColor}
            cycleBadge={cycleBadge}
            timeOfDayInfo={timeOfDayInfo}
            onEdit={onEdit}
            onNavigateView={onNavigateView}
            lists={lists}
          />
        </div>

        {/* Subtask Chevron */}
        {hasChildren && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleExpand?.(); }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '6px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              color: 'var(--text-tertiary)',
              fontWeight: 500,
              fontSize: '0.8rem',
              minWidth: 32,
              minHeight: 32,
              WebkitTapHighlightColor: 'transparent',
              flexShrink: 0,
              opacity: 0.75,
              transition: 'opacity 0.2s, color 0.2s',
              marginRight: 4
            }}
            title={isExpanded ? "Contraer" : "Expandir"}
            aria-label={isExpanded ? "Contraer" : "Expandir"}
          >
            {(() => {
              if (isExpanded) return null;
              const count = tasks ? Object.values(tasks).filter(t => t && t.parentId === task.id && !t.deleted_at).length : 0;
              return count > 0 ? <span>{count}</span> : null;
            })()}
            <motion.div style={{ display: 'flex', alignItems: 'center' }} animate={{ rotate: isExpanded ? 0 : -90 }} transition={{ type: 'spring', damping: 20, stiffness: 300 }}>
              <ChevronDown size={18} />
            </motion.div>
          </button>
        )}

        {/* Apple Reminders Info (i) button & subtle more options */}
        {!isBlocked && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button
              className="task-info-btn"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                HapticService.selection();
                onEdit(task.id);
              }}
              aria-label="Detalles del recordatorio"
              title="Información y detalles (i)"
              style={{
                width: 32, height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: taskColor || 'var(--accent-primary)',
                opacity: isMobile ? 0.85 : (isHovered || contextMenuOpen ? 0.95 : 0.4),
                transition: 'opacity 0.2s ease, background-color 0.15s ease, transform 0.12s ease',
                WebkitTapHighlightColor: 'transparent',
                flexShrink: 0
              }}
            >
              <Info size={17} strokeWidth={2.2} />
            </button>

            <button
              className="task-more-btn"
              onClick={(e) => {
                e.stopPropagation();
                openContextMenu();
              }}
              aria-label="Más opciones"
              title="Más opciones"
              style={{
                width: 30, height: 30,
                display: isMobile ? 'none' : 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                opacity: isHovered || contextMenuOpen ? 0.75 : 0,
                transition: 'opacity 0.2s ease',
                WebkitTapHighlightColor: 'transparent',
                flexShrink: 0
              }}
            >
              <MoreHorizontal size={17} color="var(--text-tertiary)" />
            </button>
          </div>
        )}

      </motion.div>

      {/* ── Context Menu (Universal Floating Popover) ── */}
      <TaskContextMenu
        task={task}
        isOpen={contextMenuOpen}
        onClose={() => setContextMenuOpen(false)}
        position={contextMenuPosition}
        triggerRect={contextMenuTriggerRect}
        onEdit={onEdit}
        nestTask={nestTask}
        previousTaskId={previousTaskId}
        setIsDeleteConfirmOpen={setIsDeleteConfirmOpen}
        onOpenZenMode={onOpenZenMode}
        onToggle={onToggle}
        isCompleted={isCompletedPeriod}
        onMoveUp={onMoveUp ? () => onMoveUp(task.id) : undefined}
        onMoveDown={onMoveDown ? () => onMoveDown(task.id) : undefined}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
      />

      {/* ── Priority Quick Picker Popover ── */}
      {isPriorityPopoverOpen && priorityPopoverPos && createPortal(
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 999998, background: 'transparent' }}
            onClick={(e) => { e.stopPropagation(); setIsPriorityPopoverOpen(false); }}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setIsPriorityPopoverOpen(false); }}
          />
          <motion.div
            className="priority-picker-popover"
            initial={{ opacity: 0, scale: 0.94, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -4 }}
            transition={{ type: 'spring', damping: 25, stiffness: 450 }}
            style={{
              position: 'fixed',
              top: priorityPopoverPos.y,
              left: priorityPopoverPos.x,
              zIndex: 999999,
              minWidth: 165,
              background: 'var(--bg-material, rgba(255, 255, 255, 0.92))',
              backdropFilter: 'blur(30px) saturate(180%)',
              WebkitBackdropFilter: 'blur(30px) saturate(180%)',
              borderRadius: 14,
              padding: 6,
              boxShadow: '0 10px 32px rgba(0, 0, 0, 0.16), 0 2px 8px rgba(0, 0, 0, 0.06)',
              border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              userSelect: 'none',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '4px 8px 2px', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Urgencia
            </div>
            {[
              { value: 'high' as const, label: 'Alta (!!!)', marks: '!!!', color: '#ff3b30' },
              { value: 'medium' as const, label: 'Media (!!)', marks: '!!', color: '#ff9500' },
              { value: 'low' as const, label: 'Baja (!)', marks: '!', color: '#ff9f0a' },
              { value: 'none' as const, label: 'Sin urgencia', marks: '✕', color: 'var(--text-tertiary)' },
            ].map((p) => {
              const normalizedPrio = typeof task.priority === 'number'
                ? ((task.priority as any) === 1 ? 'high' : (task.priority as any) === 5 ? 'medium' : 'low')
                : (task.priority || 'none');
              const isCurrent = normalizedPrio === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  className="ios-dropdown-item"
                  onClick={(e) => {
                    e.stopPropagation();
                    HapticService.impact('medium');
                    updateTask(task.id, { priority: p.value === 'none' ? undefined : p.value });
                    setIsPriorityPopoverOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: 8,
                    border: 'none',
                    background: isCurrent ? 'var(--bg-hover, rgba(0,0,0,0.05))' : 'transparent',
                    color: isCurrent ? 'var(--text-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: isCurrent ? 600 : 500,
                    textAlign: 'left',
                    transition: 'background 0.12s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 800, color: p.color, width: 20, textAlign: 'center' }}>{p.marks}</span>
                    <span>{p.label}</span>
                  </div>
                  {isCurrent && <Check size={14} color="var(--accent-primary)" />}
                </button>
              );
            })}
          </motion.div>
        </>,
        document.body
      )}

      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        title={task.deleted_at ? "Eliminar definitivamente" : "Eliminar recordatorio"}
        message={task.deleted_at ? `"${task.title}" se eliminará permanentemente. Esta acción no se puede deshacer.` : `"${task.title}" se moverá a la papelera.`}
        confirmText="Eliminar"
        onCancel={() => setIsDeleteConfirmOpen(false)}
        onConfirm={() => {
          setIsDeleteConfirmOpen(false);
          SoundService.playDelete();
          if (task.deleted_at) {
            useAppStore.getState().permanentDeleteTask(task.id);
            HapticService.notification('warning');
          } else {
            onDelete(task.id);
          }
        }}
      />

      {feedback && createPortal(
        <motion.div
          className="premium-toast"
          role="status"
          style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', minWidth: 260, boxSizing: 'border-box' }}
          initial={{ opacity: 0, y: 14, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 14, x: '-50%' }}
          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          drag="x"
          dragConstraints={{ left: -100, right: 100 }}
          onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 50) setFeedback(null); }}
        >
          <span>{feedback}</span>
          <button
            onClick={() => setFeedback(null)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', padding: 4 }}
            title="Cerrar"
          >
            <X size={16} />
          </button>
        </motion.div>,
        document.body
      )}
    </div>
  );
});
