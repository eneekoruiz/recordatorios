import { useState, useRef, useMemo, useCallback } from 'react';
import { Plus, ChevronDown, Sparkles, FolderPlus, Settings, Trash2, MoreHorizontal } from 'lucide-react';
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
  onEditTask?: (taskId: string) => void;
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

export function MainContent({ currentView, onOpenNewTask, onOpenZenMode, onEditTask, onBackToSidebar, isMobile }: MainContentProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  
  const { getTasksByCycle, getTasksByList, getSmartSortTasks, toggleTask, deleteTask, cycles, updateCycle, deleteCycle, lists, addListSection, updateListSection, updateTaskSection, listSections, tasks, updateList } = useAppStore();

  const currentCycle = useMemo(() => cycles.find(c => c.id === currentView), [cycles, currentView]);
  const currentList = useMemo(() => lists?.find(l => `list_${l.id}` === currentView), [lists, currentView]);
  
  const isListView = currentView.startsWith('list_');
  const isSmartView = currentView.startsWith('smart_');

  // Menu state
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Estados para la edición de ciclos in-place
  const [isEditingCycle, setIsEditingCycle] = useState(false);
  const [cycleEditName, setCycleEditName] = useState('');
  const [recentlyCompletedIds, setRecentlyCompletedIds] = useState<string[]>([]);

  // Funciones auxiliares para Smart Lists (memoized)
  const getTasksForSmartView = useCallback((includeCompleted = false, temporarilyShowIds: string[] = []) => {
    const allTasks = Object.values(tasks).filter(t => !t.deleted_at);
    const validTasks = includeCompleted 
      ? allTasks 
      : allTasks.filter(t => t.status === 'pending' || temporarilyShowIds.includes(t.id));
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

  const resolvedShowCompleted = isListView ? !!currentList?.showCompleted : false;

  const handleToggleTask = useCallback((id: string, forceReverse?: boolean) => {
    const task = tasks[id];
    if (task) {
      const willBeCompleted = task.status !== 'completed';
      if (willBeCompleted) {
        setRecentlyCompletedIds(prev => [...prev, id]);
        setTimeout(() => {
          setRecentlyCompletedIds(prev => prev.filter(x => x !== id));
        }, 3000);
      } else {
        setRecentlyCompletedIds(prev => prev.filter(x => x !== id));
      }
    }
    toggleTask(id, forceReverse);
  }, [tasks, toggleTask]);

  const groupedTasks = useMemo(() => {
    if (currentView === 'TRASH') {
      return { 'Papelera': Object.values(tasks).filter(t => t.deleted_at) };
    }
    if (isSmartView) return getTasksForSmartView(resolvedShowCompleted, recentlyCompletedIds);
    if (isListView) return getTasksByList(currentView.replace('list_', ''), resolvedShowCompleted, recentlyCompletedIds);
    return getTasksByCycle(currentView, resolvedShowCompleted, recentlyCompletedIds);
  }, [currentView, isSmartView, isListView, getTasksForSmartView, getTasksByList, getTasksByCycle, tasks, resolvedShowCompleted, recentlyCompletedIds]);
    
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
      
      if (categoryOrCycle !== 'no_section') {
        flat.push({ type: 'header', title: headerTitle, category: categoryOrCycle, color, sectionId: originalSectionId, depth: headerDepth });
      }
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
      onToggle={handleToggleTask}
      onDelete={deleteTask}
      onOpenZenMode={onOpenZenMode}
      onEdit={onEditTask || (() => {})}
      index={index}
    />
  ), [handleToggleTask, deleteTask, onOpenZenMode, onEditTask]);

  const CycleIcon = currentCycle ? getCycleIcon(currentCycle.icon) : null;

  return (
    <main className="main-content" ref={parentRef} style={{ overflowY: 'auto', height: '100%', WebkitOverflowScrolling: 'touch' }}>
      {/* Header */}
      <header className="content-header" style={{ padding: 'var(--space-16) 0 var(--space-16)', display: 'flex', flexDirection: 'column', gap: 'var(--space-12)', flexShrink: 0 }}>
        
        {/* Top Bar (Barra Superior de Navegación) */}
        <div style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Left: Volver button (only for mobile content view) */}
          {isMobile && onBackToSidebar && (
            <button 
              onClick={onBackToSidebar}
              style={{
                background: 'transparent', border: 'none', color: 'var(--accent-primary)',
                display: 'flex', alignItems: 'center', gap: 4, padding: '8px 0',
                fontSize: '1.05rem', cursor: 'pointer', fontWeight: 500
              }}
            >
              <ChevronDown size={20} style={{ transform: 'rotate(90deg)', color: 'var(--accent-primary)' }} />
              <span>Listas</span>
            </button>
          )}
          
          {/* Right: Actions aligned to the right */}
          <div className="header-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto', flexWrap: 'wrap', justifyContent: 'flex-end', position: 'relative' }}>
            {isListView && currentList && (
              <div style={{ position: 'relative' }}>
                <button className="icon-btn" onClick={() => setIsMenuOpen(!isMenuOpen)} title="Opciones de Lista">
                  <MoreHorizontal size={20} />
                </button>
                {isMenuOpen && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setIsMenuOpen(false)} />
                    <div style={{ 
                      position: 'absolute', right: 0, top: '100%', marginTop: 8, 
                      background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', 
                      borderRadius: 'var(--radius-lg)', padding: '8px 0', minWidth: 200, 
                      boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 100 
                    }}>
                      <button 
                        onClick={() => { updateList(currentList.id, { showCompleted: !currentList.showCompleted }); setIsMenuOpen(false); }}
                        style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', textAlign: 'left', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.95rem' }}
                      >
                        <input type="checkbox" checked={!!currentList.showCompleted} readOnly style={{ marginRight: 12, pointerEvents: 'none' }} />
                        Mostrar Completados
                      </button>
                      <button 
                        onClick={() => { updateList(currentList.id, { isFinancial: !currentList.isFinancial }); setIsMenuOpen(false); }}
                        style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', textAlign: 'left', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.95rem' }}
                      >
                        <input type="checkbox" checked={!!currentList.isFinancial} readOnly style={{ marginRight: 12, pointerEvents: 'none' }} />
                        Modo Financiero
                      </button>
                      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
                      <button 
                        onClick={() => { setIsListConfigOpen(true); setIsMenuOpen(false); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', textAlign: 'left', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.95rem' }}
                      >
                        <Settings size={16} />
                        Personalizar Lista
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            {isListView && (
              <button className="icon-btn" onClick={() => handleAddSection()} title="Añadir Sección Raíz">
                <FolderPlus size={20} />
              </button>
            )}
            <button className="icon-btn" onClick={onOpenNewTask} title="Añadir Tarea"><Plus size={24} /></button>
          </div>
        </div>

        {/* Línea del Título (Debajo del Top Bar) */}
        <div style={{ width: '100%' }}>
          <h1 className="text-display" style={{ 
            fontSize: '2.2rem', 
            fontWeight: 750,
            color: isSmartView ? SMART_COLORS[currentView] : isListView && currentList ? currentList.color : 'var(--text-primary)',
            display: 'flex', alignItems: 'center', margin: 0,
            padding: 0
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
