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

function App() {
  // ── All hooks FIRST (before any conditional returns) ──────────────
  const token = useAppStore((state) => state.token);
  const tasks = useAppStore((state) => state.tasks); // Subscribing to tasks
  const [currentView, setCurrentView] = useState('cycle_day');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [mobileView, setMobileView] = useState<'sidebar' | 'content'>('sidebar');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [zenModeTaskId, setZenModeTaskId] = useState<string | null>(null);
  const hasHydrated = useAppStore((state) => state.hasHydrated);

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

  // ── Default lists initialization ─────────────────────────────────
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
  }, []);

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
    if (navStack.length > 1) {
      navPop();
      if (isMobile) setMobileView('sidebar');
    } else if (isMobile) {
      setMobileView('sidebar');
    }
  };

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
        color: 'var(--text-primary)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div style={{
          width: 40,
          height: 40,
          border: '3px solid var(--border-subtle)',
          borderTop: '3px solid var(--accent-primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: 16
        }} />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <p style={{ fontSize: '1rem', fontWeight: 500, margin: 0 }}>Tranquilo, ya casi estamos...</p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: 8 }}>Cargando tus recordatorios...</p>
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
      <div style={{ background: 'transparent', height: '100vh', width: '100vw' }}>
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
          canGoBack={navStack.length > 1 || (isMobile && mobileView === 'content')}
          onBack={handleBack}
          viewKey={navView}
          backLabel={navStack.length > 1 ? 'Volver' : 'Listas'}
        >
          {navView === 'HOME' && (
            <MainContent
              currentView={currentView}
              onOpenNewTask={() => { setEditingTaskId(null); setIsDrawerOpen(true); }}
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
        onClose={() => { setIsDrawerOpen(false); setEditingTaskId(null); }}
        defaultCategoryId={
          currentView.startsWith('list_') ? currentView.replace('list_', '') : undefined
        }
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
    </div>
  );
}

export default App;
