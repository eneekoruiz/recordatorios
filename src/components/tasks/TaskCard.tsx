import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, useMotionValue, useTransform, AnimatePresence, useMotionValueEvent } from 'framer-motion';
import {
  Lock,
  ChevronDown, X, Info, RotateCcw, Flag,
  ShieldAlert, Clock, CheckCircle2, CreditCard,
  User, MapPin, Link2, Check, GripVertical,
  SkipForward, Sparkles
} from 'lucide-react';
import type { TaskItem, ListSection } from '../../models/Task';
import { useAppStore, isTaskCompleted } from '../../store/useAppStore';
import { useTemporalNavigationStore } from '../../store/useTemporalNavigationStore';
import { isCompletedInCurrentPeriod, isSkippedInCurrentPeriod, calculateExpirationStatus, matchesPeriod } from '../../services/TaskService';
import { calculateTaskStreak } from '../../utils/streaks';
import { detectTaskSmartSuggestion } from '../../utils/taskSmartSuggestions';
import { SoundService } from '../../services/SoundService';
import { HapticService } from '../../services/HapticService';
import { ConfettiService } from '../../services/ConfettiService';
import { ConfirmModal } from '../ui/ConfirmModal';
import { confirmDialog } from '../ui/confirmDialog';
import { DeleteParentModal } from './DeleteParentModal';
import type { SpotlightRect } from '../ui/SpotlightBackdrop';
import { isCaducidadesList, isQueHeHechoList, isLifeLibraryList } from '../../utils/specialLists';
import { MediaTrackerFields } from '../library/MediaTrackerFields';
import { TaskContextMenu } from './card/TaskContextMenu';
import { TaskSwipeBackground } from './card/TaskSwipeBackground';
import { TaskMetaBadges } from './card/TaskMetaBadges';
import { TaskHabitCounter } from './card/TaskHabitCounter';
import { TaskNoteEditor } from './card/TaskNoteEditor';
import { getTaskPeriodicity, getSectionPeriodicity, stripPeriodicityPrefix, getEffectiveCycleId } from '../../utils/sectionRoutine';
import { extractPrice } from '../../utils/priceExtractor';
import { classifyDropZone, DROP_GAP_PX, createEdgeAutoScroll, findScrollableParent, relativeYInRow, dropTargetAt, guardNativeScroll, createDragGhost } from '../../utils/dragDrop';

interface TaskCardProps {
  task: TaskItem;
  virtualStyle: React.CSSProperties;
  onToggle: (id: string, forceReverse?: boolean, customTimestamp?: number | Date) => void;
  onDelete: (id: string) => void;
  onOpenZenMode?: (id: string) => void;
  onEdit: (id: string, initialFocus?: string) => void;
  index?: number;
  showListName?: boolean;
  /** Oculta la fecha en vistas donde ya es obvia (p. ej. «Hoy»). */
  hideDueDate?: boolean;
  /** Cómo mostrar la frecuencia: nada si el contexto ya la dice, glifo, o texto si la sección mezcla frecuencias. */
  frequencyMode?: 'none' | 'glyph' | 'label';
  isFirstInSection?: boolean;
  isLastInSection?: boolean;
  previousTaskId?: string;
  hasChildren?: boolean;
  childCount?: number;
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
  /** Solo si la lista admite duración (rutinas): empezar esta tarea sola, como una sección o una lista. */
  onStartTask?: (task: TaskItem) => void;
  isSelected?: boolean;
  onToggleSelect?: (taskId: string) => void;
  isSelectionMode?: boolean;
  referenceDate?: Date;
  /** Frecuencia de la sección que contiene la fila: si coincide con la de la tarea, no se repite. */
  contextPeriodicity?: 'day' | 'week' | 'month' | 'year' | null;
  sessionDates?: Set<string> | string[];
}

// Recorrido del dedo (px) a partir del cual deslizar completa (→) o pide borrar (←).
const SWIPE_COMPLETE_THRESHOLD = 65;
const SWIPE_DELETE_THRESHOLD = -65;

function isTaskSuggestionDismissed(taskId: string): boolean {
  try {
    const raw = localStorage.getItem('dismissed_task_suggestions') || localStorage.getItem('dismissed_habit_suggestions');
    if (!raw) return false;
    const list = JSON.parse(raw);
    return Array.isArray(list) && list.includes(taskId);
  } catch {
    return false;
  }
}

function dismissTaskSuggestion(taskId: string): void {
  try {
    const raw = localStorage.getItem('dismissed_task_suggestions') || localStorage.getItem('dismissed_habit_suggestions');
    const list = raw ? JSON.parse(raw) : [];
    if (Array.isArray(list) && !list.includes(taskId)) {
      list.push(taskId);
      localStorage.setItem('dismissed_task_suggestions', JSON.stringify(list));
    }
  } catch {}
}

export const TaskCard = React.memo(function TaskCard({
  task, virtualStyle, onToggle, onDelete, onOpenZenMode, onEdit, showListName = true, hideDueDate = false, frequencyMode = 'glyph', isFirstInSection, isLastInSection, previousTaskId, hasChildren, childCount = 0, isExpanded, onToggleExpand, indent = 0, onNavigateView, onPersonClick, isGracePeriod,
  onMoveUp, onMoveDown, canMoveUp, canMoveDown, onReorderTasks, onStartTask,
  isSelected, onToggleSelect, isSelectionMode, referenceDate: propReferenceDate, contextPeriodicity, sessionDates
}: TaskCardProps) {
  const cycles = useAppStore(state => state.cycles);
  const hasPendingBlocker = useAppStore(state => Boolean(task.blockedBy?.some(id => state.tasks[id]?.status === 'pending')));
  const hasSubtasks = childCount > 0;
  const nestTask = useAppStore(state => state.nestTask);
  const lists = useAppStore(state => state.lists);
  const listSections = useAppStore(state => state.listSections);
  const skipTask = useAppStore(state => state.skipTask);
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
    if (periodicity && contextPeriodicity && periodicity === contextPeriodicity) return null;
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
      return { type: 'custom' as const, label: custom?.name || cycleId, color: custom?.color, icon: custom?.icon };
    }

    return null;
  })();

  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number; maxHeight: number }>({ x: 0, y: 0, maxHeight: 400 });
  const [contextMenuTriggerRect, setContextMenuTriggerRect] = useState<SpotlightRect | null>(null);

  useEffect(() => {
    if (!contextMenuOpen) return;
    const handleDismissScroll = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest && target.closest('.ios-dropdown-menu')) {
        return; // Permite hacer scroll interno dentro del menú desplegable
      }
      setContextMenuOpen(false);
    };
    const handleDismiss = () => setContextMenuOpen(false);
    window.addEventListener('wheel', handleDismissScroll, { passive: true });
    window.addEventListener('close-list-menus', handleDismiss);
    window.addEventListener('close-context-menus', handleDismiss);
    return () => {
      window.removeEventListener('wheel', handleDismissScroll);
      window.removeEventListener('close-list-menus', handleDismiss);
      window.removeEventListener('close-context-menus', handleDismiss);
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

  // ── Touch drag-to-reorder (long press → drag, no handle needed) ──────────
  const [isDraggingTouch, setIsDraggingTouch] = useState(false);
  const touchDragGhostRef = useRef<ReturnType<typeof createDragGhost> | null>(null);
  const touchDragActiveRef = useRef(false); // true once finger moves after long-press lift
  const touchDragLiftedRef = useRef(false); // true after 380ms (card "lifted", waiting to see if drag or menu)
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  // iOS: sin esta escucha no pasiva desde el principio del toque, el scroll nativo acompañaba al
  // arrastre (y en sentido contrario al dedo). Solo actúa con la pulsación larga ya armada.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    return guardNativeScroll(el, () => touchDragLiftedRef.current || touchDragActiveRef.current);
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    return () => {
      if (touchDragGhostRef.current) {
        touchDragGhostRef.current.remove();
        touchDragGhostRef.current = null;
      }
      if (typeof document !== 'undefined') {
        document.querySelectorAll('.drag-ghost, [data-drag-ghost], [data-touch-drag-ghost]').forEach(el => el.remove());
        document.querySelectorAll<HTMLElement>('[data-touch-drag-over]').forEach(el => el.removeAttribute('data-touch-drag-over'));
        document.querySelectorAll<HTMLElement>('[data-task-drop-section]').forEach(el => el.removeAttribute('data-task-drop-section'));
        document.body.style.overflow = '';
      }
    };
  }, []);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title || '');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [editNote, setEditNote] = useState(task.description || '');
  const cardRef = useRef<HTMLDivElement>(null);
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);
  const updateTask = useAppStore(state => state.updateTask);
  const inlineEditingTaskId = useAppStore(state => state.inlineEditingTaskId);
  const setInlineEditingTaskId = useAppStore(state => state.setInlineEditingTaskId);

  const [dismissedTaskId, setDismissedTaskId] = useState(task.id);
  const [isSuggestionDismissed, setIsSuggestionDismissed] = useState(() => isTaskSuggestionDismissed(task.id));
  if (dismissedTaskId !== task.id) {
    setDismissedTaskId(task.id);
    setIsSuggestionDismissed(isTaskSuggestionDismissed(task.id));
  }

  const smartSuggestion = useMemo(() => {
    if (isSuggestionDismissed) return null;
    return detectTaskSmartSuggestion(task);
  }, [isSuggestionDismissed, task]);

  const handleApplySmartSuggestion = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!smartSuggestion) return;
    SoundService.playPop();
    HapticService.impact('medium');
    updateTask(task.id, smartSuggestion.patch);
  }, [smartSuggestion, task.id, updateTask]);

  const handleDismissSmartSuggestion = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    dismissTaskSuggestion(task.id);
    setIsSuggestionDismissed(true);
    HapticService.selection();
  }, [task.id]);

  const adjustTitleTextarea = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(24, el.scrollHeight)}px`;
  }, []);

  // Recién creada desde la fila en línea: entra directa a editar el título (durante el render).
  const isInlineTarget = inlineEditingTaskId === task.id;
  const [wasInlineTarget, setWasInlineTarget] = useState(false);
  if (isInlineTarget !== wasInlineTarget) {
    setWasInlineTarget(isInlineTarget);
    if (isInlineTarget) {
      setIsEditingTitle(true);
      setEditTitle(task.title || '');
    }
  }

  useEffect(() => {
    if (isEditingTitle && titleTextareaRef.current) {
      adjustTitleTextarea(titleTextareaRef.current);
    }
  }, [isEditingTitle, editTitle, adjustTitleTextarea]);

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
  }, [isPriorityPopoverOpen, setIsPriorityPopoverOpen, setPriorityPopoverPos]);

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

  const [isFrequencyPopoverOpen, setIsFrequencyPopoverOpen] = useState(false);
  const [frequencyPopoverPos, setFrequencyPopoverPos] = useState<{ x: number; y: number } | null>(null);

  const handleFrequencyBadgeClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    HapticService.selection();
    if (isFrequencyPopoverOpen) {
      setIsFrequencyPopoverOpen(false);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 180;
    const menuHeight = 220;
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

    setFrequencyPopoverPos({ x, y });
    setIsFrequencyPopoverOpen(true);
  }, [isFrequencyPopoverOpen, setIsFrequencyPopoverOpen, setFrequencyPopoverPos]);

  useEffect(() => {
    if (!isFrequencyPopoverOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFrequencyPopoverOpen(false);
    };
    const handleScroll = (e: Event) => {
      if ((e.target as HTMLElement)?.closest?.('.frequency-picker-popover')) return;
      setIsFrequencyPopoverOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isFrequencyPopoverOpen]);

  const handleSelectFrequency = useCallback((freq: 'day' | 'week' | 'month' | 'year' | 'none') => {
    HapticService.impact('medium');
    setIsFrequencyPopoverOpen(false);

    const cleanTitle = stripPeriodicityPrefix(task.title);
    const cycleId = freq === 'none' ? undefined : `cycle_${freq}`;

    const listSecs: ListSection[] = task.categoryId && listSections ? listSections.filter((s: ListSection) => s.listId === task.categoryId) : [];
    let newSectionId = task.sectionId;

    if (freq === 'none') {
      if (task.sectionId) {
        const currentSecPeriodicity = getSectionPeriodicity(task.sectionId, undefined, listSecs, lists);
        if (currentSecPeriodicity) {
          const nonPeriodicSec = listSecs.find((s: ListSection) => !getSectionPeriodicity(s.id, s.name, listSecs, lists));
          newSectionId = nonPeriodicSec ? nonPeriodicSec.id : undefined;
        }
      }
    } else {
      const matchingSec = listSecs.find((s: ListSection) => getSectionPeriodicity(s.id, s.name, listSecs, lists) === freq);
      if (matchingSec) {
        newSectionId = matchingSec.id;
      }
    }

    updateTask(task.id, {
      title: cleanTitle,
      cycle_id: cycleId,
      sectionId: newSectionId,
    });
  }, [task.id, task.title, task.categoryId, task.sectionId, listSections, lists, updateTask, setIsFrequencyPopoverOpen]);


  // --- SWIPE (iOS-style: card physically moves) ---
  const x = useMotionValue(0);

  const getCardElement = useCallback(() => cardRef.current, []);

  const openContextMenu = useCallback(() => {
    if (typeof document !== 'undefined' && document.querySelector('[role="dialog"], [aria-modal="true"], .duration-info-card-overlay, .spotlight-overlay, .drawer-overlay, .prompt-overlay, .premium-overlay')) {
      return;
    }
    HapticService.impact('medium');
    x.set(0); // Reset any active horizontal swipe offset immediately
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      setContextMenuTriggerRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
      const viewportH = window.innerHeight;
      const viewportW = window.innerWidth;
      const menuWidth = Math.min(260, viewportW - 24);
      const estimatedMenuHeight = 360;
      const padding = 12;

      // Colocación inteligente: si hay espacio abajo, abajo; si no, arriba para NO tapar nunca la tarjeta
      const spaceBelow = Math.max(0, viewportH - (rect.bottom + 6) - padding);
      const spaceAbove = Math.max(0, rect.top - 6 - padding);

      let top: number;
      let maxH: number;
      if (spaceBelow >= estimatedMenuHeight || spaceBelow >= spaceAbove) {
        top = rect.bottom + 6;
        maxH = Math.max(120, spaceBelow);
      } else {
        maxH = Math.max(120, spaceAbove);
        const actualH = Math.min(estimatedMenuHeight, maxH);
        top = rect.top - 6 - actualH;
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
  }, [x, setContextMenuOpen, setContextMenuPosition]);

  // Si la tarea cambia desde fuera (otra pestaña, sincronización) y no se está editando,
  // los campos reflejan el valor guardado (se ajusta durante el render).
  if (!isEditingTitle && editTitle !== (task.title || '')) setEditTitle(task.title || '');
  if (!isEditingNote && editNote !== (task.description || '')) setEditNote(task.description || '');

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

  const temporalDate = useTemporalNavigationStore((state) => state.temporalDate);
  const today = useTemporalNavigationStore((state) => state.today);
  const referenceDate = useMemo(() => {
    if (propReferenceDate) return propReferenceDate;
    return temporalDate ? new Date(temporalDate) : new Date(today);
  }, [propReferenceDate, temporalDate, today]);

  const isBlocked = hasPendingBlocker;
  // Se decide por el puntero, no por el ancho: una ventana estrecha con ratón también revela el (i) al pasar.
  const canHover = useMemo(() => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(hover: hover) and (pointer: fine)').matches), []);
  const showInfoButton = contextMenuOpen || (canHover ? isHovered : (isEditingTitle || isEditingNote));
  const effCycleId = getEffectiveCycleId(task, listSections, lists);
  const isRecurring = Boolean(effCycleId);
  const isCompletedPeriod = isCompletedInCurrentPeriod(task, cycles, listSections, lists, referenceDate, sessionDates);
  const isSkippedThisPeriod = isSkippedInCurrentPeriod(task, cycles, listSections, lists, referenceDate);
  const isJournalEntry = task.type === 'log' || isQueHeHechoList(task.categoryId, lists.find(l => l.id === task.categoryId));
  const isEffectivelyDone = isRecurring
    ? (isCompletedPeriod || !!isGracePeriod)
    : (isTaskCompleted(task) || !!isGracePeriod);

  // Background reveal: opacity tied to card x position
  const leftBgOpacity = useTransform(x, [0, 40, 80], [0, 0.7, 1]);
  const rightBgOpacity = useTransform(x, [0, -40, -80], [0, 0.7, 1]);
  const leftIconScale = useTransform(x, [20, 80], [0.6, 1]);
  const rightIconScale = useTransform(x, [-20, -80], [0.6, 1]);
  const leftIconX = useTransform(x, [0, 100], [-30, 10]);
  const rightIconX = useTransform(x, [0, -100], [30, -10]);

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


  const handleSkipTask = useCallback(async () => {
    if (isBlocked) return;
    HapticService.selection();

    if (isSkippedThisPeriod) {
      skipTask(task.id, true, referenceDate);
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: `Recordatorio «${task.title}» reactivado como pendiente`
      }));
      return;
    }

    const currentSkips = task.consecutiveSkipCount || 0;
    if (currentSkips >= 2) {
      let freqUnit = 'veces';
      if (effCycleId === 'cycle_day' || effCycleId === 'day') freqUnit = 'días';
      else if (effCycleId === 'cycle_week' || effCycleId === 'week') freqUnit = 'semanas';
      else if (effCycleId === 'cycle_month' || effCycleId === 'month') freqUnit = 'meses';
      else if (effCycleId === 'cycle_year' || effCycleId === 'year') freqUnit = 'años';

      const ok = await confirmDialog({
        title: '¿Seguro que quieres omitir?',
        message: `Llevas ${currentSkips} ${freqUnit} seguidos omitiendo "${task.title}". ¿Quieres omitirla también para este período?`,
        confirmText: 'Omitir de todas formas',
        cancelText: 'Hacerla ahora'
      });
      if (!ok) return;
    }

    skipTask(task.id, false, referenceDate);
    const nextSkips = currentSkips + 1;
    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: `Recordatorio «${task.title}» omitido este período (${nextSkips}ª vez consecutiva)`
    }));
  }, [isBlocked, isSkippedThisPeriod, skipTask, task.id, task.title, task.consecutiveSkipCount, referenceDate, effCycleId]);

  const handleSwipeEnd = useCallback((offsetX: number) => {
    if (offsetX > SWIPE_COMPLETE_THRESHOLD && !isBlocked) {
      HapticService.notification('success');
      // Always toggle: if completed → uncomplete, if pending → complete
      if (!isEffectivelyDone) SoundService.playComplete(); else SoundService.playUncomplete();
      onToggle(task.id, isEffectivelyDone, propReferenceDate ? propReferenceDate.getTime() : undefined);
    } else if (offsetX < SWIPE_DELETE_THRESHOLD) {
      HapticService.impact('heavy');
      setIsDeleteConfirmOpen(true);
    }
  }, [isBlocked, isEffectivelyDone, onToggle, task.id, setIsDeleteConfirmOpen, propReferenceDate]);

  const isSameCountPeriod = matchesPeriod(
    task.updated_at ? [task.updated_at] : [], effCycleId || 'cycle_day', referenceDate, cycles
  );

  const hasTargetCount = Boolean(task.targetCount && task.targetCount > 1);
  const targetCount = task.targetCount || 1;

  const totalAlerts = task.alerts?.length || 0;
  const rawCompletedAlerts = task.completedAlerts?.length || 0;
  const completedAlertsCount = (isRecurring && !isSameCountPeriod) ? 0 : rawCompletedAlerts;

  const effectiveCurrentCount = hasTargetCount
    ? (isCompletedPeriod
        ? targetCount
        : (isSameCountPeriod ? (task.currentCount || 0) : 0))
    : (task.currentCount || 0);

  const isTargetPartial = hasTargetCount && effectiveCurrentCount > 0 && effectiveCurrentCount < targetCount;
  const isPartial = (totalAlerts > 1 && completedAlertsCount > 0 && completedAlertsCount < totalAlerts) || isTargetPartial;
  const percentage = hasTargetCount
    ? (Math.min(effectiveCurrentCount, targetCount) / targetCount) * 100
    : (totalAlerts > 1 ? (completedAlertsCount / totalAlerts) * 100 : 0);

  const habitStreak = useMemo(() => calculateTaskStreak(task, listSections, lists, cycles), [task, listSections, lists, cycles]);
  const isCaducidad = isCaducidadesList(task.categoryId) || !!task.expirationType;
  const expirationStatus = isCaducidad ? calculateExpirationStatus(task.dueDate) : null;

  const [dragOverPosition, setDragOverPosition] = useState<'top' | 'bottom' | 'inside' | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    if (!onReorderTasks) return;
    if (e.dataTransfer.types.includes('text/task-id') || e.dataTransfer.types.includes('text/plain')) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      setDragOverPosition(classifyDropZone(relativeYInRow(e.currentTarget as HTMLElement, e.clientY)));
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
    const pos = dragOverPosition;
    setDragOverPosition(null);
    if (sourceId && sourceId !== task.id) {
      if (pos === 'inside') {
        nestTask(sourceId, task.id);
        HapticService.notification('success');
      } else {
        onReorderTasks(sourceId, task.id, pos === 'bottom' ? 'after' : 'before');
        HapticService.impact('medium');
      }
    }
  };

  const handleDragStart = (e: React.DragEvent) => {
    // Desktop only — touch drag is handled separately via touch events
    if (e.nativeEvent instanceof DragEvent && !e.nativeEvent.clientX) return;
    e.stopPropagation();
    // Arrastrar no es mantener pulsado: sin esto, a los 380 ms se abría el menú en mitad del arrastre.
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    e.dataTransfer.setData('text/task-id', task.id);
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
    if (cardRef.current && e.dataTransfer.setDragImage) {
      e.dataTransfer.setDragImage(cardRef.current, 20, 20);
    }
  };

  // ── Touch drag helpers ─────────────────────────────────────────────────────
  const startTouchDrag = useCallback((startY: number, startX: number) => {
    if (!onReorderTasks || !wrapperRef.current) return;
    x.set(0); // Cancel any horizontal swipe translation
    touchDragLiftedRef.current = true;
    touchDragActiveRef.current = true;

    if (typeof document !== 'undefined') {
      document.querySelectorAll<HTMLElement>('.drag-ghost, [data-drag-ghost], [data-touch-drag-ghost]').forEach(el => el.remove());
    }

    // La copia flota bajo el dedo: sin identificador para que nunca cuente como fila de destino.
    touchDragGhostRef.current = createDragGhost(wrapperRef.current, startY, ['data-task-id']);
    setIsDraggingTouch(true);
    HapticService.impact('medium');

    // Dónde se soltaría. Se busca la fila que hay de verdad bajo el dedo (una cabecera de sección
    // fija tapa las filas que pasan por debajo) y se mantiene mientras el dedo siga en ella o en el
    // hueco que ha abierto: si no, el hueco movería la fila y el objetivo parpadearía.
    let target: HTMLElement | null = null;
    let zone: 'top' | 'bottom' | 'inside' | 'section' | null = null;
    let lastX = startX;
    let lastY = startY;
    const clearTarget = () => {
      target?.removeAttribute('data-touch-drag-over');
      target?.removeAttribute('data-task-drop-section');
      target = null;
      zone = null;
    };
    const updateTarget = () => {
      let next: HTMLElement | null = null;
      if (target?.isConnected) {
        const rel = relativeYInRow(target, lastY);
        const slack = (DROP_GAP_PX + 2) / target.getBoundingClientRect().height;
        if (rel >= -slack && rel <= 1 + slack) next = target;
      }
      if (!next) {
        next = dropTargetAt(lastX, lastY, '.task-item-wrapper[data-task-id], .group-header[data-section-drag-key], [data-section-drag-key]');
        if (next?.getAttribute('data-task-id') === task.id) next = null;
      }
      if (next !== target) clearTarget();
      target = next;
      if (!target) return;
      if (target.classList.contains('group-header') || target.hasAttribute('data-section-drag-key')) {
        zone = 'section';
        target.setAttribute('data-task-drop-section', 'true');
        return;
      }
      zone = classifyDropZone(relativeYInRow(target, lastY));
      if (target.getAttribute('data-touch-drag-over') !== zone) target.setAttribute('data-touch-drag-over', zone);
    };
    const autoScroll = createEdgeAutoScroll(findScrollableParent(wrapperRef.current), updateTarget);

    const onMove = (ev: TouchEvent) => {
      const t = ev.touches && ev.touches.length > 0 ? ev.touches[0] : null;
      if (!t) return;
      if (ev.cancelable) ev.preventDefault();
      touchDragGhostRef.current?.move(t.clientY);
      lastX = t.clientX;
      lastY = t.clientY;
      autoScroll.update(lastY);
      updateTarget();
    };

    // Un solo final para soltar y para cancelar: quita las escuchas a la vez.
    const finish = (commit: boolean) => {
      autoScroll.stop();
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onCancel);
      document.removeEventListener('pointerup', onEnd);
      document.removeEventListener('pointercancel', onCancel);
      document.removeEventListener('mouseup', onEnd);
      touchDragGhostRef.current?.remove();
      touchDragGhostRef.current = null;
      document.querySelectorAll<HTMLElement>('.drag-ghost, [data-drag-ghost], [data-touch-drag-ghost]').forEach(el => el.remove());
      document.querySelectorAll<HTMLElement>('[data-touch-drag-over]').forEach(el => el.removeAttribute('data-touch-drag-over'));
      document.querySelectorAll<HTMLElement>('[data-task-drop-section]').forEach(el => el.removeAttribute('data-task-drop-section'));
      setIsDraggingTouch(false);
      touchDragLiftedRef.current = false;
      touchDragActiveRef.current = false;
      document.body.style.overflow = '';
      x.set(0);
      if (!commit) {
        clearTarget();
        touchDragActiveRef.current = false;
        return;
      }

      const targetId = target?.getAttribute('data-task-id') || null;
      const targetSectionId = target?.getAttribute('data-section-drag-key') || null;
      const dropZone = zone;
      clearTarget();
      if (dropZone === 'section' && targetSectionId) {
        // Soltar sobre la cabecera de una sección: pasa a esa sección (igual que con el ratón).
        useAppStore.getState().updateTaskSection(task.id, targetSectionId);
        HapticService.impact('medium');
      } else if (targetId && targetId !== task.id) {
        if (dropZone === 'inside') {
          nestTask(task.id, targetId);
          HapticService.notification('success');
        } else if (onReorderTasks) {
          onReorderTasks(task.id, targetId, dropZone === 'bottom' ? 'after' : 'before');
          HapticService.impact('medium');
        }
      }
    };
    const onEnd = () => finish(true);
    const onCancel = () => finish(false);

    document.body.style.overflow = 'hidden';
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onCancel);
    document.addEventListener('pointerup', onEnd);
    document.addEventListener('pointercancel', onCancel);
    document.addEventListener('mouseup', onEnd);
  }, [onReorderTasks, task.id, nestTask, x]);

  return (
    <div
      className="task-item-wrapper"
      data-task-id={task.id}
      // Refleja el estado de arrastre de escritorio como atributo: el propio CSS (con
      // !important, ya que ".task-item-wrapper" fuerza margin-bottom:0 en otro sitio) abre
      // el hueco igual para ratón y para dedo — ver TOUCH DRAG-TO-REORDER en polish.css.
      data-drag-over-pos={dragOverPosition || undefined}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      ref={wrapperRef}
      style={{
        ...virtualStyle,
        position: 'relative',
        margin: 0,
        boxSizing: 'border-box',
        zIndex: isDraggingTouch ? 999990 : (contextMenuOpen ? 999992 : 1),
        touchAction: isDraggingTouch ? 'none' : 'pan-y',
        WebkitTouchCallout: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        opacity: isDraggingTouch ? 0.35 : 1,
        transition: [
          isDraggingTouch ? 'opacity 0.15s' : '',
          'margin-top 0.18s cubic-bezier(0.22,1,0.36,1)',
          'margin-bottom 0.18s cubic-bezier(0.22,1,0.36,1)'
        ].filter(Boolean).join(', '),
      }}
      onPointerDown={(e) => {
        if (typeof document !== 'undefined' && document.querySelector('[role="dialog"], [aria-modal="true"], .duration-info-card-overlay, .spotlight-overlay, .drawer-overlay, .prompt-overlay, .premium-overlay')) {
          return;
        }
        if (isEditingTitle || isEditingNote) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (onToggleSelect && (isSelectionMode || e.ctrlKey || e.metaKey)) {
          e.stopPropagation();
          onToggleSelect(task.id);
          HapticService.selection();
          return;
        }
        didLongPressRef.current = false;
        touchStartX.current = e.clientX;
        touchStartY.current = e.clientY;
        if (longPressTimer.current) window.clearTimeout(longPressTimer.current);

        if (e.pointerType === 'touch' && onReorderTasks) {
          // Mobile: long press → drag mode (context menu shows only if no drag occurs)
          longPressTimer.current = window.setTimeout(() => {
            longPressTimer.current = null;
            didLongPressRef.current = true;
            touchDragLiftedRef.current = true;
            openContextMenu();
          }, 280);
        } else {
          // Desktop / mouse: long press → context menu as before
          longPressTimer.current = window.setTimeout(() => {
            didLongPressRef.current = true;
            openContextMenu();
          }, 380);
        }
      }}
      onClickCapture={(e) => {
        if (didLongPressRef.current) {
          e.stopPropagation();
          e.preventDefault();
        }
      }}
      onPointerMove={(e) => {
        if (e.pointerType === 'touch' && didLongPressRef.current && touchDragLiftedRef.current && !touchDragActiveRef.current && !isDraggingTouch) {
          const dx = Math.abs(e.clientX - touchStartX.current);
          const dy = Math.abs(e.clientY - touchStartY.current);
          if (dx > 10 || dy > 10) {
            touchDragActiveRef.current = true;
            touchDragLiftedRef.current = false;
            setContextMenuOpen(false);
            startTouchDrag(touchStartY.current, touchStartX.current);
          }
        }
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
        touchDragLiftedRef.current = false;
      }}
      onPointerCancel={() => {
        if (longPressTimer.current) {
          window.clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
        touchDragLiftedRef.current = false;
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof document !== 'undefined' && document.querySelector('[role="dialog"], [aria-modal="true"], .duration-info-card-overlay, .spotlight-overlay, .drawer-overlay, .prompt-overlay, .premium-overlay')) {
          return;
        }
        if (longPressTimer.current) {
          window.clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
        openContextMenu();
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* El hueco (marginTop/marginBottom, arriba) ya "abre camino"; esta línea solo marca
          el punto exacto de inserción dentro de ese hueco, con el color de la propia lista. */}
      {dragOverPosition === 'top' && (
        <div
          style={{
            position: 'absolute', top: -DROP_GAP_PX / 2 - 1.5, left: 16, right: 16, height: 3,
            borderRadius: 999,
            background: taskColor,
            zIndex: 9999,
            pointerEvents: 'none'
          }}
        >
          <div style={{ position: 'absolute', left: -3, top: -2, width: 7, height: 7, borderRadius: '50%', background: taskColor }} />
        </div>
      )}
      {dragOverPosition === 'bottom' && (
        <div
          style={{
            position: 'absolute', bottom: -DROP_GAP_PX / 2 - 1.5, left: 16, right: 16, height: 3,
            borderRadius: 999,
            background: taskColor,
            zIndex: 9999,
            pointerEvents: 'none'
          }}
        >
          <div style={{ position: 'absolute', left: -3, top: -2, width: 7, height: 7, borderRadius: '50%', background: taskColor }} />
        </div>
      )}
      {/* Anidar no reordena, así que no abre hueco: solo un anillo fino sobre la propia
          tarjeta destino (nunca un recuadro relleno) y una etiqueta que confirma el gesto. */}
      {dragOverPosition === 'inside' && (
        <div
          style={{
            position: 'absolute',
            inset: 2,
            borderRadius: 12,
            boxShadow: `inset 0 0 0 2px ${taskColor}`,
            zIndex: 9999,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: 10
          }}
        >
          <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#fff', background: taskColor, padding: '2px 7px', borderRadius: 6, boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }}>
            Anidar
          </span>
        </div>
      )}

      {/* Fixed swipe action backgrounds - hidden during context menu or drag to prevent bleed-through */}
      {!contextMenuOpen && !isDraggingTouch && (
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
        className={`task-row${contextMenuOpen ? ' selected-card' : ''}`}
        drag={contextMenuOpen || isDraggingTouch ? false : "x"}
        dragSnapToOrigin
        dragConstraints={{ left: -140, right: 140 }}
        dragElastic={0.25}
        dragTransition={{ bounceStiffness: 500, bounceDamping: 35 }}
        onDragEnd={(_, info) => handleSwipeEnd(info.offset.x)}
        animate={{
          scale: 1,
          // La elevación la pone el telón (hueco con sombra): aquí, sin bordes dobles.
          boxShadow: 'none',
          borderRadius: contextMenuOpen 
            ? '12px' 
            : (isFirstInSection && isLastInSection 
                ? '10px' 
                : isFirstInSection 
                  ? '10px 10px 0 0' 
                  : isLastInSection 
                    ? '0 0 10px 10px' 
                    : '0px'),
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 400 }}
        style={{
          x,
          position: 'relative',
          zIndex: contextMenuOpen ? 999992 : 1,
          minHeight: 44,
          display: 'flex',
          // Como en Recordatorios: la casilla y el (i) se alinean con la primera
          // línea del título, no con el centro de una tarea de varias líneas.
          alignItems: 'flex-start',
          padding: `10px 8px 10px ${4 + indent}px`,
          margin: 0,
          width: '100%',
          boxSizing: 'border-box',
          // Opaca (tapa el fondo del deslizamiento) y del mismo color que la vista en claro y oscuro.
          background: isSelected ? 'var(--accent-glow, rgba(0, 122, 255, 0.12))' : 'var(--list-row-bg)',
          boxShadow: isSelected ? 'inset 0 0 0 1.5px var(--accent-primary, #007aff)' : 'none',
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

        {/* Conector visual jerárquico para subtareas (estilo árbol / guía de anidación) */}
        {Boolean(task.parentId) && indent > 0 && (
          <div
            aria-hidden="true"
            className="subtask-tree-guide"
            style={{
              position: 'absolute',
              left: `${Math.max(12, indent - 10)}px`,
              top: 0,
              height: '22px',
              width: '10px',
              borderLeft: '1px solid var(--separator-hair)',
              borderBottom: '1px solid var(--separator-hair)',
              borderBottomLeftRadius: '6px',
              pointerEvents: 'none'
            }}
          />
        )}

        {/* Checkbox o Botón Restaurar en Papelera */}
        {task.deleted_at ? (
          <motion.button
            className="hit-44"
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
              marginTop: 'calc((var(--task-title-lh) - 24px) / 2)',
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
        ) : isJournalEntry ? (
          // Entradas del diario («Qué he hecho»): ya están hechas; nada que marcar.
          <span
            aria-hidden="true"
            style={{
              width: 26, height: 26,
              marginTop: 'calc((var(--task-title-lh) - 26px) / 2)',
              marginRight: 8,
              flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-purple, #af52de)' }} />
          </span>
        ) : (
          <motion.button
            className="hit-44"
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
                onToggle(task.id, true, propReferenceDate ? propReferenceDate.getTime() : undefined);
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
                onToggle(task.id, false, propReferenceDate ? propReferenceDate.getTime() : undefined);
              }
            }}
            style={{
              width: 26, height: 26,
              marginTop: 'calc((var(--task-title-lh) - 26px) / 2)',
              padding: 0,
              background: 'transparent',
              border: 'none',
              marginRight: 10,
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
                backgroundColor: isSkippedThisPeriod ? '#ff9500' : (isEffectivelyDone ? taskColor : 'rgba(0,0,0,0)')
              }}
              transition={{
                scale: { type: 'spring', stiffness: 500, damping: 22 },
                backgroundColor: { duration: 0.2, ease: 'easeOut' }
              }}
              style={{
                width: 22, height: 22,
                borderRadius: '50%',
                border: (isEffectivelyDone || isPartial) ? 'none' : `1.5px solid var(--border-subtle)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: isEffectivelyDone ? `0 2px 8px ${taskColor}40` : 'none',
                transition: 'border-color 0.15s ease'
              }}
            >
              {isSkippedThisPeriod ? (
                <SkipForward size={11} strokeWidth={2.6} color="white" />
              ) : (
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
              )}
            </motion.div>
          </motion.button>
        )}

        {/* Content */}
        <div
          className="task-row-content"
          onClick={(e) => {
            // Toda la columna es la zona táctil del título (≥ 44 px): tocar el hueco equivale a tocar el texto.
            if (isEditingTitle || task.deleted_at) return;
            if ((e.target as HTMLElement).closest('button, a, input, textarea, [role="button"], [data-meta-field], .task-meta-line')) return;
            setIsEditingTitle(true);
          }}
          style={{ flex: 1, minWidth: 0, boxSizing: 'border-box' }}
        >
          {/* Arriba, no centrado: con un título de dos líneas la bandera y los contadores quedaban
              flotando entre ellas en vez de junto a la primera. */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, flexWrap: 'wrap' }}>
            {isBlocked && <Lock size={15} color="var(--accent-red)" />}
            {isEditingTitle ? (
              <div style={{ display: 'flex', alignItems: 'flex-start', width: '100%', gap: 4 }}>
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
                      fontSize: '1.05rem',
                      lineHeight: '1.4',
                      letterSpacing: '-0.5px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      WebkitTapHighlightColor: 'transparent',
                      transition: 'transform 0.15s ease, filter 0.15s ease',
                      userSelect: 'none',
                      marginTop: 2
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; e.currentTarget.style.filter = 'brightness(1.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.filter = 'none'; }}
                  >
                    {task.priority === 'low' || (task.priority as any) === 9 ? '!' : task.priority === 'medium' || (task.priority as any) === 5 ? '!!' : '!!!'}
                  </button>
                )}
                <textarea
                  ref={(el) => {
                    titleTextareaRef.current = el;
                    if (el) {
                      adjustTitleTextarea(el);
                      if (inlineEditingTaskId === task.id) {
                        el.focus();
                        setInlineEditingTaskId(null);
                      }
                    }
                  }}
                  className="task-title-input"
                  value={editTitle}
                  autoFocus
                  rows={1}
                  placeholder="Nuevo recordatorio..."
                  onChange={e => {
                    setEditTitle(e.target.value);
                    adjustTitleTextarea(e.target);
                  }}
                  onBlur={handleTitleSubmit}
                  onKeyDown={e => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const raw = editTitle.trim();
                      if (!raw) {
                        setIsEditingTitle(false);
                        setInlineEditingTaskId(null);
                        HapticService.selection();
                        if (onDelete) onDelete(task.id);
                        else useAppStore.getState().deleteTask(task.id);
                      } else {
                        // 1. Guardar el recordatorio actual
                        setIsEditingTitle(false);
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
                        // 2. Crear inmediatamente el siguiente recordatorio
                        const newTaskId = crypto.randomUUID();
                        const currentOrder = typeof task.order === 'number' ? task.order : 0;
                        useAppStore.getState().addTask({
                          id: newTaskId,
                          title: '',
                          categoryId: task.categoryId,
                          sectionId: task.sectionId,
                          cycle_id: task.cycle_id,
                          parentId: task.parentId,
                          order: currentOrder + 1,
                          status: 'pending',
                          type: 'task',
                          created_at: new Date().toISOString()
                        });
                        // 3. Enfocar el nuevo recordatorio creado
                        useAppStore.getState().setInlineEditingTaskId(newTaskId);
                        HapticService.selection();
                      }
                    } else if (e.key === 'Backspace' && !editTitle) {
                      e.preventDefault();
                      setIsEditingTitle(false);
                      setInlineEditingTaskId(null);
                      HapticService.selection();
                      if (onDelete) onDelete(task.id);
                      else useAppStore.getState().deleteTask(task.id);
                    } else if (e.key === 'Tab') {
                      e.preventDefault();
                      if (e.shiftKey) {
                        if (task.parentId) {
                          nestTask(task.id, undefined);
                          HapticService.selection();
                        }
                      } else {
                        if (previousTaskId && previousTaskId !== task.id) {
                          nestTask(task.id, previousTaskId);
                          HapticService.selection();
                        }
                      }
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setIsEditingTitle(false);
                      setInlineEditingTaskId(null);
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
                  onTouchStart={e => e.stopPropagation()}
                  onPaste={e => {
                    const pasted = e.clipboardData.getData('text');
                    if (pasted.includes('\n')) {
                      e.preventDefault();
                      const lines = pasted.split('\n').map(l => l.trim()).filter(Boolean);
                      if (lines.length > 0) {
                        setEditTitle(lines[0]);
                        const { addTask } = useAppStore.getState();
                        lines.slice(1).forEach((line, idx) => {
                          addTask({
                            id: crypto.randomUUID(),
                            title: line,
                            categoryId: task.categoryId,
                            sectionId: task.sectionId,
                            order: (task.order ?? 0) + idx + 1,
                            type: 'task',
                            completed: false,
                            created_at: new Date().toISOString()
                          } as any);
                        });
                      }
                    }
                  }}
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 400,
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    boxShadow: 'none',
                    WebkitBoxShadow: 'none',
                    color: 'var(--text-primary)',
                    padding: '2px 0',
                    margin: 0,
                    lineHeight: '1.4',
                    resize: 'none',
                    overflow: 'hidden',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'normal',
                    overflowWrap: 'anywhere',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    display: 'block'
                  }}
                />
              </div>
            ) : (
              <motion.span
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
                onClick={() => setIsEditingTitle(true)}
                className="task-title"
                animate={{
                  color: isEffectivelyDone ? 'var(--text-secondary)' : 'var(--text-primary)'
                }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                style={{
                  fontWeight: 400,
                  fontSize: 'var(--task-title-size)',
                  lineHeight: 'var(--task-title-lh)',
                  whiteSpace: 'normal',
                  wordBreak: 'normal',
                  overflowWrap: 'anywhere',
                  overflow: 'visible',
                  cursor: 'text',
                  position: 'relative',
                  display: 'inline-block',
                  minWidth: 0,
                  maxWidth: '100%'
                }}
              >
                {Boolean(task.priority && task.priority !== 'none' && (task.priority as any) !== 0) && (
                  <>
                  {/* Dentro del título (que ya es un botón) no puede ir otro botón: los signos se
                      ocultan a los lectores de pantalla y se anuncia la prioridad como texto. */}
                  <span className="sr-only">
                    {task.priority === 'low' || (task.priority as any) === 9 ? 'Prioridad baja: ' : task.priority === 'medium' || (task.priority as any) === 5 ? 'Prioridad media: ' : 'Prioridad alta: '}
                  </span>
                  <span
                    className={`priority-badge ${typeof task.priority === 'number' ? ((task.priority as any) === 1 ? 'high' : (task.priority as any) === 5 ? 'medium' : 'low') : task.priority}`}
                    onClick={handlePriorityBadgeClick}
                    onPointerDown={(e) => e.stopPropagation()}
                    title="Cambiar urgencia"
                    aria-hidden="true"
                    style={{
                      cursor: 'pointer',
                      border: 'none',
                      background: 'none',
                      padding: 0,
                      outline: 'none',
                      color: '#ff3b30',
                      fontWeight: 700,
                      fontSize: '1.05rem',
                      lineHeight: '1.4',
                      letterSpacing: '-0.5px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      WebkitTapHighlightColor: 'transparent',
                      transition: 'transform 0.15s ease, filter 0.15s ease',
                      userSelect: 'none',
                      marginRight: 4
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; e.currentTarget.style.filter = 'brightness(1.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.filter = 'none'; }}
                  >
                    {task.priority === 'low' || (task.priority as any) === 9 ? '!' : task.priority === 'medium' || (task.priority as any) === 5 ? '!!' : '!!!'}
                  </span>
                  </>
                )}
                <span style={{ position: 'relative', display: 'inline', wordBreak: 'normal', overflowWrap: 'anywhere' }}>
                  {task.title ? (
                    stripPeriodicityPrefix(task.title).split(/(https?:\/\/[^\s]+)/g).map((part, i) => 
                      part.match(/^https?:\/\//) ? (
                        <a key={i} href={part} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>
                          {part}
                        </a>
                      ) : part
                    )
                  ) : (
                    <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Nuevo recordatorio</span>
                  )}

                  {/* Línea de tachado animada de izquierda a derecha SOLO sobre el texto exacto */}
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
                </span>
              </motion.span>
            )}
            {isSkippedThisPeriod && (
              <span
                className="apple-skip-pill"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSkipTask();
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  padding: '1px 7px',
                  borderRadius: 999,
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  background: 'rgba(255, 149, 0, 0.12)',
                  border: '1px solid rgba(255, 149, 0, 0.28)',
                  color: '#ff9500',
                  cursor: 'pointer',
                  marginLeft: 6,
                  verticalAlign: 'middle',
                  lineHeight: '1.2'
                }}
                title="Omitida para este período. Clic para reactivar como pendiente."
              >
                <SkipForward size={10} strokeWidth={2.4} />
                <span>Omitida{task.consecutiveSkipCount && task.consecutiveSkipCount > 1 ? ` (${task.consecutiveSkipCount} seguidas)` : ''}</span>
              </span>
            )}

            {task.flagged && <Flag size={13} color="var(--accent-orange)" fill="var(--accent-orange)" style={{ marginTop: 'calc((var(--task-title-lh) - 13px) / 2)', flexShrink: 0 }} />}
            {task.targetCount && task.targetCount > 1 && (
              <TaskHabitCounter
                task={task}
                effectiveCurrentCount={effectiveCurrentCount}
                isEffectivelyDone={isEffectivelyDone}
                targetCount={targetCount}
                onToggle={onToggle}
              />
            )}
            {expirationStatus && (
              <span
                className="apple-expiration-pill"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(task.id, 'expiration');
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

            {/* Biblioteca de Vida: Series, Películas, Música, Libros, Recuerda */}
            {(isLifeLibraryList(task.categoryId, taskList) || task.mediaType || task.mediaStatus || task.mediaPlatform || (task.mediaRating && task.mediaRating > 0) || task.mediaNotes || task.mediaRecommendedBy) && (
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(task.id);
                }}
                style={{ cursor: 'pointer', display: 'inline-flex' }}
                title="Toca para editar detalles de la Biblioteca de Vida"
              >
                <MediaTrackerFields
                  task={task}
                  onUpdate={(updates) => updateTask(task.id, updates)}
                  isCompact
                />
              </div>
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
            cycleBadge={frequencyMode === 'none' ? null : cycleBadge}
            frequencyAsLabel={frequencyMode === 'label'}
            timeOfDayInfo={timeOfDayInfo}
            onEdit={onEdit}
            onNavigateView={onNavigateView}
            lists={lists}
            onOpenFrequencyPicker={handleFrequencyBadgeClick}
            streak={habitStreak && habitStreak.count >= 2 ? habitStreak : null}
          />

          {/* Smart suggestion banner for advanced features */}
          {smartSuggestion && !isSuggestionDismissed && !isEffectivelyDone && (
            <motion.div
              initial={{ opacity: 0, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 6,
                padding: '4px 8px',
                borderRadius: '8px',
                background: 'rgba(255, 149, 0, 0.1)',
                border: '1px solid rgba(255, 149, 0, 0.25)',
                fontSize: '0.74rem',
                color: 'var(--text-primary)',
                maxWidth: '100%',
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Sparkles size={12} style={{ color: '#ff9500', flexShrink: 0 }} />
                <span>{smartSuggestion.prompt}</span>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                <button
                  type="button"
                  onClick={handleApplySmartSuggestion}
                  style={{
                    background: '#ff9500',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '2px 8px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {smartSuggestion.actionLabel}
                </button>
                <button
                  type="button"
                  onClick={handleDismissSmartSuggestion}
                  title="Ignorar sugerencia"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-tertiary)',
                    cursor: 'pointer',
                    padding: '2px 4px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Subtask Chevron */}
        {hasChildren && (
          <button
            type="button"
            className="task-subtasks-btn"
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
              marginTop: 'calc((var(--task-title-lh) - 32px) / 2)',
              WebkitTapHighlightColor: 'transparent',
              flexShrink: 0,
              transition: 'color 0.2s ease',
              marginLeft: 6,
              marginRight: 6
            }}
            title={isExpanded ? "Ocultar subtareas" : "Mostrar subtareas"}
            aria-expanded={isExpanded}
            aria-label={`${isExpanded ? 'Ocultar' : 'Mostrar'} ${childCount === 1 ? 'la subtarea' : `las ${childCount} subtareas`} de «${task.title}»`}
          >
            {(() => {
              const count = childCount;
              return count > 0 ? <span style={{ fontVariantNumeric: 'tabular-nums' }}>{count}</span> : null;
            })()}
            <motion.div style={{ display: 'flex', alignItems: 'center' }} animate={{ rotate: isExpanded ? 0 : -90 }} transition={{ type: 'spring', damping: 20, stiffness: 300 }}>
              <ChevronDown size={18} />
            </motion.div>
          </button>
        )}

        {/* Apple Reminders Info (i) button & clean drag handle */}
        {!isBlocked && (
          <div className="task-row-trailing" style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 'calc((var(--task-title-lh) - 32px) / 2)' }}>
            <button
              className="task-info-btn"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                HapticService.selection();
                onEdit(task.id);
              }}
              aria-label={`Detalles de «${task.title || 'recordatorio'}»`}
              title="Detalles (i)"
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
                // Como en Recordatorios: con ratón aparece al pasar por encima; con el dedo, en la fila que se
                // está editando (tocar la fila la edita y deja el (i) a mano). Una columna de (i) en todas las
                // filas era ruido. El lector de pantalla y el teclado lo siguen encontrando siempre.
                opacity: showInfoButton ? 1 : 0,
                pointerEvents: canHover || showInfoButton ? 'auto' : 'none',
                transition: 'opacity 0.15s ease, background-color 0.15s ease, transform 0.12s ease',
                WebkitTapHighlightColor: 'transparent',
                flexShrink: 0
              }}
            >
              <Info size={17} strokeWidth={2.2} />
            </button>

            {!isMobile && Boolean(onReorderTasks) && (
              <div
                className="task-drag-handle"
                role="img"
                draggable={!isBlocked && !isEditingTitle && !isEditingNote && !contextMenuOpen}
                onDragStart={handleDragStart}
                onPointerDown={(e) => e.stopPropagation()}
                title="Arrastrar para reordenar o anidar"
                aria-label="Arrastrar para reordenar o anidar"
                style={{
                  width: 24,
                  height: 30,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'grab',
                  opacity: isHovered || contextMenuOpen ? 0.5 : 0,
                  transition: 'opacity 0.15s ease, color 0.15s ease',
                  color: 'var(--text-tertiary)',
                  flexShrink: 0
                }}
              >
                <GripVertical size={15} />
              </div>
            )}
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
        getTriggerElement={getCardElement}
        onEdit={onEdit}
        nestTask={nestTask}
        previousTaskId={previousTaskId}
        setIsDeleteConfirmOpen={setIsDeleteConfirmOpen}
        onOpenZenMode={onOpenZenMode}
        onToggle={(id, forceReverse) => onToggle(id, forceReverse, propReferenceDate ? propReferenceDate.getTime() : undefined)}
        isCompleted={isCompletedPeriod}
        onMoveUp={onMoveUp ? () => onMoveUp(task.id) : undefined}
        onMoveDown={onMoveDown ? () => onMoveDown(task.id) : undefined}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        onStartTask={onStartTask ? () => onStartTask(task) : undefined}
        onToggleSelect={onToggleSelect ? () => onToggleSelect(task.id) : undefined}
        onSkipTask={isRecurring ? handleSkipTask : undefined}
        isSkipped={isSkippedThisPeriod}
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
            <div style={{ padding: '4px 8px 2px', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-tertiary)', }}>
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

      {/* ── Native Frequency Picker Popover ── */}
      {isFrequencyPopoverOpen && frequencyPopoverPos && createPortal(
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 999998, background: 'transparent' }}
            onClick={(e) => { e.stopPropagation(); setIsFrequencyPopoverOpen(false); }}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setIsFrequencyPopoverOpen(false); }}
          />
          <motion.div
            className="frequency-picker-popover"
            initial={{ opacity: 0, scale: 0.94, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -4 }}
            transition={{ type: 'spring', damping: 25, stiffness: 450 }}
            style={{
              position: 'fixed',
              top: frequencyPopoverPos.y,
              left: frequencyPopoverPos.x,
              zIndex: 999999,
              minWidth: 175,
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
            <div style={{ padding: '4px 8px 2px', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-tertiary)', }}>
              Frecuencia
            </div>
            {[
              { value: 'day' as const, label: 'Diaria', color: '#ff9500' },
              { value: 'week' as const, label: 'Semanal', color: '#007aff' },
              { value: 'month' as const, label: 'Mensual', color: '#af52de' },
              { value: 'year' as const, label: 'Anual', color: '#34c759' },
              { value: 'none' as const, label: 'Sin repetición', color: 'var(--text-tertiary)' },
            ].map((f) => {
              const currentPeriodicity = getTaskPeriodicity(task, listSections, lists);
              const isCurrent = f.value === 'none' ? !currentPeriodicity : currentPeriodicity === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  className="ios-dropdown-item"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectFrequency(f.value);
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
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: f.color, flexShrink: 0 }} />
                    <span>{f.label}</span>
                  </div>
                  {isCurrent && <Check size={14} color="var(--accent-primary)" />}
                </button>
              );
            })}
          </motion.div>
        </>,
        document.body
      )}

      {hasSubtasks ? (
        <DeleteParentModal
          isOpen={isDeleteConfirmOpen}
          parentTitle={task.title}
          childCount={childCount}
          isPermanent={Boolean(task.deleted_at)}
          onDeleteAll={() => {
            setIsDeleteConfirmOpen(false);
            SoundService.playDelete();
            if (task.deleted_at) {
              useAppStore.getState().deleteTaskWithOptions(task.id, { keepSubtasks: false, permanent: true });
              HapticService.notification('warning');
            } else {
              useAppStore.getState().deleteTaskWithOptions(task.id, { keepSubtasks: false });
              HapticService.notification('success');
            }
          }}
          onKeepSubtasks={() => {
            setIsDeleteConfirmOpen(false);
            SoundService.playDelete();
            if (task.deleted_at) {
              useAppStore.getState().deleteTaskWithOptions(task.id, { keepSubtasks: true, permanent: true });
              HapticService.notification('warning');
            } else {
              useAppStore.getState().deleteTaskWithOptions(task.id, { keepSubtasks: true });
              HapticService.notification('success');
            }
          }}
          onCancel={() => setIsDeleteConfirmOpen(false)}
        />
      ) : (
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
      )}

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

