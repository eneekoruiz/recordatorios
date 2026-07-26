import { useState, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ChevronDown, Sparkles, FolderPlus, Settings, Trash2, MoreHorizontal } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useAppStore, isTaskCompleted } from '../../store/useAppStore';
import { usePromptStore } from '../../store/usePromptStore';
import type { TaskItem } from '../../models/Task';
import { TaskCard } from '../tasks/TaskCard';
import { EmptyState } from '../ui/EmptyState';
import { ConfirmModal } from '../ui/ConfirmModal';
import { getCycleIcon } from '../../constants/icons';
import { ListConfigModal } from './ListConfigModal';
import { SMART_LISTS } from '../../constants/smartLists';
// Settings icon import removed because it was merged into single lucide-react import above

interface MainContentProps {
  currentView: string;
  onOpenNewTask: (sectionId?: string) => void;
  onOpenZenMode: (taskId: string) => void;
  onEditTask?: (taskId: string) => void;
  onBackToSidebar?: () => void;
  isMobile?: boolean;
}

type VirtualItemType = 
  | { type: 'page-header' }
  | { type: 'header', title: string, category: string, color: string, sectionId?: string, depth: number }
  | { type: 'empty-section', title: string, category: string, color: string, sectionId?: string, depth: number }
  | { type: 'task', task: TaskItem, depth: number, isFirstInSection?: boolean, isLastInSection?: boolean };

const SMART_COLORS: Record<string, string> = {
  'smart_today': 'var(--accent-blue)',
  'smart_scheduled': 'var(--accent-red)',
  'smart_all': 'var(--text-secondary)',
  'smart_flagged': 'var(--accent-orange)',
  'smart_completed': 'var(--text-tertiary)',
  'smart_overdue': 'var(--accent-red)'
};

export function MainContent({ currentView, onOpenNewTask, onOpenZenMode, onEditTask, onBackToSidebar, isMobile }: MainContentProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  
  const { getTasksByCycle, getTasksByList, getSmartSortTasks, toggleTask, cycles, updateCycle, deleteCycle, lists, addListSection, updateListSection, deleteListSection, updateTaskSection, listSections, tasks, updateList, updateTask } = useAppStore();

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
  const [deletedToast, setDeletedToast] = useState<{ id: string; title: string; timeoutId: number } | null>(null);

  const handleDeleteTask = useCallback((id: string) => {
    const taskToDelete = tasks[id];
    if (!taskToDelete) return;
    
    updateTask(id, { deleted_at: new Date().toISOString() });
    
    if (deletedToast?.timeoutId) {
      window.clearTimeout(deletedToast.timeoutId);
    }
    
    const timeoutId = window.setTimeout(() => {
      setDeletedToast(null);
    }, 5000);

    setDeletedToast({ id, title: taskToDelete.title, timeoutId });
  }, [tasks, updateTask, deletedToast]);

  // Funciones auxiliares para Smart Lists (memoized)
  const getTasksForSmartView = useCallback((includeCompleted = false, temporarilyShowIds: string[] = []) => {
    const allTasks = Object.values(tasks).filter(t => !t.deleted_at);
    const validTasks = includeCompleted 
      ? allTasks 
      : allTasks.filter(t => !isTaskCompleted(t) || temporarilyShowIds.includes(t.id));
    let filteredTasks: TaskItem[] = [];

    switch (currentView) {
      case 'smart_today': {
        const today = new Date().toISOString().split('T')[0];
        filteredTasks = validTasks.filter(t => {
          if (!t.dueDate) return false;
          const d = new Date(t.dueDate);
          return !isNaN(d.getTime()) && d.toISOString().split('T')[0] === today;
        });
        break;
      }
      case 'smart_scheduled':
        filteredTasks = validTasks.filter(t => {
          if (!t.dueDate) return false;
          const d = new Date(t.dueDate);
          return !isNaN(d.getTime()) && d > new Date();
        });
        break;
      case 'smart_all':
        filteredTasks = validTasks;
        break;
      case 'smart_flagged':
        filteredTasks = validTasks.filter(t => t.flagged);
        break;
      case 'smart_completed':
        filteredTasks = allTasks.filter(t => isTaskCompleted(t)); // always completed
        break;
      case 'smart_overdue': {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        filteredTasks = validTasks.filter(t => {
          if (!t.dueDate) return false;
          const d = new Date(t.dueDate);
          d.setHours(0, 0, 0, 0);
          return !isNaN(d.getTime()) && d < today;
        });
        break;
      }
    }

    // Agrupar por lista a la que pertenecen
    const grouped: Record<string, TaskItem[]> = {};
    filteredTasks.forEach(task => {
      const catId = task.categoryId || (task as any).category_id;
      const listName = lists?.find(l => l.id === catId)?.name || 'Sin Lista';
      if (!grouped[listName]) grouped[listName] = [];
      grouped[listName].push(task);
    });
    return grouped;
  }, [currentView, tasks, lists]);

  const resolvedShowCompleted = isListView ? !!currentList?.showCompleted : false;

  const handleToggleTask = useCallback((id: string, forceReverse?: boolean) => {
    const task = tasks[id];
    if (task) {
      const willBeCompleted = !isTaskCompleted(task);
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

  const visibleTasks = useMemo(() => Object.values(groupedTasks).flat(), [groupedTasks]);
  const activeVisibleCount = useMemo(() => visibleTasks.filter(t => !isTaskCompleted(t)).length, [visibleTasks]);
  const completedVisibleCount = useMemo(() => visibleTasks.filter(t => isTaskCompleted(t)).length, [visibleTasks]);

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
        'smart_completed': 'Terminado',
        'smart_overdue': 'Retrasados'
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
  const [sectionMenuId, setSectionMenuId] = useState<string | null>(null);

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
    const flat: VirtualItemType[] = [{ type: 'page-header' }];
    
    // Up Next (Solo en el ciclo más corto, e.g. cycle_day)
    if (currentCycle && currentCycle.daysValue === 1 && smartTasks.length > 0) {
      const prioritizedTasks = smartTasks.filter(t => t.flagged || t.priority === 'high' || t.priority === 'medium');
      if (prioritizedTasks.length > 0) {
        flat.push({ type: 'header', title: 'Up Next (Priorizado)', category: 'smart', color: '#0a84ff' });
        if (!collapsed['smart']) {
          prioritizedTasks.slice(0, 2).forEach(task => flat.push({ type: 'task', task, depth: 0 }));
        }
      }
    }

    // Categorías (Si estamos en ciclo) o Ciclos (Si estamos en Lista)
    if (!isListView) {
      Object.entries(groupedTasks).forEach(([categoryOrCycle, categoryTasks]) => {
        let color = '#34c759'; // Default
        let headerTitle = categoryOrCycle;
        let headerDepth = 0;

        // In cycle view, the category key is a list id — resolve to name
        if (categoryOrCycle === 'inbox' || categoryOrCycle === 'undefined' || !categoryOrCycle) {
          headerTitle = 'Sin lista';
          color = '#8e8e93';
        } else {
          const catObj = lists?.find(l => l.id === categoryOrCycle);
          if (catObj) { headerTitle = catObj.name; color = catObj.color; }
          else { headerTitle = 'Sin lista'; color = '#8e8e93'; }
        }
        
        flat.push({ type: 'header', title: headerTitle, category: categoryOrCycle, color, depth: headerDepth });
        
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
    } else {
      // isListView
      const color = currentList?.color || '#34c759';
      
      // 1. Uncategorized (no_section)
      if (groupedTasks['no_section'] && groupedTasks['no_section'].length > 0) {
        if (!collapsed['no_section']) {
          const roots = groupedTasks['no_section'].filter(t => !t.parentId);
          const processNode = (task: TaskItem, depth: number) => {
            flat.push({ type: 'task', task, depth });
            const children = groupedTasks['no_section'].filter(t => t.parentId === task.id);
            children.forEach(c => processNode(c, depth + 1));
          };
          roots.forEach(r => processNode(r, 0));
        }
      }

      // 2. Sections Hierarchy
      const sectionsForList = (listSections || []).filter(s => s.listId === currentList?.id && !s.deleted_at);
      
      const processSection = (secId: string, depth: number) => {
        const sec = sectionsForList.find(s => s.id === secId);
        if (!sec) return;
        
        const categoryKey = `section_${sec.id}`;
        flat.push({ type: 'header', title: sec.name, category: categoryKey, color, sectionId: sec.id, depth });
        
        if (!collapsed[categoryKey]) {
          const categoryTasks = groupedTasks[categoryKey] || [];
          if (categoryTasks.length === 0) {
            flat.push({ type: 'empty-section', title: 'Aquí no hay tareas', category: categoryKey, color, sectionId: sec.id, depth });
          } else {
            const roots = categoryTasks.filter(t => !t.parentId);
            const processNode = (task: TaskItem, depthLevel: number) => {
              flat.push({ type: 'task', task, depth: depthLevel });
              const children = categoryTasks.filter(t => t.parentId === task.id);
              children.forEach(c => processNode(c, depthLevel + 1));
            };
            roots.forEach(r => processNode(r, depth));
          }
          
          // Children sections
          const childSections = sectionsForList.filter(s => s.parentId === sec.id);
          childSections.forEach(child => processSection(child.id, depth + 1));
        }
      };

      // Start with root sections
      const rootSections = sectionsForList.filter(s => !s.parentId);
      rootSections.forEach(rs => processSection(rs.id, 0));
    }

    // Identify first and last tasks in sections for Apple-style rounding
    for (let i = 0; i < flat.length; i++) {
      if (flat[i].type === 'task') {
        flat[i].isFirstInSection = (i === 0 || flat[i - 1].type !== 'task');
        flat[i].isLastInSection = (i === flat.length - 1 || flat[i + 1].type !== 'task');
      }
    }

    return flat;
  }, [groupedTasks, smartTasks, currentCycle, collapsed, isListView, lists, listSections, currentList]);

  // 2. React Virtualizer
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: flattenedData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const item = flattenedData[index];
      if (item.type === 'page-header') return 160;
      if (item.type === 'header') return 48; // Increased for Apple-style top margin / spacing
      if (item.type === 'empty-section') return 44;
      return 52; // task cards height in Apple style (compact)
    },
    measureElement: (el) => el.getBoundingClientRect().height,
    overscan: 8,
  });

  const renderTask = useCallback((task: TaskItem, virtualStyle: React.CSSProperties, index: number, depth: number, isFirst: boolean, isLast: boolean, previousTaskId?: string) => (
    <div
      key={task.id}
      ref={virtualizer.measureElement}
      data-index={index}
      style={virtualStyle}
    >
      <TaskCard 
        task={task}
        virtualStyle={{ paddingLeft: `calc(16px + ${depth * 24}px)` }}
        onToggle={handleToggleTask}
        onDelete={handleDeleteTask}
        onOpenZenMode={onOpenZenMode}
        onEdit={onEditTask || (() => {})}
        index={index}
        showListName={!isListView}
        isFirstInSection={isFirst}
        isLastInSection={isLast}
        previousTaskId={previousTaskId}
      />
    </div>
  ), [handleToggleTask, handleDeleteTask, onOpenZenMode, onEditTask, isListView, virtualizer]);

  const CycleIcon = currentCycle ? getCycleIcon(currentCycle.icon) : null;
  const smartListInfo = isSmartView ? SMART_LISTS.find(l => l.id === currentView) : null;
  const SmartIcon = smartListInfo ? smartListInfo.icon : null;

  return (
    <main className="main-content" style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
      {/* Sticky Glass Top Bar */}
      <header className="glass-header" style={{ position: 'sticky', top: 0, padding: '12px 16px', display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', zIndex: 100 }}>
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
        
        {/* Dynamic List Title on Top Bar (visible when scrolled or always for style) */}
        <div style={{ flex: 1, textAlign: 'center', fontWeight: 600, fontSize: '1rem', color: isSmartView ? SMART_COLORS[currentView] : currentList ? currentList.color : 'var(--text-primary)' }}>
          {/* We could add scroll opacity logic here, but for now it's just the title if mobile */}
        </div>

        {/* Right: Actions aligned to the right */}
        <div className="header-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center', marginLeft: 'auto', flexWrap: 'wrap', justifyContent: 'flex-end', position: 'relative' }}>
          {isListView && currentList && (
            <div style={{ position: 'relative' }}>
              <button className="icon-btn" onClick={() => setIsMenuOpen(!isMenuOpen)} title="Opciones de Lista">
                <MoreHorizontal size={20} color="var(--accent-primary)" />
              </button>
              <AnimatePresence>
                {isMenuOpen && (
                  <>
                    <motion.div 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.15)' }} 
                      onClick={() => setIsMenuOpen(false)} 
                    />
                    <motion.div 
                      className="ios-dropdown-menu glass-panel"
                      initial={{ opacity: 0, scale: 0.92, y: -6, transformOrigin: 'top right' }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.92, y: -6 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      style={{ 
                        position: 'absolute', right: 0, top: '100%', marginTop: 10, 
                        zIndex: 100 
                      }}
                    >
                      <button 
                        className="ios-dropdown-item"
                        onClick={() => { updateList(currentList.id, { showCompleted: !currentList.showCompleted }); setIsMenuOpen(false); }}
                      >
                        <input type="checkbox" checked={!!currentList.showCompleted} readOnly style={{ marginRight: 12, pointerEvents: 'none', accentColor: 'var(--accent-primary)' }} />
                        Mostrar Completados
                      </button>
                      <button 
                        className="ios-dropdown-item"
                        onClick={() => { updateList(currentList.id, { isFinancial: !currentList.isFinancial }); setIsMenuOpen(false); }}
                      >
                        <input type="checkbox" checked={!!currentList.isFinancial} readOnly style={{ marginRight: 12, pointerEvents: 'none', accentColor: 'var(--accent-primary)' }} />
                        Modo Financiero
                      </button>
                      <div className="ios-dropdown-divider" style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
                      <button 
                        className="ios-dropdown-item"
                        onClick={() => { setIsListConfigOpen(true); setIsMenuOpen(false); }}
                      >
                        <Settings size={16} />
                        Personalizar Lista
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}
          {isListView && (
            <button className="icon-btn" onClick={() => handleAddSection()} title="Añadir Sección Raíz">
              <FolderPlus size={20} color="var(--accent-primary)" />
            </button>
          )}
          <button className="icon-btn" onClick={() => onOpenNewTask()} title="Añadir Tarea"><Plus size={22} color="var(--accent-primary)" /></button>
        </div>
      </header>

      {/* Contenedor de Scroll Dedicado para Virtualizer */}
      <div 
        ref={parentRef}
        style={{ 
          flex: 1,
          position: 'relative', 
          overflowY: 'auto', 
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 'max(120px, calc(env(safe-area-inset-bottom) + 100px))'
        }}
      >
        <div className="tasks-container" style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative', background: 'var(--bg-elevated)' }}>
          
          {virtualizer.getVirtualItems().map((virtualItem) => {
          const data = flattenedData[virtualItem.index];
          
          const virtualStyle: React.CSSProperties = {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${virtualItem.start}px)`,
            zIndex: data.type === 'section' || data.type === 'header' ? 10 : 1,
          };

          if (data.type === 'page-header') {
            return (
              <div key="page-header" ref={virtualizer.measureElement} data-index={virtualItem.index} style={{...virtualStyle, zIndex: 20}}>
                <header className="content-header" style={{ padding: '0px 16px 20px 16px', display: 'flex', flexDirection: 'column', gap: '16px', flexShrink: 0, margin: '0', borderBottom: 'none' }}>
        {/* Línea del Título (Debajo del Top Bar) */}
        <div style={{ width: '100%' }}>
          <h1 className="text-display" style={{ 
            fontSize: '34px', 
            fontWeight: 700,
            letterSpacing: '-0.5px',
            color: isSmartView ? SMART_COLORS[currentView] : isListView && currentList ? currentList.color : 'var(--text-primary)',
            display: 'flex', alignItems: 'center', margin: 0,
            padding: 0
          }}>
            {CycleIcon && <CycleIcon size={32} color="var(--accent-primary)" style={{ marginRight: 12 }} />}
            {SmartIcon && smartListInfo && (
              <div style={{
                marginRight: 12,
                width: 38, height: 38, borderRadius: '50%',
                backgroundColor: smartListInfo.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 4px 12px ${smartListInfo.color}40`
              }}>
                <SmartIcon size={22} color="white" />
              </div>
            )}
            
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

          {currentCycle && !['cycle_day', 'cycle_week', 'cycle_month', 'cycle_year'].includes(currentCycle.id) && (
            <div style={{ marginTop: 'var(--space-8)' }}>
              <button 
                onClick={async () => {
                  setConfirmProps({ title: 'Eliminar Ciclo', message: `¿Estás seguro de eliminar el ciclo ${currentCycle.name}? Esta acción no se puede deshacer.`, onConfirm: () => deleteCycle(currentCycle.id) }); setIsConfirmOpen(true);
                }}
                className="time-pill"
                style={{ cursor: 'pointer', background: 'rgba(255, 69, 58, 0.1)', color: 'var(--accent-red)', border: 'none' }}
              >
                Eliminar Ciclo
              </button>
            </div>
          )}

          {(() => {
            if (currentCycle) {
              return (
                <div className="content-stats" style={{ marginTop: 'var(--space-8)' }}>
                  <span className="stat-chip"><strong>{activeVisibleCount}</strong> pendientes</span>
                  <span className="stat-chip"><strong>{completedVisibleCount}</strong> completadas</span>
                  <span className="stat-chip"><strong>{visibleTasks.length}</strong> visibles</span>
                </div>
              );
            }
            return null;
          })()}

          {totalCost > 0 && (
            <div style={{ marginTop: 12, display: 'inline-block', background: 'var(--accent-glow)', color: 'var(--accent-primary)', padding: '6px 12px', borderRadius: 999, fontWeight: 700, border: '1px solid rgba(37,99,235,0.12)' }}>
              Total Estimado: ${totalCost.toFixed(2)}
            </div>
          )}
        </div>
      </header>
              </div>
            );
          } else if (data.type === 'header') {
            const isCustomSection = data.sectionId !== undefined;
            const sectionId = data.sectionId;
            const isDraggingOver = dragOverSectionId === sectionId && isCustomSection;

            return (
              <div 
                key={virtualItem.key}
                ref={virtualizer.measureElement}
                data-index={virtualItem.index}
                className="group-header"
                style={{ 
                  ...virtualStyle, 
                  borderBottom: 'none',
                  paddingLeft: `calc(16px + ${data.depth * 24}px)`,
                  minHeight: 48,
                  paddingTop: 8,
                  paddingBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  outline: isDraggingOver ? `2px solid ${data.color}` : undefined,
                  background: isDraggingOver ? `${data.color}14` : 'var(--bg-elevated)', // Blend with tasks
                  zIndex: sectionMenuId === data.sectionId ? 50 : 10 // ALWAYS above tasks (zIndex 1)
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
                        fontWeight: 700,
                        color: data.color || 'var(--accent-primary)',
                        fontSize: '1.25rem',
                        letterSpacing: '-0.3px',
                        margin: 0
                      }}
                      title={isCustomSection ? "Doble click para editar" : ""}
                    >
                      {data.title}
                    </h3>
                  )}
                  {isCustomSection && (
                    <div style={{ position: 'relative' }}>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSectionMenuId(sectionMenuId === data.sectionId ? null : data.sectionId!);
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, padding: 4 }}
                        title="Opciones de sección"
                      >
                        <MoreHorizontal size={16} color="var(--text-primary)" />
                      </button>
                      
                      {sectionMenuId === data.sectionId && (
                        <>
                          <div 
                            style={{ position: 'fixed', inset: 0, zIndex: 90 }} 
                            onClick={(e) => { e.stopPropagation(); setSectionMenuId(null); }}
                          />
                          <div 
                            className="ios-dropdown-menu"
                            style={{ 
                              position: 'absolute', 
                              left: '0', 
                              top: '100%', 
                              marginTop: '8px',
                              zIndex: 100
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              className="ios-dropdown-item"
                              onClick={() => {
                                setSectionMenuId(null);
                                onOpenNewTask(data.sectionId);
                              }}
                            >
                              <Plus size={16} /> Añadir tarea
                            </button>
                            <button
                              className="ios-dropdown-item"
                              onClick={() => {
                                setSectionMenuId(null);
                                handleAddSection(data.sectionId);
                                if (collapsed[data.category]) toggleCategory(data.category);
                              }}
                            >
                              <FolderPlus size={16} /> Añadir sub-sección
                            </button>
                            <div className="ios-dropdown-divider" />
                            <button
                              className="ios-dropdown-item danger"
                              onClick={() => {
                                setSectionMenuId(null);
                                if (confirm('¿Seguro que quieres borrar esta sección? Las tareas no se borrarán, solo quedarán sin sección.')) {
                                  deleteListSection(data.sectionId!);
                                }
                              }}
                            >
                              <Trash2 size={16} /> Eliminar sección
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {isCustomSection && dragOverSectionId === data.sectionId && (
                  <span style={{ fontSize: '0.8rem', color: data.color }}>Mover aquí</span>
                )}
              </div>
            );
          } else if (data.type === 'empty-section') {
            return (
              <div 
                key={virtualItem.key}
                ref={virtualizer.measureElement}
                data-index={virtualItem.index}
                style={{ 
                  ...virtualStyle, 
                  paddingLeft: `calc(16px + ${data.depth * 24}px)`,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <button 
                  onClick={() => {
                    onOpenNewTask(data.sectionId);
                  }}
                  className="empty-section-btn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: 'transparent',
                    border: '1px dashed var(--border-subtle)',
                    color: 'var(--text-tertiary)',
                    borderRadius: 8,
                    padding: '8px 16px',
                    cursor: 'pointer',
                    width: '100%',
                    maxWidth: 300,
                    fontSize: '0.9rem',
                  }}
                >
                  <Plus size={16} />
                  {data.title}
                </button>
              </div>
            );
          } else {
            let prevId;
            if (virtualItem.index > 0) {
              const prevData = flattenedData[virtualItem.index - 1];
              if (prevData.type === 'task') {
                prevId = prevData.task.id;
              }
            }
            return renderTask(data.task, virtualStyle, virtualItem.index, data.depth, !!data.isFirstInSection, !!data.isLastInSection, prevId);
          }
        })}

      </div>
      </div>

      {flattenedData.length === 0 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <EmptyState />
        </div>
      )}

      <ListConfigModal 
        isOpen={isListConfigOpen} 
        onClose={() => setIsListConfigOpen(false)} 
        listId={currentList?.id} 
      />

      <button className="fab" onClick={() => onOpenNewTask()} title="Añadir Tarea">
        <Plus size={24} />
      </button>
      <ConfirmModal
        isOpen={isConfirmOpen}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={() => { confirmProps.onConfirm(); setIsConfirmOpen(false); }}
        title={confirmProps.title}
        message={confirmProps.message}
      />

      {deletedToast && createPortal(
        <AnimatePresence>
          <motion.div
            className="premium-toast"
            style={{
              position: 'fixed',
              bottom: 'max(28px, env(safe-area-inset-bottom))',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--bg-elevated, #1c1c1e)',
              backdropFilter: 'blur(35px) saturate(200%)',
              WebkitBackdropFilter: 'blur(35px) saturate(200%)',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.15))',
              borderRadius: '16px',
              padding: '12px 20px',
              boxShadow: '0 12px 36px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              zIndex: 999999,
              pointerEvents: 'auto',
              minWidth: '280px',
              maxWidth: '90vw',
              justifyContent: 'space-between'
            }}
            initial={{ opacity: 0, y: 24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 450, damping: 28 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
              <Trash2 size={18} color="var(--accent-red)" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Eliminado "{deletedToast.title}"
              </span>
            </div>
            <button
              onClick={() => {
                if (deletedToast.timeoutId) window.clearTimeout(deletedToast.timeoutId);
                updateTask(deletedToast.id, { deleted_at: undefined });
                setDeletedToast(null);
              }}
              style={{
                background: 'var(--accent-primary)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '999px',
                padding: '6px 14px',
                fontSize: '0.9rem',
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(10, 132, 255, 0.3)',
                transition: 'transform 0.15s ease'
              }}
              onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.93)'; }}
              onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              Deshacer
            </button>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </main>
  );
}
