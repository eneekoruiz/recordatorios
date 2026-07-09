import { useState } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  Plus,
  Clock,
  Check,
  LogOut,
  BarChart,
  Trash2,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';
import { usePromptStore } from '../../store/usePromptStore';
import { getCycleIcon } from '../../constants/icons';
import { ListConfigModal } from './ListConfigModal';
import { SMART_LISTS } from '../../constants/smartLists';
import './Layout.css';

interface SidebarProps {
  currentView: string;
  onSelectView: (view: string) => void;
}

// Sub-componente para jerarquía infinita
const ListHierarchy = ({ lists, currentView, onSelectView, onAddSublist, parentId = undefined, depth = 0 }: any) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  
  const currentLevelLists = lists.filter((l: any) => l.parentId === parentId);
  if (currentLevelLists.length === 0) return null;

  return (
    <div style={{ marginLeft: depth > 0 ? 16 : 0 }}>
      {currentLevelLists.map((list: any) => {
        const hasChildren = lists.some((l: any) => l.parentId === list.id);
        const isExpanded = expanded[list.id];
        const isActive = currentView === `list_${list.id}`;

        return (
          <div key={list.id}>
            <div 
              className={`category-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectView(`list_${list.id}`)}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                padding: 'var(--space-8) var(--space-12)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 400,
                transition: 'all 0.2s',
                backgroundColor: isActive ? 'rgba(0,0,0,0.04)' : 'transparent',
              }}
            >
              {hasChildren && (
                <div 
                  onClick={(e) => { e.stopPropagation(); setExpanded(p => ({...p, [list.id]: !p[list.id]})); }}
                  style={{ position: 'absolute', left: -16, padding: 4, cursor: 'pointer', color: 'var(--text-tertiary)' }}
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
              )}
              
              <div className="list-icon" style={{ backgroundColor: list.color, width: 10, height: 10, borderRadius: '50%', marginRight: 10 }} />
              <span style={{ flex: 1 }}>{list.name}</span>
              
              <button 
                onClick={(e) => { e.stopPropagation(); onAddSublist(list.id); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', opacity: 0.5, padding: 4 }}
                title="Añadir Sublista"
              >
                <Plus size={14} />
              </button>
            </div>
            
            {hasChildren && isExpanded && (
              <ListHierarchy 
                lists={lists} 
                currentView={currentView} 
                onSelectView={onSelectView} 
                onAddSublist={onAddSublist}
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

  const user = { name: 'Eneko Ruiz', email: 'eneko@ejemplo.com' };

  const [isCyclesOpen, setIsCyclesOpen] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  
  const [isListConfigOpen, setIsListConfigOpen] = useState(false);
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
          {SMART_LISTS.map(list => {
            if (!smartListVisibility[list.id] && !isEditMode) return null;
            const Icon = list.icon;
            
            return (
              <div 
                key={list.id}
                onClick={() => {
                  if (isEditMode) {
                    toggleSmartList(list.id);
                  } else {
                    onSelectView(list.id);
                  }
                }}
                style={{
                  background: currentView === list.id ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                  border: currentView === list.id ? `1px solid ${list.color}` : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-12)',
                  cursor: 'pointer',
                  position: 'relative',
                  opacity: isEditMode && !smartListVisibility[list.id] ? 0.5 : 1,
                  transition: 'all 0.2s',
                }}
              >
                {isEditMode && (
                  <div style={{ position: 'absolute', top: 8, right: 8 }}>
                    <div style={{ 
                      width: 18, height: 18, borderRadius: '50%', 
                      border: smartListVisibility[list.id] ? 'none' : '1px solid var(--border-focus)',
                      background: smartListVisibility[list.id] ? 'var(--accent-primary)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {smartListVisibility[list.id] && <Check size={12} color="white" />}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ background: list.color, width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={14} color="white" />
                  </div>
                  {!isEditMode && <span style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>{getTaskCount(list.id)}</span>}
                </div>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{list.name}</span>
              </div>
            );
          })}
        </div>

        {/* MIS LISTAS */}
        <div className="categories-section" style={{ flexShrink: 0 }}>
          <div className="section-header">Mis Listas</div>
          <ListHierarchy 
            lists={lists} 
            currentView={currentView} 
            onSelectView={onSelectView} 
            onAddSublist={(pId: string) => { setEditingListId(undefined); setParentListId(pId); setIsListConfigOpen(true); }} 
          />
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
        <div style={{ marginTop: 'var(--space-8)' }}>
          <div className="section-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1, padding: 'var(--space-8) 0' }}
              onClick={() => setIsCyclesOpen(!isCyclesOpen)}
            >
              <Clock size={16} />
              <span>CICLOS TEMPORALES</span>
              <motion.div animate={{ rotate: isCyclesOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={14} />
              </motion.div>
            </div>
            <button 
              className="btn-icon"
              style={{ padding: 4, cursor: 'pointer' }}
              title="Nuevo Ciclo"
              onClick={async (e) => {
                e.stopPropagation();
                const name = await usePromptStore.getState().openPrompt('Nombre del nuevo ciclo temporal:', 'Ej: Siguiente Trimestre');
                if (name) {
                  const daysStr = await usePromptStore.getState().openPrompt('¿Cada cuántos días se repite este ciclo?', 'Ej: 14, 30, 365');
                  const daysValue = parseInt(daysStr || '', 10);
                  if (isNaN(daysValue) || daysValue <= 0) return; // Requiere frecuencia

                  const newCycleId = `cycle_${Date.now()}`;
                  useAppStore.getState().addCycle({
                    id: newCycleId,
                    name,
                    daysValue,
                    isPinned: true,
                    icon: 'star'
                  });
                  setIsCyclesOpen(true);
                  onSelectView(newCycleId);
                }
              }}
            >
              <Plus size={14} color="var(--text-tertiary)" />
            </button>
          </div>

          <AnimatePresence>
            {isCyclesOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', overflow: 'hidden' }}
              >
                {cycles.filter(c => c.isPinned).map(cycle => {
                  const Icon = getCycleIcon(cycle.icon);
                  const isActive = currentView === cycle.id;
                  return (
                    <div 
                      key={cycle.id}
                      className={`nav-item ${isActive ? 'active' : ''}`}
                      onClick={() => onSelectView(cycle.id)}
                      style={{ margin: '2px 0' }}
                    >
                      <Icon size={16} color={isActive ? 'var(--accent-primary)' : 'var(--text-tertiary)'} />
                    <span>{cycle.name}</span>
                  </div>
                );
              })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
      
      {/* 4. MODALS (OUTSIDE SCROLL) */}
      <ListConfigModal 
        isOpen={isListConfigOpen} 
        onClose={() => setIsListConfigOpen(false)} 
        listId={editingListId} 
        parentId={parentListId} 
      />
    </aside>
  );
}
