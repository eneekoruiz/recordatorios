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

import { LIST_AVAILABLE_COLORS, isReservedFrequencyColor } from '../../constants/colors';
import { LIST_ICON_MAP as ICONS, getSuggestedListIconAndColor } from '../../constants/icons';
import { CheckSquare, Folder, Check, X, CreditCard, BookOpen, Sparkles, Calendar, Target, Clock } from 'lucide-react';

const COLORS = LIST_AVAILABLE_COLORS;

import { 
  isCaducidadesList, 
  isLimpiezaList, 
  ensureCaducidadesSections, 
  isRoutineList,
  getListType,
  LIST_TYPE_CONFIG
} from '../../utils/specialLists';
import type { ListType } from '../../models/Task';

export function ListConfigModal({ isOpen, onClose, listId, parentId, defaultIsFolder }: ListConfigModalProps) {
  const lists = useAppStore(state => state.lists);
  const addList = useAppStore(state => state.addList);
  const updateList = useAppStore(state => state.updateList);
  const addListSection = useAppStore(state => state.addListSection);
  const listSections = useAppStore(state => state.listSections);
  
  const existingList = listId ? lists.find(l => l.id === listId) : null;
  
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(COLORS[0]);
  const [icon, setIcon] = useState('list');
  const [isFocused, setIsFocused] = useState(false);
  const [isFolder, setIsFolder] = useState(defaultIsFolder || false);
  const [listType, setListType] = useState<ListType>('simple');
  const [autoEstimateDuration, setAutoEstimateDuration] = useState<boolean>(true);
  const [showAllColors, setShowAllColors] = useState(false);
  const [showAllIcons, setShowAllIcons] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (existingList) {
        setName(existingList.name);
        const cleanColor = isReservedFrequencyColor(existingList.color)
          ? COLORS[0]
          : (existingList.color || COLORS[0]);
        setColor(cleanColor);
        const initialIcon = existingList.icon || (existingList.isFolder ? 'folder' : 'list');
        setIcon(initialIcon);
        setIsFolder(!!existingList.isFolder);
        setListType(getListType(existingList, existingList.id));
        setAutoEstimateDuration(existingList.autoEstimateDuration !== false);
        setShowAllColors(!(COLORS.slice(0, 8) as readonly string[]).includes(cleanColor));
        setShowAllIcons(!Object.keys(ICONS).slice(0, 12).includes(initialIcon));
      } else {
        setName('');
        const initialColor = COLORS[Math.floor(Math.random() * 8)];
        setColor(initialColor); // Random from first 8
        const initialIcon = defaultIsFolder ? 'folder' : 'list';
        setIcon(initialIcon);
        setIsFolder(!!defaultIsFolder);
        setListType('simple');
        setAutoEstimateDuration(true);
        setShowAllColors(false);
        setShowAllIcons(false);
      }
    }
  }, [isOpen, existingList, defaultIsFolder]);

  if (!isOpen) return null;

  const handleNameChange = (val: string) => {
    setName(val);
    if (!existingList && !isFolder) {
      const suggested = getSuggestedListIconAndColor(val);
      if (suggested) {
        setIcon(suggested.icon);
        setColor(suggested.color);
      }
      if (/caduca|suscrip|vencimiento/i.test(val)) {
        setListType('caducidades');
      } else if (/qu[eé]\s*he\s*hecho|bitacora|vivencia/i.test(val)) {
        setListType('que_he_hecho');
      } else if (/evento|cita|cumple|aniversario|boda|fiesta|reunion/i.test(val)) {
        setListType('events');
      } else if (/prop[oó]sito|meta|objetivo|resoluci[oó]n|sue[nñ]o|deseo/i.test(val)) {
        setListType('goals');
      } else if (/limpieza|quehacer|rutina|care|cuidado|mantenimiento/i.test(val)) {
        setListType('routines');
      }
    }
  };

  const handleSave = () => {
    if (!name.trim()) return;
    
    const resolvedSpecialType: 'caducidades' | 'que_he_hecho' | undefined = 
      listType === 'caducidades' ? 'caducidades' : (listType === 'que_he_hecho' ? 'que_he_hecho' : undefined);

    if (existingList) {
      updateList(existingList.id, {
        name: name.trim(),
        color,
        icon,
        isFolder,
        listType,
        specialType: resolvedSpecialType,
        autoEstimateDuration: !isFolder ? autoEstimateDuration : undefined
      });
      if (listType === 'caducidades' || isCaducidadesList(existingList.id, { ...existingList, name: name.trim(), listType, specialType: resolvedSpecialType })) {
        ensureCaducidadesSections(existingList.id, listSections, addListSection);
      }
      if (isRoutineList(existingList.id, { ...existingList, name: name.trim(), listType }) || isLimpiezaList(existingList.id, { ...existingList, name: name.trim() })) {
        
      }
      window.dispatchEvent(new CustomEvent('show-toast', { detail: `${isFolder ? 'Carpeta' : 'Lista'} "${name.trim()}" actualizada` }));
    } else {
      const newId = name.trim().toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
      const listData = {
        id: newId,
        parentId,
        name: name.trim(),
        color,
        icon: isFolder && icon === 'list' ? 'folder' : icon,
        isFinancial: listType === 'caducidades',
        showCompleted: false,
        isFolder,
        listType,
        specialType: resolvedSpecialType,
        autoEstimateDuration: !isFolder ? autoEstimateDuration : undefined
      };
      addList(listData);
      if (listType === 'caducidades' || isCaducidadesList(newId, listData)) {
        ensureCaducidadesSections(newId, listSections, addListSection);
      }
      if (isRoutineList(newId, listData) || isLimpiezaList(newId, listData)) {
        
      }
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
              <X size={16} strokeWidth={2.4} />
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
                onChange={e => handleNameChange(e.target.value)}
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

            {/* Selector de Tipo de Lista (6 tipos: simple, rutinas, eventos, propósitos, caducidades, qué he hecho) */}
            {!isFolder && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Tipo de Lista
                  </span>
                  <span style={{ 
                    fontSize: '0.72rem', 
                    fontWeight: 600, 
                    color: LIST_TYPE_CONFIG[listType].supportsDuration ? '#0a84ff' : 'var(--text-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    {LIST_TYPE_CONFIG[listType].supportsDuration ? '⏱ Con duraciones estimadas' : '📝 Sin duraciones'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {(['simple', 'routines', 'events', 'goals', 'caducidades', 'que_he_hecho'] as const).map(typeKey => {
                    const item = LIST_TYPE_CONFIG[typeKey];
                    const isSelected = listType === typeKey;
                    const TypeIcon = item.iconName === 'sparkles' ? Sparkles :
                                     item.iconName === 'check-square' ? CheckSquare :
                                     item.iconName === 'calendar' ? Calendar :
                                     item.iconName === 'target' ? Target :
                                     item.iconName === 'credit-card' ? CreditCard : BookOpen;
                    const testId = typeKey === 'caducidades' 
                      ? 'template-caducidades-btn' 
                      : (typeKey === 'que_he_hecho' ? 'template-quehehecho-btn' : `template-${typeKey}-btn`);

                    return (
                      <button
                        key={typeKey}
                        type="button"
                        data-testid={testId}
                        onClick={() => {
                          setListType(typeKey);
                          if (!existingList) {
                            setColor(item.color);
                            setIcon(item.iconName);
                          }
                        }}
                        style={{
                          padding: '10px 6px',
                          borderRadius: 12,
                          border: isSelected ? `1.5px solid ${item.color}` : '1px solid var(--border-subtle)',
                          background: isSelected ? `${item.color}15` : 'var(--bg-elevated)',
                          color: isSelected ? item.color : 'var(--text-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 4,
                          textAlign: 'center',
                          transition: 'all 0.16s ease'
                        }}
                      >
                        <TypeIcon size={18} strokeWidth={2.2} color={isSelected ? item.color : 'var(--text-secondary)'} />
                        <span style={{ fontSize: '0.78rem', fontWeight: 650, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', lineHeight: 1.15 }}>
                          {item.badgeLabel}
                        </span>
                        <span style={{ fontSize: '0.67rem', color: 'var(--text-tertiary)', lineHeight: 1.1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {typeKey === 'routines' ? 'Limpieza / Compra' :
                           typeKey === 'simple' ? 'Checklist / Notas' :
                           typeKey === 'events' ? 'Citas y Fechas' :
                           typeKey === 'goals' ? 'Metas del año' :
                           typeKey === 'caducidades' ? 'Suscripciones' : 'Bitácora'}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Explicación clara y detallada del tipo de lista seleccionado */}
                <div style={{
                  padding: '12px 14px',
                  borderRadius: 14,
                  background: `${LIST_TYPE_CONFIG[listType].color}10`,
                  border: `1px solid ${LIST_TYPE_CONFIG[listType].color}30`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      background: `${LIST_TYPE_CONFIG[listType].color}25`,
                      color: LIST_TYPE_CONFIG[listType].color
                    }}>
                      {(() => {
                        const item = LIST_TYPE_CONFIG[listType];
                        const TypeIcon = item.iconName === 'sparkles' ? Sparkles :
                                         item.iconName === 'check-square' ? CheckSquare :
                                         item.iconName === 'calendar' ? Calendar :
                                         item.iconName === 'target' ? Target :
                                         item.iconName === 'credit-card' ? CreditCard : BookOpen;
                        return <TypeIcon size={13} strokeWidth={2.4} />;
                      })()}
                    </span>
                    <span style={{ fontSize: '0.84rem', fontWeight: 650, color: 'var(--text-primary)' }}>
                      {LIST_TYPE_CONFIG[listType].label}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                    {listType === 'routines' && 'Diseñada para limpieza, hogar y quehaceres recurrentes. Admite estimación de tiempo activo y en segundo plano (lavadora, mascarilla), secciones cíclicas y modo secuencia con temporizador.'}
                    {listType === 'simple' && 'Para apuntar cosas, compras y notas de checklist. Sin duraciones forzadas ni frecuencias obligatorias; directo y al grano.'}
                    {listType === 'events' && 'Pensada para fechas señaladas, cumpleaños, citas y eventos con cuenta atrás.'}
                    {listType === 'goals' && 'Para objetivos anuales, retos y proyectos personales a medio y largo plazo.'}
                    {listType === 'caducidades' && 'Ideal para carnets, DNI, seguros, tarjetas y suscripciones periódicas con avisos preventivos de renovación.'}
                    {listType === 'que_he_hecho' && 'Bitácora personal para recordar vivencias, personas con las que estuviste y momentos especiales.'}
                  </p>
                </div>
              </div>
            )}

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

            {/* Auto estimate duration toggle */}
            {!isFolder && (
              <div 
                style={{
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  background: 'var(--bg-secondary)', 
                  border: '1px solid var(--border-color)',
                  borderRadius: 14, 
                  padding: '12px 16px',
                  cursor: 'pointer'
                }}
                onClick={() => setAutoEstimateDuration(!autoEstimateDuration)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Clock size={20} color={autoEstimateDuration ? color : 'var(--text-secondary)'} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>Estimar duración automáticamente</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Calcula la duración estimada de cada tarea según su texto</span>
                  </div>
                </div>
                <div style={{
                  width: 44, height: 26, borderRadius: 13,
                  background: autoEstimateDuration ? color : 'rgba(255,255,255,0.15)',
                  position: 'relative', transition: 'background-color 0.2s ease', flexShrink: 0
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', background: '#ffffff',
                    position: 'absolute', top: 2, left: autoEstimateDuration ? 20 : 2,
                    transition: 'left 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }} />
                </div>
              </div>
            )}

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
