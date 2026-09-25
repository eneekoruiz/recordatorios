import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Sidebar } from './components/layout/Sidebar';
import { MainContent } from './components/layout/MainContent';
import { WidgetDashboard } from './components/layout/WidgetDashboard';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { TaskDrawer } from './components/tasks/TaskDrawer';
import { PromptModal } from './components/layout/PromptModal';
import { UniversalImporter } from './components/views/UniversalImporter';
import { SpotlightModal } from './components/search/SpotlightModal';
import { ZenMode } from './components/tasks/ZenMode';
import { ListSequenceMode } from './components/tasks/ListSequenceMode';
import { GeolocationService } from './services/GeolocationService';
import { useAppStore, isTaskCompleted } from './store/useAppStore';
import { useNavigation } from './hooks/useNavigation';
import { NavigationFrame } from './components/layout/NavigationFrame';
import { AuthScreen } from './components/auth/AuthScreen';
import { InstallPromptModal } from './components/layout/InstallPromptModal';
import { ShortcutsModal } from './components/layout/ShortcutsModal';
import { DailyGreetingModal } from './components/layout/DailyGreetingModal';
import { syncManager } from './sync/syncManager';
import { TaskSkeletonLoader } from './components/ui/TaskSkeletonLoader';
import { AIAssistantModal } from './components/ai/AIAssistantModal';
import { ConfirmHost } from './components/ui/confirmDialog';
import { SharedListView } from './components/share/SharedListView';
import { syncSharedStatus } from './services/ShareService';
import { 
  formatSectionTitle, 
  getTaskPeriodicity, 
  getSectionPeriodicity,
  stripPeriodicityPrefix,
  getPeriodicityFromPrefix
} from './utils/sectionRoutine';
import { normalizeTaskPrices } from './utils/priceExtractor';
import { ensureLimpiezaSections, getRoomForCleaningTask } from './utils/specialLists';
import { isKnownRedundantTask, semanticKey, normalizeTitle } from './utils/taskDeduplication';
import type { TaskItem } from './models/Task';
import { useSystemTheme } from './hooks/useSystemTheme';

function App() {
  useSystemTheme();
  // ── All hooks FIRST (before any conditional returns) ──────────────
  const token = useAppStore((state) => state.token);
  const tasks = useAppStore((state) => state.tasks); // Subscribing to tasks
  const [currentView, setCurrentView] = useState(() => {
    try {
      if (localStorage.getItem('hide_onboarding_guide') === 'true') return 'smart_today';
    } catch { /* sin almacenamiento */ }
    return 'smart_primeros_pasos';
  });
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [mobileView, setMobileView] = useState<'sidebar' | 'content'>('sidebar');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [drawerInitialFocus, setDrawerInitialFocus] = useState<string | undefined>(undefined);
  const [defaultSectionId, setDefaultSectionId] = useState<string | undefined>(undefined);
  const [zenModeTaskId, setZenModeTaskId] = useState<string | null>(null);
  const [sequenceMode, setSequenceMode] = useState<{ taskIds: string[]; listName: string; listColor?: string } | null>(null);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [aiInitialPrompt, setAiInitialPrompt] = useState('');
  const hasHydrated = useAppStore((state) => state.hasHydrated);
  // Enlaces especiales: recuperación de contraseña (?reset=) y lista compartida (?share=)
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get('reset'));
  const [shareToken, setShareToken] = useState(() => new URLSearchParams(window.location.search).get('share'));
  const clearUrlParam = (param: string) => {
    const url = new URL(window.location.href);
    url.searchParams.delete(param);
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  };

  // Global listener for AI Assistant (shortcut Ctrl+J / Cmd+J and custom event)
  useEffect(() => {
    const handleOpenAI = (e: any) => {
      setAiInitialPrompt(e.detail || '');
      setIsAIAssistantOpen(true);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') && target.id !== 'quick-add-input') {
          // Si está en un input normal, no interrumpir excepto que sea el quick-add
        } else {
          e.preventDefault();
          setIsAIAssistantOpen(prev => !prev);
        }
      }
    };
    window.addEventListener('open-ai-assistant', handleOpenAI);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('open-ai-assistant', handleOpenAI);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // IndexedDB can be unavailable in privacy/restricted contexts. Never strand the
  // user behind an infinite loader: continue with the safe in-memory defaults.
  useEffect(() => {
    if (hasHydrated) return;
    const hydrationGuard = window.setTimeout(() => {
      useAppStore.getState().setHasHydrated(true);
    }, 600); // 600ms max — avoid getting stuck on the loader
    return () => window.clearTimeout(hydrationGuard);
  }, [hasHydrated]);

  // Limpieza higiénica al arrancar: purgar recordatorios vacíos residuales
  useEffect(() => {
    if (!hasHydrated) return;
    const state = useAppStore.getState();
    const allTasks = Object.values(state.tasks || {});
    allTasks.forEach((t: any) => {
      if (!t.deleted_at && (!t.title || !t.title.trim())) {
        state.deleteTask(t.id);
      }
    });
  }, [hasHydrated]);

  // Si los primeros pasos ya están completados o sin tareas pendientes, redirigir automáticamente fuera de ella
  useEffect(() => {
    if (currentView === 'smart_primeros_pasos' || currentView === 'list_primeros_pasos') {
      const allTasks = Object.values(tasks || {}).filter((t: any) => !t.deleted_at);
      const activePrimerosPasos = allTasks.filter((t: any) => t.categoryId === 'primeros_pasos' && !isTaskCompleted(t));
      if (allTasks.length > 0 && activePrimerosPasos.length === 0) {
        setCurrentView('smart_today');
      }
    }

    if (['list_limpieza_diaria', 'list_limpieza_semanal', 'list_limpieza_mensual', 'list_limpieza_anual'].includes(currentView)) {
      setCurrentView('list_limpieza');
    }
  }, [currentView, tasks]);

  const navStack = useNavigation((state) => state.stack);
  const navView = useNavigation((state) => state.currentView());
  const { pop: navPop, reset: navReset } = useNavigation();
  const [globalToast, setGlobalToast] = useState<{ message: string; onUndo?: () => void } | string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const theme = useAppStore((state) => state.theme) || 'light';

  // ── Theme synchronization (Always light mode by default) ─────────
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#000000' : '#ffffff');
    }
  }, [theme]);

  useEffect(() => {
    const handleToast = (e: any) => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      setGlobalToast(e.detail);
      const timeoutMs = (typeof e.detail === 'object' && e.detail?.onUndo) ? 6000 : 3500;
      toastTimerRef.current = window.setTimeout(() => setGlobalToast(null), timeoutMs);
    };
    window.addEventListener('show-toast', handleToast);
    return () => {
      window.removeEventListener('show-toast', handleToast);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  // ── Resize / Orientation listener ────────────────────────────────
  useEffect(() => {
    const recalcLayout = () => {
      const isMobileNow = 
        window.innerWidth <= 768 ||
        (window.innerHeight <= 500 && window.innerWidth <= 1024) ||
        (window.matchMedia?.('(pointer: coarse)').matches && window.innerWidth <= 900);

      setIsMobile(isMobileNow);

      // Reset window scroll offset to prevent iOS / Android browser bars from shifting headers off-screen
      window.scrollTo(0, 0);
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    };

    recalcLayout(); // Immediate sync on mount
    window.addEventListener('resize', recalcLayout);
    // orientationchange fires before resize completes on some mobile browsers;
    // use multiple short delays so inner dimensions and safe-areas settle.
    const handleOrientation = () => {
      recalcLayout();
      setTimeout(recalcLayout, 50);
      setTimeout(recalcLayout, 150);
      setTimeout(recalcLayout, 300);
    };
    window.addEventListener('orientationchange', handleOrientation);
    if (screen.orientation) {
      screen.orientation.addEventListener('change', handleOrientation);
    }
    return () => {
      window.removeEventListener('resize', recalcLayout);
      window.removeEventListener('orientationchange', handleOrientation);
      if (screen.orientation) {
        screen.orientation.removeEventListener('change', handleOrientation);
      }
    };
  }, []);

  // ── Geolocation / Geofencing (single instance) ───────────────────
  useEffect(() => {
    const geoService = GeolocationService.getInstance();

    const getGeoTasks = () => {
      return Object.values(tasks).filter(
        (t) => t.status === 'pending' && !t.deleted_at && t.location,
      );
    };

    geoService.startGeofencing(getGeoTasks);
    
    // Cleanup no borra el watcher si no hay tareas, pero stopGeofencing lo maneja
    return () => {
      // Solo detenemos si el componente App se desmonta (casi nunca), 
      // o cuando cambian las dependencias para reiniciar con nuevas tareas.
      geoService.stopGeofencing();
    };
  }, [tasks]); // Re-evaluar cuando cambien las tareas

  // ── Default lists initialization & Data Hygiene ──────────────────
  // Se ejecuta una sola vez, cuando los datos locales ya se han cargado de IndexedDB
  // (antes se lanzaba sobre un estado vacío y su efecto dependía de una carrera).
  const initDoneRef = useRef(false);
  useEffect(() => {
    if (!hasHydrated || initDoneRef.current) return;
    initDoneRef.current = true;
    const state = useAppStore.getState();
    const lists = state.lists;

    // Verificar si la guía ya fue ocultada o completada (localmente o en la nube)
    const isCloudHidden = false; // la preferencia de la nube llega vía User.preferences (hideOnboarding)
    const isLocalHidden = localStorage.getItem('hide_onboarding_guide') === 'true';

    // Comprobar si el usuario ya es un usuario con datos reales (tareas o listas personalizadas)
    const existingTasksList = Object.values(state.tasks || {});
    const hasRealTasks = existingTasksList.some(t => !t.deleted_at && t.categoryId !== 'primeros_pasos');
    const hasCustomLists = (lists || []).some(l => 
      l.id !== 'primeros_pasos' && 
      l.id !== 'inbox' && 
      !l.id.startsWith('user_preferences_') &&
      !['compras', 'personal', 'trabajo', 'care', 'quehaceres', 'limpieza', 'caducidades', 'que_he_hecho'].includes(l.id)
    );
    const isEstablishedUser = hasRealTasks || hasCustomLists;
    const isHidden = isLocalHidden || isCloudHidden || isEstablishedUser;

    if (isEstablishedUser && !isLocalHidden) {
      localStorage.setItem('hide_onboarding_guide', 'true');
    }

    if (isHidden) {
      if (state.pinnedSmartLists?.includes('smart_primeros_pasos')) {
        const cleaned = state.pinnedSmartLists.filter(id => id !== 'smart_primeros_pasos');
        useAppStore.setState({ pinnedSmartLists: cleaned });
      }
      if (lists?.some(l => l.id === 'primeros_pasos')) {
        state.removeList('primeros_pasos');
      }
      existingTasksList.forEach(t => {
        if (t.categoryId === 'primeros_pasos' || t.id.startsWith('task_onboarding_')) {
          state.deleteTask(t.id);
        }
      });
    }

    const activeTasks = Object.values(state.tasks || {}).filter((t: any) => !t.deleted_at);

    // Hygiene: remove dummy section header tasks imported from PDF
    const dummyHeaderTitles = new Set(['diarias', 'semanales', 'mensuales', 'anuales']);
    const dummySectionTasks = new Set([
      'skin-care diaria', 'limpieza diaria', 'skincare semanal', 'limpieza semanal',
      'skin-care mensual', 'limpieza mensual', 'compra mensual', 'compra anual', 'limpieza anual'
    ]);
    const cleaningRoomHeaders = new Set([
      'habitación', 'habitacion', 'cocina', 'pasillo / entrada', 'baño', 'bano', 'balcón', 'balcon', 'general'
    ]);
    const activeTasksMap = new Map(activeTasks.map((t: any) => [t.id, t]));
    const dummyIdsToPurge = new Set<string>();
    activeTasks.forEach((t: any) => {
      const clean = (t.title || '').trim().toLowerCase();
      const cat = t.categoryId || (t as any).category_id;
      const isCleaningRoom = cat === 'limpieza' && cleaningRoomHeaders.has(clean);
      if (dummyHeaderTitles.has(clean) || dummySectionTasks.has(clean) || isCleaningRoom) {
        dummyIdsToPurge.add(t.id);
        state.deleteTask(t.id);
      }
    });
    activeTasks.forEach((t: any) => {
      if (t.parentId && (dummyIdsToPurge.has(t.parentId) || !activeTasksMap.has(t.parentId))) {
        state.updateTask(t.id, { parentId: undefined });
      }
    });

    // Hygiene: remove known redundant or cross-frequency tasks
    activeTasks.forEach((t: any) => {
      if (isKnownRedundantTask(t.title)) {
        state.deleteTask(t.id);
      }
    });

    const targetCategories = ['care', 'limpieza', 'compra', 'quehaceres'];
    for (const cat of targetCategories) {
      // Re-filter active tasks after pruning known redundant items
      const catTasks = Object.values(state.tasks || {}).filter(
        (t: any) => !t.deleted_at && (t.categoryId || (t as any).category_id) === cat
      );
      const titleGroups = new Map<string, any[]>();
      for (const t of catTasks) {
        const key = semanticKey(t.title) || normalizeTitle(t.title);
        if (!key) continue;
        if (!titleGroups.has(key)) {
          titleGroups.set(key, []);
        }
        titleGroups.get(key)!.push(t);
      }
      for (const [, items] of titleGroups.entries()) {
        if (items.length > 1) {
          items.sort((a, b) => {
            const score = (p: any) => {
              let s = 0;
              // Higher frequency tasks take precedence over lower frequency tasks when cross-frequency duplicates occur
              const sec = (p.sectionId || '').toLowerCase();
              if (sec.includes('diari')) s += 80;
              else if (sec.includes('seman')) s += 60;
              else if (sec.includes('mensu')) s += 40;
              else if (sec.includes('anual')) s += 20;

              if (p.status === 'completed') s += 100;
              if (p.notes || (p.description && p.description.length > 15)) s += 50;
              if (p.parentId) s += 40;
              if (p.price && Number(p.price) > 0) s += 30;
              if (p.cycle_id) s += 20;
              if (p.alerts && p.alerts.length > 0) s += 10;
              if (p.completionHistory && p.completionHistory.length > 0) s += 10;
              s += (p.version || 1);
              return s;
            };
            const diff = score(b) - score(a);
            if (diff !== 0) return diff;
            const tA = new Date(a.created_at || a.createdAt || 0).getTime();
            const tB = new Date(b.created_at || b.createdAt || 0).getTime();
            return tA - tB;
          });
          const duplicates = items.slice(1);
          duplicates.forEach(dup => {
            state.deleteTask(dup.id);
          });
        }
      }
    }

    // Las listas por defecto llevan fecha "epoch": si la cuenta ya tiene esas listas en la nube
    // (personalizadas), el Last-Write-Wins del servidor conserva las suyas en lugar de estas.
    const EPOCH = new Date(0).toISOString();
    if (!lists || lists.length === 0) {
      const initial = [
        ...(isHidden ? [] : [{ id: 'primeros_pasos', name: 'Primeros Pasos', color: '#ff2d55', icon: 'rocket', isPinned: false }]),
        { id: 'compras', name: 'Compras', color: '#ff9500', icon: 'shopping-cart' },
        { id: 'personal', name: 'Personal', color: '#af52de', icon: 'heart' },
        { id: 'trabajo', name: 'Trabajo', color: '#0a84ff', icon: 'briefcase' },
        { id: 'caducidades', name: 'Caducidades', color: '#ff9500', icon: 'credit-card' },
        { id: 'que_he_hecho', name: 'Qué he hecho', color: '#5856d6', icon: 'book-open' },
        { id: 'limpieza', name: 'Limpieza', color: '#32ade6', icon: 'sparkles' },
        { id: 'quehaceres', name: 'Quehaceres', color: '#ff9500', icon: 'check-square' },
        { id: 'care', name: 'Care', color: '#af52de', icon: 'heart' },
      ];
      initial.forEach((l) => state.addList({ ...l, updated_at: EPOCH }));
      state.addListSection({ id: 'sec_tarjetas', listId: 'caducidades', name: 'Tarjetas y Documentos', order: 0, updated_at: EPOCH });
      state.addListSection({ id: 'sec_suscripciones', listId: 'caducidades', name: 'Suscripciones', order: 1, updated_at: EPOCH });
      state.addListSection({ id: 'sec_limpieza_diaria', listId: 'limpieza', name: 'Diarias', order: 0, updated_at: EPOCH });
      state.addListSection({ id: 'sec_limpieza_semanal', listId: 'limpieza', name: 'Semanales', order: 1, updated_at: EPOCH });
      state.addListSection({ id: 'sec_limpieza_mensual', listId: 'limpieza', name: 'Mensuales', order: 2, updated_at: EPOCH });
      state.addListSection({ id: 'sec_limpieza_anual', listId: 'limpieza', name: 'Anuales', order: 3, updated_at: EPOCH });
      state.addListSection({ id: 'sec_quehaceres_diarias', listId: 'quehaceres', name: 'Diarias', order: 0, updated_at: EPOCH });
      state.addListSection({ id: 'sec_quehaceres_semanales', listId: 'quehaceres', name: 'Semanales', order: 1, updated_at: EPOCH });
      state.addListSection({ id: 'sec_quehaceres_mensuales', listId: 'quehaceres', name: 'Mensuales', order: 2, updated_at: EPOCH });
      state.addListSection({ id: 'sec_quehaceres_anuales', listId: 'quehaceres', name: 'Anuales', order: 3, updated_at: EPOCH });
      state.addListSection({ id: 'sec_care_diarias', listId: 'care', name: 'Diarias', order: 0, updated_at: EPOCH });
      state.addListSection({ id: 'sec_care_semanales', listId: 'care', name: 'Semanales', order: 1, updated_at: EPOCH });
      state.addListSection({ id: 'sec_care_mensuales', listId: 'care', name: 'Mensuales', order: 2, updated_at: EPOCH });
      state.addListSection({ id: 'sec_care_anuales', listId: 'care', name: 'Anuales', order: 3, updated_at: EPOCH });
      state.addListSection({ id: 'sec_compras_diarias', listId: 'compras', name: 'Diarias', order: 0, updated_at: EPOCH });
      state.addListSection({ id: 'sec_compras_semanales', listId: 'compras', name: 'Semanales', order: 1, updated_at: EPOCH });
      state.addListSection({ id: 'sec_compras_mensuales', listId: 'compras', name: 'Mensuales', order: 2, updated_at: EPOCH });
      state.addListSection({ id: 'sec_compras_anuales', listId: 'compras', name: 'Anuales', order: 3, updated_at: EPOCH });
    } else {
      if (!lists.some(l => l.id === 'primeros_pasos') && !isHidden) {
        state.addList({ id: 'primeros_pasos', name: 'Primeros Pasos', color: '#ff2d55', icon: 'rocket', isPinned: false, updated_at: EPOCH });
      }
      if (!lists.some(l => l.id === 'caducidades')) {
        state.addList({ id: 'caducidades', name: 'Caducidades', color: '#ff9500', icon: 'credit-card', updated_at: EPOCH });
      }
      if (!lists.some(l => l.id === 'que_he_hecho')) {
        state.addList({ id: 'que_he_hecho', name: 'Qué he hecho', color: '#5856d6', icon: 'book-open', updated_at: EPOCH });
      }

      // Secciones de Caducidades
      const sections = state.listSections || [];
      if (!sections.some(s => s.id === 'sec_tarjetas' || (s.listId === 'caducidades' && (s.name || '').toLowerCase().includes('tarjeta')))) {
        state.addListSection({
          id: 'sec_tarjetas',
          listId: 'caducidades',
          name: 'Tarjetas y Documentos',
          order: 0, updated_at: EPOCH
        });
      }
      if (!sections.some(s => s.id === 'sec_suscripciones' || (s.listId === 'caducidades' && (s.name || '').toLowerCase().includes('suscrip')))) {
        state.addListSection({
          id: 'sec_suscripciones',
          listId: 'caducidades',
          name: 'Suscripciones',
          order: 1, updated_at: EPOCH
        });
      }

      // Asegurar que Limpieza esté unificada como una lista única con sus 4 secciones
      const limpiezaList = lists.find(l => l.id === 'limpieza');
      if (limpiezaList) {
        if (limpiezaList.isFolder || limpiezaList.icon === 'folder' || limpiezaList.icon === 'list' || limpiezaList.parentId) {
          state.updateList('limpieza', { isFolder: false, icon: 'sparkles', color: limpiezaList.color || '#32ade6', parentId: undefined });
        }
      } else if (!isHidden) {
        state.addList({ id: 'limpieza', name: 'Limpieza', color: '#32ade6', icon: 'sparkles', isFolder: false, updated_at: EPOCH });
      }

      // Secciones de Limpieza (Diarias, Semanales, Mensuales, Anuales y subgrupos de estancia)
      ensureLimpiezaSections('limpieza', state.listSections || [], (sec) => {
        state.addListSection({ ...sec, updated_at: EPOCH });
      }, (id, updates) => {
        const sec = (state.listSections || []).find(s => s.id === id);
        if (sec) {
          state.addListSection({ ...sec, ...updates, updated_at: EPOCH });
        }
      });

      // Normalizar parentId en subsecciones de limpieza existentes
      const allAppSecs = state.listSections || [];
      const legacyRootMap: Record<string, string> = {
        'sec_limp_diaria': 'sec_limpieza_diaria',
        'sec_limp_semanal': 'sec_limpieza_semanal',
        'sec_limp_mensual': 'sec_limpieza_mensual',
        'sec_limp_anual': 'sec_limpieza_anual',
      };
      allAppSecs.forEach(sec => {
        if (sec.parentId && legacyRootMap[sec.parentId]) {
          const rootTarget = legacyRootMap[sec.parentId];
          if (allAppSecs.some(s => s.id === rootTarget)) {
            state.addListSection({ ...sec, parentId: rootTarget, updated_at: EPOCH });
          }
        }
      });

      // Secciones unificadas para Quehaceres si existe la lista
      const quehaceresList = lists.find(l => l.id === 'quehaceres' || (l.name || '').toLowerCase() === 'quehaceres');
      if (quehaceresList) {
        const qSections = [
          { id: `sec_${quehaceresList.id}_diarias`, name: 'Diarias', order: 0, root: 'diari' },
          { id: `sec_${quehaceresList.id}_semanales`, name: 'Semanales', order: 1, root: 'seman' },
          { id: `sec_${quehaceresList.id}_mensuales`, name: 'Mensuales', order: 2, root: 'mensu' },
          { id: `sec_${quehaceresList.id}_anuales`, name: 'Anuales', order: 3, root: 'anual' },
        ];
        qSections.forEach(qSec => {
          if (!sections.some(s => s.listId === quehaceresList.id && ((s.name || '').toLowerCase().includes(qSec.root) || (qSec.root === 'diari' && (s.name || '').toLowerCase().includes('recurrent'))))) {
            state.addListSection({
              id: qSec.id,
              listId: quehaceresList.id,
              name: qSec.name,
              order: qSec.order,
              updated_at: EPOCH
            });
          }
        });
      }

      // Asegurar que Care esté presente como lista de rutinas de cuidado personal (facial, corporal, higiene)
      const careList = lists.find(l => l.id === 'care' || (l.name || '').toLowerCase() === 'care' || (l.name || '').toLowerCase() === 'skincare' || (l.name || '').toLowerCase() === 'cuidado personal');
      const careListId = careList ? careList.id : 'care';
      if (!careList) {
        state.addList({
          id: 'care',
          name: 'Care',
          color: '#af52de',
          icon: 'heart',
          isFolder: false,
          updated_at: EPOCH
        });
      }

      // Secciones unificadas para Care
      const careSections = [
        { id: `sec_${careListId}_diarias`, name: 'Diarias', order: 0, root: 'diari' },
        { id: `sec_${careListId}_semanales`, name: 'Semanales', order: 1, root: 'seman' },
        { id: `sec_${careListId}_mensuales`, name: 'Mensuales', order: 2, root: 'mensu' },
        { id: `sec_${careListId}_anuales`, name: 'Anuales', order: 3, root: 'anual' },
      ];
      careSections.forEach(cSec => {
        if (!sections.some(s => s.listId === careListId && ((s.name || '').toLowerCase().includes(cSec.root) || (cSec.root === 'diari' && (s.name || '').toLowerCase().includes('recurrent'))))) {
          state.addListSection({
            id: cSec.id,
            listId: careListId,
            name: cSec.name,
            order: cSec.order,
            updated_at: EPOCH
          });
        }
      });

      // Secciones unificadas para Compra si existe la lista
      const compraList = lists.find(l => l.id === 'compra' || l.id === 'compras' || (l.name || '').toLowerCase().includes('compra'));
      const compraListId = compraList ? compraList.id : 'compra';
      if (compraList) {
        const compraSections = [
          { id: `sec_${compraListId}_diarias`, name: 'Diarias', order: 0, root: 'diari' },
          { id: `sec_${compraListId}_semanales`, name: 'Semanales', order: 1, root: 'seman' },
          { id: `sec_${compraListId}_mensuales`, name: 'Mensuales', order: 2, root: 'mensu' },
          { id: `sec_${compraListId}_anuales`, name: 'Anuales', order: 3, root: 'anual' },
        ];
        compraSections.forEach(cSec => {
          if (!sections.some(s => s.listId === compraListId && ((s.name || '').toLowerCase().includes(cSec.root) || (cSec.root === 'diari' && (s.name || '').toLowerCase().includes('recurrent'))))) {
            state.addListSection({
              id: cSec.id,
              listId: compraListId,
              name: cSec.name,
              order: cSec.order,
              updated_at: EPOCH
            });
          }
        });
      }

      // Unificación homogénea de nombres de secciones en todas las listas (Quehaceres, Limpieza, etc.)
      // Asegura estilo limpio y coherente estilo Apple (Diarias, Semanales, Mensuales, Anuales) sin mayúsculas agresivas
      const existingSections = state.listSections || [];
      existingSections.forEach(sec => {
        const unified = formatSectionTitle(sec.name);
        if (unified && unified !== sec.name) {
          state.updateListSection(sec.id, unified);
        }
      });

      // Migrar tareas de sublistas de limpieza a la lista unificada con su sección
      const allTasksList = Object.values(state.tasks || {});
      const sublistMapping: Record<string, { secId: string; cycleId: string }> = {
        'limpieza_diaria': { secId: 'sec_limpieza_diaria', cycleId: 'cycle_day' },
        'limpieza_semanal': { secId: 'sec_limpieza_semanal', cycleId: 'cycle_week' },
        'limpieza_mensual': { secId: 'sec_limpieza_mensual', cycleId: 'cycle_month' },
        'limpieza_anual': { secId: 'sec_limpieza_anual', cycleId: 'cycle_year' }
      };

      allTasksList.forEach(t => {
        const cat = t.categoryId || (t as any).category_id;
        const mapping = cat ? sublistMapping[cat] : undefined;
        if (mapping) {
          const room = getRoomForCleaningTask(t.title);
          const freq = mapping.cycleId === 'cycle_day' ? 'diaria' : mapping.cycleId === 'cycle_week' ? 'semanal' : mapping.cycleId === 'cycle_month' ? 'mensual' : 'anual';
          const roomSlug = room === 'Pasillo / Entrada' ? 'pasillo' :
                           room === 'Habitación' ? 'hab' :
                           room === 'Baño' ? 'bano' :
                           room === 'Balcón' ? 'balcon' :
                           room === 'Cocina' ? 'cocina' : 'general';
          state.updateTaskRaw({
            ...t,
            categoryId: 'limpieza',
            sectionId: `sec_limp_${freq}_${roomSlug}`,
            cycle_id: t.cycle_id || mapping.cycleId,
            updated_at: new Date().toISOString(),
            _is_dirty: true
          });
        } else if (cat === 'limpieza') {
          const secNorm = `${t.sectionId || ''} ${t.cycle_id || ''}`.toLowerCase();
          let freq = 'diaria';
          if (secNorm.includes('anual') || t.cycle_id === 'cycle_year') freq = 'anual';
          else if (secNorm.includes('mensu') || t.cycle_id === 'cycle_month') freq = 'mensual';
          else if (secNorm.includes('seman') || t.cycle_id === 'cycle_week') freq = 'semanal';

          const isGenericSection = !t.sectionId ||
            t.sectionId === 'sec_limpieza_diaria' || t.sectionId === 'sec_limp_diaria' ||
            t.sectionId === 'sec_limpieza_semanal' || t.sectionId === 'sec_limp_semanal' ||
            t.sectionId === 'sec_limpieza_mensual' || t.sectionId === 'sec_limp_mensual' ||
            t.sectionId === 'sec_limpieza_anual' || t.sectionId === 'sec_limp_anual';

          if (isGenericSection) {
            const room = getRoomForCleaningTask(t.title);
            const roomSlug = room === 'Pasillo / Entrada' ? 'pasillo' :
                             room === 'Habitación' ? 'hab' :
                             room === 'Baño' ? 'bano' :
                             room === 'Balcón' ? 'balcon' :
                             room === 'Cocina' ? 'cocina' : 'general';
            const cycleId = freq === 'diaria' ? 'cycle_day' : freq === 'semanal' ? 'cycle_week' : freq === 'mensual' ? 'cycle_month' : 'cycle_year';
            state.updateTaskRaw({
              ...t,
              sectionId: `sec_limp_${freq}_${roomSlug}`,
              cycle_id: t.cycle_id || cycleId,
              updated_at: new Date().toISOString(),
              _is_dirty: true
            });
          }
        } else if (t.categoryId === 'compra' || t.categoryId === 'compras') {
          if (t.sectionId === 'sec_compra_mensual') {
            state.updateTaskRaw({
              ...t,
              sectionId: `sec_${compraListId}_mensuales`,
              cycle_id: 'cycle_month',
              updated_at: new Date().toISOString(),
              _is_dirty: true
            });
          } else if (t.sectionId === 'compra_anual' || t.sectionId === 'sec_compra_anual') {
            state.updateTaskRaw({
              ...t,
              sectionId: `sec_${compraListId}_anuales`,
              cycle_id: 'cycle_year',
              updated_at: new Date().toISOString(),
              _is_dirty: true
            });
          }
        }
      });

      // Migrar tareas de cuidado personal / facial que quedaron erróneamente en Quehaceres a la lista Care
      const careKeywords = [
        'aseo básico', 'aseo basico',
        'tónico facial', 'tonico facial',
        'serum', 'sérum',
        'contorno de ojos',
        'crema hidratante', 'crema facial',
        'protector solar',
        'banda facial',
        'lavar rostro', 'limpieza facial', 'doble limpieza',
        'cuidado labial', 'bálsamo labial', 'balsamo labial',
        'crema de noche', 'mascarilla nocturna',
        'piedra de alumbre', 'desodorante',
        'cepillado en seco',
        'exfoliar el rostro', 'exfoliar el cuerpo',
        'mascarilla facial', 'mascarilla capilar',
        'arreglar uñas', 'cortar y arreglar uñas',
        'piedra pómez', 'piedra pomez',
        'baño de pies',
        'crema en los pies', 'crema en las manos',
        'ejercicios faciales', 'gimnasia facial', 'pómulo', 'pomulo', 'poner morritos',
        'skin-care', 'skincare'
      ];

      allTasksList.forEach(t => {
        const title = (t.title || '').toLowerCase();
        const desc = (t.description || '').toLowerCase();
        const url = (t.url || '').toLowerCase();
        const isQuehaceres = t.categoryId === 'quehaceres' || (quehaceresList && t.categoryId === quehaceresList.id);
        const isCareUrl = url.includes('care') || url.includes('skincare');
        const isCareContent = careKeywords.some(kw => title.includes(kw) || desc.includes(kw));

        if (isQuehaceres && (isCareUrl || isCareContent)) {
          const targetSection = t.cycle_id === 'cycle_week' ? `sec_${careListId}_semanales` :
                                t.cycle_id === 'cycle_month' ? `sec_${careListId}_mensuales` :
                                t.cycle_id === 'cycle_year' ? `sec_${careListId}_anuales` :
                                `sec_${careListId}_diarias`;
          state.updateTaskRaw({
            ...t,
            categoryId: careListId,
            sectionId: targetSection,
            cycle_id: t.cycle_id || (targetSection === `sec_${careListId}_diarias` ? 'cycle_day' : targetSection === `sec_${careListId}_semanales` ? 'cycle_week' : targetSection === `sec_${careListId}_mensuales` ? 'cycle_month' : 'cycle_year'),
            updated_at: new Date().toISOString(),
            _is_dirty: true
          });
        } else if (t.categoryId === careListId && !t.sectionId) {
          const sec = t.cycle_id === 'cycle_week' ? `sec_${careListId}_semanales` :
                      t.cycle_id === 'cycle_month' ? `sec_${careListId}_mensuales` :
                      t.cycle_id === 'cycle_year' ? `sec_${careListId}_anuales` :
                      `sec_${careListId}_diarias`;
          state.updateTaskRaw({
            ...t,
            sectionId: sec,
            cycle_id: t.cycle_id || (sec === `sec_${careListId}_diarias` ? 'cycle_day' : sec === `sec_${careListId}_semanales` ? 'cycle_week' : sec === `sec_${careListId}_mensuales` ? 'cycle_month' : 'cycle_year'),
            updated_at: new Date().toISOString(),
            _is_dirty: true
          });
        }
      });

      // Asegurar que las subtareas de cualquier tarea que se mueva a Care también se muevan a Care
      const careTaskIds = new Set(
        allTasksList
          .filter(t => t.categoryId === careListId)
          .map(t => t.id)
      );

      allTasksList.forEach(t => {
        if (t.parentId && careTaskIds.has(t.parentId) && t.categoryId !== careListId) {
          state.updateTaskRaw({
            ...t,
            categoryId: careListId,
            updated_at: new Date().toISOString(),
            _is_dirty: true
          });
        }
      });

      // Normalización y migración automática de precios en tareas existentes (ej. "Ropa interior 100 e", "Zapatillas 200 e", notas "50 e")
      allTasksList.forEach(t => {
        const { task: normalized, modified } = normalizeTaskPrices(t);
        if (modified) {
          state.updateTaskRaw(normalized);
        }
      });

      // Asegurar que cualquier tarea con prefijo explícito [D], [S], [M], [A] tenga su cycle_id
      // y sección correcta en listas de rutina (Care, Limpieza, Quehaceres), y eliminar el prefijo del título
      allTasksList.forEach(t => {
        const title = (t.title || '').trim();
        const p = getTaskPeriodicity(t, state.listSections, state.lists);
        const prefixP = getPeriodicityFromPrefix(title);
        const hasPrefix = Boolean(prefixP);

        const effectiveP = prefixP || p;
        if (!effectiveP && !hasPrefix) return;

        const expectedCycleId = effectiveP === 'day' ? 'cycle_day' :
                                effectiveP === 'week' ? 'cycle_week' :
                                effectiveP === 'month' ? 'cycle_month' :
                                effectiveP === 'year' ? 'cycle_year' : undefined;

        let needsUpdate = false;
        let newTitle = t.title;
        let newCycleId = t.cycle_id;
        let newSectionId = t.sectionId;

        // Si tiene prefijo en el título, limpiarlo para dejar el título natural
        if (hasPrefix) {
          const stripped = stripPeriodicityPrefix(t.title);
          if (stripped && stripped !== t.title) {
            newTitle = stripped;
            needsUpdate = true;
          }
          if (expectedCycleId && t.cycle_id !== expectedCycleId) {
            newCycleId = expectedCycleId;
            needsUpdate = true;
          }
        }

        // Si pertenece a una lista de rutinas periódicas (Care, Limpieza, Quehaceres)
        const isRoutineList = t.categoryId === careListId ||
                              t.categoryId === 'limpieza' ||
                              t.categoryId === 'quehaceres' ||
                              (quehaceresList && t.categoryId === quehaceresList.id);

        if (isRoutineList && effectiveP) {
          const currentSecPeriodicity = t.sectionId
            ? getSectionPeriodicity(t.sectionId, undefined, state.listSections, state.lists)
            : null;

          // Si no tiene sección o está en una sección de periodicidad distinta (ej. tarea diaria en sección Semanal)
          if (!t.sectionId || (hasPrefix && currentSecPeriodicity && currentSecPeriodicity !== effectiveP)) {
            const listSectionsForThisList = (state.listSections || []).filter(s => s.listId === t.categoryId);
            const targetSec = listSectionsForThisList.find(s => {
              const secP = getSectionPeriodicity(s.id, s.name, state.listSections, state.lists);
              return secP === effectiveP;
            });

            if (targetSec && targetSec.id !== t.sectionId) {
              newSectionId = targetSec.id;
              newCycleId = expectedCycleId;
              needsUpdate = true;
            }
          }
        }

        if (needsUpdate) {
          state.updateTaskRaw({
            ...t,
            title: newTitle,
            cycle_id: newCycleId,
            sectionId: newSectionId,
            updated_at: new Date().toISOString(),
            _is_dirty: true
          });
        }
      });

      // Eliminar sublistas obsoletas ahora que sus tareas están en Limpieza
      const obsoleteSublistIds = ['limpieza_diaria', 'limpieza_semanal', 'limpieza_mensual', 'limpieza_anual'];
      obsoleteSublistIds.forEach(id => {
        if (lists.some(l => l.id === id)) {
          state.removeList(id);
        }
      });
    }

    // Inicializar tareas de Primeros Pasos si no se ha ocultado la guía
    if (!isHidden) {
      const existingTasks = Object.values(state.tasks);
      
      // Limpiar tareas de primeros pasos existentes que tuvieran cycle_day accidentalmente asignado
      existingTasks.forEach(t => {
        if (t.categoryId === 'primeros_pasos' && t.cycle_id) {
          const updated = { ...t };
          delete updated.cycle_id;
          state.updateTaskRaw(updated);
        }
      });

      const hasOnboardingTasks = existingTasks.some(t => t.categoryId === 'primeros_pasos');
      if (!hasOnboardingTasks) {
        const defaultTasks: Partial<TaskItem>[] = [
          {
            id: 'task_onboarding_1',
            categoryId: 'primeros_pasos',
            title: 'Escribe tu primer recordatorio',
            description: 'Prueba abajo con «Reunión mañana a las 10:00 !alta @Trabajo»: la fecha, la hora y la lista se rellenan solas.',
            priority: 'high',
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: EPOCH,
          },
          {
            id: 'task_onboarding_2',
            categoryId: 'primeros_pasos',
            title: 'Encuentra cualquier cosa al instante',
            description: 'Pulsa Ctrl+K (⌘K en Mac) para buscar entre tus recordatorios, listas y ciclos.',
            priority: 'medium',
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: EPOCH,
          },
          {
            id: 'task_onboarding_3',
            categoryId: 'primeros_pasos',
            title: 'Concéntrate con el Modo Zen',
            description: 'Abre las opciones de un recordatorio (clic derecho o pulsación larga) y elige «Modo Enfoque Zen».',
            priority: 'low',
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: EPOCH,
          },
          {
            id: 'task_onboarding_4',
            categoryId: 'primeros_pasos',
            title: 'Ordena con listas y prioridades',
            description: 'Crea listas desde la barra lateral y marca lo importante escribiendo !alta, !media o !baja.',
            priority: 'medium',
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: EPOCH,
          },
          {
            id: 'task_onboarding_5',
            categoryId: 'primeros_pasos',
            title: 'Llévalos a todos tus dispositivos',
            description: 'Todo se guarda en este dispositivo. Al crear una cuenta, se sincroniza solo con tu móvil y tu ordenador.',
            priority: 'none',
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: EPOCH,
          },
        ];
        defaultTasks.forEach((t) => state.addTask(t));
      }
    }

    state.cleanupDataHygiene();
  }, [hasHydrated]);

  // ── Sync Manager lifecycle and listeners ──────────────────────────
  useEffect(() => {
    if (token) {
      syncManager.start();
      syncSharedStatus();
      
      const handleFocusOrVisible = () => {
        if (document.visibilityState === 'visible') {
          syncManager.syncNow();
          syncSharedStatus();
        }
      };
      
      window.addEventListener('focus', handleFocusOrVisible);
      document.addEventListener('visibilitychange', handleFocusOrVisible);
      
      return () => {
        window.removeEventListener('focus', handleFocusOrVisible);
        document.removeEventListener('visibilitychange', handleFocusOrVisible);
        syncManager.stop();
      };
    }
  }, [token]);

  // ── Helpers ──────────────────────────────────────────────────────
  const previousMobileView = useRef<'sidebar' | 'content'>('sidebar');

  const handleSelectView = (view: string) => {
    previousMobileView.current = mobileView;
    if (view === 'DATA' || view === 'BRAIN_DUMP') {
      navReset('UNIVERSAL_IMPORTER');
      if (isMobile) setMobileView('content');
    } else if (view === 'ANALYTICS') {
      navReset('ANALYTICS');
      if (isMobile) setMobileView('content');
    } else if (view === 'TRASH') {
      setCurrentView(view);
      navReset('HOME');
      if (isMobile) setMobileView('content');
    } else {
      setCurrentView(view);
      navReset('HOME');
      if (isMobile) setMobileView('content');
    }
  };

  const handleBack = () => {
    if (navView !== 'HOME') {
      navReset('HOME');
      if (isMobile) setMobileView(previousMobileView.current || 'sidebar');
    } else if (navStack.length > 1) {
      navPop();
      if (isMobile) setMobileView(previousMobileView.current || 'sidebar');
    } else if (isMobile) {
      setMobileView('sidebar');
    }
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Escape closes open modals, drawer, shortcuts and menus
      if (e.key === 'Escape') {
        setIsShortcutsOpen(false);
        setIsDrawerOpen(false);
        window.dispatchEvent(new Event('close-list-menus'));
        return;
      }

      // Cmd+N or Ctrl+N opens new task drawer from anywhere
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setEditingTaskId(null);
        setDefaultSectionId(undefined);
        setIsDrawerOpen(true);
        return;
      }

      // Cmd+K or Ctrl+K opens Spotlight
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        window.dispatchEvent(new Event('open-command-palette'));
        return;
      }

      const active = document.activeElement;
      const isInputActive = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.getAttribute('contenteditable') === 'true');
      if (isInputActive) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setIsShortcutsOpen(prev => !prev);
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        window.dispatchEvent(new Event('open-command-palette'));
        return;
      }
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setEditingTaskId(null);
        setDefaultSectionId(undefined);
        setIsDrawerOpen(true);
        return;
      }
      if (e.key === '1') { e.preventDefault(); handleSelectView('cycle_day'); }
      else if (e.key === '2') { e.preventDefault(); handleSelectView('cycle_week'); }
      else if (e.key === '3') { e.preventDefault(); handleSelectView('all'); }
      else if (e.key === '4') { e.preventDefault(); handleSelectView('inbox'); }
      else if (e.key === '5') { e.preventDefault(); handleSelectView('ANALYTICS'); }
      else if (e.key === '6') { e.preventDefault(); handleSelectView('DATA'); }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Atajo del icono de la PWA: /?action=new abre directamente un recordatorio nuevo.
  useEffect(() => {
    if (!token || !hasHydrated) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'new') {
      clearUrlParam('action');
      setEditingTaskId(null);
      setDefaultSectionId(undefined);
      setIsDrawerOpen(true);
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [token, hasHydrated]);

  useEffect(() => {
    const handleOpenShortcuts = () => setIsShortcutsOpen(true);
    const handleOpenNewTask = () => {
      setEditingTaskId(null);
      setDefaultSectionId(undefined);
      setIsDrawerOpen(true);
    };
    const handleSelectViewCustom = (e: any) => {
      if (e.detail) handleSelectView(e.detail);
    };
    window.addEventListener('open-shortcuts-modal', handleOpenShortcuts);
    window.addEventListener('open-new-task-drawer', handleOpenNewTask);
    window.addEventListener('select-view', handleSelectViewCustom);
    return () => {
      window.removeEventListener('open-shortcuts-modal', handleOpenShortcuts);
      window.removeEventListener('open-new-task-drawer', handleOpenNewTask);
      window.removeEventListener('select-view', handleSelectViewCustom);
    };
  }, []);

  // ── Conditional returns (AFTER all hooks) ────────────────────────
  if (!hasHydrated) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        background: 'var(--bg-base)',
      }}>
        <TaskSkeletonLoader />
      </div>
    );
  }

  if (shareToken) {
    return <SharedListView token={shareToken} onExit={() => { clearUrlParam('share'); setShareToken(null); }} />;
  }

  if (resetToken) {
    return (
      <AuthScreen
        resetToken={resetToken}
        onSuccess={() => {}}
        onResetFinished={() => { clearUrlParam('reset'); setResetToken(null); }}
      />
    );
  }

  if (!token) {
    return <AuthScreen onSuccess={() => {}} />;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const isWidgetMode = urlParams.get('widget') === 'true';

  if (isWidgetMode) {
    return (
      <div style={{ background: 'transparent', height: '100vh', width: '100%' }}>
        <WidgetDashboard />
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────────
  return (
    <div className={`app-container ${isMobile ? `mobile-${mobileView}` : ''}`}>
      <div className="sidebar-container">
        <Sidebar currentView={currentView} onSelectView={handleSelectView} />
      </div>

      <div className="main-container">
        <NavigationFrame
          isMobile={isMobile}
          canGoBack={navView !== 'HOME' || (isMobile && mobileView === 'content')}
          onBack={handleBack}
          viewKey={navView}
          backLabel={navStack.length > 1 ? 'Volver' : 'Listas'}
        >
          {navView === 'HOME' && (
            <MainContent
              currentView={currentView}
              onOpenNewTask={(sectionId) => { setEditingTaskId(null); setDrawerInitialFocus(undefined); setDefaultSectionId(sectionId); setIsDrawerOpen(true); }}
              onOpenZenMode={(taskId) => setZenModeTaskId(taskId)}
              onEditTask={(taskId, initialFocus) => { setEditingTaskId(taskId); setDrawerInitialFocus(initialFocus); setIsDrawerOpen(true); }}
              onBackToSidebar={() => setMobileView('sidebar')}
              onSelectView={handleSelectView}
              isMobile={isMobile}
              onStartSequence={(taskIds, listName, listColor) => {
                setSequenceMode({ taskIds, listName, listColor });
              }}
            />
          )}
          {navView === 'UNIVERSAL_IMPORTER' && <UniversalImporter onBack={handleBack} />}
          {navView === 'ANALYTICS' && <AnalyticsView onBack={handleBack} />}
        </NavigationFrame>
      </div>

      <TaskDrawer
        isOpen={isDrawerOpen}
        onClose={() => { setIsDrawerOpen(false); setEditingTaskId(null); setDefaultSectionId(undefined); setDrawerInitialFocus(undefined); }}
        defaultCategoryId={
          currentView.startsWith('list_') ? currentView.replace('list_', '') : undefined
        }
        defaultSectionId={defaultSectionId}
        taskId={editingTaskId || undefined}
        initialFocus={drawerInitialFocus}
      />

      <AIAssistantModal
        isOpen={isAIAssistantOpen}
        onClose={() => { setIsAIAssistantOpen(false); setAiInitialPrompt(''); }}
        initialPrompt={aiInitialPrompt}
        onSelectView={(view) => handleSelectView(view)}
      />

      <PromptModal />

      {zenModeTaskId && (
        <ZenMode taskId={zenModeTaskId} onClose={() => setZenModeTaskId(null)} />
      )}

      {sequenceMode && (
        <ListSequenceMode
          taskIds={sequenceMode.taskIds}
          listName={sequenceMode.listName}
          listColor={sequenceMode.listColor}
          onClose={() => setSequenceMode(null)}
        />
      )}

      <SpotlightModal
        onSelectView={(view) => handleSelectView(view)}
        onOpenZenMode={(taskId) => setZenModeTaskId(taskId)}
        onEditTask={(taskId) => { setEditingTaskId(taskId); setIsDrawerOpen(true); }}
      />
      <InstallPromptModal />
      <DailyGreetingModal
        onSelectView={handleSelectView}
        onOpenTask={(taskId) => { handleSelectView('smart_today'); setEditingTaskId(taskId); setIsDrawerOpen(true); }}
      />
      <ShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
      <ConfirmHost />

      {globalToast && createPortal(
        <AnimatePresence>
          <motion.div
            className="premium-toast"
            role="status"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 12, 
              justifyContent: 'space-between', 
              minWidth: 280, 
              maxWidth: '90vw', 
              boxSizing: 'border-box',
              zIndex: 999999 
            }}
            initial={{ opacity: 0, y: 16, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 16, x: "-50%" }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            drag="x"
            dragConstraints={{ left: -100, right: 100 }}
            onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 50) setGlobalToast(null); }}
          >
            <span style={{ fontSize: '0.86rem', fontWeight: 550 }}>
              {typeof globalToast === 'string' ? globalToast : globalToast.message}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {typeof globalToast !== 'string' && globalToast.onUndo && (
                <button
                  type="button"
                  onClick={() => {
                    globalToast.onUndo?.();
                    setGlobalToast(null);
                  }}
                  style={{
                    background: 'var(--accent-primary, #007aff)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '4px 10px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0, 122, 255, 0.3)'
                  }}
                >
                  Deshacer
                </button>
              )}
              <button
                onClick={() => setGlobalToast(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', padding: 4 }}
                title="Cerrar"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

export default App;
