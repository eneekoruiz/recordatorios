import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Briefcase, Heart, Book, Coffee, CheckSquare, Plane, Music, Video, Zap, Home } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface ListConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  listId?: string; // If undefined, it creates a new list
  parentId?: string; // If provided, creates a sub-list
}

const COLORS = [
  '#0a84ff', // Blue
  '#30d158', // Green
  '#ff9f0a', // Orange
  '#ff375f', // Red
  '#bf5af2', // Purple
  '#ffd60a', // Yellow
  '#5e5ce6', // Indigo
  '#8e8e93', // Gray
];

const ICONS: Record<string, any> = {
  'list': CheckSquare,
  'cart': ShoppingCart,
  'briefcase': Briefcase,
  'heart': Heart,
  'book': Book,
  'coffee': Coffee,
  'plane': Plane,
  'music': Music,
  'video': Video,
  'zap': Zap,
  'home': Home
};

export function ListConfigModal({ isOpen, onClose, listId, parentId }: ListConfigModalProps) {
  const lists = useAppStore(state => state.lists);
  const addList = useAppStore(state => state.addList);
  const updateList = useAppStore(state => state.updateList);
  
  const existingList = listId ? lists.find(l => l.id === listId) : null;
  
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [icon, setIcon] = useState('list');
  const [isFinancial, setIsFinancial] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (existingList) {
        setName(existingList.name);
        setColor(existingList.color);
        setIcon(existingList.icon || 'list');
        setIsFinancial(!!existingList.isFinancial);
      } else {
        setName('');
        setColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
        setIcon('list');
        setIsFinancial(false);
      }
    }
  }, [isOpen, existingList]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!name.trim()) return;
    
    if (existingList) {
      updateList(existingList.id, {
        name: name.trim(),
        color,
        icon,
        isFinancial
      });
    } else {
      const newId = name.trim().toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
      addList({
        id: newId,
        parentId,
        name: name.trim(),
        color,
        icon,
        isFinancial
      });
    }
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="prompt-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
        <motion.div 
          className="prompt-modal"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={e => e.stopPropagation()}
        >
          <div className="prompt-header">
            <h3>{existingList ? 'Editar Lista' : 'Nueva Lista'}</h3>
          </div>
          
          <div className="prompt-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-24)' }}>
            
            {/* Header Preview */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-8)' }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%', background: color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 8px 24px ${color}40`
              }}>
                {(() => {
                  const IconComp = ICONS[icon] || CheckSquare;
                  return <IconComp size={40} color="white" />;
                })()}
              </div>
            </div>

            <div className="input-group">
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)}
                placeholder="Nombre de la lista" 
                autoFocus
                className="title-input"
                style={{ textAlign: 'center', fontSize: '1.25rem', padding: '12px' }}
              />
            </div>

            {/* Colors */}
            <div>
              <span className="detail-label">Color</span>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
                {COLORS.map(c => (
                  <button 
                    key={c}
                    onClick={() => setColor(c)}
                    style={{
                      width: 36, height: 36, borderRadius: '50%', background: c, border: 'none',
                      outline: color === c ? '3px solid var(--border-focus)' : 'none',
                      outlineOffset: 2, cursor: 'pointer'
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Icons */}
            <div>
              <span className="detail-label">Icono</span>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8, background: 'var(--bg-surface)', padding: 16, borderRadius: 'var(--radius-lg)' }}>
                {Object.keys(ICONS).map(k => {
                  const IconComp = ICONS[k];
                  return (
                    <button
                      key={k}
                      onClick={() => setIcon(k)}
                      style={{
                        width: 44, height: 44, borderRadius: '50%',
                        background: icon === k ? 'var(--border-focus)' : 'transparent',
                        border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                      <IconComp size={20} color={icon === k ? 'white' : 'var(--text-secondary)'} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Financial Mode */}
            <div className="detail-row" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-lg)' }}>
              <div>
                <span style={{ fontWeight: 600, display: 'block', color: 'var(--text-primary)' }}>Modo Financiero</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Habilita campos de coste en esta lista</span>
              </div>
              <label className="switch">
                <input type="checkbox" checked={isFinancial} onChange={e => setIsFinancial(e.target.checked)} />
                <span className="slider round"></span>
              </label>
            </div>

          </div>
          
          <div className="prompt-footer">
            <button className="cancel-btn" onClick={onClose}>Cancelar</button>
            <button className="save-btn" onClick={handleSave} disabled={!name.trim()}>
              {existingList ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
