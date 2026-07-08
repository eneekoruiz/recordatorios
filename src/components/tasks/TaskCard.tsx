import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Trash2, GripVertical, Play, Lock, Link2, Flag, MapPin, Link, Image as ImageIcon, X } from 'lucide-react';
import type { TaskItem } from '../../models/Task';
import { useAppStore } from '../../store/useAppStore';
import { usePromptStore } from '../../store/usePromptStore';
import { isCompletedInCurrentPeriod } from '../../services/TaskService';

interface TaskCardProps {
  task: TaskItem;
  virtualStyle: React.CSSProperties;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenZenMode: (id: string) => void;
  index: number;
}

export const TaskCard = React.memo(function TaskCard({ task, virtualStyle, onComplete, onDelete, onOpenZenMode, index }: TaskCardProps) {
  const { cycles, tasks, nestTask, addDependency } = useAppStore();
  const taskCycle = cycles.find(c => c.id === task.cycle_id);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });

  // Bloqueado si alguna dependencia sigue pendiente
  const isBlocked = task.blockedBy && task.blockedBy.some(id => tasks[id] && tasks[id].status === 'pending');

  // Nueva lógica modularizada (CycleCompletionService)
  const isCompletedPeriod = isCompletedInCurrentPeriod(task, cycles);
  
  const handleSwipeEnd = (offset: number) => {
    if (offset > 100 && !isBlocked) {
      if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
      onComplete(task.id);
    } else if (offset < -100) {
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
      <div className="swipe-background left" style={{ bottom: 16 }}>
        <CheckCircle color="white" />
      </div>
      <div className="swipe-background right" style={{ bottom: 16 }}>
        <Trash2 color="white" />
      </div>

      {/* Tarjeta Principal */}
      <motion.div 
        onContextMenu={handleContextMenu}
        drag="x"
        dragConstraints={{ left: -120, right: 120 }}
        dragElastic={0.2}
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
        className="surface-card"
        style={{ 
          position: 'relative', 
          height: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          padding: 'var(--space-16)', 
          zIndex: 2,
          background: 'var(--bg-surface)',
          opacity: isBlocked ? 0.6 : 1,
          pointerEvents: isBlocked ? 'none' : 'auto',
          border: isDragOver ? '2px dashed var(--accent-primary)' : '1px solid var(--border-subtle)'
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
                onComplete(task.id);
              }}
              style={{
                width: 24, height: 24, 
                borderRadius: '50%', 
                border: isPartial ? 'none' : '2px solid var(--border-subtle)', 
                marginRight: 'var(--space-16)', 
                cursor: 'pointer',
                background: isCompletedPeriod 
                  ? 'var(--accent-primary)' 
                  : isPartial 
                    ? `conic-gradient(var(--accent-primary) ${percentage}%, var(--border-subtle) ${percentage}%)`
                    : 'transparent',
                transition: 'border-color 0.2s ease, transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
              onMouseEnter={(e) => { 
                if (!isPartial && !isCompletedPeriod) e.currentTarget.style.borderColor = 'var(--accent-primary)'; 
                e.currentTarget.style.transform = 'scale(1.1)'; 
              }}
              onMouseLeave={(e) => { 
                if (!isPartial && !isCompletedPeriod) e.currentTarget.style.borderColor = 'var(--border-subtle)'; 
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
            <div style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-8)', flexWrap: 'wrap' }}>
              {isBlocked && <Lock size={16} color="var(--accent-red)" />}
              
              {/* Badges UI de Prioridad en lugar de "!!!" */}
              {task.priority && task.priority !== 'none' && (
                <span className={`priority-badge ${task.priority}`}>
                  {task.priority === 'low' ? '!' : task.priority === 'medium' ? '!!' : '!!!'}
                </span>
              )}

              <span style={{ 
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
              {task.url && <Link size={14} color="var(--text-tertiary)" />}
              {task.locationName && <MapPin size={14} color="var(--accent-blue)" />}
              {task.image && <ImageIcon size={14} color="var(--text-tertiary)" />}
            </div>
            
            <div style={{ display: 'flex', gap: 'var(--space-8)', marginTop: 'var(--space-4)', alignItems: 'center', flexWrap: 'wrap' }}>
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
