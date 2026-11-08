import React from 'react';
import { motion } from 'framer-motion';
import { HapticService } from '../../services/HapticService';

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  badge?: number | string;
}

export interface AppleSegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
}

export function AppleSegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  size = 'md',
  fullWidth = false,
  className = '',
  style = {},
  ariaLabel = 'Opciones de visualización'
}: AppleSegmentedControlProps<T>) {
  const layoutId = React.useId();

  const handleSelect = (val: T) => {
    if (val !== value) {
      HapticService.selection();
      onChange(val);
    }
  };

  const heights = {
    sm: 30,
    md: 34,
    lg: 40
  };

  const fontSizes = {
    sm: '0.78rem',
    md: '0.84rem',
    lg: '0.92rem'
  };

  const paddings = {
    sm: '0 10px',
    md: '0 14px',
    lg: '0 18px'
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`apple-segmented-control ${className}`}
      style={{
        display: fullWidth ? 'flex' : 'inline-flex',
        alignItems: 'center',
        background: 'var(--bg-segmented, var(--bg-hover, rgba(120, 120, 128, 0.12)))',
        borderRadius: 999,
        padding: 3,
        position: 'relative',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.06))',
        boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.04)',
        width: fullWidth ? '100%' : 'auto',
        ...style
      }}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => handleSelect(option.value)}
            style={{
              position: 'relative',
              flex: fullWidth ? 1 : undefined,
              height: heights[size],
              padding: paddings[size],
              borderRadius: 999,
              border: 'none',
              background: 'transparent',
              color: isSelected
                ? 'var(--text-primary, #000000)'
                : 'var(--text-secondary, rgba(60, 60, 67, 0.6))',
              fontWeight: isSelected ? 600 : 500,
              fontSize: fontSizes[size],
              letterSpacing: '-0.01em',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
              zIndex: 1,
              outline: 'none',
              transition: 'color 0.15s ease'
            }}
          >
            {isSelected && (
              <motion.div
                layoutId={`segment-active-${layoutId}`}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 999,
                  background: 'var(--bg-elevated, #ffffff)',
                  boxShadow:
                    '0 2px 8px rgba(0, 0, 0, 0.12), 0 0.5px 2px rgba(0, 0, 0, 0.06)',
                  border: '0.5px solid var(--border-subtle, rgba(0, 0, 0, 0.04))',
                  zIndex: -1
                }}
                transition={{
                  type: 'spring',
                  stiffness: 500,
                  damping: 35,
                  mass: 0.8
                }}
              />
            )}
            {option.icon && (
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                {option.icon}
              </span>
            )}
            <span>{option.label}</span>
            {option.badge !== undefined && (
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '1px 6px',
                  borderRadius: 999,
                  background: isSelected
                    ? 'var(--bg-hover, rgba(0, 0, 0, 0.06))'
                    : 'var(--bg-surface, rgba(0, 0, 0, 0.04))',
                  color: isSelected
                    ? 'var(--accent-primary, #007aff)'
                    : 'var(--text-tertiary)',
                  fontVariantNumeric: 'tabular-nums'
                }}
              >
                {option.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
