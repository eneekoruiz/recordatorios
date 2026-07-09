import { useState, useRef, useMemo, useCallback } from 'react';
import { Plus, ChevronDown, Sparkles, FolderPlus, Settings, Trash2 } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAppStore } from '../../store/useAppStore';
import { usePromptStore } from '../../store/usePromptStore';
import type { TaskItem } from '../../models/Task';
import { TaskCard } from '../tasks/TaskCard';
import { EmptyState } from '../ui/EmptyState';
import { ConfirmModal } from '../ui/ConfirmModal';
import { getCycleIcon } from '../../constants/icons';
import { ListConfigModal } from './ListConfigModal';
// Settings icon import removed because it was merged into single lucide-react import above

interface MainContentProps {
  currentView: string;
  onOpenNewTask: () => void;
  onOpenZenMode: (taskId: string) => void;
  onBackToSidebar?: () => void;
  isMobile?: boolean;
}

type VirtualItemType = 
  | { type: 'header', title: string, category: string, color: string, sectionId?: string, depth: number }
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
  
  const { getTasksByCycle, getTasksByList, getSmartSortTasks, toggleTask, deleteTask, cycles, updateCycle, deleteCycle, lists, addListSection, updateListSection, updateTaskSection, listSections, tasks } = useAppStore();

  const currentCycle = useMemo(() => cycles.find(c => c.id === currentView), [cycles, currentView]);
  const currentList = useMemo(() => lists?.find(l => `list_${l.id}` === currentView), [lists, currentView]);
  
  const isListView = currentView.startsWith('list_');
  const isSmartView = currentView.startsWith('smart_');

  // Estados para la edición de ciclos in-place
  const [isEditingCycle, setIsEditingCycle] = useState(false);
  const [cycleEditName, setCycleEditName] = useState('');

  // Funciones auxiliares para Smart Lists (memoized)
  const getTasksForSmartView = useCallback((includeCompleted = false) => {
    const allTasks = Object.values(tasks).filter(t => !t.deleted_at);
    const validTasks = includeCompleted ? allTasks : allTasks.filter(t => t.status === 'pending');
    let filteredTasks: TaskItem[] = [];

    switch (currentView) {
      case 'smart_today': {
        const today = new Date().toISOString().split('T')[0];
        filteredTasks = validTasks.filter(t => new Date(t.dueDate as string).toISOString().split('T')[0] === today);
        break;
      }
      case 'smart_scheduled':
        filteredTasks = validTasks.filter(t => new Date(t.dueDate as string) > new Date());
        break;
      case 'smart_all':
        filteredTasks = validTasks;
        break;
      case 'smart_flagged':
        filteredTasks = validTasks.filter(t => t.flagged);
        break;
      case 'smart_completed':
        filteredTasks = allTasks.filter(t => t.status === 'completed'); // always completed
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
      return { 'Papelera': Object.values(tasks).filter(t => t.deleted_at) };
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
    if (currentView === 'list_inbox') return 'Bandeja de entrada';
    if (currentCycle) return currentCycle.name;
    if (currentList) return currentList.name;
    return 'Tareas';
  }, [isSmartView, currentView, currentCycle, currentList]);

  const handleAddSection = useCallback(async (parentId?: string) => {
    if (!currentList) return;
    const name = await usePromptStore.getState().openPrompt("Nombre de la nueva sección:", "Ej: Compras");
    if (name) {
      addListSection({
        id: crypto.randomUUID(),
        listId: currentList.id,
        parentId,
        name
      });
    }
  }, [currentList, addListSection]);

  const [isListConfigOpen, setIsListConfigOpen] = useState(false);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmProps, setConfirmProps] = useState({ title: '', message: '', onConfirm: () => {} });
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
      let headerTitle = categoryOrCycle;
      let headerDepth = 0;

      if (!isListView) {
        const catObj = lists?.find(l => l.id === categoryOrCycle);
        if (catObj) color = catObj.color;
      } else {
        color = currentList?.color || color;
        if (categoryOrCycle.startsWith('section_')) {
          const sectionId = categoryOrCycle.replace('section_', '');
          const sec = listSections?.find(s => s.id === sectionId);
          if (sec) {
            originalSectionId = sec.id;
            headerTitle = sec.name;
            // Calculate depth
            let currentSec = sec;
            while (currentSec?.parentId) {
              headerDepth++;
              currentSec = listSections?.find(s => s.id === currentSec?.parentId);
            }
          }
        } else if (categoryOrCycle.startsWith('cycle_')) {
          const cycleId = categoryOrCycle.replace('cycle_', '');
          headerTitle = cycles.find(c => c.id === cycleId)?.name || 'Ciclo';
        }
      }
      
      flat.push({ type: 'header', title: headerTitle, category: categoryOrCycle, color, sectionId: originalSectionId, depth: headerDepth });
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
      onToggle={toggleTask}
      onDelete={deleteTask}
      onOpenZenMode={onOpenZenMode}
      index={index}
    />
  ), [toggleTask, deleteTask, onOpenZenMode]);

  const CycleIcon = currentCycle ? getCycleIcon(currentCycle.icon) : null;

  return (
    <main className="main-content" ref={parentRef} style={{ overflowY: 'auto', height: '100%', WebkitOverflowScrolling: 'touch' }}>
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
            fontSize: '2.2rem', 
            fontWeight: 750,
            color: isSmartView ? SMART_COLORS[currentView] : isListView && currentList ? currentList.color : 'var(--text-primary)',
            display: 'flex', alignItems: 'center', margin: 0
          }}>
            {CycleIcon && <CycleIcon size={32} color="var(--accent-primary)" style={{ marginRight: 12 }} />}
            
            {isEditingCycle && currentCycle ? (
              <input 
                type="text" 
                value={cycleEditName}
                onChange={e => setCycleEditName(e.target.value)}
                onBlur={() => {
                  if (cycleEditName.trim()) {
                    updateCycle(currentCycle.id, { name: cycleEditName.trim() });
                  }
                  setIsEditingCycle(false);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
                autoFocus
                style={{ background: 'transparent', border: 'none', borderBottom: '2px solid var(--accent-primary)', color: 'inherit', fontSize: 'inherit', fontFamily: 'inherit', outline: 'none', width: 'auto' }}
              />
            ) : (
              <span 
                onDoubleClick={() => {
                  if (currentCycle) {
                    setCycleEditName(currentCycle.name);
                    setIsEditingCycle(true);
                  }
                }}
                style={{ cursor: currentCycle ? 'text' : 'default' }}
                title={currentCycle ? "Doble click para editar nombre" : undefined}
              >
                {getTitle()}
              </span>
            )}
          </h1>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)', marginTop: 'var(--space-8)' }}>
            <p className="text-secondary" style={{ margin: 0 }}>
              {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            {currentCycle && !['cycle_day', 'cycle_week', 'cycle_month', 'cycle_year'].includes(currentCycle.id) && (
              <button 
                onClick={async () => {
                  setConfirmProps({ title: 'Eliminar Ciclo', message: `¿Estás seguro de eliminar el ciclo ${currentCycle.name}? Esta acción no se puede deshacer.`, onConfirm: () => deleteCycle(currentCycle.id) }); setIsConfirmOpen(true);
                }}
                className="time-pill"
                style={{ cursor: 'pointer', background: 'rgba(255, 69, 58, 0.1)', color: 'var(--accent-red)', border: 'none' }}
              >
                Eliminar Ciclo
              </button>
            )}
          </div>
          {totalCost > 0 && (
            <div style={{ marginTop: 12, display: 'inline-block', background: 'var(--accent-glow)', color: 'var(--accent-primary)', padding: '6px 12px', borderRadius: 8, fontWeight: 600 }}>
              Total Estimado: ${totalCost.toFixed(2)}
            </div>
          )}
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {!isSmartView && currentView !== 'TRASH' && (
            <div style={{ display: 'flex', alignItems: 'center', marginRight: 16, gap: 8 }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Mostrar completados</span>
              <label className="switch" title="Mostrar Completados">
                <input type="checkbox" checked={showCompleted} onChange={e => setShowCompleted(e.target.checked)} />
                <span className="slider round"></span>
              </label>
            </div>
          )}
          {isListView && currentList && (
            <button className="icon-btn" onClick={() => setIsListConfigOpen(true)} title="Configurar Lista">
              <Settings size={20} />
            </button>
          )}
          {isListView && (
            <button className="icon-btn" onClick={() => handleAddSection()} title="Añadir Sección Raíz">
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
                key={virtualItem.key}
                className="group-header"
                style={{ 
                  ...virtualStyle, 
                  borderBottom: `1px solid var(--border-subtle)`,
                  paddingLeft: `calc(12px + ${data.depth * 24}px)` // Indent sub-sections
                }}
                onClick={() => toggleCategory(data.category)}
                onDragOver={isCustomSection ? (e) => { e.preventDefault(); setDragOverSectionId(data.sectionId!); } : undefined}
                onDragLeave={isCustomSection ? () => setDragOverSectionId(null) : undefined}
                onDrop={isCustomSection ? (e) => {
                  e.preventDefault();
                  setDragOverSectionId(null);
                  const taskId = e.dataTransfer.getData('text/plain');
                  if (taskId) updateTaskSection(taskId, data.sectionId!);
                } : undefined}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ChevronDown 
                    size={20} 
                    color="var(--text-tertiary)" 
                    style={{ transform: collapsed[data.category] ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }}
                  />
                  {isCustomSection && editingSectionId === data.sectionId ? (
                    <input 
                      type="text" 
                      value={editingSectionName}
                      onChange={e => setEditingSectionName(e.target.value)}
                      onBlur={(e) => saveSectionName(e, data.sectionId!)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveSectionName(e as any, data.sectionId!);
                      }}
                      autoFocus
                      onClick={e => e.stopPropagation()}
                      style={{ background: 'transparent', border: 'none', borderBottom: `2px solid ${data.color}`, color: 'inherit', fontSize: 'inherit', fontFamily: 'inherit', outline: 'none' }}
                    />
                  ) : (
                    <h3 
                      onDoubleClick={(e) => isCustomSection && startEditingSection(e, data.sectionId!, data.title)}
                      style={{ 
                        cursor: isCustomSection ? 'text' : 'pointer',
                        textTransform: 'uppercase',
                        fontWeight: 800,
                        color: '#000',
                        fontSize: '1rem',
                        margin: 0
                      }}
                      title={isCustomSection ? "Doble click para editar" : ""}
                    >
                      {data.title}
                    </h3>
                  )}
                  {isCustomSection && (
                    <>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddSection(data.sectionId);
                          if (collapsed[data.category]) toggleCategory(data.category);
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, padding: 4 }}
                        title="Añadir Sub-sección"
                      >
                        <Plus size={16} color="var(--text-primary)" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('¿Seguro que quieres borrar esta sección? Las tareas no se borrarán, solo quedarán sin sección.')) {
                            deleteListSection(data.sectionId!);
                          }
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, padding: 4, marginLeft: 4, color: 'var(--accent-red)' }}
                        title="Eliminar Sección"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
                {isCustomSection && dragOverSectionId === data.sectionId && (
                  <span style={{ fontSize: '0.8rem', color: data.color }}>Mover aquí</span>
                )}
              </div>
            );
          } else {
            return renderTask(data.task, virtualStyle, virtualItem.index, data.depth);
          }
        })}

        {flattenedData.length === 0 && (
          <EmptyState />
        )}

      </div>

      <ListConfigModal 
        isOpen={isListConfigOpen} 
        onClose={() => setIsListConfigOpen(false)} 
        listId={currentList?.id} 
      />

      <button className="fab" onClick={onOpenNewTask}>
        <Plus size={24} />
      </button>
      <ConfirmModal
        isOpen={isConfirmOpen}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={() => { confirmProps.onConfirm(); setIsConfirmOpen(false); }}
        title={confirmProps.title}
        message={confirmProps.message}
      />
    </main>
  );
}
