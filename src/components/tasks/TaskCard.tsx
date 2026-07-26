import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import {
  CheckCircle, Trash2, Lock, Link2, Flag, MapPin,
  Image as ImageIcon, MoreHorizontal, Repeat, Edit3,
  Play, ChevronRight
} from 'lucide-react';
import type { TaskItem } from '../../models/Task';
import { useAppStore } from '../../store/useAppStore';
import { usePromptStore } from '../../store/usePromptStore';
import { isCompletedInCurrentPeriod } from '../../services/TaskService';
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
}

export const TaskCard = React.memo(function TaskCard({
  task, virtualStyle, onToggle, onDelete, onOpenZenMode, onEdit, index, showListName = true, isFirstInSection, isLastInSection, previousTaskId
}: TaskCardProps) {
  const { cycles, tasks, nestTask, lists } = useAppStore();
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
  const [showMenu, setShowMenu] = useState(false);
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

  const SWIPE_COMPLETE_THRESHOLD = 80;
  const SWIPE_DELETE_THRESHOLD = -80;

  const handleSwipeEnd = useCallback((offsetX: number) => {
    if (offsetX > SWIPE_COMPLETE_THRESHOLD && !isBlocked) {
      if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
      // Always toggle: if completed → uncomplete, if pending → complete
      onToggle(task.id, isCompletedPeriod);
    } else if (offsetX < SWIPE_DELETE_THRESHOLD) {
      if (navigator.vibrate) navigator.vibrate(50);
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
      draggable={!isEditingNote && !isEditingTitle}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      style={{ ...virtualStyle, position: 'relative', overflow: 'hidden' }}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const draggedTaskId = e.dataTransfer.getData('text/plain');
        if (draggedTaskId && draggedTaskId !== task.id) nestTask(draggedTaskId, task.id);
      }}
    >
      {/* Fixed swipe action backgrounds */}
      {/* Left = Complete/Uncomplete */}
      <motion.div
        style={{
          position: 'absolute', top: 0, left: 0, bottom: 0,
          width: '50%',
          background: isCompletedPeriod ? 'var(--accent-orange)' : 'var(--accent-green)',
          display: 'flex', alignItems: 'center', paddingLeft: 24,
          opacity: leftBgOpacity, zIndex: 0
        }}
      >
        <motion.div style={{ scale: leftIconScale }}>
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
          opacity: rightBgOpacity, zIndex: 0
        }}
      >
        <motion.div style={{ scale: rightIconScale }}>
          <Trash2 color="white" size={26} />
        </motion.div>
      </motion.div>

      {/* Main card — physically slides */}
      <motion.div
        ref={cardRef}
        drag="x"
        dragSnapToOrigin
        dragConstraints={{ left: -160, right: 160 }}
        dragElastic={0.05}
        dragTransition={{ bounceStiffness: 500, bounceDamping: 30 }}
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
        <motion.button
          aria-label={isCompletedPeriod ? 'Marcar como pendiente' : 'Completar tarea'}
          disabled={!!isBlocked}
          whileTap={{ scale: 0.6 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          onClick={(e) => {
            e.stopPropagation();
            if (isBlocked) return;
            if (navigator.vibrate) navigator.vibrate(15);
            onToggle(task.id, isCompletedPeriod || isPartial);
          }}
          style={{
            width: 26, height: 26,
            borderRadius: '50%',
            border: isPartial
              ? 'none'
              : `2px solid ${isCompletedPeriod ? 'var(--accent-primary)' : 'var(--border-color)'}`,
            marginRight: 14,
            cursor: 'pointer',
            flexShrink: 0,
            background: isCompletedPeriod
              ? 'var(--accent-primary)'
              : isPartial
                ? `conic-gradient(var(--accent-primary) ${percentage}%, var(--border-subtle) ${percentage}%)`
                : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {isPartial && !isCompletedPeriod && (
            <div style={{ width: 22, height: 22, background: 'var(--bg-surface)', borderRadius: '50%' }} />
          )}
          <AnimatePresence>
            {isCompletedPeriod && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 22 }}
              >
                <CheckCircle size={16} color="white" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>

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
              <input
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
              <span
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
              </span>
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
                  onPointerDownCapture={(e) => { e.stopPropagation(); }}
                  onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsEditingNote(true); }}
                  style={{
                    fontSize: '0.85rem', color: 'var(--text-secondary)',
                    wordBreak: 'break-word', cursor: 'text', display: 'block',
                    maxHeight: 100, overflowY: 'auto', scrollbarWidth: 'none'
                  }}
                >
                  {task.description || (isEditingTitle ? 'Añadir nota...' : '')}
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

        {/* More button */}
        {!isBlocked && (
          <button
            className="task-more-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(true);
            }}
            aria-label="Más opciones"
          >
            <MoreHorizontal size={18} color="var(--text-tertiary)" />
          </button>
        )}

      </motion.div>

      {/* ── Apple-style Bottom Sheet ── */}
      {createPortal(
        <AnimatePresence>
          {showMenu && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                style={{
                  position: 'fixed', inset: 0, zIndex: 99998,
                  background: 'rgba(0,0,0,0.4)',
                  backdropFilter: 'blur(4px)',
                  WebkitBackdropFilter: 'blur(4px)'
                }}
                onClick={() => setShowMenu(false)}
              />

              {/* Centered Container for Popover */}
              <div style={{ 
                position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', 
                justifyContent: 'center', zIndex: 99999, pointerEvents: 'none', padding: 20 
              }}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 15 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                  style={{
                    width: '100%', maxWidth: 320, pointerEvents: 'auto',
                    display: 'flex', flexDirection: 'column'
                  }}
                  onClick={e => e.stopPropagation()}
                >
                <div style={{
                  background: 'var(--bg-elevated)',
                  backdropFilter: 'blur(30px)',
                  WebkitBackdropFilter: 'blur(30px)',
                  borderRadius: 16,
                  padding: '14px 16px',
                  marginBottom: 10,
                  border: '0.5px solid var(--border-subtle)',
                }}>
                  <p style={{
                    margin: 0, fontSize: '0.95rem', fontWeight: 600,
                    color: 'var(--text-primary)', textAlign: 'center',
                    lineHeight: 1.35
                  }}>
                    {task.title}
                  </p>
                  {task.description && (
                    <p style={{
                      margin: '6px 0 0', fontSize: '0.82rem',
                      color: 'var(--text-secondary)', textAlign: 'center',
                      lineHeight: 1.4
                    }}>
                      {task.description}
                    </p>
                  )}
                </div>

                {/* Action buttons group 1 */}
                <div style={{
                  background: 'var(--bg-elevated)',
                  backdropFilter: 'blur(30px)',
                  WebkitBackdropFilter: 'blur(30px)',
                  borderRadius: 16,
                  overflow: 'hidden',
                  marginBottom: 10,
                  border: '0.5px solid var(--border-subtle)',
                }}>
                  <ActionRow
                    icon={<Edit3 size={20} color="var(--accent-primary)" />}
                    label="Editar detalles"
                    onClick={() => { setShowMenu(false); onEdit(task.id); }}
                  />
                  {previousTaskId && !task.parentId && (
                    <>
                      <div style={{ height: '0.5px', background: 'var(--border-subtle)', marginLeft: 54 }} />
                      <ActionRow
                        icon={<ChevronRight size={20} color="var(--accent-primary)" />}
                        label="Sangrar recordatorio"
                        onClick={() => { setShowMenu(false); nestTask(task.id, previousTaskId); }}
                      />
                    </>
                  )}
                  {task.parentId && (
                    <>
                      <div style={{ height: '0.5px', background: 'var(--border-subtle)', marginLeft: 54 }} />
                      <ActionRow
                        icon={<ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} color="var(--accent-primary)" />}
                        label="Extraer recordatorio"
                        onClick={() => { setShowMenu(false); nestTask(task.id, undefined); }}
                      />
                    </>
                  )}
                  <div style={{ height: '0.5px', background: 'var(--border-subtle)', marginLeft: 54 }} />
                  <ActionRow
                    icon={<Play size={20} color="var(--accent-green)" />}
                    label="Empezar esta tarea"
                    sublabel="Cronómetro + modo enfoque"
                    onClick={() => { setShowMenu(false); onOpenZenMode(task.id); }}
                  />
                  <div style={{ height: '0.5px', background: 'var(--border-subtle)', marginLeft: 54 }} />
                  <ActionRow
                    icon={
                      isCompletedPeriod
                        ? <CheckCircle size={20} color="var(--accent-orange)" />
                        : <CheckCircle size={20} color="var(--accent-green)" />
                    }
                    label={isCompletedPeriod ? 'Marcar como pendiente' : 'Marcar como completado'}
                    onClick={() => {
                      setShowMenu(false);
                      onToggle(task.id, isCompletedPeriod);
                    }}
                  />
                </div>

                {/* Danger group */}
                <div style={{
                  background: 'var(--bg-elevated)',
                  backdropFilter: 'blur(30px)',
                  WebkitBackdropFilter: 'blur(30px)',
                  borderRadius: 16,
                  overflow: 'hidden',
                  marginBottom: 10,
                  border: '0.5px solid var(--border-subtle)',
                }}>
                  <ActionRow
                    icon={<Trash2 size={20} color="var(--accent-red)" />}
                    label="Eliminar recordatorio"
                    labelColor="var(--accent-red)"
                    onClick={() => { setShowMenu(false); setIsDeleteConfirmOpen(true); }}
                  />
                </div>

                {/* Cancel */}
                <button
                  onClick={() => setShowMenu(false)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-elevated)',
                    backdropFilter: 'blur(30px)',
                    WebkitBackdropFilter: 'blur(30px)',
                    border: '0.5px solid var(--border-subtle)',
                    borderRadius: 16,
                    padding: '16px',
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: 'var(--accent-primary)',
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
              </motion.div>
              </div>
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

// ── Reusable action row for bottom sheet ──────────────────────────────────────
function ActionRow({
  icon, label, sublabel, onClick, labelColor
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
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
        gap: 14,
        padding: '14px 16px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        WebkitTapHighlightColor: 'transparent',
      }}
      onPointerDown={e => {
        const el = e.currentTarget;
        el.style.background = 'var(--bg-hover)';
      }}
      onPointerUp={e => { e.currentTarget.style.background = 'none'; }}
      onPointerLeave={e => { e.currentTarget.style.background = 'none'; }}
    >
      <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '1rem', fontWeight: 500, color: labelColor || 'var(--text-primary)' }}>{label}</div>
        {sublabel && <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: 1 }}>{sublabel}</div>}
      </div>
      <ChevronRight size={16} color="var(--text-tertiary)" />
    </button>
  );
}
