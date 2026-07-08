import { useState } from 'react';
import { Plus, BarChart2, Settings, DownloadCloud, Zap, ChevronDown, ChevronRight, Sun, Calendar, Moon, Globe, Rocket, Flame, Sparkles, Star, Circle, Clock, CheckCircle, Flag, LayoutGrid, Check } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { usePromptStore } from '../../store/usePromptStore';
import './Layout.css';

interface SidebarProps {
  currentView: string;
  onSelectView: (view: string) => void;
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

  const getTaskCount = (view: string) => {
    const allTasks = Object.values(tasks).filter(t => !t.is_deleted);
    const pendingTasks = allTasks.filter(t => t.status === 'PENDING');
    
    switch (view) {
      case 'smart_today':
        const today = new Date().toISOString().split('T')[0];
        return pendingTasks.filter(t => new Date(t.dueDate).toISOString().split('T')[0] === today).length;
      case 'smart_scheduled':
        return pendingTasks.filter(t => new Date(t.dueDate) > new Date()).length;
      case 'smart_all':
        return pendingTasks.length;
      case 'smart_flagged':
        return pendingTasks.filter(t => t.flagged).length;
      case 'smart_completed':
        return allTasks.filter(t => t.status === 'COMPLETED').length;
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

  const handleAddList = async () => {
    const name = await usePromptStore.getState().openPrompt('Nombre de la nueva lista:', 'Ej: Tareas del Hogar');
    if (!name) return;
    const colors = ['#ff9500', '#34c759', '#af52de', '#0a84ff', '#ff2d55'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const id = name.toLowerCase().replace(/\s+/g, '-');
    addList({ id, name, color: randomColor });
    onSelectView(`list_${id}`);
  };

  const IconMap: Record<string, any> = {
    'sun': Sun, 'calendar': Calendar, 'moon': Moon, 'globe': Globe,
    'rocket': Rocket, 'flame': Flame, 'sparkles': Sparkles, 'star': Star, 'circle': Circle
  };
  
  return (
    <aside className="sidebar">
      <div className="user-profile">
        <div className="avatar">E</div>
        <div className="user-info">
          <div className="user-name text-title">Eneko Ruiz</div>
          <div className="user-email text-muted">Plan Élite</div>
        </div>
      </div>

      <div className="search-bar">
        <input type="text" placeholder="Buscar" />
      </div>

      <div className="smart-lists-nav">
        
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

        {/* Acordeón de Ciclos */}
        <div className="section-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: 'var(--space-8) var(--space-12)' }} onClick={() => setIsCyclesOpen(!isCyclesOpen)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
            <Clock size={16} />
            <span style={{ fontSize: '0.85rem', letterSpacing: '0.5px' }}>VISTAS TEMPORALES</span>
          </div>
          {isCyclesOpen ? <ChevronDown size={16} color="var(--text-tertiary)" /> : <ChevronRight size={16} color="var(--text-tertiary)" />}
        </div>

        {isCyclesOpen && (
          <div style={{ paddingLeft: 'var(--space-12)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-12)' }}>
            {cycles.filter(c => c.isPinned).map(cycle => {
              const Icon = IconMap[cycle.icon] || Circle;
              return (
                <div 
                  key={cycle.id}
                  className={`nav-item ${currentView === cycle.id ? 'active' : ''}`}
                  onClick={() => onSelectView(cycle.id)}
                  style={{ padding: 'var(--space-8) var(--space-12)', fontSize: '0.9rem', color: currentView === cycle.id ? 'white' : 'var(--text-secondary)' }}
                >
                  <Icon size={16} color={currentView === cycle.id ? 'white' : 'var(--text-tertiary)'} />
                  <span>{cycle.name}</span>
                </div>
              );
            })}
          </div>
        )}

        <div 
          className={`nav-item ${currentView === 'ANALYTICS' ? 'active' : ''}`}
          onClick={() => onSelectView('ANALYTICS')}
          style={{ marginTop: 'var(--space-12)' }}
        >
          <BarChart2 size={18} />
          <span>Estadísticas</span>
        </div>
        
        <div 
          className="nav-item"
          onClick={() => onSelectView('MANAGE_CYCLES')}
          style={{ color: 'var(--text-tertiary)' }}
        >
          <Settings size={18} />
          <span>Gestionar Ciclos</span>
        </div>
        
        <div 
          className="nav-item"
          onClick={() => onSelectView('DATA')}
          style={{ color: 'var(--text-tertiary)' }}
        >
          <DownloadCloud size={18} />
          <span>Importar / Exportar</span>
        </div>

        <div 
          className="nav-item"
          onClick={() => onSelectView('BRAIN_DUMP')}
          style={{ color: 'var(--accent-glow)' }}
        >
          <Zap size={18} color="var(--accent-primary)" />
          <span style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>Brain Dump</span>
        </div>
      </div>

      <div className="categories-section">
        <div className="section-header">Mis Listas</div>
        {lists.map(list => (
          <div 
            key={list.id} 
            className={`category-item ${currentView === `list_${list.id}` ? 'active' : ''}`}
            onClick={() => onSelectView(`list_${list.id}`)}
          >
            <div className="list-icon" style={{ backgroundColor: list.color }}></div>
            <span style={{ color: currentView === `list_${list.id}` ? 'white' : 'inherit' }}>{list.name}</span>
          </div>
        ))}
      </div>

      <button className="add-list-btn" onClick={handleAddList}>
        <Plus size={18} />
        Añadir Lista
      </button>
    </aside>
  );
}
