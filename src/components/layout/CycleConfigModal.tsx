import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Plus, Minus, Sparkles, Circle } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { CYCLE_ICON_MAP } from '../../constants/icons';
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

const AVAILABLE_COLORS = [
  '#FF9500', // Ámbar
  '#007AFF', // Azul Royal
  '#AF52DE', // Púrpura
  '#34C759', // Verde
  '#FF2D55', // Rosa
  '#30B0C7', // Cyan
  '#5856D6', // Índigo
  '#FF3B30', // Rojo Coral
];

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
  const [selectedColor, setSelectedColor] = useState('#AF52DE');
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
    <div
      className="prompt-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'rgba(0, 0, 0, 0.48)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <motion.div
        className="cycle-config-modal"
        initial={{ opacity: 0, scale: 0.94, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 24 }}
        transition={{ type: 'spring', damping: 28, stiffness: 380 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(100%, 460px)',
          maxHeight: 'min(92dvh, 720px)',
          overflowY: 'auto',
          background: 'var(--bg-elevated, #ffffff)',
          border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.14))',
          borderRadius: 24,
          padding: '24px 22px 20px',
          boxShadow: '0 24px 70px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          color: 'var(--text-primary)',
          boxSizing: 'border-box',
        }}
      >
        {/* Top Bar with Title and Close Button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.015em' }}>
              Nuevo Ciclo Temporal
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Frecuencia personalizada para tareas periódicas
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'var(--bg-surface-glass, rgba(142, 142, 147, 0.15))',
              border: 'none',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(142, 142, 147, 0.25)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-surface-glass, rgba(142, 142, 147, 0.15))')}
          >
            <X size={16} strokeWidth={2.4} />
          </button>
        </div>

        {/* Interactive Preview Bubble */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '2px 0 4px' }}>
          <motion.div
            animate={{
              backgroundColor: selectedColor,
              boxShadow: `0 12px 30px ${selectedColor}55, inset 0 2px 4px rgba(255, 255, 255, 0.4)`,
            }}
            transition={{ duration: 0.2 }}
            style={{
              width: 68,
              height: 68,
              borderRadius: '50%',
              background: selectedColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CyclePreviewIcon icon={selectedIcon} size={32} />
          </motion.div>
        </div>

        {/* Name Field */}
        <div>
          <label
            style={{
              display: 'block',
              marginBottom: 6,
              fontSize: '0.74rem',
              fontWeight: 650,
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Nombre del ciclo
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Ej: Trimestral, Quincenal..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && isValid) {
                e.preventDefault();
                handleSave();
              }
            }}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 14,
              background: isFocused ? 'var(--bg-base)' : 'var(--bg-hover, rgba(142, 142, 147, 0.08))',
              border: isFocused ? `1.5px solid ${selectedColor}` : '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              fontSize: '1.05rem',
              fontWeight: 600,
              outline: 'none',
              boxShadow: isFocused ? `0 0 0 3px ${selectedColor}22` : 'none',
              transition: 'all 0.15s ease',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Cadence / Days Presets & Stepper */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label
              style={{
                fontSize: '0.74rem',
                fontWeight: 650,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Frecuencia en días
            </label>
            {typeof days === 'number' && (
              <span style={{ fontSize: '0.78rem', color: selectedColor, fontWeight: 600 }}>
                Cada {days} {days === 1 ? 'día' : 'días'}
              </span>
            )}
          </div>

          {/* Preset chips */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {PRESET_CADENCES.map((preset) => {
              const isSelected = days === preset.days;
              return (
                <button
                  key={preset.days}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 10,
                    border: isSelected ? `1.5px solid ${selectedColor}` : '1px solid var(--border-subtle)',
                    background: isSelected ? `${selectedColor}18` : 'var(--bg-hover, rgba(142, 142, 147, 0.08))',
                    color: isSelected ? selectedColor : 'var(--text-primary)',
                    fontSize: '0.82rem',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <span>{preset.name}</span>
                  <span style={{ opacity: 0.65, fontSize: '0.72rem' }}>({preset.label})</span>
                </button>
              );
            })}
          </div>

          {/* Days numeric stepper */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--bg-hover, rgba(142, 142, 147, 0.08))',
              padding: '6px 10px',
              borderRadius: 14,
              border: '1px solid var(--border-subtle)',
            }}
          >
            <button
              type="button"
              onClick={() => adjustDays(-5)}
              disabled={typeof days === 'number' && days <= 1}
              aria-label="Restar 5 días"
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: 'none',
                background: 'var(--bg-base)',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: typeof days === 'number' && days <= 1 ? 'not-allowed' : 'pointer',
                opacity: typeof days === 'number' && days <= 1 ? 0.4 : 1,
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
              }}
            >
              <Minus size={16} />
            </button>

            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <input
                type="number"
                value={days}
                onChange={(e) => setDays(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1))}
                min="1"
                style={{
                  width: 70,
                  textAlign: 'center',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                días
              </span>
            </div>

            <button
              type="button"
              onClick={() => adjustDays(5)}
              aria-label="Sumar 5 días"
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: 'none',
                background: 'var(--bg-base)',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.08)',
              }}
            >
              <Plus size={16} />
            </button>
          </div>

          <p style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)', margin: '6px 2px 0' }}>
            Las tareas asignadas a este ciclo se renovarán cada {days || 'X'} días.
          </p>
        </div>

        {/* Color Selection Palette */}
        <div>
          <label
            style={{
              display: 'block',
              marginBottom: 8,
              fontSize: '0.74rem',
              fontWeight: 650,
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Color
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {AVAILABLE_COLORS.map((col) => {
              const isSelected = selectedColor === col;
              return (
                <button
                  key={col}
                  type="button"
                  onClick={() => {
                    HapticService.selection();
                    setSelectedColor(col);
                  }}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: col,
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    outline: isSelected ? `2.5px solid var(--text-primary)` : 'none',
                    outlineOffset: 2,
                    transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                    transition: 'transform 0.15s ease, outline 0.15s ease',
                    boxShadow: isSelected ? `0 4px 12px ${col}66` : '0 2px 4px rgba(0,0,0,0.1)',
                  }}
                  aria-label={`Color ${col}`}
                >
                  {isSelected && <Check size={18} color="white" strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Icon Selection Grid */}
        <div>
          <label
            style={{
              display: 'block',
              marginBottom: 8,
              fontSize: '0.74rem',
              fontWeight: 650,
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Icono
          </label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(9, 1fr)',
              gap: 6,
              background: 'var(--bg-hover, rgba(142, 142, 147, 0.08))',
              padding: '8px',
              borderRadius: 14,
              border: '1px solid var(--border-subtle)',
            }}
          >
            {SELECTABLE_ICONS.map((iconName) => {
              const ItemIcon = CYCLE_ICON_MAP[iconName] || Sparkles;
              const isSelected = selectedIcon === iconName;
              return (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => {
                    HapticService.selection();
                    setSelectedIcon(iconName);
                  }}
                  style={{
                    aspectRatio: '1',
                    borderRadius: 10,
                    border: 'none',
                    background: isSelected ? selectedColor : 'transparent',
                    color: isSelected ? 'white' : 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    padding: 0,
                  }}
                  title={iconName}
                >
                  <ItemIcon size={18} strokeWidth={isSelected ? 2.5 : 2} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 18px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '0.94rem',
              cursor: 'pointer',
              borderRadius: 12,
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isValid}
            style={{
              padding: '10px 22px',
              background: selectedColor,
              border: 'none',
              borderRadius: 12,
              color: 'white',
              fontWeight: 700,
              fontSize: '0.94rem',
              cursor: !isValid ? 'not-allowed' : 'pointer',
              opacity: !isValid ? 0.45 : 1,
              boxShadow: isValid ? `0 6px 18px ${selectedColor}44` : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            Crear Ciclo
          </button>
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
