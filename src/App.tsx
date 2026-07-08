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
import { CommandPalette } from './components/layout/CommandPalette';
import { ZenMode } from './components/tasks/ZenMode';
import { GeolocationService } from './services/GeolocationService';
import { useAppStore } from './store/useAppStore';

function App() {
  const [currentView, setCurrentView] = useState('cycle_day'); // 'cycle_day', 'cycle_week', 'ANALYTICS', etc.
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  const [isBrainDumpOpen, setIsBrainDumpOpen] = useState(false);
  const [zenModeTaskId, setZenModeTaskId] = useState<string | null>(null);

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
    <div className="app-container">
      <Sidebar 
        currentView={currentView} 
        onSelectView={(view) => {
          if (view === 'MANAGE_CYCLES') setIsCycleModalOpen(true);
          else if (view === 'DATA') setIsDataModalOpen(true);
          else if (view === 'BRAIN_DUMP') setIsBrainDumpOpen(true);
          else setCurrentView(view);
        }} 
      />
      
      {currentView === 'ANALYTICS' ? (
        <AnalyticsView />
      ) : (
        <MainContent 
          currentView={currentView}
          onOpenNewTask={() => setIsDrawerOpen(true)}
          onOpenZenMode={(taskId) => setZenModeTaskId(taskId)}
        />
      )}
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
