import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus,
  Trash2,
  MoreHorizontal,
  Inbox,
  Rocket,
  Search,
  Sparkles,
  X
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAppStore, isTaskCompleted } from '../../store/useAppStore';
import { SoundService } from '../../services/SoundService';
import { HapticService } from '../../services/HapticService';
import { ListConfigModal } from './ListConfigModal';
import { CycleConfigModal } from './CycleConfigModal';
import './Layout.css';

// Modular sidebar subcomponents
import { ListHierarchy } from './sidebar/ListHierarchy';
import { PinnedListsSection } from './sidebar/PinnedListsSection';
import { SmartListsGrid } from './sidebar/SmartListsGrid';
import { CyclesListSection } from './sidebar/CyclesListSection';
import { UserProfileDropdown } from './sidebar/UserProfileDropdown';
import { getUserDisplayName, getUserEmail } from '../../utils/userIdentity';

interface SidebarProps {
  currentView: string;
  onSelectView: (view: string) => void;
}

export function Sidebar({ currentView, onSelectView }: SidebarProps) {
  const lists = useAppStore((state) => state.lists);
  const cycles = useAppStore((state) => state.cycles);
  const smartListVisibility = useAppStore((state) => state.smartListVisibility);
  const pinnedSmartLists = useAppStore((state) => state.pinnedSmartLists) || [];
  const toggleSmartList = useAppStore((state) => state.toggleSmartList);
  const togglePinSmartList = useAppStore((state) => state.togglePinSmartList);
  const dismissOnboarding = useAppStore((state) => state.dismissOnboarding);
  const tasks = useAppStore((state) => state.tasks);
  const cycleVisibility = useAppStore((state) => state.cycleVisibility);
  const toggleCycleVisibility = useAppStore((state) => state.toggleCycleVisibility);
  const globalCyclesEnabled = useAppStore((state) => state.globalCyclesEnabled);
  const syncStatus = useAppStore((state) => state.syncStatus);
  const lastSyncedAt = useAppStore((state) => state.lastSyncedAt);
  const theme = useAppStore((state) => state.theme) || 'light';
  const toggleTheme = useAppStore((state) => state.toggleTheme);
  const [hapticEnabled, setHapticEnabled] = useState(() => HapticService.enabled);
  
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number } | null>(null);
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const mobileItemStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    minHeight: 48,
    fontSize: '1rem',
    background: 'transparent',
    border: 'none',
    color: 'var(--text-primary)',
    textAlign: 'left' as const,
    cursor: 'pointer',
    borderRadius: 10,
    width: '100%'
  };
  
  const getTaskCount = (listId: string) => {
    const all = Object.values(tasks || {}).filter(t => !t.deleted_at);
    const active = all.filter(t => !isTaskCompleted(t));
    const todayStr = new Date().toDateString();
    
    switch (listId) {
      case 'smart_primeros_pasos':
        return active.filter(t => t.categoryId === 'primeros_pasos').length;
      case 'smart_today': 
        return active.filter(t => t.dueDate && new Date(t.dueDate).toDateString() === todayStr).length;
      case 'smart_scheduled': 
        return active.filter(t => t.dueDate && new Date(t.dueDate) > new Date()).length;
      case 'smart_all': 
        return active.length;
      case 'smart_flagged': 
        return active.filter(t => Boolean(t.flagged || (t.priority && t.priority !== 'none'))).length;
      case 'smart_completed': 
        return all.filter(t => isTaskCompleted(t)).length;
      case 'smart_overdue': {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return active.filter(t => t.dueDate && new Date(t.dueDate) < today).length;
      }
      default: {
        const cleanListId = listId.replace('list_', '').replace('folder_', '');
        const descendantListIds = new Set<string>([cleanListId]);
        const queue = [cleanListId];
        while (queue.length > 0) {
          const currId = queue.shift()!;
          const children = lists?.filter(l => l.parentId === currId) || [];
          children.forEach(c => {
            descendantListIds.add(c.id);
            queue.push(c.id);
          });
        }
        return active.filter(t => {
          if (t.categoryId === 'primeros_pasos') return false;
          const catId = t.categoryId || (t as any).category_id;
          return catId && descendantListIds.has(catId);
        }).length;
      }
    }
  };

  const isGuest = useAppStore((state) => !state.token || state.token.startsWith('local_offline'));
  const user = {
    name: getUserDisplayName() || (isGuest ? 'Sin cuenta' : 'Mi cuenta'),
    email: isGuest ? 'Datos solo en este dispositivo' : getUserEmail(),
  };
  const userProfileRef = useRef<HTMLDivElement>(null);

  const [isEditMode, setIsEditMode] = useState(false);
  const [isEditCyclesMode, setIsEditCyclesMode] = useState(false);
  
  const [isListConfigOpen, setIsListConfigOpen] = useState(false);
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);
  const [editingListId, setEditingListId] = useState<string | undefined>(undefined);
  const [parentListId, setParentListId] = useState<string | undefined>(undefined);
  const [isNewFolderDefault, setIsNewFolderDefault] = useState(false);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(SoundService.enabled);

  useEffect(() => {
    setIsProfileOpen(false);
  }, [currentView]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSearchExpanded(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const handleAddList = () => {
    setEditingListId(undefined);
    setParentListId(undefined);
    setIsNewFolderDefault(false);
    setIsListConfigOpen(true);
  };

  return (
    <aside className="sidebar" onScroll={() => window.dispatchEvent(new Event('close-list-menus'))}>
      {/* 1 & 2. STICKY HEADER: COLLAPSIBLE CIRCULAR SEARCH + USER PROFILE */}
      <div className="sidebar-header" style={{ display: 'flex', flexDirection: 'row', flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 14px 8px', width: '100%', boxSizing: 'border-box' }}>
        {!isSearchExpanded ? (
          <>
            {/* Header Title / Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Recordatorios
              </span>
            </div>

            {/* Actions: Circular Search Button + Profile Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <button
                type="button"
                data-testid="sidebar-search-btn"
                onClick={() => {
                  HapticService.selection();
                  setIsSearchExpanded(true);
                }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  transition: 'all 0.18s ease',
                  overflow: 'hidden'
                }}
                title="Buscar (⌘K)"
                aria-label="Buscar"
              >
                <Search size={16} style={{ flexShrink: 0 }} />
              </button>

              <div 
                ref={userProfileRef}
                className="user-profile-trigger"
                onClick={(e) => { e.stopPropagation(); setIsProfileOpen((prev) => !prev); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                  flexShrink: 0,
                  borderRadius: '50%',
                  padding: 1
                }}
                title={`${user.name} (${user.email})`}
              >
                <div style={{ position: 'relative' }}>
                  <div className="avatar" style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-purple))',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
                  }}>
                    {user.name.charAt(0)}
                  </div>
                  {/* Sync status micro-dot */}
                  <span style={{
                    position: 'absolute',
                    bottom: -1,
                    right: -1,
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    background: syncStatus === 'synced' ? '#34c759' : syncStatus === 'syncing' ? '#0a84ff' : syncStatus === 'error' ? '#ff3b30' : '#8e8e93',
                    border: '2px solid var(--bg-base)'
                  }} />
                </div>
              </div>
            </div>
          </>
        ) : (
          /* EXPANDED INLINE SEARCH BAR */
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 8, animation: 'fadeIn 0.2s ease-out' }}>
            <div 
              data-testid="sidebar-search-expanded-bar"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 10,
                padding: '6px 12px',
                cursor: 'pointer'
              }}
              onClick={() => {
                window.dispatchEvent(new CustomEvent('open-command-palette'));
                setIsSearchExpanded(false);
              }}
            >
              <Search size={15} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: '0.88rem', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Buscar...
              </span>
              <kbd style={{
                fontSize: '0.7rem',
                fontWeight: 650,
                color: 'var(--text-tertiary)',
                background: 'var(--bg-card)',
                padding: '2px 5px',
                borderRadius: 4,
                border: '1px solid var(--border-subtle)',
                flexShrink: 0
              }}>⌘K</kbd>
            </div>

            <button
              type="button"
              data-testid="sidebar-search-close-btn"
              onClick={(e) => {
                e.stopPropagation();
                setIsSearchExpanded(false);
              }}
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                flexShrink: 0
              }}
              title="Cerrar búsqueda"
            >
              <X size={15} />
            </button>
          </div>
        )}
      </div>

      {/* USER PROFILE DROPDOWN */}
      <UserProfileDropdown
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        anchorEl={userProfileRef.current}
        user={user}
        syncStatus={syncStatus}
        lastSyncedAt={lastSyncedAt}
        soundEnabled={soundEnabled}
        setSoundEnabled={setSoundEnabled}
        hapticEnabled={hapticEnabled}
        setHapticEnabled={setHapticEnabled}
        theme={theme}
        toggleTheme={toggleTheme}
        setIsListConfigOpen={setIsListConfigOpen}
        onSelectView={onSelectView}
      />

      {/* 3. SCROLLABLE AREA */}
      <div 
        className="sidebar-content sidebar-scroll-area" 
        onScroll={() => window.dispatchEvent(new Event('close-list-menus'))}
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorY: 'auto',
          display: 'flex', 
          flexDirection: 'column' 
        }}
      >
        {/* ANCLADAS (PINNED LISTS SECTION) */}
        <PinnedListsSection
          pinnedSmartLists={pinnedSmartLists}
          lists={lists}
          smartListVisibility={smartListVisibility}
          isEditMode={isEditMode}
          currentView={currentView}
          onSelectView={onSelectView}
          togglePinSmartList={togglePinSmartList}
          getTaskCount={getTaskCount}
        />

        {/* SMART LISTS GRID */}
        <SmartListsGrid
          smartListVisibility={smartListVisibility}
          pinnedSmartLists={pinnedSmartLists}
          isEditMode={isEditMode}
          setIsEditMode={setIsEditMode}
          currentView={currentView}
          onSelectView={onSelectView}
          toggleSmartList={toggleSmartList}
          togglePinSmartList={togglePinSmartList}
          getTaskCount={getTaskCount}
        />

        {/* MIS LISTAS */}
        <div className="categories-section" style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 12px 8px 16px' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Mis listas</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button 
                type="button"
                className="btn-icon"
                style={{ 
                  padding: '3px 8px', 
                  borderRadius: 999,
                  background: 'var(--accent-glow)',
                  border: '1px solid var(--accent-primary)',
                  color: 'var(--accent-primary)',
                  fontSize: '0.72rem',
                  fontWeight: 650,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer'
                }}
                title="Abrir Asistente IA (Ctrl+J)"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('open-ai-assistant'));
                }}
              >
                <Sparkles size={12} /> IA
              </button>
              <button 
                type="button"
                className="btn-icon"
                style={{ padding: 4, cursor: 'pointer' }}
                title="Añadir lista"
                onClick={handleAddList}
              >
                <Plus size={16} color="var(--accent-primary)" />
              </button>
            </div>
          </div>
          <div className="ios-list-block">
            {/* 🚀 Primeros Pasos (Banner distinguido en la parte superior) */}
            {lists?.some(l => l.id === 'primeros_pasos') && (getTaskCount('smart_primeros_pasos') > 0 || isEditMode) && !pinnedSmartLists.includes('smart_primeros_pasos') && !lists.some(l => l.id === 'primeros_pasos' && l.isPinned) && (
              <motion.div 
                className={`ios-list-item ${currentView === 'smart_primeros_pasos' || currentView === 'list_primeros_pasos' ? 'active' : ''}`}
                onClick={() => onSelectView('smart_primeros_pasos')}
                style={{ transition: 'background-color 150ms ease' }}
              >
                <div className="list-icon" style={{ backgroundColor: '#ff2d55', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Rocket size={15} color="white" strokeWidth={2.4} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                  <span className="title" style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Primeros Pasos</span>
                </div>
                <span className="count" style={{ color: '#ff2d55', fontWeight: 700 }}>
                  {getTaskCount('smart_primeros_pasos')}
                </span>
                
                <button 
                  type="button"
                  className="list-action-btn"
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if (activeMenuId === 'primeros_pasos') {
                      setActiveMenuId(null);
                      setMenuCoords(null);
                    } else {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setMenuCoords({
                        top: rect.bottom,
                        left: rect.left - 120
                      });
                      setActiveMenuId('primeros_pasos');
                    }
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4, marginLeft: 4 }}
                  title="Opciones de Guía"
                >
                  <MoreHorizontal size={14} />
                </button>
              </motion.div>
            )}

            {/* Portal flotante para menú de Primeros Pasos */}
            {activeMenuId === 'primeros_pasos' && menuCoords && createPortal(
              <>
                <div 
                  style={{ position: 'fixed', inset: 0, zIndex: 99998, background: 'transparent' }} 
                  onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); setMenuCoords(null); }} 
                />
                <motion.div 
                  initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.85, y: -10 }}
                  animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
                  exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: -5 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 450 }}
                  className={isMobile ? undefined : "ios-dropdown-menu"}
                  style={isMobile ? { 
                    position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 99999,
                    background: 'var(--bg-elevated, #1c1c1e)',
                    borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
                    borderRadius: '20px 20px 0 0', padding: '16px 16px max(24px, env(safe-area-inset-bottom))',
                    boxShadow: '0 -10px 40px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: 8
                  } : { 
                    position: 'fixed',
                    top: Math.min(menuCoords.top + 4, window.innerHeight - 200),
                    left: Math.max(12, Math.min(menuCoords.left, window.innerWidth - 220)),
                    zIndex: 99999, width: 220,
                    background: 'var(--bg-material, rgba(255,255,255,0.75))',
                    backdropFilter: 'blur(30px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                    borderRadius: '14px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.04)',
                    border: '1px solid rgba(255,255,255,0.2)', padding: '8px 0',
                    display: 'flex', flexDirection: 'column'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button 
                    type="button"
                    className="ios-dropdown-item danger"
                    onClick={() => {
                      setActiveMenuId(null);
                      setMenuCoords(null);
                      dismissOnboarding();
                      onSelectView('list_inbox');
                    }}
                    style={isMobile ? mobileItemStyle : { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'transparent', border: 'none', color: '#ff3b30', textAlign: 'left', cursor: 'pointer', borderRadius: 6, fontSize: '0.88rem', fontWeight: 600, width: '100%' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,59,48,0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <Trash2 size={16} color="#ff3b30" /> Saltar primeros pasos
                  </button>
                </motion.div>
              </>,
              document.body
            )}

            {/* Bandeja de entrada */}
            <motion.div 
              className={`ios-list-item ${currentView === 'list_inbox' ? 'active' : ''}`}
              onClick={() => onSelectView('list_inbox')}
              style={{ transition: 'background-color 150ms ease' }}
            >
              <div className="list-icon" style={{ backgroundColor: '#0a84ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Inbox size={15} color="white" strokeWidth={2.4} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <span className="title" style={{ color: currentView === 'list_inbox' ? 'var(--accent-primary)' : 'var(--text-primary)' }}>Bandeja de entrada</span>
              </div>
              <span className="count">
                {Object.values(tasks || {}).filter(t => {
                  if (t.deleted_at || isTaskCompleted(t)) return false;
                  const catId = t.categoryId || (t as any).category_id;
                  return catId === 'inbox' || !catId;
                }).length}
              </span>
            </motion.div>

            <ListHierarchy 
              lists={lists} 
              currentView={currentView} 
              onSelectView={onSelectView} 
              getTaskCount={getTaskCount}
              onAddSublist={(pId: string, isF?: boolean) => { setEditingListId(undefined); setParentListId(pId); setIsNewFolderDefault(!!isF); setIsListConfigOpen(true); }} 
              onEditList={(listId: string) => { setEditingListId(listId); setParentListId(undefined); setIsListConfigOpen(true); }}
              isEditMode={isEditMode}
              activeMenuId={activeMenuId}
              setActiveMenuId={setActiveMenuId}
              menuCoords={menuCoords}
              setMenuCoords={setMenuCoords}
            />

            {/* Papelera */}
            <motion.div 
              className={`ios-list-item ${currentView === 'TRASH' ? 'active' : ''}`}
              onClick={() => onSelectView('TRASH')}
              style={{ transition: 'background-color 150ms ease' }}
            >
              <div className="list-icon" style={{ backgroundColor: '#8e8e93', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={15} color="white" strokeWidth={2.4} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <span className="title" style={{ color: currentView === 'TRASH' ? 'var(--accent-primary)' : 'var(--text-primary)' }}>Papelera</span>
              </div>
              <span className="count">
                {Object.values(tasks || {}).filter(t => t.deleted_at).length}
              </span>
            </motion.div>
          </div>
        </div>

        {/* CICLOS TEMPORALES */}
        <CyclesListSection
          globalCyclesEnabled={globalCyclesEnabled}
          cycles={cycles}
          cycleVisibility={cycleVisibility}
          isEditCyclesMode={isEditCyclesMode}
          setIsEditCyclesMode={setIsEditCyclesMode}
          currentView={currentView}
          onSelectView={onSelectView}
          toggleCycleVisibility={toggleCycleVisibility}
          setIsCycleModalOpen={setIsCycleModalOpen}
          tasks={tasks}
        />
      </div>
      
      {/* MODALS (OUTSIDE SCROLL) */}
      <ListConfigModal 
        isOpen={isListConfigOpen} 
        onClose={() => setIsListConfigOpen(false)} 
        listId={editingListId} 
        parentId={parentListId} 
        defaultIsFolder={isNewFolderDefault}
      />
      <CycleConfigModal 
        isOpen={isCycleModalOpen}
        onClose={() => setIsCycleModalOpen(false)}
        onSuccess={(id) => {
          setIsCycleModalOpen(false);
          onSelectView(id);
        }}
      />
    </aside>
  );
}
