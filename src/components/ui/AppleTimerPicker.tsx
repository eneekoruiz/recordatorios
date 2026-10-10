import React, { useState, useCallback } from 'react';
import { Clock, ChevronUp, ChevronDown } from 'lucide-react';
import { HapticService } from '../../services/HapticService';

interface AppleTimerPickerProps {
  duration: number | '' | undefined;
  onChange: (minutes: number | '') => void;
  isRoutineCategory?: boolean;
  label?: string;
  sublabel?: string;
  isParallel?: boolean;
}

export const AppleTimerPicker: React.FC<AppleTimerPickerProps> = ({
  duration,
  onChange,
  isRoutineCategory: _isRoutineCategory = false,
  label,
  sublabel,
  isParallel = false
}) => {
  // Convert incoming duration (minutes) to hours, minutes, seconds
  const initialTotalSeconds = typeof duration === 'number' && duration > 0 ? Math.round(duration * 60) : 0;
  
  const [hours, setHours] = useState(Math.floor(initialTotalSeconds / 3600));
  const [minutes, setMinutes] = useState(Math.floor((initialTotalSeconds % 3600) / 60));
  const [seconds, setSeconds] = useState(initialTotalSeconds % 60);

  // Si la duración cambia desde fuera, las ruedas se ajustan (durante el render, sin efecto).
  const [syncedDuration, setSyncedDuration] = useState(duration);
  if (duration !== syncedDuration) {
    setSyncedDuration(duration);
    if (typeof duration === 'number' && duration > 0) {
      const totalSec = Math.round(duration * 60);
      setHours(Math.floor(totalSec / 3600));
      setMinutes(Math.floor((totalSec % 3600) / 60));
      setSeconds(totalSec % 60);
    } else if (duration === '' || duration === undefined || duration === 0) {
      setHours(0);
      setMinutes(0);
      setSeconds(0);
    }
  }

  const commitChanges = useCallback((newH: number, newM: number, newS: number) => {
    const totalSec = newH * 3600 + newM * 60 + newS;
    if (totalSec <= 0) {
      onChange(0);
    } else {
      // Minutos exactos (1 min 7 s = 67/60): redondear a décimas perdía segundos al volver.
      onChange(totalSec / 60);
    }
  }, [onChange]);

  const updateHours = useCallback((delta: number) => {
    HapticService.selection();
    setHours(prev => {
      const next = Math.max(0, Math.min(23, prev + delta));
      commitChanges(next, minutes, seconds);
      return next;
    });
  }, [commitChanges, minutes, seconds]);

  const updateMinutes = useCallback((delta: number) => {
    HapticService.selection();
    setMinutes(prev => {
      let next = prev + delta;
      let nextH = hours;
      while (next >= 60) {
        next -= 60;
        if (nextH < 23) nextH += 1;
      }
      while (next < 0) {
        next += 60;
        if (nextH > 0) nextH -= 1;
      }
      setHours(nextH);
      commitChanges(nextH, next, seconds);
      return next;
    });
  }, [commitChanges, hours, seconds]);

  const updateSeconds = useCallback((delta: number) => {
    HapticService.selection();
    setSeconds(prev => {
      let next = prev + delta;
      let nextM = minutes;
      let nextH = hours;
      while (next >= 60) {
        next -= 60;
        if (nextM < 59) nextM += 1;
        else if (nextH < 23) { nextM = 0; nextH += 1; }
      }
      while (next < 0) {
        next += 60;
        if (nextM > 0) nextM -= 1;
        else if (nextH > 0) { nextM = 59; nextH -= 1; }
      }
      setHours(nextH);
      setMinutes(nextM);
      commitChanges(nextH, nextM, next);
      return next;
    });
  }, [commitChanges, hours, minutes]);

  // Accelerating stepper for rapid clicks and hold down
  const holdIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const holdTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTicksRef = React.useRef(0);

  const stopHold = useCallback(() => {
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    holdTimeoutRef.current = null;
    holdIntervalRef.current = null;
    holdTicksRef.current = 0;
  }, []);

  const startHold = useCallback((type: 'hours' | 'minutes' | 'seconds', direction: 1 | -1) => {
    stopHold();
    if (type === 'hours') updateHours(direction);
    else if (type === 'minutes') updateMinutes(direction);
    else updateSeconds(direction);

    holdTicksRef.current = 0;
    holdTimeoutRef.current = setTimeout(() => {
      holdIntervalRef.current = setInterval(() => {
        holdTicksRef.current += 1;
        const ticks = holdTicksRef.current;
        let step = 1;
        if (type !== 'hours') {
          if (ticks > 24) step = 10;
          else if (ticks > 12) step = 5;
          else if (ticks > 5) step = 2;
        }
        const delta = direction * step;
        if (type === 'hours') updateHours(delta);
        else if (type === 'minutes') updateMinutes(delta);
        else updateSeconds(delta);
      }, 75);
    }, 300);
  }, [updateHours, updateMinutes, updateSeconds, stopHold]);

  const applyPreset = (mins: number, secs: number = 0) => {
    HapticService.selection();
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    setHours(h);
    setMinutes(m);
    setSeconds(secs);
    const totalSec = h * 3600 + m * 60 + secs;
    if (totalSec <= 0) {
      onChange(0);
    } else {
      onChange(totalSec / 60);
    }
  };

  const clearDuration = () => {
    HapticService.selection();
    setHours(0);
    setMinutes(0);
    setSeconds(0);
    onChange(0);
  };

  const isConfigured = (hours > 0 || minutes > 0 || seconds > 0) && duration !== 0;

  // Formatted string: e.g. "1 h 30 min"
  const formattedDisplay = (() => {
    if (!isConfigured || duration === 0) return 'Sin duración';
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
        background: 'var(--bg-material, rgba(255, 255, 255, 0.84))',
        border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
        borderRadius: 24,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        boxSizing: 'border-box',
        userSelect: 'none'
      }}
    >
      {/* Header con resumen de tiempo */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={16} color="var(--accent-primary, #007aff)" />
            <span style={{ fontSize: '0.88rem', fontWeight: 650, color: 'var(--text-primary)' }}>
              {label || 'Duración estimada'}
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
        {sublabel && (
          <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', paddingLeft: 22, lineHeight: 1.25 }}>
            {sublabel}
          </div>
        )}
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
            onPointerDown={() => startHold('hours', 1)}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            aria-label="Aumentar horas"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: 12,
              minWidth: 44,
              minHeight: 44,
              borderRadius: 10,
              transition: 'transform 0.15s ease, opacity 0.15s ease, background-color 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ChevronUp size={18} />
          </button>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={hours}
              onChange={(e) => {
                const val = parseInt(e.target.value.replace(/\D/g, ''), 10);
                const h = isNaN(val) ? 0 : Math.min(23, Math.max(0, val));
                setHours(h);
                commitChanges(h, minutes, seconds);
              }}
              aria-label="Horas"
              style={{
                width: '44px',
                minHeight: 44,
                textAlign: 'center',
                fontSize: '1.45rem',
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--text-primary)',
                background: 'transparent',
                border: 'none',
                borderRadius: 6,
                padding: 0,
                cursor: 'text'
              }}
            />
            <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              horas
            </span>
          </div>
          <button
            type="button"
            onPointerDown={() => hours > 0 && startHold('hours', -1)}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            disabled={hours <= 0}
            aria-label="Disminuir horas"
            style={{
              background: 'transparent',
              border: 'none',
              color: hours <= 0 ? 'var(--border-strong, #c7c7cc)' : 'var(--text-secondary)',
              cursor: hours <= 0 ? 'default' : 'pointer',
              padding: 12,
              minWidth: 44,
              minHeight: 44,
              borderRadius: 10,
              transition: 'transform 0.15s ease, opacity 0.15s ease, background-color 0.15s ease',
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
            onPointerDown={() => startHold('minutes', 1)}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            aria-label="Aumentar minutos"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: 12,
              minWidth: 44,
              minHeight: 44,
              borderRadius: 10,
              transition: 'transform 0.15s ease, opacity 0.15s ease, background-color 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ChevronUp size={18} />
          </button>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={minutes.toString().padStart(2, '0')}
              onChange={(e) => {
                const val = parseInt(e.target.value.replace(/\D/g, ''), 10);
                const m = isNaN(val) ? 0 : Math.min(59, Math.max(0, val));
                setMinutes(m);
                commitChanges(hours, m, seconds);
              }}
              aria-label="Minutos"
              style={{
                width: '44px',
                minHeight: 44,
                textAlign: 'center',
                fontSize: '1.45rem',
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--text-primary)',
                background: 'transparent',
                border: 'none',
                borderRadius: 6,
                padding: 0,
                cursor: 'text'
              }}
            />
            <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              min
            </span>
          </div>
          <button
            type="button"
            onPointerDown={() => (hours > 0 || minutes > 0) && startHold('minutes', -1)}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            disabled={hours === 0 && minutes <= 0}
            aria-label="Disminuir minutos"
            style={{
              background: 'transparent',
              border: 'none',
              color: hours === 0 && minutes <= 0 ? 'var(--border-strong, #c7c7cc)' : 'var(--text-secondary)',
              cursor: hours === 0 && minutes <= 0 ? 'default' : 'pointer',
              padding: 12,
              minWidth: 44,
              minHeight: 44,
              borderRadius: 10,
              transition: 'transform 0.15s ease, opacity 0.15s ease, background-color 0.15s ease',
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
            onPointerDown={() => startHold('seconds', 1)}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            aria-label="Aumentar segundos"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: 12,
              minWidth: 44,
              minHeight: 44,
              borderRadius: 10,
              transition: 'transform 0.15s ease, opacity 0.15s ease, background-color 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ChevronUp size={18} />
          </button>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={seconds.toString().padStart(2, '0')}
              onChange={(e) => {
                const val = parseInt(e.target.value.replace(/\D/g, ''), 10);
                const s = isNaN(val) ? 0 : Math.min(59, Math.max(0, val));
                setSeconds(s);
                commitChanges(hours, minutes, s);
              }}
              aria-label="Segundos"
              style={{
                width: '44px',
                minHeight: 44,
                textAlign: 'center',
                fontSize: '1.45rem',
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--text-primary)',
                background: 'transparent',
                border: 'none',
                borderRadius: 6,
                padding: 0,
                cursor: 'text'
              }}
            />
            <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              seg
            </span>
          </div>
          <button
            type="button"
            onPointerDown={() => (hours > 0 || minutes > 0 || seconds > 0) && startHold('seconds', -1)}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            disabled={hours === 0 && minutes === 0 && seconds <= 0}
            aria-label="Disminuir segundos"
            style={{
              background: 'transparent',
              border: 'none',
              color: hours === 0 && minutes === 0 && seconds <= 0 ? 'var(--border-strong, #c7c7cc)' : 'var(--text-secondary)',
              cursor: hours === 0 && minutes === 0 && seconds <= 0 ? 'default' : 'pointer',
              padding: 12,
              minWidth: 44,
              minHeight: 44,
              borderRadius: 10,
              transition: 'transform 0.15s ease, opacity 0.15s ease, background-color 0.15s ease',
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
        <button
          type="button"
          onClick={clearDuration}
          style={{
            padding: '8px 12px',
            minWidth: 44,
            minHeight: '44px',
            borderRadius: 999,
            fontSize: '0.76rem',
            fontWeight: duration === 0 ? 700 : 500,
            border: duration === 0 ? '1px solid var(--accent-red, #ff3b30)' : '1px solid var(--border-subtle)',
            background: duration === 0 ? 'rgba(255, 59, 48, 0.14)' : 'var(--bg-card, rgba(0,0,0,0.03))',
            color: duration === 0 ? 'var(--accent-red, #ff3b30)' : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease'
          }}
        >
          Sin duración
        </button>
        {(isParallel ? [
          { label: '20s', mins: 0, secs: 20 },
          { label: '30s', mins: 0, secs: 30 },
          { label: '1m', mins: 1, secs: 0 },
          { label: '2m', mins: 2, secs: 0 },
          { label: '5m', mins: 5, secs: 0 },
          { label: '10m', mins: 10, secs: 0 },
          { label: '15m', mins: 15, secs: 0 },
          { label: '30m', mins: 30, secs: 0 }
        ] : [
          { label: '5m', mins: 5, secs: 0 },
          { label: '15m', mins: 15, secs: 0 },
          { label: '25m', mins: 25, secs: 0 },
          { label: '30m', mins: 30, secs: 0 },
          { label: '45m', mins: 45, secs: 0 },
          { label: '1h', mins: 60, secs: 0 },
          { label: '1h 30m', mins: 90, secs: 0 },
          { label: '2h', mins: 120, secs: 0 }
        ]).map(p => {
          const targetMin = p.mins + (p.secs || 0) / 60;
          const isSelected = typeof duration === 'number' && Math.abs(duration - targetMin) < 0.005;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p.mins, p.secs)}
              style={{
                padding: '8px 12px',
                minWidth: 44,
                minHeight: '44px',
                borderRadius: 999,
                fontSize: '0.76rem',
                fontWeight: isSelected ? 700 : 500,
                border: isSelected ? '1px solid var(--accent-primary, #007aff)' : '1px solid var(--border-subtle)',
                background: isSelected ? 'var(--accent-primary, #007aff)' : 'var(--bg-card, rgba(0,0,0,0.03))',
                color: isSelected ? '#ffffff' : 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
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
              padding: '8px 12px',
              minWidth: 44,
              minHeight: 44,
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
