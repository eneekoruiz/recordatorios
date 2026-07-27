import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';

interface ListConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  listId?: string; // If undefined, it creates a new list
  parentId?: string; // If provided, creates a sub-list
  defaultIsFolder?: boolean;
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
  Star, Trophy, Car, Bike, Train, Ticket, Glasses, Headphones, Watch, Shield, Key, Lock, Bell, Check, Folder, FolderOpen
} from 'lucide-react';

const ICONS: Record<string, any> = {
  'list': CheckSquare, 'folder': Folder, 'folder-open': FolderOpen, 'cart': ShoppingCart, 'briefcase': Briefcase, 'heart': Heart, 'book': Book,
  'coffee': Coffee, 'plane': Plane, 'music': Music, 'video': Video, 'zap': Zap, 'home': Home,
  'gamepad': Gamepad2, 'dumbbell': Dumbbell, 'palette': Palette, 'cap': GraduationCap, 'code': Code,
  'scissors': Scissors, 'camera': Camera, 'food': Utensils, 'water': Droplets, 'fire': Flame, 'sun': Sun,
  'moon': Moon, 'star': Star, 'trophy': Trophy, 'car': Car, 'bike': Bike, 'train': Train, 'ticket': Ticket,
  'glasses': Glasses, 'headphones': Headphones, 'watch': Watch, 'shield': Shield, 'key': Key, 'lock': Lock, 'bell': Bell
};

export function ListConfigModal({ isOpen, onClose, listId, parentId, defaultIsFolder }: ListConfigModalProps) {
  const lists = useAppStore(state => state.lists);
  const addList = useAppStore(state => state.addList);
  const updateList = useAppStore(state => state.updateList);
  
  const existingList = listId ? lists.find(l => l.id === listId) : null;
  
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [icon, setIcon] = useState('list');
  const [isFocused, setIsFocused] = useState(false);
  const [isFolder, setIsFolder] = useState(defaultIsFolder || false);
  const [showAllColors, setShowAllColors] = useState(false);
  const [showAllIcons, setShowAllIcons] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (existingList) {
        setName(existingList.name);
        setColor(existingList.color);
        const initialIcon = existingList.icon || (existingList.isFolder ? 'folder' : 'list');
        setIcon(initialIcon);
        setIsFolder(!!existingList.isFolder);
        setShowAllColors(!COLORS.slice(0, 8).includes(existingList.color));
        setShowAllIcons(!Object.keys(ICONS).slice(0, 12).includes(initialIcon));
      } else {
        setName('');
        const initialColor = COLORS[Math.floor(Math.random() * 8)];
        setColor(initialColor); // Random from first 8
        const initialIcon = defaultIsFolder ? 'folder' : 'list';
        setIcon(initialIcon);
        setIsFolder(!!defaultIsFolder);
        setShowAllColors(false);
        setShowAllIcons(false);
      }
    }
  }, [isOpen, existingList, defaultIsFolder]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!name.trim()) return;
    
    if (existingList) {
      updateList(existingList.id, {
        name: name.trim(),
        color,
        icon,
        isFolder
      });
      window.dispatchEvent(new CustomEvent('show-toast', { detail: `${isFolder ? 'Carpeta' : 'Lista'} "${name.trim()}" actualizada` }));
    } else {
      const newId = name.trim().toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
      addList({
        id: newId,
        parentId,
        name: name.trim(),
        color,
        icon: isFolder && icon === 'list' ? 'folder' : icon,
        isFinancial: false,
        showCompleted: false,
        isFolder
      });
      window.dispatchEvent(new CustomEvent('show-toast', { detail: parentId ? `${isFolder ? 'Subcarpeta' : 'Lista anidada'} "${name.trim()}" creada con éxito` : `${isFolder ? 'Carpeta' : 'Lista'} "${name.trim()}" creada con éxito` }));
    }
    onClose();
  };

  return createPortal(
    <AnimatePresence>
      <div className="prompt-overlay list-config-overlay" onClick={onClose} style={{ zIndex: 100000, position: 'fixed', inset: 0 }}>
        <motion.div 
          className="list-config-modal"
          initial={{ opacity: 0, scale: 0.95, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 30 }}
          transition={{ type: 'spring', damping: 28, stiffness: 380 }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              {existingList ? (existingList.isFolder ? 'Editar Carpeta' : 'Editar Lista') : (isFolder ? 'Nueva Carpeta' : (parentId ? 'Nueva Lista Anidada' : 'Nueva Lista'))}
            </h3>
            <button 
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.08)',
                border: 'none', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.16)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
              aria-label="Cerrar modal"
            >
              ✕
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Header Preview */}
            <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 8px' }}>
              <motion.div 
                animate={{ backgroundColor: color, boxShadow: `0 12px 32px ${color}55, inset 0 2px 4px rgba(255,255,255,0.4)` }}
                transition={{ duration: 0.2 }}
                style={{
                  width: 76, 
                  height: 76, 
                  borderRadius: '50%', 
                  background: color,
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  boxShadow: `0 12px 32px ${color}55, inset 0 2px 4px rgba(255,255,255,0.4)`
                }}
              >
                {(() => {
                  const IconComp = ICONS[icon] || CheckSquare;
                  return <IconComp size={36} color="white" />;
                })()}
              </motion.div>
            </div>

            {/* Title Input */}
            <div style={{ width: '100%' }}>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder={isFolder ? "Nombre de la carpeta" : "Nombre de la lista"} 
                autoFocus
                style={{
                  background: isFocused ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.06)',
                  border: isFocused ? `1px solid ${color}` : '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 16,
                  padding: '14px 18px',
                  fontSize: '1.2rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  textAlign: 'center',
                  width: '100%',
                  outline: 'none',
                  boxShadow: isFocused ? `0 0 0 4px ${color}33, 0 8px 20px rgba(0,0,0,0.2)` : 'none',
                  transition: 'all 0.2s ease'
                }}
              />
            </div>

            {/* Is Folder Switch */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              background: 'rgba(255,255,255,0.04)', 
              border: '1px solid rgba(255,255,255,0.08)', 
              borderRadius: 14, 
              padding: '12px 16px',
              cursor: 'pointer'
            }}
            onClick={() => {
              const next = !isFolder;
              setIsFolder(next);
              if (next && icon === 'list') setIcon('folder');
              if (!next && (icon === 'folder' || icon === 'folder-open')) setIcon('list');
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Folder size={20} color={isFolder ? color : 'var(--text-secondary)'} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>Es una carpeta</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Agrupa listas y subcarpetas sin contener tareas directamente</span>
                </div>
              </div>
              <div style={{
                width: 44, height: 26, borderRadius: 13,
                background: isFolder ? color : 'rgba(255,255,255,0.15)',
                position: 'relative', transition: 'background-color 0.2s ease', flexShrink: 0
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', background: '#ffffff',
                  position: 'absolute', top: 2, left: isFolder ? 20 : 2,
                  transition: 'left 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }} />
              </div>
            </div>

            {/* Colors */}
            <div>
              <span style={{ display: 'block', marginBottom: 10, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>Color</span>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                {(showAllColors ? COLORS : COLORS.slice(0, 8)).map(c => {
                  const isSelected = color === c;
                  return (
                    <button 
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      style={{
                        width: 38, 
                        height: 38, 
                        borderRadius: '50%', 
                        background: c, 
                        border: isSelected ? '2px solid white' : '2px solid transparent',
                        outline: isSelected ? `2px solid ${c}` : 'none',
                        outlineOffset: 2, 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: isSelected ? `0 4px 12px ${c}66` : '0 2px 6px rgba(0,0,0,0.15)',
                        transition: 'all 0.15s ease',
                        transform: isSelected ? 'scale(1.08)' : 'scale(1)'
                      }}
                    >
                      {isSelected && <Check size={18} color="white" strokeWidth={3} style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }} />}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowAllColors(!showAllColors)}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: 'var(--accent-primary)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '6px 14px',
                    borderRadius: '16px',
                    transition: 'all 0.15s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(10, 132, 255, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(10, 132, 255, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                  }}
                >
                  {showAllColors ? 'Ver menos' : `Ver más (${COLORS.length - 8} más)`}
                </button>
              </div>
            </div>

            {/* Icons */}
            <div>
              <span style={{ display: 'block', marginBottom: 10, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>Icono</span>
              <div style={{ 
                background: 'rgba(255,255,255,0.03)', 
                border: '1px solid rgba(255,255,255,0.08)', 
                borderRadius: 20, 
                padding: 16, 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))', 
                gap: 10, 
                maxHeight: showAllIcons ? 220 : 'auto', 
                overflowY: showAllIcons ? 'auto' : 'visible',
                scrollbarWidth: 'thin',
                transition: 'max-height 0.25s ease'
              }}>
                {(showAllIcons ? Object.keys(ICONS) : Object.keys(ICONS).slice(0, 12)).map(k => {
                  const IconComp = ICONS[k];
                  const isActive = icon === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setIcon(k)}
                      style={{
                        width: 44, 
                        height: 44, 
                        borderRadius: '50%',
                        background: isActive ? color : 'rgba(255,255,255,0.05)',
                        border: isActive ? `1px solid rgba(255,255,255,0.3)` : '1px solid transparent', 
                        cursor: 'pointer',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        boxShadow: isActive ? `0 4px 12px ${color}50` : 'none',
                        transition: 'all 0.15s ease',
                        transform: isActive ? 'scale(1.05)' : 'scale(1)'
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                      }}
                    >
                      <IconComp size={22} color={isActive ? 'white' : 'var(--text-secondary)'} />
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowAllIcons(!showAllIcons)}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: 'var(--accent-primary)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '6px 14px',
                    borderRadius: '16px',
                    transition: 'all 0.15s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(10, 132, 255, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(10, 132, 255, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                  }}
                >
                  {showAllIcons ? 'Ver menos' : `Ver más (${Object.keys(ICONS).length - 12} más)`}
                </button>
              </div>
            </div>

          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 'auto', paddingTop: 8 }}>
            <button 
              onClick={onClose} 
              style={{ 
                padding: '12px 20px', 
                background: 'rgba(255,255,255,0.08)', 
                border: '1px solid rgba(255,255,255,0.12)', 
                borderRadius: 14,
                color: 'var(--text-primary)', 
                fontWeight: 600, 
                fontSize: '0.95rem',
                cursor: 'pointer', 
                transition: 'all 0.15s ease',
                margin: 0
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.14)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            >
              Cancelar
            </button>
            <button 
              onClick={handleSave} 
              disabled={!name.trim()} 
              style={{ 
                padding: '12px 28px', 
                background: name.trim() ? color : 'rgba(255,255,255,0.1)', 
                border: 'none', 
                borderRadius: 14, 
                color: name.trim() ? 'white' : 'var(--text-tertiary)', 
                fontWeight: 650, 
                fontSize: '0.95rem',
                cursor: (!name.trim()) ? 'not-allowed' : 'pointer', 
                opacity: (!name.trim()) ? 0.5 : 1, 
                boxShadow: name.trim() ? `0 4px 16px ${color}50` : 'none',
                transition: 'all 0.2s ease',
                transform: name.trim() ? 'scale(1)' : 'none',
                margin: 0
              }}
              onMouseEnter={(e) => {
                if (name.trim()) e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                if (name.trim()) e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {existingList ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
