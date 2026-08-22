import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ChevronDown, ChevronLeft, FolderPlus, Settings, Trash2, MoreHorizontal, Edit3, X } from 'lucide-react';
import { useAppStore, isTaskCompleted } from '../../store/useAppStore';
import { usePromptStore } from '../../store/usePromptStore';
import type { TaskItem } from '../../models/Task';
import { TaskCard } from '../tasks/TaskCard';
import { EmptyState } from '../ui/EmptyState';
import { ConfirmModal } from '../ui/ConfirmModal';
import { getCycleIcon } from '../../constants/icons';
import { ListConfigModal } from './ListConfigModal';
import { SMART_LISTS } from '../../constants/smartLists';
import { QuickAddBar } from '../ui/QuickAddBar';
import { OnboardingGuideCard } from '../ui/OnboardingGuideCard';
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
  | { type: 'page-header', isFirstInSection?: boolean, isLastInSection?: boolean, depth?: number }
  | { type: 'header', title: string, category: string, color: string, sectionId?: string, depth: number, isFirstInSection?: boolean, isLastInSection?: boolean }
  | { type: 'empty-section', title: string, category: string, color: string, sectionId?: string, depth: number, isFirstInSection?: boolean, isLastInSection?: boolean }
  | { type: 'task', task: TaskItem, depth: number, isFirstInSection?: boolean, isLastInSection?: boolean };

const NOOP = () => {};

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
  const [sectionMenu, setSectionMenu] = useState<{ open: boolean; x: number; y: number; sectionId?: string; sectionName?: string }>({ open: false, x: 0, y: 0 });
  const sectionTouchTimer = useRef<any>(null);
  
  const getTasksByCycle = useAppStore((state) => state.getTasksByCycle);
  const getTasksByList = useAppStore((state) => state.getTasksByList);
  const getSmartSortTasks = useAppStore((state) => state.getSmartSortTasks);
  const toggleTask = useAppStore((state) => state.toggleTask);
  const cycles = useAppStore((state) => state.cycles);
  const updateCycle = useAppStore((state) => state.updateCycle);
  const deleteCycle = useAppStore((state) => state.deleteCycle);
  const lists = useAppStore((state) => state.lists);
  const addListSection = useAppStore((state) => state.addListSection);
  const updateListSection = useAppStore((state) => state.updateListSection);
  const deleteListSection = useAppStore((state) => state.deleteListSection);
  const updateTaskSection = useAppStore((state) => state.updateTaskSection);
  const listSections = useAppStore((state) => state.listSections);
  const tasks = useAppStore((state) => state.tasks);
  const updateList = useAppStore((state) => state.updateList);
  const updateTask = useAppStore((state) => state.updateTask);

  const [isScrolled, setIsScrolled] = useState(false);

  const currentCycle = useMemo(() => cycles.find(c => c.id === currentView), [cycles, currentView]);
  const currentList = useMemo(() => lists?.find(l => `list_${l.id}` === currentView), [lists, currentView]);
  
  const isListView = currentView.startsWith('list_');
  const isSmartView = currentView.startsWith('smart_');

  const emptyStateProps = useMemo(() => {
    const handleNewTask = () => {
      onOpenNewTask(currentView.startsWith('list_') ? currentView.replace('list_', '') : undefined);
    };

    switch (currentView) {
      case 'smart_today':
        return {
          title: "Todo al día para hoy",
          subtitle: "No tienes tareas programadas para el día de hoy. Disfruta tu tiempo o añade algo nuevo.",
          iconName: "today",
          ctaText: "Añadir tarea para hoy",
          onAction: handleNewTask
        };
      case 'smart_scheduled':
        return {
          title: "Sin tareas programadas",
          subtitle: "Planifica tus próximos días añadiendo tareas con fecha límite.",
          iconName: "scheduled",
          ctaText: "Programar tarea",
          onAction: handleNewTask
        };
      case 'smart_all':
        return {
          title: "No hay tareas en absoluto",
          subtitle: "Tienes todo bajo control. Relájate o añade un nuevo recordatorio.",
          iconName: "sparkles",
          ctaText: "Nueva tarea",
          onAction: handleNewTask
        };
      case 'smart_flagged':
        return {
          title: "Sin tareas destacadas",
          subtitle: "Marca tareas importantes con una bandera para tenerlas siempre a la mano.",
          iconName: "flagged",
          ctaText: "Añadir tarea destacada",
          onAction: handleNewTask
        };
      case 'smart_completed':
        return {
          title: "Sin tareas completadas",
          subtitle: "A medida que vayas marcando tareas como terminadas, se guardarán aquí.",
          iconName: "completed",
          ctaText: undefined,
          onAction: undefined
        };
      case 'smart_overdue':
        return {
          title: "¡Todo al día!",
          subtitle: "Excelente trabajo, no tienes ninguna tarea atrasada o vencida.",
          iconName: "overdue",
          ctaText: undefined,
          onAction: undefined
        };
      case 'list_inbox':
        return {
          title: "Bandeja de entrada vacía",
          subtitle: "Todos tus pendientes rápidos están procesados. ¡Gran productividad!",
          iconName: "inbox",
          ctaText: "Añadir a bandeja",
          onAction: () => onOpenNewTask('inbox')
        };
      case 'TRASH':
        return {
          title: "La papelera está vacía",
          subtitle: "Cuando elimines tareas o listas, aparecerán aquí antes de borrarse permanentemente.",
          iconName: "trash",
          ctaText: undefined,
          onAction: undefined
        };
      case 'cycle_day':
        return {
          title: "Día libre de ciclos",
          subtitle: "No hay tareas activas para tu ciclo diario actual.",
          iconName: "clock",
          ctaText: "Crear tarea diaria",
          onAction: handleNewTask
        };
      case 'cycle_week':
        return {
          title: "Semana despejada",
          subtitle: "No hay tareas asignadas para tu ciclo semanal actual.",
          iconName: "clock",
          ctaText: "Crear tarea semanal",
          onAction: handleNewTask
        };
      case 'cycle_month':
      case 'cycle_year':
        return {
          title: "Ciclo temporal despejado",
          subtitle: "No tienes objetivos o recordatorios para este ciclo temporal.",
          iconName: "clock",
          ctaText: "Añadir a ciclo",
          onAction: handleNewTask
        };
      default:
        return {
          title: `Sin tareas en "${currentList?.name || (currentCycle ? currentCycle.name : 'la lista')}"`,
          subtitle: "Esta lista está vacía en este momento. Empieza añadiendo tu primer ítem.",
          iconName: "list",
          ctaText: "Añadir tarea",
          onAction: handleNewTask
        };
    }
  }, [currentView, currentList, currentCycle, onOpenNewTask]);

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
    
  const smartTasks = useMemo(() => currentView === 'cycle_day' ? getSmartSortTasks() : [], [currentView, getSmartSortTasks, tasks]);

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

  const isCatCollapsed = useCallback((cat: string) => {
    return !!collapsed[cat];
  }, [collapsed]);

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

  useEffect(() => {
    if (!sectionMenu.open && !sectionMenuId) return;
    const handleScroll = (e: Event) => {
      if (e.target instanceof HTMLElement && e.target.closest('.ios-dropdown-menu')) return;
      setSectionMenu({ open: false, x: 0, y: 0 });
      setSectionMenuId(null);
    };
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [sectionMenu.open, sectionMenuId]);

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

  const handleRenameSectionMenu = useCallback(async () => {
    const secId = sectionMenu.sectionId;
    const secName = sectionMenu.sectionName || '';
    setSectionMenu({ open: false, x: 0, y: 0 });
    if (secId) {
      setEditingSectionId(secId);
      setEditingSectionName(secName);
    } else {
      const newName = await usePromptStore.getState().openPrompt("Renombrar:", secName);
      if (newName && newName.trim()) {
        const listToUpdate = lists?.find(l => l.name === secName);
        if (listToUpdate) updateList(listToUpdate.id, { name: newName.trim() });
      }
    }
  }, [sectionMenu, lists, updateList]);

  const handleAddTaskMenu = useCallback(() => {
    const secId = sectionMenu.sectionId;
    setSectionMenu({ open: false, x: 0, y: 0 });
    onOpenNewTask(secId);
  }, [sectionMenu, onOpenNewTask]);

  const handleDeleteSectionMenu = useCallback(() => {
    const secId = sectionMenu.sectionId;
    setSectionMenu({ open: false, x: 0, y: 0 });
    if (secId) {
      setConfirmProps({
        title: 'Eliminar Sección',
        message: '¿Seguro que quieres borrar esta sección? Las tareas no se borrarán, solo quedarán sin sección.',
        onConfirm: () => deleteListSection(secId)
      });
      setIsConfirmOpen(true);
    }
  }, [sectionMenu, deleteListSection]);

  // 1. Flatten Data para Virtualización (QA Performance Optimization)
  const flattenedData = useMemo(() => {
    const flat: VirtualItemType[] = [{ type: 'page-header' }];
    
    // Up Next (Solo en el ciclo más corto, e.g. cycle_day)
    if (currentCycle && currentCycle.daysValue === 1 && smartTasks.length > 0) {
      const prioritizedTasks = smartTasks.filter(t => t.flagged || t.priority === 'high' || t.priority === 'medium');
      if (prioritizedTasks.length > 0) {
        flat.push({ type: 'header', title: 'Up Next (Priorizado)', category: 'smart', color: '#0a84ff', depth: 0 });
        if (!collapsed['smart']) {
          prioritizedTasks.slice(0, 2).forEach(task => flat.push({ type: 'task', task, depth: 0 }));
        }
      }
    }

    // Categorías (Si estamos en ciclo) o Ciclos (Si estamos en Lista)
    if (currentView === 'TRASH') {
      const trashTasks = (groupedTasks['Papelera'] || []).sort((a, b) => {
        const dA = a.deleted_at ? new Date(a.deleted_at).getTime() : 0;
        const dB = b.deleted_at ? new Date(b.deleted_at).getTime() : 0;
        return dB - dA; // Más recientemente borrados primero
      });
      trashTasks.forEach((task) => {
        flat.push({ type: 'task', task, depth: 0 });
      });
    } else if (!isListView) {
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
          const renderSectionTreeForTasks = (tasksInScope: TaskItem[], listId: string, baseDepth: number, parentColor: string) => {
            const sectionsForList = (listSections || []).filter(s => s.listId === listId && !s.deleted_at);
            const tasksBySectionId = new Set(tasksInScope.map(t => t.id));

            // 1. Uncategorized tasks in scope
            const uncategorized = tasksInScope.filter(t => !t.sectionId || !sectionsForList.some(s => s.id === t.sectionId));
            if (uncategorized.length > 0) {
              const roots = uncategorized.filter(t => !t.parentId || !tasksBySectionId.has(t.parentId));
              const processNode = (task: TaskItem, d: number) => {
                flat.push({ type: 'task', task, depth: d });
                if (!isCatCollapsed(`task_${task.id}`)) {
                  const children = uncategorized.filter(t => t.parentId === task.id);
                  children.forEach(c => processNode(c, d + 1));
                }
              };
              roots.forEach(r => processNode(r, baseDepth));
            }

            // 2. Section hierarchy for tasks in scope
            const processSection = (secId: string, d: number) => {
              const sec = sectionsForList.find(s => s.id === secId);
              if (!sec) return;

              const secTasks = tasksInScope.filter(t => t.sectionId === sec.id);
              const hasTasksRecursively = (sId: string): boolean => {
                if (tasksInScope.some(t => t.sectionId === sId)) return true;
                return sectionsForList.filter(s => s.parentId === sId).some(child => hasTasksRecursively(child.id));
              };

              if (!hasTasksRecursively(sec.id)) return;

              const categoryKey = `section_${sec.id}`;
              flat.push({ type: 'header', title: sec.name, category: categoryKey, color: (sec as any).color || parentColor, sectionId: sec.id, depth: d });

              if (!isCatCollapsed(categoryKey)) {
                if (secTasks.length > 0) {
                  const roots = secTasks.filter(t => !t.parentId || !tasksBySectionId.has(t.parentId));
                  const processNode = (task: TaskItem, dLevel: number) => {
                    flat.push({ type: 'task', task, depth: dLevel });
                    if (!isCatCollapsed(`task_${task.id}`)) {
                      const children = secTasks.filter(t => t.parentId === task.id);
                      children.forEach(c => processNode(c, dLevel + 1));
                    }
                  };
                  roots.forEach(r => processNode(r, d));
                }

                const childSections = sectionsForList.filter(s => s.parentId === sec.id);
                childSections.forEach(child => processSection(child.id, d + 1));
              }
            };

            const rootSections = sectionsForList.filter(s => !s.parentId);
            rootSections.forEach(sec => processSection(sec.id, baseDepth));
          };

          const presentCycleIds = Array.from(new Set(categoryTasks.map(t => t.cycle_id).filter(Boolean))) as string[];
          if (presentCycleIds.length > 1) {
            const sortedCycleIds = presentCycleIds.sort((a, b) => {
              const cA = useAppStore.getState().cycles.find(c => c.id === a)?.daysValue || 0;
              const cB = useAppStore.getState().cycles.find(c => c.id === b)?.daysValue || 0;
              return cA - cB;
            });

            sortedCycleIds.forEach(cId => {
              const cObj = useAppStore.getState().cycles.find(c => c.id === cId);
              const cName = cObj ? cObj.name : cId;
              const cycleSepKey = `cycle_sep_${categoryOrCycle}_${cId}`;
              flat.push({ type: 'header', title: `⏳ ${cName}`, category: cycleSepKey, color: '#0a84ff', depth: 1 });

              if (!collapsed[cycleSepKey]) {
                const cTasks = categoryTasks.filter(t => t.cycle_id === cId);
                renderSectionTreeForTasks(cTasks, categoryOrCycle, 2, color);
              }
            });
          } else {
            renderSectionTreeForTasks(categoryTasks, categoryOrCycle, 0, color);
          }
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
            if (!isCatCollapsed(`task_${task.id}`)) {
              const children = groupedTasks['no_section'].filter(t => t.parentId === task.id);
              children.forEach(c => processNode(c, depth + 1));
            }
          };
          roots.forEach(r => processNode(r, 0));
        }
      }

      // 2. Dynamic Cycle Sections (Recurrencia Diaria, Semanal, Mensual, Anual)
      const allCycles = useAppStore.getState().cycles || [];
      const presentCycleKeys = Object.keys(groupedTasks).filter(k => k.startsWith('cycle_') && groupedTasks[k].length > 0);
      
      if (presentCycleKeys.length > 0) {
        const sortedCycles = presentCycleKeys.sort((a, b) => {
          const idA = a.replace('cycle_', '');
          const idB = b.replace('cycle_', '');
          const cA = allCycles.find(c => c.id === idA)?.daysValue || 0;
          const cB = allCycles.find(c => c.id === idB)?.daysValue || 0;
          return cA - cB;
        });

        sortedCycles.forEach(catKey => {
          const cId = catKey.replace('cycle_', '');
          const cObj = allCycles.find(c => c.id === cId);
          const cName = cObj ? cObj.name : cId;
          
          flat.push({ type: 'header', title: `⏳ ${cName}`, category: catKey, color, depth: 0 });
          if (!isCatCollapsed(catKey)) {
            const categoryTasks = groupedTasks[catKey] || [];
            const roots = categoryTasks.filter(t => !t.parentId);
            const processNode = (task: TaskItem, depthLevel: number) => {
              flat.push({ type: 'task', task, depth: depthLevel });
              if (!isCatCollapsed(`task_${task.id}`)) {
                const children = categoryTasks.filter(t => t.parentId === task.id);
                children.forEach(c => processNode(c, depthLevel + 1));
              }
            };
            roots.forEach(r => processNode(r, 0));
          }
        });
      }

      // 3. Sections Hierarchy (Secciones Manuales)
      const sectionsForList = (listSections || []).filter(s => s.listId === currentList?.id && !s.deleted_at);
      
      const processSection = (secId: string, depth: number) => {
        const sec = sectionsForList.find(s => s.id === secId);
        if (!sec) return;
        
        const categoryKey = `section_${sec.id}`;
        const categoryTasks = groupedTasks[categoryKey] || [];

        // Evitar duplicar secciones vacías manuales si ya se muestra una sección dinámica con un ciclo equivalente
        const isDuplicateEmpty = categoryTasks.length === 0 && presentCycleKeys.some(k => {
          const cName = allCycles.find(c => c.id === k.replace('cycle_', ''))?.name || '';
          return sec.name.toLowerCase().includes(cName.toLowerCase()) || cName.toLowerCase().includes(sec.name.toLowerCase());
        });
        if (isDuplicateEmpty) return;

        flat.push({ type: 'header', title: sec.name, category: categoryKey, color, sectionId: sec.id, depth });
        
        if (!isCatCollapsed(categoryKey)) {
          if (categoryTasks.length === 0) {
            flat.push({ type: 'empty-section', title: 'Aquí no hay tareas', category: categoryKey, color, sectionId: sec.id, depth });
          } else {
            const roots = categoryTasks.filter(t => !t.parentId);
            const processNode = (task: TaskItem, depthLevel: number) => {
              flat.push({ type: 'task', task, depth: depthLevel });
              if (!isCatCollapsed(`task_${task.id}`)) {
                const children = categoryTasks.filter(t => t.parentId === task.id);
                children.forEach(c => processNode(c, depthLevel + 1));
              }
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
  }, [groupedTasks, smartTasks, currentCycle, collapsed, isListView, lists, listSections, currentList, isCatCollapsed]);

  // 2. Scroll Container & Item Keys (Refactored to native fluid block layout for zero-overlap & perfect touch scroll)
  const parentRef = useRef<HTMLDivElement>(null);

  // Reset scroll position to top instantly whenever navigating to a different view or list
  useEffect(() => {
    if (parentRef.current) {
      parentRef.current.scrollTo({ top: 0, behavior: 'instant' as any });
    }
  }, [currentView]);

  const getItemKey = useCallback((item: VirtualItemType, index: number) => {
    if (!item) return index;
    if (item.type === 'page-header') return 'page-header';
    if (item.type === 'header') return `header-${item.category || ''}-${item.sectionId || ''}-${item.title || ''}-${index}`;
    if (item.type === 'empty-section') return `empty-${item.category || ''}-${item.sectionId || ''}-${index}`;
    if (item.type === 'task') return `task-${item.task.id}`;
    return index;
  }, []);

  const renderTask = useCallback((task: TaskItem, itemStyle: React.CSSProperties, index: number, depth: number, isFirst: boolean, isLast: boolean, previousTaskId?: string, itemKey?: React.Key) => {
    const hasChildren = Object.values(tasks).some(t => t.parentId === task.id && !t.deleted_at);
    const isExpanded = !isCatCollapsed(`task_${task.id}`);

    return (
      <div
        key={itemKey ?? `task-${task.id}`}
        data-index={index}
        style={{ ...itemStyle, margin: 0, padding: '0 16px', boxSizing: 'border-box' }}
      >
        <div style={{ position: 'relative', width: '100%', boxSizing: 'border-box' }}>
          {depth > 0 && (
            <div style={{
              position: 'absolute', left: 8 + (depth-1)*24, top: 0, bottom: 0, width: 2,
              background: 'var(--accent-primary)', opacity: Math.max(0.2, 1 - depth*0.2), zIndex: 1
            }} />
          )}

          <TaskCard 
            task={task}
            virtualStyle={{ margin: 0, padding: '0 16px', boxSizing: 'border-box' }}
            indent={depth * 24}
            onToggle={handleToggleTask}
            onDelete={handleDeleteTask}
            onOpenZenMode={onOpenZenMode}
            onEdit={onEditTask || NOOP}
            index={index}
            showListName={isSmartView || currentView === 'cycles'}
            isFirstInSection={isFirst}
            isLastInSection={isLast}
            previousTaskId={previousTaskId}
            {...({
              hasChildren,
              isExpanded,
              onToggleExpand: () => toggleCategory(`task_${task.id}`)
            } as any)}
          />
        </div>
      </div>
    );
  }, [tasks, isCatCollapsed, toggleCategory, handleToggleTask, handleDeleteTask, onOpenZenMode, onEditTask, isListView, isSmartView, currentView]);

  const CycleIcon = currentCycle ? getCycleIcon(currentCycle.icon) : null;
  const smartListInfo = isSmartView ? SMART_LISTS.find(l => l.id === currentView) : null;
  const SmartIcon = smartListInfo ? smartListInfo.icon : null;

  return (
    <main className="main-content" style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', overflowX: 'hidden', overscrollBehaviorX: 'none' }}>
      {/* Sticky Glass Top Bar */}
      <header 
        className="glass-header" 
        style={{ 
          position: 'relative', 
          flexShrink: 0,
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
          paddingBottom: '12px',
          paddingLeft: '16px',
          paddingRight: '16px',
          minHeight: 'calc(env(safe-area-inset-top, 0px) + 56px)',
          display: 'flex', 
          width: '100%', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          zIndex: 100,
          boxSizing: 'border-box',
          background: isScrolled ? 'var(--bg-surface-glass)' : 'transparent',
          borderBottom: isScrolled ? '0.5px solid var(--border-subtle)' : '0.5px solid transparent',
          backdropFilter: isScrolled ? 'blur(20px) saturate(180%)' : 'none',
          WebkitBackdropFilter: isScrolled ? 'blur(20px) saturate(180%)' : 'none',
          transition: 'background 0.25s ease, border-color 0.25s ease, backdrop-filter 0.25s ease, -webkit-backdrop-filter 0.25s ease'
        }}
      >
        {/* Left spacer / Mobile Back Button */}
        {isMobile && onBackToSidebar ? (
          <button 
            onClick={onBackToSidebar} 
            className="back-btn-ios" 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 4, 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--accent-primary, #0a84ff)', 
              fontWeight: 500, 
              fontSize: '1.05rem', 
              cursor: 'pointer',
              padding: '4px 8px 4px 0',
              WebkitTapHighlightColor: 'transparent',
              flexShrink: 0,
              zIndex: 10
            }}
            title="Volver a listas"
          >
            <ChevronLeft size={22} /> Listas
          </button>
        ) : (
          <div style={{ minWidth: 24, flexShrink: 0 }} />
        )}
        
        {/* Dynamic List Title on Top Bar (visible when scrolled) */}
        <div style={{ 
          flex: 1, 
          minWidth: 0,
          textAlign: 'center', 
          fontWeight: 600, 
          fontSize: '1rem', 
          color: isSmartView ? SMART_COLORS[currentView] : currentList ? currentList.color : 'var(--text-primary)',
          opacity: isScrolled ? 1 : 0,
          transform: isScrolled ? 'translateY(0)' : 'translateY(4px)',
          transition: 'opacity 0.25s ease, transform 0.25s ease',
          pointerEvents: isScrolled ? 'auto' : 'none',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          padding: '0 8px'
        }}>
          {getTitle()}
        </div>

        {/* Right: Actions aligned to the right */}
        <div className="header-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center', marginLeft: 'auto', flexWrap: 'nowrap', flexShrink: 0, justifyContent: 'flex-end', position: 'relative' }}>
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
        onScroll={(e) => {
          const top = e.currentTarget.scrollTop;
          setIsScrolled(top > 20);
        }}
        style={{ 
          flex: 1,
          position: 'relative', 
          overflowY: 'auto', 
          overflowX: 'hidden',
          overscrollBehaviorY: 'contain',
          overscrollBehaviorX: 'none',
          touchAction: 'pan-y',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 'max(56px, calc(env(safe-area-inset-bottom) + 40px))'
        }}
      >
        <div 
          className="tasks-container" 
          style={{ 
            display: 'flex',
            flexDirection: 'column',
            width: '100%', 
            position: 'relative', 
            background: 'var(--bg-elevated)', 
            overflowX: 'hidden', 
            touchAction: 'pan-y',
            minHeight: '100%',
            boxSizing: 'border-box'
          }}
        >
          
          {flattenedData.map((data, index) => {
          const hasAnyTasks = visibleTasks.length > 0 || smartTasks.length > 0;
          if (!hasAnyTasks && data.type !== 'page-header') return null;

          const itemKey = getItemKey(data, index);
          const itemStyle: React.CSSProperties = {
            position: 'relative',
            width: '100%',
            zIndex: data.type === 'header' || data.type === 'empty-section' ? 10 : 1,
            boxSizing: 'border-box'
          };

          if (data.type === 'page-header') {
            return (
              <div key={itemKey} data-index={index} style={{...itemStyle, zIndex: 20, margin: 0, boxSizing: 'border-box'}}>
                <header 
                  className="content-header" 
                  style={{ padding: '4px 16px 20px 16px', display: 'flex', flexDirection: 'column', gap: '16px', flexShrink: 0, margin: '0', borderBottom: 'none', boxSizing: 'border-box' }}
                >
        {/* Línea del Título (Debajo del Top Bar) */}
        <div style={{ width: '100%', boxSizing: 'border-box' }}>
          <h1 className="text-display" style={{ 
            fontSize: '34px', 
            fontWeight: 700,
            lineHeight: '1.2',
            wordBreak: 'break-word',
            letterSpacing: '-0.5px',
            color: isSmartView ? SMART_COLORS[currentView] : isListView && currentList ? currentList.color : 'var(--text-primary)',
            display: 'flex', alignItems: 'center', margin: 0,
            padding: 0,
            boxSizing: 'border-box'
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
                <div className="content-stats" style={{ marginTop: 'var(--space-8)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span className="stat-chip" style={{ minHeight: '32px', padding: '4px 12px', display: 'inline-flex', alignItems: 'center', lineHeight: '1.3', wordBreak: 'break-word', boxSizing: 'border-box' }}><strong>{activeVisibleCount}</strong> pendientes</span>
                  <span className="stat-chip" style={{ minHeight: '32px', padding: '4px 12px', display: 'inline-flex', alignItems: 'center', lineHeight: '1.3', wordBreak: 'break-word', boxSizing: 'border-box' }}><strong>{completedVisibleCount}</strong> completadas</span>
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
        <OnboardingGuideCard />
      </header>
              </div>
            );
          } else if (data.type === 'header') {
            const isCustomSection = data.sectionId !== undefined;
            const sectionId = data.sectionId;
            const isDraggingOver = dragOverSectionId === sectionId && isCustomSection;

            const showDivider = index > 0 && flattenedData[index - 1]?.type !== 'page-header';
            return (
              <div 
                key={itemKey}
                data-index={index}
                className="group-header"
                style={{ 
                  ...itemStyle, 
                  borderBottom: 'none',
                  borderTop: 'none',
                  paddingLeft: `calc(32px + ${data.depth * 24}px)`,
                  paddingRight: '16px',
                  minHeight: showDivider ? 56 : 44,
                  paddingTop: showDivider ? 16 : 8,
                  paddingBottom: 8,
                  margin: 0,
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  outline: isDraggingOver ? `2px solid ${data.color}` : undefined,
                  background: isDraggingOver ? `${data.color}14` : 'transparent', // Transparent background as in Apple
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
                onContextMenu={(e) => {
                  e.preventDefault();
                  setSectionMenu({ open: true, x: e.clientX, y: e.clientY, sectionId: data.sectionId, sectionName: data.title });
                }}
                onPointerDown={(e) => {
                  if (sectionTouchTimer.current) clearTimeout(sectionTouchTimer.current);
                  const clientX = e.clientX;
                  const clientY = e.clientY;
                  const secId = data.sectionId;
                  const secTitle = data.title;
                  sectionTouchTimer.current = setTimeout(() => {
                    setSectionMenu({ open: true, x: clientX, y: clientY, sectionId: secId, sectionName: secTitle });
                  }, 400);
                }}
                onPointerUp={() => { if (sectionTouchTimer.current) clearTimeout(sectionTouchTimer.current); }}
                onPointerCancel={() => { if (sectionTouchTimer.current) clearTimeout(sectionTouchTimer.current); }}
                onPointerMove={() => { if (sectionTouchTimer.current) clearTimeout(sectionTouchTimer.current); }}
              >
                {showDivider && (
                  <div className="ios-section-divider" style={{ height: '0.5px', background: 'var(--separator-color, rgba(142, 142, 147, 0.3))', margin: '0 0 12px 0', width: '100%' }} />
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    {isCustomSection && editingSectionId === data.sectionId ? (
                      <input 
                        type="text" 
                        value={editingSectionName}
                        onChange={e => setEditingSectionName(e.target.value)}
                        onBlur={(e) => saveSectionName(e as any, data.sectionId!)}
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
                          fontWeight: 600,
                          color: 'var(--text-tertiary)',
                          fontSize: '0.85rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          lineHeight: '1.3',
                          minHeight: '28px',
                          wordBreak: 'break-word',
                          margin: 0,
                          padding: '4px 0',
                          boxSizing: 'border-box'
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
                                  if (isCatCollapsed(data.category)) toggleCategory(data.category);
                                }}
                              >
                                <FolderPlus size={16} /> Añadir sección anidada
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
                  <ChevronDown 
                    size={18} 
                    color="var(--text-tertiary)" 
                    style={{ transform: isCatCollapsed(data.category) ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
                  />
                </div>
                {isCustomSection && dragOverSectionId === data.sectionId && (
                  <span style={{ fontSize: '0.8rem', color: data.color }}>Mover aquí</span>
                )}
              </div>
            );
          } else if (data.type === 'empty-section') {
            return (
              <div 
                key={itemKey}
                data-index={index}
                style={{ 
                  ...itemStyle, 
                  paddingLeft: `calc(16px + ${data.depth * 24}px)`,
                  paddingRight: '16px',
                  minHeight: 44,
                  margin: 0,
                  boxSizing: 'border-box',
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
                    minHeight: 36,
                    lineHeight: '1.3',
                    wordBreak: 'break-word',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    width: '100%',
                    maxWidth: 300,
                    fontSize: '0.9rem',
                    margin: 0
                  }}
                >
                  <Plus size={16} />
                  {data.title}
                </button>
              </div>
            );
          } else {
            let prevId;
            if (index > 0) {
              const prevData = flattenedData[index - 1];
              if (prevData.type === 'task') {
                prevId = prevData.task.id;
              }
            }
            return renderTask(data.task, itemStyle, index, data.depth, !!data.isFirstInSection, !!data.isLastInSection, prevId, itemKey);
          }
        })}

        </div>

        {visibleTasks.length === 0 && smartTasks.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '320px', width: '100%', padding: '32px 16px', boxSizing: 'border-box' }}>
            <EmptyState {...emptyStateProps} />
          </div>
        )}
      </div>

      <ListConfigModal 
        isOpen={isListConfigOpen} 
        onClose={() => setIsListConfigOpen(false)} 
        listId={currentList?.id} 
      />

      {createPortal(
        <button className="fab" onClick={() => onOpenNewTask()} title="Añadir Tarea" style={{ zIndex: 99999 }}>
          <Plus size={24} />
        </button>,
        document.body
      )}
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
              background: 'var(--bg-elevated, #1c1c1e)',
              backdropFilter: 'blur(35px) saturate(200%)',
              WebkitBackdropFilter: 'blur(35px) saturate(200%)',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.15))',
              borderRadius: '16px',
              padding: '12px 16px',
              boxShadow: '0 12px 36px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              zIndex: 999999,
              pointerEvents: 'auto',
              minWidth: '280px',
              maxWidth: '90vw',
              justifyContent: 'space-between',
              boxSizing: 'border-box'
            }}
            initial={{ opacity: 0, y: 24, x: "-50%", scale: 0.9 }}
            animate={{ opacity: 1, y: 0, x: "-50%", scale: 1 }}
            exit={{ opacity: 0, y: 20, x: "-50%", scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 450, damping: 28 }}
            drag="x"
            dragConstraints={{ left: -100, right: 100 }}
            onDragEnd={(_, info) => {
              if (Math.abs(info.offset.x) > 60) {
                if (deletedToast.timeoutId) window.clearTimeout(deletedToast.timeoutId);
                setDeletedToast(null);
              }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden', flex: 1 }}>
              <Trash2 size={18} color="var(--accent-red)" style={{ flexShrink: 0 }} />
              <span style={{ 
                fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)', 
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', 
                overflow: 'hidden', wordBreak: 'break-word', whiteSpace: 'normal'
              }}>
                Eliminado "{deletedToast.title}"
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
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
                  boxShadow: '0 2px 8px rgba(10, 132, 255, 0.3)',
                  transition: 'transform 0.15s ease'
                }}
                onPointerDown={e => { e.currentTarget.style.transform = 'scale(0.93)'; }}
                onPointerUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
              >
                Deshacer
              </button>
              <button
                onClick={() => {
                  if (deletedToast.timeoutId) window.clearTimeout(deletedToast.timeoutId);
                  setDeletedToast(null);
                }}
                style={{
                  background: 'transparent',
                  color: 'var(--text-tertiary)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
                title="Cerrar"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

      {sectionMenu.open && createPortal(
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 999990 }}
            onClick={() => setSectionMenu({ open: false, x: 0, y: 0 })}
            onContextMenu={(e) => { e.preventDefault(); setSectionMenu({ open: false, x: 0, y: 0 }); }}
          />
          <motion.div
            className="ios-dropdown-menu glass-panel"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{
              position: 'fixed',
              left: Math.min(sectionMenu.x, window.innerWidth - 220),
              top: Math.min(sectionMenu.y, window.innerHeight - 150),
              zIndex: 999995,
              minWidth: 200,
              boxShadow: '0 12px 36px rgba(0,0,0,0.3)',
              border: '1px solid var(--border-subtle, rgba(255,255,255,0.15))',
              borderRadius: 12,
              background: 'var(--bg-elevated, #1c1c1e)',
              padding: 6
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="ios-dropdown-item" onClick={handleRenameSectionMenu}>
              <Edit3 size={16} /> Renombrar sección
            </button>
            <button className="ios-dropdown-item" onClick={handleAddTaskMenu}>
              <Plus size={16} /> Añadir tarea aquí
            </button>
            {sectionMenu.sectionId && (
              <>
                <div className="ios-dropdown-divider" style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
                <button className="ios-dropdown-item danger" style={{ color: 'var(--accent-red)' }} onClick={handleDeleteSectionMenu}>
                  <Trash2 size={16} /> Eliminar sección
                </button>
              </>
            )}
          </motion.div>
        </>,
        document.body
      )}

      {currentView !== 'TRASH' && (
        <QuickAddBar currentView={currentView} onExpandDrawer={() => onOpenNewTask()} />
      )}
    </main>
  );
}
