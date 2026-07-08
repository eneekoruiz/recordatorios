import { useState, useRef, useMemo } from 'react';
import { Plus, ChevronDown, Sparkles, Trash2, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAppStore } from '../../store/useAppStore';
import type { TaskItem } from '../../models/Task';

interface MainContentProps {
  currentView: string;
  onOpenNewTask: () => void;
}

// Flat representation para la virtualización
type VirtualItemType = 
  | { type: 'header', title: string, category: string, color: string }
  | { type: 'task', task: TaskItem };

export function MainContent({ currentView, onOpenNewTask }: MainContentProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  
  const { getTasksByFrequency, getSmartSortTasks, completeTask, deleteTask } = useAppStore();

  const getTargetLevel = () => {
    if (currentView === 'TODAY') return 1;
    if (currentView === 'WEEK') return 2;
    if (currentView === 'MONTH') return 3;
    return 1;
  };

  const groupedTasks = getTasksByFrequency(getTargetLevel());
  const smartTasks = currentView === 'TODAY' ? getSmartSortTasks() : [];

  const toggleCategory = (cat: string) => {
    setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const getTitle = () => {
    if (currentView === 'TODAY') return 'Mi Día';
    if (currentView === 'WEEK') return 'Mi Semana';
    if (currentView === 'MONTH') return 'Mi Mes';
    return currentView;
  };

  const handleSwipeEnd = (taskId: string, offset: number) => {
    if (offset > 100) {
      if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
      completeTask(taskId);
    } else if (offset < -100) {
      deleteTask(taskId);
    }
  };

  // 1. Flatten Data para Virtualización (QA Performance Optimization)
  const flattenedData = useMemo(() => {
    const flat: VirtualItemType[] = [];
    
    // Up Next (Solo en TODAY)
    if (currentView === 'TODAY' && smartTasks.length > 0) {
      flat.push({ type: 'header', title: 'Up Next (Priorizado)', category: 'smart', color: '#0a84ff' });
      if (!collapsed['smart']) {
        smartTasks.slice(0, 2).forEach(task => flat.push({ type: 'task', task }));
      }
    }

    // Categorías
    Object.entries(groupedTasks).forEach(([category, tasks]) => {
      const color = category === 'limpieza' ? '#ff9500' : category === 'skincare' ? '#af52de' : '#34c759';
      flat.push({ type: 'header', title: category, category, color });
      if (!collapsed[category]) {
        tasks.forEach(task => flat.push({ type: 'task', task }));
      }
    });

    return flat;
  }, [groupedTasks, smartTasks, currentView, collapsed]);

  // 2. React Virtualizer
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: flattenedData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      // Cabecera ~ 60px, Tarea ~ 80px
      return flattenedData[index].type === 'header' ? 60 : 86;
    },
    overscan: 5,
  });

  const renderTask = (task: TaskItem, virtualStyle: React.CSSProperties) => (
    <div key={task.id} className="task-item-wrapper" style={{ ...virtualStyle, paddingBottom: 12 }}>
      <div className="swipe-background left" style={{ top: 0, bottom: 12 }}>
        <CheckCircle color="white" />
      </div>
      <div className="swipe-background right" style={{ top: 0, bottom: 12 }}>
        <Trash2 color="white" />
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.8}
        onDragEnd={(_, info) => handleSwipeEnd(task.id, info.offset.x)}
        whileDrag={{ scale: 1.02, boxShadow: '0 8px 16px rgba(0,0,0,0.3)' }}
        className="task-item"
        style={{ zIndex: 2, position: 'relative', background: 'var(--card-bg)', height: '100%' }}
      >
        <div 
          className="checkbox" 
          onClick={() => {
            if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
            completeTask(task.id);
          }}
        ></div>
        <div className="task-details">
          <div className="task-title">{task.title}</div>
          <div className="task-meta">
            {task.alerts.map((time: string, idx: number) => (
              <span key={idx} className="time-pill">{time}</span>
            ))}
            {task.frequencyLevel === 1 ? 'Diario' : task.frequencyLevel === 2 ? 'Semanal' : 'Mensual'}
          </div>
        </div>
      </motion.div>
    </div>
  );

  return (
    <main className="main-content" ref={parentRef} style={{ overflowY: 'auto' }}>
      <header className="content-header">
        <h1 className="header" style={{ color: currentView === 'TODAY' ? '#0a84ff' : currentView === 'WEEK' ? '#ff3b30' : '#ff9500' }}>
          {getTitle()}
        </h1>
        <div className="header-actions">
          <button className="icon-btn" onClick={onOpenNewTask}><Plus size={24} /></button>
        </div>
      </header>

      {/* Lista Virtualizada */}
      <div className="tasks-container" style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
        
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const data = flattenedData[virtualItem.index];
          
          const virtualStyle: React.CSSProperties = {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: `${virtualItem.size}px`,
            transform: `translateY(${virtualItem.start}px)`,
          };

          if (data.type === 'header') {
            return (
              <div key={data.category} style={virtualStyle} className="group-header" onClick={() => toggleCategory(data.category)}>
                <h3 style={{ color: data.color, display: 'flex', alignItems: 'center', gap: 8, textTransform: 'capitalize' }}>
                  {data.category === 'smart' && <Sparkles size={20} />} {data.title}
                </h3>
                <ChevronDown 
                  size={20} 
                  className="chevron" 
                  style={{ transform: collapsed[data.category] ? 'rotate(-90deg)' : 'rotate(0)' }} 
                />
              </div>
            );
          } else {
            return renderTask(data.task, virtualStyle);
          }
        })}

        {flattenedData.length === 0 && (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>
            No hay tareas pendientes en esta vista.
          </div>
        )}

      </div>

      <button className="fab" onClick={onOpenNewTask}>
        <Plus size={24} />
      </button>
    </main>
  );
}
