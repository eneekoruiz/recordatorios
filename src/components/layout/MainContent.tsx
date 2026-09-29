import { useState, useRef, useMemo, useCallback, useEffect, lazy, Suspense, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Plus, User, Users, PartyPopper, UtensilsCrossed, ShowerHead, BedDouble, DoorOpen, Flower2, House } from 'lucide-react';
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
import { AIService } from '../../services/AIService';
import { isCaducidadesList, isQueHeHechoList, ensureCaducidadesSections, isLimpiezaList, isRoutineList, isShoppingList, getRoomForCleaningTask, getListType, doesListSupportSequenceMode } from '../../utils/specialLists';
import { 
  getSectionPeriodicity, 
  getTaskPeriodicity, 
  getEffectiveCycleId,
  getRoutineAllowedPeriodicities, 
  getPureCyclicPeriodicity,
  sortTasksByUserPreference,
  formatSectionTitle,
  type PeriodicityType 
} from '../../utils/sectionRoutine';
import { MainEmptyState } from './main/MainEmptyState';
import { MainGlassHeader } from './main/MainGlassHeader';
import { MainSectionHeader } from './main/MainSectionHeader';
import { DeletedTaskToast } from './main/DeletedTaskToast';
import { SectionContextMenu, type SectionMenuState } from './main/SectionContextMenu';
import { MainPageHeader } from './main/MainPageHeader';
import { DailyBriefingBanner } from './DailyBriefingBanner';
// Solo se necesitan al abrir el calendario, un perfil o el resumen del mes: no viajan con el arranque.
const CalendarView = lazy(() => import('../views/CalendarView').then((m) => ({ default: m.CalendarView })));
const PersonProfileModal = lazy(() => import('../people/PersonProfileModal').then((m) => ({ default: m.PersonProfileModal })));
const MonthlySummaryModal = lazy(() => import('./main/MonthlySummaryModal').then((m) => ({ default: m.MonthlySummaryModal })));
import { smartSortTasks } from '../../utils/smartSort';
import { WeeklyStreakWidget } from './main/WeeklyStreakWidget';
import { confirmDialog } from '../ui/confirmDialog';
import { deduplicateTaskList } from '../../utils/taskDeduplication';
import { showUndoToast } from '../../utils/undoToast';
import { buildRoutineParts, buildMixParts, type RoutinePart } from '../../utils/routineBreakdown';
import { calculateTasksDuration, calculateCompletedTasksDuration, getTaskDuration, type TasksDurationSummary } from '../../utils/taskDuration';
import { getReservedFrequencyColor } from '../../constants/colors';
import { BatchTaskActionsBar } from '../tasks/BatchTaskActionsBar';
import { downloadIcsFile } from '../../utils/icsExporter';
import { exportReportToPdf } from '../../utils/pdfExport';
import { parseTaskPrice } from '../../utils/format';

interface MainContentProps {
  currentView: string;
  onOpenNewTask: (sectionId?: string, initialTitle?: string) => void;
  onOpenZenMode: (taskId: string) => void;
  onEditTask?: (taskId: string, initialFocus?: string) => void;
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
      routineDurations?: { only: TasksDurationSummary; full: TasksDurationSummary } | null,
      routineParts?: RoutinePart[] | null,
      routineMode?: 'full_routine' | 'only_section',
      sectionTaskIds?: string[],
      /** Pendientes de esta cabecera (con las incluidas ya mezcladas, si «+ Diarias» está activo). */
      pendingCount?: number
    }
  | { type: 'empty-section', title: string, category: string, color: string, sectionId?: string, depth: number, isFirstInSection?: boolean, isLastInSection?: boolean }
  | { type: 'task', task: TaskItem, depth: number, isFirstInSection?: boolean, isLastInSection?: boolean };


const getRoomIcon = (key: string): ReactNode => {
  switch (key) {
    case 'cocina': return <UtensilsCrossed size={14} />;
    case 'bano': return <ShowerHead size={14} />;
    case 'habitacion': return <BedDouble size={14} />;
    case 'pasillo': return <DoorOpen size={14} />;
    case 'balcon': return <Flower2 size={14} />;
    case 'general': return <House size={14} />;
    default: return undefined;
  }
};

const NOOP = () => {};

const SMART_COLORS: Record<string, string> = {
  'smart_today': 'var(--accent-blue)',
  'smart_scheduled': 'var(--accent-red)',
  'smart_all': 'var(--text-secondary)',
  'smart_flagged': 'var(--accent-orange)',
  'smart_completed': 'var(--text-tertiary)',
  'smart_overdue': 'var(--accent-red)',
  'smart_calendar': '#5856d6'
};

export function MainContent({ currentView, onOpenNewTask, onOpenZenMode, onEditTask, onBackToSidebar, onSelectView, isMobile, onStartSequence }: MainContentProps) {
  // Store selectors
  const tasks = useAppStore((state) => state.tasks);
  const allTasksArray = useMemo(() => Object.values(tasks), [tasks]);
  const lists = useAppStore((state) => state.lists);
  const listSections = useAppStore((state) => state.listSections);
  const cycles = useAppStore((state) => state.cycles);
  const updateTask = useAppStore((state) => state.updateTask);
  const reorderTasks = useAppStore((state) => state.reorderTasks);
  const updateList = useAppStore((state) => state.updateList);
  const addListSection = useAppStore((state) => state.addListSection);
  const updateListSection = useAppStore((state) => state.updateListSection);
  const deleteListSection = useAppStore((state) => state.deleteListSection);
  const reorderListSections = useAppStore((state) => state.reorderListSections);
  const duplicateSection = useAppStore((state) => state.duplicateSection);
  const emptySection = useAppStore((state) => state.emptySection);
  const moveSectionTasks = useAppStore((state) => state.moveSectionTasks);
  const setSectionTasksCompleted = useAppStore((state) => state.setSectionTasksCompleted);
  const updateCycle = useAppStore((state) => state.updateCycle);
  const deleteCycle = useAppStore((state) => state.deleteCycle);
  const toggleTask = useAppStore((state) => state.toggleTask);
  const getTasksByList = useAppStore((state) => state.getTasksByList);
  const getTasksByCycle = useAppStore((state) => state.getTasksByCycle);

  // Local state
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
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

  // Quick long press timer for section options

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
  const [sectionRoutineModes, setSectionRoutineModes] = useState<Record<string, 'full_routine' | 'only_section'>>(() => {
    try {
      const saved = localStorage.getItem('section_routine_modes');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const toggleSectionRoutineMode = useCallback((secKey: string, mode: 'full_routine' | 'only_section') => {
    setSectionRoutineModes(prev => {
      const next = { ...prev, [secKey]: mode };
      try { localStorage.setItem('section_routine_modes', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // Modo general por ciclo/frecuencia ('only_section' o 'full_routine')
  const [cycleGeneralModes, setCycleGeneralModes] = useState<Record<string, 'only_section' | 'full_routine'>>(() => {
    try {
      const saved = localStorage.getItem('cycle_general_modes');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

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

  // Resetear filtros al cambiar de vista o lista (durante el render: sin un pintado intermedio)
  const [filtersView, setFiltersView] = useState(currentView);
  if (filtersView !== currentView) {
    setFiltersView(currentView);
    setListSectionFilter('all');
    setDailyTimeFilter('all');
    setIsolatedSectionKey(null);
    setIsolatedRoutineMode('full_routine');
    setSelectedPersonFilter(null);
    setCollapsed({});
  }

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

const CORE_CYCLES = [
  { id: 'cycle_day', name: 'Diario', daysValue: 1, isPinned: true, icon: 'sun' },
  { id: 'cycle_week', name: 'Semanal', daysValue: 7, isPinned: true, icon: 'calendar' },
  { id: 'cycle_month', name: 'Mensual', daysValue: 30, isPinned: true, icon: 'moon' },
  { id: 'cycle_year', name: 'Anual', daysValue: 365, isPinned: true, icon: 'globe' },
];

  // Determinar el contexto actual
  const isSmartView = currentView.startsWith('smart_');
  const isCalendarView = currentView === 'smart_calendar';
  const isListView = currentView.startsWith('list_') && !lists?.find(l => l.id === currentView.replace('list_', ''))?.isFolder;
  const isFolderView = currentView.startsWith('folder_') || !!lists?.find(l => l.id === currentView.replace('list_', ''))?.isFolder;
  const currentList = lists?.find((l) => l.id === currentView.replace('list_', '').replace('folder_', ''));
  const currentCycle = (cycles || []).find((c) => c.id === currentView) || (CORE_CYCLES.find((c) => c.id === currentView) as any);

  // Vistas de frecuencia (Semanal, Mensual, Anual): un único modo para toda la vista, el del
  // interruptor «Incluir…» bajo el título. Filtro, cabeceras y árbol de secciones lo usan igual.
  const cycleViewMode: 'only_section' | 'full_routine' = !currentCycle ? 'only_section' : (
    cycleGeneralModes[currentCycle.id] || (
      currentCycle.id === 'cycle_week' && cycleInclusion.weekly === 'include_daily' ? 'full_routine' :
      currentCycle.id === 'cycle_month' && cycleInclusion.monthly !== 'only_monthly' ? 'full_routine' :
      currentCycle.id === 'cycle_year' && cycleInclusion.annual !== 'only_annual' ? 'full_routine' :
      'only_section'
    )
  );

  const toggleCycleGeneralMode = useCallback((mode: 'only_section' | 'full_routine') => {
    if (!currentCycle) return;
    setCycleGeneralModes(prev => {
      const next = { ...prev, [currentCycle.id]: mode };
      try { localStorage.setItem('cycle_general_modes', JSON.stringify(next)); } catch {}
      return next;
    });
  }, [currentCycle]);

  // Si estamos en un ciclo que ya no existe (por ejemplo, eliminado recientemente), redirigir
  useEffect(() => {
    if (currentView.startsWith('cycle_')) {
      const coreIds = ['cycle_day', 'cycle_week', 'cycle_month', 'cycle_year'];
      const exists = coreIds.includes(currentView) || (cycles || []).some(c => c.id === currentView && !c.deleted_at);
      if (!exists) {
        onSelectView?.('smart_today');
      }
    }
  }, [currentView, cycles, onSelectView]);

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

  // Selección múltiple de recordatorios para acciones en lote (mover sección, anidar, etc.)
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [prevView, setPrevView] = useState(currentView);
  if (prevView !== currentView) {
    setPrevView(currentView);
    if (selectedTaskIds.size > 0) {
      setSelectedTaskIds(new Set());
    }
  }

  const handleToggleSelectTask = useCallback((taskId: string) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  // Conteo de tareas para el conmutador nativo [Solo (X) | Todas (Y)] por sección en vistas de ciclos/frecuencias
  const cycleRoutineCounts = useMemo(() => {
    if (!currentCycle || currentCycle.id === 'cycle_day') return {};
    const counts: Record<string, { only: number; full: number }> = {};
    const allTasks = Object.values(tasks);
    const validCycles = cycles.filter(c => c.daysValue <= currentCycle.daysValue).map(c => c.id);

    allTasks.forEach(t => {
      if (t.deleted_at) return;
      if (t.categoryId === 'primeros_pasos') return;
      const isDone = isTaskCompleted(t) || isCompletedInCurrentPeriod(t, cycles, listSections, lists);
      if (!resolvedShowCompleted && isDone && !recentlyCompletedIds.includes(t.id)) return;

      const effCycle = getEffectiveCycleId(t, listSections, lists);
      if (!effCycle || !validCycles.includes(effCycle)) return;

      const catId = t.categoryId || (t as any).category_id || 'inbox';
      if (!counts[catId]) {
        counts[catId] = { only: 0, full: 0 };
      }
      counts[catId].full++;
      if (effCycle === currentCycle.id) {
        counts[catId].only++;
      }
    });

    return counts;
  }, [currentCycle, tasks, cycles, listSections, lists, resolvedShowCompleted, recentlyCompletedIds]);

  // Helper de ordenamiento: delega en la única función de orden de la app (ver sectionRoutine.ts)
  // para que el criterio sea siempre el mismo, se mezclen o no periodicidades distintas.
  const sortTaskList = useCallback((taskList: TaskItem[]): TaskItem[] => {
    return sortTasksByUserPreference(taskList, sortBy);
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
        const todayStr = new Date().toDateString();
        filteredTasks = validTasks.filter(t => {
          if (!t.dueDate) return false;
          const d = new Date(t.dueDate);
          return !isNaN(d.getTime()) && d.toDateString() === todayStr;
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
  }, [currentView, tasks]);

  // Cargar tareas agrupadas según la vista actual
  const groupedTasks = useMemo(() => {
    let rawGrouped: Record<string, TaskItem[]> = {};
    if (currentView === 'TRASH') {
      const allTrash = Object.values(tasks).filter((t: any) => !!t.deleted_at);
      rawGrouped = { 'Papelera': allTrash };
      return rawGrouped;
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
        // En «Qué he hecho» todas las vivencias y recuerdos están siempre visibles (es una bitácora, no una lista de pendientes).
        const validTasks = allTasks;

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
      const filteredGrouped: Record<string, TaskItem[]> = {};
      Object.entries(rawGrouped).forEach(([key, taskList]) => {
        const mode = cycleViewMode;

        const allowedCyclesForSection = new Set<string>();
        if (currentCycle.id === 'cycle_day') {
          allowedCyclesForSection.add('cycle_day');
        } else if (mode === 'full_routine') {
          cycles.filter(c => c.daysValue <= currentCycle.daysValue).forEach(c => allowedCyclesForSection.add(c.id));
        } else {
          allowedCyclesForSection.add(currentCycle.id);
        }

        const matching = taskList.filter(t => {
          const eff = getEffectiveCycleId(t, listSections, lists);
          if (!eff || !allowedCyclesForSection.has(eff)) return false;
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
            const parentCat = parent.categoryId || (parent as any).category_id;
            const tCat = t.categoryId || (t as any).category_id;
            if (parentCat && tCat && parentCat !== tCat) break;
            const parentEff = getEffectiveCycleId(parent, listSections, lists);
            if (!parentEff || !allowedCyclesForSection.has(parentEff)) {
              break;
            }
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
            if (!matching.some(m => m.id === parent.id)) {
              break;
            }
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
  }, [currentView, isFolderView, isSmartView, isListView, getTasksForSmartView, getTasksByList, getTasksByCycle, tasks, resolvedShowCompleted, recentlyCompletedIds, lists, listSections, cycles, currentCycle, cycleViewMode, listSectionFilter, dailyTimeFilter, resolveTimeOfDay, currentList, sortTaskList, lifeLogViewMode, selectedPersonFilter]);
    
  const smartTasks = useMemo(
    () => (currentView === 'cycle_day' ? smartSortTasks(tasks, cycles, recentlyCompletedIds) : []),
    [currentView, tasks, cycles, recentlyCompletedIds]
  );

  // Índices precalculados: evitan recorrer todas las tareas por cada fila renderizada (O(n²)).
  const parentIdsWithChildren = useMemo(() => {
    const ids = new Set<string>();
    for (const t of Object.values(tasks)) if (t.parentId && !t.deleted_at) ids.add(t.parentId);
    return ids;
  }, [tasks]);


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
      const isDone = isTaskCompleted(task) || isCompletedInCurrentPeriod(task, cycles, listSections, lists);

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

        const remainingActive = Object.values(tasks).filter((t: any) => !t.deleted_at && !isTaskCompleted(t)).length;
        if (remainingActive === 1) {
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
  }, [tasks, cycles, lists, listSections, toggleTask]);

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

  const isCatCollapsed = useCallback((category: string) => {
    if (collapsed[category] !== undefined) {
      return Boolean(collapsed[category]);
    }
    // Subtareas y tareas incluidas de otras frecuencias empiezan desplegadas
    if (category.startsWith('task_') || category.startsWith('incluidas_')) {
      return false;
    }
    // En Qué he hecho (bitácora de vida), las personas y meses se muestran abiertos
    if (isQueHeHechoList(currentView, currentList)) {
      return false;
    }
    // En vistas inteligentes (Hoy, Todos, Programados, etc.), las agrupaciones por lista empiezan abiertas
    if (isSmartView) {
      return false;
    }
    // En vistas de frecuencia (Diario, Semanal, etc.), las agrupaciones maestras de lista empiezan abiertas para ver sus secciones
    if (currentCycle && (category === 'inbox' || category === 'undefined' || category === 'Sin Lista' || lists?.some(l => l.id === category))) {
      return false;
    }
    // En toda la app (listas normales, frecuencia, caducidades), las secciones vienen cerradas por defecto para no agobiar
    return true;
  }, [collapsed, currentView, currentList, isSmartView, currentCycle, lists]);

  const toggleCategory = useCallback((category: string) => {
    HapticService.selection();
    setCollapsed(prev => {
      const isCurrentlyCollapsed = prev[category] !== undefined
        ? Boolean(prev[category])
        : isCatCollapsed(category);
      return {
        ...prev,
        [category]: !isCurrentlyCollapsed
      };
    });
  }, [isCatCollapsed]);

  const handleAddSection = useCallback((parentId?: string) => {
    if (!currentList) return;
    const { addListSection: storeAddSection } = useAppStore.getState();
    const existing = (listSections || []).filter(s => s.listId === currentList.id);
    const newSecId = `sec_${Date.now()}`;
    storeAddSection({
      id: newSecId,
      listId: currentList.id,
      name: 'Nueva sección',
      parentId,
      order: existing.length
    });
    setEditingSectionId(newSecId);
    setEditingSectionName('Nueva sección');
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
    if (!ok) return;
    // Lo que hay que recolocar al deshacer: los recordatorios de la sección y sus subsecciones.
    const st = useAppStore.getState();
    const section = (st.listSections || []).find((s) => s.id === sectionId);
    const taskIds = Object.values(st.tasks).filter((t) => t.sectionId === sectionId && !t.deleted_at).map((t) => t.id);
    const childIds = (st.listSections || []).filter((s) => s.parentId === sectionId && !s.deleted_at).map((s) => s.id);
    deleteListSection(sectionId);
    showUndoToast(`Sección «${section?.name || ''}» eliminada`, () => {
      const s = useAppStore.getState();
      s.restoreListSection(sectionId);
      taskIds.forEach((id) => s.updateTask(id, { sectionId }));
      childIds.forEach((id) => s.updateListSection(id, { parentId: sectionId }));
    });
  }, [sectionMenu, deleteListSection]);

  const handleEmptySectionMenu = useCallback(async () => {
    const sectionTasks = sectionMenu.category ? (groupedTasks[sectionMenu.category] || []) : [];
    if (sectionTasks.length === 0) return;
    setSectionMenu({ open: false, x: 0, y: 0 });
    const ok = await confirmDialog({
      title: `¿Vaciar sección «${sectionMenu.sectionName || 'Sección'}»?`,
      message: `Se moverán ${sectionTasks.length} recordatorios a la papelera. La sección se mantendrá intacta.`,
      confirmText: 'Vaciar',
    });
    if (ok) {
      emptySection(sectionMenu.sectionId || '', sectionTasks.map(t => t.id));
      const timeoutId = window.setTimeout(() => setDeletedToast(null), 5000);
      setDeletedToast({
        id: sectionMenu.sectionId || 'section',
        title: `Se vació «${sectionMenu.sectionName}» (${sectionTasks.length} recordatorios)`,
        timeoutId: timeoutId as unknown as number
      });
    }
  }, [sectionMenu, groupedTasks, emptySection]);

  // 1. Flatten Data para Virtualización (QA Performance Optimization)
  const { flattenedData, renderedSectionTasks } = useMemo(() => {
    const flat: VirtualItemType[] = [{ type: 'page-header' }];
    // Tareas que pinta cada cabecera agrupada (habitaciones de Limpieza…), para su precio y su menú.
    const sectionTasksByKey: Record<string, TaskItem[]> = {};
    // Mismo criterio que el recuento de la barra lateral: lo hecho en su periodo no cuenta.
    const countPending = (list: TaskItem[]) =>
      list.filter(t => !isTaskCompleted(t) && !isCompletedInCurrentPeriod(t, cycles, listSections, lists)).length;

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

        // Lógica de periodicidad y rutina para cabeceras
        const sectionPeriodicity = currentCycle 
          ? (currentCycle.id.replace('cycle_', '') as PeriodicityType)
          : getSectionPeriodicity(categoryOrCycle, headerTitle, listSections, lists);
        // «Incluir diarias» (o acumuladas): categoryTasks ya trae las de frecuencias más cortas
        // mezcladas (groupedTasks las filtra según cycleViewMode), al mismo nivel, sin subcabecera.
        const tasksToRender = categoryTasks;
        let routineCounts = null;
        if (currentCycle && currentCycle.id !== 'cycle_day') {
          const rCounts = cycleRoutineCounts[categoryOrCycle];
          if (rCounts && rCounts.full > rCounts.only) {
            routineCounts = rCounts;
          }
        }
        const sectionRoutineMode = currentCycle ? cycleViewMode : (sectionRoutineModes[categoryOrCycle] || 'only_section');

        flat.push({ 
          type: 'header', 
          title: headerTitle, 
          titleIcon: undefined, // el nombre («Semanales») ya dice la frecuencia: sin icono de repetición
          category: categoryOrCycle, 
          color, 
          depth: headerDepth,
          periodicity: sectionPeriodicity,
          // En las vistas de frecuencia manda el interruptor de la vista: sin conmutador por grupo.
          routineCounts: currentCycle ? null : routineCounts,
          routineMode: sectionRoutineMode,
          sectionTaskIds: tasksToRender.filter(t => !isTaskCompleted(t)).map(t => t.id),
          pendingCount: countPending(tasksToRender)
        });
        
        if (!isCatCollapsed(categoryOrCycle)) {
          const renderSectionTreeForTasks = (tasksInScope: TaskItem[], listId: string, baseDepth: number, parentColor: string) => {
            const sectionsForList = (listSections || []).filter(s => s.listId === listId && !s.deleted_at);

            const listMode = currentCycle ? cycleViewMode : (sectionRoutineModes[listId] || 'only_section');

            const allowedCycleIds = new Set<string>();
            if (currentCycle) {
              if (currentCycle.id === 'cycle_day') {
                allowedCycleIds.add('cycle_day');
              } else if (listMode === 'full_routine') {
                cycles.filter(c => c.daysValue <= currentCycle.daysValue).forEach(c => allowedCycleIds.add(c.id));
              } else {
                allowedCycleIds.add(currentCycle.id);
              }
            }

            // Comprobar si la lista tiene raíces de ciclo periódicas con subsecciones de estancia (ej. Limpieza con Diarias, Semanales -> Cocina, Baño, etc.)
            const periodicRoots = sectionsForList.filter(s => !s.parentId && getPureCyclicPeriodicity(s.name));
            const hasPeriodicChildSections = isLimpiezaList(listId) || periodicRoots.some(pr =>
              sectionsForList.some(s => s.parentId === pr.id ||
                (pr.id.startsWith('sec_limpieza_') && s.parentId === pr.id.replace('sec_limpieza_', 'sec_limp_')) ||
                (pr.id.startsWith('sec_limp_') && s.parentId === pr.id.replace('sec_limp_', 'sec_limpieza_'))
              )
            );

            if (hasPeriodicChildSections) {
              // UNIFICACIÓN DE ESTANCIAS:
              // En lugar de duplicar secciones de habitación para cada ciclo ("Cocina" en Diarias y "Cocina" en Semanales),
              // unificamos todas las tareas de la estancia en una sola sección coherente ordenada por frecuencia.
              const canonicalRoomInfo = (name: string) => {
                const norm = (name || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                if (norm.includes('cocin')) return { key: 'cocina', name: 'Cocina', order: 0 };
                if (norm.includes('ban') || norm.includes('duch') || norm.includes('aseo')) return { key: 'bano', name: 'Baño', order: 1 };
                if (norm.includes('habitaci') || norm.includes('dormitori') || norm.includes('cam')) return { key: 'habitacion', name: 'Habitación', order: 2 };
                if (norm.includes('pasill') || norm.includes('entrad') || norm.includes('recibid')) return { key: 'pasillo', name: 'Pasillo / Entrada', order: 3 };
                if (norm.includes('balcon') || norm.includes('terraz')) return { key: 'balcon', name: 'Balcón', order: 4 };
                if (norm.includes('general')) return { key: 'general', name: 'General', order: 5 };
                return { key: norm.replace(/\s+/g, '_') || 'custom', name: name.trim(), order: 10 };
              };

              const roomsMap = new Map<string, { key: string; name: string; order: number; sectionIds: Set<string>; primarySectionId: string }>();

              const defaultRooms = [
                { key: 'cocina', name: 'Cocina', order: 0 },
                { key: 'bano', name: 'Baño', order: 1 },
                { key: 'habitacion', name: 'Habitación', order: 2 },
                { key: 'pasillo', name: 'Pasillo / Entrada', order: 3 },
                { key: 'balcon', name: 'Balcón', order: 4 },
                { key: 'general', name: 'General', order: 5 },
              ];
              defaultRooms.forEach(dr => {
                roomsMap.set(dr.key, {
                  key: dr.key,
                  name: dr.name,
                  order: dr.order,
                  sectionIds: new Set<string>(),
                  primarySectionId: `sec_limp_semanal_${dr.key}`
                });
              });

              sectionsForList.forEach(s => {
                if (!s.parentId && getPureCyclicPeriodicity(s.name)) return;
                const info = canonicalRoomInfo(s.name);
                if (!roomsMap.has(info.key)) {
                  roomsMap.set(info.key, {
                    key: info.key,
                    name: info.name,
                    order: info.order,
                    sectionIds: new Set<string>(),
                    primarySectionId: s.id
                  });
                }
                const entry = roomsMap.get(info.key)!;
                entry.sectionIds.add(s.id);
                entry.primarySectionId = s.id;
                if (s.id.startsWith('sec_limpieza_')) entry.sectionIds.add(s.id.replace('sec_limpieza_', 'sec_limp_'));
                if (s.id.startsWith('sec_limp_')) entry.sectionIds.add(s.id.replace('sec_limp_', 'sec_limpieza_'));
              });

              const assignedTasksByRoom = new Map<string, TaskItem[]>();
              roomsMap.forEach((_, key) => assignedTasksByRoom.set(key, []));

              for (const task of tasksInScope) {
                const tSec = task.sectionId || (task as any).section_id;
                let matchedKey: string | null = null;

                if (tSec) {
                  for (const [rKey, room] of roomsMap.entries()) {
                    if (room.sectionIds.has(tSec)) {
                      matchedKey = rKey;
                      break;
                    }
                  }
                }

                if (!matchedKey && isLimpiezaList(listId)) {
                  const roomNameFromTitle = getRoomForCleaningTask(task.title);
                  const info = canonicalRoomInfo(roomNameFromTitle);
                  if (assignedTasksByRoom.has(info.key)) {
                    matchedKey = info.key;
                  }
                }

                if (matchedKey) {
                  assignedTasksByRoom.get(matchedKey)!.push(task);
                } else {
                  if (assignedTasksByRoom.has('general')) {
                    assignedTasksByRoom.get('general')!.push(task);
                  } else {
                    const firstKey = roomsMap.keys().next().value;
                    if (firstKey) assignedTasksByRoom.get(firstKey)!.push(task);
                  }
                }
              }

              const sortedRooms = Array.from(roomsMap.values()).sort((a, b) => a.order - b.order);
              const periodicityRank: Record<string, number> = { day: 1, week: 2, month: 3, year: 4 };

              sortedRooms.forEach(room => {
                const rawRoomTasks = assignedTasksByRoom.get(room.key) || [];
                if (currentCycle && rawRoomTasks.length === 0) {
                  return;
                }

                const roomTasks = deduplicateTaskList(rawRoomTasks);
                roomTasks.sort((a, b) => {
                  const pA = getTaskPeriodicity(a, listSections, lists) || 'day';
                  const pB = getTaskPeriodicity(b, listSections, lists) || 'day';
                  const rankA = periodicityRank[pA] || 99;
                  const rankB = periodicityRank[pB] || 99;
                  if (rankA !== rankB) return rankA - rankB;
                  return (a.order ?? 0) - (b.order ?? 0);
                });

                const roomCategoryKey = `unified_room_${listId}_${room.key}`;
                sectionTasksByKey[roomCategoryKey] = roomTasks;
                const pendingIds = roomTasks.filter(t => !isTaskCompleted(t)).map(t => t.id);

                flat.push({
                  type: 'header',
                  title: formatSectionTitle(room.name),
                  titleIcon: getRoomIcon(room.key),
                  category: roomCategoryKey,
                  color: parentColor,
                  sectionId: room.primarySectionId,
                  depth: baseDepth,
                  sectionTaskIds: pendingIds
                });

                if (!isCatCollapsed(roomCategoryKey)) {
                  if (roomTasks.length === 0) {
                    flat.push({
                      type: 'empty-section',
                      title: 'Aquí no hay tareas',
                      category: roomCategoryKey,
                      color: parentColor,
                      sectionId: room.primarySectionId,
                      depth: baseDepth
                    });
                  } else {
                    const inScope = new Set(roomTasks.map(t => t.id));
                    const roots = roomTasks.filter(t => !t.parentId || !inScope.has(t.parentId));
                    const processNode = (task: TaskItem, d: number) => {
                      flat.push({ type: 'task', task, depth: d });
                      if (!isCatCollapsed(`task_${task.id}`)) {
                        const children = roomTasks.filter(t => t.parentId === task.id);
                        children.forEach(c => processNode(c, d + 1));
                      }
                    };
                    roots.forEach(r => processNode(r, baseDepth));
                  }
                }
              });

              return;
            }

            // 1. Uncategorized tasks in scope
            const uncategorized = deduplicateTaskList(tasksInScope.filter(t => !t.sectionId || !sectionsForList.some(s => s.id === t.sectionId)));
            if (uncategorized.length > 0) {
              const inUncat = new Set(uncategorized.map(t => t.id));
              const roots = uncategorized.filter(t => !t.parentId || !inUncat.has(t.parentId));
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

              const hasTasksRecursively = (sId: string): boolean => {
                if (tasksInScope.some(t => t.sectionId === sId)) return true;
                return sectionsForList.filter(s => s.parentId === sId).some(child => hasTasksRecursively(child.id));
              };

              // En vistas de ciclos temporales, ignorar secciones que no tengan tareas en su árbol
              if (currentCycle && !hasTasksRecursively(sec.id)) {
                return;
              }

              // Si es una sección pura de periodicidad (Diarias, Semanales, Mensuales, Anuales):
              // en vista de ciclo no creamos una cabecera redundante ("Diarias" dentro de "Diario"),
              // sino que mostramos directamente sus tareas en este ciclo y procesamos sus posibles subsecciones hijas.
              const purePeriodicity = getPureCyclicPeriodicity(sec.name);
              if (currentCycle && purePeriodicity) {
                const cycleOrder: Record<string, number> = { day: 1, week: 2, month: 3, year: 4 };
                const currentCycleRank = currentCycle.id === 'cycle_day' ? 1 : currentCycle.id === 'cycle_week' ? 2 : currentCycle.id === 'cycle_month' ? 3 : 4;
                const secRank = cycleOrder[purePeriodicity] || 1;
                if (secRank > currentCycleRank || !allowedCycleIds.has(`cycle_${purePeriodicity}`)) {
                  return;
                }

                const secTasks = deduplicateTaskList(tasksInScope.filter(t => t.sectionId === secId));
                if (secTasks.length > 0) {
                  const inSec = new Set(secTasks.map(t => t.id));
                  const roots = secTasks.filter(t => !t.parentId || !inSec.has(t.parentId));
                  const processNode = (task: TaskItem, d: number) => {
                    flat.push({ type: 'task', task, depth: d });
                    if (!isCatCollapsed(`task_${task.id}`)) {
                      const children = secTasks.filter(t => t.parentId === task.id);
                      children.forEach(c => processNode(c, d + 1));
                    }
                  };
                  roots.forEach(r => processNode(r, depthLevel));
                }
                const children = sectionsForList
                  .filter(s => s.parentId === sec.id)
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                children.forEach(c => renderSectionBranch(c.id, depthLevel));
                return;
              }

              const secTasks = deduplicateTaskList(tasksInScope.filter(t => t.sectionId === secId));
              const secKey = sec.id.startsWith('sec_') || sec.id.startsWith('section_') ? sec.id : `sec_${sec.id}`;
              const secPeriodicity = getSectionPeriodicity(secKey, sec.name, listSections, lists);
              
              // En ciclos temporales, no mostrar secciones cuya periodicidad sea mayor al ciclo activo
              if (currentCycle && secPeriodicity) {
                const cycleOrder: Record<string, number> = { day: 1, week: 2, month: 3, year: 4 };
                const currentCycleRank = currentCycle.id === 'cycle_day' ? 1 : currentCycle.id === 'cycle_week' ? 2 : currentCycle.id === 'cycle_month' ? 3 : 4;
                const secRank = cycleOrder[secPeriodicity] || 1;
                if (secRank > currentCycleRank || !allowedCycleIds.has(`cycle_${secPeriodicity}`)) {
                  return;
                }
              }
              
              flat.push({ 
                type: 'header', 
                title: formatSectionTitle(sec.name), 
                category: secKey, 
                color: parentColor, 
                sectionId: sec.id, 
                depth: depthLevel,
                periodicity: secPeriodicity,
                sectionTaskIds: secTasks.filter(t => !isTaskCompleted(t)).map(t => t.id)
              });
              
              if (!isCatCollapsed(secKey)) {
                if (secTasks.length === 0) {
                  if (!currentCycle) {
                    flat.push({ type: 'empty-section', title: 'Aquí no hay tareas', category: secKey, color: parentColor, sectionId: sec.id, depth: depthLevel });
                  }
                } else {
                  const inSec = new Set(secTasks.map(t => t.id));
                  const roots = secTasks.filter(t => !t.parentId || !inSec.has(t.parentId));
                  const processNode = (task: TaskItem, d: number) => {
                    flat.push({ type: 'task', task, depth: d });
                    if (!isCatCollapsed(`task_${task.id}`)) {
                      const children = secTasks.filter(t => t.parentId === task.id);
                      children.forEach(c => processNode(c, d + 1));
                    }
                  };
                  roots.forEach(r => processNode(r, 0));
                }

                // Child sections
                const children = sectionsForList
                  .filter(s => s.parentId === sec.id)
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                children.forEach(c => renderSectionBranch(c.id, depthLevel + 1));
              }
            };

            const rootSections = sectionsForList
              .filter(s => !s.parentId)
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            rootSections.forEach(r => renderSectionBranch(r.id, baseDepth));
          };

          renderSectionTreeForTasks(tasksToRender, categoryOrCycle, 1, color);
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
              const inScope = new Set(groupTasks.map(t => t.id));
              const roots = groupTasks.filter(t => !t.parentId || !inScope.has(t.parentId));
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
              const uncatTasks = deduplicateTaskList(groupedTasks['no_section']);
              const inScope = new Set(uncatTasks.map(t => t.id));
              const roots = uncatTasks.filter(t => !t.parentId || !inScope.has(t.parentId));
              const processNode = (task: TaskItem, depth: number) => {
                flat.push({ type: 'task', task, depth });
                if (!isCatCollapsed(`task_${task.id}`)) {
                  const children = uncatTasks.filter(t => t.parentId === task.id);
                  children.forEach(c => processNode(c, depth + 1));
                }
              };
              roots.forEach(r => processNode(r, 0));
            }
          }
        }

        // 2. Sections Hierarchy & Dynamic Cycle Sections
        const sectionsForList = (listSections || [])
          .filter(s => s.listId === currentList?.id && !s.deleted_at)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        const allCycles = useAppStore.getState().cycles || [];

        // Present cycle keys: include keys that have tasks, or that match a defined manual cyclic section
        const cycleKeys = new Set<string>();
        Object.keys(groupedTasks).forEach(k => {
          if (k.startsWith('cycle_') && (groupedTasks[k]?.length || 0) > 0) {
            cycleKeys.add(k);
          }
        });
        sectionsForList.forEach(s => {
          if (!s.parentId) {
            const p = getPureCyclicPeriodicity(s.name);
            if (p) {
              cycleKeys.add(`cycle_cycle_${p}`);
            }
          }
        });
        const presentCycleKeys = Array.from(cycleKeys);

        const visitedSectionIds = new Set<string>();
        const processSection = (secId: string, depth: number) => {
          if (visitedSectionIds.has(secId)) return;
          visitedSectionIds.add(secId);

          const sec = sectionsForList.find(s => s.id === secId);
          if (!sec || sec.deleted_at) return;

          // Las secciones manuales que son literalmente "Diaria/Semanal/Mensual/Anual" son un
          // duplicado de la sección de ciclo equivalente (ya renderizada con sus tareas e hijas en presentCycleKeys).
          if (getPureCyclicPeriodicity(sec.name)) {
            return;
          }

          const categoryKey = `section_${sec.id}`;

          // Obtenemos tareas asignadas a esta sección (incluyendo soporte de alias de prefijo sec_limp_ / sec_limpieza_)
          const categoryTasks = [
            ...(groupedTasks[categoryKey] || []),
            ...(sec.id.startsWith('sec_limpieza_') ? (groupedTasks[`section_${sec.id.replace('sec_limpieza_', 'sec_limp_')}`] || []) : []),
            ...(sec.id.startsWith('sec_limp_') ? (groupedTasks[`section_${sec.id.replace('sec_limp_', 'sec_limpieza_')}`] || []) : []),
          ];

          // Subsecciones hijas
          const childSections = sectionsForList
            .filter(s => s.parentId === sec.id ||
              (sec.id.startsWith('sec_limpieza_') && s.parentId === sec.id.replace('sec_limpieza_', 'sec_limp_')) ||
              (sec.id.startsWith('sec_limp_') && s.parentId === sec.id.replace('sec_limp_', 'sec_limpieza_'))
            )
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

          const sectionPeriodicity = getSectionPeriodicity(categoryKey, sec.name, listSections, lists);
          let tasksToRender = deduplicateTaskList(categoryTasks);
          let routineCounts: { full: number; only: number } | null = null;
          let routineDurations: { only: TasksDurationSummary; full: TasksDurationSummary } | null = null;
          let routineParts: RoutinePart[] | null = null;

          const allChildTasks = childSections.flatMap(cs => [
            ...(groupedTasks[`section_${cs.id}`] || []),
            ...(cs.id.startsWith('sec_limpieza_') ? (groupedTasks[`section_${cs.id.replace('sec_limpieza_', 'sec_limp_')}`] || []) : []),
            ...(cs.id.startsWith('sec_limp_') ? (groupedTasks[`section_${cs.id.replace('sec_limp_', 'sec_limpieza_')}`] || []) : []),
          ]);

          const thisSectionTasksTotal = deduplicateTaskList([...categoryTasks, ...allChildTasks]);

          if (sectionPeriodicity && sectionPeriodicity !== 'day') {
            const allTasksInList = Object.values(groupedTasks).flat();
            const allowedPeriodicities = getRoutineAllowedPeriodicities(sectionPeriodicity);
            const fullRoutineTasks = deduplicateTaskList(allTasksInList.filter(t => {
              const p = getTaskPeriodicity(t, listSections, lists);
              return p && allowedPeriodicities.has(p);
            }));

            if (fullRoutineTasks.length > thisSectionTasksTotal.length) {
              routineCounts = {
                full: fullRoutineTasks.length,
                only: thisSectionTasksTotal.length
              };

              const onlyDuration = calculateTasksDuration(thisSectionTasksTotal, listSections, lists);
              const fullDuration = calculateTasksDuration(fullRoutineTasks, listSections, lists);
              routineDurations = { only: onlyDuration, full: fullDuration };
              routineParts = buildRoutineParts(fullRoutineTasks, listSections, lists);

              const currentRoutineMode = sectionRoutineModes[categoryKey] || 'only_section';
              if (currentRoutineMode === 'full_routine') {
                // Las incluidas se mezclan con las propias, al mismo nivel (sin subcabecera).
                tasksToRender = deduplicateTaskList(sortTasksByUserPreference(fullRoutineTasks, sortBy));
              }
            }
          }

          // Si se está filtrando por temporalidad y ni esta sección ni sus hijas tienen tareas
          if (listSectionFilter !== 'all' && tasksToRender.length === 0 && allChildTasks.length === 0) {
            return;
          }

          const currentRoutineMode = sectionRoutineModes[categoryKey] || 'only_section';
          const sectionScopeForCounts = currentRoutineMode === 'full_routine' && routineCounts ? tasksToRender : thisSectionTasksTotal;
          const allSectionPendingTaskIds = sectionScopeForCounts.filter(t => !isTaskCompleted(t)).map(t => t.id);

          flat.push({
            type: 'header',
            title: formatSectionTitle(sec.name),
            category: categoryKey,
            color,
            sectionId: sec.id,
            depth,
            periodicity: sectionPeriodicity,
            routineCounts,
            routineDurations,
            routineParts,
            sectionTaskIds: allSectionPendingTaskIds,
            pendingCount: countPending(sectionScopeForCounts)
          });

          if (!isCatCollapsed(categoryKey)) {
            if (tasksToRender.length === 0 && childSections.length === 0) {
              flat.push({ type: 'empty-section', title: 'Aquí no hay tareas', category: categoryKey, color, sectionId: sec.id, depth });
            } else {
              if (tasksToRender.length > 0) {
                const inScope = new Set(tasksToRender.map(t => t.id));
                const roots = tasksToRender.filter(t => !t.parentId || !inScope.has(t.parentId) || t.parentId === t.id);
                const visitedTaskIds = new Set<string>();
                const processNode = (task: TaskItem, depthLevel: number) => {
                  if (visitedTaskIds.has(task.id)) return;
                  visitedTaskIds.add(task.id);
                  flat.push({ type: 'task', task, depth: depthLevel });
                  if (!isCatCollapsed(`task_${task.id}`)) {
                    const children = tasksToRender.filter(t => t.parentId === task.id);
                    children.forEach(c => processNode(c, depthLevel + 1));
                  }
                };
                roots.forEach(r => processNode(r, 0));
                // Rescate de seguridad: si alguna tarea no fue visitada por incoherencia de parentId, mostrarla a nivel 0
                tasksToRender.forEach(t => {
                  if (!visitedTaskIds.has(t.id)) {
                    processNode(t, 0);
                  }
                });
              }

              if (childSections.length > 0) {
                childSections.forEach(child => processSection(child.id, depth + 1));
              }
            }
          }
        };
        
        if (isLimpiezaList(currentList?.id, currentList)) {
          // LIMPIEZA: jerarquía correcta = Frecuencia (depth 0) → Habitaciones (depth 1)
          // Cada sección de frecuencia (Diaria, Semanal, Mensual, Anual) agrupa sus habitaciones.
          const canonicalRoomInfo = (name: string) => {
            const norm = (name || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (norm.includes('cocin')) return { key: 'cocina', name: 'Cocina', order: 0 };
            if (norm.includes('ban') || norm.includes('duch') || norm.includes('aseo')) return { key: 'bano', name: 'Baño', order: 1 };
            if (norm.includes('habitaci') || norm.includes('dormitori') || norm.includes('cam')) return { key: 'habitacion', name: 'Habitación', order: 2 };
            if (norm.includes('pasill') || norm.includes('entrad') || norm.includes('recibid')) return { key: 'pasillo', name: 'Pasillo / Entrada', order: 3 };
            if (norm.includes('balcon') || norm.includes('terraz')) return { key: 'balcon', name: 'Balcón', order: 4 };
            return { key: norm.replace(/\s+/g, '_') || 'general', name: name.trim() || 'General', order: 5 };
          };

          // Las frecuencias en orden
          const FREQ_ORDER = [
            { periodicity: 'day',   label: 'Diaria',   cycleId: 'cycle_day' },
            { periodicity: 'week',  label: 'Semanal',  cycleId: 'cycle_week' },
            { periodicity: 'month', label: 'Mensual',  cycleId: 'cycle_month' },
            { periodicity: 'year',  label: 'Anual',    cycleId: 'cycle_year' },
          ];

          const allListTasks = Object.values(groupedTasks).flat();

          FREQ_ORDER.forEach(({ periodicity, label, cycleId }) => {
            // Tareas que pertenecen a esta frecuencia (por cycle_id o por sectionId cuya sección tiene esta periodicidad)
            const freqTasks = deduplicateTaskList(
              allListTasks.filter(t => {
                if (t.deleted_at) return false;
                const tPeriodicity = getTaskPeriodicity(t, listSections, lists);
                return tPeriodicity === periodicity;
              })
            );

            if (freqTasks.length === 0) return; // Omitir frecuencias vacías

            const PERIOD_ORDER_MAP: Record<string, number> = { day: 1, week: 2, month: 3, year: 4 };
            const currentRank = PERIOD_ORDER_MAP[periodicity] || 1;
            const cumulativeTasks = deduplicateTaskList(
              allListTasks.filter(t => {
                if (t.deleted_at) return false;
                const tPeriodicity = getTaskPeriodicity(t, listSections, lists) || 'day';
                return (PERIOD_ORDER_MAP[tPeriodicity] || 1) <= currentRank;
              })
            );

            const routineCounts = periodicity !== 'day' && cumulativeTasks.length > freqTasks.length ? {
              only: freqTasks.length,
              full: cumulativeTasks.length
            } : null;

            const onlyDuration = calculateTasksDuration(freqTasks, listSections, lists);
            const fullDuration = calculateTasksDuration(cumulativeTasks, listSections, lists);
            const routineDurations = routineCounts ? { only: onlyDuration, full: fullDuration } : null;
            const routineParts = routineCounts ? buildRoutineParts(cumulativeTasks, listSections, lists) : null;

            const mode = sectionRoutineModes[`limpieza_freq_${periodicity}`] || 'only_section';
            // Con «+ Acumuladas», las incluidas se mezclan en su habitación, al mismo nivel.
            const tasksToGroup = (mode === 'full_routine' && cumulativeTasks.length > freqTasks.length)
              ? cumulativeTasks
              : freqTasks;

            const freqCatKey = `limpieza_freq_${periodicity}`;
            // Sección manual del store (por si existe "Semanal", "Diaria"...)
            const manualFreqSec = sectionsForList.find(s =>
              !s.parentId && getPureCyclicPeriodicity(s.name) === periodicity
            );

            // Agrupar las tareas de esta frecuencia por habitación
            const roomBuckets = new Map<string, { key: string; name: string; order: number; tasks: TaskItem[] }>();
            const defaultRooms = [
              { key: 'cocina', name: 'Cocina', order: 0 },
              { key: 'bano', name: 'Baño', order: 1 },
              { key: 'habitacion', name: 'Habitación', order: 2 },
              { key: 'pasillo', name: 'Pasillo / Entrada', order: 3 },
              { key: 'balcon', name: 'Balcón', order: 4 },
              { key: 'general', name: 'General', order: 5 },
            ];
            defaultRooms.forEach(dr => roomBuckets.set(dr.key, { ...dr, tasks: [] }));

            tasksToGroup.forEach(t => {
              // Intentar detectar habitación por sección
              const tSecId = t.sectionId;
              let roomKey: string | null = null;
              if (tSecId) {
                const tSec = sectionsForList.find(s => s.id === tSecId);
                if (tSec && !getPureCyclicPeriodicity(tSec.name)) {
                  const info = canonicalRoomInfo(tSec.name);
                  roomKey = info.key;
                }
              }
              // Fallback: detectar por título
              if (!roomKey) {
                const roomName = getRoomForCleaningTask(t.title);
                const info = canonicalRoomInfo(roomName);
                roomKey = info.key;
              }
              if (!roomBuckets.has(roomKey!)) {
                const info = canonicalRoomInfo(roomKey!);
                roomBuckets.set(roomKey!, { ...info, tasks: [] });
              }
              roomBuckets.get(roomKey!)!.tasks.push(t);
            });

            // Calcular IDs pendientes de toda la frecuencia (todas habitaciones juntas)
            const freqPendingIds = tasksToGroup.filter(t => !isTaskCompleted(t)).map(t => t.id);

            // Cabecera de frecuencia (depth 0)
            const freqColor = getReservedFrequencyColor(cycleId) || color;
            sectionTasksByKey[freqCatKey] = tasksToGroup;
            flat.push({
              type: 'header',
              title: formatSectionTitle(label),
              category: freqCatKey,
              color: freqColor,
              sectionId: manualFreqSec?.id,
              depth: 0,
              periodicity: periodicity as PeriodicityType,
              routineCounts,
              routineDurations,
              routineParts,
              sectionTaskIds: freqPendingIds,
              pendingCount: countPending(tasksToGroup)
            });

            if (!isCatCollapsed(freqCatKey)) {
              const sortedRooms = Array.from(roomBuckets.values())
                .filter(rb => defaultRooms.some(dr => dr.key === rb.key) || rb.tasks.length > 0)
                .sort((a, b) => a.order - b.order);

              if (sortedRooms.length === 0) {
                flat.push({ type: 'empty-section', title: 'Sin tareas', category: freqCatKey, color: freqColor, depth: 0 });
              } else {
                sortedRooms.forEach(room => {
                  const roomCatKey = `limpieza_${periodicity}_${room.key}`;
                  const roomTasks = deduplicateTaskList(room.tasks);
                  roomTasks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                  sectionTasksByKey[roomCatKey] = roomTasks;
                  const roomPendingIds = roomTasks.filter(t => !isTaskCompleted(t)).map(t => t.id);

                  // Cabecera de habitación (depth 1)
                  flat.push({
                    type: 'header',
                    title: formatSectionTitle(room.name),
                    titleIcon: getRoomIcon(room.key),
                    category: roomCatKey,
                    color: freqColor,
                    sectionId: manualFreqSec?.id,
                    depth: 1,
                    sectionTaskIds: roomPendingIds
                  });

                  if (!isCatCollapsed(roomCatKey)) {
                    if (roomTasks.length === 0) {
                      flat.push({ type: 'empty-section', title: 'Sin tareas', category: roomCatKey, color: freqColor, sectionId: manualFreqSec?.id, depth: 1 });
                    } else {
                      roomTasks.forEach(task => {
                        flat.push({ type: 'task', task, depth: task.parentId ? 1 : 0 });
                      });
                    }
                  }
                });
              }
            }
          });

          // Sin frecuencia: también se ven, al final (si no, el total de la lista no cuadra con lo que hay).
          const noFreqTasks = deduplicateTaskList(allListTasks.filter(t => !t.deleted_at && !getTaskPeriodicity(t, listSections, lists)));
          if (noFreqTasks.length > 0) {
            const otherKey = 'limpieza_freq_none';
            sectionTasksByKey[otherKey] = noFreqTasks;
            flat.push({
              type: 'header',
              title: 'Otras',
              category: otherKey,
              color,
              depth: 0,
              sectionTaskIds: noFreqTasks.filter(t => !isTaskCompleted(t)).map(t => t.id),
              pendingCount: countPending(noFreqTasks)
            });
            if (!isCatCollapsed(otherKey)) {
              const inScope = new Set(noFreqTasks.map(t => t.id));
              const processNode = (task: TaskItem, depthLevel: number) => {
                flat.push({ type: 'task', task, depth: depthLevel });
                if (!isCatCollapsed(`task_${task.id}`)) {
                  noFreqTasks.filter(t => t.parentId === task.id).forEach(c => processNode(c, depthLevel + 1));
                }
              };
              sortTasksByUserPreference(noFreqTasks.filter(t => !t.parentId || !inScope.has(t.parentId)), sortBy)
                .forEach(r => processNode(r, 0));
            }
          }
        } else {
          if (presentCycleKeys.length > 0) {
            const sortedCycles = presentCycleKeys.sort((a, b) => {
              const idA = a.replace('cycle_', '');
              const idB = b.replace('cycle_', '');
              const pureA = idA.startsWith('cycle_') ? idA.replace('cycle_', '') : idA;
              const pureB = idB.startsWith('cycle_') ? idB.replace('cycle_', '') : idB;
              const cOrder: Record<string, number> = { day: 1, week: 2, month: 3, year: 4 };
              const cA = allCycles.find(c => c.id === idA || c.id === pureA)?.daysValue || cOrder[pureA] || 0;
              const cB = allCycles.find(c => c.id === idB || c.id === pureB)?.daysValue || cOrder[pureB] || 0;
              return cA - cB;
            });

            sortedCycles.forEach(catKey => {
              const cId = catKey.replace('cycle_', '');
              const purePeriod = cId.startsWith('cycle_') ? cId.replace('cycle_', '') : cId;
              const cObj = allCycles.find(c => c.id === cId || c.id === purePeriod || c.id === `cycle_${purePeriod}`);
              const manualSec = sectionsForList.find(s => !s.parentId && getPureCyclicPeriodicity(s.name) === purePeriod);
              const cName = manualSec ? manualSec.name : (cObj ? cObj.name : purePeriod);
              const categoryTasks = groupedTasks[catKey] || [];

              const sectionPeriodicity = (purePeriod as PeriodicityType) || getSectionPeriodicity(catKey, cName, listSections, lists);
              const cDays = cObj?.daysValue || (purePeriod === 'day' ? 1 : purePeriod === 'week' ? 7 : purePeriod === 'month' ? 30 : 365);
              const getDaysForTask = (t: TaskItem): number => {
                const tCycle = allCycles.find(c => c.id === t.cycle_id);
                if (tCycle?.daysValue) return tCycle.daysValue;
                const p = getTaskPeriodicity(t, listSections, lists);
                if (p === 'day') return 1;
                if (p === 'week') return 7;
                if (p === 'month') return 30;
                if (p === 'year') return 365;
                if (t.cycle_id) {
                  const c = t.cycle_id.toLowerCase();
                  if (c.includes('day') || c.includes('diari')) return 1;
                  if (c.includes('week') || c.includes('seman')) return 7;
                  if (c.includes('month') || c.includes('mensu')) return 30;
                  if (c.includes('year') || c.includes('anual')) return 365;
                }
                return 9999;
              };

              const fullTasks = Object.values(groupedTasks)
                .flat()
                .filter(t => {
                  if (t.deleted_at) return false;
                  return getDaysForTask(t) <= cDays;
                });

              const childSections = manualSec 
                ? sectionsForList.filter(s => s.parentId === manualSec.id ||
                    (manualSec.id.startsWith('sec_limpieza_') && s.parentId === manualSec.id.replace('sec_limpieza_', 'sec_limp_')) ||
                    (manualSec.id.startsWith('sec_limp_') && s.parentId === manualSec.id.replace('sec_limp_', 'sec_limpieza_'))
                  ).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                : [];

              const allChildTasks = childSections.flatMap(cs => [
                ...(groupedTasks[`section_${cs.id}`] || []),
                ...(cs.id.startsWith('sec_limpieza_') ? (groupedTasks[`section_${cs.id.replace('sec_limpieza_', 'sec_limp_')}`] || []) : []),
                ...(cs.id.startsWith('sec_limp_') ? (groupedTasks[`section_${cs.id.replace('sec_limp_', 'sec_limpieza_')}`] || []) : []),
              ]);

              const thisSectionTasksTotal = deduplicateTaskList([...categoryTasks, ...allChildTasks]);
              const fullTasksTotal = deduplicateTaskList(fullTasks);

              const routineCounts = sectionPeriodicity && sectionPeriodicity !== 'day' && fullTasksTotal.length > thisSectionTasksTotal.length ? {
                only: thisSectionTasksTotal.length,
                full: fullTasksTotal.length
              } : null;

              const onlyDuration = calculateTasksDuration(thisSectionTasksTotal, listSections, lists);
              const fullDuration = calculateTasksDuration(fullTasksTotal, listSections, lists);
              const routineDurations = routineCounts ? { only: onlyDuration, full: fullDuration } : null;
              const routineParts = routineCounts ? buildRoutineParts(fullTasksTotal, listSections, lists) : null;

              const mode = sectionRoutineModes[catKey] || 'only_section';
              // Con «+ Diarias», las incluidas se mezclan con las propias, al mismo nivel.
              const tasksToRender = deduplicateTaskList(
                mode === 'full_routine' && fullTasksTotal.length > thisSectionTasksTotal.length
                  ? sortTasksByUserPreference(fullTasksTotal, sortBy)
                  : categoryTasks
              );

              const countScope = mode === 'full_routine' && routineCounts ? fullTasksTotal : thisSectionTasksTotal;
              const allSectionPendingTaskIds = countScope.filter(t => !isTaskCompleted(t)).map(t => t.id);

              if (tasksToRender.length === 0 && childSections.length === 0) {
                return;
              }

              flat.push({
                type: 'header',
                title: formatSectionTitle(cName),
                category: catKey,
                color,
                sectionId: manualSec?.id,
                depth: 0,
                periodicity: sectionPeriodicity,
                routineCounts,
                routineDurations,
                routineParts,
                sectionTaskIds: allSectionPendingTaskIds,
                pendingCount: countPending(countScope)
              });

              if (!isCatCollapsed(catKey)) {
                if (tasksToRender.length > 0) {
                  const inScope = new Set(tasksToRender.map(t => t.id));
                  const roots = tasksToRender.filter(t => !t.parentId || !inScope.has(t.parentId) || t.parentId === t.id);
                  const visitedCycleTaskIds = new Set<string>();
                  const processNode = (task: TaskItem, depthLevel: number) => {
                    if (visitedCycleTaskIds.has(task.id)) return;
                    visitedCycleTaskIds.add(task.id);
                    flat.push({ type: 'task', task, depth: depthLevel });
                    if (!isCatCollapsed(`task_${task.id}`)) {
                      const children = tasksToRender.filter(t => t.parentId === task.id);
                      children.forEach(c => processNode(c, depthLevel + 1));
                    }
                  };
                  roots.forEach(r => processNode(r, 0));
                  tasksToRender.forEach(t => {
                    if (!visitedCycleTaskIds.has(t.id)) {
                      processNode(t, 0);
                    }
                  });
                }

                if (childSections.length > 0) {
                  childSections.forEach(child => processSection(child.id, 1));
                }
              }
            });
          }

          // Start with root sections
          const seenRootNames = new Set<string>();
          const allSectionIds = new Set(sectionsForList.map(s => s.id));
          const rootSections = sectionsForList
            .filter(s => !s.parentId || !allSectionIds.has(s.parentId) || s.parentId === s.id)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .filter(s => {
              const norm = (s?.name || '').trim().toLowerCase();
              if (!norm) return true;
              if (seenRootNames.has(norm)) return false;
              seenRootNames.add(norm);
              return true;
            });
          rootSections.forEach(rs => processSection(rs.id, 0));

          // Rescate de seguridad: asegurar que cualquier sección huérfana o omitida se procesa a nivel 0
          sectionsForList.forEach(s => {
            if (!visitedSectionIds.has(s.id) && !getPureCyclicPeriodicity(s.name)) {
              processSection(s.id, 0);
            }
          });
        }
      }
    }

    // Identify first and last tasks in sections for Apple-style rounding
    for (let i = 0; i < flat.length; i++) {
      if (flat[i].type === 'task') {
        flat[i].isFirstInSection = (i === 0 || flat[i - 1].type !== 'task');
        flat[i].isLastInSection = (i === flat.length - 1 || flat[i + 1].type !== 'task');
      }
    }

    return { flattenedData: flat, renderedSectionTasks: sectionTasksByKey };
  }, [groupedTasks, currentView, currentCycle, cycleViewMode, collapsed, isListView, lists, listSections, cycles, currentList, listSectionFilter, sortBy, isCatCollapsed, isolatedSectionKey, sectionRoutineModes, cycleRoutineCounts]);

  // Tareas visibles en pantalla respetando el orden visual exacto de renderizado
  const visibleTasks = useMemo(() => {
    const fromFlat: TaskItem[] = [];
    const seen = new Set<string>();
    for (const item of flattenedData) {
      if (item.type === 'task' && !seen.has(item.task.id)) {
        seen.add(item.task.id);
        fromFlat.push(item.task);
      }
    }
    if (fromFlat.length > 0) return fromFlat;
    if (isolatedSectionKey) {
      return groupedTasks[isolatedSectionKey] || [];
    }
    return Object.values(groupedTasks).flat();
  }, [flattenedData, isolatedSectionKey, groupedTasks]);

  // Todas las tareas de la vista, estén desplegadas o no. Los totales de la cabecera (número,
  // duración, precio), la secuencia y las exportaciones se calculan sobre esto: antes usaban solo
  // lo desplegado y cambiaban al plegar una sección (o si había alguna tarea suelta a la vista).
  const viewTasks = useMemo(() => {
    const source = isolatedSectionKey ? (groupedTasks[isolatedSectionKey] || []) : Object.values(groupedTasks).flat();
    const seen = new Set<string>();
    const out: TaskItem[] = [];
    for (const t of source) {
      if (t && !seen.has(t.id)) {
        seen.add(t.id);
        out.push(t);
      }
    }
    return out.length > 0 ? out : visibleTasks;
  }, [groupedTasks, isolatedSectionKey, visibleTasks]);

  // Duración estimada agregada de todas las tareas de la vista
  const viewTasksDuration = useMemo(() => {
    return calculateTasksDuration(viewTasks, listSections, lists);
  }, [viewTasks, listSections, lists]);

  const viewCompletedTasksDuration = useMemo(() => {
    return calculateCompletedTasksDuration(viewTasks, listSections, lists);
  }, [viewTasks, listSections, lists]);

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

    // Verificar si el objetivo es descendiente de la tarea arrastrada (evitar ciclos)
    const isDescendant = (candidateId: string, rootId: string): boolean => {
      let curr = tasks[candidateId];
      const visited = new Set<string>();
      while (curr && curr.parentId) {
        if (curr.parentId === rootId) return true;
        if (visited.has(curr.parentId)) break;
        visited.add(curr.parentId);
        curr = tasks[curr.parentId];
      }
      return false;
    };

    if (isDescendant(targetTaskId, sourceTaskId)) {
      return; // No se puede soltar una tarea padre dentro de una de sus subtareas
    }

    if (sortBy !== 'manual') {
      setSortBy('manual');
    }

    const sourceTask = tasks[sourceTaskId] || visibleTasks[sourceIdx];
    const targetTask = tasks[targetTaskId] || visibleTasks[targetIdx];

    const hasChildren = Object.values(tasks).some(t => !t.deleted_at && t.parentId === sourceTaskId);

    // Mover la tarea fuente y todos sus descendientes visibles juntos como un bloque
    const clusterIds = new Set<string>([sourceTaskId]);
    Object.values(tasks).forEach(t => {
      if (!t.deleted_at && isDescendant(t.id, sourceTaskId)) {
        clusterIds.add(t.id);
      }
    });

    const clusterTasks = visibleTasks.filter(t => clusterIds.has(t.id));
    const reordered = visibleTasks.filter(t => !clusterIds.has(t.id));

    const newTargetIdx = reordered.findIndex(t => t.id === targetTaskId);
    if (newTargetIdx === -1) return;
    const insertIdx = position === 'after' ? newTargetIdx + 1 : newTargetIdx;
    reordered.splice(insertIdx, 0, ...clusterTasks);

    const taskUpdates: Record<string, Partial<TaskItem>> = {};

    if (sourceTask && targetTask) {
      const prevTask = insertIdx > 0 ? reordered[insertIdx - 1] : undefined;
      const nextTask = (insertIdx + clusterTasks.length < reordered.length) ? reordered[insertIdx + clusterTasks.length] : undefined;

      let newParentId: string | undefined = undefined;

      if (!hasChildren) {
        // Escenario 1: Soltado entre una tarea principal y su primera subtarea
        if (prevTask && nextTask && nextTask.parentId && nextTask.parentId === prevTask.id) {
          newParentId = prevTask.id;
        }
        // Escenario 2: Soltado entre dos subtareas del mismo padre
        else if (prevTask && nextTask && prevTask.parentId && nextTask.parentId && prevTask.parentId === nextTask.parentId) {
          newParentId = prevTask.parentId;
        }
        // Escenario 3: Soltado después de una subtarea
        else if (position === 'after' && targetTask.parentId) {
          newParentId = targetTask.parentId;
        }
        // Escenario 4: Soltado antes de una subtarea, cuando el elemento anterior es el padre o un hermano
        else if (position === 'before' && targetTask.parentId && prevTask && (prevTask.id === targetTask.parentId || prevTask.parentId === targetTask.parentId)) {
          newParentId = targetTask.parentId;
        }
        // Escenario 5: Soltado después de un padre cuya subtarea sigue a continuación
        else if (position === 'after' && !targetTask.parentId && nextTask && nextTask.parentId === targetTask.id) {
          newParentId = targetTask.id;
        }
        // Escenario 6: Soltado como tarea raíz ordinaria
        else {
          newParentId = undefined;
        }
      }

      // Seguridad total: newParentId nunca puede ser sourceTaskId ni ninguno de sus descendientes
      if (newParentId === sourceTaskId || (newParentId && clusterIds.has(newParentId))) {
        newParentId = undefined;
      }

      // Sincronizar sección y lista
      const effectiveParent = newParentId ? (tasks[newParentId] || visibleTasks.find(t => t.id === newParentId)) : undefined;
      // En vistas inteligentes (Hoy, Programados...), no reasignar lista ni sección de origen
      const newCategoryId = isSmartView
        ? sourceTask.categoryId
        : (effectiveParent?.categoryId || (isListView && currentList ? currentList.id : targetTask.categoryId || sourceTask.categoryId));
      const newSectionId = isSmartView
        ? sourceTask.sectionId
        : (effectiveParent ? effectiveParent.sectionId : targetTask.sectionId);

      if (
        sourceTask.parentId !== newParentId ||
        sourceTask.categoryId !== newCategoryId ||
        sourceTask.sectionId !== newSectionId
      ) {
        taskUpdates[sourceTaskId] = {
          parentId: newParentId,
          categoryId: newCategoryId,
          sectionId: newSectionId
        };

        // Mantener consistentes las subtareas de la tarea movida sin cambiarles el parentId
        Object.values(tasks).forEach(c => {
          if (!c.deleted_at && c.parentId === sourceTaskId) {
            taskUpdates[c.id] = {
              categoryId: newCategoryId,
              sectionId: newSectionId
            };
          }
        });
      }
    }

    reorderTasks(reordered.map(t => t.id), Object.keys(taskUpdates).length > 0 ? taskUpdates : undefined);
    HapticService.selection();
  }, [visibleTasks, tasks, reorderTasks, sortBy, isSmartView, isListView, currentList]);

  const handleReorderSections = useCallback((sourceSectionId: string, targetSectionId: string, position: 'before' | 'after' = 'before') => {
    if (sourceSectionId === targetSectionId) return;
    const currentListSections = (listSections || [])
      .filter(s => s.listId === currentList?.id && !s.deleted_at)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const sourceIdx = currentListSections.findIndex(s => s.id === sourceSectionId);
    const targetIdx = currentListSections.findIndex(s => s.id === targetSectionId);
    if (sourceIdx === -1 || targetIdx === -1) return;

    const sourceSec = currentListSections[sourceIdx];
    const targetSec = currentListSections[targetIdx];

    // Verificar que targetSec no sea descendiente de sourceSec (evitar ciclos)
    const secMap = new Map(currentListSections.map(s => [s.id, s]));
    let isTargetDescendant = false;
    let curr = targetSec;
    const visited = new Set<string>();
    while (curr && curr.parentId) {
      if (curr.parentId === sourceSectionId) {
        isTargetDescendant = true;
        break;
      }
      if (visited.has(curr.parentId)) break;
      visited.add(curr.parentId);
      curr = secMap.get(curr.parentId)!;
    }
    if (isTargetDescendant) return;

    const reordered = [...currentListSections];
    const [removed] = reordered.splice(sourceIdx, 1);
    const newTargetIdx = reordered.findIndex(s => s.id === targetSectionId);
    const insertIdx = position === 'after' ? newTargetIdx + 1 : newTargetIdx;

    // Solo adoptar targetSec.parentId si es seguro y no apunta a sourceSec
    const safeParentId = (targetSec.parentId && targetSec.parentId !== sourceSectionId)
      ? targetSec.parentId
      : undefined;

    reordered.splice(insertIdx, 0, { ...removed, parentId: safeParentId });

    const updates = reordered.map((s, idx) => ({ id: s.id, order: idx }));
    reorderListSections(updates);
    if (sourceSec.parentId !== safeParentId) {
      updateListSection(sourceSec.id, { parentId: safeParentId });
    }
    HapticService.selection();
  }, [listSections, currentList?.id, reorderListSections, updateListSection]);

  // Calcular Resumen Financiero Total
  const totalCost = useMemo(() => {
    let sum = 0;
    const taskSet = isListView && currentList
      ? Object.values(tasks).filter(t => !t.deleted_at && (t.categoryId === currentList.id || (t as any).category_id === currentList.id))
      : viewTasks;
    taskSet.forEach(t => {
      if (t.price && !isTaskCompleted(t)) {
        sum += parseTaskPrice(t.price) * (t.quantity || 1);
      }
    });
    return sum;
  }, [viewTasks, isListView, currentList, tasks]);

  const completedCost = useMemo(() => {
    let sum = 0;
    const taskSet = isListView && currentList
      ? Object.values(tasks).filter(t => !t.deleted_at && (t.categoryId === currentList.id || (t as any).category_id === currentList.id))
      : viewTasks;
    taskSet.forEach(t => {
      if (t.price && isTaskCompleted(t)) {
        sum += parseTaskPrice(t.price) * (t.quantity || 1);
      }
    });
    return sum;
  }, [viewTasks, isListView, currentList, tasks]);


  // Número del título: como en la barra lateral (lo hecho en su periodo no cuenta)
  const titleCount = useMemo(() => new Set(viewTasks.filter(t =>
    !isTaskCompleted(t) && !isCompletedInCurrentPeriod(t, cycles, listSections, lists)
  ).map(t => t.id)).size, [viewTasks, cycles, listSections, lists]);
  const completedVisibleCount = useMemo(() => new Set(viewTasks.filter(t => isTaskCompleted(t)).map(t => t.id)).size, [viewTasks]);

  const cycleBreakdown = useMemo(() => {
    if (!currentCycle || cycleViewMode !== 'full_routine') return undefined;

    const pending = viewTasks.filter(t => !isTaskCompleted(t) && !isCompletedInCurrentPeriod(t, cycles, listSections, lists));
    const groups = new Map<string, { cycleId: string; cycleName: string; color?: string; count: number; durationMinutes: number; daysValue: number }>();

    for (const t of pending) {
      const effId = getEffectiveCycleId(t, listSections, lists) || t.cycle_id || currentCycle.id;
      const cycleObj = cycles.find(c => c.id === effId);
      const cycleName = cycleObj?.name || (effId === 'cycle_day' ? 'Diarias' : effId === 'cycle_week' ? 'Semanales' : effId === 'cycle_month' ? 'Mensuales' : effId === 'cycle_year' ? 'Anuales' : 'Otras');
      const color = cycleObj?.color || (effId === 'cycle_day' ? '#ff9500' : effId === 'cycle_week' ? '#007aff' : effId === 'cycle_month' ? '#af52de' : effId === 'cycle_year' ? '#34c759' : undefined);
      const daysVal = cycleObj?.daysValue || (effId === 'cycle_day' ? 1 : effId === 'cycle_week' ? 7 : effId === 'cycle_month' ? 30 : effId === 'cycle_year' ? 365 : 999);

      const dur = getTaskDuration(t, listSections, lists).activeMinutes;
      const current = groups.get(effId) || { cycleId: effId, cycleName, color, count: 0, durationMinutes: 0, daysValue: daysVal };
      current.count += 1;
      current.durationMinutes += dur;
      groups.set(effId, current);
    }

    const own = groups.get(currentCycle.id) || { cycleId: currentCycle.id, cycleName: currentCycle.name, color: currentCycle.color, count: 0, durationMinutes: 0, daysValue: currentCycle.daysValue };
    let accumulatedCount = 0;
    let accumulatedDurationMinutes = 0;

    const sortedGroups = Array.from(groups.values()).sort((a, b) => b.daysValue - a.daysValue);

    for (const grp of sortedGroups) {
      if (grp.cycleId !== currentCycle.id) {
        accumulatedCount += grp.count;
        accumulatedDurationMinutes += grp.durationMinutes;
      }
    }

    if (accumulatedCount === 0) return undefined;

    return {
      ownCount: own.count,
      accumulatedCount,
      ownDurationMinutes: own.durationMinutes,
      accumulatedDurationMinutes,
      details: sortedGroups
    };
  }, [currentCycle, cycleViewMode, viewTasks, cycles, listSections, lists]);

  // Vistas sin desglose por frecuencia: la duración total se reparte en puntuales y frecuencias (si hay mezcla).
  const viewMixParts = useMemo(
    () => (cycleBreakdown || isShoppingList(currentView, currentList) ? null : buildMixParts(viewTasks, listSections, lists)),
    [cycleBreakdown, currentView, currentList, viewTasks, listSections, lists]
  );

  // Group flattenedData into sections to enable native multi-tier CSS sticky push effect between sections
  const sectionGroups = useMemo(() => {
    interface SubSectionGroup {
      key: string;
      subHeaderItem?: { item: VirtualItemType; index: number };
      items: { item: VirtualItemType; index: number }[];
    }

    interface MasterSectionGroup {
      key: string;
      depth: number;
      headerItem?: { item: VirtualItemType; index: number };
      items: { item: VirtualItemType; index: number }[];
      subGroups: SubSectionGroup[];
    }

    const groups: MasterSectionGroup[] = [];

    let currentMasterGroup: MasterSectionGroup | null = null;
    let currentSubGroup: SubSectionGroup | null = null;

    for (let i = 0; i < flattenedData.length; i++) {
      const item = flattenedData[i];
      if (item.type === 'page-header') {
        if (currentMasterGroup) {
          groups.push(currentMasterGroup);
          currentMasterGroup = null;
          currentSubGroup = null;
        }
        groups.push({
          key: 'page-header-group',
          depth: 0,
          items: [{ item, index: i }],
          subGroups: []
        });
      } else if (item.type === 'header') {
        const itemDepth = item.depth ?? 0;
        if (itemDepth === 0) {
          if (currentMasterGroup) {
            groups.push(currentMasterGroup);
          }
          currentMasterGroup = {
            key: `master-group-${item.category || ''}-${item.sectionId || ''}-${i}`,
            depth: 0,
            headerItem: { item, index: i },
            items: [],
            subGroups: []
          };
          currentSubGroup = null;
        } else {
          // Sub-header (depth > 0, e.g. room like "Cocina", "Baño")
          if (currentMasterGroup) {
            currentSubGroup = {
              key: `sub-group-${item.category || ''}-${item.sectionId || ''}-${i}`,
              subHeaderItem: { item, index: i },
              items: []
            };
            currentMasterGroup.subGroups.push(currentSubGroup);
          } else {
            currentMasterGroup = {
              key: `master-group-${item.category || ''}-${item.sectionId || ''}-${i}`,
              depth: itemDepth,
              headerItem: { item, index: i },
              items: [],
              subGroups: []
            };
            currentSubGroup = null;
          }
        }
      } else {
        if (currentSubGroup) {
          currentSubGroup.items.push({ item, index: i });
        } else if (currentMasterGroup) {
          currentMasterGroup.items.push({ item, index: i });
        } else {
          currentMasterGroup = {
            key: `group-no-header-${i}`,
            depth: 0,
            items: [{ item, index: i }],
            subGroups: []
          };
          currentSubGroup = null;
        }
      }
    }

    if (currentMasterGroup) {
      groups.push(currentMasterGroup);
    }

    return groups;
  }, [flattenedData]);

  // 2. Scroll Container & Item Keys (Refactored to native fluid block layout for zero-overlap & perfect touch scroll)
  const parentRef = useRef<HTMLDivElement>(null);
  const scrollContentRef = useRef<HTMLDivElement>(null);
  const [needsBottomPadding, setNeedsBottomPadding] = useState(false);

  // Al cambiar de lista, el contenido entra con un fundido corto (sin remontar nada: solo una
  // animación del contenedor) y el scroll vuelve arriba, como al abrir otra lista en Recordatorios.
  const lastViewRef = useRef(currentView);
  useEffect(() => {
    if (lastViewRef.current === currentView) return;
    lastViewRef.current = currentView;
    parentRef.current?.scrollTo({ top: 0 });
    const el = scrollContentRef.current;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!el || reduce || typeof el.animate !== 'function') return;
    el.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: 180, easing: 'cubic-bezier(0.25, 1, 0.5, 1)' }
    );
  }, [currentView]);

  // Dynamic clearance for floating dock: only add bottom padding when content naturally exceeds or approaches the viewport
  useEffect(() => {
    const checkOverflow = () => {
      if (!parentRef.current || !scrollContentRef.current) return;
      const parentH = parentRef.current.clientHeight;
      const contentH = scrollContentRef.current.scrollHeight;
      setNeedsBottomPadding(contentH > parentH - 90);
    };

    checkOverflow();

    const parentEl = parentRef.current;
    const contentEl = scrollContentRef.current;
    if (!parentEl || !contentEl) return;

    const ro = new ResizeObserver(() => {
      checkOverflow();
    });
    ro.observe(parentEl);
    ro.observe(contentEl);

    return () => ro.disconnect();
  }, [flattenedData.length, currentView]);

  // Reset scroll position to top instantly whenever navigating to a different view or list
  useEffect(() => {
    if (parentRef.current) {
      parentRef.current.scrollTo({ top: 0, behavior: 'instant' as any });
      setScrollTop(0);
      setIsScrolled(false);
    }
  }, [currentView]);

  const getItemKey = useCallback((item: VirtualItemType, index: number) => {
    if (!item) return `empty-${index}`;
    if (item.type === 'page-header') return 'page-header';
    if (item.type === 'header') return `header-${item.category || ''}-${item.sectionId || ''}`;
    if (item.type === 'empty-section') return `empty-${item.category || ''}-${item.sectionId || ''}`;
    if (item.type === 'task') return (item as any).isUpNext ? `task-upnext-${item.task.id}` : `task-${item.task.id}`;
    return `item-${index}`;
  }, []);

  const currentListType = getListType(currentList, currentView);
  const isRoutine = doesListSupportSequenceMode(currentListType) || isRoutineList(currentView, currentList);
  // Empezar una tarea suelta: solo si la lista admite duración (rutinas), igual que la sección o la lista.
  const canStartIndividualTasks = isRoutine && !isShoppingList(currentView, currentList);
  const handleStartTask = useCallback((task: TaskItem) => {
    onStartSequence?.([task.id], task.title);
  }, [onStartSequence]);

  const renderTask = useCallback((task: TaskItem, itemStyle: React.CSSProperties, index: number, depth: number, isFirst: boolean, isLast: boolean, previousTaskId?: string, itemKey?: React.Key) => {
    const hasChildren = parentIdsWithChildren.has(task.id);
    const isExpanded = !isCatCollapsed(`task_${task.id}`);
    const taskIdxInVisible = visibleIndexById.get(task.id) ?? -1;
    const canMoveUp = taskIdxInVisible > 0;
    const canMoveDown = taskIdxInVisible >= 0 && taskIdxInVisible < visibleTasks.length - 1;

    return (
      <div
        key={itemKey ?? `task-${task.id}`}
        data-index={index}
        data-task-id={task.id}
        style={{ ...itemStyle, margin: 0, padding: '0 16px', boxSizing: 'border-box' }}
      >
        <div style={{ position: 'relative', width: '100%', boxSizing: 'border-box' }}>
          <TaskCard 
            task={task}
            virtualStyle={{ margin: 0, padding: 0, boxSizing: 'border-box' }}
            indent={depth * (isMobile ? 28 : 32)}
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
            onStartTask={canStartIndividualTasks ? handleStartTask : undefined}
            isSelected={selectedTaskIds.has(task.id)}
            onToggleSelect={handleToggleSelectTask}
            isSelectionMode={selectedTaskIds.size > 0}
            {...({
              hasChildren,
              isExpanded,
              onToggleExpand: () => toggleCategory(`task_${task.id}`)
            } as any)}
          />
        </div>
      </div>
    );
  }, [parentIdsWithChildren, visibleIndexById, isCatCollapsed, toggleCategory, handleToggleTask, handleDeleteTask, onOpenZenMode, onEditTask, onSelectView, currentView, setSelectedPersonForProfile, recentlyCompletedIds, visibleTasks, handleMoveTaskUp, handleMoveTaskDown, handleReorderTasks, canStartIndividualTasks, handleStartTask, selectedTaskIds, handleToggleSelectTask, isMobile]);

  const CycleIcon = currentCycle ? getCycleIcon(currentCycle.icon) : null;
  const smartListInfo = isSmartView ? SMART_LISTS.find(l => l.id === currentView) : null;
  const SmartIcon = smartListInfo ? smartListInfo.icon : null;
  // «Todos» es gris grafito: sobre negro no se lee, así que en oscuro usa un gris claro (--smart-all-color).
  const viewColorRaw = currentView === 'TRASH' ? '#8e8e93' : isSmartView ? (smartListInfo?.color || SMART_COLORS[currentView] || 'var(--accent-primary)') : (isListView && currentList) ? (currentList.color || 'var(--accent-primary)') : isFolderView ? (lists?.find(l => l.id === currentView.replace('folder_', ''))?.color || 'var(--accent-primary)') : currentCycle ? (currentCycle.color || getReservedFrequencyColor(currentCycle.id)) : 'var(--accent-primary)';
  const viewColor = viewColorRaw === '#48484a' ? 'var(--smart-all-color, #48484a)' : viewColorRaw;

  const getTitle = () => {
    if (currentView === 'TRASH') return 'Papelera';
    if (isSmartView) return smartListInfo?.name || 'Recordatorios';
    if (isFolderView) return currentList?.name || 'Carpeta';
    if (isListView) {
      if (currentList) return currentList.name;
      // La Bandeja de entrada es una lista virtual: no tiene objeto propio en `lists`.
      return currentView === 'list_inbox' ? 'Bandeja de entrada' : 'Lista';
    }
    return currentCycle?.name || 'Frecuencia';
  };

  const canStartSequence = isRoutine || (!currentList && viewTasksDuration.activeMinutes > 0);

  return (
    <main className="main-content" style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', overflowX: 'hidden', overscrollBehaviorX: 'none', position: 'relative' }}>
      {/* Sticky Glass Top Bar */}
      <MainGlassHeader
        isScrolled={isScrolled}
        scrollTop={scrollTop}
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
        showProminentStartButton={isRoutine && !isShoppingList(currentView, currentList)}
        startDuration={!isShoppingList(currentView, currentList) ? viewTasksDuration?.formattedActive : undefined}
        isStartDisabled={!viewTasks.some(t => !isTaskCompleted(t))}
        onStartSequence={onStartSequence && isRoutine && !isShoppingList(currentView, currentList) ? () => {
          const pendingTasks = viewTasks.filter(t => !isTaskCompleted(t));
          if (pendingTasks.length > 0) {
            onStartSequence(pendingTasks.map(t => t.id), getTitle(), viewColor);
          }
        } : undefined}
        onExportIcs={() => {
          downloadIcsFile(viewTasks, `${getTitle().toLowerCase().replace(/\s+/g, '_')}.ics`, getTitle());
          window.dispatchEvent(new CustomEvent('show-toast', { detail: `Calendario "${getTitle()}" (.ics) descargado` }));
        }}
        onExportPdf={() => {
          const total = viewTasks.length;
          const completed = viewTasks.filter(t => isTaskCompleted(t)).length;
          const pending = total - completed;
          const totalCost = viewTasks.reduce((acc, t) => acc + (t.price ? parseTaskPrice(t.price) * (t.quantity || 1) : 0), 0);

          exportReportToPdf({
            title: getTitle(),
            subtitle: `Lista de recordatorios — ${total} elementos`,
            stats: [
              { label: 'Total Recordatorios', value: total },
              { label: 'Completados', value: completed },
              { label: 'Pendientes', value: pending },
              ...(totalCost > 0 ? [{ label: 'Coste Total', value: `${totalCost.toFixed(2)} €` }] : [])
            ],
            items: viewTasks.map(t => ({
              title: t.title,
              status: t.status,
              dueDate: t.dueDate ? new Date(t.dueDate).toLocaleDateString('es-ES') : undefined,
              price: t.price,
              duration: t.duration,
              notes: t.description
            }))
          });
        }}
      />

      {/* Main Scrollable View */}
      {(() => {
        const hasSections = flattenedData.some(item => item.type === 'header' || item.type === 'empty-section');
        const isActuallyEmpty = visibleTasks.length === 0 && smartTasks.length === 0 && !hasSections && !isCalendarView;
        return (
          <div 
            ref={parentRef}
            className="content-scroll" 
            data-testid="content-scroll-container"
            onScroll={(e) => {
              const top = e.currentTarget.scrollTop;
              const clamped = Math.min(80, Math.max(0, top));
              setScrollTop(clamped);
              setIsScrolled(top > 32);
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
              flexDirection: isActuallyEmpty ? 'column' : undefined,
              WebkitMaskImage: 'linear-gradient(to bottom, #000 0px, #000 calc(100% - 24px), rgba(0,0,0,0.5) calc(100% - 8px), transparent 100%)',
              maskImage: 'linear-gradient(to bottom, #000 0px, #000 calc(100% - 24px), rgba(0,0,0,0.5) calc(100% - 8px), transparent 100%)',
              transition: 'mask-image 0.2s ease, -webkit-mask-image 0.2s ease'
            }}
          >
            <div 
              ref={scrollContentRef}
              style={{
                width: '100%',
                position: 'relative',
                boxSizing: 'border-box',
                flex: isActuallyEmpty ? 1 : undefined,
                display: isActuallyEmpty ? 'flex' : undefined,
                flexDirection: isActuallyEmpty ? 'column' : undefined
              }}
            >
              {sectionGroups.map((group) => {
                const renderItem = (item: any, index: number) => {
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
                          scrollTop={scrollTop}
                          isMobile={isMobile}
                          onBackToSidebar={onBackToSidebar}
                          onNavigateView={onSelectView}
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
                          completedCost={completedCost}
                          totalDuration={!isShoppingList(currentView, currentList) ? viewTasksDuration : undefined}
                          completedDuration={!isShoppingList(currentView, currentList) ? viewCompletedTasksDuration : undefined}
                          activeVisibleCount={titleCount}
                          completedVisibleCount={completedVisibleCount}
                          cycleBreakdown={cycleBreakdown}
                          mixParts={viewMixParts}
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
                          cycleRoutineMode={currentCycle ? cycleViewMode : undefined}
                          onToggleCycleRoutineMode={currentCycle ? toggleCycleGeneralMode : undefined}
                          onStartSequence={onStartSequence && isRoutine && !isShoppingList(currentView, currentList) ? () => {
                            const pendingTasks = visibleTasks.filter(t => !isTaskCompleted(t));
                            if (pendingTasks.length > 0) {
                              onStartSequence(pendingTasks.map(t => t.id), getTitle(), viewColor);
                            }
                          } : undefined}
                        />
                        {currentView === 'smart_today' && (
                          <>
                            <DailyBriefingBanner />
                            <WeeklyStreakWidget />
                          </>
                        )}
                        {isCalendarView && (
                          <Suspense fallback={null}>
                            <CalendarView onSelectView={(view) => onSelectView?.(view)} onEditTask={(taskId) => onEditTask?.(taskId)} />
                          </Suspense>
                        )}
                      </div>
                    );
                  } else if (data.type === 'header') {
                    const isCustomSection = data.sectionId !== undefined;
                    const sectionId = data.sectionId;
                    const isDraggingOver = dragOverSectionId === sectionId && isCustomSection;

                    const showDivider = index > 0 && flattenedData[index - 1]?.type !== 'page-header';
                    const sectionTasks = (data.category ? renderedSectionTasks[data.category] : null) || groupedTasks[data.category] || [];
                    const sectionTotal = sectionTasks.reduce((sum, t) => sum + (t.price && !isTaskCompleted(t) ? parseTaskPrice(t.price) * (t.quantity || 1) : 0), 0);
                    const sectionCompletedTotal = sectionTasks.reduce((sum, t) => sum + (t.price && isTaskCompleted(t) ? parseTaskPrice(t.price) * (t.quantity || 1) : 0), 0);
                    const sectionPendingTaskIds = data.sectionTaskIds || sectionTasks.filter(t => !isTaskCompleted(t)).map(t => t.id);
                    const tasksForSection = data.sectionTaskIds && data.sectionTaskIds.length > 0
                      ? data.sectionTaskIds.map((id: string) => tasks[id]).filter(Boolean)
                      : sectionTasks;
                    const activeMode = sectionRoutineModes[data.category] || data.routineMode || 'only_section';
                    const sectionDurationSummary = !isShoppingList(currentView, currentList) ? (data.routineDurations
                      ? (activeMode === 'full_routine' ? data.routineDurations.full : data.routineDurations.only)
                      : calculateTasksDuration(tasksForSection, listSections, lists)) : undefined;
                    const sectionCompletedDurationSummary = !isShoppingList(currentView, currentList)
                      ? calculateCompletedTasksDuration(tasksForSection, listSections, lists)
                      : undefined;
                    // Con «+ Diarias» ya hay desglose por frecuencia; si no, se reparte por tipo de tarea.
                    const sectionMixParts = !isShoppingList(currentView, currentList) && !(activeMode === 'full_routine' && data.routineParts)
                      ? buildMixParts(tasksForSection, listSections, lists)
                      : null;
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
                        editingSectionId={editingSectionId}
                        editingSectionName={editingSectionName}
                        setEditingSectionName={setEditingSectionName}
                        saveSectionName={saveSectionName}
                        startEditingSection={startEditingSection}
                        setSelectedPersonForProfile={setSelectedPersonForProfile}
                        sectionTotal={sectionTotal}
                        sectionCompletedTotal={sectionCompletedTotal}
                        durationSummary={sectionDurationSummary}
                        mixParts={sectionMixParts}
                        completedDurationSummary={sectionCompletedDurationSummary}
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
                        onStartSectionSequence={onStartSequence && canStartSequence && sectionDurationSummary.activeMinutes > 0 && sectionPendingTaskIds.length > 0 ? () => {
                          const rawTitle = (data?.title || '').replace(/^[\p{Emoji}\s⏳]+/gu, '').trim() || (data?.title || '');
                          const cleanTitle = rawTitle.length > 0 
                            ? rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1).toLowerCase() 
                            : 'Sección';
                          const isFullRoutine = activeMode === 'full_routine' && Boolean(data.routineCounts && data.routineCounts.full > data.routineCounts.only);
                          const modeSuffix = isFullRoutine
                            ? ' · Rutina completa'
                            : (data.routineCounts ? ` · Solo ${cleanTitle.toLowerCase()}` : '');
                          const seqTitle = currentList ? `${currentList.name} · ${cleanTitle}${modeSuffix}` : `${cleanTitle}${modeSuffix}`;
                          onStartSequence(sectionPendingTaskIds, seqTitle, data.color);
                        } : undefined}
                        pendingTaskCount={sectionPendingTaskIds.length}
                        isMobile={isMobile}
                        isPrevHeader={index > 0 && flattenedData[index - 1]?.type === 'header'}
                        isFirstAfterPageHeader={index > 0 && flattenedData[index - 1]?.type === 'page-header'}
                        isRoutine={isRoutine}
                        onReorderSections={handleReorderSections}
                      />
                    );
                  } else if (data.type === 'empty-section') {
                    return (
                      <div 
                        key={itemKey}
                        data-index={index}
                        style={{ 
                          ...itemStyle, 
                          paddingLeft: `${16 + data.depth * 14}px`,
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
                };

                const hasSubGroups = group.subGroups && group.subGroups.length > 0;

                return (
                  <div 
                    key={group.key} 
                    className="section-container" 
                    data-testid="master-section-container"
                    style={{ position: 'relative', width: '100%', boxSizing: 'border-box' }}
                  >
                    {group.headerItem && renderItem(group.headerItem.item, group.headerItem.index)}
                    {group.items.map(({ item, index }) => renderItem(item, index))}
                    {hasSubGroups && group.subGroups.map((subGroup) => (
                      <div
                        key={subGroup.key}
                        className="sub-section-container"
                        data-testid="sub-section-container"
                        style={{ position: 'relative', width: '100%', boxSizing: 'border-box' }}
                      >
                        {subGroup.subHeaderItem && renderItem(subGroup.subHeaderItem.item, subGroup.subHeaderItem.index)}
                        {subGroup.items.map(({ item, index }) => renderItem(item, index))}
                      </div>
                    ))}
                  </div>
                );
              })}

          {/* Se añade desde la barra de abajo (una sola forma de añadir, siempre en el mismo sitio) */}

          {isActuallyEmpty && (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              minHeight: 0,
              paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))',
              boxSizing: 'border-box'
            }}>
              <div style={{ width: '100%', maxWidth: 420, padding: '0 16px' }}>
                <MainEmptyState
                  currentView={currentView}
                  currentList={currentList}
                  currentCycle={currentCycle}
                />
              </div>
            </div>
          )}
        </div>

        {/* Dynamic bottom dock spacer: ONLY when content naturally exceeds or approaches the viewport */}
        {needsBottomPadding && !isActuallyEmpty && (
          <div 
            aria-hidden="true"
            style={{ 
              height: 'calc(90px + env(safe-area-inset-bottom, 0px))', 
              width: '100%', 
              flexShrink: 0,
              pointerEvents: 'none' 
            }} 
          />
        )}
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

      {(() => {
        const sectionMenuTasks = (sectionMenu.category ? renderedSectionTasks[sectionMenu.category] : null)
          || (sectionMenu.category ? (groupedTasks[sectionMenu.category] || []) : []);
        const pendingSectionTasks = sectionMenuTasks.filter(t => !isTaskCompleted(t) && !isCompletedInCurrentPeriod(t, cycles, listSections, lists));
        const allCompleted = sectionMenuTasks.length > 0 && pendingSectionTasks.length === 0;
        const curSection = sectionMenu.sectionId ? (listSections || []).find(s => s.id === sectionMenu.sectionId) : null;
        const siblings = curSection ? (listSections || [])
          .filter(s => s.listId === curSection.listId && !s.deleted_at && (s.parentId || undefined) === (curSection.parentId || undefined))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : [];
        const curSectionIdx = curSection ? siblings.findIndex(s => s.id === curSection.id) : -1;
        const canMoveUp = curSectionIdx > 0;
        const canMoveDown = curSectionIdx >= 0 && curSectionIdx < siblings.length - 1;

        return (
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
                const pendingIds = pendingSectionTasks.map(t => t.id);
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
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            onMoveUp={() => {
              if (!canMoveUp || curSectionIdx <= 0) return;
              const targetIdx = curSectionIdx - 1;
              const reordered = siblings.map((s, idx) => {
                let order = idx;
                if (idx === curSectionIdx) order = targetIdx;
                else if (idx === targetIdx) order = curSectionIdx;
                return { id: s.id, order };
              });
              reorderListSections(reordered);
            }}
            onMoveDown={() => {
              if (!canMoveDown || curSectionIdx < 0 || curSectionIdx >= siblings.length - 1) return;
              const targetIdx = curSectionIdx + 1;
              const reordered = siblings.map((s, idx) => {
                let order = idx;
                if (idx === curSectionIdx) order = targetIdx;
                else if (idx === targetIdx) order = curSectionIdx;
                return { id: s.id, order };
              });
              reorderListSections(reordered);
            }}
            taskCount={sectionMenuTasks.length}
            allCompleted={allCompleted}
            onToggleAllCompleted={() => {
              const taskIds = sectionMenuTasks.map(t => t.id);
              if (taskIds.length === 0) return;
              if (allCompleted) {
                setSectionTasksCompleted(taskIds, false);
              } else {
                setSectionTasksCompleted(pendingSectionTasks.map(t => t.id), true);
              }
            }}
            onDuplicateSection={sectionMenu.sectionId ? () => {
              duplicateSection(sectionMenu.sectionId!);
            } : undefined}
            onEmptySection={sectionMenuTasks.length > 0 ? handleEmptySectionMenu : undefined}
            onSortTasks={(criteria) => {
              if (sectionMenuTasks.length <= 1) return;
              const sorted = [...sectionMenuTasks].sort((a, b) => {
                if (criteria === 'priority') {
                  const pMap: Record<string, number> = { high: 3, medium: 2, low: 1, none: 0 };
                  const pA = pMap[a.priority || 'none'] || 0;
                  const pB = pMap[b.priority || 'none'] || 0;
                  return pB - pA;
                }
                if (criteria === 'dueDate') {
                  if (!a.dueDate && !b.dueDate) return 0;
                  if (!a.dueDate) return 1;
                  if (!b.dueDate) return -1;
                  return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                }
                return (a.title || '').localeCompare(b.title || '', 'es');
              });
              reorderTasks(sorted.map(t => t.id));
            }}
            onMoveAllTasks={(targetListId, targetSectionId) => {
              const taskIds = sectionMenuTasks.map(t => t.id);
              if (taskIds.length === 0) return;
              moveSectionTasks(taskIds, targetListId, targetSectionId);
            }}
            lists={lists || []}
            sections={(listSections || []).filter(s => s.listId === currentList?.id && !s.deleted_at)}
          />
        );
      })()}

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

      <Suspense fallback={null}>
        {selectedPersonForProfile && (
          <PersonProfileModal
            personName={selectedPersonForProfile}
            isOpen
            onClose={() => setSelectedPersonForProfile(null)}
            allTasks={allTasksArray}
            onEditTask={onEditTask}
            onAddMemoryWithPerson={() => onOpenNewTask('que_he_hecho')}
          />
        )}
        {monthlySummaryModal.open && (
          <MonthlySummaryModal
            modal={monthlySummaryModal}
            onClose={() => setMonthlySummaryModal(prev => ({ ...prev, open: false }))}
          />
        )}
      </Suspense>

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
              <QuickAddBar currentView={currentView} onExpandDrawer={(draft) => onOpenNewTask(undefined, draft)} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'auto', flexShrink: 0 }}>
              <BottomShortcutBar />
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

      <BatchTaskActionsBar
        selectedTaskIds={selectedTaskIds}
        onClearSelection={() => setSelectedTaskIds(new Set())}
        listSections={listSections || []}
        tasks={tasks}
        currentListId={currentList?.id}
      />
    </main>
  );
}
