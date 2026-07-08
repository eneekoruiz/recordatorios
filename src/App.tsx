import { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { MainContent } from './components/layout/MainContent';
import { WidgetDashboard } from './components/layout/WidgetDashboard';
import { AnalyticsView } from './components/analytics/AnalyticsView';
import { TaskDrawer } from './components/tasks/TaskDrawer';
import { CycleModal } from './components/layout/CycleModal';
import { DataModal } from './components/layout/DataModal';
import { BrainDumpModal } from './components/layout/BrainDumpModal';
import { PromptModal } from './components/layout/PromptModal';
import { SyncProvider } from './sync/SyncProvider';
import { CommandPalette } from './components/layout/CommandPalette';
import { ZenMode } from './components/tasks/ZenMode';
import { GeolocationService } from './services/GeolocationService';
import { useAppStore } from './store/useAppStore';

function App() {
  const [currentView, setCurrentView] = useState('cycle_day'); // 'cycle_day', 'cycle_week', 'ANALYTICS', etc.
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [mobileView, setMobileView] = useState<'sidebar' | 'content'>('sidebar');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  const [isBrainDumpOpen, setIsBrainDumpOpen] = useState(false);
  const [zenModeTaskId, setZenModeTaskId] = useState<string | null>(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    
    // 1. Inicializar Sincronización en la Nube
    SyncProvider.initialize();

    // 2. Inicializar Geofencing
    GeolocationService.getInstance().startGeofencing(() => {
      const { tasks } = useAppStore.getState();
      return Object.values(tasks).filter(t => t.location && !t.is_deleted && t.status === 'PENDING');
    });
    
    return () => {
      window.removeEventListener('resize', handleResize);
      SyncProvider.destroy();
    };
  }, []);

  const handleSelectView = (view: string) => {
    if (view === 'MANAGE_CYCLES') setIsCycleModalOpen(true);
    else if (view === 'DATA') setIsDataModalOpen(true);
    else if (view === 'BRAIN_DUMP') setIsBrainDumpOpen(true);
    else {
      setCurrentView(view);
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
      return Object.values(state.tasks).filter(t => t.status === 'PENDING' && !t.is_deleted && t.location);
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
      
      <div className="main-container">
        {currentView === 'ANALYTICS' ? (
          <AnalyticsView />
        ) : (
          <MainContent 
            currentView={currentView}
            onOpenNewTask={() => setIsDrawerOpen(true)}
            onOpenZenMode={(taskId) => setZenModeTaskId(taskId)}
            onBackToSidebar={() => setMobileView('sidebar')}
            isMobile={isMobile}
          />
        )}
      </div>
      <TaskDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        defaultCategoryId={currentView.startsWith('list_') ? currentView.replace('list_', '') : undefined}
      />
      <CycleModal 
        isOpen={isCycleModalOpen}
        onClose={() => setIsCycleModalOpen(false)}
      />
      <DataModal 
        isOpen={isDataModalOpen}
        onClose={() => setIsDataModalOpen(false)}
      />
      <BrainDumpModal 
        isOpen={isBrainDumpOpen}
        onClose={() => setIsBrainDumpOpen(false)}
      />
      <PromptModal />
      {zenModeTaskId && (
        <ZenMode 
          taskId={zenModeTaskId}
          onClose={() => setZenModeTaskId(null)}
        />
      )}
      <CommandPalette 
        onSelectView={(view) => {
          if (view === 'MANAGE_CYCLES') setIsCycleModalOpen(true);
          else if (view === 'DATA') setIsDataModalOpen(true);
          else if (view === 'BRAIN_DUMP') setIsBrainDumpOpen(true);

          else setCurrentView(view);
        }}
        onOpenZenMode={(taskId) => setZenModeTaskId(taskId)}
      />
    </div>
  );
}

export default App;
