import React, { useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { CheckCircle, Trash2, GripVertical, Play, Lock, Link2, Flag, MapPin, Link, Image as ImageIcon, X } from 'lucide-react';
import type { TaskItem } from '../../models/Task';
import { useAppStore } from '../../store/useAppStore';
import { usePromptStore } from '../../store/usePromptStore';
import { isCompletedInCurrentPeriod } from '../../services/TaskService';

interface TaskCardProps {
  task: TaskItem;
  virtualStyle: React.CSSProperties;
  onToggle: (id: string, forceReverse?: boolean) => void;
  onDelete: (id: string) => void;
  onOpenZenMode: (id: string) => void;
  index: number;
}

export const TaskCard = React.memo(function TaskCard({ task, virtualStyle, onToggle, onDelete, onOpenZenMode, index }: TaskCardProps) {
  const { cycles, tasks, nestTask, addDependency, lists } = useAppStore();
  const taskCycle = cycles.find(c => c.id === task.cycle_id);
  const taskList = lists?.find(l => l.id === task.category_id);

  let dueDateColor = 'var(--text-secondary)';
  if (task.due_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(task.due_date);
    due.setHours(0, 0, 0, 0);
    if (due < today) dueDateColor = 'var(--accent-red)';
    else if (due.getTime() === today.getTime()) dueDateColor = 'var(--accent-orange)';
  }
  const [isDragOver, setIsDragOver] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  
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

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuPos({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
    setShowMenu(true);
  };

  return (
    <div 
      className="task-item-wrapper" 
      style={{ ...virtualStyle, paddingBottom: 16 }}
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
      <motion.div className="swipe-background left" style={{ bottom: 16, opacity: leftOpacity }}>
        <motion.div style={{ scale: leftScale }}><CheckCircle color="white" /></motion.div>
      </motion.div>
      <motion.div className="swipe-background right" style={{ bottom: 16, opacity: rightOpacity }}>
        <motion.div style={{ scale: rightScale }}><Trash2 color="white" /></motion.div>
      </motion.div>

      {/* Tarjeta Principal */}
      <motion.div 
        onContextMenu={handleContextMenu}
        drag="x"
        style={{ x }}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.7}
        dragTransition={{ bounceStiffness: 400, bounceDamping: 25 }}
        onDragEnd={(_, info) => handleSwipeEnd(info.offset.x)}
        whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ 
          type: 'spring', 
          stiffness: 400, 
          damping: 25, 
          delay: Math.min(index * 0.05, 0.5)
        }}
        className="surface-card ios-task-row"
        style={{ 
          position: 'relative', 
          height: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          padding: '12px 16px', 
          zIndex: 2,
          background: 'transparent',
          opacity: isBlocked ? 0.6 : 1,
          pointerEvents: isBlocked ? 'none' : 'auto',
          border: 'none',
          borderBottom: '1px solid var(--border-subtle)',
          borderRadius: 0,
          boxShadow: 'none'
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
            <button 
              className="checkbox" 
              aria-label="Completar tarea"
              disabled={isBlocked}
              onClick={() => {
                if (isBlocked) return;
                if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
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
                transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0
              }}
              onMouseEnter={(e) => { 
                e.currentTarget.style.transform = 'scale(1.1)'; 
              }}
              onMouseLeave={(e) => { 
                e.currentTarget.style.transform = 'scale(1)'; 
              }}
            >
              {isPartial && !isCompletedPeriod && <div style={{ width: 20, height: 20, background: 'var(--bg-surface)', borderRadius: '50%' }}></div>}
              {isCompletedPeriod && <CheckCircle size={16} color="white" />}
            </button>
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
                WebkitLineClamp: 3,
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
              {taskList && (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', fontWeight: 500 }}>
                  {taskList.name}
                </span>
              )}
              {(task.due_date || taskCycle) && (
                <span style={{ fontSize: '0.85rem', color: dueDateColor, display: 'flex', alignItems: 'center', fontWeight: 500, gap: 4 }}>
                  {task.due_date && new Date(task.due_date).toLocaleDateString()}
                  {task.due_date && taskCycle && <span style={{color: 'var(--text-tertiary)'}}>🔁</span>}
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
              <span className="text-muted" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                {taskCycle ? taskCycle.name : 'Personalizado'}
              </span>
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
              onClick={() => onOpenZenMode(task.id)}
              style={{ background: 'var(--border-subtle)', color: 'var(--accent-primary)' }}
              title="Modo Flow"
            >
              <Play size={18} fill="currentColor" />
            </button>
          )}
        </div>

        {/* Action Menu (Context Menu) */}
        {showMenu && (
          <>
            <div 
              style={{ position: 'fixed', inset: 0, zIndex: 99 }} 
              onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} 
            />
            <div 
              style={{
                position: 'absolute',
                top: menuPos.y || '10%',
                right: 'var(--space-16)',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 100,
                padding: 'var(--space-8)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-4)',
                minWidth: 160
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>ACCIONES</span>
                <button className="btn-icon" style={{ width: 24, height: 24 }} onClick={() => setShowMenu(false)}>
                  <X size={14} />
                </button>
              </div>
              
              <button 
                onClick={async () => {
                  const depId = await usePromptStore.getState().openPrompt("Ingresa el ID de la tarea bloqueadora:");
                  if (depId) addDependency(task.id, depId);
                  setShowMenu(false);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px', background: 'transparent', border: 'none', color: 'var(--text-primary)', textAlign: 'left', cursor: 'pointer', borderRadius: 4 }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <Link2 size={16} /> Vincular Bloqueo
              </button>

              <button 
                onClick={() => { 
                  if (navigator.vibrate) navigator.vibrate(50);
                  onDelete(task.id); 
                  setShowMenu(false); 
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px', background: 'transparent', border: 'none', color: 'var(--accent-red)', textAlign: 'left', cursor: 'pointer', borderRadius: 4 }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <Trash2 size={16} /> Eliminar
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
});
