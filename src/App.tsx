import { useState, useEffect } from 'react';
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
import { CommandPalette } from './components/layout/CommandPalette';
import { ZenMode } from './components/tasks/ZenMode';
import { GeolocationService } from './services/GeolocationService';
import { useAppStore } from './store/useAppStore';
import { useNavigation } from './hooks/useNavigation';
import { NavigationFrame } from './components/layout/NavigationFrame';
import { AuthScreen } from './components/auth/AuthScreen';
import { InstallPromptModal } from './components/layout/InstallPromptModal';
import { ShortcutsModal } from './components/layout/ShortcutsModal';
import { BottomShortcutBar } from './components/layout/BottomShortcutBar';
import { syncManager } from './sync/syncManager';
import { TaskSkeletonLoader } from './components/ui/TaskSkeletonLoader';

function App() {
  // ── All hooks FIRST (before any conditional returns) ──────────────
  const token = useAppStore((state) => state.token);
  const tasks = useAppStore((state) => state.tasks); // Subscribing to tasks
  const [currentView, setCurrentView] = useState('smart_primeros_pasos');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [mobileView, setMobileView] = useState<'sidebar' | 'content'>('sidebar');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [defaultSectionId, setDefaultSectionId] = useState<string | undefined>(undefined);
  const [zenModeTaskId, setZenModeTaskId] = useState<string | null>(null);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const hasHydrated = useAppStore((state) => state.hasHydrated);

  // IndexedDB can be unavailable in privacy/restricted contexts. Never strand the
  // user behind an infinite loader: continue with the safe in-memory defaults.
  useEffect(() => {
    if (hasHydrated) return;
    const hydrationGuard = window.setTimeout(() => {
      useAppStore.getState().setHasHydrated(true);
    }, 600); // 600ms max — avoid getting stuck on the loader
    return () => window.clearTimeout(hydrationGuard);
  }, [hasHydrated]);

  const navStack = useNavigation((state) => state.stack);
  const navView = useNavigation((state) => state.currentView());
  const { push: navPush, pop: navPop, reset: navReset } = useNavigation();
  const [globalToast, setGlobalToast] = useState<string | null>(null);

  useEffect(() => {
    const handleToast = (e: any) => {
      setGlobalToast(e.detail);
      window.setTimeout(() => setGlobalToast(null), 3500);
    };
    window.addEventListener('show-toast', handleToast);
    return () => window.removeEventListener('show-toast', handleToast);
  }, []);

  // ── Resize listener ──────────────────────────────────────────────
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
  useEffect(() => {
    const state = useAppStore.getState();
    const lists = state.lists;
    const isHidden = localStorage.getItem('hide_onboarding_guide') === 'true';

    if (!lists || lists.length === 0) {
      const initial = [
        { id: 'primeros_pasos', name: 'Primeros Pasos', color: '#ff2d55', icon: 'rocket', isPinned: true },
        { id: 'compras', name: 'Compras', color: '#ff9500', icon: 'shopping-cart' },
        { id: 'care', name: 'Care', color: '#af52de', icon: 'heart' },
        { id: 'quehaceres', name: 'Quehaceres', color: '#34c759', icon: 'check-square' },
        { id: 'limpieza', name: 'Limpieza', color: '#0a84ff', icon: 'folder', isFolder: true },
        { id: 'limpieza_diaria', name: 'Diaria', color: '#0a84ff', icon: 'list', parentId: 'limpieza' },
        { id: 'limpieza_semanal', name: 'Semanal', color: '#0a84ff', icon: 'list', parentId: 'limpieza' },
        { id: 'limpieza_mensual', name: 'Mensual', color: '#0a84ff', icon: 'list', parentId: 'limpieza' },
        { id: 'limpieza_anual', name: 'Anual', color: '#0a84ff', icon: 'list', parentId: 'limpieza' },
      ];
      initial.forEach((l) => state.addList(l));
    } else {
      if (!lists.some(l => l.id === 'primeros_pasos') && !isHidden) {
        state.addList({ id: 'primeros_pasos', name: 'Primeros Pasos', color: '#ff2d55', icon: 'rocket', isPinned: true });
      }
      // Asegurar que la estructura de Limpieza coincida con las sublistas
      const limpiezaList = lists.find(l => l.id === 'limpieza');
      if (limpiezaList && !limpiezaList.isFolder) {
        state.updateList('limpieza', { isFolder: true });
      }
      const sublists = [
        { id: 'limpieza_diaria', name: 'Diaria' },
        { id: 'limpieza_semanal', name: 'Semanal' },
        { id: 'limpieza_mensual', name: 'Mensual' },
        { id: 'limpieza_anual', name: 'Anual' },
      ];
      sublists.forEach(sub => {
        if (!lists.some(l => l.id === sub.id || (l.name === sub.name && l.parentId === 'limpieza'))) {
          state.addList({ id: sub.id, name: sub.name, color: '#0a84ff', icon: 'list', parentId: 'limpieza' });
        }
      });
    }

    // Hydrate user preferences from settings list objects
    const cycleSettings = lists.find(l => l.id === 'user_preferences_cycle_visibility');
    if (cycleSettings?.icon) {
      try {
        const parsed = JSON.parse(cycleSettings.icon);
        useAppStore.setState(prev => ({ cycleVisibility: { ...prev.cycleVisibility, ...parsed } }));
      } catch (e) {}
    }
    const smartSettings = lists.find(l => l.id === 'user_preferences_smart_lists');
    if (smartSettings?.icon) {
      try {
        const parsed = JSON.parse(smartSettings.icon);
        useAppStore.setState(prev => ({ smartListVisibility: { ...prev.smartListVisibility, ...parsed } }));
      } catch (e) {}
    }
    const pinnedSettings = lists.find(l => l.id === 'user_preferences_pinned_smart_lists');
    if (pinnedSettings?.icon) {
      try {
        const parsed = JSON.parse(pinnedSettings.icon);
        useAppStore.setState({ pinnedSmartLists: parsed });
      } catch (e) {}
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
            title: 'Crear tu primer recordatorio en lenguaje natural',
            description: 'Escribe abajo: "Reunión mañana a las 10:00 !alta @Trabajo" y pulsa Enter.',
            priority: 'high',
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: 'task_onboarding_2',
            categoryId: 'primeros_pasos',
            title: 'Abrir la Paleta de Comandos (Ctrl + K)',
            description: 'Pulsa Ctrl+K o "/" en tu teclado para buscar cualquier tarea, ciclo o lista en milisegundos.',
            priority: 'medium',
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: 'task_onboarding_3',
            categoryId: 'primeros_pasos',
            title: 'Activar el Modo Enfoque Zen con Audio',
            description: 'Pasa el ratón sobre cualquier recordatorio o abre sus opciones (...) y elige "Modo Enfoque Zen".',
            priority: 'low',
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: 'task_onboarding_4',
            categoryId: 'primeros_pasos',
            title: 'Organizar con Prioridades y Listas',
            description: 'Asigna prioridades (!alta, !media, !baja) y agrupa tus pendientes en distintas listas temáticas.',
            priority: 'medium',
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: 'task_onboarding_5',
            categoryId: 'primeros_pasos',
            title: '☁️ Sincronizar en la Nube con PostgreSQL Neon',
            description: 'Tus tareas se guardan de forma local y se respaldan automáticamente al iniciar sesión.',
            priority: 'none',
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];
        defaultTasks.forEach((t) => state.addTask(t));
      }
    }

    state.cleanupDataHygiene();
  }, []);

  // ── Sync Manager lifecycle and listeners ──────────────────────────
  useEffect(() => {
    if (token) {
      syncManager.start();
      
      const handleFocusOrVisible = () => {
        if (document.visibilityState === 'visible') {
          syncManager.syncNow();
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
  const handleSelectView = (view: string) => {
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
      if (isMobile) setMobileView('sidebar');
    } else if (navStack.length > 1) {
      navPop();
      if (isMobile) setMobileView('sidebar');
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
              onOpenNewTask={(sectionId) => { setEditingTaskId(null); setDefaultSectionId(sectionId); setIsDrawerOpen(true); }}
              onOpenZenMode={(taskId) => setZenModeTaskId(taskId)}
              onEditTask={(taskId) => { setEditingTaskId(taskId); setIsDrawerOpen(true); }}
              onBackToSidebar={() => setMobileView('sidebar')}
              isMobile={isMobile}
            />
          )}
          {navView === 'UNIVERSAL_IMPORTER' && <UniversalImporter />}
          {navView === 'ANALYTICS' && <AnalyticsView />}
        </NavigationFrame>
      </div>

      <TaskDrawer
        isOpen={isDrawerOpen}
        onClose={() => { setIsDrawerOpen(false); setEditingTaskId(null); setDefaultSectionId(undefined); }}
        defaultCategoryId={
          currentView.startsWith('list_') ? currentView.replace('list_', '') : undefined
        }
        defaultSectionId={defaultSectionId}
        taskId={editingTaskId || undefined}
      />

      <PromptModal />

      {zenModeTaskId && (
        <ZenMode taskId={zenModeTaskId} onClose={() => setZenModeTaskId(null)} />
      )}

      <CommandPalette
        onSelectView={(view) => {
          if (view === 'DATA' || view === 'BRAIN_DUMP') {
            navPush('UNIVERSAL_IMPORTER');
            if (isMobile) setMobileView('content');
          } else if (view === 'ANALYTICS') {
            navPush('ANALYTICS');
            if (isMobile) setMobileView('content');
          } else {
            setCurrentView(view);
            navReset('HOME');
            if (isMobile) setMobileView('content');
          }
        }}
        onOpenZenMode={(taskId) => setZenModeTaskId(taskId)}
      />
      <InstallPromptModal />
      <ShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
      <BottomShortcutBar />

      {globalToast && createPortal(
        <AnimatePresence>
          <motion.div
            className="premium-toast"
            role="status"
            style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', minWidth: 260, boxSizing: 'border-box' }}
            initial={{ opacity: 0, y: 16, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 16, x: "-50%" }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            drag="x"
            dragConstraints={{ left: -100, right: 100 }}
            onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 50) setGlobalToast(null); }}
          >
            <span>{globalToast}</span>
            <button
              onClick={() => setGlobalToast(null)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', padding: 4 }}
              title="Cerrar"
            >
              <X size={16} />
            </button>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

export default App;
