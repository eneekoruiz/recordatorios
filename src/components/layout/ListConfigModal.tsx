import { useState } from 'react';
import type React from 'react';
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
import { CheckSquare, Folder, Check, CreditCard, BookOpen, Sparkles, Calendar, Target, Clock } from 'lucide-react';
import { SheetNavBar } from '../ui/SheetNavBar';

const COLORS = LIST_AVAILABLE_COLORS;
// Una fila completa de muestras (7 columnas) antes de «Ver más»: sin muestras huérfanas.
const COLOR_PREVIEW_COUNT = 7;

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

  // El formulario se rellena al abrirse (o al cambiar de lista), durante el render.
  // Antes era un efecto que dependía del objeto de la lista y reiniciaba lo escrito
  // si llegaba una sincronización con el modal abierto.
  const formKey = isOpen ? `${listId || ''}|${defaultIsFolder ? 'folder' : 'list'}` : null;
  const [loadedFormKey, setLoadedFormKey] = useState<string | null>(null);
  if (formKey !== loadedFormKey) {
    setLoadedFormKey(formKey);
    if (formKey !== null) {
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
        setShowAllColors(!(COLORS.slice(0, COLOR_PREVIEW_COUNT) as readonly string[]).includes(cleanColor));
        setShowAllIcons(!Object.keys(ICONS).slice(0, 12).includes(initialIcon));
      } else {
        setName('');
        // Cada lista nueva estrena el siguiente color de la paleta visible.
        setColor(COLORS[lists.length % COLOR_PREVIEW_COUNT]);
        const initialIcon = defaultIsFolder ? 'folder' : 'list';
        setIcon(initialIcon);
        setIsFolder(!!defaultIsFolder);
        setListType('simple');
        setAutoEstimateDuration(true);
        setShowAllColors(false);
        setShowAllIcons(false);
      }
    }
  }

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

  const title = existingList
    ? (existingList.isFolder ? 'Editar carpeta' : 'Editar lista')
    : (isFolder ? 'Nueva carpeta' : (parentId ? 'Nueva lista anidada' : 'Nueva lista'));
  const TYPE_KEYS = ['simple', 'routines', 'events', 'goals', 'caducidades', 'que_he_hecho'] as const;
  const typeIcon = (iconName: string) =>
    iconName === 'sparkles' ? Sparkles :
    iconName === 'check-square' ? CheckSquare :
    iconName === 'calendar' ? Calendar :
    iconName === 'target' ? Target :
    iconName === 'credit-card' ? CreditCard : BookOpen;
  // Una frase por tipo: lo justo para elegir sin leer un párrafo.
  const TYPE_HINT: Record<ListType, string> = {
    simple: 'Para apuntar cosas y compras, sin duraciones ni frecuencias.',
    routines: 'Limpieza y hogar: estima el tiempo, admite tareas en segundo plano y modo secuencia.',
    events: 'Cumpleaños, citas y fechas señaladas con cuenta atrás.',
    goals: 'Objetivos y retos a medio y largo plazo.',
    caducidades: 'Carnets, seguros, tarjetas y suscripciones, con avisos antes de que venzan.',
    que_he_hecho: 'Bitácora para recordar vivencias y con quién las compartiste.',
  } as Record<ListType, string>;
  const HeroIcon = ICONS[icon] || CheckSquare;
  const visibleIcons = showAllIcons ? Object.keys(ICONS) : Object.keys(ICONS).slice(0, 12);

  return createPortal(
    <AnimatePresence>
      <div className="prompt-overlay list-config-overlay" onClick={onClose} style={{ zIndex: 100000, position: 'fixed', inset: 0 }}>
        <motion.div
          className="list-config-modal form-sheet"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          initial={{ opacity: 0, scale: 0.96, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 24 }}
          transition={{ type: 'spring', damping: 30, stiffness: 400 }}
          onClick={e => e.stopPropagation()}
          onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
          style={{ ['--hero-color' as string]: color } as React.CSSProperties}
        >
          <SheetNavBar
            title={title}
            onCancel={onClose}
            onConfirm={handleSave}
            confirmLabel={existingList ? 'Guardar' : 'Crear'}
            confirmDisabled={!name.trim()}
          />

          <div className="form-sheet-body">
            {/* Icono + nombre */}
            <div className="form-group form-hero">
              <div className="form-hero-icon" style={{ background: color, ['--hero-color' as string]: `${color}88` } as React.CSSProperties}>
                <HeroIcon size={34} color="white" />
              </div>
              <input
                type="text"
                className="form-name-input"
                value={name}
                onChange={e => handleNameChange(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onKeyDown={e => { if (e.key === 'Enter' && name.trim()) handleSave(); }}
                placeholder={isFolder ? 'Nombre de la carpeta' : 'Nombre de la lista'}
                aria-label={isFolder ? 'Nombre de la carpeta' : 'Nombre de la lista'}
                data-focused={isFocused || undefined}
                autoFocus
              />
            </div>

            {/* Tipo de lista */}
            {!isFolder && (
              <div>
                <p className="form-group-label">Tipo</p>
                <div className="form-group is-padded">
                  <div className="type-grid" role="radiogroup" aria-label="Tipo de lista">
                    {TYPE_KEYS.map(typeKey => {
                      const item = LIST_TYPE_CONFIG[typeKey];
                      const isSelected = listType === typeKey;
                      const TypeIcon = typeIcon(item.iconName);
                      const testId = typeKey === 'caducidades'
                        ? 'template-caducidades-btn'
                        : (typeKey === 'que_he_hecho' ? 'template-quehehecho-btn' : `template-${typeKey}-btn`);
                      return (
                        <button
                          key={typeKey}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          data-testid={testId}
                          className={`type-tile${isSelected ? ' is-selected' : ''}`}
                          style={{ ['--tile-color' as string]: item.color } as React.CSSProperties}
                          onClick={() => {
                            setListType(typeKey);
                            if (!existingList) {
                              setColor(item.color);
                              setIcon(item.iconName);
                            }
                          }}
                        >
                          <TypeIcon size={19} strokeWidth={2.2} />
                          <span>{item.badgeLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <p className="form-group-footer">{TYPE_HINT[listType]}</p>
              </div>
            )}

            {/* Color */}
            <div>
              <p className="form-group-label">Color</p>
              <div className="form-group is-padded">
                <div className="swatch-grid color-grid">
                  {(showAllColors ? COLORS : COLORS.slice(0, COLOR_PREVIEW_COUNT)).map(c => {
                    const isSelected = color === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        className={`swatch${isSelected ? ' is-selected' : ''}`}
                        style={{ background: c, ['--swatch' as string]: c } as React.CSSProperties}
                        onClick={() => setColor(c)}
                        aria-label={`Color ${c}`}
                        aria-pressed={isSelected}
                      >
                        {isSelected && <Check size={16} color="white" strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>
                <button type="button" className="form-more-btn" onClick={() => setShowAllColors(!showAllColors)}>
                  {showAllColors ? 'Menos colores' : 'Más colores'}
                </button>
              </div>
            </div>

            {/* Icono */}
            <div>
              <p className="form-group-label">Icono</p>
              <div className="form-group is-padded">
                <div className="swatch-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(42px, 1fr))' }}>
                  {visibleIcons.map(k => {
                    const IconComp = ICONS[k];
                    const isActive = icon === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        className={`icon-choice${isActive ? ' is-selected' : ''}`}
                        onClick={() => setIcon(k)}
                        aria-label={`Icono ${k}`}
                        aria-pressed={isActive}
                      >
                        <IconComp size={20} />
                      </button>
                    );
                  })}
                </div>
                <button type="button" className="form-more-btn" onClick={() => setShowAllIcons(!showAllIcons)}>
                  {showAllIcons ? 'Menos iconos' : 'Más iconos'}
                </button>
              </div>
            </div>

            {/* Opciones */}
            <div>
              <p className="form-group-label">Opciones</p>
              <div className="form-group">
                <label className="form-row">
                  <span className="form-row-icon" style={{ background: '#8e8e93' }}><Folder size={16} /></span>
                  <span className="form-row-text">
                    <span className="form-row-title">Es una carpeta</span>
                    <span className="form-row-sub">Agrupa listas en lugar de recordatorios</span>
                  </span>
                  <span className="switch" style={{ flexShrink: 0, margin: 0 }}>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={isFolder}
                      onChange={() => {
                        const next = !isFolder;
                        setIsFolder(next);
                        if (next && icon === 'list') setIcon('folder');
                        if (!next && (icon === 'folder' || icon === 'folder-open')) setIcon('list');
                      }}
                    />
                    <span className="slider round"></span>
                  </span>
                </label>
                {!isFolder && (
                  <label className="form-row">
                    <span className="form-row-icon" style={{ background: '#0a84ff' }}><Clock size={16} /></span>
                    <span className="form-row-text">
                      <span className="form-row-title">Estimar duración</span>
                      <span className="form-row-sub">Calcula cuánto lleva cada tarea por su nombre</span>
                    </span>
                    <span className="switch" style={{ flexShrink: 0, margin: 0 }}>
                      <input
                        type="checkbox"
                        role="switch"
                        checked={autoEstimateDuration}
                        onChange={() => setAutoEstimateDuration(!autoEstimateDuration)}
                      />
                      <span className="slider round"></span>
                    </span>
                  </label>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
