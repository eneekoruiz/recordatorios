import { useState } from 'react';
import { Plus, BarChart2, Settings, DownloadCloud, Zap, ChevronDown, ChevronRight, Sun, Calendar, Moon, Globe, Rocket, Flame, Sparkles, Star, Circle, Clock } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import './Layout.css';

interface SidebarProps {
  currentView: string;
  onSelectView: (view: string) => void;
}

export function Sidebar({ currentView, onSelectView }: SidebarProps) {
  const cycles = useAppStore(state => state.cycles);
  const lists = useAppStore(state => state.lists || []);
  const addList = useAppStore(state => state.addList);
  const [isCyclesOpen, setIsCyclesOpen] = useState(false);

  const handleAddList = () => {
    const name = prompt('Nombre de la nueva lista:');
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
