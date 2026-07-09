import { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  ChevronRight, 
  ChevronDown, 
  Plus,
  Check,
  LogOut,
  BarChart,
  Trash2,
  Download,
  MoreHorizontal,
  Inbox
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';
import { usePromptStore } from '../../store/usePromptStore';
import { getCycleIcon } from '../../constants/icons';
import { ListConfigModal } from './ListConfigModal';
import { CycleConfigModal } from './CycleConfigModal';
import { SMART_LISTS } from '../../constants/smartLists';
import './Layout.css';

interface SidebarProps {
  currentView: string;
  onSelectView: (view: string) => void;
}

// Sub-componente para jerarquía infinita
const ListHierarchy = ({ lists, currentView, onSelectView, onAddSublist, onEditList, getTaskCount, parentId = undefined, depth = 0 }: any) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number } | null>(null);
  const { removeList } = useAppStore();
  
  const currentLevelLists = lists.filter((l: any) => l.parentId === parentId && l.id !== 'user_preferences_smart_lists');
  if (currentLevelLists.length === 0) return null;

  return (
    <div style={{ marginLeft: depth > 0 ? 16 : 0 }}>
      {currentLevelLists.map((list: any) => {
        const hasChildren = lists.some((l: any) => l.parentId === list.id);
        const isExpanded = expanded[list.id];
        const isActive = currentView === `list_${list.id}`;

        return (
          <div key={list.id} style={{ position: 'relative' }}>
            <div 
              className={`ios-list-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectView(`list_${list.id}`)}
              style={{ position: 'relative' }}
            >
              {hasChildren && (
                <div 
                  onClick={(e) => { e.stopPropagation(); setExpanded(p => ({...p, [list.id]: !p[list.id]})); }}
                  style={{ position: 'absolute', left: -16, padding: 4, cursor: 'pointer', color: 'var(--text-tertiary)' }}
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
              )}
              
              <div className="list-icon" style={{ backgroundColor: list.color }} />
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <span className="title" style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)' }}>{list.name}</span>
                {list.isShared && <span className="subtitle">Esta lista es compartida.</span>}
              </div>
              
              {getTaskCount && <span className="count">{getTaskCount(list.id) || 0}</span>}
              <ChevronRight size={16} color="var(--text-tertiary)" />
              
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if (activeMenuId === list.id) {
                    setActiveMenuId(null);
                    setMenuCoords(null);
                  } else {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setMenuCoords({
                      top: rect.bottom + window.scrollY,
                      left: rect.left + window.scrollX - 120
                    });
                    setActiveMenuId(list.id);
                  }
                }}
                style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', opacity: 0.5, padding: 4, marginLeft: 8 }}
                title="Acciones de Lista"
              >
                <MoreHorizontal size={14} />
              </button>

              {activeMenuId === list.id && menuCoords && createPortal(
                <>
                  <div 
                    style={{ position: 'fixed', inset: 0, zIndex: 99998 }} 
                    onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); setMenuCoords(null); }} 
                  />
                  <div 
                    style={{
                      position: 'absolute',
                      top: menuCoords.top + 4,
                      left: menuCoords.left,
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '10px',
                      boxShadow: 'var(--shadow-lg)',
                      zIndex: 99999,
                      padding: '4px',
                      display: 'flex',
                      flexDirection: 'column',
                      minWidth: 140
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button 
                      onClick={() => {
                        setActiveMenuId(null);
                        setMenuCoords(null);
                        onAddSublist(list.id);
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--text-primary)', textAlign: 'left', cursor: 'pointer', borderRadius: 6, fontSize: '0.85rem', width: '100%' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <Plus size={14} /> Añadir Sublista
                    </button>
                    <button 
                      onClick={() => {
                        setActiveMenuId(null);
                        setMenuCoords(null);
                        onEditList(list.id);
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--text-primary)', textAlign: 'left', cursor: 'pointer', borderRadius: 6, fontSize: '0.85rem', width: '100%' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ fontSize: 12 }}>✏️</span> Editar Lista
                    </button>
                    <button 
                      onClick={() => {
                        if (confirm(`¿Seguro que quieres borrar la lista "${list.name}" y sus sublistas?`)) {
                          removeList(list.id);
                        }
                        setActiveMenuId(null);
                        setMenuCoords(null);
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'transparent', border: 'none', color: 'var(--accent-red)', textAlign: 'left', cursor: 'pointer', borderRadius: 6, fontSize: '0.85rem', width: '100%' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <Trash2 size={14} /> Eliminar Lista
                    </button>
                  </div>
                </>,
                document.body
              )}
            </div>
            
            {hasChildren && isExpanded && (
              <ListHierarchy 
                lists={lists} 
                currentView={currentView} 
                onSelectView={onSelectView} 
                onAddSublist={onAddSublist}
                onEditList={onEditList}
                getTaskCount={getTaskCount}
                parentId={list.id} 
                depth={depth + 1} 
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export function Sidebar({ currentView, onSelectView }: SidebarProps) {
  const { lists, cycles, smartListVisibility, toggleSmartList, tasks } = useAppStore();
  
  const getTaskCount = (listId: string) => {
    const all = Object.values(tasks || {}).filter(t => !t.deleted_at);
    const active = all.filter(t => !t.completed_at);
    const todayStr = new Date().toDateString();
    
    switch (listId) {
      case 'smart_today': 
        return active.filter(t => t.due_date && new Date(t.due_date).toDateString() === todayStr).length;
      case 'smart_scheduled': 
        return active.filter(t => t.due_date && new Date(t.due_date) > new Date()).length;
      case 'smart_all': 
        return active.length;
      case 'smart_flagged': 
        return active.filter(t => t.priority === 3).length;
      case 'smart_completed': 
        return all.filter(t => t.completed_at).length;
      default: 
        return 0;
    }
  };

  const user = { name: 'Eneko Ruiz', email: localStorage.getItem('userEmail') || 'eneko@ejemplo.com' };

  const [isCyclesOpen, setIsCyclesOpen] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  
  const [isListConfigOpen, setIsListConfigOpen] = useState(false);
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);
  const [editingListId, setEditingListId] = useState<string | undefined>(undefined);
  const [parentListId, setParentListId] = useState<string | undefined>(undefined);

  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const handleAddList = () => {
    setEditingListId(undefined);
    setParentListId(undefined);
    setIsListConfigOpen(true);
  };

  return (
    <aside className="sidebar">
      {/* 1. USER PROFILE */}
      <div 
        className="user-profile" 
        onClick={() => setIsProfileOpen(!isProfileOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-12)',
          cursor: 'pointer',
          position: 'relative',
          padding: 'var(--space-8) var(--space-4)',
          borderRadius: 'var(--radius-md)',
          transition: 'background 0.2s',
        }}
      >
        <div className="avatar" style={{
          width: 36,
          height: 36,
          borderRadius: 'var(--radius-full)',
          background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-purple))',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: '1.25rem',
          boxShadow: 'var(--shadow-sm)'
        }}>
          {user.name.charAt(0)}
        </div>
        <div className="user-info" style={{ flex: 1 }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            {user.name}
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {user.email}
          </span>
        </div>
        <ChevronDown size={16} color="var(--text-tertiary)" style={{ transform: isProfileOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />

        {/* PROFILE DROPDOWN */}
        <AnimatePresence>
          {isProfileOpen && (
            <motion.div 
              key="sidebar-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, zIndex: 90 }} 
              onClick={(e) => { e.stopPropagation(); setIsProfileOpen(false); }}
            />
          )}
          {isProfileOpen && (
            <motion.div 
              key="sidebar-dropdown"
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ duration: 0.15 }}
                className="dark-dropdown-bg"
                style={{ 
                  position: 'absolute', 
                  top: '100%', 
                  left: 0, 
                  right: 0, 
                  marginTop: 'var(--space-8)', 
                  background: 'var(--bg-surface-glass)', 
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  borderRadius: 'var(--radius-lg)', 
                  border: '1px solid var(--border-subtle)', 
                  boxShadow: 'var(--shadow-lg)', 
                  padding: 'var(--space-8)', 
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--space-4)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div 
                  className="nav-item profile-nav-item"
                  onClick={() => { onSelectView('DATA'); setIsProfileOpen(false); }}
                  style={{ padding: 'var(--space-12) var(--space-16)' }}
                >
                  <Download size={16} /> Importar / Exportar
                </div>
                <div 
                  className="nav-item profile-nav-item"
                  onClick={() => { onSelectView('ANALYTICS'); setIsProfileOpen(false); }}
                  style={{ padding: 'var(--space-12) var(--space-16)' }}
                >
                  <BarChart size={16} /> Estadísticas
                </div>
                <div style={{ height: 1, background: 'var(--border-subtle)', margin: '8px 0' }} />
                <div 
                  className="nav-item profile-nav-item"
                  onClick={() => { onSelectView('TRASH'); setIsProfileOpen(false); }}
                  style={{ color: 'var(--accent-red)', padding: 'var(--space-12) var(--space-16)' }}
                >
                  <Trash2 size={16} /> Papelera
                </div>
                <div style={{ height: 1, background: 'var(--border-subtle)', margin: '8px 0' }} />
                <div 
                  className="nav-item profile-nav-item"
                  onClick={() => {
                    useAppStore.getState().logout();
                    setIsProfileOpen(false);
                  }}
                  style={{ color: 'var(--accent-red)', padding: 'var(--space-12) var(--space-16)' }}
                >
                  <LogOut size={16} /> Cerrar Sesión
                </div>
              </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 2. SEARCH BAR */}
      <div className="search-bar">
        <input type="text" placeholder="Buscar" />
      </div>

      {/* 3. SCROLLABLE AREA */}
      <div className="sidebar-scroll-area">
        
        {/* SMART LISTS GRID */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 var(--space-12)', marginBottom: 'var(--space-8)' }}>
          <span className="section-header" style={{ margin: 0, padding: 0 }}>LISTAS INTELIGENTES</span>
          <button 
            onClick={() => setIsEditMode(!isEditMode)}
            style={{ background: 'transparent', border: 'none', color: isEditMode ? 'var(--accent-primary)' : 'var(--text-tertiary)', fontSize: '0.85rem', cursor: 'pointer' }}
          >
            {isEditMode ? 'Hecho' : 'Editar'}
          </button>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: 'var(--space-8)', 
          padding: '0 var(--space-12)',
          marginBottom: 'var(--space-16)'
        }}>
          {SMART_LISTS.filter(list => smartListVisibility[list.id] || isEditMode).length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-16) 0', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
              No tienes listas inteligentes seleccionadas
            </div>
          ) : (
            SMART_LISTS.map(list => {
              if (!smartListVisibility[list.id] && !isEditMode) return null;
              const Icon = list.icon;
            
            return (
              <div 
                key={list.id}
                className="ios-smart-card"
                onClick={() => {
                  if (isEditMode) {
                    toggleSmartList(list.id);
                  } else {
                    onSelectView(list.id);
                  }
                }}
                style={{
                  backgroundColor: list.color,
                  opacity: isEditMode && !smartListVisibility[list.id] ? 0.5 : 1,
                }}
              >
                {isEditMode && (
                  <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
                    <div style={{ 
                      width: 18, height: 18, borderRadius: '50%', 
                      border: smartListVisibility[list.id] ? 'none' : '1px solid rgba(255,255,255,0.5)',
                      background: smartListVisibility[list.id] ? 'var(--accent-primary)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {smartListVisibility[list.id] && <Check size={12} color="white" />}
                    </div>
                  </div>
                )}
                <div className="icon-circle">
                  <Icon size={16} color={list.color} />
                </div>
                {!isEditMode && <span className="count">{getTaskCount(list.id)}</span>}
                <h3>{list.name}</h3>
              </div>
            );
          }))}
        </div>

        {/* MIS LISTAS */}
        <div className="categories-section" style={{ flexShrink: 0 }}>
          <div className="section-header">Mis listas</div>
          <div className="ios-list-block">
            {/* Bandeja de entrada */}
            <div 
              className={`ios-list-item ${currentView === 'list_inbox' ? 'active' : ''}`}
              onClick={() => onSelectView('list_inbox')}
            >
              <div className="list-icon" style={{ backgroundColor: '#0a84ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Inbox size={12} color="white" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <span className="title" style={{ color: currentView === 'list_inbox' ? 'var(--accent-primary)' : 'var(--text-primary)' }}>Bandeja de entrada</span>
              </div>
              <span className="count">
                {Object.values(tasks || {}).filter(t => !t.deleted_at && !t.completed_at && (t.categoryId === 'inbox' || !t.categoryId)).length}
              </span>
              <ChevronRight size={16} color="var(--text-tertiary)" />
            </div>

            <ListHierarchy 
              lists={lists} 
              currentView={currentView} 
              onSelectView={onSelectView}
              getTaskCount={(id: string) => Object.values(tasks || {}).filter(t => !t.deleted_at && !t.completed_at && t.category_id === id).length}
              onAddSublist={(pId: string) => { setEditingListId(undefined); setParentListId(pId); setIsListConfigOpen(true); }} 
              onEditList={(listId: string) => { setEditingListId(listId); setParentListId(undefined); setIsListConfigOpen(true); }}
            />
          </div>
          <button 
            className="add-list-btn" 
            onClick={handleAddList}
            style={{ marginTop: 'var(--space-8)', width: '100%' }}
          >
            <Plus size={16} />
            Nueva Lista Raíz
          </button>
        </div>

        {/* CICLOS TEMPORALES */}
        <div style={{ marginTop: 'var(--space-16)' }}>
          <div className="section-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Ciclos temporales</span>
            <button 
              className="btn-icon"
              style={{ padding: 4, cursor: 'pointer' }}
              title="Nuevo Ciclo"
              onClick={(e) => {
                e.stopPropagation();
                setIsCycleModalOpen(true);
              }}
            >
              <Plus size={14} color="var(--text-tertiary)" />
            </button>
          </div>

          <div className="ios-list-block">
            {cycles.filter(c => c.isPinned).map(cycle => {
              const Icon = getCycleIcon(cycle.icon);
              const isActive = currentView === cycle.id;
              const taskCount = Object.values(tasks || {}).filter(t => !t.deleted_at && !t.completed_at && t.cycle_id === cycle.id).length;
              return (
                <div 
                  key={cycle.id}
                  className={`ios-list-item ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectView(cycle.id)}
                >
                  <div className="list-icon" style={{ backgroundColor: '#8e8e93', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={12} color="white" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                    <span className="title" style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)' }}>{cycle.name}</span>
                  </div>
                  <span className="count">{taskCount}</span>
                  <ChevronRight size={16} color="var(--text-tertiary)" />
                </div>
              );
            })}
          </div>
        </div>

      </div>
      
      {/* MODALS (OUTSIDE SCROLL) */}
      <ListConfigModal 
        isOpen={isListConfigOpen} 
        onClose={() => setIsListConfigOpen(false)} 
        listId={editingListId} 
        parentId={parentListId} 
      />
      <CycleConfigModal 
        isOpen={isCycleModalOpen}
        onClose={() => setIsCycleModalOpen(false)}
        onSuccess={(id) => {
          setIsCycleModalOpen(false);
          setIsCyclesOpen(true);
          onSelectView(id);
        }}
      />
    </aside>
  );
}
