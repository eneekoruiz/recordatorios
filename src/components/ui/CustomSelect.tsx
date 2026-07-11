import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

export function CustomSelect({ value, onChange, options, placeholder = 'Seleccionar...', className = '' }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0, width: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const selectedOption = options.find(o => o.value === value);

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        x: rect.left,
        y: rect.bottom + 4,
        width: rect.width
      });
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    const handleScroll = () => setIsOpen(false);
    if (isOpen) {
      window.addEventListener('scroll', handleScroll, true);
    }
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [isOpen]);

  return (
    <>
      <button 
        ref={buttonRef}
        type="button" 
        onClick={handleToggle}
        className={`custom-select-trigger ${className}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '8px',
          background: 'transparent',
          border: 'none',
          color: selectedOption ? 'var(--text-secondary)' : 'var(--text-tertiary)',
          fontSize: '1rem',
          cursor: 'pointer',
          padding: 0,
          fontFamily: 'inherit',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      >
        <span>{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown size={14} style={{ opacity: 0.5 }} />
      </button>

      {isOpen && createPortal(
        <>
          <div 
            style={{ position: 'fixed', inset: 0, zIndex: 99998 }}
            onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
          />
          <div 
            className="ios-dropdown-menu"
            style={{
              position: 'fixed',
              top: coords.y,
              right: window.innerWidth - coords.x - coords.width,
              minWidth: Math.max(coords.width, 180),
              zIndex: 99999,
              maxHeight: '300px',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {options.map(opt => (
              <button
                key={opt.value}
                className="ios-dropdown-item"
                style={{ 
                  justifyContent: 'space-between',
                  background: value === opt.value ? 'var(--bg-hover)' : 'transparent'
                }}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
              >
                <span>{opt.label}</span>
                {value === opt.value && <Check size={14} className="check-icon" />}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </>
  );
}
