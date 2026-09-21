import { useState, useRef, useMemo, useCallback, useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Plus, Hourglass, User, Users, PartyPopper } from 'lucide-react';
import { useAppStore, isTaskCompleted } from '../../store/useAppStore';
import type { TaskItem } from '../../models/Task';
import { TaskCard } from '../tasks/TaskCard';
import { ConfirmModal } from '../ui/ConfirmModal';
import { getCycleIcon } from '../../constants/icons';
import { ListConfigModal } from './ListConfigModal';
import { SMART_LISTS } from '../../constants/smartLists';
import { QuickAddBar } from '../ui/QuickAddBar';
import { BottomShortcutBar } from './BottomShortcutBar';
import { HapticService } from '../../services/HapticService';
import { SoundService } from '../../services/SoundService';
import { extractPeopleFromText, calculateExpirationStatus, calculateSubscriptionCosts, findFlashbackMemories, isCompletedInCurrentPeriod } from '../../services/TaskService';
import { PersonProfileModal } from '../people/PersonProfileModal';
import { AIService } from '../../services/AIService';
import { isCaducidadesList, isQueHeHechoList, ensureCaducidadesSections, isLimpiezaList, isRoutineList, ensureRoutineSections } from '../../utils/specialLists';
import { 
  getSectionPeriodicity, 
  getTaskPeriodicity, 
  getRoutineAllowedPeriodicities, 
  sortTasksByRoutinePriority,
  formatSectionTitle,
  type PeriodicityType 
} from '../../utils/sectionRoutine';
import { MainEmptyState } from './main/MainEmptyState';
import { MainGlassHeader } from './main/MainGlassHeader';
import { MainSectionHeader } from './main/MainSectionHeader';
import { MainInlineAdd } from './main/MainInlineAdd';
import { DeletedTaskToast } from './main/DeletedTaskToast';
import { SectionContextMenu, type SectionMenuState } from './main/SectionContextMenu';
import { MonthlySummaryModal } from './main/MonthlySummaryModal';
import { MainPageHeader } from './main/MainPageHeader';
import { DailyBriefingBanner } from './DailyBriefingBanner';
import { confirmDialog } from '../ui/confirmDialog';

interface MainContentProps {
  currentView: string;
  onOpenNewTask: (sectionId?: string) => void;
  onOpenZenMode: (taskId: string) => void;
  onEditTask?: (taskId: string) => void;
  onBackToSidebar?: () => void;
  onSelectView?: (view: string) => void;
  isMobile?: boolean;
  onStartSequence?: (taskIds: string[], listName: string, listColor?: string) => void;
}

type VirtualItemType = 
  | { type: 'page-header', isFirstInSection?: boolean, isLastInSection?: boolean, depth?: number }
  | {
      type: 'header',
      title: string,
      titleIcon?: ReactNode,
      category: string,
      color: string,
      sectionId?: string,
      depth: number,
      isFirstInSection?: boolean,
      isLastInSection?: boolean,
      periodicity?: PeriodicityType | null,
      routineCounts?: { full: number; only: number } | null,
      sectionTaskIds?: string[]
    }
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

export function MainContent({ currentView, onOpenNewTask, onOpenZenMode, onEditTask, onBackToSidebar, onSelectView, isMobile, onStartSequence }: MainContentProps) {
  // Store selectors
  const tasks = useAppStore((state) => state.tasks);
  const lists = useAppStore((state) => state.lists);
  const listSections = useAppStore((state) => state.listSections);
  const cycles = useAppStore((state) => state.cycles);
  const updateTask = useAppStore((state) => state.updateTask);
  const reorderTasks = useAppStore((state) => state.reorderTasks);
  const updateList = useAppStore((state) => state.updateList);
  const addListSection = useAppStore((state) => state.addListSection);
  const updateListSection = useAppStore((state) => state.updateListSection);
  const deleteListSection = useAppStore((state) => state.deleteListSection);
  const updateCycle = useAppStore((state) => state.updateCycle);
  const deleteCycle = useAppStore((state) => state.deleteCycle);
  const toggleTask = useAppStore((state) => state.toggleTask);
  const getTasksByList = useAppStore((state) => state.getTasksByList);
  const getTasksByCycle = useAppStore((state) => state.getTasksByCycle);
  const getSmartSortTasks = useAppStore((state) => state.getSmartSortTasks);

  // Local state
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [isScrolled, setIsScrolled] = useState(false);
  const [isListConfigOpen, setIsListConfigOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmProps, setConfirmProps] = useState<{ title: string; message: string; onConfirm: () => void }>({ title: '', message: '', onConfirm: () => {} });
  const [sortBy, setSortBy] = useState<'manual' | 'dueDate' | 'priority' | 'title' | 'createdAt'>('manual');
  const [deletedToast, setDeletedToast] = useState<{ id: string; title: string; timeoutId: number } | null>(null);
  const [isEditingCycle, setIsEditingCycle] = useState(false);
  const [cycleEditName, setCycleEditName] = useState('');
  const [showCelebration, setShowCelebration] = useState(false);
  const [sectionMenuId, setSectionMenuId] = useState<string | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState('');
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);
  const [sectionMenu, setSectionMenu] = useState<SectionMenuState>({ open: false, x: 0, y: 0 });

  // Creation inline input state
  const [isInlineAdding, setIsInlineAdding] = useState(false);
  const [inlineTitle, setInlineTitle] = useState('');
  const inlineInputRef = useRef<HTMLInputElement>(null);

  // Quick long press timer for section options
  const sectionTouchTimer = useRef<any>(null);

  // Grace period IDs for recently completed tasks to avoid vanishing instantly
  const [recentlyCompletedIds, setRecentlyCompletedIds] = useState<string[]>([]);

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
  // Modo de rutina cuando una sección periódica está aislada ('full_routine' = acumulativa con anuales/semanales/diarias, 'only_section' = estricta)
  const [isolatedRoutineMode, setIsolatedRoutineMode] = useState<'full_routine' | 'only_section'>('only_section');
  // Modo de rutina por sección individual
  const [sectionRoutineModes, setSectionRoutineModes] = useState<Record<string, 'full_routine' | 'only_section'>>({});

  const toggleSectionRoutineMode = useCallback((secKey: string, mode: 'full_routine' | 'only_section') => {
    setSectionRoutineModes(prev => ({ ...prev, [secKey]: mode }));
  }, []);

  const handleUndoDelete = useCallback((taskId: string) => {
    if (deletedToast && deletedToast.timeoutId) {
      window.clearTimeout(deletedToast.timeoutId);
    }
    updateTask(taskId, { deleted_at: undefined });
    setDeletedToast(null);
    SoundService.playUncomplete();
    HapticService.selection();
  }, [deletedToast, updateTask]);
  // Vista especial para "Qué he hecho": Por Personas o Línea de Tiempo (Timeline)
  const [lifeLogViewMode, setLifeLogViewMode] = useState<'people' | 'timeline'>('people');
  // Filtro de persona específica en Qué he hecho
  const [selectedPersonFilter, setSelectedPersonFilter] = useState<string | null>(null);
  // Ficha de relación de persona (modal)
  const [selectedPersonForProfile, setSelectedPersonForProfile] = useState<string | null>(null);
  // Resumen del mes IA (modal)
  const [monthlySummaryModal, setMonthlySummaryModal] = useState<{ open: boolean; title: string; text: string; loading: boolean }>({ open: false, title: '', text: '', loading: false });

  const handleOpenMonthlySummary = async () => {
    HapticService.selection();
    const now = new Date();
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const currentMonthName = monthNames[now.getMonth()];
    
    setMonthlySummaryModal({ open: true, title: `Memoria de ${currentMonthName}`, text: '', loading: true });
    
    const allQueHeHecho = allTasksArray.filter((t: any) => !t.deleted_at && (t.categoryId === 'que_he_hecho' || (t as any).category_id === 'que_he_hecho'));
    const thisMonthTasks = allQueHeHecho.filter(t => {
      const d = new Date(t.dueDate || t.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const tasksToSummarize = thisMonthTasks.length > 0 ? thisMonthTasks : allQueHeHecho;
    const summary = await AIService.generateMonthlySummary(tasksToSummarize, currentMonthName);
    setMonthlySummaryModal({ open: true, title: `Memoria de ${currentMonthName}`, text: summary, loading: false });
  };

  // Resetear filtros al cambiar de vista o lista
  useEffect(() => {
    setListSectionFilter('all');
    setDailyTimeFilter('all');
    setIsolatedSectionKey(null);
    setIsolatedRoutineMode('full_routine');
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
    return 'night';
  }, []);

  // Determinar el contexto actual
  const isSmartView = currentView.startsWith('smart_');
  const isListView = currentView.startsWith('list_') && !lists?.find(l => l.id === currentView.replace('list_', ''))?.isFolder;
  const isFolderView = currentView.startsWith('folder_') || !!lists?.find(l => l.id === currentView.replace('list_', ''))?.isFolder;
  const currentList = lists?.find((l) => l.id === currentView.replace('list_', '').replace('folder_', ''));
  const currentCycle = cycles.find((c) => c.id === currentView);

  // Manejo de mostrar completados por lista
  const [showCompleted, setShowCompleted] = useState<boolean>(false);
  const resolvedShowCompleted = currentList?.showCompleted ?? showCompleted;

  const toggleShowCompleted = () => {
    HapticService.selection();
    if (currentList) {
      updateList(currentList.id, { showCompleted: !resolvedShowCompleted });
    } else {
      setShowCompleted(!showCompleted);
    }
  };

  // Helper de ordenamiento
  const sortTaskList = useCallback((taskList: TaskItem[]): TaskItem[] => {
    if (sortBy === 'manual') {
      return [...taskList].sort((a, b) => {
        const orderA = a.order ?? 0;
        const orderB = b.order ?? 0;
        if (orderA !== orderB) return orderA - orderB;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
    }
    return [...taskList].sort((a, b) => {
      if (sortBy === 'dueDate') {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (sortBy === 'priority') {
        const pMap: Record<string, number> = { high: 3, medium: 2, low: 1, none: 0 };
        return (pMap[b.priority || 'none'] || 0) - (pMap[a.priority || 'none'] || 0);
      }
      if (sortBy === 'title') {
        return (a.title || '').localeCompare(b.title || '', 'es', { sensitivity: 'base' });
      }
      if (sortBy === 'createdAt') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return 0;
    });
  }, [sortBy]);

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

    const tasksToInclude = new Map<string, TaskItem>();
    filteredTasks.forEach((t: any) => {
      tasksToInclude.set(t.id, t);
      let current = t;
      while (current.parentId) {
        const parent = tasks[current.parentId];
        if (!parent || parent.deleted_at) break;
        if (!tasksToInclude.has(parent.id)) {
          tasksToInclude.set(parent.id, parent);
        }
        current = parent;
      }
    });

    const grouped: Record<string, TaskItem[]> = {};
    Array.from(tasksToInclude.values()).forEach(task => {
      let catId = task.categoryId || (task as any).category_id;
      if (!catId) {
        catId = (currentView === 'smart_primeros_pasos') ? 'primeros_pasos' : 'inbox';
      }
      if (!grouped[catId]) grouped[catId] = [];
      grouped[catId].push(task);
    });
    return grouped;
  }, [currentView, tasks, lists]);

  // Cargar tareas agrupadas según la vista actual
  const groupedTasks = useMemo(() => {
    let rawGrouped: Record<string, TaskItem[]> = {};
    if (isFolderView) {
      const folderId = currentView.replace('folder_', '').replace('list_', '');
      const descendantListIds = new Set<string>();
      const findDescendants = (parentId: string) => {
        lists?.forEach(l => {
          if (l.parentId === parentId) {
            descendantListIds.add(l.id);
            findDescendants(l.id);
          }
        });
      };
      findDescendants(folderId);

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
        
        const tasksToInclude = new Map<string, TaskItem>();
        matching.forEach(t => {
          tasksToInclude.set(t.id, t);
          let current = t;
          while (current.parentId) {
            const parent = tasks[current.parentId];
            if (!parent || parent.deleted_at) break;
            if (!tasksToInclude.has(parent.id)) {
              tasksToInclude.set(parent.id, parent);
            }
            current = parent;
          }
        });
        
        const finalTasks = Array.from(tasksToInclude.values());
        if (finalTasks.length > 0) filteredGrouped[key] = finalTasks;
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

        const tasksToInclude = new Map<string, TaskItem>();
        matching.forEach(t => {
          tasksToInclude.set(t.id, t);
          let current = t;
          while (current.parentId) {
            const parent = tasks[current.parentId];
            if (!parent || parent.deleted_at) break;
            if (!tasksToInclude.has(parent.id)) {
              tasksToInclude.set(parent.id, parent);
            }
            current = parent;
          }
        });
        
        const finalTasks = Array.from(tasksToInclude.values());
        if (finalTasks.length > 0) filteredGrouped[key] = finalTasks;
      });
      rawGrouped = filteredGrouped;
    }

    const sortedGrouped: Record<string, TaskItem[]> = {};
    Object.entries(rawGrouped).forEach(([key, taskList]) => {
      sortedGrouped[key] = sortTaskList(taskList);
    });
    return sortedGrouped;
  }, [currentView, isFolderView, isSmartView, isListView, getTasksForSmartView, getTasksByList, getTasksByCycle, tasks, resolvedShowCompleted, recentlyCompletedIds, lists, currentCycle, cycleInclusion, listSectionFilter, dailyTimeFilter, resolveTimeOfDay, currentList, sortBy, sortTaskList, lifeLogViewMode, selectedPersonFilter]);
    
  const smartTasks = useMemo(() => currentView === 'cycle_day' ? getSmartSortTasks(recentlyCompletedIds) : [], [currentView, getSmartSortTasks, tasks, recentlyCompletedIds]);

  // Tareas visibles en pantalla respetando el aislamiento y rutinas
  const visibleTasks = useMemo(() => {
    if (isolatedSectionKey) {
      const allTasksInScope = Object.values(groupedTasks).flat();
      const sectionPeriodicity = getSectionPeriodicity(isolatedSectionKey, undefined, listSections, lists);
      if (sectionPeriodicity && isolatedRoutineMode === 'full_routine') {
        const allowed = getRoutineAllowedPeriodicities(sectionPeriodicity);
        const routineTasks = allTasksInScope.filter(t => {
          const p = getTaskPeriodicity(t, listSections, lists);
          return p && allowed.has(p);
        });
        return sortTasksByRoutinePriority(routineTasks, sectionPeriodicity, listSections, lists);
      }
      return groupedTasks[isolatedSectionKey] || [];
    }
    return Object.values(groupedTasks).flat();
  }, [groupedTasks, isolatedSectionKey, isolatedRoutineMode, listSections, lists]);

  // Índices precalculados: evitan recorrer todas las tareas por cada fila renderizada (O(n²)).
  const parentIdsWithChildren = useMemo(() => {
    const ids = new Set<string>();
    for (const t of Object.values(tasks)) if (t.parentId && !t.deleted_at) ids.add(t.parentId);
    return ids;
  }, [tasks]);
  const visibleIndexById = useMemo(() => new Map(visibleTasks.map((t, i) => [t.id, i])), [visibleTasks]);

  // Reordenación manual de tareas
  const handleMoveTaskUp = useCallback((taskId: string) => {
    const idx = visibleTasks.findIndex(t => t.id === taskId);
    if (idx <= 0) return;

    if (sortBy !== 'manual') {
      setSortBy('manual');
    }

    const reordered = [...visibleTasks];
    const temp = reordered[idx];
    reordered[idx] = reordered[idx - 1];
    reordered[idx - 1] = temp;

    reorderTasks(reordered.map(t => t.id));
    HapticService.selection();
  }, [visibleTasks, reorderTasks, sortBy]);

  const handleMoveTaskDown = useCallback((taskId: string) => {
    const idx = visibleTasks.findIndex(t => t.id === taskId);
    if (idx < 0 || idx >= visibleTasks.length - 1) return;

    if (sortBy !== 'manual') {
      setSortBy('manual');
    }

    const reordered = [...visibleTasks];
    const temp = reordered[idx];
    reordered[idx] = reordered[idx + 1];
    reordered[idx + 1] = temp;

    reorderTasks(reordered.map(t => t.id));
    HapticService.selection();
  }, [visibleTasks, reorderTasks, sortBy]);

  const handleReorderTasks = useCallback((sourceTaskId: string, targetTaskId: string, position: 'before' | 'after' = 'before') => {
    if (sourceTaskId === targetTaskId) return;
    const sourceIdx = visibleTasks.findIndex(t => t.id === sourceTaskId);
    const targetIdx = visibleTasks.findIndex(t => t.id === targetTaskId);
    if (sourceIdx === -1 || targetIdx === -1) return;

    if (sortBy !== 'manual') {
      setSortBy('manual');
    }

    const reordered = [...visibleTasks];
    const [removed] = reordered.splice(sourceIdx, 1);
    const newTargetIdx = reordered.findIndex(t => t.id === targetTaskId);
    const insertIdx = position === 'after' ? newTargetIdx + 1 : newTargetIdx;
    reordered.splice(insertIdx, 0, removed);

    reorderTasks(reordered.map(t => t.id));
    HapticService.selection();
  }, [visibleTasks, reorderTasks, sortBy]);

  // Calcular Resumen Financiero Total
  const totalCost = useMemo(() => {
    let sum = 0;
    visibleTasks.forEach(t => {
      if (t.price && !isTaskCompleted(t)) {
        sum += (Number(t.price) || 0) * (t.quantity || 1);
      }
    });
    return sum;
  }, [visibleTasks]);

  const activeVisibleCount = useMemo(() => visibleTasks.filter(t => !isTaskCompleted(t)).length, [visibleTasks]);
  const completedVisibleCount = useMemo(() => visibleTasks.filter(t => !isTaskCompleted(t) ? false : true).length, [visibleTasks]);

  const allTasksArray = useMemo(() => Object.values(tasks), [tasks]);
  const flashbackMemories = useMemo(() => 
    isQueHeHechoList(currentView, currentList) ? findFlashbackMemories(allTasksArray) : [], 
    [currentView, currentList, allTasksArray]
  );

  // Auto-inicializar secciones de Caducidades para cualquier lista que sea de caducidades
  useEffect(() => {
    if (currentList && isCaducidadesList(currentList.id, currentList)) {
      ensureCaducidadesSections(currentList.id, listSections, addListSection);
    }
  }, [currentList, listSections, addListSection]);

  const caducidadesStats = useMemo(() => {
    if (!isCaducidadesList(currentView, currentList)) return null;
    const targetCatId = currentList?.id || 'caducidades';
    const allCaducidades = Object.values(tasks).filter((t: any) => 
      !t.deleted_at && (
        t.categoryId === targetCatId || 
        (t as any).category_id === targetCatId || 
        t.categoryId === 'caducidades' ||
        isCaducidadesList(t.categoryId)
      )
    );
    const cards = allCaducidades.filter((t: any) => 
      t.expirationType === 'card' || 
      t.sectionId === 'sec_tarjetas' || 
      t.sectionId?.includes('tarjeta') ||
      /tarjeta|banco|dni|carnet|pasaporte/i.test(t.title)
    );
    const subs = allCaducidades.filter((t: any) => 
      t.expirationType === 'subscription' || 
      t.sectionId === 'sec_suscripciones' || 
      t.sectionId?.includes('suscrip') ||
      /suscrip|netflix|spotify|gimnasio|cloud|hosting/i.test(t.title)
    );
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
  }, [currentView, currentList, tasks]);

  const totalCompletedInCurrentView = useMemo(() => {
    const all = Object.values(tasks).filter(t => !t.deleted_at && isTaskCompleted(t));
    if (isSmartView) {
      if (currentView === 'smart_completed') return all.length;
      return 0;
    }
    if (isFolderView) {
      const folderId = currentView.replace('folder_', '').replace('list_', '');
      const descendantListIds = new Set<string>();
      const findDescendants = (parentId: string) => {
        lists?.forEach(l => {
          if (l.parentId === parentId) {
            descendantListIds.add(l.id);
            findDescendants(l.id);
          }
        });
      };
      findDescendants(folderId);
      return all.filter(t => {
        const catId = t.categoryId || (t as any).category_id;
        return catId && descendantListIds.has(catId);
      }).length;
    }
    if (isListView) {
      const targetCat = currentView.replace('list_', '');
      return all.filter(t => {
        const catId = t.categoryId || (t as any).category_id;
        return targetCat === 'inbox' ? (catId === 'inbox' || !catId) : catId === targetCat;
      }).length;
    }
    if (currentCycle) {
      return all.filter(t => t.cycle_id === currentCycle.id).length;
    }
    return 0;
  }, [tasks, currentView, isSmartView, isFolderView, isListView, lists, currentCycle]);

  // Handlers
  const handleToggleTask = useCallback((taskId: string, forceReverse?: boolean) => {
    const task = tasks[taskId];
    if (task) {
      const isTargetTask = Boolean(task.targetCount && task.targetCount > 1);
      const currentCount = task.currentCount || 0;
      const targetCount = task.targetCount || 1;
      const isDone = isTaskCompleted(task) || isCompletedInCurrentPeriod(task, cycles);

      let willBeCompleted = false;
      if (forceReverse) {
        willBeCompleted = false;
      } else if (isDone) {
        willBeCompleted = false;
      } else if (isTargetTask) {
        willBeCompleted = (currentCount + 1 >= targetCount);
      } else {
        willBeCompleted = true;
      }

      if (willBeCompleted) {
        setRecentlyCompletedIds(prev => [...prev, taskId]);
        setTimeout(() => {
          setRecentlyCompletedIds(prev => prev.filter(x => x !== taskId));
        }, 3000);

        if (activeVisibleCount === 1) {
          setShowCelebration(true);
          SoundService.playComplete();
          HapticService.notification('success');
          setTimeout(() => setShowCelebration(false), 3500);
        } else {
          SoundService.playComplete();
          HapticService.notification('success');
        }
      } else {
        SoundService.playUncomplete();
        HapticService.selection();
        setRecentlyCompletedIds(prev => prev.filter(x => x !== taskId));
      }
    }
    toggleTask(taskId, forceReverse);
  }, [tasks, cycles, toggleTask, activeVisibleCount]);

  const handleDeleteTask = useCallback((taskId: string) => {
    const task = tasks[taskId];
    if (!task) return;

    HapticService.selection();
    updateTask(taskId, { deleted_at: new Date().toISOString() });

    const timeoutId = window.setTimeout(() => {
      setDeletedToast(null);
    }, 6000);

    setDeletedToast({ id: taskId, title: task.title, timeoutId });
  }, [tasks, updateTask]);

  const isE2E = typeof window !== 'undefined' && Boolean(
    (window as any).__E2E__ ||
    (typeof navigator !== 'undefined' && navigator.webdriver) ||
    sessionStorage.getItem('__E2E__') === 'true'
  );

  const toggleCategory = useCallback((category: string) => {
    HapticService.selection();
    setCollapsed(prev => {
      const isCurrentlyCollapsed = prev[category] !== undefined ? prev[category] : !isE2E;
      return { ...prev, [category]: !isCurrentlyCollapsed };
    });
  }, [isE2E]);

  const isCatCollapsed = useCallback((category: string) => {
    if (isE2E) {
      return Boolean(collapsed[category]);
    }
    return collapsed[category] !== undefined ? collapsed[category] : true;
  }, [collapsed, isE2E]);

  const handleAddSection = useCallback((parentId?: string) => {
    if (!currentList) return;
    const { addListSection: storeAddSection } = useAppStore.getState();
    const existing = (listSections || []).filter(s => s.listId === currentList.id);
    const newSecId = `sec_${Date.now()}`;
    storeAddSection({
      id: newSecId,
      listId: currentList.id,
      name: 'Nueva Sección',
      parentId,
      order: existing.length
    });
    setEditingSectionId(newSecId);
    setEditingSectionName('Nueva Sección');
  }, [currentList, listSections]);

  const startEditingSection = useCallback((e: any, id: string, name: string) => {
    e.stopPropagation();
    setEditingSectionId(id);
    setEditingSectionName(name);
  }, []);

  const saveSectionName = useCallback((e?: any, id?: string) => {
    if (e && e.preventDefault) e.preventDefault();
    const targetId = id || editingSectionId;
    if (targetId && editingSectionName.trim()) {
      updateListSection(targetId, editingSectionName.trim());
    }
    setEditingSectionId(null);
    setEditingSectionName('');
  }, [editingSectionId, editingSectionName, updateListSection]);

  const updateTaskSection = useCallback((taskId: string, sectionId: string) => {
    updateTask(taskId, { sectionId });
    setDragOverSectionId(null);
    HapticService.selection();
  }, [updateTask]);

  const handleRenameSectionMenu = useCallback(() => {
    if (sectionMenu.sectionId && sectionMenu.sectionName) {
      setEditingSectionId(sectionMenu.sectionId);
      setEditingSectionName(sectionMenu.sectionName);
      setSectionMenu({ open: false, x: 0, y: 0 });
    }
  }, [sectionMenu]);

  const handleAddTaskMenu = useCallback(() => {
    if (sectionMenu.sectionId) {
      onOpenNewTask(sectionMenu.sectionId);
      setSectionMenu({ open: false, x: 0, y: 0 });
    }
  }, [sectionMenu, onOpenNewTask]);

  const handleDeleteSectionMenu = useCallback(async () => {
    const sectionId = sectionMenu.sectionId;
    if (!sectionId) return;
    setSectionMenu({ open: false, x: 0, y: 0 });
    const ok = await confirmDialog({
      title: 'Eliminar sección',
      message: 'La sección desaparecerá, pero sus recordatorios se conservarán sin sección.',
      confirmText: 'Eliminar',
    });
    if (ok) deleteListSection(sectionId);
  }, [sectionMenu, deleteListSection]);

  // 1. Flatten Data para Virtualización (QA Performance Optimization)
  const flattenedData = useMemo(() => {
    const flat: VirtualItemType[] = [{ type: 'page-header' }];
    
    // Up Next (Solo en el ciclo más corto, e.g. cycle_day)
    if (currentCycle && currentCycle.daysValue === 1 && smartTasks.length > 0) {
      const prioritizedTasks = smartTasks.filter(t => t.flagged || t.priority === 'high' || t.priority === 'medium');
      if (prioritizedTasks.length > 0) {
        flat.push({ type: 'header', title: 'Up Next (Priorizado)', category: 'smart', color: '#0a84ff', depth: 0 });
        if (!isCatCollapsed('smart')) {
          prioritizedTasks.slice(0, 2).forEach(task => flat.push({ type: 'task', task, depth: 0, isUpNext: true } as any));
        }
      }
    }

    // Categorías (Si estamos en ciclo o carpeta) o Ciclos/Secciones (Si estamos en Lista)
    if (currentView === 'TRASH') {
      const trashTasks = (groupedTasks['Papelera'] || []).sort((a, b) => {
        const dA = a.deleted_at ? new Date(a.deleted_at).getTime() : 0;
        const dB = b.deleted_at ? new Date(b.deleted_at).getTime() : 0;
        return dB - dA;
      });
      trashTasks.forEach((task) => {
        flat.push({ type: 'task', task, depth: 0 });
      });
    } else if (!isListView) {
      Object.entries(groupedTasks).forEach(([categoryOrCycle, categoryTasks]) => {

        let color = '#34c759';
        let headerTitle = categoryOrCycle;
        let headerDepth = 0;

        if (categoryOrCycle === 'primeros_pasos' || categoryOrCycle === 'Guía de inicio' || currentView === 'smart_primeros_pasos') {
          headerTitle = 'Guía de inicio';
          color = '#ff2d55';
        } else if (categoryOrCycle === 'inbox' || categoryOrCycle === 'undefined' || !categoryOrCycle) {
          headerTitle = 'Sin lista';
          color = '#8e8e93';
        } else {
          const catObj = lists?.find(l => l.id === categoryOrCycle);
          if (catObj) { headerTitle = catObj.name; color = catObj.color; }
          else if (categoryOrCycle === 'tod_morning') { headerTitle = 'Mañana'; color = '#FF9500'; }
          else if (categoryOrCycle === 'tod_afternoon') { headerTitle = 'Tarde'; color = '#007AFF'; }
          else if (categoryOrCycle === 'tod_night') { headerTitle = 'Noche'; color = '#5856D6'; }
          else if (categoryOrCycle === 'tod_none') { headerTitle = 'Cualquier momento'; color = '#8e8e93'; }
          else { headerTitle = categoryOrCycle === 'Sin Lista' ? 'Sin lista' : categoryOrCycle; color = '#8e8e93'; }
        }

        // Lógica de rutina acumulativa cuando se pulsa "Ocultar el resto"
        const sectionPeriodicity = getSectionPeriodicity(categoryOrCycle, headerTitle, listSections, lists);
        let tasksToRender = categoryTasks;
let routineCounts = null;
            flat.push({ 
          type: 'header', 
          title: headerTitle, 
          category: categoryOrCycle, 
          color, 
          depth: headerDepth,
          periodicity: sectionPeriodicity,
          routineCounts,
          sectionTaskIds: tasksToRender.filter(t => !isTaskCompleted(t)).map(t => t.id)
        });
        
        if (!isCatCollapsed(categoryOrCycle)) {
          const renderSectionTreeForTasks = (tasksInScope: TaskItem[], listId: string, baseDepth: number, parentColor: string) => {
            const sectionsForList = (listSections || []).filter(s => s.listId === listId && !s.deleted_at);
            const tasksBySectionId = new Set(tasksInScope.map(t => t.id));

            // 1. Uncategorized tasks in scope
            const uncategorized = tasksInScope.filter(t => !t.sectionId || !sectionsForList.some(s => s.id === t.sectionId));
            if (uncategorized.length > 0) {
              const roots = uncategorized.filter(t => !t.parentId || !tasksBySectionId.has(t.parentId));
              const processNode = (task: TaskItem, depthLevel: number) => {
                flat.push({ type: 'task', task, depth: depthLevel });
                if (!isCatCollapsed(`task_${task.id}`)) {
                  const children = uncategorized.filter(t => t.parentId === task.id);
                  children.forEach(c => processNode(c, depthLevel + 1));
                }
              };
              roots.forEach(r => processNode(r, baseDepth));
            }

            // 2. Sections in scope
            const renderSectionBranch = (secId: string, depthLevel: number) => {
              const sec = sectionsForList.find(s => s.id === secId);
              if (!sec) return;
              const secTasks = tasksInScope.filter(t => t.sectionId === secId);
              const secKey = `sec_${sec.id}`;
              
              flat.push({ type: 'header', title: sec.name, category: secKey, color: parentColor, sectionId: sec.id, depth: depthLevel });
              
              if (!isCatCollapsed(secKey)) {
                if (secTasks.length === 0) {
                  flat.push({ type: 'empty-section', title: 'Aquí no hay tareas', category: secKey, color: parentColor, sectionId: sec.id, depth: depthLevel });
                } else {
                  const roots = secTasks.filter(t => !t.parentId || !tasksBySectionId.has(t.parentId));
                  const processNode = (task: TaskItem, d: number) => {
                    flat.push({ type: 'task', task, depth: d });
                    if (!isCatCollapsed(`task_${task.id}`)) {
                      const children = secTasks.filter(t => t.parentId === task.id);
                      children.forEach(c => processNode(c, d + 1));
                    }
                  };
                  roots.forEach(r => processNode(r, depthLevel));
                }

                // Child sections
                const children = sectionsForList.filter(s => s.parentId === sec.id);
                children.forEach(c => renderSectionBranch(c.id, depthLevel + 1));
              }
            };

            const rootSections = sectionsForList.filter(s => !s.parentId);
            rootSections.forEach(r => renderSectionBranch(r.id, baseDepth));
          };

          if (currentCycle && currentCycle.daysValue > 1) {
            const cycleIdsInGroup = Array.from(new Set(tasksToRender.map(t => t.cycle_id).filter(Boolean))) as string[];
            const sortedCycleIds = cycleIdsInGroup.sort((a, b) => {
              const cA = useAppStore.getState().cycles.find(c => c.id === a)?.daysValue || 0;
              const cB = useAppStore.getState().cycles.find(c => c.id === b)?.daysValue || 0;
              return cA - cB;
            });

            sortedCycleIds.forEach(cId => {
              const cObj = useAppStore.getState().cycles.find(c => c.id === cId);
              const cName = cObj ? cObj.name : cId;
              const cycleSepKey = `cycle_sep_${categoryOrCycle}_${cId}`;
              flat.push({ type: 'header', title: cName, titleIcon: <Hourglass size={14} />, category: cycleSepKey, color: '#0a84ff', depth: 1 });

              if (!isCatCollapsed(cycleSepKey)) {
                const cTasks = tasksToRender.filter(t => t.cycle_id === cId);
                renderSectionTreeForTasks(cTasks, categoryOrCycle, 2, color);
              }
            });
          } else {
            renderSectionTreeForTasks(tasksToRender, categoryOrCycle, 0, color);
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
          let headerIcon: ReactNode = undefined;
          if (groupKey.startsWith('persona_')) {
            const pName = groupKey.replace('persona_', '');
            if (groupKey === 'persona_solo') {
              headerTitle = 'Individual / Sin personas';
              headerIcon = <User size={15} />;
            } else {
              headerTitle = pName;
              headerIcon = <Users size={15} />;
            }
          } else if (groupKey.startsWith('timeline_')) {
            const parts = groupKey.replace('timeline_', '').split('_');
            const y = parts[0];
            const m = parseInt(parts[1], 10) - 1;
            headerTitle = `${monthNames[m] || ''} ${y}`;
            headerIcon = <Hourglass size={14} />;
          }

          flat.push({
            type: 'header',
            title: headerTitle,
            titleIcon: headerIcon,
            category: groupKey,
            color: '#5856D6',
            depth: 0,
            sectionTaskIds: groupTasks.filter(t => !isTaskCompleted(t)).map(t => t.id)
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
            const cId = catKey.replace('cycle_', '');
            const cObj = allCycles.find(c => c.id === cId);
            const cName = cObj ? cObj.name : cId;
            const categoryTasks = groupedTasks[catKey] || [];

            const sectionPeriodicity = getSectionPeriodicity(catKey, cName, listSections, lists);
            let tasksToRender = categoryTasks;
let routineCounts = null;
            flat.push({
              type: 'header',
              title: cName,
              titleIcon: <Hourglass size={14} />,
              category: catKey,
              color,
              depth: 0,
              periodicity: sectionPeriodicity,
              routineCounts,
              sectionTaskIds: tasksToRender.filter(t => !isTaskCompleted(t)).map(t => t.id)
            });
            if (!isCatCollapsed(catKey)) {
              if (tasksToRender.length === 0) {
                flat.push({ type: 'empty-section', title: 'Aquí no hay tareas', category: catKey, color, depth: 0 });
              } else {
                const roots = tasksToRender.filter(t => !t.parentId);
                const processNode = (task: TaskItem, depthLevel: number) => {
                  flat.push({ type: 'task', task, depth: depthLevel });
                  if (!isCatCollapsed(`task_${task.id}`)) {
                    const children = tasksToRender.filter(t => t.parentId === task.id);
                    children.forEach(c => processNode(c, depthLevel + 1));
                  }
                };
                roots.forEach(r => processNode(r, 0));
              }
            }
          });
        }

        // 3. Sections Hierarchy (Secciones Manuales)
        const sectionsForList = (listSections || [])
          .filter(s => s.listId === currentList?.id && !s.deleted_at)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        
        const processSection = (secId: string, depth: number) => {
          const sec = sectionsForList.find(s => s.id === secId);
          if (!sec) return;
          
          const categoryKey = `section_${sec.id}`;

          const categoryTasks = groupedTasks[categoryKey] || [];
          const sectionPeriodicity = getSectionPeriodicity(categoryKey, sec.name, listSections, lists);
          let tasksToRender = categoryTasks;
let routineCounts = null;
            // Si se está filtrando por temporalidad (ej. solo semanales o solo diarias)
          // y esta sección no tiene tareas que cumplan el filtro, no mostrar la sección vacía
          if (listSectionFilter !== 'all' && tasksToRender.length === 0) {
            return;
          }

          // Evitar duplicar secciones vacías manuales si ya se muestra una sección dinámica con un ciclo equivalente
          const isDuplicateEmpty = tasksToRender.length === 0 && presentCycleKeys.some(k => {
            const cName = allCycles.find(c => c.id === k.replace('cycle_', ''))?.name || '';
            const normSec = sec.name.toLowerCase();
            const normCycle = cName.toLowerCase();
            return normSec.slice(0, 4) === normCycle.slice(0, 4) || normSec.includes(normCycle) || normCycle.includes(normSec);
          });
          if (isDuplicateEmpty) return;

          flat.push({ 
            type: 'header', 
            title: formatSectionTitle(sec.name), 
            category: categoryKey, 
            color, 
            sectionId: sec.id, 
            depth,
            periodicity: sectionPeriodicity,
            routineCounts,
            sectionTaskIds: tasksToRender.filter(t => !isTaskCompleted(t)).map(t => t.id)
          });
          
          if (!isCatCollapsed(categoryKey)) {
            if (tasksToRender.length === 0) {
              flat.push({ type: 'empty-section', title: 'Aquí no hay tareas', category: categoryKey, color, sectionId: sec.id, depth });
            } else {
              const roots = tasksToRender.filter(t => !t.parentId);
              const processNode = (task: TaskItem, depthLevel: number) => {
                flat.push({ type: 'task', task, depth: depthLevel });
                if (!isCatCollapsed(`task_${task.id}`)) {
                  const children = tasksToRender.filter(t => t.parentId === task.id);
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
  }, [groupedTasks, smartTasks, currentCycle, collapsed, isListView, lists, listSections, currentList, isCatCollapsed, isolatedSectionKey, isolatedRoutineMode, sectionRoutineModes]);

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
    if (item.type === 'header') return `header-${item.category || ''}-${item.sectionId || ''}-${item.title || ''}`;
    if (item.type === 'empty-section') return `empty-${item.category || ''}-${item.sectionId || ''}`;
    if (item.type === 'task') return (item as any).isUpNext ? `task-upnext-${item.task.id}-${index}` : `task-${item.task.id}-${index}`;
    return index;
  }, []);

  const renderTask = useCallback((task: TaskItem, itemStyle: React.CSSProperties, index: number, depth: number, isFirst: boolean, isLast: boolean, previousTaskId?: string, itemKey?: React.Key) => {
    const hasChildren = parentIdsWithChildren.has(task.id);
    const isExpanded = !isCatCollapsed(`task_${task.id}`);
    const taskIdxInVisible = visibleIndexById.get(task.id) ?? -1;
    const canMoveUp = taskIdxInVisible > 0;
    const canMoveDown = taskIdxInVisible >= 0 && taskIdxInVisible < visibleTasks.length - 1;

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
            // Las tareas se agrupan bajo la cabecera de su lista: repetirla en cada fila sobra.
            showListName={false}
            hideDueDate={currentView === 'smart_today'}
            isFirstInSection={isFirst}
            isLastInSection={isLast}
            previousTaskId={previousTaskId}
            onNavigateView={onSelectView}
            onPersonClick={(p) => setSelectedPersonForProfile(p)}
            isGracePeriod={recentlyCompletedIds.includes(task.id)}
            onMoveUp={handleMoveTaskUp}
            onMoveDown={handleMoveTaskDown}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            onReorderTasks={handleReorderTasks}
            {...({
              hasChildren,
              isExpanded,
              onToggleExpand: () => toggleCategory(`task_${task.id}`)
            } as any)}
          />
        </div>
      </motion.div>
    );
  }, [parentIdsWithChildren, visibleIndexById, isCatCollapsed, toggleCategory, handleToggleTask, handleDeleteTask, onOpenZenMode, onEditTask, onSelectView, isSmartView, currentView, setSelectedPersonForProfile, recentlyCompletedIds, visibleTasks, handleMoveTaskUp, handleMoveTaskDown, handleReorderTasks]);

  const CycleIcon = currentCycle ? getCycleIcon(currentCycle.icon) : null;
  const smartListInfo = isSmartView ? SMART_LISTS.find(l => l.id === currentView) : null;
  const SmartIcon = smartListInfo ? smartListInfo.icon : null;
  const viewColor = isSmartView ? (smartListInfo?.color || SMART_COLORS[currentView] || 'var(--accent-primary)') : (isListView && currentList) ? (currentList.color || 'var(--accent-primary)') : isFolderView ? (lists?.find(l => l.id === currentView.replace('folder_', ''))?.color || 'var(--accent-primary)') : 'var(--accent-primary)';

  const getTitle = () => {
    if (isSmartView) return smartListInfo?.name || 'Recordatorios';
    if (isFolderView) return currentList?.name || 'Carpeta';
    if (isListView) {
      if (currentList) return currentList.name;
      // La Bandeja de entrada es una lista virtual: no tiene objeto propio en `lists`.
      return currentView === 'list_inbox' ? 'Bandeja de entrada' : 'Lista';
    }
    return currentCycle?.name || 'Ciclos';
  };

  return (
    <main className="main-content" style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', overflowX: 'hidden', overscrollBehaviorX: 'none', position: 'relative' }}>
      {/* Sticky Glass Top Bar */}
      <MainGlassHeader
        isScrolled={isScrolled}
        isMobile={isMobile}
        onBackToSidebar={onBackToSidebar}
        isSmartView={isSmartView}
        isListView={isListView}
        isFolderView={isFolderView}
        currentView={currentView}
        currentList={currentList}
        title={getTitle()}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        resolvedShowCompleted={resolvedShowCompleted}
        toggleShowCompleted={toggleShowCompleted}
        sortBy={sortBy}
        setSortBy={setSortBy}
        updateList={updateList}
        setIsListConfigOpen={setIsListConfigOpen}
        onAddSection={handleAddSection}
        completedCount={totalCompletedInCurrentView || completedVisibleCount}
        onStartSequence={onStartSequence ? () => {
          const pendingTasks = visibleTasks.filter(t => !isTaskCompleted(t));
          if (pendingTasks.length > 0) {
            onStartSequence(pendingTasks.map(t => t.id), getTitle(), viewColor);
          }
        } : undefined}
      />

      {/* Main Scrollable View */}
      {(() => {
        const hasSections = flattenedData.some(item => item.type === 'header' || item.type === 'empty-section');
        const isActuallyEmpty = visibleTasks.length === 0 && smartTasks.length === 0 && !hasSections;
        return (
          <div 
            ref={parentRef}
            className="content-scroll" 
            data-testid="content-scroll-container"
            onScroll={(e) => {
              const top = e.currentTarget.scrollTop;
              setIsScrolled(top > 20);
            }}
            style={{
              flex: 1,
              overflowY: isActuallyEmpty ? 'hidden' : 'auto',
              overflowX: 'hidden',
              width: '100%',
              overscrollBehaviorY: isActuallyEmpty ? 'none' : 'contain',
              touchAction: isActuallyEmpty ? 'none' : 'auto',
              WebkitOverflowScrolling: 'touch',
              position: 'relative',
              display: isActuallyEmpty ? 'flex' : 'block',
              flexDirection: isActuallyEmpty ? 'column' : undefined
            }}
          >
            <div style={{
              width: '100%',
              position: 'relative',
              paddingBottom: isActuallyEmpty ? 0 : 'calc(110px + env(safe-area-inset-bottom, 0px))',
              boxSizing: 'border-box',
              flex: isActuallyEmpty ? 1 : undefined,
              display: isActuallyEmpty ? 'flex' : undefined,
              flexDirection: isActuallyEmpty ? 'column' : undefined
            }}>
              {flattenedData.map((item, index) => {
                const data = item as any;
                const itemKey = getItemKey(item, index);
                const itemStyle: React.CSSProperties = {
                  width: '100%',
                  boxSizing: 'border-box'
                };

                if (data.type === 'page-header') {
                  return (
                    <div key={itemKey} data-index={index} style={{ ...itemStyle, padding: 0 }}>
                      <MainPageHeader
                        isMobile={isMobile}
                        onBackToSidebar={onBackToSidebar}
                        currentList={currentList}
                        setIsListConfigOpen={setIsListConfigOpen}
                        viewColor={viewColor}
                        CycleIcon={CycleIcon}
                        SmartIcon={SmartIcon}
                        smartListInfo={smartListInfo}
                        isEditingCycle={isEditingCycle}
                        currentCycle={currentCycle}
                        cycleEditName={cycleEditName}
                        setCycleEditName={setCycleEditName}
                        updateCycle={updateCycle}
                        setIsEditingCycle={setIsEditingCycle}
                        getTitle={getTitle}
                        currentView={currentView}
                        totalCost={totalCost}
                        activeVisibleCount={activeVisibleCount}
                        completedVisibleCount={completedVisibleCount}
                        setConfirmProps={setConfirmProps}
                        setIsConfirmOpen={setIsConfirmOpen}
                        deleteCycle={deleteCycle}
                        sortBy={sortBy}
                        setSortBy={setSortBy}
                        lifeLogViewMode={lifeLogViewMode}
                        setLifeLogViewMode={setLifeLogViewMode}
                        handleOpenMonthlySummary={handleOpenMonthlySummary}
                        allTasksArray={allTasksArray}
                        extractPeopleFromText={extractPeopleFromText}
                        selectedPersonFilter={selectedPersonFilter}
                        setSelectedPersonFilter={setSelectedPersonFilter}
                        flashbackMemories={flashbackMemories}
                        onEditTask={onEditTask}
                        caducidadesStats={caducidadesStats}
                        onStartSequence={onStartSequence ? () => {
                          const pendingTasks = visibleTasks.filter(t => !isTaskCompleted(t));
                          if (pendingTasks.length > 0) {
                            onStartSequence(pendingTasks.map(t => t.id), getTitle(), viewColor);
                          }
                        } : undefined}
                      />
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
              const sectionPendingTaskIds = data.sectionTaskIds || sectionTasks.filter(t => !isTaskCompleted(t)).map(t => t.id);
              return (
                <MainSectionHeader
                  key={itemKey}
                  data={data}
                  itemKey={itemKey}
                  index={index}
                  itemStyle={itemStyle}
                  showDivider={showDivider}
                  isCustomSection={isCustomSection}
                  isDraggingOver={isDraggingOver}
                  isCatCollapsed={isCatCollapsed}
                  toggleCategory={toggleCategory}
                  sectionMenuId={sectionMenuId}
                  setSectionMenuId={setSectionMenuId}
                  setDragOverSectionId={setDragOverSectionId}
                  updateTaskSection={updateTaskSection}
                  setSectionMenu={setSectionMenu}
                  sectionMenu={sectionMenu}
                  sectionTouchTimer={sectionTouchTimer}
                  editingSectionId={editingSectionId}
                  editingSectionName={editingSectionName}
                  setEditingSectionName={setEditingSectionName}
                  saveSectionName={saveSectionName}
                  startEditingSection={startEditingSection}
                  setSelectedPersonForProfile={setSelectedPersonForProfile}
                  sectionTotal={sectionTotal}
                  onOpenNewTask={onOpenNewTask}
                  onAddSection={handleAddSection}
                  deleteListSection={deleteListSection}
                  isolatedSectionKey={isolatedSectionKey}
                  setIsolatedSectionKey={setIsolatedSectionKey}
                  isolatedRoutineMode={isolatedRoutineMode}
                  setIsolatedRoutineMode={setIsolatedRoutineMode}
                  sectionRoutineModes={sectionRoutineModes}
                  toggleSectionRoutineMode={toggleSectionRoutineMode}
                  dragOverSectionId={dragOverSectionId}
                  onStartSectionSequence={onStartSequence && sectionPendingTaskIds.length > 0 ? () => {
                    const rawTitle = data.title.replace(/^[\p{Emoji}\s⏳]+/gu, '').trim() || data.title;
                    const cleanTitle = rawTitle.length > 0 
                      ? rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1).toLowerCase() 
                      : 'Sección';
                    const seqTitle = currentList ? `${currentList.name} · ${cleanTitle}` : cleanTitle;
                    onStartSequence(sectionPendingTaskIds, seqTitle, data.color);
                  } : undefined}
                  pendingTaskCount={sectionPendingTaskIds.length}
                  isMobile={isMobile}
                />
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
                    margin: '6px 0 14px 0',
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 6
                  }}
                >
                  <span style={{ fontSize: '0.84rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                    {data.title || 'Aquí no hay tareas'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      HapticService.selection();
                      onOpenNewTask(data.sectionId);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 0',
                      background: 'transparent',
                      border: 'none',
                      color: data.color || 'var(--accent-primary)',
                      fontSize: '0.86rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'opacity 0.15s ease'
                    }}
                    title="Añadir un nuevo recordatorio a esta sección"
                  >
                    <Plus size={16} strokeWidth={2.2} />
                    <span>Nuevo recordatorio</span>
                  </button>
                </div>
              );
            } else if (data.type === 'task') {
              const previousTaskId = index > 0 && flattenedData[index - 1]?.type === 'task' 
                ? (flattenedData[index - 1] as any).task.id 
                : undefined;

              return renderTask(
                data.task, 
                itemStyle, 
                index, 
                data.depth, 
                !!data.isFirstInSection, 
                !!data.isLastInSection, 
                previousTaskId, 
                itemKey
              );
            }

            return null;
          })}

          {/* Quick inline row to add a task natively */}
          <MainInlineAdd
            currentView={currentView}
            viewColor={viewColor}
            isInlineAdding={isInlineAdding}
            setIsInlineAdding={setIsInlineAdding}
            inlineTitle={inlineTitle}
            setInlineTitle={setInlineTitle}
            inlineInputRef={inlineInputRef}
          />

          {isActuallyEmpty && (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              minHeight: 0,
              paddingBottom: 'calc(60px + env(safe-area-inset-bottom, 0px))',
              boxSizing: 'border-box'
            }}>
              <div style={{ width: '100%', maxWidth: 420, padding: '0 16px' }}>
                <MainEmptyState
                  currentView={currentView}
                  currentList={currentList}
                  currentCycle={currentCycle}
                  onOpenNewTask={onOpenNewTask}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  })()}

      <ListConfigModal 
        isOpen={isListConfigOpen} 
        onClose={() => setIsListConfigOpen(false)} 
        listId={currentList?.id} 
      />

      <ConfirmModal
        isOpen={isConfirmOpen}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={() => { confirmProps.onConfirm(); setIsConfirmOpen(false); }}
        title={confirmProps.title}
        message={confirmProps.message}
      />

      <DeletedTaskToast
        toast={deletedToast}
        onUndo={(id) => {
          updateTask(id, { deleted_at: undefined });
          setDeletedToast(null);
        }}
        onDismiss={() => setDeletedToast(null)}
      />

      <SectionContextMenu
        sectionMenu={sectionMenu}
        onClose={() => setSectionMenu({ open: false, x: 0, y: 0 })}
        onRename={handleRenameSectionMenu}
        onAddTask={handleAddTaskMenu}
        onAddNestedSection={currentList && !currentList.isFolder ? () => {
          if (sectionMenu.sectionId) {
            handleAddSection(sectionMenu.sectionId);
            if (sectionMenu.category && isCatCollapsed(sectionMenu.category)) {
              toggleCategory(sectionMenu.category);
            }
          }
        } : undefined}
        onStartSequence={onStartSequence ? () => {
          if (sectionMenu.category) {
            const sectionTasks = groupedTasks[sectionMenu.category] || [];
            const pendingIds = sectionTasks.filter(t => !isTaskCompleted(t)).map(t => t.id);
            if (pendingIds.length > 0) {
              const rawTitle = (sectionMenu.sectionName || '').replace(/^[\p{Emoji}\s⏳]+/gu, '').trim() || sectionMenu.sectionName || 'Sección';
              const cleanTitle = rawTitle.length > 0 
                ? rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1).toLowerCase() 
                : 'Sección';
              const seqTitle = currentList ? `${currentList.name} · ${cleanTitle}` : cleanTitle;
              onStartSequence(pendingIds, seqTitle, sectionMenu.color);
            }
          }
        } : undefined}
        onDelete={handleDeleteSectionMenu}
      />

      {showCelebration && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            style={{
              position: 'fixed',
              top: '20%',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.85)',
              color: 'white',
              padding: '16px 24px',
              borderRadius: '24px',
              backdropFilter: 'blur(20px)',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
              pointerEvents: 'none'
            }}
          >
            <span style={{ display: 'flex', width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <PartyPopper size={17} color="#ffd60a" strokeWidth={2.2} />
            </span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '15px' }}>¡Todo completado!</div>
              <div style={{ fontSize: '12px', opacity: 0.8 }}>Gran trabajo por hoy</div>
            </div>
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

      <MonthlySummaryModal
        modal={monthlySummaryModal}
        onClose={() => setMonthlySummaryModal(prev => ({ ...prev, open: false }))}
      />

      {currentView !== 'TRASH' && (
        <>
          {/* Capa de desenfoque y degradado inferior para controles flotantes */}
          <div
            className="bottom-floating-glass-bar"
            aria-hidden="true"
          />

          <div
            className="bottom-dock-container"
            style={{
              position: 'absolute',
              bottom: 'max(18px, env(safe-area-inset-bottom))',
              left: 0,
              right: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              padding: '0 20px',
              pointerEvents: 'none',
              zIndex: 42,
              boxSizing: 'border-box'
            }}
          >
            <div style={{ flex: 1, maxWidth: 560, minWidth: 0, pointerEvents: 'auto' }}>
              <QuickAddBar currentView={currentView} onExpandDrawer={() => onOpenNewTask()} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'auto', flexShrink: 0 }}>
              <BottomShortcutBar />
              <motion.button
                type="button"
                data-testid="desktop-fab"
                className="desktop-fab"
                onClick={() => onOpenNewTask()}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                title="Añadir nuevo recordatorio (N)"
                aria-label="Añadir nuevo recordatorio"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: 'var(--accent-primary, #007AFF)',
                  color: '#ffffff',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(0, 122, 255, 0.4)',
                  padding: 0,
                  flexShrink: 0
                }}
              >
                <Plus size={22} strokeWidth={2.4} />
              </motion.button>
            </div>
          </div>
        </>
      )}

      <DeletedTaskToast
        toast={deletedToast}
        onUndo={handleUndoDelete}
        onDismiss={() => {
          if (deletedToast?.timeoutId) window.clearTimeout(deletedToast.timeoutId);
          setDeletedToast(null);
        }}
      />
    </main>
  );
}
