import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, useMotionValue, useTransform, AnimatePresence, useMotionValueEvent } from 'framer-motion';
import {
  CheckCircle, Trash2, Lock, Link2, Flag, MapPin,
  Image as ImageIcon, MoreHorizontal, Repeat, Edit3,
  ChevronDown, Copy, IndentIncrease, IndentDecrease, X, Play, Calendar, Info,
  AlertCircle, CalendarDays, CalendarX, Clock, Sun, ChevronRight, ArrowLeft, FolderInput, LayoutList
} from 'lucide-react';
import type { TaskItem } from '../../models/Task';
import { useAppStore, isTaskCompleted } from '../../store/useAppStore';
import { isCompletedInCurrentPeriod } from '../../services/TaskService';
import { SoundService } from '../../services/SoundService';
import { HapticService } from '../../services/HapticService';
import { ConfirmModal } from '../ui/ConfirmModal';

interface TaskCardProps {
  task: TaskItem;
  virtualStyle: React.CSSProperties;
  onToggle: (id: string, forceReverse?: boolean) => void;
  onDelete: (id: string) => void;
  onOpenZenMode?: (id: string) => void;
  onEdit: (id: string) => void;
  index?: number;
  showListName?: boolean;
  isFirstInSection?: boolean;
  isLastInSection?: boolean;
  previousTaskId?: string;
  hasChildren?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  indent?: number;
}

export const TaskCard = React.memo(function TaskCard({
  task, virtualStyle, onToggle, onDelete, onOpenZenMode, onEdit, showListName = true, isFirstInSection, isLastInSection, previousTaskId, hasChildren, isExpanded, onToggleExpand, indent = 0
}: TaskCardProps) {
  const cycles = useAppStore(state => state.cycles);
  const tasks = useAppStore(state => state.tasks);
  const nestTask = useAppStore(state => state.nestTask);
  const lists = useAppStore(state => state.lists);
  const taskCycle = cycles.find(c => c.id === task.cycle_id);
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

  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });

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
    window.addEventListener('wheel', handleScroll, { capture: true, passive: true });
    window.addEventListener('touchmove', handleScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('wheel', handleScroll, true);
      window.removeEventListener('touchmove', handleScroll, true);
    };
  }, [contextMenuOpen]);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isHovered, setIsHovered] = useState(false);
  const longPressTimer = useRef<number | null>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const hasCrossedLeftThreshold = useRef(false);
  const hasCrossedRightThreshold = useRef(false);

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

  const openContextMenu = useCallback(() => {
    HapticService.impact('medium');
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const menuWidth = 260;
      const estimatedMenuHeight = 420;
      
      const spaceBelow = window.innerHeight - rect.bottom;
      const showAbove = spaceBelow < 280 && rect.top > estimatedMenuHeight;
      
      const top = showAbove 
        ? Math.max(12, rect.top - estimatedMenuHeight - 6)
        : Math.min(window.innerHeight - estimatedMenuHeight - 12, rect.bottom + 6);
        
      let left = rect.right - menuWidth;
      if (rect.width <= 360) {
        left = rect.left;
      }
      left = Math.max(12, Math.min(window.innerWidth - menuWidth - 12, left));

      setContextMenuPosition({ x: left, y: top });
    }
    setContextMenuOpen(true);
  }, []);

  // Sync state if task changes externally but not while editing
  useEffect(() => {
    if (!isEditingTitle) setEditTitle(task.title || '');
    if (!isEditingNote) setEditNote(task.description || '');
  }, [task.title, task.description, isEditingTitle, isEditingNote]);

  const handleTitleSubmit = () => {
    // Delay setting isEditingTitle to false to prevent race condition with clicking "Añadir nota..."
    setTimeout(() => {
      setIsEditingTitle(false);
      if (editTitle.trim() && editTitle.trim() !== task.title) {
        updateTask(task.id, { title: editTitle.trim() });
      }
    }, 150);
  };

  const startEditingNote = () => {
    if (editTitle.trim() && editTitle.trim() !== task.title) {
      updateTask(task.id, { title: editTitle.trim() });
    }
    setIsEditingTitle(false);
    setIsEditingNote(true);
  };

  const handleNoteSubmit = () => {
    setIsEditingNote(false);
    if (editNote.trim() !== (task.description || '')) updateTask(task.id, { description: editNote.trim() });
  };

  const isBlocked = task.blockedBy && task.blockedBy.some(id => tasks[id] && tasks[id].status === 'pending');
  const isCompletedPeriod = isCompletedInCurrentPeriod(task, cycles);

  // --- SWIPE (iOS-style: card physically moves) ---
  const x = useMotionValue(0);

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
      if (!isCompletedPeriod) SoundService.playComplete(); else SoundService.playUncomplete();
      onToggle(task.id, isCompletedPeriod);
    } else if (offsetX < SWIPE_DELETE_THRESHOLD) {
      HapticService.impact('heavy');
      setIsDeleteConfirmOpen(true);
    }
  }, [isBlocked, isCompletedPeriod, onToggle, task.id]);

  const totalAlerts = task.alerts?.length || 0;
  const completedAlertsCount = task.completedAlerts?.length || 0;
  const isPartial = totalAlerts > 1 && completedAlertsCount > 0 && completedAlertsCount < totalAlerts;
  const percentage = totalAlerts > 1 ? (completedAlertsCount / totalAlerts) * 100 : 0;

  return (
    <div
      className="task-item-wrapper"
      style={{ ...virtualStyle, position: 'relative', margin: 0, boxSizing: 'border-box', zIndex: contextMenuOpen ? 99999 : 1 }}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse') return;
        touchStartX.current = e.clientX;
        touchStartY.current = e.clientY;
        if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
        longPressTimer.current = window.setTimeout(() => {
          openContextMenu();
        }, 380);
      }}
      onPointerMove={(e) => {
        if (!longPressTimer.current) return;
        const dx = Math.abs(e.clientX - touchStartX.current);
        const dy = Math.abs(e.clientY - touchStartY.current);
        if (dx > 10 || dy > 10) {
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
      {/* Fixed swipe action backgrounds */}
      {/* Left = Complete/Uncomplete */}
      <motion.div
        style={{
          position: 'absolute', top: 0, left: 0, bottom: 0,
          width: '50%',
          background: isCompletedPeriod ? 'var(--accent-orange)' : 'var(--accent-green)',
          display: 'flex', alignItems: 'center', paddingLeft: 24,
          opacity: leftBgOpacity, zIndex: 0,
          overflow: 'hidden'
        }}
      >
        <motion.div style={{ scale: leftIconScale, x: leftIconX }}>
          {isCompletedPeriod
            ? <CheckCircle color="white" size={26} style={{ opacity: 0.9 }} />
            : <CheckCircle color="white" size={26} />
          }
        </motion.div>
      </motion.div>

      {/* Right = Delete */}
      <motion.div
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0,
          width: '50%',
          background: 'var(--accent-red)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 24,
          opacity: rightBgOpacity, zIndex: 0,
          overflow: 'hidden'
        }}
      >
        <motion.div style={{ scale: rightIconScale, x: rightIconX }}>
          <Trash2 color="white" size={26} />
        </motion.div>
      </motion.div>

      {/* Main card — physically slides */}
      <motion.div
        ref={cardRef}
        drag="x"
        dragSnapToOrigin
        dragConstraints={{ left: -140, right: 140 }}
        dragElastic={0.25}
        dragTransition={{ bounceStiffness: 500, bounceDamping: 35 }}
        onDragEnd={(_, info) => handleSwipeEnd(info.offset.x)}
        animate={{
          scale: contextMenuOpen ? 1.025 : 1,
          boxShadow: contextMenuOpen 
            ? '0 18px 45px rgba(0,0,0,0.22), 0 4px 14px rgba(0,0,0,0.1)' 
            : 'none',
          borderRadius: contextMenuOpen ? 14 : (isFirstInSection ? 10 : isLastInSection ? 10 : 0),
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 400 }}
        style={{
          x,
          position: 'relative',
          zIndex: contextMenuOpen ? 99999 : 1,
          minHeight: 52,
          display: 'flex',
          alignItems: 'center',
          padding: `8px 12px 8px ${8 + indent}px`,
          margin: 0,
          width: '100%',
          boxSizing: 'border-box',
          background: 'var(--bg-elevated)',
          borderTopLeftRadius: isFirstInSection ? 10 : 0,
          borderTopRightRadius: isFirstInSection ? 10 : 0,
          borderBottomLeftRadius: isLastInSection ? 10 : 0,
          borderBottomRightRadius: isLastInSection ? 10 : 0,
          borderBottom: 'none',
          opacity: isBlocked ? 0.5 : 1,
          pointerEvents: 'auto',
          touchAction: 'pan-y',
          cursor: 'default',
        }}
      >
        {/* iOS Ultra-Thin Separator (except for last item) */}
        {!isLastInSection && !contextMenuOpen && (
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: `${34 + indent}px`,
            right: 0,
            height: '0.5px',
            background: 'var(--border-subtle, rgba(0,0,0,0.06))',
            zIndex: 0
          }} />
        )}

        {/* Checkbox */}
        <motion.button
          whileTap={{ scale: 0.85 }}
          aria-label={isCompletedPeriod ? 'Marcar como pendiente' : 'Completar tarea'}
          disabled={!!isBlocked}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            if (isBlocked) return;
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator && navigator.vibrate) navigator.vibrate([8]);
            if (!isCompletedPeriod && !isPartial) SoundService.playComplete(); else SoundService.playUncomplete();
            onToggle(task.id, isCompletedPeriod || isPartial);
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
            {isCompletedPeriod && (
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

          {isPartial && !isCompletedPeriod && (
            <div style={{
              position: 'absolute',
              width: 22, height: 22,
              borderRadius: '50%',
              background: `conic-gradient(${taskColor} ${percentage}%, var(--border-subtle) ${percentage}%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <div style={{ width: 18, height: 18, background: 'var(--bg-elevated)', borderRadius: '50%' }} />
            </div>
          )}

          <motion.div
            animate={{
              scale: isCompletedPeriod ? [1, 1.25, 0.94, 1] : 1,
              backgroundColor: isCompletedPeriod ? taskColor : 'rgba(0,0,0,0)'
            }}
            transition={{
              scale: { type: 'spring', stiffness: 500, damping: 22 },
              backgroundColor: { duration: 0.2, ease: 'easeOut' }
            }}
            style={{
              width: 22, height: 22,
              borderRadius: '50%',
              border: isCompletedPeriod ? 'none' : `1.5px solid ${isHovered ? taskColor : 'var(--border-color)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: isCompletedPeriod ? `0 2px 8px ${taskColor}40` : 'none',
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
                  pathLength: isCompletedPeriod ? 1 : 0,
                  opacity: isCompletedPeriod ? 1 : 0
                }}
                transition={{
                  pathLength: { type: 'spring', stiffness: 420, damping: 26, delay: 0.02 },
                  opacity: { duration: 0.15 }
                }}
              />
            </svg>
          </motion.div>
        </motion.button>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0, padding: '2px 0', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {isBlocked && <Lock size={15} color="var(--accent-red)" />}
            {Boolean(task.priority && task.priority !== 'none' && task.priority !== 0) && (
              <span className={`priority-badge ${typeof task.priority === 'number' ? (task.priority === 1 ? 'high' : task.priority === 5 ? 'medium' : 'low') : task.priority}`}>
                {task.priority === 'low' || task.priority === 9 ? '!' : task.priority === 'medium' || task.priority === 5 ? '!!' : '!!!'}
              </span>
            )}
            {isEditingTitle ? (
              <motion.input
                value={editTitle}
                autoFocus
                onChange={e => setEditTitle(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') e.currentTarget.blur(); }}
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
                  fontSize: '1rem', fontWeight: 500, width: '100%',
                  border: 'none', background: 'transparent', outline: 'none',
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
                  color: isCompletedPeriod ? 'var(--text-tertiary)' : 'var(--text-primary)',
                  opacity: isCompletedPeriod ? 0.65 : 1
                }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                style={{
                  fontWeight: 400,
                  fontSize: '1.05rem',
                  lineHeight: '1.4',
                  whiteSpace: 'normal',
                  wordBreak: 'break-word',
                  overflow: 'visible',
                  cursor: 'text',
                  position: 'relative',
                  display: 'inline-block'
                }}
              >
                {task.title.split(/(https?:\/\/[^\s]+)/g).map((part, i) => 
                  part.match(/^https?:\/\//) ? (
                    <a key={i} href={part} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>
                      {part}
                    </a>
                  ) : part
                )}

                {/* Línea de tachado animada de izquierda a derecha */}
                <motion.span
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: isCompletedPeriod ? 1 : 0 }}
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
            {task.flagged && <Flag size={13} color="var(--accent-orange)" fill="var(--accent-orange)" />}
            {task.locationName && <MapPin size={13} color="var(--accent-blue)" />}
            {task.image && <ImageIcon size={13} color="var(--text-tertiary)" />}
          </div>

          {/* Note */}
          {(task.description || isEditingNote || isEditingTitle) && (
            <div style={{ marginTop: 2 }}>
              {isEditingNote ? (
                <textarea
                  ref={(el) => {
                    if (el && isEditingNote) {
                      setTimeout(() => el.focus(), 50);
                    }
                  }}
                  value={editNote}
                  autoFocus
                  placeholder="Añadir nota..."
                  onChange={e => setEditNote(e.target.value)}
                  onBlur={handleNoteSubmit}
                  onKeyDown={e => e.stopPropagation()}
                  onClick={e => e.stopPropagation()}
                  onPointerDown={e => e.stopPropagation()}
                  onPointerDownCapture={e => e.stopPropagation()}
                  onFocus={e => {
                    const val = e.target.value;
                    e.target.value = '';
                    e.target.value = val;
                  }}
                  style={{
                    fontSize: '0.85rem', width: '100%', border: 'none',
                    background: 'transparent', outline: 'none',
                    color: 'var(--text-secondary)', padding: 0,
                    resize: 'none', minHeight: 36
                  }}
                />
              ) : (
                <span
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startEditingNote(); } }}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startEditingNote(); }}
                  onClick={(e) => { e.stopPropagation(); startEditingNote(); }}
                  onPointerDownCapture={(e) => e.stopPropagation()}
                  onPointerDown={(e) => { e.stopPropagation(); startEditingNote(); }}
                  style={{
                    fontSize: '0.85rem',
                    lineHeight: '1.4',
                    color: task.description ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                    opacity: task.description ? 1 : (isHovered || isEditingTitle ? 0.8 : 0.4),
                    wordBreak: 'break-word',
                    cursor: 'text',
                    display: 'block',
                    minHeight: (task.description || (!isTaskCompleted(task) && !isCompletedPeriod)) ? 22 : 0,
                    padding: (task.description || (!isTaskCompleted(task) && !isCompletedPeriod)) ? '2px 0' : 0,
                    boxSizing: 'border-box'
                  }}
                >
                  {task.description ? (
                    task.description.split(/(https?:\/\/[^\s]+)/g).map((part, i) => 
                      part.match(/^https?:\/\//) ? (
                        <a key={i} href={part} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>
                          {part}
                        </a>
                      ) : part
                    )
                  ) : (!isTaskCompleted(task) && !isCompletedPeriod ? 'Añadir nota...' : '')}
                </span>
              )}
            </div>
          )}

          {/* Meta row - Native iOS HIG Style */}
          {(showListName || task.dueDate || taskCycle) && (
            <div style={{ display: 'flex', gap: '6px', marginTop: 3, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-tertiary)', lineHeight: '1.3' }}>
              {showListName && taskList && (
                <span style={{ 
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: 'var(--bg-hover, rgba(0,0,0,0.04))', padding: '1px 7px', borderRadius: '6px',
                  fontWeight: 500, fontSize: '0.75rem', color: taskList.color || 'var(--text-secondary)'
                }}>
                  {taskList.name}
                </span>
              )}
              {task.dueDate && (
                <span style={{ 
                  display: 'inline-flex', alignItems: 'center', gap: 4, 
                  color: dueDateColor, fontWeight: dueDateColor === '#FF3B30' ? 600 : 400 
                }}>
                  <Calendar size={11} style={{ flexShrink: 0 }} /> {(() => {
                    const due = new Date(task.dueDate);
                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
                    const dueZero = new Date(due); dueZero.setHours(0, 0, 0, 0);
                    if (dueZero.getTime() === today.getTime()) return 'Hoy';
                    if (dueZero.getTime() === tomorrow.getTime()) return 'Mañana';
                    return due.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
                  })()}
                </span>
              )}
              {taskCycle && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-tertiary)' }}>
                  <Repeat size={11} style={{ flexShrink: 0 }} /> {taskCycle.name}
                </span>
              )}
            </div>
          )}

          {/* Rich Link Preview */}
          {task.url && (
            <a
              href={task.url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                textDecoration: 'none', color: 'var(--text-primary)',
                marginTop: 8,
                padding: '8px 12px',
                borderRadius: '12px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                boxSizing: 'border-box',
                maxWidth: '100%',
                overflow: 'hidden'
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Link2 size={16} color="var(--accent-primary)" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {task.url}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {(() => { try { return new URL(task.url).hostname.replace('www.', ''); } catch { return 'Enlace web'; } })()}
                </span>
              </div>
            </a>
          )}
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

        {/* Zen Mode Play Button on Hover & More button */}
        {!isBlocked && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {onOpenZenMode && (
              <button
                className="task-zen-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenZenMode(task.id);
                }}
                aria-label="Modo Enfoque Zen"
                title="Modo Enfoque Zen ▶️"
                style={{
                  width: 32, height: 32,
                  borderRadius: '50%',
                  display: isMobile ? 'none' : 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--accent-glow)',
                  border: '1px solid rgba(10, 132, 255, 0.25)',
                  cursor: 'pointer',
                  opacity: isHovered || contextMenuOpen ? 1 : 0,
                  transition: 'opacity 0.2s ease, transform 0.15s ease',
                  WebkitTapHighlightColor: 'transparent'
                }}
              >
                <Play size={14} color="var(--accent-primary)" fill="var(--accent-primary)" style={{ marginLeft: 2 }} />
              </button>
            )}
            {/* Apple Reminders Info (i) button */}
            <button
              className="task-info-btn"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(task.id);
              }}
              aria-label="Detalles del recordatorio"
              title="Información y detalles (i)"
              style={{
                width: 32, height: 32,
                borderRadius: '50%',
                display: isMobile ? 'none' : 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: taskColor,
                opacity: isHovered || contextMenuOpen ? 0.9 : 0,
                transition: 'opacity 0.2s ease, background-color 0.15s ease',
                WebkitTapHighlightColor: 'transparent'
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
              style={{
                width: 32, height: 32,
                display: isMobile ? 'none' : 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                opacity: isHovered || contextMenuOpen ? 0.8 : 0,
                transition: 'opacity 0.2s ease',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              <MoreHorizontal size={18} color="var(--text-tertiary)" />
            </button>
          </div>
        )}

      </motion.div>

      {/* ── Context Menu (Universal Floating Popover) ── */}
      {createPortal(
        <AnimatePresence>
          {contextMenuOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                style={{
                  position: 'fixed', inset: 0, zIndex: 99998,
                  background: 'rgba(0, 0, 0, 0.28)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                }}
                onClick={() => setContextMenuOpen(false)}
                onContextMenu={(e) => { e.preventDefault(); setContextMenuOpen(false); }}
              />

              {/* Floating Popover Container */}
              <motion.div
                className="ios-dropdown-menu"
                initial={{ opacity: 0, scale: 0.92, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ type: 'spring', damping: 26, stiffness: 450 }}
                style={{
                  position: 'fixed', zIndex: 100000,
                  top: contextMenuPosition.y,
                  left: contextMenuPosition.x,
                  width: 260,
                  background: 'var(--bg-material, rgba(255,255,255,0.85))',
                  backdropFilter: 'blur(35px) saturate(190%)',
                  WebkitBackdropFilter: 'blur(35px) saturate(190%)',
                  borderRadius: '14px',
                  boxShadow: '0 14px 40px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.06)',
                  border: '1px solid var(--border-subtle)',
                  padding: '6px 0',
                  display: 'flex', flexDirection: 'column',
                  maxHeight: 'calc(100vh - 32px)',
                  overflowY: 'auto'
                }}
                onClick={e => e.stopPropagation()}
              >
                <MenuActions 
                  task={task} 
                  setContextMenuOpen={setContextMenuOpen} 
                  onEdit={onEdit} 
                  nestTask={nestTask} 
                  previousTaskId={previousTaskId} 
                  setIsDeleteConfirmOpen={setIsDeleteConfirmOpen} 
                  updateTask={updateTask} 
                  onOpenZenMode={onOpenZenMode}
                  onToggle={onToggle}
                  isCompleted={isCompletedPeriod}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        title="Eliminar recordatorio"
        message={`"${task.title}" se moverá a la papelera.`}
        confirmText="Eliminar"
        onCancel={() => setIsDeleteConfirmOpen(false)}
        onConfirm={() => {
          setIsDeleteConfirmOpen(false);
          SoundService.playDelete();
          onDelete(task.id);
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

interface MenuActionsProps {
  task: TaskItem;
  setContextMenuOpen: (open: boolean) => void;
  onEdit: (id: string) => void;
  nestTask: (taskId: string, parentId?: string) => void;
  previousTaskId?: string;
  setIsDeleteConfirmOpen: (open: boolean) => void;
  updateTask: (id: string, updates: Partial<TaskItem>) => void;
  onOpenZenMode?: (id: string) => void;
  onToggle: (id: string, forceReverse?: boolean) => void;
  isCompleted: boolean;
}

// ── MenuActions Component ──────────────────────────────────────
function MenuActions({
  task,
  setContextMenuOpen,
  onEdit,
  nestTask,
  previousTaskId,
  setIsDeleteConfirmOpen,
  updateTask,
  onOpenZenMode,
  onToggle,
  isCompleted
}: MenuActionsProps) {
  const addTask = useAppStore(state => state.addTask);
  const lists = useAppStore(state => state.lists);
  const listSections = useAppStore(state => state.listSections);
  const [currentSubmenu, setCurrentSubmenu] = useState<'main' | 'move_list' | 'move_section' | 'due_date' | 'priority'>('main');

  const availableSections = (listSections || []).filter(
    s => s.listId === (task.categoryId || task.listId) && !s.deleted_at
  );

  // Submenu: Mover a lista
  if (currentSubmenu === 'move_list') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
          <button 
            onClick={() => setCurrentSubmenu('main')}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, padding: 0 }}
          >
            <ArrowLeft size={16} /> Volver
          </button>
          <span style={{ flex: 1, textAlign: 'center', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginRight: 20 }}>
            Trasladar a lista
          </span>
        </div>
        <div style={{ maxHeight: 280, overflowY: 'auto', padding: '4px 0' }}>
          {lists?.map(list => {
            const isCurrent = (task.categoryId || task.listId) === list.id;
            return (
              <button
                key={list.id}
                onClick={() => {
                  updateTask(task.id, { listId: list.id, categoryId: list.id, sectionId: undefined });
                  setContextMenuOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 14px',
                  width: '100%',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: isCurrent ? 'var(--accent-primary)' : 'var(--text-primary)',
                  textAlign: 'left',
                  fontSize: '0.92rem',
                  borderRadius: 6
                }}
                onPointerDown={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onPointerUp={e => { e.currentTarget.style.background = 'transparent'; }}
                onPointerLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: list.color || 'var(--accent-primary)', flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{list.name}</span>
                {isCurrent && <CheckCircle size={15} color="var(--accent-primary)" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Submenu: Trasladar a sección
  if (currentSubmenu === 'move_section') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
          <button 
            onClick={() => setCurrentSubmenu('main')}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, padding: 0 }}
          >
            <ArrowLeft size={16} /> Volver
          </button>
          <span style={{ flex: 1, textAlign: 'center', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginRight: 20 }}>
            Trasladar a sección
          </span>
        </div>
        <div style={{ maxHeight: 280, overflowY: 'auto', padding: '4px 0' }}>
          <button
            onClick={() => {
              updateTask(task.id, { sectionId: undefined });
              setContextMenuOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 14px',
              width: '100%',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: !task.sectionId ? 'var(--accent-primary)' : 'var(--text-primary)',
              textAlign: 'left',
              fontSize: '0.92rem',
              borderRadius: 6
            }}
            onPointerDown={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onPointerUp={e => { e.currentTarget.style.background = 'transparent'; }}
            onPointerLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span>Sin sección</span>
            {!task.sectionId && <CheckCircle size={15} color="var(--accent-primary)" />}
          </button>
          {availableSections.map(sec => {
            const isCurrent = task.sectionId === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => {
                  updateTask(task.id, { sectionId: sec.id });
                  setContextMenuOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 14px',
                  width: '100%',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: isCurrent ? 'var(--accent-primary)' : 'var(--text-primary)',
                  textAlign: 'left',
                  fontSize: '0.92rem',
                  borderRadius: 6
                }}
                onPointerDown={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onPointerUp={e => { e.currentTarget.style.background = 'transparent'; }}
                onPointerLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sec.name}</span>
                {isCurrent && <CheckCircle size={15} color="var(--accent-primary)" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Submenu: Fecha límite
  if (currentSubmenu === 'due_date') {
    const handleSetDueDate = (iso?: string) => {
      updateTask(task.id, { dueDate: iso });
      setContextMenuOpen(false);
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
          <button 
            onClick={() => setCurrentSubmenu('main')}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, padding: 0 }}
          >
            <ArrowLeft size={16} /> Volver
          </button>
          <span style={{ flex: 1, textAlign: 'center', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginRight: 20 }}>
            Fecha límite
          </span>
        </div>
        <div style={{ padding: '4px 0' }}>
          <ActionRow 
            icon={<Sun size={17} color="#007aff" />} 
            label="Hoy" 
            sublabel="18:00"
            onClick={() => {
              const d = new Date(); d.setHours(18, 0, 0, 0);
              handleSetDueDate(d.toISOString());
            }} 
          />
          <ActionRow 
            icon={<Calendar size={17} color="#ff9500" />} 
            label="Mañana" 
            sublabel="09:00"
            onClick={() => {
              const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0);
              handleSetDueDate(d.toISOString());
            }} 
          />
          <ActionRow 
            icon={<CalendarDays size={17} color="#5856d6" />} 
            label="Este fin de semana" 
            sublabel="Sábado 10:00"
            onClick={() => {
              const d = new Date();
              const day = d.getDay();
              const diff = day === 6 ? 7 : (6 - day);
              d.setDate(d.getDate() + diff); d.setHours(10, 0, 0, 0);
              handleSetDueDate(d.toISOString());
            }} 
          />
          <ActionRow 
            icon={<Clock size={17} color="#34c759" />} 
            label="Próxima semana" 
            sublabel="Lunes 09:00"
            onClick={() => {
              const d = new Date();
              const day = d.getDay();
              const diff = (day === 0 ? 1 : 8 - day);
              d.setDate(d.getDate() + diff); d.setHours(9, 0, 0, 0);
              handleSetDueDate(d.toISOString());
            }} 
          />
          {task.dueDate && (
            <>
              <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 14px' }} />
              <ActionRow 
                icon={<CalendarX size={17} color="var(--accent-red)" />} 
                label="Sin fecha límite" 
                labelColor="var(--accent-red)"
                onClick={() => handleSetDueDate(undefined)} 
              />
            </>
          )}
          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 14px' }} />
          <ActionRow 
            icon={<Edit3 size={17} color="var(--accent-primary)" />} 
            label="Personalizar fecha..." 
            onClick={() => {
              setContextMenuOpen(false);
              onEdit(task.id);
            }} 
          />
        </div>
      </div>
    );
  }

  // Submenu: Prioridad
  if (currentSubmenu === 'priority') {
    const priorities: { value: 'none' | 'low' | 'medium' | 'high'; label: string; marks: string; color: string }[] = [
      { value: 'none', label: 'Ninguna', marks: '', color: 'var(--text-primary)' },
      { value: 'low', label: 'Baja', marks: '!', color: '#34c759' },
      { value: 'medium', label: 'Media', marks: '!!', color: '#ff9500' },
      { value: 'high', label: 'Alta (Urgente)', marks: '!!!', color: '#ff3b30' },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
          <button 
            onClick={() => setCurrentSubmenu('main')}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, padding: 0 }}
          >
            <ArrowLeft size={16} /> Volver
          </button>
          <span style={{ flex: 1, textAlign: 'center', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginRight: 20 }}>
            Prioridad
          </span>
        </div>
        <div style={{ padding: '4px 0' }}>
          {priorities.map(p => {
            const isCurrent = (task.priority || 'none') === p.value;
            return (
              <button
                key={p.value}
                onClick={() => {
                  updateTask(task.id, { priority: p.value });
                  setContextMenuOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 14px',
                  width: '100%',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: isCurrent ? 'var(--accent-primary)' : 'var(--text-primary)',
                  textAlign: 'left',
                  fontSize: '0.92rem',
                  borderRadius: 6
                }}
                onPointerDown={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onPointerUp={e => { e.currentTarget.style.background = 'transparent'; }}
                onPointerLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {p.marks && <span style={{ fontWeight: 800, color: p.color, width: 22 }}>{p.marks}</span>}
                  <span>{p.label}</span>
                </div>
                {isCurrent && <CheckCircle size={15} color="var(--accent-primary)" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Vista Principal
  const isUrgent = task.priority === 'high';

  return (
    <>
      {/* 1. Marcar como completado */}
      <ActionRow 
        icon={<CheckCircle size={18} color="var(--accent-primary)" />} 
        label={isCompleted ? "Marcar como pendiente" : "Marcar como completado"} 
        onClick={() => { 
          setContextMenuOpen(false); 
          onToggle(task.id); 
        }} 
      />

      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 14px' }} />

      {/* 2. Fecha límite */}
      <ActionRow 
        icon={<Calendar size={18} color="#007aff" />} 
        label="Fecha límite"
        sublabel={task.dueDate ? new Date(task.dueDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : undefined}
        trailing={<ChevronRight size={14} color="var(--text-tertiary)" />}
        onClick={() => setCurrentSubmenu('due_date')} 
      />

      {/* 3. Marcar como urgente / Prioridad */}
      <ActionRow 
        icon={<AlertCircle size={18} color={isUrgent ? '#ff3b30' : 'var(--text-primary)'} />} 
        label={isUrgent ? "Quitar urgencia" : "Marcar como urgente"}
        trailing={<ChevronRight size={14} color="var(--text-tertiary)" />}
        onClick={() => setCurrentSubmenu('priority')} 
      />

      {/* 4. Con marca */}
      <ActionRow 
        icon={<Flag size={18} color={task.flagged ? '#ff9500' : 'var(--text-primary)'} fill={task.flagged ? '#ff9500' : 'none'} />} 
        label={task.flagged ? "Quitar marca" : "Con marca"} 
        onClick={() => { 
          setContextMenuOpen(false); 
          updateTask(task.id, { flagged: !task.flagged }); 
        }} 
      />

      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 14px' }} />

      {/* 5. Trasladar a lista */}
      <ActionRow 
        icon={<FolderInput size={18} />} 
        label="Trasladar a lista..." 
        trailing={<ChevronRight size={14} color="var(--text-tertiary)" />}
        onClick={() => setCurrentSubmenu('move_list')} 
      />

      {/* 6. Trasladar a sección (si hay secciones disponibles en esta lista) */}
      {availableSections.length > 0 && (
        <ActionRow 
          icon={<LayoutList size={18} />} 
          label="Trasladar a sección..." 
          trailing={<ChevronRight size={14} color="var(--text-tertiary)" />}
          onClick={() => setCurrentSubmenu('move_section')} 
        />
      )}

      {/* 7. Sangrar / Anular sangría de recordatorio */}
      {previousTaskId && !task.parentId && (
        <ActionRow 
          icon={<IndentIncrease size={18} />} 
          label="Sangrar recordatorio" 
          onClick={() => { 
            setContextMenuOpen(false); 
            nestTask(task.id, previousTaskId); 
          }} 
        />
      )}
      {task.parentId && (
        <ActionRow 
          icon={<IndentDecrease size={18} />} 
          label="Anular sangría" 
          onClick={() => { 
            setContextMenuOpen(false); 
            nestTask(task.id, undefined); 
          }} 
        />
      )}

      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 14px' }} />

      {/* 8. Duplicar */}
      <ActionRow 
        icon={<Copy size={18} />} 
        label="Duplicar" 
        onClick={() => { 
          addTask({ 
            ...task, 
            id: crypto.randomUUID(), 
            title: `${task.title} (copia)`, 
            created_at: new Date().toISOString(), 
            completed: false, 
            completed_at: undefined 
          }); 
          setContextMenuOpen(false); 
        }} 
      />

      {/* 9. Modo Enfoque Zen (opcional) */}
      {onOpenZenMode && (
        <ActionRow 
          icon={<Play size={18} color="var(--accent-primary)" fill="var(--accent-primary)" />} 
          label="Modo Enfoque Zen" 
          onClick={() => { setContextMenuOpen(false); onOpenZenMode(task.id); }} 
        />
      )}

      {/* 10. Detalles del recordatorio */}
      <ActionRow 
        icon={<Info size={18} color="var(--accent-primary)" />} 
        label="Detalles..." 
        onClick={() => { setContextMenuOpen(false); onEdit(task.id); }} 
      />

      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 14px' }} />

      {/* 11. Eliminar recordatorio */}
      <ActionRow 
        icon={<Trash2 size={18} color="var(--accent-red)" />} 
        label="Eliminar" 
        labelColor="var(--accent-red)" 
        onClick={() => { setContextMenuOpen(false); setIsDeleteConfirmOpen(true); }} 
      />
    </>
  );
}

function ActionRow({
  icon, label, sublabel, trailing, onClick, labelColor
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  trailing?: React.ReactNode;
  onClick: () => void;
  labelColor?: string;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.98, backgroundColor: 'var(--bg-hover)' }}
      transition={{ type: 'spring', damping: 25, stiffness: 450 }}
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 14px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        WebkitTapHighlightColor: 'transparent',
        height: 42,
        borderRadius: 8,
        transition: 'background-color 0.12s ease'
      }}
      onPointerDown={e => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
      onPointerUp={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      onPointerLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, color: labelColor || 'var(--text-primary)', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 450, color: labelColor || 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
      </div>
      {sublabel && (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', flexShrink: 0, marginRight: trailing ? 4 : 0 }}>
          {sublabel}
        </span>
      )}
      {trailing && (
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          {trailing}
        </div>
      )}
    </motion.button>
  );
}
