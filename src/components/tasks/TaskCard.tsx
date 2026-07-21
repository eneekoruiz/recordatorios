import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { CheckCircle, Trash2, GripVertical, Play, Lock, Link2, Flag, MapPin, Image as ImageIcon, MoreHorizontal, Repeat, Edit3 } from 'lucide-react';
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
}

export const TaskCard = React.memo(function TaskCard({ task, virtualStyle, onToggle, onDelete, onOpenZenMode, onEdit, index, showListName = true }: TaskCardProps) {
  const { cycles, tasks, nestTask, addDependency, lists } = useAppStore();
  const taskCycle = cycles.find(c => c.id === task.cycle_id);
  const taskList = lists?.find(l => l.id === task.categoryId);

  let dueDateColor = 'var(--text-secondary)';
  if (task.dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(task.dueDate);
    due.setHours(0, 0, 0, 0);
    if (due < today) dueDateColor = 'var(--accent-red)';
    else if (due.getTime() === today.getTime()) dueDateColor = 'var(--accent-orange)';
  }
  const [isDragOver, setIsDragOver] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [feedback, setFeedback] = useState<string | null>(null);
  
  // Inline editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title || '');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [editNote, setEditNote] = useState(task.description || '');
  const updateTask = useAppStore(state => state.updateTask);
  const cardRef = useRef<HTMLDivElement>(null);

  // Sync state if task changes externally
  useEffect(() => {
    setEditTitle(task.title || '');
    setEditNote(task.description || '');
  }, [task.title, task.description]);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (editTitle.trim() !== task.title) {
      updateTask(task.id, { title: editTitle.trim() });
    }
  };

  const handleNoteSubmit = () => {
    setIsEditingNote(false);
    if (editNote.trim() !== (task.description || '')) {
      updateTask(task.id, { description: editNote.trim() });
    }
  };

  // Bloqueado si alguna dependencia sigue pendiente
  const isBlocked = task.blockedBy && task.blockedBy.some(id => tasks[id] && tasks[id].status === 'pending');

  const isCompletedPeriod = isCompletedInCurrentPeriod(task, cycles);
  
  // Físicas de Swipe Nativas (iOS style)
  const x = useMotionValue(0);
  const leftOpacity = useTransform(x, [0, 50, 80], [0, 0.5, 1]);
  const leftScale = useTransform(x, [0, 50, 80], [0.5, 0.8, 1]);
  const rightOpacity = useTransform(x, [0, -50, -80], [0, 0.5, 1]);
  const rightScale = useTransform(x, [0, -50, -80], [0.5, 0.8, 1]);

  const handleSwipeEnd = (offset: number) => {
    if (offset > 80 && !isBlocked) {
      if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
      onToggle(task.id);
    } else if (offset < -80) {
      if (navigator.vibrate) navigator.vibrate(50);
      onDelete(task.id);
    } else if (offset < -50) {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        setMenuPos({
          x: Math.max(12, Math.min(rect.right - 220, window.innerWidth - 232)),
          y: Math.min(rect.bottom + 8, window.innerHeight - 220)
        });
      } else {
        setMenuPos({ x: window.innerWidth - 232, y: window.innerHeight / 2 });
      }
      setShowMenu(true);
    }
  };

  const notify = (message: string) => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 2400);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuPos({
      x: Math.max(12, Math.min(e.clientX, window.innerWidth - 236)),
      y: Math.max(12, Math.min(e.clientY, window.innerHeight - 220))
    });
    setShowMenu(true);
  };

  // Only show swipe backgrounds if dragging (x != 0)
  const isDraggingX = useTransform(x, (val) => val !== 0);
  
  return (
    <div 
      className="task-item-wrapper" 
      style={{ ...virtualStyle, overflow: 'hidden' }}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const draggedTaskId = e.dataTransfer.getData('text/plain');
        if (draggedTaskId && draggedTaskId !== task.id) {
          nestTask(draggedTaskId, task.id);
        }
      }}
    >
      {/* Fondos de Swipe Fijos (Siempre detrás, sin opacity vinculada al drag) */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'space-between', zIndex: 0, borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        {/* Left Side (Completar - Verde) */}
        <div style={{ flex: 1, background: 'var(--accent-green)', display: 'flex', alignItems: 'center', padding: '0 24px' }}>
          <motion.div style={{ scale: leftScale, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle color="white" size={24} />
          </motion.div>
        </div>
        {/* Right Side (Eliminar - Rojo) */}
        <div style={{ flex: 1, background: 'var(--accent-red)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 24px' }}>
          <motion.div style={{ scale: rightScale, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Trash2 color="white" size={24} />
          </motion.div>
        </div>
      </div>

      {/* Tarjeta Principal */}
      <motion.div 
        ref={cardRef}
        onContextMenu={handleContextMenu}
        drag="x"
        dragSnapToOrigin={true}
        dragConstraints={{ left: -130, right: 130 }}
        dragElastic={0.08}
        dragTransition={{ bounceStiffness: 400, bounceDamping: 25 }}
        onDragEnd={(_, info) => handleSwipeEnd(info.offset.x)}
        className="ios-task-row"
        style={{ 
          x,
          cursor: 'grab',
          position: 'relative',
          zIndex: 10,
          background: 'var(--bg-elevated)',
          borderBottom: '0.5px solid var(--border-subtle)',
          boxShadow: isDragOver ? '0 0 0 2px var(--accent-blue)' : 'none'
        }}
      >
        
        {/* Grip para Drag & Drop */}
        <div 
          draggable
          onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
          style={{ cursor: 'grab', marginRight: 'var(--space-8)', color: 'var(--text-tertiary)' }}
        >
          <GripVertical size={16} />
        </div>

        {/* Checkbox con progreso parcial */}
        {(() => {
          const totalAlerts = task.alerts?.length || 0;
          const completedAlerts = task.completedAlerts?.length || 0;
          const isPartial = totalAlerts > 1 && completedAlerts > 0 && completedAlerts < totalAlerts;
          const percentage = totalAlerts > 1 ? (completedAlerts / totalAlerts) * 100 : 0;
          
          return (
            <motion.button 
              className="checkbox" 
              aria-label="Completar tarea"
              disabled={isBlocked}
              whileTap={{ scale: 0.85 }}
              whileHover={{ scale: 1.1 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              onClick={(e) => {
                e.stopPropagation();
                if (isBlocked) return;
                if (navigator.vibrate) navigator.vibrate([20, 30, 20]);
                onToggle(task.id, isCompletedPeriod || isPartial);
              }}
              style={{
                width: 24, height: 24, 
                borderRadius: '50%', 
                border: isPartial ? 'none' : '2px solid var(--border-subtle)', 
                marginRight: 'var(--space-12)', 
                cursor: 'pointer',
                background: isCompletedPeriod 
                  ? 'var(--accent-primary)' 
                  : isPartial 
                    ? `conic-gradient(var(--accent-primary) ${percentage}%, var(--border-subtle) ${percentage}%)`
                    : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0
              }}
            >
              {isPartial && !isCompletedPeriod && <div style={{ width: 20, height: 20, background: 'var(--bg-surface)', borderRadius: '50%' }}></div>}
              <AnimatePresence>
                {isCompletedPeriod && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                  >
                    <CheckCircle size={16} color="white" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })()}
        
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 0, gap: 'var(--space-12)' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
              {isBlocked && <Lock size={16} color="var(--accent-red)" />}
              
              {/* Badges UI de Prioridad en lugar de "!!!" */}
              {task.priority && task.priority !== 'none' && (
                <span className={`priority-badge ${task.priority}`}>
                  {task.priority === 'low' ? '!' : task.priority === 'medium' ? '!!' : '!!!'}
                </span>
              )}

              {isEditingTitle ? (
                <input 
                  type="text" 
                  value={editTitle} 
                  autoFocus 
                  onChange={e => setEditTitle(e.target.value)}
                  onBlur={handleTitleSubmit}
                  onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  style={{ fontSize: '1rem', fontWeight: 500, width: '100%', border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-primary)', padding: 0 }}
                />
              ) : (
                <span 
                  onClick={() => setIsEditingTitle(true)}
                  style={{ 
                    fontSize: '1rem',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    textDecoration: isCompletedPeriod ? 'line-through' : 'none', 
                    opacity: isCompletedPeriod ? 0.6 : 1,
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                    cursor: 'text'
                  }}>
                  {task.title}
                </span>
              )}
              {task.flagged && <Flag size={14} color="var(--accent-orange)" fill="var(--accent-orange)" />}
              {task.locationName && <MapPin size={14} color="var(--accent-blue)" />}
              {task.image && <ImageIcon size={14} color="var(--text-tertiary)" />}
            </div>
            
            {/* Notas (Description) */}
            {(task.description || isEditingNote || isEditingTitle) && (
              <div style={{ marginTop: 2 }}>
                {isEditingNote ? (
                  <textarea 
                    value={editNote} 
                    autoFocus 
                    placeholder="Añadir nota..."
                    onChange={e => setEditNote(e.target.value)}
                    onBlur={handleNoteSubmit}
                    style={{ fontSize: '0.85rem', width: '100%', border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-secondary)', padding: 0, resize: 'none', minHeight: '40px' }}
                  />
                ) : (
                  <span 
                    onClick={() => setIsEditingNote(true)}
                    style={{ 
                      fontSize: '0.85rem',
                      color: 'var(--text-secondary)',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                      cursor: 'text'
                    }}>
                    {task.description || (isEditingTitle ? 'Añadir nota...' : '')}
                  </span>
                )}
              </div>
            )}
            
            <div style={{ display: 'flex', gap: 'var(--space-8)', marginTop: '2px', alignItems: 'center', flexWrap: 'wrap' }}>
              {showListName && taskList && (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', fontWeight: 500 }}>
                  {taskList.name}
                </span>
              )}
              {(task.dueDate || taskCycle) && (
                <span style={{ fontSize: '0.85rem', color: dueDateColor, display: 'flex', alignItems: 'center', fontWeight: 500, gap: 4 }}>
                  {task.dueDate && new Date(task.dueDate).toLocaleDateString()}
                  {task.dueDate && taskCycle && <Repeat size={12} style={{ color: 'var(--text-tertiary)' }} />}
                  {taskCycle && <span style={{color: 'var(--text-tertiary)'}}>{taskCycle.name}</span>}
                </span>
              )}
            </div>

            {task.isDetailed && (
              <div style={{ display: 'flex', gap: 'var(--space-8)', marginTop: 'var(--space-4)', alignItems: 'center', fontSize: '13px', flexWrap: 'wrap' }}>
                {task.price !== undefined && (
                  <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>${task.price.toFixed(2)} {task.quantity ? `x ${task.quantity}` : ''}</span>
                )}
                {task.brand && (
                  <span style={{ color: 'var(--text-tertiary)', background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4 }}>
                    {task.brand}
                  </span>
                )}
                {task.price !== undefined && task.quantity && (
                  <span style={{ color: 'var(--text-secondary)' }}>= ${(task.price * task.quantity).toFixed(2)}</span>
                )}
              </div>
            )}

            {task.url && (
              <a 
                href={task.url} 
                target="_blank" 
                rel="noreferrer"
                style={{ 
                  display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 'var(--space-8)', 
                  textDecoration: 'none', color: 'var(--accent-primary)', fontSize: '13px', fontWeight: 500,
                  width: 'fit-content',
                  wordBreak: 'break-all'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <Link2 size={14} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                  {(() => {
                    try { return new URL(task.url).hostname.replace('www.', ''); }
                    catch { return task.url; }
                  })()}
                </span>
              </a>
            )}
          </div>
          
          {!isBlocked && (
            <button 
              className="btn-icon" 
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(true);
              }}
              style={{ background: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
              title="Acciones"
            >
              <MoreHorizontal size={18} />
            </button>
          )}
        </div>

        {/* Bottom Sheet Nativo de iOS */}
        <AnimatePresence>
          {showMenu && createPortal(
            <>
              {/* Backdrop Oscuro */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ 
                  position: 'fixed', 
                  inset: 0, 
                  zIndex: 999998, 
                  background: 'rgba(0,0,0,0.3)', 
                  backdropFilter: 'blur(3px)',
                  WebkitBackdropFilter: 'blur(3px)'
                }} 
                onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} 
              />
              
              {/* Action Sheet Modal */}
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                style={{
                  position: 'fixed',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  zIndex: 999999,
                  background: 'var(--bg-elevated)',
                  backdropFilter: 'blur(25px)',
                  WebkitBackdropFilter: 'blur(25px)',
                  padding: '24px 24px max(24px, env(safe-area-inset-bottom))',
                  borderTopLeftRadius: '24px',
                  borderTopRightRadius: '24px',
                  boxShadow: '0 -10px 40px rgba(0,0,0,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Drag Handle (Cosmético) */}
                <div style={{ 
                  width: '40px', 
                  height: '5px', 
                  borderRadius: '5px', 
                  background: 'var(--border-color)', 
                  alignSelf: 'center', 
                  marginBottom: '12px' 
                }} />
                
                <button className="ios-sheet-btn" onClick={() => { setShowMenu(false); onEdit(task.id); }}>
                  <Edit3 size={20} />
                  <span>Editar Detalles</span>
                </button>
                <button className="ios-sheet-btn" onClick={() => { setShowMenu(false); onOpenZenMode(task.id); }}>
                  <Sparkles size={20} />
                  <span>Modo Zen</span>
                </button>
                <button className="ios-sheet-btn" onClick={() => { setShowMenu(false); addDependency(task.id); notify('Selecciona la tarea bloqueadora'); }}>
                  <Link2 size={20} />
                  <span>Añadir Dependencia</span>
                </button>
                
                <div style={{ height: '0.5px', background: 'var(--border-subtle)', margin: '8px 0' }} />
                
                <button className="ios-sheet-btn danger" onClick={() => { setShowMenu(false); setIsDeleteConfirmOpen(true); }}>
                  <Trash2 size={20} />
                  <span>Eliminar Tarea</span>
                </button>
              </motion.div>
            </>,
            document.body
          )}
        </AnimatePresence>
      </motion.div>

      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        title="Eliminar recordatorio"
        message={'“' + task.title + '” se moverá a la papelera. Podrás recuperarlo más adelante.'}
        confirmText="Mover a papelera"
        onCancel={() => setIsDeleteConfirmOpen(false)}
        onConfirm={() => {
          setIsDeleteConfirmOpen(false);
          onDelete(task.id);
          notify('Recordatorio movido a la papelera');
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
