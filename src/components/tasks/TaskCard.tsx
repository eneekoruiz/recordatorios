import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, useMotionValue, useTransform, AnimatePresence, useMotionValueEvent } from 'framer-motion';
import {
  CheckCircle, Trash2, Lock, Link2, Flag, MapPin,
  Image as ImageIcon, MoreHorizontal, Repeat, Edit3,
  Play, ChevronRight, ChevronDown, Copy, FolderOpen, IndentIncrease, IndentDecrease
} from 'lucide-react';
import type { TaskItem } from '../../models/Task';
import { useAppStore } from '../../store/useAppStore';
import { usePromptStore } from '../../store/usePromptStore';
import { isCompletedInCurrentPeriod } from '../../services/TaskService';
import { SoundService } from '../../services/SoundService';
import { ConfirmModal } from '../ui/ConfirmModal';

interface TaskCardProps {
  task: TaskItem;
  virtualStyle: React.CSSProperties;
  onToggle: (id: string, forceReverse?: boolean) => void;
  onDelete: (id: string) => void;
  onOpenZenMode: (id: string) => void;
  onEdit: (id: string) => void;
  index: number;
  showListName?: boolean;
  isFirstInSection?: boolean;
  isLastInSection?: boolean;
  previousTaskId?: string;
  hasChildren?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const TaskCard = React.memo(function TaskCard({
  task, virtualStyle, onToggle, onDelete, onOpenZenMode, onEdit, index, showListName = true, isFirstInSection, isLastInSection, previousTaskId, hasChildren, isExpanded, onToggleExpand
}: TaskCardProps) {
  const cycles = useAppStore(state => state.cycles);
  const tasks = useAppStore(state => state.tasks);
  const nestTask = useAppStore(state => state.nestTask);
  const lists = useAppStore(state => state.lists);
  const taskCycle = cycles.find(c => c.id === task.cycle_id);
  const taskList = lists?.find(l => l.id === task.categoryId);

  let dueDateColor = 'var(--text-secondary)';
  if (task.dueDate) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const due = new Date(task.dueDate); due.setHours(0, 0, 0, 0);
    if (due < today) dueDateColor = 'var(--accent-red)';
    else if (due.getTime() === today.getTime()) dueDateColor = 'var(--accent-orange)';
  }

  const [isDragOver, setIsDragOver] = useState(false);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
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
  const updateTask = useAppStore(state => state.updateTask);
  const cardRef = useRef<HTMLDivElement>(null);

  // Sync state if task changes externally but not while editing
  useEffect(() => {
    if (!isEditingTitle) setEditTitle(task.title || '');
    if (!isEditingNote) setEditNote(task.description || '');
  }, [task.title, task.description, isEditingTitle, isEditingNote]);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (editTitle.trim() !== task.title) updateTask(task.id, { title: editTitle.trim() });
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
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator && navigator.vibrate) navigator.vibrate(5);
        hasCrossedLeftThreshold.current = true;
      }
    } else {
      hasCrossedLeftThreshold.current = false;
    }

    if (latest < SWIPE_DELETE_THRESHOLD) {
      if (!hasCrossedRightThreshold.current) {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator && navigator.vibrate) navigator.vibrate(5);
        hasCrossedRightThreshold.current = true;
      }
    } else {
      hasCrossedRightThreshold.current = false;
    }
  });

  const handleSwipeEnd = useCallback((offsetX: number) => {
    if (offsetX > SWIPE_COMPLETE_THRESHOLD && !isBlocked) {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator && navigator.vibrate) navigator.vibrate([5, 50, 5]);
      // Always toggle: if completed → uncomplete, if pending → complete
      if (!isCompletedPeriod) SoundService.playComplete(); else SoundService.playUncomplete();
      onToggle(task.id, isCompletedPeriod);
    } else if (offsetX < SWIPE_DELETE_THRESHOLD) {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator && navigator.vibrate) navigator.vibrate([5, 50, 5]);
      setIsDeleteConfirmOpen(true);
    }
  }, [isBlocked, isCompletedPeriod, onToggle, task.id]);

  const notify = (message: string) => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 2400);
  };

  const totalAlerts = task.alerts?.length || 0;
  const completedAlertsCount = task.completedAlerts?.length || 0;
  const isPartial = totalAlerts > 1 && completedAlertsCount > 0 && completedAlertsCount < totalAlerts;
  const percentage = totalAlerts > 1 ? (completedAlertsCount / totalAlerts) * 100 : 0;

  return (
    <div
      className="task-item-wrapper"
      style={{ ...virtualStyle, position: 'relative' }}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse') return;
        touchStartX.current = e.clientX;
        touchStartY.current = e.clientY;
        if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
        longPressTimer.current = window.setTimeout(() => {
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator && navigator.vibrate) navigator.vibrate([10]);
          setContextMenuPosition({ x: touchStartX.current, y: touchStartY.current });
          setContextMenuOpen(true);
        }, 400);
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
        setContextMenuPosition({ x: e.clientX, y: e.clientY });
        setContextMenuOpen(true);
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
        dragElastic={{ left: 0.15, right: 0.15 }}
        dragTransition={{ bounceStiffness: 400, bounceDamping: 40 }}
        onDragEnd={(_, info) => handleSwipeEnd(info.offset.x)}
        style={{
          x,
          position: 'relative',
          zIndex: 1,
          minHeight: 52,
          display: 'flex',
          alignItems: 'center',
          padding: '8px 16px',
          margin: 0,
          width: '100%',
          background: 'var(--bg-elevated)',
          borderTopLeftRadius: isFirstInSection ? 10 : 0,
          borderTopRightRadius: isFirstInSection ? 10 : 0,
          borderBottomLeftRadius: isLastInSection ? 10 : 0,
          borderBottomRightRadius: isLastInSection ? 10 : 0,
          opacity: isBlocked ? 0.5 : 1,
          pointerEvents: 'auto',
          touchAction: 'pan-y',
          outline: isDragOver ? '2px solid var(--accent-blue)' : undefined,
          cursor: 'default',
        }}
      >

        {/* Checkbox */}
        <button
          aria-label={isCompletedPeriod ? 'Marcar como pendiente' : 'Completar tarea'}
          disabled={!!isBlocked}
          onClick={(e) => {
            e.stopPropagation();
            if (isBlocked) return;
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator && navigator.vibrate) navigator.vibrate([8]);
            if (!isCompletedPeriod && !isPartial) SoundService.playComplete(); else SoundService.playUncomplete();
            onToggle(task.id, isCompletedPeriod || isPartial);
          }}
          style={{
            width: 44, height: 44,
            padding: 11,
            background: 'transparent',
            border: 'none',
            marginRight: 2,
            cursor: isBlocked ? 'default' : 'pointer',
            flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
            WebkitTapHighlightColor: 'transparent',
            outline: 'none'
          }}
        >
          {isPartial && !isCompletedPeriod && (
            <div style={{
              position: 'absolute',
              width: 22, height: 22,
              borderRadius: '50%',
              background: `conic-gradient(var(--accent-primary) ${percentage}%, var(--border-subtle) ${percentage}%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <div style={{ width: 18, height: 18, background: 'var(--bg-elevated)', borderRadius: '50%' }} />
            </div>
          )}
          <div style={{
            width: 22, height: 22,
            borderRadius: '50%',
            border: isCompletedPeriod ? 'none' : '1.5px solid var(--border-color)',
            background: isCompletedPeriod ? 'var(--accent-primary)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background-color 0.18s ease, border-color 0.18s ease, transform 0.15s ease',
            transform: 'scale(1)',
            boxShadow: isCompletedPeriod ? '0 2px 6px rgba(0,0,0,0.15)' : 'none'
          }}>
            <svg viewBox="0 0 24 24" width={14} height={14} style={{ opacity: isCompletedPeriod ? 1 : 0, transition: 'opacity 0.15s ease', overflow: 'visible' }}>
              <path
                d="M5 12L10 17L19 7"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </div>
        </button>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {isBlocked && <Lock size={15} color="var(--accent-red)" />}
            {task.priority !== undefined && task.priority !== null && task.priority !== '' && task.priority !== 'none' && task.priority !== 0 && task.priority !== '0' && (
              <span className={`priority-badge ${task.priority}`}>
                {task.priority === 'low' ? '!' : task.priority === 'medium' ? '!!' : '!!!'}
              </span>
            )}
            {isEditingTitle ? (
              <motion.input
                layoutId={"task-title-" + task.id}
                value={editTitle}
                autoFocus
                onChange={e => setEditTitle(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                onPointerDownCapture={e => e.stopPropagation()}
                style={{
                  fontSize: '1rem', fontWeight: 500, width: '100%',
                  border: 'none', background: 'transparent', outline: 'none',
                  color: 'var(--text-primary)', padding: 0
                }}
              />
            ) : (
              <motion.span
                layoutId={"task-title-" + task.id}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
                onClick={() => setIsEditingTitle(true)}
                style={{
                  fontSize: '1rem', fontWeight: 500,
                  color: 'var(--text-primary)',
                  textDecoration: isCompletedPeriod ? 'line-through' : 'none',
                  opacity: isCompletedPeriod ? 0.55 : 1,
                  wordBreak: 'break-word',
                  cursor: 'text',
                  flex: 1,
                }}
              >
                {task.title}
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
                  value={editNote}
                  autoFocus
                  placeholder="Añadir nota..."
                  onChange={e => setEditNote(e.target.value)}
                  onBlur={handleNoteSubmit}
                  onPointerDownCapture={e => e.stopPropagation()}
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
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
                  onClick={() => setIsEditingNote(true)}
                  onPointerDownCapture={(e) => { e.stopPropagation(); }}
                  onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsEditingNote(true); }}
                  style={{
                    fontSize: '0.85rem',
                    color: task.description ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                    opacity: task.description ? 1 : (isHovered || isEditingTitle ? 0.8 : 0.4),
                    wordBreak: 'break-word',
                    cursor: 'text',
                    display: 'block',
                    minHeight: (task.description || (!task.completed && !isCompletedPeriod)) ? 24 : 0,
                    padding: (task.description || (!task.completed && !isCompletedPeriod)) ? '2px 0' : 0
                  }}
                >
                  {task.description || (!task.completed && !isCompletedPeriod ? 'Añadir nota...' : '')}
                </span>
              )}
            </div>
          )}

          {/* Meta row */}
          <div style={{ display: 'flex', gap: 8, marginTop: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            {showListName && taskList && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>
                {taskList.name}
              </span>
            )}
            {(task.dueDate || taskCycle) && (
              <span style={{ fontSize: '0.8rem', color: dueDateColor, display: 'flex', alignItems: 'center', gap: 3, fontWeight: 500 }}>
                {task.dueDate && new Date(task.dueDate).toLocaleDateString()}
                {task.dueDate && taskCycle && <Repeat size={11} style={{ color: 'var(--text-tertiary)' }} />}
                {taskCycle && <span style={{ color: 'var(--text-tertiary)' }}>{taskCycle.name}</span>}
              </span>
            )}
            {task.url && (
              <a
                href={task.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  textDecoration: 'none', color: 'var(--accent-primary)',
                  fontSize: '0.8rem', fontWeight: 500
                }}
                onClick={e => e.stopPropagation()}
              >
                <Link2 size={12} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                  {(() => { try { return new URL(task.url).hostname.replace('www.', ''); } catch { return task.url; } })()}
                </span>
              </a>
            )}
          </div>
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
              const count = tasks ? Object.values(tasks).filter(t => t && t.parentId === task.id && !t.deleted).length : 0;
              return count > 0 ? <span>{count}</span> : null;
            })()}
            <motion.div style={{ display: 'flex', alignItems: 'center' }} animate={{ rotate: isExpanded ? 0 : -90 }} transition={{ type: 'spring', damping: 20, stiffness: 300 }}>
              <ChevronDown size={18} />
            </motion.div>
          </button>
        )}

        {/* More button */}
        {!isBlocked && (
          <button
            className="task-more-btn"
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              setContextMenuPosition({ x: rect.right, y: rect.bottom });
              setContextMenuOpen(true);
            }}
            aria-label="Más opciones"
            style={{
              width: 44, height: 44,
              display: isMobile ? 'none' : 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              opacity: isHovered || contextMenuOpen ? 1 : 0,
              transition: 'opacity 0.2s ease',
              WebkitTapHighlightColor: 'transparent'
            }}
          >
            <MoreHorizontal size={18} color="var(--text-tertiary)" />
          </button>
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
                  background: 'transparent', // No dark overlay blocking the view!
                }}
                onClick={() => setContextMenuOpen(false)}
                onContextMenu={(e) => { e.preventDefault(); setContextMenuOpen(false); }}
              />

              {/* Floating Popover Container */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: 'fixed', zIndex: 99999,
                  top: Math.min(contextMenuPosition.y, typeof window !== 'undefined' ? window.innerHeight - 350 : 300),
                  left: Math.min(contextMenuPosition.x, typeof window !== 'undefined' ? window.innerWidth - 220 : 100),
                  width: 220,
                  background: 'var(--bg-elevated)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  borderRadius: 'var(--radius-md, 12px)',
                  boxShadow: 'var(--shadow-lg, 0 8px 30px rgba(0,0,0,0.12))',
                  border: '1px solid var(--border-subtle)',
                  padding: '8px 0',
                  display: 'flex', flexDirection: 'column'
                }}
                onClick={e => e.stopPropagation()}
              >
                <MenuActions task={task} setContextMenuOpen={setContextMenuOpen} onEdit={onEdit} nestTask={nestTask} previousTaskId={previousTaskId} setIsDeleteConfirmOpen={setIsDeleteConfirmOpen} updateTask={updateTask} />
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
          initial={{ opacity: 0, y: 14, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
        >
          {feedback}
        </motion.div>,
        document.body
      )}
    </div>
  );
});

// ── MenuActions Component ──────────────────────────────────────
function MenuActions({ task, setContextMenuOpen, onEdit, nestTask, previousTaskId, setIsDeleteConfirmOpen, updateTask }: any) {
  const addTask = useAppStore(state => state.addTask);
  const lists = useAppStore(state => state.lists);
  const [showMoveSubmenu, setShowMoveSubmenu] = useState(false);

  if (showMoveSubmenu) {
    return (
      <>
        <button onClick={() => setShowMoveSubmenu(false)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', fontWeight: 600, color: 'var(--accent-primary)' }}>← Volver</button>
        <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 16px' }} />
        {lists?.map(list => (
          <button
            key={list.id}
            onClick={() => {
              updateTask(task.id, { listId: list.id, categoryId: list.id, sectionId: undefined });
              setContextMenuOpen(false);
              setShowMoveSubmenu(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 16px',
              width: '100%',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--text-primary)',
              textAlign: 'left'
            }}
            onPointerDown={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onPointerUp={e => { e.currentTarget.style.background = 'transparent'; }}
            onPointerLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: list.color || 'var(--accent-primary)', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{list.name}</span>
          </button>
        ))}
      </>
    );
  }

  return (
    <>
      <ActionRow icon={<Edit3 size={18} />} label="Editar" onClick={() => { setContextMenuOpen(false); onEdit(task.id); }} />
      <ActionRow icon={<Copy size={18} />} label="Duplicar" onClick={() => { addTask({ ...task, id: crypto.randomUUID(), title: `${task.title} (copia)`, created_at: Date.now(), completed: false, completed_at: undefined }); setContextMenuOpen(false); }} />
      <ActionRow icon={<FolderOpen size={18} />} label="Mover a lista" onClick={() => { setShowMoveSubmenu(true); }} />
      
      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 16px' }} />
      
      {previousTaskId && !task.parentId && (
        <ActionRow icon={<IndentIncrease size={18} />} label="Sangrar" onClick={() => { setContextMenuOpen(false); nestTask(task.id, previousTaskId); }} />
      )}
      {task.parentId && (
        <ActionRow icon={<IndentDecrease size={18} />} label="Extraer" onClick={() => { setContextMenuOpen(false); nestTask(task.id, undefined); }} />
      )}
      
      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 16px' }} />
      
      <ActionRow icon={<Flag size={18} />} label={task.flagged ? "Quitar flag" : "Marcar con flag"} onClick={() => { setContextMenuOpen(false); updateTask(task.id, { flagged: !task.flagged }); }} />
      
      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 16px' }} />
      
      <ActionRow icon={<Trash2 size={18} color="var(--accent-red)" />} label="Eliminar" labelColor="var(--accent-red)" onClick={() => { setContextMenuOpen(false); setIsDeleteConfirmOpen(true); }} />
    </>
  );
}

// ── Reusable action row for menu ──────────────────────────────────────
function ActionRow({
  icon, label, onClick, labelColor
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  labelColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 16px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        WebkitTapHighlightColor: 'transparent',
        height: 52,
      }}
      onPointerDown={e => {
        const el = e.currentTarget;
        el.style.background = 'var(--bg-hover)';
      }}
      onPointerUp={e => { e.currentTarget.style.background = 'none'; }}
      onPointerLeave={e => { e.currentTarget.style.background = 'none'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: labelColor || 'var(--text-primary)' }}>
        {icon}
      </div>
      <div style={{ flex: 1, fontSize: '0.95rem', fontWeight: 500, color: labelColor || 'var(--text-primary)' }}>
        {label}
      </div>
    </button>
  );
}
