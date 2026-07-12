import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
}

export function CustomSelect({ value, onChange, options, placeholder = 'Seleccionar…', className = '' }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0, width: 0, openUp: false });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const selectedOption = useMemo(() => options.find(option => option.value === value), [options, value]);

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const estimatedHeight = Math.min(options.length * 46 + 16, 316);
      setCoords({
        x: Math.max(12, Math.min(rect.left, window.innerWidth - Math.max(rect.width, 220) - 12)),
        y: rect.bottom + 8,
        width: rect.width,
        openUp: rect.bottom + estimatedHeight > window.innerHeight - 12
      });
    }
    setIsOpen(current => !current);
  };

  useEffect(() => {
    if (!isOpen) return;
    const close = () => setIsOpen(false);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className={`custom-select-trigger ${className}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>{selectedOption?.label || placeholder}</span>
        <ChevronDown size={15} aria-hidden="true" className={isOpen ? 'is-open' : ''} />
      </button>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <>
              <motion.div className="select-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                exit={{ opacity: 0 }} onClick={() => setIsOpen(false)} />
              <motion.div
                className="ios-dropdown-menu premium-select-menu"
                role="listbox"
                aria-label={placeholder}
                initial={{ opacity: 0, y: coords.openUp ? 8 : -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: coords.openUp ? 8 : -8, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 480, damping: 34 }}
                style={{
                  position: 'fixed',
                  left: coords.x,
                  top: coords.openUp ? 'auto' : coords.y,
                  bottom: coords.openUp ? window.innerHeight - coords.y + 12 : 'auto',
                  minWidth: Math.max(coords.width, 220),
                  zIndex: 100002
                }}
              >
                <div className="select-sheet-handle" aria-hidden="true" />
                {options.map(option => {
                  const selected = value === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className="ios-dropdown-item"
                      onClick={() => {
                        navigator.vibrate?.(12);
                        onChange(option.value);
                        setIsOpen(false);
                      }}
                    >
                      <span>{option.label}</span>
                      {selected && <Check size={16} className="check-icon" aria-hidden="true" />}
                    </button>
                  );
                })}
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
