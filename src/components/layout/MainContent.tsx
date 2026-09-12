import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ChevronDown, ChevronLeft, FolderPlus, Settings, Trash2, MoreHorizontal, Edit3, X, Check, ArrowUpDown, Sparkles, Users, CreditCard, ShieldAlert, Clock } from 'lucide-react';
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
import { HapticService } from '../../services/HapticService';
import { SoundService } from '../../services/SoundService';
import { DailyBriefingBanner } from './DailyBriefingBanner';
import { extractPeopleFromText, calculateExpirationStatus, calculateSubscriptionCosts, findFlashbackMemories } from '../../services/TaskService';
import { PersonProfileModal } from '../people/PersonProfileModal';

interface MainContentProps {
  currentView: string;
  onOpenNewTask: (sectionId?: string) => void;
  onOpenZenMode: (taskId: string) => void;
  onEditTask?: (taskId: string) => void;
  onBackToSidebar?: () => void;
  onSelectView?: (view: string) => void;
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

export function MainContent({ currentView, onOpenNewTask, onOpenZenMode, onEditTask, onBackToSidebar, onSelectView, isMobile }: MainContentProps) {
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
  const [isInlineAdding, setIsInlineAdding] = useState(false);
  const [inlineTitle, setInlineTitle] = useState('');
  const inlineInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleFocus = () => {
      setIsInlineAdding(true);
      setTimeout(() => inlineInputRef.current?.focus(), 60);
    };
    window.addEventListener('focus-inline-add', handleFocus);
    return () => window.removeEventListener('focus-inline-add', handleFocus);
  }, []);

  const currentCycle = useMemo(() => cycles.find(c => c.id === currentView), [cycles, currentView]);
  const currentList = useMemo(() => lists?.find(l => `list_${l.id}` === currentView), [lists, currentView]);
  
  const isListView = currentView.startsWith('list_');
  const isSmartView = currentView.startsWith('smart_');


  const emptyStateProps = useMemo(() => {
    const handleNewTask = () => {
      onOpenNewTask(currentView.startsWith('list_') ? currentView.replace('list_', '') : undefined);
    };

    switch (currentView) {
      case 'smart_primeros_pasos':
        return {
          title: "¡Primeros Pasos completados!",
          subtitle: "Has completado todos los recordatorios guía. Puedes ocultar esta lista inteligente desde el botón Editar de la barra lateral.",
          iconName: "sparkles",
          ctaText: undefined,
          onAction: undefined
        };
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
        const isFolder = currentList?.isFolder;
        return {
          title: isFolder 
            ? `La carpeta "${currentList?.name || 'Carpeta'}" está vacía`
            : `Sin tareas en "${currentList?.name || (currentCycle ? currentCycle.name : 'la lista')}"`,
          subtitle: isFolder 
            ? "Esta carpeta no contiene sublistas ni tareas activas. Puedes añadir una nueva lista o crear un recordatorio dentro."
            : "Esta lista está vacía en este momento. Empieza añadiendo tu primer ítem.",
          iconName: isFolder ? "folder" : "list",
          ctaText: isFolder ? "Añadir a la carpeta" : "Añadir tarea",
          onAction: handleNewTask
        };
    }
  }, [currentView, currentList, currentCycle, onOpenNewTask]);

  // Menu state
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Opciones de inclusión jerárquica para ciclos (Semanales con/sin Diarias, Mensuales con/sin Semanales o Diarias)
  const [cycleInclusion] = useState<{
    weekly: 'only_weekly' | 'include_daily';
    monthly: 'only_monthly' | 'include_weekly' | 'include_all';
    annual: 'only_annual' | 'include_monthly' | 'include_all';
  }>(() => {
    try {
      const saved = localStorage.getItem('cycle_inclusion_pref');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      weekly: 'only_weekly',
      monthly: 'only_monthly',
      annual: 'only_annual'
    };
  });


  // Filtro de secciones temporales dentro de listas (ej. Care, Quehaceres)
  const [listSectionFilter, setListSectionFilter] = useState<string>('all');
  // Filtro de franja horaria para vista diaria (Mañana, Tarde, Noche)
  const [dailyTimeFilter, setDailyTimeFilter] = useState<'all' | 'morning' | 'afternoon' | 'night'>('all');
  // Aislamiento contextual de sección (Ocultar el resto / Ver todas)
  const [isolatedSectionKey, setIsolatedSectionKey] = useState<string | null>(null);
  // Vista especial para "Qué he hecho": Por Personas o Línea de Tiempo (Timeline)
  const [lifeLogViewMode, setLifeLogViewMode] = useState<'people' | 'timeline'>('people');
  // Filtro de persona específica en Qué he hecho
  const [selectedPersonFilter, setSelectedPersonFilter] = useState<string | null>(null);
  // Ficha de relación de persona (modal)
  const [selectedPersonForProfile, setSelectedPersonForProfile] = useState<string | null>(null);

  // Resetear filtros al cambiar de vista o lista
  useEffect(() => {
    setListSectionFilter('all');
    setDailyTimeFilter('all');
    setIsolatedSectionKey(null);
    setSelectedPersonFilter(null);
  }, [currentView]);

  // Helper para resolver franja horaria de una tarea
  const resolveTimeOfDay = useCallback((t: TaskItem): 'morning' | 'afternoon' | 'night' => {
    if (t.timeOfDay) return t.timeOfDay;
    if (t.alerts && t.alerts.length > 0) {
      const timeAlert = t.alerts.find(a => a.type === 'at_time' && a.time);
      if (timeAlert && timeAlert.time) {
        const hour = parseInt(timeAlert.time.split(':')[0], 10);
        if (!isNaN(hour)) {
          if (hour >= 6 && hour < 14) return 'morning';
          if (hour >= 14 && hour < 20) return 'afternoon';
          return 'night';
        }
      }
    }
    const text = `${t.title || ''} ${t.description || ''}`.toLowerCase();
    if (/\b(mañana|mañanero|despertar|despertarse|desayun|desayunar|aseo|dientes)\b/i.test(text)) return 'morning';
    if (/\b(tarde|almuerz|almorzar|comida|comer|meriend|merendar|siesta)\b/i.test(text)) return 'afternoon';
    if (/\b(noche|cenar|cena|dormir|acostar|acostarse|skin-care|skincare|serum)\b/i.test(text)) return 'night';
    return 'morning';
  }, []);

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
      case 'smart_primeros_pasos':
        filteredTasks = validTasks.filter(t => t.categoryId === 'primeros_pasos');
        break;
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
        filteredTasks = validTasks.filter(t => Boolean(t.flagged || (t.priority && t.priority !== 'none')));
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
      let listName = lists?.find(l => l.id === catId)?.name;
      if (!listName) {
        listName = (catId === 'primeros_pasos' || currentView === 'smart_primeros_pasos')
          ? 'Guía de Inicio'
          : 'Sin Lista';
      }
      if (!grouped[listName]) grouped[listName] = [];
      grouped[listName].push(task);
    });
    return grouped;
  }, [currentView, tasks, lists]);

  const isFolderView = currentView.startsWith('folder_');
  const [showCompletedLocal, setShowCompletedLocal] = useState(false);
  const [sortBy, setSortBy] = useState<'manual' | 'dueDate' | 'priority' | 'title' | 'createdAt'>('manual');
  const [showCelebration, setShowCelebration] = useState(false);

  const resolvedShowCompleted = isListView ? !!currentList?.showCompleted : showCompletedLocal;

  const toggleShowCompleted = useCallback(() => {
    HapticService.selection();
    if (isListView && currentList) {
      updateList(currentList.id, { showCompleted: !currentList.showCompleted });
    } else {
      setShowCompletedLocal(prev => !prev);
    }
  }, [isListView, currentList, updateList]);

  const sortTaskList = useCallback((taskList: TaskItem[]) => {
    if (sortBy === 'manual') return taskList;
    return [...taskList].sort((a, b) => {
      if (sortBy === 'dueDate') {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (sortBy === 'priority') {
        const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1, none: 0 };
        return (priorityOrder[b.priority || 'none'] ?? 0) - (priorityOrder[a.priority || 'none'] ?? 0);
      }
      if (sortBy === 'title') {
        return (a.title || '').localeCompare(b.title || '', 'es', { numeric: true, sensitivity: 'base' });
      }
      if (sortBy === 'createdAt') {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      }
      return 0;
    });
  }, [sortBy]);

  const groupedTasks = useMemo(() => {
    if (currentView === 'TRASH') {
      return { 'Papelera': Object.values(tasks).filter(t => t.deleted_at) };
    }

    let rawGrouped: Record<string, TaskItem[]> = {};

    if (isFolderView && currentList) {
      const folderId = currentList.id;
      
      // Obtener todas las sublistas descendientes de esta carpeta
      const descendantListIds = new Set<string>([folderId]);
      const queue = [folderId];
      while (queue.length > 0) {
        const currId = queue.shift()!;
        const children = lists?.filter(l => l.parentId === currId) || [];
        children.forEach(c => {
          descendantListIds.add(c.id);
          queue.push(c.id);
        });
      }

      const allTasks = Object.values(tasks).filter((t: any) => !t.deleted_at);
      const validTasks = resolvedShowCompleted 
        ? allTasks 
        : allTasks.filter((t: any) => !isTaskCompleted(t) || recentlyCompletedIds.includes(t.id));

      const filteredTasks = validTasks.filter((t: any) => {
        const catId = t.categoryId || (t as any).category_id;
        return catId && descendantListIds.has(catId);
      });

      const grouped: Record<string, TaskItem[]> = {};
      filteredTasks.forEach((task: any) => {
        const catId = task.categoryId || (task as any).category_id;
        const listName = lists?.find(l => l.id === catId)?.name || 'Sin Lista';
        if (!grouped[listName]) grouped[listName] = [];
        grouped[listName].push(task);
      });
      rawGrouped = grouped;
    } else if (isSmartView) {
      rawGrouped = getTasksForSmartView(resolvedShowCompleted, recentlyCompletedIds);
    } else if (isListView) {
      if (currentView === 'list_que_he_hecho') {
        const allTasks = Object.values(tasks).filter((t: any) => !t.deleted_at && (t.categoryId === 'que_he_hecho' || (t as any).category_id === 'que_he_hecho'));
        const validTasks = resolvedShowCompleted 
          ? allTasks 
          : allTasks.filter((t: any) => !isTaskCompleted(t) || recentlyCompletedIds.includes(t.id));

        const grouped: Record<string, TaskItem[]> = {};

        if (lifeLogViewMode === 'people') {
          // Extract all unique people across valid tasks
          const peopleSet = new Set<string>();
          validTasks.forEach((t: any) => {
            const tPeople = (t.people && t.people.length > 0) ? t.people : extractPeopleFromText(`${t.title || ''} ${t.description || ''}`);
            tPeople.forEach((p: string) => peopleSet.add(p));
          });

          const sortedPeople = Array.from(peopleSet).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

          // Pre-initialize person groups
          sortedPeople.forEach((p: string) => {
            grouped[`persona_${p}`] = [];
          });
          grouped['persona_solo'] = [];

          validTasks.forEach((t: any) => {
            const tPeople = (t.people && t.people.length > 0) ? t.people : extractPeopleFromText(`${t.title || ''} ${t.description || ''}`);
            if (tPeople.length === 0) {
              grouped['persona_solo'].push(t);
            } else {
              // Multi-association: appears under each person's section
              tPeople.forEach((p: string) => {
                const key = `persona_${p}`;
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(t);
              });
            }
          });

          if (grouped['persona_solo'].length === 0) {
            delete grouped['persona_solo'];
          }

          if (selectedPersonFilter) {
            const filterKey = `persona_${selectedPersonFilter}`;
            Object.keys(grouped).forEach(k => {
              if (k !== filterKey) delete grouped[k];
            });
          }
        } else {
          // Timeline mode: Group by Year and Month
          const sortedByDate = [...validTasks].sort((a, b) => {
            const dateA = a.dueDate ? new Date(a.dueDate).getTime() : new Date(a.created_at).getTime();
            const dateB = b.dueDate ? new Date(b.dueDate).getTime() : new Date(b.created_at).getTime();
            return dateB - dateA;
          });

          sortedByDate.forEach((t: any) => {
            const d = t.dueDate ? new Date(t.dueDate) : new Date(t.created_at);
            const year = isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
            const month = isNaN(d.getTime()) ? new Date().getMonth() : d.getMonth();
            const groupKey = `timeline_${year}_${String(month + 1).padStart(2, '0')}`;
            if (!grouped[groupKey]) grouped[groupKey] = [];
            grouped[groupKey].push(t);
          });
        }

        rawGrouped = grouped;
      } else {
        rawGrouped = getTasksByList(currentView.replace('list_', ''), resolvedShowCompleted, recentlyCompletedIds);
      }
    } else {
      rawGrouped = getTasksByCycle(currentView, resolvedShowCompleted, recentlyCompletedIds);
    }

    if (currentCycle) {
      const allowedCycleIds = new Set<string>();
      if (currentCycle.id === 'cycle_day') {
        allowedCycleIds.add('cycle_day');
      } else if (currentCycle.id === 'cycle_week') {
        allowedCycleIds.add('cycle_week');
        if (cycleInclusion.weekly === 'include_daily') {
          allowedCycleIds.add('cycle_day');
        }
      } else if (currentCycle.id === 'cycle_month') {
        allowedCycleIds.add('cycle_month');
        if (cycleInclusion.monthly === 'include_weekly') {
          allowedCycleIds.add('cycle_week');
        } else if (cycleInclusion.monthly === 'include_all') {
          allowedCycleIds.add('cycle_week');
          allowedCycleIds.add('cycle_day');
        }
      } else if (currentCycle.id === 'cycle_year') {
        allowedCycleIds.add('cycle_year');
        if (cycleInclusion.annual === 'include_monthly') {
          allowedCycleIds.add('cycle_month');
        } else if (cycleInclusion.annual === 'include_all') {
          allowedCycleIds.add('cycle_month');
          allowedCycleIds.add('cycle_week');
          allowedCycleIds.add('cycle_day');
        }
      } else {
        allowedCycleIds.add(currentCycle.id);
      }

      const filteredGrouped: Record<string, TaskItem[]> = {};
      Object.entries(rawGrouped).forEach(([key, taskList]) => {
        const matching = taskList.filter(t => {
          const eff = t.cycle_id || (
            t.categoryId === 'limpieza_diaria' || !!t.targetCount || (t.sectionId && (t.sectionId.toLowerCase().includes('diaria') || t.sectionId.toLowerCase().includes('recurrentes'))) ? 'cycle_day' :
            t.categoryId === 'limpieza_semanal' || (t.sectionId && t.sectionId.toLowerCase().includes('semanal')) ? 'cycle_week' :
            t.categoryId === 'limpieza_mensual' || (t.sectionId && t.sectionId.toLowerCase().includes('mensual')) ? 'cycle_month' :
            t.categoryId === 'limpieza_anual' || (t.sectionId && t.sectionId.toLowerCase().includes('anual')) ? 'cycle_year' : null
          );
          if (!eff || !allowedCycleIds.has(eff)) return false;
          if (currentCycle.id === 'cycle_day' && dailyTimeFilter !== 'all') {
            return resolveTimeOfDay(t) === dailyTimeFilter;
          }
          return true;
        });
        if (matching.length > 0) filteredGrouped[key] = matching;
      });
      rawGrouped = filteredGrouped;
    }

    // Filtrado de secciones temporales dentro de listas (ej. Care, Quehaceres)
    if (isListView && listSectionFilter !== 'all') {
      const currentSections = (listSections || []).filter(s => s.listId === currentList?.id && !s.deleted_at);
      const filteredGrouped: Record<string, TaskItem[]> = {};
      Object.entries(rawGrouped).forEach(([key, taskList]) => {
        const matching = taskList.filter(t => {
          const taskSecId = t.sectionId || (t as any).section_id;
          const secObj = taskSecId ? currentSections.find(s => s.id === taskSecId) : null;
          const textToMatch = `${secObj?.name || ''} ${taskSecId || ''} ${t.cycle_id || ''}`.toLowerCase();
          const isDay = t.cycle_id === 'cycle_day' || !!t.targetCount || textToMatch.includes('diaria') || textToMatch.includes('diario') || textToMatch.includes('recurrent');
          const isWeek = t.cycle_id === 'cycle_week' || textToMatch.includes('semanal');
          const isMonth = t.cycle_id === 'cycle_month' || textToMatch.includes('mensual');
          const isYear = t.cycle_id === 'cycle_year' || textToMatch.includes('anual');

          if (listSectionFilter === 'only_diaria') return isDay;
          if (listSectionFilter === 'only_semanal') return isWeek;
          if (listSectionFilter === 'semanal_plus_diaria') return isWeek || isDay;
          if (listSectionFilter === 'only_mensual') return isMonth;
          if (listSectionFilter === 'mensual_plus_semanal') return isMonth || isWeek;
          if (listSectionFilter === 'mensual_all') return isMonth || isWeek || isDay;
          if (listSectionFilter === 'only_anual') return isYear;
          return true;
        });
        if (matching.length > 0) filteredGrouped[key] = matching;
      });
      rawGrouped = filteredGrouped;
    }

    if (sortBy !== 'manual') {
      const sortedGrouped: Record<string, TaskItem[]> = {};
      Object.entries(rawGrouped).forEach(([key, taskList]) => {
        sortedGrouped[key] = sortTaskList(taskList);
      });
      return sortedGrouped;
    }

    return rawGrouped;
  }, [currentView, isFolderView, isSmartView, isListView, getTasksForSmartView, getTasksByList, getTasksByCycle, tasks, resolvedShowCompleted, recentlyCompletedIds, lists, currentCycle, cycleInclusion, listSectionFilter, dailyTimeFilter, resolveTimeOfDay, currentList, sortBy, sortTaskList, lifeLogViewMode, selectedPersonFilter]);
    
  const smartTasks = useMemo(() => currentView === 'cycle_day' ? getSmartSortTasks() : [], [currentView, getSmartSortTasks, tasks]);

  // Calcular Resumen Financiero Total
  const totalCost = useMemo(() => {
    let sum = 0;
    Object.values(groupedTasks).flat().forEach(t => {
      if (t.price && !isTaskCompleted(t)) {
        sum += (Number(t.price) || 0) * (t.quantity || 1);
      }
    });
    return sum;
  }, [groupedTasks]);

  const visibleTasks = useMemo(() => Object.values(groupedTasks).flat(), [groupedTasks]);
  const activeVisibleCount = useMemo(() => visibleTasks.filter(t => !isTaskCompleted(t)).length, [visibleTasks]);
  const completedVisibleCount = useMemo(() => visibleTasks.filter(t => !isTaskCompleted(t) ? false : true).length, [visibleTasks]);

  const allTasksArray = useMemo(() => Object.values(tasks), [tasks]);
  const flashbackMemories = useMemo(() => currentView === 'list_que_he_hecho' ? findFlashbackMemories(allTasksArray) : [], [currentView, allTasksArray]);

  const caducidadesStats = useMemo(() => {
    if (currentView !== 'list_caducidades') return null;
    const allCaducidades = Object.values(tasks).filter((t: any) => !t.deleted_at && (t.categoryId === 'caducidades' || (t as any).category_id === 'caducidades'));
    const cards = allCaducidades.filter((t: any) => t.expirationType === 'card' || t.sectionId === 'sec_tarjetas' || /tarjeta|banco|dni|carnet|pasaporte/i.test(t.title));
    const subs = allCaducidades.filter((t: any) => t.expirationType === 'subscription' || t.sectionId === 'sec_suscripciones' || /suscrip|netflix|spotify|gimnasio|cloud|hosting/i.test(t.title));
    let criticalCount = 0;
    allCaducidades.forEach((t: any) => {
      if (t.dueDate && !isTaskCompleted(t)) {
        const status = calculateExpirationStatus(t.dueDate);
        if (status && (status.status === 'expired' || status.status === 'imminent')) {
          criticalCount++;
        }
      }
    });
    const subCosts = calculateSubscriptionCosts(allCaducidades);
    return {
      total: allCaducidades.length,
      cards: cards.length,
      subs: subs.length,
      critical: criticalCount,
      subCosts
    };
  }, [currentView, tasks]);

  const totalCompletedInCurrentView = useMemo(() => {
    const all = Object.values(tasks).filter(t => !t.deleted_at && isTaskCompleted(t));
    if (currentView.startsWith('list_')) {
      const listId = currentView.replace('list_', '');
      return all.filter(t => (t.categoryId || (t as any).category_id) === listId).length;
    }
    if (currentView.startsWith('cycle_')) {
      return all.filter(t => t.cycle_id === currentView).length;
    }
    if (currentView === 'smart_today') {
      const todayStr = new Date().toDateString();
      return all.filter(t => t.dueDate && new Date(t.dueDate).toDateString() === todayStr).length;
    }
    if (currentView === 'smart_flagged') {
      return all.filter(t => t.priority === 'high').length;
    }
    if (currentView === 'smart_scheduled') {
      return all.filter(t => !!t.dueDate).length;
    }
    if (currentView === 'smart_all') {
      return all.length;
    }
    if (currentView === 'smart_primeros_pasos') {
      return all.filter(t => (t.categoryId || (t as any).category_id) === 'primeros_pasos').length;
    }
    return all.filter(t => (t.categoryId || (t as any).category_id) === currentView).length;
  }, [tasks, currentView]);

  const handleToggleTask = useCallback((id: string, forceReverse?: boolean) => {
    const task = tasks[id];
    if (task) {
      const willBeCompleted = !isTaskCompleted(task);
      if (willBeCompleted) {
        setRecentlyCompletedIds(prev => [...prev, id]);
        setTimeout(() => {
          setRecentlyCompletedIds(prev => prev.filter(x => x !== id));
        }, 3000);

        if (activeVisibleCount === 1) {
          setShowCelebration(true);
          SoundService.playComplete();
          HapticService.notification('success');
          setTimeout(() => setShowCelebration(false), 3500);
        }
      } else {
        setRecentlyCompletedIds(prev => prev.filter(x => x !== id));
      }
    }
    toggleTask(id, forceReverse);
  }, [tasks, toggleTask, activeVisibleCount]);

  const isCatCollapsed = useCallback((cat: string) => {
    return !!collapsed[cat];
  }, [collapsed]);

  const toggleCategory = useCallback((cat: string) => {
    setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }));
  }, []);

  const getTitle = useCallback(() => {
    if (isSmartView) {
      const names: Record<string, string> = {
        'smart_primeros_pasos': 'Primeros Pasos',
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
    if (isFolderView) {
      const folderId = currentView.replace('folder_', '');
      const folder = lists?.find(l => l.id === folderId);
      return folder ? folder.name : 'Carpeta';
    }
    if (currentView === 'list_inbox') return 'Bandeja de entrada';
    if (currentCycle) return currentCycle.name;
    if (currentList) return currentList.name;
    return 'Tareas';
  }, [isSmartView, isFolderView, currentView, currentCycle, currentList, lists]);

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
      const target = e.target as HTMLElement | null;
      if (target && target.closest && target.closest('.ios-dropdown-menu')) {
        return; // Permite hacer scroll interno dentro del menú desplegable
      }
      setSectionMenu({ open: false, x: 0, y: 0 });
      setSectionMenuId(null);
    };
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    window.addEventListener('wheel', handleScroll, { capture: true, passive: true });
    window.addEventListener('touchmove', handleScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('wheel', handleScroll, true);
      window.removeEventListener('touchmove', handleScroll, true);
    };
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
        if (isolatedSectionKey && isolatedSectionKey !== categoryOrCycle) {
          return;
        }

        let color = '#34c759'; // Default
        let headerTitle = categoryOrCycle;
        let headerDepth = 0;

        // In cycle or smart view, resolve category key to name
        if (categoryOrCycle === 'primeros_pasos' || categoryOrCycle === 'Guía de Inicio' || currentView === 'smart_primeros_pasos') {
          headerTitle = 'Guía de Inicio';
          color = '#ff2d55';
        } else if (categoryOrCycle === 'inbox' || categoryOrCycle === 'undefined' || !categoryOrCycle) {
          headerTitle = 'Sin lista';
          color = '#8e8e93';
        } else {
          const catObj = lists?.find(l => l.id === categoryOrCycle);
          if (catObj) { headerTitle = catObj.name; color = catObj.color; }
          else { headerTitle = categoryOrCycle === 'Sin Lista' ? 'Sin lista' : categoryOrCycle; color = '#8e8e93'; }
        }
        
        flat.push({ type: 'header', title: headerTitle, category: categoryOrCycle, color, depth: headerDepth });
        
        if (!isCatCollapsed(categoryOrCycle)) {
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
      
      if (currentView === 'list_que_he_hecho') {
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        Object.entries(groupedTasks).forEach(([groupKey, groupTasks]) => {
          if (isolatedSectionKey && isolatedSectionKey !== groupKey) return;

          let headerTitle = groupKey;
          if (groupKey.startsWith('persona_')) {
            const pName = groupKey.replace('persona_', '');
            headerTitle = groupKey === 'persona_solo' ? '👤 Individual / Sin personas' : `👥 ${pName}`;
          } else if (groupKey.startsWith('timeline_')) {
            const parts = groupKey.replace('timeline_', '').split('_');
            const y = parts[0];
            const m = parseInt(parts[1], 10) - 1;
            headerTitle = `⏳ ${monthNames[m] || ''} ${y}`;
          }

          flat.push({
            type: 'header',
            title: headerTitle,
            category: groupKey,
            color: '#5856D6',
            depth: 0
          });

          if (!isCatCollapsed(groupKey)) {
            if (groupTasks.length === 0) {
              flat.push({
                type: 'empty-section',
                title: 'Aquí no hay recuerdos',
                category: groupKey,
                color: '#5856D6',
                depth: 0
              });
            } else {
              const roots = groupTasks.filter(t => !t.parentId);
              const processNode = (task: TaskItem, depthLevel: number) => {
                flat.push({ type: 'task', task, depth: depthLevel });
                if (!isCatCollapsed(`task_${task.id}`)) {
                  const children = groupTasks.filter(t => t.parentId === task.id);
                  children.forEach(c => processNode(c, depthLevel + 1));
                }
              };
              roots.forEach(r => processNode(r, 0));
            }
          }
        });
      } else {
        // 1. Uncategorized (no_section)
      if (groupedTasks['no_section'] && groupedTasks['no_section'].length > 0) {
        if (!isolatedSectionKey || isolatedSectionKey === 'no_section') {
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
          if (isolatedSectionKey && isolatedSectionKey !== catKey) return;
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
      const sectionsForList = (listSections || [])
        .filter(s => s.listId === currentList?.id && !s.deleted_at)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      const isDescendant = (targetCatKey: string, ancestorSecId: string) => {
        if (!targetCatKey.startsWith('section_')) return false;
        const targetId = targetCatKey.replace('section_', '');
        let curr = sectionsForList.find(s => s.id === targetId);
        while (curr) {
          if (curr.parentId === ancestorSecId) return true;
          curr = sectionsForList.find(s => s.id === curr?.parentId);
        }
        return false;
      };
      
      const processSection = (secId: string, depth: number) => {
        const sec = sectionsForList.find(s => s.id === secId);
        if (!sec) return;
        
        const categoryKey = `section_${sec.id}`;

        if (isolatedSectionKey && isolatedSectionKey !== categoryKey && !isDescendant(isolatedSectionKey, sec.id) && !isDescendant(categoryKey, isolatedSectionKey.replace('section_', ''))) {
          return;
        }

        const categoryTasks = groupedTasks[categoryKey] || [];

        // Si se está filtrando por temporalidad (ej. solo semanales o solo diarias)
        // y esta sección no tiene tareas que cumplan el filtro, no mostrar la sección vacía
        if (listSectionFilter !== 'all' && categoryTasks.length === 0) {
          return;
        }

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
    }

    // Identify first and last tasks in sections for Apple-style rounding
    for (let i = 0; i < flat.length; i++) {
      if (flat[i].type === 'task') {
        flat[i].isFirstInSection = (i === 0 || flat[i - 1].type !== 'task');
        flat[i].isLastInSection = (i === flat.length - 1 || flat[i + 1].type !== 'task');
      }
    }

    return flat;
  }, [groupedTasks, smartTasks, currentCycle, collapsed, isListView, lists, listSections, currentList, isCatCollapsed, isolatedSectionKey]);

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
    if (item.type === 'task') return `task-${item.task.id}-${index}`;
    return index;
  }, []);

  const renderTask = useCallback((task: TaskItem, itemStyle: React.CSSProperties, index: number, depth: number, isFirst: boolean, isLast: boolean, previousTaskId?: string, itemKey?: React.Key) => {
    const hasChildren = Object.values(tasks).some(t => t.parentId === task.id && !t.deleted_at);
    const isExpanded = !isCatCollapsed(`task_${task.id}`);

    return (
      <motion.div
        layout="position"
        initial={{ opacity: 0, height: 0, scaleY: 0.95, overflow: 'hidden' }}
        animate={{ opacity: 1, height: 'auto', scaleY: 1, overflow: 'visible' }}
        exit={{ opacity: 0, height: 0, scaleY: 0.95, overflow: 'hidden' }}
        transition={{ type: 'spring', damping: 28, stiffness: 400 }}
        key={itemKey ?? `task-${task.id}`}
        data-index={index}
        style={{ ...itemStyle, margin: 0, padding: '0 16px', boxSizing: 'border-box' }}
      >
        <div style={{ position: 'relative', width: '100%', boxSizing: 'border-box' }}>
          {depth > 0 && (
            <div style={{
              position: 'absolute', left: 8 + (depth-1)*16, top: 0, bottom: 0, width: 2,
              background: 'var(--accent-primary)', opacity: Math.max(0.15, 1 - depth*0.2), zIndex: 1,
              borderRadius: 2
            }} />
          )}

          <TaskCard 
            task={task}
            virtualStyle={{ margin: 0, padding: 0, boxSizing: 'border-box' }}
            indent={depth * 16}
            onToggle={handleToggleTask}
            onDelete={handleDeleteTask}
            onOpenZenMode={onOpenZenMode}
            onEdit={onEditTask || NOOP}
            index={index}
            showListName={isSmartView || currentView === 'cycles'}
            isFirstInSection={isFirst}
            isLastInSection={isLast}
            previousTaskId={previousTaskId}
            onNavigateView={onSelectView}
            onPersonClick={(p) => setSelectedPersonForProfile(p)}
            {...({
              hasChildren,
              isExpanded,
              onToggleExpand: () => toggleCategory(`task_${task.id}`)
            } as any)}
          />
        </div>
      </motion.div>
    );
  }, [tasks, isCatCollapsed, toggleCategory, handleToggleTask, handleDeleteTask, onOpenZenMode, onEditTask, onSelectView, isSmartView, currentView, setSelectedPersonForProfile]);

  const CycleIcon = currentCycle ? getCycleIcon(currentCycle.icon) : null;
  const smartListInfo = isSmartView ? SMART_LISTS.find(l => l.id === currentView) : null;
  const SmartIcon = smartListInfo ? smartListInfo.icon : null;
  const viewColor = isSmartView ? (smartListInfo?.color || SMART_COLORS[currentView] || 'var(--accent-primary)') : (isListView && currentList) ? (currentList.color || 'var(--accent-primary)') : isFolderView ? (lists?.find(l => l.id === currentView.replace('folder_', ''))?.color || 'var(--accent-primary)') : 'var(--accent-primary)';

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
          {(isListView || isSmartView || isFolderView) && (
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
                        zIndex: 100, minWidth: 210
                      }}
                    >
                      <button 
                        className="ios-dropdown-item"
                        onClick={() => { toggleShowCompleted(); setIsMenuOpen(false); }}
                      >
                        <input type="checkbox" checked={resolvedShowCompleted} readOnly style={{ marginRight: 12, pointerEvents: 'none', accentColor: 'var(--accent-primary)' }} />
                        Mostrar Completados
                      </button>

                      <div className="ios-dropdown-divider" style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
                      
                      <div style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Ordenar por
                      </div>

                      <button 
                        className="ios-dropdown-item"
                        onClick={() => { HapticService.selection(); setSortBy('manual'); setIsMenuOpen(false); }}
                        style={{ justifyContent: 'space-between' }}
                      >
                        <span>Manual</span>
                        {sortBy === 'manual' && <Check size={14} color="var(--accent-primary)" />}
                      </button>

                      <button 
                        className="ios-dropdown-item"
                        onClick={() => { HapticService.selection(); setSortBy('dueDate'); setIsMenuOpen(false); }}
                        style={{ justifyContent: 'space-between' }}
                      >
                        <span>Fecha de vencimiento</span>
                        {sortBy === 'dueDate' && <Check size={14} color="var(--accent-primary)" />}
                      </button>

                      <button 
                        className="ios-dropdown-item"
                        onClick={() => { HapticService.selection(); setSortBy('priority'); setIsMenuOpen(false); }}
                        style={{ justifyContent: 'space-between' }}
                      >
                        <span>Prioridad</span>
                        {sortBy === 'priority' && <Check size={14} color="var(--accent-primary)" />}
                      </button>

                      <button 
                        className="ios-dropdown-item"
                        onClick={() => { HapticService.selection(); setSortBy('title'); setIsMenuOpen(false); }}
                        style={{ justifyContent: 'space-between' }}
                      >
                        <span>Título (A-Z)</span>
                        {sortBy === 'title' && <Check size={14} color="var(--accent-primary)" />}
                      </button>

                      <button 
                        className="ios-dropdown-item"
                        onClick={() => { HapticService.selection(); setSortBy('createdAt'); setIsMenuOpen(false); }}
                        style={{ justifyContent: 'space-between' }}
                      >
                        <span>Fecha de creación</span>
                        {sortBy === 'createdAt' && <Check size={14} color="var(--accent-primary)" />}
                      </button>

                      {isListView && currentList && (
                        <>
                          <div className="ios-dropdown-divider" style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
                          <button 
                            className="ios-dropdown-item"
                            onClick={() => { updateList(currentList.id, { isFinancial: !currentList.isFinancial }); setIsMenuOpen(false); }}
                          >
                            <input type="checkbox" checked={!!currentList.isFinancial} readOnly style={{ marginRight: 12, pointerEvents: 'none', accentColor: 'var(--accent-primary)' }} />
                            Modo Financiero
                          </button>
                          <button 
                            className="ios-dropdown-item"
                            onClick={() => { setIsListConfigOpen(true); setIsMenuOpen(false); }}
                          >
                            <Settings size={16} />
                            Personalizar Lista
                          </button>
                        </>
                      )}
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
          overscrollBehaviorY: 'auto',
          overscrollBehaviorX: 'none',
          touchAction: 'pan-y',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 'calc(130px + env(safe-area-inset-bottom, 0px))'
        }}
      >
        <div 
          className="tasks-container" 
          style={{ 
            display: 'flex',
            flexDirection: 'column',
            width: '100%', 
            position: 'relative', 
            background: 'transparent', 
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
        {/* Línea del Título (Debajo del Top Bar) - Estilo Apple Reminders */}
        <div style={{ width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <h1 className="text-display" style={{ 
            fontSize: '34px', 
            fontWeight: 700,
            lineHeight: '1.2',
            wordBreak: 'break-word',
            letterSpacing: '-0.5px',
            color: viewColor,
            display: 'flex', alignItems: 'center', margin: 0,
            padding: 0,
            boxSizing: 'border-box',
            flex: 1,
            minWidth: 0
          }}>
            {CycleIcon && <CycleIcon size={32} color="var(--accent-primary)" style={{ marginRight: 12 }} />}
            {SmartIcon && smartListInfo && (
              <div style={{
                marginRight: 12,
                width: 38, height: 38, borderRadius: '50%',
                backgroundColor: smartListInfo.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 4px 12px ${smartListInfo.color}40`,
                flexShrink: 0
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
                style={{ cursor: currentCycle ? 'text' : 'default', overflow: 'hidden', textOverflow: 'ellipsis' }}
                title={currentCycle ? "Doble click para editar nombre" : undefined}
              >
                {getTitle()}
              </span>
            )}
          </h1>

          {/* Gran Contador Apple Reminders en el color de la lista y Total Presupuesto */}
          {!currentCycle && currentView !== 'TRASH' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {totalCost > 0 && (
                <span 
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 10px',
                    borderRadius: 8,
                    background: 'var(--bg-card, rgba(255,255,255,0.7))',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '-0.2px'
                  }}
                  title="Presupuesto total pendiente"
                >
                  {totalCost.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €
                </span>
              )}
              <span className="apple-large-counter" style={{ color: viewColor }}>
                {activeVisibleCount}
              </span>
            </div>
          )}
        </div>

          {currentCycle && (
            <div className="content-stats" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginLeft: '4px' }}>
              <span className="stat-chip" style={{ minHeight: '32px', padding: '4px 12px', display: 'inline-flex', alignItems: 'center', lineHeight: '1.3', wordBreak: 'break-word', boxSizing: 'border-box', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 999 }}><strong>{activeVisibleCount}</strong> &nbsp;pendientes</span>
              <span className="stat-chip" style={{ minHeight: '32px', padding: '4px 12px', display: 'inline-flex', alignItems: 'center', lineHeight: '1.3', wordBreak: 'break-word', boxSizing: 'border-box', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 999 }}><strong>{completedVisibleCount}</strong> &nbsp;completadas</span>
            </div>
          )}

          {currentCycle && !['cycle_day', 'cycle_week', 'cycle_month', 'cycle_year'].includes(currentCycle.id) && (
            <div>
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


          {totalCost > 0 && (
            <div 
              style={{ 
                marginTop: 10, 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: 6,
                background: 'var(--bg-elevated)', 
                color: 'var(--text-secondary)', 
                padding: '4px 12px', 
                borderRadius: 8, 
                fontWeight: 500, 
                fontSize: '0.84rem',
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
              }}
            >
              <span style={{ color: 'var(--text-tertiary)' }}>Total estimado:</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-primary)' }}>
                {totalCost.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €
              </span>
            </div>
          )}

          {sortBy !== 'manual' && (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span 
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: 6, 
                  padding: '4px 12px', 
                  borderRadius: 12, 
                  fontSize: '0.8rem', 
                  fontWeight: 600, 
                  background: 'var(--accent-glow, rgba(10,132,255,0.1))', 
                  color: 'var(--accent-primary)',
                  border: '1px solid rgba(10,132,255,0.2)'
                }}
              >
                <ArrowUpDown size={13} />
                <span>Orden: {
                  sortBy === 'dueDate' ? 'Fecha de vencimiento' :
                  sortBy === 'priority' ? 'Prioridad' :
                  sortBy === 'title' ? 'Título (A-Z)' : 'Fecha de creación'
                }</span>
                <button
                  onClick={() => { HapticService.selection(); setSortBy('manual'); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex', alignItems: 'center', marginLeft: 4 }}
                  title="Restablecer a orden manual"
                >
                  <X size={13} />
                </button>
              </span>
            </div>
          )}

          {currentView === 'list_que_he_hecho' && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'inline-flex', background: 'var(--bg-card, rgba(0,0,0,0.05))', padding: '3px', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                  <button
                    type="button"
                    onClick={() => { HapticService.selection(); setLifeLogViewMode('people'); }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 14px',
                      borderRadius: 7,
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                      background: lifeLogViewMode === 'people' ? 'var(--bg-elevated, #fff)' : 'transparent',
                      color: lifeLogViewMode === 'people' ? '#5856d6' : 'var(--text-secondary)',
                      boxShadow: lifeLogViewMode === 'people' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Users size={14} />
                    <span>Por Personas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { HapticService.selection(); setLifeLogViewMode('timeline'); }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 14px',
                      borderRadius: 7,
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                      background: lifeLogViewMode === 'timeline' ? 'var(--bg-elevated, #fff)' : 'transparent',
                      color: lifeLogViewMode === 'timeline' ? '#5856d6' : 'var(--text-secondary)',
                      boxShadow: lifeLogViewMode === 'timeline' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Clock size={14} />
                    <span>Línea de Tiempo</span>
                  </button>
                </div>
              </div>

              {/* Filtro rápido por persona en modo personas */}
              {lifeLogViewMode === 'people' && (() => {
                const allQueHeHecho = allTasksArray.filter((t: any) => !t.deleted_at && (t.categoryId === 'que_he_hecho' || (t as any).category_id === 'que_he_hecho'));
                const uniqueP = Array.from(new Set(allQueHeHecho.flatMap(t => (t.people && t.people.length > 0) ? t.people : extractPeopleFromText(`${t.title || ''} ${t.description || ''}`)))).filter(Boolean);
                if (uniqueP.length === 0) return null;
                return (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 2 }}>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>Filtrar:</span>
                    <button
                      type="button"
                      onClick={() => { HapticService.selection(); setSelectedPersonFilter(null); }}
                      style={{
                        padding: '2px 9px',
                        borderRadius: 999,
                        fontSize: '0.74rem',
                        fontWeight: 600,
                        border: selectedPersonFilter === null ? '1px solid #5856D6' : '1px solid var(--border-subtle)',
                        background: selectedPersonFilter === null ? '#5856D6' : 'var(--bg-elevated)',
                        color: selectedPersonFilter === null ? '#ffffff' : 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      Todos
                    </button>
                    {uniqueP.map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => { HapticService.selection(); setSelectedPersonFilter(selectedPersonFilter === p ? null : p); }}
                        style={{
                          padding: '2px 9px',
                          borderRadius: 999,
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          border: selectedPersonFilter === p ? '1px solid #5856D6' : '1px solid var(--border-subtle)',
                          background: selectedPersonFilter === p ? '#5856D6' : 'var(--bg-elevated)',
                          color: selectedPersonFilter === p ? '#ffffff' : 'var(--text-secondary)',
                          cursor: 'pointer'
                        }}
                      >
                        👤 {p}
                      </button>
                    ))}
                  </div>
                );
              })()}

              {/* Banner 'Un día como hoy' (Flashbacks estilo Apple Fotos) */}
              {flashbackMemories.length > 0 && (
                <div
                  data-testid="flashback-banner"
                  onClick={() => onEditTask?.(flashbackMemories[0].id)}
                  style={{
                    marginTop: 6,
                    padding: '10px 14px',
                    borderRadius: 14,
                    background: 'linear-gradient(135deg, rgba(88, 86, 214, 0.12), rgba(255, 149, 0, 0.12))',
                    border: '1px solid rgba(88, 86, 214, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
                  }}
                  title="Toca para ver este recuerdo"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.4rem' }}>🌟</span>
                    <div>
                      <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Un día como hoy: {flashbackMemories[0].title}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                        {flashbackMemories[0].people && flashbackMemories[0].people.length > 0
                          ? `Con ${flashbackMemories[0].people.join(', ')} • Toca para revivir este momento`
                          : 'Recordatorio especial vivido en esta misma fecha'}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.74rem', color: '#5856D6', fontWeight: 650 }}>Ver recuerdo →</span>
                </div>
              )}
            </div>
          )}

          {currentView === 'list_caducidades' && caducidadesStats && (
            <div style={{
              marginTop: 10,
              display: 'flex',
              gap: 14,
              flexWrap: 'wrap',
              alignItems: 'center',
              padding: '10px 14px',
              borderRadius: 12,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <CreditCard size={15} color="#ff9500" />
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Tarjetas:</span>
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>{caducidadesStats.cards}</span>
              </div>
              <div style={{ width: 1, height: 16, background: 'var(--border-subtle)' }} />
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Clock size={15} color="#007aff" />
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Suscripciones:</span>
                <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>{caducidadesStats.subs}</span>
              </div>
              {caducidadesStats.subCosts && caducidadesStats.subCosts.count > 0 && (
                <>
                  <div style={{ width: 1, height: 16, background: 'var(--border-subtle)' }} />
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Gasto recurrente:</span>
                    <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#34c759' }}>
                      {caducidadesStats.subCosts.formattedMonthly}/mes
                    </span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>
                      ({caducidadesStats.subCosts.formattedYearly}/año)
                    </span>
                  </div>
                </>
              )}
              {caducidadesStats.critical > 0 && (
                <>
                  <div style={{ width: 1, height: 16, background: 'var(--border-subtle)' }} />
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#ff3b30' }}>
                    <ShieldAlert size={15} />
                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Atención inmediata:</span>
                    <span style={{ fontSize: '0.86rem', fontWeight: 700 }}>{caducidadesStats.critical}</span>
                  </div>
                </>
              )}
            </div>
          )}
      </header>
      {currentView === 'smart_today' && (
        <DailyBriefingBanner />
      )}
              </div>
            );
          } else if (data.type === 'header') {
            const isCustomSection = data.sectionId !== undefined;
            const sectionId = data.sectionId;
            const isDraggingOver = dragOverSectionId === sectionId && isCustomSection;

            const showDivider = index > 0 && flattenedData[index - 1]?.type !== 'page-header';
            const sectionTasks = groupedTasks[data.category] || [];
            const sectionTotal = sectionTasks.reduce((sum, t) => sum + (t.price && !isTaskCompleted(t) ? (Number(t.price) || 0) * (t.quantity || 1) : 0), 0);
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
                          fontWeight: data.depth === 0 ? 700 : 600,
                          color: data.depth === 0 ? 'var(--text-primary)' : data.depth === 1 ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                          fontSize: data.depth === 0 ? '1.2rem' : data.depth === 1 ? '1rem' : '0.85rem',
                          textTransform: data.depth >= 2 ? 'uppercase' : 'none',
                          letterSpacing: data.depth >= 2 ? '0.5px' : '0',
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
                    {data.category.startsWith('persona_') && data.category !== 'persona_solo' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPersonForProfile(data.category.replace('persona_', ''));
                        }}
                        style={{
                          background: 'rgba(88, 86, 214, 0.12)',
                          border: '1px solid rgba(88, 86, 214, 0.25)',
                          borderRadius: 999,
                          color: '#5856D6',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          marginLeft: 4
                        }}
                        title="Ver momentos compartidos y relación"
                      >
                        <span>Ficha</span>
                      </button>
                    )}
                    {sectionTotal > 0 && (
                      <span 
                        style={{
                          fontSize: '0.76rem',
                          fontWeight: 500,
                          fontVariantNumeric: 'tabular-nums',
                          color: 'var(--text-secondary)',
                          background: 'var(--bg-hover, rgba(0,0,0,0.04))',
                          border: '1px solid var(--border-subtle)',
                          padding: '1.5px 7px',
                          borderRadius: '6px',
                          marginLeft: '2px',
                          flexShrink: 0
                        }}
                        title="Subtotal de la sección"
                      >
                        {sectionTotal.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €
                      </span>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {(!isCatCollapsed(data.category) || isolatedSectionKey === data.category) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          HapticService.selection();
                          setIsolatedSectionKey(prev => {
                            const next = prev === data.category ? null : data.category;
                            if (next && isCatCollapsed(data.category)) {
                              toggleCategory(data.category);
                            }
                            return next;
                          });
                        }}
                        style={{
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 10px',
                          borderRadius: 999,
                          fontSize: '0.74rem',
                          fontWeight: isolatedSectionKey === data.category ? 700 : 500,
                          background: isolatedSectionKey === data.category ? 'var(--accent-primary)' : 'var(--bg-card)',
                          color: isolatedSectionKey === data.category ? '#ffffff' : 'var(--text-secondary)',
                          border: isolatedSectionKey === data.category ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                          boxShadow: isolatedSectionKey === data.category ? '0 2px 8px rgba(10,132,255,0.35)' : 'none',
                          transition: 'all 0.15s ease',
                          lineHeight: '1.2'
                        }}
                        title={isolatedSectionKey === data.category ? "Mostrar todas las secciones" : `Ocultar el resto y ver solo ${data.title}`}
                      >
                        {isolatedSectionKey === data.category ? '👁️ Ver todas' : 'Ocultar el resto'}
                      </button>
                    )}
                    <ChevronDown 
                      size={18} 
                      color="var(--text-tertiary)" 
                      style={{ transform: isCatCollapsed(data.category) ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
                    />
                  </div>
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

        {/* Apple Reminders Inline Quick Add Row */}
        {currentView !== 'TRASH' && currentView !== 'smart_completed' && (
          <div style={{ padding: '6px 16px 14px', width: '100%', boxSizing: 'border-box' }}>
            {isInlineAdding ? (
              <div 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 12px',
                  borderRadius: 12,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  gap: 8
                }}
              >
                <div style={{
                  width: 22, height: 22,
                  borderRadius: '50%',
                  border: `1.5px solid ${viewColor}`,
                  flexShrink: 0
                }} />
                <input
                  ref={inlineInputRef}
                  type="text"
                  value={inlineTitle}
                  placeholder="Nuevo recordatorio"
                  onChange={(e) => setInlineTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (inlineTitle.trim()) {
                        const newTaskTitle = inlineTitle.trim();
                        setInlineTitle('');
                        const defaultCategoryId = currentView.startsWith('list_') ? currentView.replace('list_', '') : undefined;
                        let dueDate: string | undefined = undefined;
                        if (currentView === 'smart_today') {
                          const today = new Date();
                          today.setHours(12, 0, 0, 0);
                          dueDate = today.toISOString();
                        }
                        const { addTask } = useAppStore.getState();
                        addTask({
                          id: crypto.randomUUID(),
                          title: newTaskTitle,
                          categoryId: defaultCategoryId,
                          dueDate,
                          completed: false,
                          created_at: new Date().toISOString()
                        } as any);
                        HapticService.selection();
                        setTimeout(() => inlineInputRef.current?.focus(), 50);
                      } else {
                        setIsInlineAdding(false);
                      }
                    } else if (e.key === 'Escape') {
                      setIsInlineAdding(false);
                      setInlineTitle('');
                    }
                  }}
                  onBlur={() => {
                    if (inlineTitle.trim()) {
                      const newTaskTitle = inlineTitle.trim();
                      setInlineTitle('');
                      const defaultCategoryId = currentView.startsWith('list_') ? currentView.replace('list_', '') : undefined;
                      let dueDate: string | undefined = undefined;
                      if (currentView === 'smart_today') {
                        const today = new Date();
                        today.setHours(12, 0, 0, 0);
                        dueDate = today.toISOString();
                      }
                      const { addTask } = useAppStore.getState();
                      addTask({
                        id: crypto.randomUUID(),
                        title: newTaskTitle,
                        categoryId: defaultCategoryId,
                        dueDate,
                        completed: false,
                        created_at: new Date().toISOString()
                      } as any);
                    }
                    setIsInlineAdding(false);
                  }}
                  style={{
                    fontSize: '1.02rem',
                    fontWeight: 400,
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    padding: 0
                  }}
                />
              </div>
            ) : (
              <div 
                onClick={() => {
                  setIsInlineAdding(true);
                  setTimeout(() => inlineInputRef.current?.focus(), 50);
                }}
                className="apple-inline-add-row"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 12,
                  cursor: 'pointer',
                  color: 'var(--text-tertiary)',
                  fontSize: '0.95rem',
                  background: 'transparent',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  border: '1.5px dashed var(--border-color)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Plus size={13} color="var(--text-tertiary)" />
                </div>
                <span style={{ fontWeight: 500 }}>Nuevo recordatorio</span>
              </div>
            )}
          </div>
        )}

        {visibleTasks.length === 0 && smartTasks.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', width: '100%', padding: '32px 16px', boxSizing: 'border-box' }}>
            <EmptyState {...emptyStateProps} />
          </div>
        )}

        {(totalCompletedInCurrentView > 0 || completedVisibleCount > 0) && currentView !== 'TRASH' && currentView !== 'smart_completed' && (
          <div style={{ padding: '20px 16px 32px', display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={toggleShowCompleted}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 16px',
                borderRadius: 20,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Check size={14} color="var(--accent-primary)" />
              <span>{totalCompletedInCurrentView || completedVisibleCount} completadas</span>
              <span style={{ opacity: 0.4 }}>•</span>
              <span style={{ color: 'var(--accent-primary)' }}>
                {resolvedShowCompleted ? 'Ocultar' : 'Mostrar'}
              </span>
              <ChevronDown 
                size={14} 
                style={{ 
                  transform: resolvedShowCompleted ? 'rotate(180deg)' : 'none', 
                  transition: 'transform 0.2s ease' 
                }} 
              />
            </button>
          </div>
        )}
        </div>
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

      {showCelebration && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: -24, scale: 0.92, x: '-50%' }}
            animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
            exit={{ opacity: 0, y: -20, scale: 0.92, x: '-50%' }}
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
            style={{
              position: 'fixed',
              top: 'max(24px, env(safe-area-inset-top))',
              left: '50%',
              zIndex: 999999,
              background: 'var(--bg-elevated, #1c1c1e)',
              border: '1px solid var(--border-subtle, rgba(255,255,255,0.15))',
              boxShadow: '0 16px 40px rgba(0,0,0,0.3)',
              borderRadius: 30,
              padding: '10px 22px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: 'var(--text-primary)',
              fontWeight: 600,
              fontSize: '0.92rem',
              pointerEvents: 'none'
            }}
          >
            <Sparkles size={18} color="#FFD700" />
            <span>¡Todo al día! Has completado todas las tareas</span>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

      <PersonProfileModal
        personName={selectedPersonForProfile}
        isOpen={!!selectedPersonForProfile}
        onClose={() => setSelectedPersonForProfile(null)}
        allTasks={allTasksArray}
        onEditTask={onEditTask}
        onAddMemoryWithPerson={() => onOpenNewTask('que_he_hecho')}
      />

      {currentView !== 'TRASH' && (
        <QuickAddBar currentView={currentView} onExpandDrawer={() => onOpenNewTask()} />
      )}
    </main>
  );
}
