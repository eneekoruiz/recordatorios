import { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { MainContent } from './components/layout/MainContent';
import { WidgetDashboard } from './components/layout/WidgetDashboard';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { TaskDrawer } from './components/tasks/TaskDrawer';
import { PromptModal } from './components/layout/PromptModal';
import { UniversalImporter } from './components/views/UniversalImporter';
import { syncManager } from './sync/syncManager';
import { CommandPalette } from './components/layout/CommandPalette';
import { ZenMode } from './components/tasks/ZenMode';
import { GeolocationService } from './services/GeolocationService';
import { useAppStore } from './store/useAppStore';
import { useNavigation } from './hooks/useNavigation';
import { NavigationFrame } from './components/layout/NavigationFrame';

function App() {
  const { push, currentView: getNavView } = useNavigation();
  const [currentView, setCurrentView] = useState('cycle_day'); // Sidebar selection
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [mobileView, setMobileView] = useState<'sidebar' | 'content'>('sidebar');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [zenModeTaskId, setZenModeTaskId] = useState<string | null>(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    
    // 1. Inicializar Sincronización en la Nube
    // syncManager initialized

    // 2. Inicializar Geofencing
    GeolocationService.getInstance().startGeofencing(() => {
      const { tasks } = useAppStore.getState();
      return Object.values(tasks).filter(t => t.location && !t.deleted_at && t.status === 'pending');
    });
    
    return () => {
      window.removeEventListener('resize', handleResize);
      // cleanup
    };
  }, []);

  const handleSelectView = (view: string) => {
    if (view === 'DATA' || view === 'BRAIN_DUMP') {
      useNavigation.getState().reset('UNIVERSAL_IMPORTER');
    } else if (view === 'ANALYTICS') {
      useNavigation.getState().reset('ANALYTICS');
    } else {
      setCurrentView(view);
      useNavigation.getState().reset('HOME');
      if (isMobile) setMobileView('content');
    }
  };

  // Check custom lists initialization
  useEffect(() => {
    const lists = useAppStore.getState().lists;
    if (!lists || lists.length === 0) {
      const initial = [
        { id: 'compras', name: 'Compras', color: '#ff9500' },
        { id: 'care', name: 'Care', color: '#af52de' },
        { id: 'quehaceres', name: 'Quehaceres', color: '#34c759' },
        { id: 'limpieza', name: 'Limpieza', color: '#0a84ff' }
      ];
      initial.forEach(l => useAppStore.getState().addList(l));
    }
  }, []);

  const urlParams = new URLSearchParams(window.location.search);
  const isWidgetMode = urlParams.get('widget') === 'true';

  useEffect(() => {
    const geoService = GeolocationService.getInstance();
    
    // Función getter en crudo para escapar del closure de React
    const getGeoTasks = () => {
      const state = useAppStore.getState();
      return Object.values(state.tasks).filter(t => t.status === 'pending' && !t.deleted_at && t.location);
    };

    geoService.startGeofencing(getGeoTasks);
    
    return () => {
      geoService.stopGeofencing();
    };
  }, []);

  if (isWidgetMode) {
    return (
      <div style={{ background: 'transparent', height: '100vh', width: '100vw' }}>
        <WidgetDashboard />
      </div>
    );
  }

  return (
    <div className={`app-container ${isMobile ? `mobile-${mobileView}` : ''}`}>
      <div className="sidebar-container">
        <Sidebar 
          currentView={currentView} 
          onSelectView={handleSelectView} 
        />
      </div>
      
      <NavigationFrame>
        {useNavigation.getState().currentView() === 'HOME' && (
          <div className="main-container">
            <MainContent 
              currentView={currentView}
              onOpenNewTask={() => setIsDrawerOpen(true)}
              onOpenZenMode={(taskId) => setZenModeTaskId(taskId)}
              onBackToSidebar={() => setMobileView('sidebar')}
              isMobile={isMobile}
            />
          </div>
        )}
        {useNavigation.getState().currentView() === 'UNIVERSAL_IMPORTER' && (
          <UniversalImporter />
        )}
        {useNavigation.getState().currentView() === 'ANALYTICS' && (
          <AnalyticsView />
        )}
      </NavigationFrame>
      <TaskDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        defaultCategoryId={currentView.startsWith('list_') ? currentView.replace('list_', '') : undefined}
      />
      {/* Removidos los viejos Modals (Cycle, Data, BrainDump) */}
      <PromptModal />
      {zenModeTaskId && (
        <ZenMode 
          taskId={zenModeTaskId}
          onClose={() => setZenModeTaskId(null)}
        />
      )}
      <CommandPalette 
        onSelectView={(view) => {
          if (view === 'DATA' || view === 'BRAIN_DUMP') push('UNIVERSAL_IMPORTER');
          else if (view === 'ANALYTICS') push('ANALYTICS');
          else setCurrentView(view);
        }}
        onOpenZenMode={(taskId) => setZenModeTaskId(taskId)}
      />
    </div>
  );
}

export default App;
