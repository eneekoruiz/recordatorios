import React, { useState } from 'react';
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
  const [feedback, setFeedback] = useState<string | null>(null);
  
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });

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
      
      {/* Fondos de Swipe */}
      <motion.div className="swipe-background left" style={{ bottom: 0, opacity: leftOpacity, display: isDraggingX ? 'flex' : 'none' }}>
        <motion.div style={{ scale: leftScale, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle color="white" size={22} />
          <motion.span style={{ color: 'white', fontWeight: 600, fontSize: '0.9rem', opacity: leftOpacity }}>Completar</motion.span>
        </motion.div>
      </motion.div>
      <motion.div className="swipe-background right" style={{ bottom: 0, opacity: rightOpacity, display: isDraggingX ? 'flex' : 'none' }}>
        <motion.div style={{ scale: rightScale, display: 'flex', alignItems: 'center', gap: 8 }}>
          <motion.span style={{ color: 'white', fontWeight: 600, fontSize: '0.9rem', opacity: rightOpacity }}>Eliminar</motion.span>
          <Trash2 color="white" size={22} />
        </motion.div>
      </motion.div>

      {/* Tarjeta Principal */}
      <motion.div 
        onContextMenu={handleContextMenu}
        drag="x"
        dragSnapToOrigin={true}
        dragConstraints={{ left: -130, right: 130 }}
        dragElastic={0.15}
        dragTransition={{ bounceStiffness: 600, bounceDamping: 30 }}
        onDragEnd={(_, info) => handleSwipeEnd(info.offset.x)}
        className="ios-task-row"
        style={{ 
          x,
          cursor: 'grab',
          position: 'relative', 
          height: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          padding: '12px 16px', 
          zIndex: 2,
          background: 'var(--bg-base)',
          opacity: isBlocked ? 0.6 : 1,
          pointerEvents: isBlocked ? 'none' : 'auto',
          border: 'none',
          borderBottom: '1px solid var(--border-subtle)',
          borderRadius: 0,
          boxShadow: isDragOver ? `0 0 0 2px var(--accent-primary)` : 'none'
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
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-8)', flexWrap: 'wrap' }}>
              {isBlocked && <Lock size={16} color="var(--accent-red)" />}
              
              {/* Badges UI de Prioridad en lugar de "!!!" */}
              {task.priority && task.priority !== 'none' && (
                <span className={`priority-badge ${task.priority}`}>
                  {task.priority === 'low' ? '!' : task.priority === 'medium' ? '!!' : '!!!'}
                </span>
              )}

              <span style={{ 
                fontSize: '1rem',
                fontWeight: 500,
                color: 'var(--text-primary)',
                textDecoration: isCompletedPeriod ? 'line-through' : 'none', 
                opacity: isCompletedPeriod ? 0.6 : 1,
                wordBreak: 'break-word',
                display: '-webkit-box',
                WebkitLineClamp: 6,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}>
                {task.title}
              </span>
              {task.flagged && <Flag size={14} color="var(--accent-orange)" fill="var(--accent-orange)" />}
              {task.locationName && <MapPin size={14} color="var(--accent-blue)" />}
              {task.image && <ImageIcon size={14} color="var(--text-tertiary)" />}
            </div>
            
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
              {(task.alerts || []).map((alert: any, idx: number) => {
                const isCompleted = task.completedAlerts?.includes(alert.id);
                const label = alert.type === 'at_time' ? alert.time : `-${alert.offsetMinutes}m`;
                return (
                  <span 
                    key={alert.id || idx} 
                    className="time-pill"
                    style={{ 
                      textDecoration: isCompleted ? 'line-through' : 'none',
                      opacity: isCompleted ? 0.5 : 1
                    }}
                  >
                    {label}
                  </span>
                );
              })}
            </div>

            {task.isDetailed && (
              <div style={{ display: 'flex', gap: 'var(--space-8)', marginTop: 'var(--space-4)', alignItems: 'center', fontSize: '0.85rem', flexWrap: 'wrap' }}>
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
                  display: 'flex', alignItems: 'center', gap: 8, marginTop: 'var(--space-8)', 
                  padding: '4px 8px 4px 4px', background: 'var(--bg-elevated)', borderRadius: '8px', 
                  textDecoration: 'none', color: 'var(--text-primary)', fontSize: '0.85rem',
                  minWidth: 0, width: 'fit-content'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ width: 32, height: 32, background: 'var(--border-subtle)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={`https://www.google.com/s2/favicons?domain=${task.url}&sz=64`} alt="favicon" style={{ width: 20, height: 20, borderRadius: 4 }} />
                </div>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200, fontWeight: 500 }}>
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
                if (showMenu) {
                  setShowMenu(false);
                } else {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setMenuPos({
                    x: Math.max(12, Math.min(rect.right - 220, window.innerWidth - 232)),
                    y: Math.min(rect.bottom + 8, window.innerHeight - 220)
                  });
                  setShowMenu(true);
                }
              }}
              style={{ background: 'var(--border-subtle)', color: 'var(--text-secondary)' }}
              title="Acciones"
            >
              <MoreHorizontal size={18} />
            </button>
          )}
        </div>

        {/* Action Menu (Context Menu) */}
        {showMenu && createPortal(
          <>
            <div 
              style={{ position: 'fixed', inset: 0, zIndex: 99998 }} 
              onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} 
            />
            <div 
              className="ios-dropdown-menu"
              style={{
                position: 'fixed',
                top: menuPos.y + 4,
                left: menuPos.x,
                zIndex: 99999
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                className="ios-dropdown-item"
                onClick={async () => {
                  setShowMenu(false);
                  
                  let taskDuration = task.duration;
                  if (!taskDuration) {
                    const input = await usePromptStore.getState().openPrompt(
                      "Introduce la duración de la tarea (en minutos):",
                      "Ej: 25"
                    );
                    if (input && !isNaN(Number(input)) && Number(input) > 0) {
                      taskDuration = Number(input);
                      useAppStore.getState().updateTask(task.id, { duration: taskDuration });
                    } else {
                      return;
                    }
                  }
                  
                  onOpenZenMode(task.id);
                }}
                style={{ color: 'var(--accent-primary)', fontWeight: 600 }}
              >
                <Play size={16} fill="currentColor" /> Empezar ya
              </button>

              <button 
                className="ios-dropdown-item"
                onClick={() => {
                  setShowMenu(false);
                  onEdit(task.id);
                }}
              >
                <Edit3 size={16} /> Editar recordatorio
              </button>

              <button 
                className="ios-dropdown-item"
                onClick={async () => {
                  setShowMenu(false);
                  const query = await usePromptStore.getState().openPrompt(
                    "Esta tarea dependerá de otra. Escribe el nombre de la tarea bloqueadora para buscarla:"
                  );
                  if (query) {
                    const allTasks = Object.values(useAppStore.getState().tasks);
                    const matching = allTasks.filter(t => 
                      t.title.toLowerCase().includes(query.toLowerCase()) && 
                      t.id !== task.id &&
                      t.status === 'pending' &&
                      !t.deleted_at
                    );
                    
                    if (matching.length === 0) {
                      notify('No encontramos ninguna tarea pendiente con ese nombre.');
                    } else if (matching.length === 1) {
                      addDependency(task.id, matching[0].id);
                      notify('Tarea vinculada correctamente.');
                    } else {
                      const listString = matching.map((t, idx) => `${idx + 1}. ${t.title}`).join('\n');
                      const selectIdxStr = await usePromptStore.getState().openPrompt(
                        `Elige el número de la tarea de la que dependerá:\n\n${listString}`
                      );
                      const selectIdx = Number(selectIdxStr) - 1;
                      if (selectIdx >= 0 && selectIdx < matching.length) {
                        addDependency(task.id, matching[selectIdx].id);
                        notify('Tarea vinculada correctamente.');
                      }
                    }
                  }
                }}
              >
                <Link2 size={16} /> Bloquear con otra tarea
              </button>

              <div className="ios-dropdown-divider" />
              
              <button 
                className="ios-dropdown-item danger"
                onClick={() => {
                  setShowMenu(false);
                  setIsDeleteConfirmOpen(true);
                }}
              >
                <Trash2 size={16} /> Eliminar
              </button>
            </div>
          </>,
          document.body
        )}
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
