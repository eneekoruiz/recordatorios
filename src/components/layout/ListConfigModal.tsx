import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';

interface ListConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  listId?: string; // If undefined, it creates a new list
  parentId?: string; // If provided, creates a sub-list
}

const COLORS = [
  // IOS Default & Primaries
  '#0a84ff', '#30d158', '#ff9f0a', '#ff375f', '#bf5af2', '#ffd60a', '#5e5ce6', '#8e8e93',
  // Pastels & Soft Tones
  '#A2D2FF', '#BDE0FE', '#FFAFCC', '#FFC8DD', '#CDB4DB', '#F4A261', '#E9C46A', '#2A9D8F',
  // Darks & Muted
  '#264653', '#1D3557', '#457B9D', '#E63946', '#6D6875', '#B5838D', '#E5989B', '#4A4E69'
];

import { 
  ShoppingCart, Briefcase, Heart, Book, Coffee, CheckSquare, Plane, Music, Video, Zap, Home,
  Gamepad2, Dumbbell, Palette, GraduationCap, Code, Scissors, Camera, Utensils, Droplets, Flame, Sun, Moon,
  Star, Trophy, Car, Bike, Train, Ticket, Glasses, Headphones, Watch, Shield, Key, Lock, Bell
} from 'lucide-react';

const ICONS: Record<string, any> = {
  'list': CheckSquare, 'cart': ShoppingCart, 'briefcase': Briefcase, 'heart': Heart, 'book': Book,
  'coffee': Coffee, 'plane': Plane, 'music': Music, 'video': Video, 'zap': Zap, 'home': Home,
  'gamepad': Gamepad2, 'dumbbell': Dumbbell, 'palette': Palette, 'cap': GraduationCap, 'code': Code,
  'scissors': Scissors, 'camera': Camera, 'food': Utensils, 'water': Droplets, 'fire': Flame, 'sun': Sun,
  'moon': Moon, 'star': Star, 'trophy': Trophy, 'car': Car, 'bike': Bike, 'train': Train, 'ticket': Ticket,
  'glasses': Glasses, 'headphones': Headphones, 'watch': Watch, 'shield': Shield, 'key': Key, 'lock': Lock, 'bell': Bell
};

export function ListConfigModal({ isOpen, onClose, listId, parentId }: ListConfigModalProps) {
  const lists = useAppStore(state => state.lists);
  const addList = useAppStore(state => state.addList);
  const updateList = useAppStore(state => state.updateList);
  
  const existingList = listId ? lists.find(l => l.id === listId) : null;
  
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [icon, setIcon] = useState('list');

  useEffect(() => {
    if (isOpen) {
      if (existingList) {
        setName(existingList.name);
        setColor(existingList.color);
        setIcon(existingList.icon || 'list');
      } else {
        setName('');
        setColor(COLORS[Math.floor(Math.random() * 8)]); // Random from first 8
        setIcon('list');
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
        icon
      });
    } else {
      const newId = name.trim().toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
      addList({
        id: newId,
        parentId,
        name: name.trim(),
        color,
        icon,
        isFinancial: false,
        showCompleted: false
      });
    }
    onClose();
  };

  return createPortal(
    <AnimatePresence>
      <div className="prompt-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
        <motion.div 
          className="prompt-modal"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={e => e.stopPropagation()}
          style={{ maxWidth: 500 }}
        >
          <div className="prompt-header">
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>{existingList ? 'Editar Lista' : 'Nueva Lista'}</h3>
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
              <span className="detail-label" style={{ display: 'block', marginBottom: 8, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Color</span>
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
              <span className="detail-label" style={{ display: 'block', marginBottom: 8, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Icono</span>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8, background: 'var(--bg-base)', padding: 16, borderRadius: 'var(--radius-lg)' }}>
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

            </div>
          
          <div className="prompt-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
            <button className="cancel-btn" onClick={onClose} style={{ padding: '10px 16px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer', margin: 0 }}>Cancelar</button>
            <button className="save-btn" onClick={handleSave} disabled={!name.trim()} style={{ padding: '10px 24px', background: 'var(--accent-primary)', border: 'none', borderRadius: 10, color: 'white', fontWeight: 600, cursor: (!name.trim()) ? 'not-allowed' : 'pointer', opacity: (!name.trim()) ? 0.5 : 1, margin: 0 }}>
              {existingList ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
