import { useState, useRef, useMemo } from 'react';
import { Plus, ChevronDown, Sparkles, Sun, Calendar, Moon, Globe, Rocket, Flame, Star, Circle, FolderPlus } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAppStore } from '../../store/useAppStore';
import { usePromptStore } from '../../store/usePromptStore';
import type { TaskItem } from '../../models/Task';
import { TaskCard } from '../tasks/TaskCard';

interface MainContentProps {
  currentView: string;
  onOpenNewTask: () => void;
  onOpenZenMode: (taskId: string) => void;
  onBackToSidebar?: () => void;
  isMobile?: boolean;
}

// Flat representation para la virtualización
type VirtualItemType = 
  | { type: 'header', title: string, category: string, color: string }
  | { type: 'task', task: TaskItem, depth: number };

const SMART_COLORS: Record<string, string> = {
  'smart_today': 'var(--accent-blue)',
  'smart_scheduled': 'var(--accent-red)',
  'smart_all': 'var(--text-secondary)',
  'smart_flagged': 'var(--accent-orange)',
  'smart_completed': 'var(--text-tertiary)'
};

export function MainContent({ currentView, onOpenNewTask, onOpenZenMode, onBackToSidebar, isMobile }: MainContentProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  
  const { getTasksByCycle, getTasksByList, getSmartSortTasks, completeTask, deleteTask, cycles, lists, addListSection, updateListSection, updateTaskSection, listSections, tasks } = useAppStore();

  const currentCycle = cycles.find(c => c.id === currentView);
  const currentList = lists?.find(l => `list_${l.id}` === currentView);
  
  const isListView = currentView.startsWith('list_');

  const isSmartView = currentView.startsWith('smart_');

  // Funciones auxiliares para Smart Lists
  const getTasksForSmartView = () => {
    const allTasks = Object.values(tasks).filter(t => !t.is_deleted);
    const pendingTasks = allTasks.filter(t => t.status === 'PENDING');
    let filteredTasks: TaskItem[] = [];

    switch (currentView) {
      case 'smart_today':
        const today = new Date().toISOString().split('T')[0];
        filteredTasks = pendingTasks.filter(t => new Date(t.dueDate).toISOString().split('T')[0] === today);
        break;
      case 'smart_scheduled':
        filteredTasks = pendingTasks.filter(t => new Date(t.dueDate) > new Date());
        break;
      case 'smart_all':
        filteredTasks = pendingTasks;
        break;
      case 'smart_flagged':
        filteredTasks = pendingTasks.filter(t => t.flagged);
        break;
      case 'smart_completed':
        filteredTasks = allTasks.filter(t => t.status === 'COMPLETED');
        break;
    }

    // Agrupar por lista a la que pertenecen
    const grouped: Record<string, TaskItem[]> = {};
    filteredTasks.forEach(task => {
      const listName = lists.find(l => l.id === task.categoryId)?.name || 'Sin Lista';
      if (!grouped[listName]) grouped[listName] = [];
      grouped[listName].push(task);
    });
    return grouped;
  };

  const groupedTasks = isSmartView
    ? getTasksForSmartView()
    : isListView
      ? getTasksByList(currentView.replace('list_', ''))
      : getTasksByCycle(currentView);
    
  const smartTasks = currentView === 'cycle_day' ? getSmartSortTasks() : [];

  const toggleCategory = (cat: string) => {
    setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const getTitle = () => {
    if (isSmartView) {
      const names: Record<string, string> = {
        'smart_today': 'Hoy',
        'smart_scheduled': 'Programado',
        'smart_all': 'Todos',
        'smart_flagged': 'Destacado',
        'smart_completed': 'Terminado'
      };
      return names[currentView] || currentView;
    }
    if (currentCycle) return currentCycle.name;
    if (currentList) return currentList.name;
    return currentView;
  };

  const handleAddSection = async () => {
    if (!currentList) return;
    const name = await usePromptStore.getState().openPrompt("Nombre de la nueva sección:", "Ej: Compras");
    if (name) {
      addListSection({
        id: Math.random().toString(36).substring(2, 9),
        listId: currentList.id,
        name
      });
    }
  };

  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState('');

  const startEditingSection = (e: React.MouseEvent, sectionId: string, currentName: string) => {
    e.stopPropagation();
    setEditingSectionId(sectionId);
    setEditingSectionName(currentName);
  };

  const saveSectionName = (e: React.MouseEvent, sectionId: string) => {
    e.stopPropagation();
    if (editingSectionName.trim()) {
      updateListSection(sectionId, editingSectionName.trim());
    }
    setEditingSectionId(null);
  };

  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);

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
      let originalSectionId: string | undefined;

      if (!isListView) {
        const catObj = lists?.find(l => l.id === categoryOrCycle);
        if (catObj) color = catObj.color;
      } else {
        color = currentList?.color || color;
        if (categoryOrCycle.startsWith('section_')) {
          const sectionName = categoryOrCycle.replace('section_', '');
          const sec = listSections?.find(s => s.name === sectionName && s.listId === currentList?.id);
          if (sec) originalSectionId = sec.id;
        }
      }
      
      flat.push({ type: 'header', title: categoryOrCycle.replace('section_', ''), category: categoryOrCycle, color, sectionId: originalSectionId } as any);
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
      {/* Header */}
      <header className="content-header" style={{ padding: 'var(--space-24) var(--space-48) var(--space-16)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          {isMobile && (
            <button 
              onClick={onBackToSidebar}
              style={{
                background: 'transparent', border: 'none', color: 'var(--accent-primary)',
                display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12, padding: 0,
                fontSize: '1rem', cursor: 'pointer'
              }}
            >
              <ChevronDown size={20} style={{ transform: 'rotate(90deg)' }} />
              Listas
            </button>
          )}
          <h1 className="text-display" style={{ 
            fontSize: '2.5rem', 
            color: isSmartView ? SMART_COLORS[currentView] : isListView && currentList ? currentList.color : 'var(--text-primary)'
          }}>
            {CycleIcon && <CycleIcon size={32} color="var(--accent-primary)" style={{ marginRight: 12 }} />}
            {getTitle()}
          </h1>
          <p className="text-secondary" style={{ marginTop: 'var(--space-8)' }}>
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '8px' }}>
          {isListView && (
            <button className="icon-btn" onClick={handleAddSection} title="Añadir Sección">
              <FolderPlus size={20} />
            </button>
          )}
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
            const isCustomSection = (data as any).sectionId !== undefined;
            const sectionId = (data as any).sectionId;
            const isDraggingOver = dragOverSectionId === sectionId && isCustomSection;

            return (
              <div 
                key={data.category} 
                style={{
                  ...virtualStyle,
                  background: isDraggingOver ? 'var(--bg-surface-glass)' : 'transparent',
                  transition: 'background 0.2s',
                  borderRadius: 'var(--radius-md)'
                }} 
                className="group-header" 
                onClick={() => toggleCategory(data.category)}
                onDragOver={(e) => {
                  if (!isCustomSection) return;
                  e.preventDefault();
                  setDragOverSectionId(sectionId);
                }}
                onDragLeave={() => {
                  setDragOverSectionId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverSectionId(null);
                  if (!isCustomSection) return;
                  
                  const draggedTaskId = e.dataTransfer.getData('text/plain');
                  if (draggedTaskId) {
                    updateTaskSection(draggedTaskId, sectionId);
                  }
                }}
              >
                <h3 
                  style={{ color: data.color, display: 'flex', alignItems: 'center', gap: 8, flex: 1, margin: 0 }}
                  onDoubleClick={(e) => {
                    if (isCustomSection) startEditingSection(e, sectionId, data.title);
                  }}
                >
                  {data.category === 'smart' && <Sparkles size={20} />} 
                  
                  {editingSectionId === sectionId && isCustomSection ? (
                    <input 
                      type="text" 
                      value={editingSectionName}
                      onChange={e => setEditingSectionName(e.target.value)}
                      onClick={e => e.stopPropagation()}
                      onBlur={(e) => saveSectionName(e as any, sectionId)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveSectionName(e as any, sectionId);
                      }}
                      style={{ 
                        background: 'transparent', border: 'none', borderBottom: '2px solid var(--accent-primary)', 
                        color: 'var(--text-primary)', fontSize: 'inherit', fontFamily: 'inherit', outline: 'none',
                        fontWeight: 'bold', width: '100%'
                      }}
                      autoFocus
                    />
                  ) : (
                    <span style={{ fontWeight: 700, fontSize: '1.25rem' }}>{data.title}</span>
                  )}
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
