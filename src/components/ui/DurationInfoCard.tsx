import React, { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Play, CheckCircle2, Zap } from 'lucide-react';
import type { TasksDurationSummary } from '../../utils/taskDuration';
import { formatDuration } from '../../utils/taskDuration';
import type { RoutinePart } from '../../utils/routineBreakdown';
import { routinePeriodLabel } from '../../utils/routineBreakdown';
import { getReservedFrequencyColor } from '../../constants/colors';
import { HapticService } from '../../services/HapticService';

export interface DurationInfoCardProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  color?: string;
  totalSummary: TasksDurationSummary;
  completedSummary?: TasksDurationSummary;
  routineParts?: RoutinePart[] | null;
  mixParts?: RoutinePart[] | null;
  onStartSequence?: () => void;
  pendingCount?: number;
}

export const DurationInfoCard: React.FC<DurationInfoCardProps> = ({
  isOpen,
  onClose,
  title = 'Inversión de tiempo',
  color = '#007aff',
  totalSummary,
  completedSummary,
  routineParts,
  mixParts,
  onStartSequence,
  pendingCount
}) => {
  // Manejo de tecla Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const activeMinutes = totalSummary?.activeMinutes || 0;
  const completedMinutes = completedSummary?.activeMinutes || 0;
  const grandTotalMinutes = activeMinutes + completedMinutes;
  const progressPercent = grandTotalMinutes > 0 ? Math.round((completedMinutes / grandTotalMinutes) * 100) : 0;

  // Extraer las partes para el desglose
  const breakdownRows = useMemo(() => {
    const parts = (routineParts && routineParts.length > 0)
      ? routineParts
      : (mixParts && mixParts.length > 0)
        ? mixParts
        : null;

    if (!parts) return null;

    return parts.map(p => {
      const partColor = p.periodicity === 'none'
        ? 'var(--text-secondary, #8e8e93)'
        : getReservedFrequencyColor(p.periodicity);
      const label = routinePeriodLabel(p.periodicity);
      const capitalized = label ? label.charAt(0).toUpperCase() + label.slice(1) : 'General';
      const pct = activeMinutes > 0 ? Math.round((p.minutes / activeMinutes) * 100) : 0;
      return {
        key: p.periodicity,
        label: capitalized,
        color: partColor,
        count: p.count,
        minutes: p.minutes,
        formatted: formatDuration(p.minutes),
        percent: pct
      };
    });
  }, [routineParts, mixParts, activeMinutes]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            pointerEvents: 'auto'
          }}
        >
          {/* Backdrop con blur profundo Apple */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)'
            }}
          />

          {/* Tarjeta modal flotante */}
          <motion.div
            role="dialog"
            aria-label={`Desglose de tiempo de ${title}`}
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', damping: 28, stiffness: 360 }}
            onClick={e => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '440px',
              borderRadius: '26px',
              background: 'var(--bg-elevated, #ffffff)',
              color: 'var(--text-primary, #1c1c1e)',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.28), 0 4px 16px rgba(0, 0, 0, 0.08)',
              border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh'
            }}
          >
            {/* Cabecera */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 22px 14px',
                borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.06))'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: `color-mix(in srgb, ${color} 15%, transparent)`,
                    color: color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <Clock size={19} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '1.05rem',
                      fontWeight: 700,
                      letterSpacing: '-0.02em',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {title}
                  </h3>
                  <p
                    style={{
                      margin: '1px 0 0',
                      fontSize: '0.80rem',
                      color: 'var(--text-secondary, #8e8e93)',
                      fontWeight: 500
                    }}
                  >
                    Resumen de tiempo estimado
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'var(--bg-tertiary, rgba(0,0,0,0.06))',
                  color: 'var(--text-secondary, #8e8e93)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.15s ease'
                }}
              >
                <X size={17} />
              </button>
            </div>

            {/* Contenido scrolleable */}
            <div style={{ padding: '20px 22px', overflowY: 'auto' }}>
              {/* Bloque principal de progreso Screen Time / Apple Health */}
              <div
                style={{
                  background: 'var(--bg-secondary, rgba(0,0,0,0.03))',
                  borderRadius: '18px',
                  padding: '16px 18px',
                  marginBottom: '20px',
                  border: '1px solid var(--border-subtle, rgba(0,0,0,0.04))'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, color: 'var(--text-tertiary, #8e8e93)' }}>
                      Tiempo restante
                    </span>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: color, letterSpacing: '-0.03em', lineHeight: 1.2 }}>
                      ~{totalSummary.formattedActive}
                    </div>
                  </div>
                  {completedMinutes > 0 && (
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, color: 'var(--text-tertiary, #8e8e93)' }}>
                        Completado
                      </span>
                      <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#30d158', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                        <CheckCircle2 size={16} /> ~{completedSummary?.formattedActive}
                      </div>
                    </div>
                  )}
                </div>

                {/* Barra de progreso interactiva */}
                {grandTotalMinutes > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div
                      style={{
                        height: 8,
                        borderRadius: 999,
                        background: 'var(--border-subtle, rgba(0,0,0,0.08))',
                        overflow: 'hidden',
                        display: 'flex'
                      }}
                    >
                      {completedMinutes > 0 && (
                        <div
                          style={{
                            width: `${progressPercent}%`,
                            background: '#30d158',
                            transition: 'width 0.4s ease'
                          }}
                        />
                      )}
                      <div
                        style={{
                          width: `${100 - progressPercent}%`,
                          background: color,
                          opacity: 0.9,
                          transition: 'width 0.4s ease'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.74rem', color: 'var(--text-secondary, #8e8e93)', fontWeight: 500 }}>
                      <span>{pendingCount ? `${pendingCount} recordatorios pendientes` : 'Pendientes'}</span>
                      {completedMinutes > 0 && <span>{progressPercent}% de la rutina completada</span>}
                    </div>
                  </div>
                )}
              </div>

              {/* Desglose por frecuencias si existe */}
              {breakdownRows && breakdownRows.length > 0 ? (
                <div>
                  <h4
                    style={{
                      margin: '0 0 12px',
                      fontSize: '0.82rem',
                      fontWeight: 650,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: 'var(--text-tertiary, #8e8e93)'
                    }}
                  >
                    Desglose por frecuencia
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {breakdownRows.map(row => (
                      <div
                        key={row.key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '14px',
                          background: 'var(--bg-secondary, rgba(0,0,0,0.025))',
                          border: '1px solid var(--border-subtle, rgba(0,0,0,0.04))'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              background: row.color,
                              flexShrink: 0
                            }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.90rem', fontWeight: 600 }}>
                              {row.label}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #8e8e93)' }}>
                              {row.count} {row.count === 1 ? 'tarea' : 'tareas'}
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.92rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                            {row.formatted}
                          </div>
                          {row.percent > 0 && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary, #8e8e93)' }}>
                              {row.percent}% del total
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary, #8e8e93)', lineHeight: 1.5, textAlign: 'center', padding: '12px 0' }}>
                  Todas las tareas de esta vista están programadas con la misma periodicidad.
                </div>
              )}

              {/* Tareas en segundo plano (paralelo) */}
              {totalSummary.parallelTasksCount > 0 && (
                <div
                  style={{
                    marginTop: 18,
                    padding: '12px 14px',
                    borderRadius: '14px',
                    background: 'rgba(0, 122, 255, 0.08)',
                    border: '1px solid rgba(0, 122, 255, 0.16)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10
                  }}
                >
                  <Zap size={18} color="#007aff" style={{ flexShrink: 0 }} />
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-primary, #1c1c1e)', lineHeight: 1.4 }}>
                    <strong>{totalSummary.parallelTasksCount} {totalSummary.parallelTasksCount === 1 ? 'tarea' : 'tareas'} en segundo plano</strong> (lavadora, lavavajillas...): suman <strong>~{totalSummary.formattedParallel}</strong> pasivos que transcurren en paralelo sin bloquear tu tiempo activo.
                  </div>
                </div>
              )}
            </div>

            {/* Pie de acción: Botón Empezar */}
            {onStartSequence && activeMinutes > 0 && (
              <div
                style={{
                  padding: '14px 22px 20px',
                  borderTop: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
                  background: 'var(--bg-elevated, #ffffff)'
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    HapticService.selection();
                    onClose();
                    onStartSequence();
                  }}
                  style={{
                    width: '100%',
                    height: 46,
                    borderRadius: '14px',
                    background: color,
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: `0 4px 16px ${color}40`,
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Play size={16} fill="white" />
                  Empezar ahora ({totalSummary.formattedActive})
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
