import { useState, useRef, useMemo } from 'react';
import { Plus, ChevronDown, Sparkles, Sun, Calendar, Moon, Globe, Rocket, Flame, Star, Circle } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAppStore } from '../../store/useAppStore';
import type { TaskItem } from '../../models/Task';
import { TaskCard } from '../tasks/TaskCard';

interface MainContentProps {
  currentView: string;
  onOpenNewTask: () => void;
  onOpenZenMode: (taskId: string) => void;
}

// Flat representation para la virtualización
type VirtualItemType = 
  | { type: 'header', title: string, category: string, color: string }
  | { type: 'task', task: TaskItem, depth: number };

export function MainContent({ currentView, onOpenNewTask, onOpenZenMode }: MainContentProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  
  const { getTasksByCycle, getTasksByList, getSmartSortTasks, completeTask, deleteTask, cycles, lists } = useAppStore();

  const currentCycle = cycles.find(c => c.id === currentView);
  const currentList = lists?.find(l => `list_${l.id}` === currentView);
  
  const isListView = currentView.startsWith('list_');

  const groupedTasks = isListView
    ? getTasksByList(currentView.replace('list_', ''))
    : getTasksByCycle(currentView);
    
  const smartTasks = currentView === 'cycle_day' ? getSmartSortTasks() : [];

  const toggleCategory = (cat: string) => {
    setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const getTitle = () => {
    if (currentCycle) return currentCycle.name;
    if (currentList) return currentList.name;
    return currentView;
  };

  // 1. Flatten Data para Virtualización (QA Performance Optimization)
  const flattenedData = useMemo(() => {
    const flat: VirtualItemType[] = [];
    
    // Up Next (Solo en el ciclo más corto, e.g. cycle_day)
    if (currentCycle && currentCycle.daysValue === 1 && smartTasks.length > 0) {
      flat.push({ type: 'header', title: 'Up Next (Priorizado)', category: 'smart', color: '#0a84ff' });
      if (!collapsed['smart']) {
        smartTasks.slice(0, 2).forEach(task => flat.push({ type: 'task', task, depth: 0 }));
      }
    }

    // Categorías (Si estamos en ciclo) o Ciclos (Si estamos en Lista)
    Object.entries(groupedTasks).forEach(([categoryOrCycle, tasks]) => {
      let color = '#34c759'; // Default
      if (!isListView) {
        const catObj = lists?.find(l => l.id === categoryOrCycle);
        if (catObj) color = catObj.color;
      }
      
      flat.push({ type: 'header', title: categoryOrCycle, category: categoryOrCycle, color });
      if (!collapsed[categoryOrCycle]) {
        const roots = tasks.filter(t => !t.parentId);
        const processNode = (task: TaskItem, depth: number) => {
          flat.push({ type: 'task', task, depth });
          const children = tasks.filter(t => t.parentId === task.id);
          children.forEach(c => processNode(c, depth + 1));
        };
        roots.forEach(r => processNode(r, 0));
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

  const renderTask = (task: TaskItem, virtualStyle: React.CSSProperties, index: number, depth: number) => (
    <TaskCard 
      key={task.id}
      task={task}
      virtualStyle={{
        ...virtualStyle,
        paddingLeft: `calc(${depth * 32}px)`
      }}
      onComplete={completeTask}
      onDelete={deleteTask}
      onOpenZenMode={onOpenZenMode}
      index={index}
    />
  );

  const IconMap: Record<string, any> = {
    'sun': Sun, 'calendar': Calendar, 'moon': Moon, 'globe': Globe,
    'rocket': Rocket, 'flame': Flame, 'sparkles': Sparkles, 'star': Star, 'circle': Circle
  };
  const CycleIcon = currentCycle ? (IconMap[currentCycle.icon] || Circle) : null;

  return (
    <main className="main-content" ref={parentRef} style={{ overflowY: 'auto' }}>
      <header className="content-header">
        <h1 className="text-display" style={{ color: currentList ? currentList.color : 'var(--text-primary)', marginBottom: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
          {CycleIcon && <CycleIcon size={32} color="var(--accent-primary)" />}
          {currentList && <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: currentList.color }}></div>}
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
                  style={{ 
                    color: 'var(--text-tertiary)', 
                    transition: 'transform 0.3s ease',
                    transform: collapsed[data.category] ? 'rotate(-90deg)' : 'rotate(0)' 
                  }} 
                />
              </div>
            );
          } else {
            return renderTask(data.task, virtualStyle, virtualItem.index, data.depth);
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
