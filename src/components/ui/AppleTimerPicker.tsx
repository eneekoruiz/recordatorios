import React, { useState, useEffect, useCallback } from 'react';
import { Clock, ChevronUp, ChevronDown } from 'lucide-react';
import { HapticService } from '../../services/HapticService';

interface AppleTimerPickerProps {
  duration: number | '' | undefined;
  onChange: (minutes: number | '') => void;
  isRoutineCategory?: boolean;
}

export const AppleTimerPicker: React.FC<AppleTimerPickerProps> = ({
  duration,
  onChange,
  isRoutineCategory = false
}) => {
  // Convert incoming duration (minutes) to hours, minutes, seconds
  const initialTotalSeconds = typeof duration === 'number' && duration > 0 ? Math.round(duration * 60) : 0;
  
  const [hours, setHours] = useState(Math.floor(initialTotalSeconds / 3600));
  const [minutes, setMinutes] = useState(Math.floor((initialTotalSeconds % 3600) / 60));
  const [seconds, setSeconds] = useState(initialTotalSeconds % 60);

  // Sync state if duration prop changes externally
  useEffect(() => {
    if (typeof duration === 'number' && duration > 0) {
      const totalSec = Math.round(duration * 60);
      setHours(Math.floor(totalSec / 3600));
      setMinutes(Math.floor((totalSec % 3600) / 60));
      setSeconds(totalSec % 60);
    } else if (duration === '' || duration === undefined) {
      setHours(0);
      setMinutes(0);
      setSeconds(0);
    }
  }, [duration]);

  const commitChanges = useCallback((newH: number, newM: number, newS: number) => {
    const totalSec = newH * 3600 + newM * 60 + newS;
    if (totalSec <= 0) {
      onChange('');
    } else {
      // Calculate minutes with clean fraction or rounded
      const totalMins = newS > 0 ? Math.round((totalSec / 60) * 10) / 10 : Math.round(totalSec / 60);
      onChange(totalMins);
    }
  }, [onChange]);

  const updateHours = (delta: number) => {
    HapticService.selection();
    setHours(prev => {
      const next = Math.max(0, Math.min(23, prev + delta));
      commitChanges(next, minutes, seconds);
      return next;
    });
  };

  const updateMinutes = (delta: number) => {
    HapticService.selection();
    setMinutes(prev => {
      let next = prev + delta;
      let nextH = hours;
      if (next >= 60) {
        next = 0;
        if (nextH < 23) nextH += 1;
      } else if (next < 0) {
        next = 59;
        if (nextH > 0) nextH -= 1;
      }
      setHours(nextH);
      commitChanges(nextH, next, seconds);
      return next;
    });
  };

  const updateSeconds = (delta: number) => {
    HapticService.selection();
    setSeconds(prev => {
      let next = prev + delta;
      let nextM = minutes;
      let nextH = hours;
      if (next >= 60) {
        next = 0;
        if (nextM < 59) nextM += 1;
        else if (nextH < 23) { nextM = 0; nextH += 1; }
      } else if (next < 0) {
        next = 59;
        if (nextM > 0) nextM -= 1;
        else if (nextH > 0) { nextM = 59; nextH -= 1; }
      }
      setHours(nextH);
      setMinutes(nextM);
      commitChanges(nextH, nextM, next);
      return next;
    });
  };

  const applyPreset = (mins: number) => {
    HapticService.selection();
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    setHours(h);
    setMinutes(m);
    setSeconds(0);
    onChange(mins);
  };

  const clearDuration = () => {
    HapticService.selection();
    setHours(0);
    setMinutes(0);
    setSeconds(0);
    onChange('');
  };

  const isConfigured = (hours > 0 || minutes > 0 || seconds > 0);

  // Formatted string: e.g. "1 h 30 min"
  const formattedDisplay = (() => {
    if (!isConfigured) return isRoutineCategory ? 'Automático' : 'Sin duración';
    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours} h`);
    if (minutes > 0 || (hours === 0 && seconds === 0)) parts.push(`${minutes} min`);
    if (seconds > 0) parts.push(`${seconds} s`);
    return parts.join(' ');
  })();

  return (
    <div 
      className="apple-timer-picker"
      style={{
        background: 'var(--bg-elevated, rgba(120, 120, 128, 0.08))',
        border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
        borderRadius: 14,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        boxSizing: 'border-box',
        userSelect: 'none'
      }}
    >
      {/* Header con resumen de tiempo */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Clock size={16} color="var(--accent-primary, #007aff)" />
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Temporizador estimado
          </span>
        </div>
        <span 
          style={{
            fontSize: '0.86rem',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            color: isConfigured ? 'var(--accent-primary, #007aff)' : 'var(--text-tertiary)',
            background: isConfigured ? 'rgba(0, 122, 255, 0.12)' : 'transparent',
            padding: isConfigured ? '2px 8px' : 0,
            borderRadius: 6
          }}
        >
          {formattedDisplay}
        </span>
      </div>

      {/* Ruedas/Columnas estilo Temporizador de Apple */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          background: 'var(--bg-card, #ffffff)',
          border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
          borderRadius: 12,
          padding: '8px 6px',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.04)'
        }}
      >
        {/* Columna Horas */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <button
            type="button"
            onClick={() => updateHours(1)}
            aria-label="Aumentar horas"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: 2,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ChevronUp size={18} />
          </button>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <span style={{ fontSize: '1.45rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
              {hours}
            </span>
            <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              horas
            </span>
          </div>
          <button
            type="button"
            onClick={() => updateHours(-1)}
            disabled={hours <= 0}
            aria-label="Disminuir horas"
            style={{
              background: 'transparent',
              border: 'none',
              color: hours <= 0 ? 'var(--border-strong, #c7c7cc)' : 'var(--text-secondary)',
              cursor: hours <= 0 ? 'default' : 'pointer',
              padding: 2,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ChevronDown size={18} />
          </button>
        </div>

        {/* Columna Minutos */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, borderLeft: '1px solid var(--border-subtle)', borderRight: '1px solid var(--border-subtle)' }}>
          <button
            type="button"
            onClick={() => updateMinutes(5)}
            aria-label="Aumentar minutos"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: 2,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ChevronUp size={18} />
          </button>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <span style={{ fontSize: '1.45rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
              {minutes.toString().padStart(2, '0')}
            </span>
            <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              min
            </span>
          </div>
          <button
            type="button"
            onClick={() => updateMinutes(-5)}
            disabled={hours === 0 && minutes <= 0}
            aria-label="Disminuir minutos"
            style={{
              background: 'transparent',
              border: 'none',
              color: hours === 0 && minutes <= 0 ? 'var(--border-strong, #c7c7cc)' : 'var(--text-secondary)',
              cursor: hours === 0 && minutes <= 0 ? 'default' : 'pointer',
              padding: 2,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ChevronDown size={18} />
          </button>
        </div>

        {/* Columna Segundos */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <button
            type="button"
            onClick={() => updateSeconds(15)}
            aria-label="Aumentar segundos"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: 2,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ChevronUp size={18} />
          </button>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <span style={{ fontSize: '1.45rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>
              {seconds.toString().padStart(2, '0')}
            </span>
            <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              seg
            </span>
          </div>
          <button
            type="button"
            onClick={() => updateSeconds(-15)}
            disabled={hours === 0 && minutes === 0 && seconds <= 0}
            aria-label="Disminuir segundos"
            style={{
              background: 'transparent',
              border: 'none',
              color: hours === 0 && minutes === 0 && seconds <= 0 ? 'var(--border-strong, #c7c7cc)' : 'var(--text-secondary)',
              cursor: hours === 0 && minutes === 0 && seconds <= 0 ? 'default' : 'pointer',
              padding: 2,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ChevronDown size={18} />
          </button>
        </div>
      </div>

      {/* Botones rápidos de preajuste estilo iOS */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { label: '5m', mins: 5 },
          { label: '15m', mins: 15 },
          { label: '25m', mins: 25 },
          { label: '30m', mins: 30 },
          { label: '45m', mins: 45 },
          { label: '1h', mins: 60 },
          { label: '1h 30m', mins: 90 },
          { label: '2h', mins: 120 }
        ].map(p => {
          const isSelected = typeof duration === 'number' && duration === p.mins;
          return (
            <button
              key={p.mins}
              type="button"
              onClick={() => applyPreset(p.mins)}
              style={{
                padding: '4px 10px',
                borderRadius: 999,
                fontSize: '0.76rem',
                fontWeight: isSelected ? 700 : 500,
                border: isSelected ? '1px solid var(--accent-primary, #007aff)' : '1px solid var(--border-subtle)',
                background: isSelected ? 'var(--accent-primary, #007aff)' : 'var(--bg-card, rgba(0,0,0,0.03))',
                color: isSelected ? '#ffffff' : 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: isSelected ? '0 1px 4px rgba(0, 122, 255, 0.3)' : 'none'
              }}
            >
              {p.label}
            </button>
          );
        })}

        {isConfigured && (
          <button
            type="button"
            onClick={clearDuration}
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              fontSize: '0.74rem',
              fontWeight: 600,
              border: 'none',
              background: 'transparent',
              color: 'var(--accent-red, #ff3b30)',
              cursor: 'pointer',
              marginLeft: 'auto'
            }}
          >
            Quitar
          </button>
        )}
      </div>
    </div>
  );
};
