import { useState, useEffect } from 'react';
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
import { syncManager } from './sync/syncManager';
import { TaskSkeletonLoader } from './components/ui/TaskSkeletonLoader';

function App() {
  // ── All hooks FIRST (before any conditional returns) ──────────────
  const token = useAppStore((state) => state.token);
  const tasks = useAppStore((state) => state.tasks); // Subscribing to tasks
  const [currentView, setCurrentView] = useState('cycle_day');
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
    const lists = useAppStore.getState().lists;
    if (!lists || lists.length === 0) {
      const initial = [
        { id: 'compras', name: 'Compras', color: '#ff9500' },
        { id: 'care', name: 'Care', color: '#af52de' },
        { id: 'quehaceres', name: 'Quehaceres', color: '#34c759' },
        { id: 'limpieza', name: 'Limpieza', color: '#0a84ff' },
      ];
      initial.forEach((l) => useAppStore.getState().addList(l));
    }
    useAppStore.getState().cleanupDataHygiene();
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
  }, []);

  useEffect(() => {
    const handleOpenShortcuts = () => setIsShortcutsOpen(true);
    window.addEventListener('open-shortcuts-modal', handleOpenShortcuts);
    return () => window.removeEventListener('open-shortcuts-modal', handleOpenShortcuts);
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
    </div>
  );
}

export default App;
