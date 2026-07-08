import { useState } from 'react';
import { Plus, BarChart2, DownloadCloud, Zap, ChevronDown, ChevronRight, Clock, CheckCircle, Flag, LayoutGrid, Check, Trash2, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';
import { usePromptStore } from '../../store/usePromptStore';
import { getCycleIcon } from '../../constants/icons';
import { ListConfigModal } from './ListConfigModal';
import './Layout.css';

interface SidebarProps {
  currentView: string;
  onSelectView: (view: string) => void;
}

function ListHierarchy({ lists, parentId = undefined, currentView, onSelectView, onAddSublist, depth = 0 }: any) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  
  const children = lists.filter((l: any) => l.parentId === parentId);
  if (children.length === 0) return null;

  return (
    <div style={{ marginLeft: depth > 0 ? 12 : 0, borderLeft: depth > 0 ? '1px solid var(--border-subtle)' : 'none', paddingLeft: depth > 0 ? 8 : 0 }}>
      {children.map((list: any) => {
        const hasChildren = lists.some((l: any) => l.parentId === list.id);
        const isExpanded = expanded[list.id];
        
        return (
          <div key={list.id}>
            <div 
              className={`category-item ${currentView === `list_${list.id}` ? 'active' : ''}`}
              style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              onClick={() => onSelectView(`list_${list.id}`)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {hasChildren && (
                  <div 
                    onClick={(e) => { e.stopPropagation(); setExpanded(prev => ({...prev, [list.id]: !prev[list.id]})); }}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  >
                    {isExpanded ? <ChevronDown size={14} color="var(--text-tertiary)" /> : <ChevronRight size={14} color="var(--text-tertiary)" />}
                  </div>
                )}
                {!hasChildren && <div style={{ width: 14 }} />}
                <div className="list-icon" style={{ backgroundColor: list.color, width: 10, height: 10 }}></div>
                <span style={{ color: currentView === `list_${list.id}` ? 'var(--text-primary)' : 'inherit', fontSize: '0.9rem', fontWeight: currentView === `list_${list.id}` ? 600 : 400 }}>{list.name}</span>
              </div>

              <div 
                className="add-sublist-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onAddSublist(list.id);
                  setExpanded(prev => ({...prev, [list.id]: true}));
                }}
                style={{ cursor: 'pointer', opacity: 0.5 }}
                title="Añadir sub-lista"
              >
                <Plus size={14} />
              </div>
            </div>
            
            {isExpanded && (
              <ListHierarchy lists={lists} parentId={list.id} currentView={currentView} onSelectView={onSelectView} onAddSublist={onAddSublist} depth={depth + 1} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Sidebar({ currentView, onSelectView }: SidebarProps) {
  const cycles = useAppStore(state => state.cycles);
  const lists = useAppStore(state => state.lists || []);
  const addList = useAppStore(state => state.addList);
  const smartListVisibility = useAppStore(state => state.smartListVisibility);
  const toggleSmartList = useAppStore(state => state.toggleSmartList);
  const tasks = useAppStore(state => state.tasks);
  
  const [isCyclesOpen, setIsCyclesOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const getTaskCount = (view: string) => {
    const allTasks = Object.values(tasks).filter(t => !t.deleted_at);
    const pendingTasks = allTasks.filter(t => t.status === 'pending');
    
    switch (view) {
      case 'smart_today':
        const today = new Date().toISOString().split('T')[0];
        return pendingTasks.filter(t => new Date(t.dueDate as string).toISOString().split('T')[0] === today).length;
      case 'smart_scheduled':
        return pendingTasks.filter(t => new Date(t.dueDate as string) > new Date()).length;
      case 'smart_all':
        return pendingTasks.length;
      case 'smart_flagged':
        return pendingTasks.filter(t => t.flagged).length;
      case 'smart_completed':
        return allTasks.filter(t => t.status === 'completed').length;
      default:
        return 0;
    }
  };

  const SMART_LISTS = [
    { id: 'smart_today', name: 'Hoy', icon: Calendar, color: 'var(--accent-blue)' },
    { id: 'smart_scheduled', name: 'Programado', icon: Calendar, color: 'var(--accent-red)' },
    { id: 'smart_all', name: 'Todos', icon: LayoutGrid, color: 'var(--text-secondary)' },
    { id: 'smart_flagged', name: 'Destacado', icon: Flag, color: 'var(--accent-orange)' },
    { id: 'smart_completed', name: 'Terminado', icon: CheckCircle, color: 'var(--text-tertiary)' },
  ];

  const [isListConfigOpen, setIsListConfigOpen] = useState(false);
  const [editingListId, setEditingListId] = useState<string | undefined>(undefined);
  const [parentListId, setParentListId] = useState<string | undefined>(undefined);

  const handleAddList = () => {
    setEditingListId(undefined);
    setParentListId(undefined);
    setIsListConfigOpen(true);
  };

  
  return (
    <aside className="sidebar">
      <div 
        className="user-profile" 
        onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
        style={{ cursor: 'pointer', position: 'relative' }}
      >
        <div className="avatar">E</div>
        <div className="user-info">
          <div className="user-name text-title" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            Eneko Ruiz <ChevronDown size={14} color="var(--text-tertiary)" />
          </div>
          <div className="user-email text-muted">Plan Élite</div>
        </div>

        <AnimatePresence>
          {isProfileMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                position: 'absolute',
                top: '100%',
                left: 12,
                right: 12,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 100,
                padding: 'var(--space-8)',
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}
              onClick={e => e.stopPropagation()}
            >
              <div className="section-header" style={{ padding: '4px 8px', marginBottom: 4 }}>Mi Espacio</div>
              <div 
                className="nav-item"
                onClick={() => { onSelectView('DATA'); setIsProfileMenuOpen(false); }}
                style={{ padding: '8px', fontSize: '0.9rem', color: 'var(--text-primary)' }}
              >
                <Zap size={16} color="var(--accent-primary)" />
                <span style={{ fontWeight: 500 }}>Brain Dump / Exportar</span>
              </div>
              <div 
                className={`nav-item ${currentView === 'ANALYTICS' ? 'active' : ''}`}
                onClick={() => { onSelectView('ANALYTICS'); setIsProfileMenuOpen(false); }}
                style={{ padding: '8px', fontSize: '0.9rem', color: 'var(--text-primary)' }}
              >
                <BarChart2 size={16} />
                <span style={{ fontWeight: 500 }}>Estadísticas</span>
              </div>
              <div 
                className={`nav-item ${currentView === 'TRASH' ? 'active' : ''}`}
                onClick={() => { onSelectView('TRASH'); setIsProfileMenuOpen(false); }}
                style={{ padding: '8px', fontSize: '0.9rem', color: currentView === 'TRASH' ? 'var(--accent-red)' : 'var(--text-tertiary)' }}
              >
                <Trash2 size={16} />
                <span>Papelera Eliminados</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="search-bar">
        <input type="text" placeholder="Buscar" />
      </div>

      <div className="smart-lists-nav" style={{ flex: 1, overflowY: 'auto' }}>
        
        {/* Smart Lists Grid */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 var(--space-12)', marginBottom: 'var(--space-8)' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>LISTAS INTELIGENTES</span>
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
                  opacity: isEditMode && !smartListVisibility[list.id] ? 0.5 : 1
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

        {/* --- MIS LISTAS (PRIORIDAD PRINCIPAL) --- */}
        <div className="categories-section" style={{ marginTop: 'var(--space-16)', flexShrink: 0 }}>
          <div className="section-header" style={{ padding: '0 var(--space-12)' }}>Mis Listas</div>
          <ListHierarchy 
            lists={lists} 
            currentView={currentView} 
            onSelectView={onSelectView} 
            onAddSublist={(pId: string) => { setEditingListId(undefined); setParentListId(pId); setIsListConfigOpen(true); }} 
          />
          <button 
            className="add-list-btn" 
            onClick={handleAddList} 
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--text-secondary)', 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8, 
              padding: 'var(--space-8) var(--space-12)',
              marginTop: 'var(--space-8)',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            <Plus size={16} />
            Nueva Lista Raíz
          </button>
        </div>

        {/* --- VISTAS TEMPORALES (ACORDEÓN RESTAURADO) --- */}
        <div style={{ marginTop: 'var(--space-16)' }}>
          <div className="section-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-8) var(--space-12)' }}>
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', cursor: 'pointer', flex: 1 }}
              onClick={() => setIsCyclesOpen(!isCyclesOpen)}
            >
              <Clock size={16} />
              <span style={{ fontSize: '0.85rem', letterSpacing: '0.5px' }}>CICLOS TEMPORALES</span>
              {isCyclesOpen ? <ChevronDown size={14} color="var(--text-tertiary)" /> : <ChevronRight size={14} color="var(--text-tertiary)" />}
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
                  const daysValue = parseInt(daysStr || '14', 10);
                  const newCycleId = `cycle_${Date.now()}`;
                  useAppStore.getState().addCycle({
                    id: newCycleId,
                    name,
                    daysValue: isNaN(daysValue) || daysValue <= 0 ? 14 : daysValue,
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

          {isCyclesOpen && (
            <div style={{ paddingLeft: 'var(--space-12)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-12)' }}>
              {cycles.filter(c => c.isPinned).map(cycle => {
                const Icon = getCycleIcon(cycle.icon);
                return (
                  <div 
                    key={cycle.id}
                    className={`nav-item ${currentView === cycle.id ? 'active' : ''}`}
                    onClick={() => onSelectView(cycle.id)}
                    style={{ padding: 'var(--space-8) var(--space-12)', fontSize: '0.9rem', color: currentView === cycle.id ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: currentView === cycle.id ? 600 : 400 }}
                  >
                    <Icon size={16} color={currentView === cycle.id ? 'var(--accent-primary)' : 'var(--text-tertiary)'} />
                    <span>{cycle.name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      <ListConfigModal 
        isOpen={isListConfigOpen} 
        onClose={() => setIsListConfigOpen(false)} 
        listId={editingListId} 
        parentId={parentListId} 
      />
    </aside>
  );
}
