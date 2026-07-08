import { useState, useRef, useMemo, useCallback } from 'react';
import { Plus, ChevronDown, Sparkles, FolderPlus, Inbox } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAppStore } from '../../store/useAppStore';
import { usePromptStore } from '../../store/usePromptStore';
import type { TaskItem } from '../../models/Task';
import { TaskCard } from '../tasks/TaskCard';
import { getCycleIcon } from '../../constants/icons';

interface MainContentProps {
  currentView: string;
  onOpenNewTask: () => void;
  onOpenZenMode: (taskId: string) => void;
  onBackToSidebar?: () => void;
  isMobile?: boolean;
}

type VirtualItemType = 
  | { type: 'header', title: string, category: string, color: string, sectionId?: string }
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

  const currentCycle = useMemo(() => cycles.find(c => c.id === currentView), [cycles, currentView]);
  const currentList = useMemo(() => lists?.find(l => `list_${l.id}` === currentView), [lists, currentView]);
  
  const isListView = currentView.startsWith('list_');
  const isSmartView = currentView.startsWith('smart_');

  // Funciones auxiliares para Smart Lists (memoized)
  const getTasksForSmartView = useCallback((includeCompleted = false) => {
    const allTasks = Object.values(tasks).filter(t => !t.is_deleted);
    const validTasks = includeCompleted ? allTasks : allTasks.filter(t => t.status === 'PENDING');
    let filteredTasks: TaskItem[] = [];

    switch (currentView) {
      case 'smart_today': {
        const today = new Date().toISOString().split('T')[0];
        filteredTasks = validTasks.filter(t => new Date(t.dueDate).toISOString().split('T')[0] === today);
        break;
      }
      case 'smart_scheduled':
        filteredTasks = validTasks.filter(t => new Date(t.dueDate) > new Date());
        break;
      case 'smart_all':
        filteredTasks = validTasks;
        break;
      case 'smart_flagged':
        filteredTasks = validTasks.filter(t => t.flagged);
        break;
      case 'smart_completed':
        filteredTasks = allTasks.filter(t => t.status === 'COMPLETED'); // always completed
        break;
    }

    // Agrupar por lista a la que pertenecen
    const grouped: Record<string, TaskItem[]> = {};
    filteredTasks.forEach(task => {
      const listName = lists?.find(l => l.id === task.categoryId)?.name || 'Sin Lista';
      if (!grouped[listName]) grouped[listName] = [];
      grouped[listName].push(task);
    });
    return grouped;
  }, [currentView, tasks, lists]);

  const [showCompleted, setShowCompleted] = useState(false);

  const groupedTasks = useMemo(() => {
    if (currentView === 'TRASH') {
      return { 'Papelera': Object.values(tasks).filter(t => t.is_deleted) };
    }
    if (isSmartView) return getTasksForSmartView(showCompleted);
    if (isListView) return getTasksByList(currentView.replace('list_', ''), showCompleted);
    return getTasksByCycle(currentView, showCompleted);
  }, [currentView, isSmartView, isListView, getTasksForSmartView, getTasksByList, getTasksByCycle, tasks, showCompleted]);
    
  const smartTasks = useMemo(() => currentView === 'cycle_day' ? getSmartSortTasks() : [], [currentView, getSmartSortTasks]);

  // Calcular Resumen Financiero Total
  const totalCost = useMemo(() => {
    let sum = 0;
    Object.values(groupedTasks).flat().forEach(t => {
      if (t.isDetailed && t.price) {
        sum += t.price * (t.quantity || 1);
      }
    });
    return sum;
  }, [groupedTasks]);

  const toggleCategory = useCallback((cat: string) => {
    setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }));
  }, []);

  const getTitle = useCallback(() => {
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
    if (currentView === 'TRASH') return 'Papelera Eliminados';
    if (currentCycle) return currentCycle.name;
    if (currentList) return currentList.name;
    return 'Tareas';
  }, [isSmartView, currentView, currentCycle, currentList]);

  const handleAddSection = useCallback(async () => {
    if (!currentList) return;
    const name = await usePromptStore.getState().openPrompt("Nombre de la nueva sección:", "Ej: Compras");
    if (name) {
      addListSection({
        id: crypto.randomUUID(),
        listId: currentList.id,
        name
      });
    }
  }, [currentList, addListSection]);

  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState('');

  const startEditingSection = useCallback((e: React.MouseEvent, sectionId: string, currentName: string) => {
    e.stopPropagation();
    setEditingSectionId(sectionId);
    setEditingSectionName(currentName);
  }, []);

  const saveSectionName = useCallback((e: React.MouseEvent, sectionId: string) => {
    e.stopPropagation();
    if (editingSectionName.trim()) {
      updateListSection(sectionId, editingSectionName.trim());
    }
    setEditingSectionId(null);
  }, [editingSectionName, updateListSection]);

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
    Object.entries(groupedTasks).forEach(([categoryOrCycle, categoryTasks]) => {
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
      
      flat.push({ type: 'header', title: categoryOrCycle.replace('section_', ''), category: categoryOrCycle, color, sectionId: originalSectionId });
      if (!collapsed[categoryOrCycle]) {
        const roots = categoryTasks.filter(t => !t.parentId);
        const processNode = (task: TaskItem, depth: number) => {
          flat.push({ type: 'task', task, depth });
          const children = categoryTasks.filter(t => t.parentId === task.id);
          children.forEach(c => processNode(c, depth + 1));
        };
        roots.forEach(r => processNode(r, 0));
      }
    });

    return flat;
  }, [groupedTasks, smartTasks, currentCycle, collapsed, isListView, lists, listSections, currentList]);

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

  const renderTask = useCallback((task: TaskItem, virtualStyle: React.CSSProperties, index: number, depth: number) => (
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
  ), [completeTask, deleteTask, onOpenZenMode]);

  const CycleIcon = currentCycle ? getCycleIcon(currentCycle.icon) : null;

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
          {totalCost > 0 && (
            <div style={{ marginTop: 12, display: 'inline-block', background: 'var(--accent-glow)', color: 'var(--accent-primary)', padding: '6px 12px', borderRadius: 8, fontWeight: 600 }}>
              Total Estimado: ${totalCost.toFixed(2)}
            </div>
          )}
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {!isSmartView && currentView !== 'TRASH' && (
            <label className="switch" style={{ marginRight: 16 }} title="Mostrar Completados">
              <span style={{ marginRight: 8, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Completados</span>
              <input type="checkbox" checked={showCompleted} onChange={e => setShowCompleted(e.target.checked)} />
              <span className="slider round"></span>
            </label>
          )}
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
            const isCustomSection = data.sectionId !== undefined;
            const sectionId = data.sectionId;
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
                  if (!isCustomSection || !sectionId) return;
                  e.preventDefault();
                  setDragOverSectionId(sectionId);
                }}
                onDragLeave={() => {
                  setDragOverSectionId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverSectionId(null);
                  if (!isCustomSection || !sectionId) return;
                  
                  const draggedTaskId = e.dataTransfer.getData('text/plain');
                  if (draggedTaskId) {
                    updateTaskSection(draggedTaskId, sectionId);
                  }
                }}
              >
                <h3 
                  style={{ color: data.color, display: 'flex', alignItems: 'center', gap: 8, flex: 1, margin: 0 }}
                  onDoubleClick={(e) => {
                    if (isCustomSection && sectionId) startEditingSection(e, sectionId, data.title);
                  }}
                >
                  {data.category === 'smart' && <Sparkles size={20} />} 
                  
                  {editingSectionId === sectionId && isCustomSection && sectionId ? (
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
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: '50%', display: 'inline-flex' }}>
               <Inbox size={48} color="var(--text-tertiary)" />
            </div>
            <p>No hay tareas pendientes en esta vista.</p>
            <button className="btn-icon" onClick={onOpenNewTask} style={{ background: 'var(--accent-glow)', color: 'var(--accent-primary)', padding: '8px 16px', borderRadius: '8px' }}>
              Crear Tarea
            </button>
          </div>
        )}

      </div>

      <button className="fab" onClick={onOpenNewTask}>
        <Plus size={24} />
      </button>
    </main>
  );
}
