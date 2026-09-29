import { useState, useEffect } from 'react';
import type React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Plus, Minus, Sparkles, Circle } from 'lucide-react';
import { SheetNavBar } from '../ui/SheetNavBar';
import { useAppStore } from '../../store/useAppStore';
import { CYCLE_ICON_MAP } from '../../constants/icons';
import { CURATED_MODAL_PALETTE } from '../../constants/colors';
import { HapticService } from '../../services/HapticService';
import { SoundService } from '../../services/SoundService';

interface CycleConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (cycleId: string) => void;
}

const PRESET_CADENCES = [
  { name: 'Quincenal', days: 15, label: '15d' },
  { name: 'Bimestral', days: 60, label: '60d' },
  { name: 'Trimestral', days: 90, label: '90d' },
  { name: 'Semestral', days: 180, label: '180d' },
  { name: 'Bienal', days: 730, label: '2 años' },
];

const AVAILABLE_COLORS = CURATED_MODAL_PALETTE;

const SELECTABLE_ICONS = [
  'star',
  'rocket',
  'sparkles',
  'flame',
  'sun',
  'moon',
  'globe',
  'calendar',
  'circle',
];

function CyclePreviewIcon({ icon, size }: { icon: string; size: number }) {
  const IconComponent = CYCLE_ICON_MAP[icon] || Circle;
  return <IconComponent size={size} color="white" strokeWidth={2.2} />;
}

function CycleConfigModalContent({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (cycleId: string) => void;
}) {
  const addCycle = useAppStore(state => state.addCycle);
  const [name, setName] = useState('');
  const [days, setDays] = useState<number | ''>(90);
  const [selectedColor, setSelectedColor] = useState<string>('#7928CA'); // de la paleta, para que se vea marcado
  const [selectedIcon, setSelectedIcon] = useState('star');
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSave = () => {
    const numericDays = Number(days);
    if (!name.trim() || !days || numericDays <= 0) return;

    HapticService.notification('success');
    SoundService.playPop();

    const newCycleId = `cycle_${Date.now()}`;
    addCycle({
      id: newCycleId,
      name: name.trim(),
      daysValue: numericDays,
      isPinned: true,
      icon: selectedIcon,
      color: selectedColor,
    });

    window.dispatchEvent(
      new CustomEvent('show-toast', {
        detail: `Frecuencia "${name.trim()}" creada con éxito`,
      })
    );

    onSuccess(newCycleId);
  };

  const handleSelectPreset = (preset: typeof PRESET_CADENCES[0]) => {
    HapticService.selection();
    setDays(preset.days);
    if (!name.trim() || PRESET_CADENCES.some(p => p.name === name.trim())) {
      setName(preset.name);
    }
  };

  const adjustDays = (delta: number) => {
    HapticService.selection();
    const current = typeof days === 'number' ? days : 1;
    const next = Math.max(1, current + delta);
    setDays(next);
  };

  const isValid = name.trim().length > 0 && typeof days === 'number' && days > 0;

  return (
    <div className="prompt-overlay list-config-overlay" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100000 }}>
      <motion.div
        className="cycle-config-modal form-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Nueva frecuencia"
        initial={{ opacity: 0, scale: 0.96, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 24 }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }}
        onClick={(e) => e.stopPropagation()}
        style={{ ['--hero-color' as string]: selectedColor } as React.CSSProperties}
      >
        <SheetNavBar
          title="Nueva frecuencia"
          onCancel={onClose}
          onConfirm={handleSave}
          confirmLabel="Crear"
          confirmDisabled={!isValid}
        />

        <div className="form-sheet-body">
          {/* Icono + nombre */}
          <div className="form-group form-hero">
            <div className="form-hero-icon" style={{ background: selectedColor, ['--hero-color' as string]: `${selectedColor}88` } as React.CSSProperties}>
              <CyclePreviewIcon icon={selectedIcon} size={32} />
            </div>
            <input
              type="text"
              className="form-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Nombre (p. ej. Trimestral)"
              aria-label="Nombre de la frecuencia"
              data-focused={isFocused || undefined}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isValid) {
                  e.preventDefault();
                  handleSave();
                }
              }}
            />
          </div>

          {/* Cada cuánto */}
          <div>
            <p className="form-group-label">Cada cuánto</p>
            <div className="form-group is-padded" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="preset-row" role="radiogroup" aria-label="Frecuencias habituales">
                {PRESET_CADENCES.map((preset) => {
                  const isSelected = days === preset.days;
                  return (
                    <button
                      key={preset.days}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      className={`preset-chip${isSelected ? ' is-selected' : ''}`}
                      onClick={() => handleSelectPreset(preset)}
                    >
                      {preset.name}
                    </button>
                  );
                })}
              </div>
              <div className="day-stepper">
                <button type="button" onClick={() => adjustDays(-1)} disabled={typeof days === 'number' && days <= 1} aria-label="Un día menos">
                  <Minus size={16} />
                </button>
                <label className="day-stepper-value">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={days}
                    onChange={(e) => setDays(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    aria-label="Días"
                  />
                  <span>{days === 1 ? 'día' : 'días'}</span>
                </label>
                <button type="button" onClick={() => adjustDays(1)} aria-label="Un día más">
                  <Plus size={16} />
                </button>
              </div>
            </div>
            <p className="form-group-footer">
              {typeof days === 'number' && days > 0
                ? `Sus tareas vuelven a quedar pendientes cada ${days} ${days === 1 ? 'día' : 'días'}.`
                : 'Indica cada cuántos días se repiten sus tareas.'}
            </p>
          </div>

          {/* Color */}
          <div>
            <p className="form-group-label">Color</p>
            <div className="form-group is-padded">
              <div className="swatch-grid color-grid">
                {AVAILABLE_COLORS.map((col) => {
                  const isSelected = selectedColor === col;
                  return (
                    <button
                      key={col}
                      type="button"
                      className={`swatch${isSelected ? ' is-selected' : ''}`}
                      style={{ background: col, ['--swatch' as string]: col } as React.CSSProperties}
                      onClick={() => { HapticService.selection(); setSelectedColor(col); }}
                      aria-label={`Color ${col}`}
                      aria-pressed={isSelected}
                    >
                      {isSelected && <Check size={16} color="white" strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Icono */}
          <div>
            <p className="form-group-label">Icono</p>
            <div className="form-group is-padded">
              <div className="swatch-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(42px, 1fr))' }}>
                {SELECTABLE_ICONS.map((iconName) => {
                  const ItemIcon = CYCLE_ICON_MAP[iconName] || Sparkles;
                  const isSelected = selectedIcon === iconName;
                  return (
                    <button
                      key={iconName}
                      type="button"
                      className={`icon-choice${isSelected ? ' is-selected' : ''}`}
                      onClick={() => { HapticService.selection(); setSelectedIcon(iconName); }}
                      aria-label={`Icono ${iconName}`}
                      aria-pressed={isSelected}
                    >
                      <ItemIcon size={19} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function CycleConfigModal({ isOpen, onClose, onSuccess }: CycleConfigModalProps) {
  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <CycleConfigModalContent onClose={onClose} onSuccess={onSuccess} />
    </AnimatePresence>,
    document.body
  );
}
