import { useState, useEffect, useEffectEvent, useRef, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Sidebar } from './components/layout/Sidebar';
import { MainContent } from './components/layout/MainContent';
import { undoLastDeletion } from './utils/undoToast';
import { WidgetDashboard } from './components/layout/WidgetDashboard';

import { PromptModal } from './components/layout/PromptModal';

import { SpotlightModal } from './components/search/SpotlightModal';


import { useAppStore, isTaskCompleted } from './store/useAppStore';
import { useNavigation } from './hooks/useNavigation';
import { NavigationFrame } from './components/layout/NavigationFrame';
import { AuthScreen } from './components/auth/AuthScreen';
import { InstallPromptModal } from './components/layout/InstallPromptModal';
import { ShortcutsModal } from './components/layout/ShortcutsModal';
import { DailyGreetingModal } from './components/layout/DailyGreetingModal';
import { TaskSkeletonLoader } from './components/ui/TaskSkeletonLoader';

import { ConfirmHost } from './components/ui/ConfirmHost';

import { useSystemTheme } from './hooks/useSystemTheme';
import { useGeofencing } from './hooks/useGeofencing';
import { useSyncManager } from './hooks/useSyncManager';
import { useAppLayout } from './hooks/useAppLayout';

import { useDataHygiene } from './hooks/useDataHygiene';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';


import { lazyWithRetry } from './utils/lazyWithRetry';

// Piezas pesadas o de uso ocasional: se descargan bajo demanda con recuperación de chunks.
const UniversalImporter = lazyWithRetry(() => import('./components/views/UniversalImporter'), 'UniversalImporter');
const AnalyticsView = lazyWithRetry(() => import('./components/analytics/AnalyticsView'), 'AnalyticsView');
const ZenMode = lazyWithRetry(() => import('./components/tasks/ZenMode'), 'ZenMode');
const ListSequenceMode = lazyWithRetry(() => import('./components/tasks/ListSequenceMode'), 'ListSequenceMode');
const SecuritySheet = lazyWithRetry(() => import('./components/account/SecuritySheet'), 'SecuritySheet');
const TaskDrawer = lazyWithRetry(() => import('./components/tasks/TaskDrawer'), 'TaskDrawer');
const AIAssistantModal = lazyWithRetry(() => import('./components/ai/AIAssistantModal'), 'AIAssistantModal');
const SharedListView = lazyWithRetry(() => import('./components/share/SharedListView'), 'SharedListView');
const IntegrationsModal = lazyWithRetry(() => import('./components/integrations/IntegrationsModal'), 'IntegrationsModal');

function App() {
  useSystemTheme();
  // ── All hooks FIRST (before any conditional returns) ──────────────
  const token = useAppStore((state) => state.token);
  const tasks = useAppStore((state) => state.tasks); // Subscribing to tasks
  const lists = useAppStore((state) => state.lists);
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
  const [drawerInitialTitle, setDrawerInitialTitle] = useState<string | undefined>(undefined);
  const [defaultSectionId, setDefaultSectionId] = useState<string | undefined>(undefined);
  const [zenModeTaskId, setZenModeTaskId] = useState<string | null>(null);
  const [sequenceMode, setSequenceMode] = useState<{ taskIds: string[]; listName: string; listColor?: string } | null>(null);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isIntegrationsOpen, setIsIntegrationsOpen] = useState(false);
  useEffect(() => {
    const open = () => setIsIntegrationsOpen(true);
    window.addEventListener('open-integrations-modal', open);
    return () => window.removeEventListener('open-integrations-modal', open);
  }, []);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [aiAssistantEverOpened, setAiAssistantEverOpened] = useState(false);
  if (isAIAssistantOpen && !aiAssistantEverOpened) setAiAssistantEverOpened(true);
  const [securityOpen, setSecurityOpen] = useState(false);
  useEffect(() => {
    const open = () => setSecurityOpen(true);
    window.addEventListener('open-security-sheet', open);
    return () => window.removeEventListener('open-security-sheet', open);
  }, []);
  const [drawerEverOpened, setDrawerEverOpened] = useState(false);
  // Modales y vistas clave se precargan en idle para apertura instantánea sin latencia.
  useEffect(() => {
    const idle = (window as any).requestIdleCallback || ((cb: () => void) => window.setTimeout(cb, 1500));
    const id = idle(() => { 
      void import('./components/tasks/TaskDrawer');
      void import('./components/analytics/AnalyticsView');
      void import('./components/integrations/IntegrationsModal');
    });
    return () => { (window as any).cancelIdleCallback?.(id); };
  }, []);
  if (isDrawerOpen && !drawerEverOpened) setDrawerEverOpened(true);
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
    // El texto que acompaña al evento lo envía el propio asistente.
    const handleOpenAI = () => setIsAIAssistantOpen(true);
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

  // Ctrl/⌘+Z fuera de un campo de texto: deshace la última eliminación (30 s de margen).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.key.toLowerCase() !== 'z') return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (undoLastDeletion()) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // IndexedDB can be unavailable in privacy/restricted contexts. Never strand the
  // user behind an infinite loader: continue with the safe in-memory defaults.
  useEffect(() => {
    if (hasHydrated) return;
    const hydrationGuard = window.setTimeout(() => {
      useAppStore.getState().setHasHydrated(true);
    }, 4500); // 4500ms guard: allows mobile IndexedDB enough time to open without premature abort
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

    if (currentView.startsWith('cycle_')) {
      const coreCycles = ['cycle_day', 'cycle_week', 'cycle_month', 'cycle_year'];
      const allCycles = useAppStore.getState().cycles || [];
      const exists = coreCycles.includes(currentView) || allCycles.some((c: any) => c.id === currentView && !c.deleted_at);
      if (!exists) {
        setCurrentView('smart_today');
      }
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

  useAppLayout(setIsMobile);

  useGeofencing(tasks);

  // ── Default lists initialization & Data Hygiene ──────────────────
  // Se ejecuta una sola vez, cuando los datos locales ya se han cargado de IndexedDB
  // (antes se lanzaba sobre un estado vacío y su efecto dependía de una carrera).
  const isHygieneDone = useDataHygiene(hasHydrated);

  useSyncManager(token);

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

  useGlobalShortcuts(setIsShortcutsOpen, setIsDrawerOpen, setEditingTaskId, setDefaultSectionId, handleSelectView);

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

  // Siempre con la navegación actual (antes el oyente se quedaba con la del primer render).
  const selectViewFromEvent = useEffectEvent((view: string) => handleSelectView(view));
  useEffect(() => {
    const handleOpenShortcuts = () => setIsShortcutsOpen(true);
    const handleOpenNewTask = () => {
      setEditingTaskId(null);
      setDefaultSectionId(undefined);
      setIsDrawerOpen(true);
    };
    const handleSelectViewCustom = (e: any) => {
      if (e.detail) selectViewFromEvent(e.detail);
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
  if (!hasHydrated || !isHygieneDone) {
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
    return <Suspense fallback={null}><SharedListView token={shareToken} onExit={() => { clearUrlParam('share'); setShareToken(null); }} /></Suspense>;
  }

  if (resetToken || !token) {
    return (
      <AuthScreen
        resetToken={resetToken || undefined}
        onSuccess={() => {}}
        onResetFinished={() => { clearUrlParam('reset'); setResetToken(null); }}
      />
    );
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
              onOpenNewTask={(sectionId, initialTitle) => { setEditingTaskId(null); setDrawerInitialFocus(undefined); setDrawerInitialTitle(initialTitle); setDefaultSectionId(sectionId); setIsDrawerOpen(true); }}
              onOpenZenMode={(taskId) => setZenModeTaskId(taskId)}
              onEditTask={(taskId, initialFocus) => { setEditingTaskId(taskId); setDrawerInitialFocus(initialFocus); setIsDrawerOpen(true); }}
              onBackToSidebar={isMobile ? () => setMobileView('sidebar') : undefined}
              onSelectView={handleSelectView}
              isMobile={isMobile}
              onStartSequence={(taskIds, listName, listColor) => {
                setSequenceMode({ taskIds, listName, listColor });
              }}
            />
          )}
          {navView === 'UNIVERSAL_IMPORTER' && <Suspense fallback={null}><UniversalImporter onBack={handleBack} /></Suspense>}
          {navView === 'ANALYTICS' && (
            <Suspense fallback={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(120,120,128,0.25)', borderTopColor: 'var(--accent-purple, #af52de)', animation: 'spin 0.8s linear infinite' }} />
              </div>
            }>
              <AnalyticsView onBack={handleBack} />
            </Suspense>
          )}
        </NavigationFrame>
      </div>

      {drawerEverOpened && (
        <Suspense fallback={null}>
        <TaskDrawer
          isOpen={isDrawerOpen}
          onClose={() => { setIsDrawerOpen(false); setEditingTaskId(null); setDefaultSectionId(undefined); setDrawerInitialFocus(undefined); setDrawerInitialTitle(undefined); }}
          defaultCategoryId={
            currentView.startsWith('list_') ? currentView.replace('list_', '') : undefined
          }
          defaultSectionId={defaultSectionId}
          taskId={editingTaskId || undefined}
          initialFocus={drawerInitialFocus}
          initialTitle={drawerInitialTitle}
        />
        </Suspense>
      )}

      {/* Se monta al abrirlo por primera vez (así su código no pesa en la carga inicial) y se queda montado para animar el cierre. */}
      {aiAssistantEverOpened && (
        <Suspense fallback={null}>
          <AIAssistantModal
            isOpen={isAIAssistantOpen}
            onClose={() => setIsAIAssistantOpen(false)}
            onSelectView={(view: string) => handleSelectView(view)}
          />
        </Suspense>
      )}

      <PromptModal />

      {zenModeTaskId && (
        <Suspense fallback={null}><ZenMode taskId={zenModeTaskId} onClose={() => setZenModeTaskId(null)} /></Suspense>
      )}

      {sequenceMode && (
        <Suspense fallback={null}>
        <ListSequenceMode
          taskIds={sequenceMode.taskIds}
          listName={sequenceMode.listName}
          listColor={sequenceMode.listColor}
          onClose={() => setSequenceMode(null)}
        />
        </Suspense>
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
      {securityOpen && (
        <Suspense fallback={null}>
          <SecuritySheet onClose={() => setSecurityOpen(false)} />
        </Suspense>
      )}
      <ShortcutsModal isOpen={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />
      {isIntegrationsOpen && (
        <Suspense fallback={
          <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.25)', borderTopColor: '#ffffff', animation: 'spin 0.8s linear infinite' }} />
          </div>
        }>
          <IntegrationsModal
            isOpen={isIntegrationsOpen}
            onClose={() => setIsIntegrationsOpen(false)}
            tasks={Object.values(tasks || {}).filter(t => !t.deleted_at)}
            listName={lists?.find(l => l.id === currentView)?.name || 'Recordatorios'}
          />
        </Suspense>
      )}
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
