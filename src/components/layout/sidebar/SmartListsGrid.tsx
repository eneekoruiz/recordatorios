import React from 'react';
import { motion } from 'framer-motion';
import { Pin, Check } from 'lucide-react';
import { SMART_LISTS } from '../../../constants/smartLists';

interface SmartListsGridProps {
  smartListVisibility: Record<string, boolean>;
  pinnedSmartLists: string[];
  isEditMode: boolean;
  setIsEditMode: (val: boolean) => void;
  currentView: string;
  onSelectView: (view: string) => void;
  toggleSmartList: (id: string) => void;
  togglePinSmartList: (id: string) => void;
  getTaskCount: (id: string) => number;
}

export const SmartListsGrid: React.FC<SmartListsGridProps> = ({
  smartListVisibility,
  pinnedSmartLists,
  isEditMode,
  setIsEditMode,
  currentView,
  onSelectView,
  toggleSmartList,
  togglePinSmartList,
  getTaskCount
}) => {
  const availableGridLists = SMART_LISTS.filter(list => {
    if (pinnedSmartLists.includes(list.id)) return false;
    if (list.id === 'smart_primeros_pasos' && getTaskCount('smart_primeros_pasos') === 0 && !isEditMode) return false;
    return smartListVisibility[list.id] || isEditMode;
  });

  return (
    <div>
      {/* SMART LISTS GRID HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px', marginBottom: 6 }}>
        <span className="section-header" style={{ margin: 0, padding: 0, fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '-0.01em' }}>Listas inteligentes</span>
        <button 
          type="button"
          onClick={() => setIsEditMode(!isEditMode)}
          style={{ background: 'transparent', border: 'none', color: isEditMode ? 'var(--accent-primary)' : 'var(--text-tertiary)', fontSize: '0.88rem', fontWeight: 500, cursor: 'pointer' }}
        >
          {isEditMode ? 'Hecho' : 'Editar'}
        </button>
      </div>

      {/* SMART LISTS GRID CONTENT */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', 
        gap: 12, 
        padding: '0 16px',
        marginBottom: 4
      }}>
        {availableGridLists.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-16) 0', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
            No tienes listas inteligentes seleccionadas
          </div>
        ) : (
          availableGridLists.map(list => {
            if (!smartListVisibility[list.id] && !isEditMode) return null;
            const Icon = list.icon;
            const isActive = currentView === list.id;
          
            return (
              <motion.div 
                key={list.id}
                layoutId={"smart-card-" + list.id}
                className={`ios-smart-card ${isActive ? 'is-active' : ''}`}
                onClick={() => {
                  if (isEditMode) {
                    toggleSmartList(list.id);
                  } else {
                    onSelectView(list.id);
                  }
                }}
                style={{
                  background: isActive 
                    ? 'color-mix(in srgb, var(--accent-primary) 8%, var(--bg-elevated))' 
                    : 'var(--bg-elevated)',
                  border: isActive 
                    ? '1.5px solid var(--accent-primary)' 
                    : '1px solid var(--border-subtle)',
                  boxShadow: isActive 
                    ? '0 4px 16px rgba(0, 122, 255, 0.16)' 
                    : '0 1px 3px rgba(0, 0, 0, 0.04)',
                  opacity: isEditMode && !smartListVisibility[list.id] ? 0.5 : 1,
                  transition: 'all 180ms cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                {isEditMode && (
                  <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePinSmartList(list.id);
                      }}
                      style={{
                        background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                        borderRadius: '50%', width: 22, height: 22,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: 'var(--accent-orange)'
                      }}
                      title="Anclar arriba"
                    >
                      <Pin size={12} />
                    </button>
                    <div style={{ 
                      width: 20, height: 20, borderRadius: '50%', 
                      border: smartListVisibility[list.id] ? 'none' : '1px solid var(--border-focus)',
                      background: smartListVisibility[list.id] ? 'var(--accent-primary)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: smartListVisibility[list.id] ? '0 0 10px var(--accent-glow)' : 'none'
                    }}>
                      {smartListVisibility[list.id] && <Check size={12} color="white" />}
                    </div>
                  </div>
                )}
                <motion.div 
                  layoutId={"smart-icon-" + list.id} 
                  className="icon-circle" 
                  style={{
                    backgroundColor: list.color,
                    boxShadow: `0 2px 8px color-mix(in srgb, ${list.color} 36%, transparent)`,
                    border: 'none',
                    transition: 'all 150ms ease'
                  }}
                >
                  <Icon size={20} color="white" />
                </motion.div>
                {!isEditMode && (
                  <span 
                    className="count" 
                    style={{ 
                      fontSize: getTaskCount(list.id) >= 100 ? '1.65rem' : getTaskCount(list.id) >= 10 ? '1.95rem' : '2.25rem',
                      color: 'var(--text-primary)',
                      transition: 'color 150ms ease'
                    }}
                  >
                    {getTaskCount(list.id)}
                  </span>
                )}
                <h3 style={{ 
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)', 
                  fontWeight: 600,
                  fontSize: '0.96rem',
                  letterSpacing: '-0.01em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%',
                  paddingRight: 4,
                  margin: 0,
                  marginTop: 12,
                  lineHeight: 1.25,
                  transition: 'color 150ms ease'
                }}>
                  {list.name}
                </h3>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};
