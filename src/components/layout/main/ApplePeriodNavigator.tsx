import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar,
  RotateCcw,

  X,
  History,

} from 'lucide-react';
import { useTemporalNavigationStore, type TemporalGranularity } from '../../../store/useTemporalNavigationStore';
import { HapticService } from '../../../services/HapticService';
import type { PeriodicityType } from '../../../utils/sectionRoutine';

interface ApplePeriodNavigatorProps {
  /** Periodicidad por defecto de la vista actual (ej. 'year' en Anual, 'month' en Mensual, etc.) */
  defaultPeriodicity?: PeriodicityType | null;
  /** Color temático de la vista para acentos y resaltados */
  viewColor?: string;
  /** Clases adicionales */
  className?: string;
  /** Estilos en línea */
  style?: React.CSSProperties;
  /** Si es en vista móvil para ajustar espaciado */
  isMobile?: boolean;
  /** Modo solo lectura (muestra la cápsula del período/mes sin botones de navegación ni selector emergente) */
  readOnly?: boolean;
  /** Si debe extenderse a todo el ancho disponible */
  fullWidth?: boolean;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
const MONTH_SHORTS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const DAY_SHORTS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export const ApplePeriodNavigator: React.FC<ApplePeriodNavigatorProps> = ({
  defaultPeriodicity = 'month',
  viewColor = '#007aff',
  className = '',
  style = {},
  isMobile = false,
  readOnly = false,
  fullWidth = false,
}) => {
  const {
    temporalDate,
    granularity,
    setTemporalDate,
    setGranularity,
    resetToNow,
    stepPeriod,
    isCurrentRealTime
  } = useTemporalNavigationStore();

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Sincronizar granularidad con la periodicidad por defecto de la vista
  useEffect(() => {
    if (defaultPeriodicity) {
      const g: TemporalGranularity =
        defaultPeriodicity === 'year' ? 'year' :
        defaultPeriodicity === 'week' ? 'week' :
        defaultPeriodicity === 'day' ? 'day' : 'month';
      setGranularity(g);
    }
  }, [defaultPeriodicity, setGranularity]);

  // Determinar la granularidad efectiva (el estado de navegación manda, con respaldo en la vista)
  const effGranularity: TemporalGranularity =
    granularity ||
    (defaultPeriodicity as TemporalGranularity) ||
    'month';

  const activeDate = useMemo(() => (temporalDate ? new Date(temporalDate) : new Date()), [temporalDate]);
  const isRealTime = isCurrentRealTime(effGranularity);
  const isPast = useMemo(() => {
    if (!temporalDate) return false;
    const now = new Date();
    if (effGranularity === 'year') {
      return activeDate.getFullYear() < now.getFullYear();
    }
    if (effGranularity === 'month') {
      return activeDate.getFullYear() < now.getFullYear() ||
        (activeDate.getFullYear() === now.getFullYear() && activeDate.getMonth() < now.getMonth());
    }
    if (effGranularity === 'week') {
      const getMonday = (d: Date) => {
        const copy = new Date(d);
        const day = copy.getDay();
        const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
        copy.setDate(diff);
        copy.setHours(0, 0, 0, 0);
        return copy.getTime();
      };
      return getMonday(activeDate) < getMonday(now);
    }
    // day
    const d1 = new Date(activeDate); d1.setHours(0, 0, 0, 0);
    const d2 = new Date(now); d2.setHours(0, 0, 0, 0);
    return d1.getTime() < d2.getTime();
  }, [temporalDate, activeDate, effGranularity]);

  // Cerrar al pulsar fuera o al pulsar Escape
  useEffect(() => {
    if (!isPickerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsPickerOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsPickerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPickerOpen]);

  // Formato del título principal según granularidad
  const getFormattedLabel = (): string => {
    const year = activeDate.getFullYear();
    const month = activeDate.getMonth();
    const day = activeDate.getDate();
    const dayName = DAY_SHORTS[activeDate.getDay()];
    const mShort = MONTH_SHORTS[month];

    if (effGranularity === 'year') {
      return `${year}`;
    }

    if (effGranularity === 'month') {
      return `${MONTH_NAMES[month]} ${year}`;
    }

    if (effGranularity === 'week') {
      // Calcular número de semana ISO y rango
      const monday = new Date(activeDate);
      const dayIdx = monday.getDay();
      const diff = monday.getDate() - dayIdx + (dayIdx === 0 ? -6 : 1);
      monday.setDate(diff);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const d = new Date(Date.UTC(activeDate.getFullYear(), activeDate.getMonth(), activeDate.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

      const rangeText = monday.getMonth() === sunday.getMonth()
        ? `${monday.getDate()}–${sunday.getDate()} ${MONTH_SHORTS[sunday.getMonth()]}`
        : `${monday.getDate()} ${MONTH_SHORTS[monday.getMonth()]}–${sunday.getDate()} ${MONTH_SHORTS[sunday.getMonth()]}`;

      return `Semana ${weekNo} (${rangeText})`;
    }

    // 'day'
    if (isRealTime) {
      return `Hoy, ${day} ${mShort}`;
    }
    return `${dayName} ${day} ${mShort} ${year}`;
  };

  const handleStep = (direction: -1 | 1, e: React.MouseEvent) => {
    e.stopPropagation();
    HapticService.selection();
    stepPeriod(direction, effGranularity);
  };

  const handleOpenPicker = (e: React.MouseEvent) => {
    e.stopPropagation();
    HapticService.selection();
    setIsPickerOpen(!isPickerOpen);
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    HapticService.notification('success');
    resetToNow();
    setIsPickerOpen(false);
  };

  // Posicionamiento del popover
  const [popoverCoords, setPopoverCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  useEffect(() => {
    if (isPickerOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const popoverWidth = Math.min(340, window.innerWidth - 24);
      let left = rect.left;
      if (left + popoverWidth > window.innerWidth - 12) {
        left = window.innerWidth - popoverWidth - 12;
      }
      if (left < 12) left = 12;
      setPopoverCoords({
        top: rect.bottom + 8,
        left
      });
    }
  }, [isPickerOpen]);

  if (readOnly) {
    return (
      <div
        data-testid="apple-period-navigator-readonly"
        className={`apple-period-navigator-capsule apple-period-readonly ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '2px 8px',
          borderRadius: 999,
          background: 'var(--bg-material, rgba(255, 255, 255, 0.75))',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.1))',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          fontSize: isMobile ? '0.74rem' : '0.78rem',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          letterSpacing: '-0.01em',
          userSelect: 'none',
          flexShrink: 0,
          ...style
        }}
        title={`Mes actual: ${getFormattedLabel()}`}
        aria-label={`Mes actual: ${getFormattedLabel()}`}
      >
        <Calendar size={12} strokeWidth={2} style={{ opacity: 0.75 }} />
        <span>{getFormattedLabel()}</span>
      </div>
    );
  }

  return (
    <>
      <div
        ref={triggerRef}
        data-testid="apple-period-navigator"
        className={`apple-period-navigator-capsule ${className}`}
        style={{
          display: fullWidth ? 'flex' : 'inline-flex',
          width: fullWidth ? '100%' : undefined,
          justifyContent: fullWidth ? 'space-between' : undefined,
          boxSizing: 'border-box',
          alignItems: 'center',
          gap: 2,
          padding: fullWidth ? '3px 6px' : '2px 4px',
          borderRadius: 999,
          background: 'var(--bg-material, rgba(255, 255, 255, 0.75))',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.1))',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(0, 0, 0, 0.03)',
          transition: 'all 0.2s cubic-bezier(0.25, 1, 0.5, 1)',
          userSelect: 'none',
          flexShrink: 0,
          ...style
        }}
      >
        {/* Flecha anterior */}
        <button
          type="button"
          data-testid="apple-period-prev-btn"
          onClick={(e) => handleStep(-1, e)}
          title="Período anterior"
          aria-label="Período anterior"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            borderRadius: '50%',
            border: 'none',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: 0,
            flexShrink: 0,
            transition: 'background 0.15s ease, color 0.15s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.06)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <ChevronLeft size={14} strokeWidth={2.2} />
        </button>

        {/* Botón central trigger con etiqueta de fecha */}
        <button
          type="button"
          data-testid="apple-period-trigger-btn"
          onClick={handleOpenPicker}
          title="Toca para navegar por fecha, semana, mes o año"
          aria-label={`Fecha actual: ${getFormattedLabel()}. Toca para cambiar.`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: fullWidth ? 'center' : 'flex-start',
            flex: fullWidth ? 1 : undefined,
            gap: 5,
            padding: '2px 7px',
            borderRadius: 999,
            border: 'none',
            background: isRealTime ? 'transparent' : `color-mix(in srgb, ${viewColor} 12%, transparent)`,
            color: isRealTime ? 'var(--text-primary)' : viewColor,
            cursor: 'pointer',
            fontSize: isMobile ? '0.74rem' : '0.78rem',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            transition: 'background 0.15s ease, color 0.15s ease'
          }}
          onMouseEnter={(e) => { if (isRealTime) e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
          onMouseLeave={(e) => { if (isRealTime) e.currentTarget.style.background = 'transparent'; }}
        >
          {isRealTime ? (
            <Calendar size={12} strokeWidth={2} style={{ opacity: 0.8 }} />
          ) : (
            <History size={12} strokeWidth={2.2} />
          )}

          <span>{getFormattedLabel()}</span>

          {!isRealTime && (
            <span
              style={{
                fontSize: '0.66rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '1px 5px',
                borderRadius: 999,
                background: `color-mix(in srgb, ${viewColor} 20%, transparent)`,
                color: viewColor,
                letterSpacing: '0.02em',
                lineHeight: 1
              }}
            >
              {isPast ? 'Histórico' : 'Futuro'}
            </span>
          )}

          <ChevronDown
            size={11}
            strokeWidth={2.2}
            style={{
              opacity: 0.6,
              transform: isPickerOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s ease'
            }}
          />
        </button>

        {/* Flecha siguiente */}
        <button
          type="button"
          data-testid="apple-period-next-btn"
          onClick={(e) => handleStep(1, e)}
          title="Período siguiente"
          aria-label="Período siguiente"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            borderRadius: '50%',
            border: 'none',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: 0,
            transition: 'background 0.15s ease, color 0.15s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.06)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <ChevronRight size={14} strokeWidth={2.2} />
        </button>

        {/* Si no estamos en tiempo real, mostrar botón rápido de volver a hoy */}
        {!isRealTime && (
          <button
            type="button"
            data-testid="apple-period-reset-quick-btn"
            onClick={handleReset}
            title="Volver a la fecha actual"
            aria-label="Volver a la fecha actual"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 2,
              padding: '2px 6px',
              borderRadius: 999,
              border: `1px solid color-mix(in srgb, ${viewColor} 30%, transparent)`,
              background: `color-mix(in srgb, ${viewColor} 10%, transparent)`,
              color: viewColor,
              fontSize: '0.68rem',
              fontWeight: 650,
              cursor: 'pointer',
              gap: 3
            }}
          >
            <RotateCcw size={10} strokeWidth={2.5} />
            <span>Hoy</span>
          </button>
        )}
      </div>

      {/* Popover selector Apple */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isPickerOpen && (
            <>
              {/* Scrim invisible para clics fuera */}
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 999990,
                  background: 'transparent'
                }}
                onClick={() => setIsPickerOpen(false)}
              />

              <motion.div
                ref={popoverRef}
                data-testid="apple-period-picker-popover"
                initial={{ opacity: 0, scale: 0.96, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -4 }}
                transition={{ type: 'spring', damping: 28, stiffness: 420 }}
                style={{
                  position: 'fixed',
                  top: popoverCoords.top,
                  left: popoverCoords.left,
                  zIndex: 999995,
                  width: Math.min(340, window.innerWidth - 24),
                  background: 'var(--bg-elevated, #ffffff)',
                  backdropFilter: 'blur(40px) saturate(190%)',
                  WebkitBackdropFilter: 'blur(40px) saturate(190%)',
                  borderRadius: 18,
                  border: '1px solid var(--border-subtle, rgba(0,0,0,0.12))',
                  boxShadow: '0 16px 40px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.08)',
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  boxSizing: 'border-box'
                }}
              >
                {/* Cabecera del popover: Selector segmentado de granularidad */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <div
                    style={{
                      display: 'flex',
                      background: 'var(--bg-surface, rgba(0,0,0,0.06))',
                      padding: 2,
                      borderRadius: 10,
                      flex: 1
                    }}
                  >
                    {(['year', 'month', 'week', 'day'] as TemporalGranularity[]).map((g) => {
                      const isSelected = effGranularity === g;
                      const gLabel = g === 'year' ? 'Año' : g === 'month' ? 'Mes' : g === 'week' ? 'Semana' : 'Día';
                      return (
                        <button
                          key={g}
                          type="button"
                          data-testid={`apple-granularity-${g}`}
                          onClick={() => {
                            HapticService.selection();
                            setGranularity(g);
                          }}
                          style={{
                            flex: 1,
                            padding: '4px 6px',
                            border: 'none',
                            borderRadius: 8,
                            background: isSelected ? 'var(--bg-elevated, #ffffff)' : 'transparent',
                            color: isSelected ? 'var(--text-primary)' : 'var(--text-tertiary)',
                            boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                            fontSize: '0.74rem',
                            fontWeight: isSelected ? 650 : 500,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {gLabel}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsPickerOpen(false)}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      border: 'none',
                      background: 'var(--bg-surface, rgba(0,0,0,0.06))',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Contenido según la granularidad seleccionada */}

                {/* 1. VISTA DE AÑO */}
                {effGranularity === 'year' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 650, color: 'var(--text-secondary)' }}>
                        Seleccionar Año
                      </span>
                      <span style={{ fontSize: '0.74rem', color: viewColor, fontWeight: 600 }}>
                        {activeDate.getFullYear()}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                      {[2023, 2024, 2025, 2026, 2027, 2028].map((yr) => {
                        const isCurrentYear = yr === activeDate.getFullYear();
                        const isRealCurrentYear = yr === new Date().getFullYear();
                        return (
                          <button
                            key={yr}
                            type="button"
                            data-testid={`apple-year-btn-${yr}`}
                            onClick={() => {
                              HapticService.selection();
                              const next = new Date(activeDate);
                              next.setFullYear(yr);
                              setTemporalDate(next);
                            }}
                            style={{
                              padding: '8px 4px',
                              borderRadius: 10,
                              border: isCurrentYear ? `1.5px solid ${viewColor}` : '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                              background: isCurrentYear ? `color-mix(in srgb, ${viewColor} 12%, transparent)` : 'var(--bg-surface, rgba(0,0,0,0.02))',
                              color: isCurrentYear ? viewColor : 'var(--text-primary)',
                              fontSize: '0.86rem',
                              fontWeight: isCurrentYear ? 700 : 500,
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 2
                            }}
                          >
                            <span>{yr}</span>
                            {isRealCurrentYear && (
                              <span style={{ fontSize: '0.62rem', opacity: 0.7, fontWeight: 500 }}>
                                (Actual)
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 2. VISTA DE MES */}
                {effGranularity === 'month' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Selector de año del mes */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const next = new Date(activeDate);
                          next.setFullYear(next.getFullYear() - 1);
                          setTemporalDate(next);
                        }}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {activeDate.getFullYear()}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = new Date(activeDate);
                          next.setFullYear(next.getFullYear() + 1);
                          setTemporalDate(next);
                        }}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                      {MONTH_SHORTS.map((mShort, idx) => {
                        const isSelectedMonth = idx === activeDate.getMonth();
                        const isRealMonth = idx === new Date().getMonth() && activeDate.getFullYear() === new Date().getFullYear();
                        return (
                          <button
                            key={mShort}
                            type="button"
                            data-testid={`apple-month-btn-${idx}`}
                            onClick={() => {
                              HapticService.selection();
                              const next = new Date(activeDate);
                              next.setDate(1);
                              next.setMonth(idx);
                              setTemporalDate(next);
                            }}
                            style={{
                              padding: '8px 2px',
                              borderRadius: 10,
                              border: isSelectedMonth ? `1.5px solid ${viewColor}` : '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                              background: isSelectedMonth ? `color-mix(in srgb, ${viewColor} 12%, transparent)` : 'var(--bg-surface, rgba(0,0,0,0.02))',
                              color: isSelectedMonth ? viewColor : 'var(--text-primary)',
                              fontSize: '0.82rem',
                              fontWeight: isSelectedMonth ? 700 : 500,
                              cursor: 'pointer'
                            }}
                          >
                            <div>{mShort}</div>
                            {isRealMonth && (
                              <div style={{ width: 4, height: 4, borderRadius: '50%', background: viewColor, margin: '2px auto 0' }} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. VISTA DE SEMANA */}
                {effGranularity === 'week' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 650, color: 'var(--text-secondary)', padding: '0 4px' }}>
                      Navegación Semanal
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {[-1, 0, 1].map((offset) => {
                        const target = new Date(activeDate);
                        target.setDate(target.getDate() + offset * 7);

                        const monday = new Date(target);
                        const dayIdx = monday.getDay();
                        const diff = monday.getDate() - dayIdx + (dayIdx === 0 ? -6 : 1);
                        monday.setDate(diff);
                        const sunday = new Date(monday);
                        sunday.setDate(monday.getDate() + 6);

                        const isTargetSelected = offset === 0;

                        return (
                          <button
                            key={offset}
                            type="button"
                            onClick={() => {
                              if (offset !== 0) {
                                HapticService.selection();
                                setTemporalDate(target);
                              }
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 12px',
                              borderRadius: 12,
                              border: isTargetSelected ? `1.5px solid ${viewColor}` : '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                              background: isTargetSelected ? `color-mix(in srgb, ${viewColor} 12%, transparent)` : 'var(--bg-surface, rgba(0,0,0,0.02))',
                              color: isTargetSelected ? viewColor : 'var(--text-primary)',
                              cursor: 'pointer'
                            }}
                          >
                            <span style={{ fontSize: '0.82rem', fontWeight: isTargetSelected ? 700 : 500 }}>
                              {offset === -1 ? 'Semana anterior' : offset === 0 ? 'Semana seleccionada' : 'Semana siguiente'}
                            </span>
                            <span style={{ fontSize: '0.76rem', color: 'var(--text-tertiary)' }}>
                              {monday.getDate()} {MONTH_SHORTS[monday.getMonth()]} – {sunday.getDate()} {MONTH_SHORTS[sunday.getMonth()]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 4. VISTA DE DÍA */}
                {effGranularity === 'day' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[-1, 0, 1].map((offset) => {
                        const d = new Date();
                        d.setDate(d.getDate() + offset);
                        const isMatch = activeDate.toDateString() === d.toDateString();
                        const label = offset === -1 ? 'Ayer' : offset === 0 ? 'Hoy' : 'Mañana';
                        return (
                          <button
                            key={offset}
                            type="button"
                            onClick={() => {
                              HapticService.selection();
                              if (offset === 0) {
                                resetToNow();
                              } else {
                                setTemporalDate(d);
                              }
                            }}
                            style={{
                              flex: 1,
                              padding: '8px 4px',
                              borderRadius: 10,
                              border: isMatch ? `1.5px solid ${viewColor}` : '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                              background: isMatch ? `color-mix(in srgb, ${viewColor} 12%, transparent)` : 'var(--bg-surface, rgba(0,0,0,0.02))',
                              color: isMatch ? viewColor : 'var(--text-primary)',
                              fontSize: '0.82rem',
                              fontWeight: isMatch ? 700 : 500,
                              cursor: 'pointer'
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        Elegir fecha específica:
                      </label>
                      <input
                        type="date"
                        data-testid="apple-period-date-input"
                        value={activeDate.toISOString().split('T')[0]}
                        onChange={(e) => {
                          if (e.target.value) {
                            HapticService.selection();
                            const [y, m, day] = e.target.value.split('-').map(Number);
                            const chosen = new Date(y, m - 1, day);
                            setTemporalDate(chosen);
                          }
                        }}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 10,
                          border: '1px solid var(--border-subtle, rgba(0,0,0,0.12))',
                          background: 'var(--bg-surface, rgba(0,0,0,0.04))',
                          color: 'var(--text-primary)',
                          fontSize: '0.84rem',
                          fontFamily: 'inherit',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Pie del popover: Botón de volver a hoy y cerrar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: 8,
                    borderTop: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                    marginTop: 2
                  }}
                >
                  <button
                    type="button"
                    onClick={handleReset}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 8px',
                      borderRadius: 8,
                      border: 'none',
                      background: 'transparent',
                      color: viewColor,
                      fontSize: '0.78rem',
                      fontWeight: 650,
                      cursor: 'pointer'
                    }}
                  >
                    <RotateCcw size={12} strokeWidth={2.5} />
                    <span>Volver a Hoy</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsPickerOpen(false)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 8,
                      border: 'none',
                      background: viewColor,
                      color: 'white',
                      fontSize: '0.78rem',
                      fontWeight: 650,
                      cursor: 'pointer'
                    }}
                  >
                    Listo
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};
