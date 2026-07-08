import { motion } from 'framer-motion';
import { CheckCircle, Trash2, Lock, Play, GripVertical, Link2 } from 'lucide-react';
import { useState } from 'react';
import type { TaskItem } from '../../models/Task';
import { useAppStore } from '../../store/useAppStore';
import { usePromptStore } from '../../store/usePromptStore';

interface TaskCardProps {
  task: TaskItem;
  virtualStyle: React.CSSProperties;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenZenMode: (id: string) => void;
  index: number;
}

export function TaskCard({ task, virtualStyle, onComplete, onDelete, onOpenZenMode, index }: TaskCardProps) {
  const { cycles, tasks, nestTask, addDependency } = useAppStore();
  const taskCycle = cycles.find(c => c.id === task.cycleId);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  
  // Para posicionar el menú contextual en click derecho
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });

  // Un task está bloqueado si alguno de sus blockedBy está PENDING
  const isBlocked = task.blockedBy && task.blockedBy.some(id => tasks[id] && tasks[id].status === 'PENDING');
  
  const handleSwipeEnd = (offset: number) => {
    if (offset > 100 && !isBlocked) {
      if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
      onComplete(task.id);
    } else if (offset < -100) {
      onDelete(task.id);
    } else if (offset < -50) {
      setShowMenu(true); // Swipe corto izquierdo abre el menú
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
          // El Drag & Drop ahora anida subtareas, no bloqueos
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
          delay: Math.min(index * 0.05, 0.5) // Stagger effect
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
        
        {/* Grip para Drag & Drop (Power User Gestures) */}
        <div 
          draggable
          onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
          style={{ cursor: 'grab', marginRight: 'var(--space-8)', color: 'var(--text-tertiary)' }}
        >
          <GripVertical size={16} />
        </div>

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
            border: '2px solid var(--border-subtle)', 
            marginRight: 'var(--space-16)', 
            cursor: 'pointer',
            background: 'transparent',
            transition: 'border-color 0.2s ease, transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.transform = 'scale(1.1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.transform = 'scale(1)'; }}
        />
        
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 'var(--space-8)' }}>
              {isBlocked && <Lock size={16} color="var(--accent-red)" />}
              <span style={{ textDecoration: task.status === 'COMPLETED' ? 'line-through' : 'none' }}>
                {task.title}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-8)', marginTop: 'var(--space-4)', alignItems: 'center' }}>
              {task.alerts.map((time: string, idx: number) => (
                <span key={idx} className="time-pill">{time}</span>
              ))}
              <span className="text-muted" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                {taskCycle ? taskCycle.name : 'Personalizado'}
              </span>
            </div>
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

        {/* Action Menu (Swipe or Context Menu) */}
        {showMenu && (
          <div 
            style={{
              position: 'absolute',
              top: menuPos.y || '10%',
              right: 'var(--space-16)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              zIndex: 100,
              padding: 'var(--space-8)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-4)',
              minWidth: 160
            }}
            onClick={(e) => e.stopPropagation()} // Prevenir cerrar inmediatamente
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>ACCIONES</span>
              <button className="btn-icon" style={{ width: 24, height: 24 }} onClick={() => setShowMenu(false)}>✕</button>
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
              onClick={() => { onDelete(task.id); setShowMenu(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px', background: 'transparent', border: 'none', color: 'var(--accent-red)', textAlign: 'left', cursor: 'pointer', borderRadius: 4 }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Trash2 size={16} /> Eliminar
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
