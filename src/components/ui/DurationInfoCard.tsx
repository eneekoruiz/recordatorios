import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Play, Zap } from 'lucide-react';
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
  // Cierra cualquier menú contextual previo al abrirse
  useEffect(() => {
    if (!isOpen) return;
    window.dispatchEvent(new Event('close-list-menus'));
    window.dispatchEvent(new Event('close-context-menus'));
  }, [isOpen]);

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

    if (!parts || parts.length <= 1) return null;

    return parts.map(p => {
      const partColor = p.periodicity === 'none'
        ? 'var(--text-secondary, #8e8e93)'
        : getReservedFrequencyColor(p.periodicity);
      const label = routinePeriodLabel(p.periodicity);
      const capitalized = label ? label.charAt(0).toUpperCase() + label.slice(1) : 'General';
      const pct = activeMinutes > 0 ? Math.min(100, Math.round((p.minutes / activeMinutes) * 100)) : 0;
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

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          className="duration-info-card-overlay"
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000005,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px 16px calc(24px + env(safe-area-inset-bottom, 0px))',
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
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
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
              maxWidth: 'min(410px, calc(100vw - 28px))',
              borderRadius: '26px',
              background: 'var(--bg-material, rgba(255, 255, 255, 0.84))',
              backdropFilter: 'blur(28px) saturate(160%)',
              WebkitBackdropFilter: 'blur(28px) saturate(160%)',
              color: 'var(--text-primary, #1c1c1e)',
              boxShadow: '0 28px 70px rgba(0, 0, 0, 0.32), 0 4px 16px rgba(0, 0, 0, 0.08)',
              border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: 'min(82vh, 540px)'
            }}
          >
            {/* Grabber pill para móviles */}
            <div
              style={{
                width: 36,
                height: 4.5,
                borderRadius: 999,
                background: 'var(--border-subtle, rgba(0,0,0,0.18))',
                margin: '10px auto 0',
                flexShrink: 0
              }}
            />

            {/* Cabecera */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 22px 14px',
                borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
                flexShrink: 0
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    background: `color-mix(in srgb, ${color} 15%, transparent)`,
                    color: color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <Clock size={18} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '1.02rem',
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
                      fontSize: '0.78rem',
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
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'var(--bg-tertiary, rgba(0,0,0,0.06))',
                  color: 'var(--text-secondary, #8e8e93)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'background-color 0.15s ease, transform 0.15s ease'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Contenido scrolleable */}
            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {/* Bloque principal de progreso: Anillo Apple Fitness + métricas */}
              <div
                style={{
                  background: 'var(--bg-secondary, rgba(0,0,0,0.03))',
                  borderRadius: '20px',
                  padding: '16px',
                  marginBottom: '18px',
                  border: '1px solid var(--border-subtle, rgba(0,0,0,0.05))',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16
                }}
              >
                {/* Anillo de actividad circular */}
                <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
                  <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
                    <circle
                      cx="36"
                      cy="36"
                      r="30"
                      fill="none"
                      stroke="var(--border-subtle, rgba(0,0,0,0.08))"
                      strokeWidth="7"
                    />
                    <circle
                      cx="36"
                      cy="36"
                      r="30"
                      fill="none"
                      stroke="#30d158"
                      strokeWidth="7"
                      strokeDasharray={2 * Math.PI * 30}
                      strokeDashoffset={2 * Math.PI * 30 * (1 - (progressPercent / 100))}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 0.5s cubic-bezier(0.16,1,0.3,1)' }}
                    />
                  </svg>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.80rem',
                      fontWeight: 800,
                      fontVariantNumeric: 'tabular-nums',
                      color: progressPercent > 0 ? '#30d158' : 'var(--text-secondary)'
                    }}
                  >
                    {progressPercent}%
                  </div>
                </div>

                {/* Métricas al lado del anillo */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 650, color: 'var(--text-tertiary, #8e8e93)' }}>
                    Tiempo activo restante
                  </span>
                  <div style={{ fontSize: '1.55rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: color, letterSpacing: '-0.03em', lineHeight: 1.15, marginTop: 1 }}>
                    ~{totalSummary.formattedActive}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                    <span>{pendingCount ? `${pendingCount} pendientes` : 'Pendientes'}</span>
                    {completedMinutes > 0 && (
                      <>
                        <span>·</span>
                        <span style={{ color: '#30d158', fontWeight: 600 }}>~{completedSummary?.formattedActive} hechos</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Desglose por frecuencias si existe */}
              {breakdownRows && breakdownRows.length > 0 ? (
                <div>
                  <h4
                    style={{
                      margin: '0 0 8px 12px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: 'var(--text-secondary, #8e8e93)'
                    }}
                  >
                    Desglose por frecuencia
                  </h4>
                  <div className="ios-list-block" style={{ marginBottom: 16 }}>
                    {breakdownRows.map((row, i) => (
                      <React.Fragment key={row.key}>
                        <div
                          className="ios-list-item"
                          style={{
                            padding: '12px 16px',
                            minHeight: 52,
                            borderRadius: 0,
                            margin: 0
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                            <span
                              style={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                background: row.color,
                                flexShrink: 0
                              }}
                            />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: '0.98rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                                {row.label}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                {row.count} {row.count === 1 ? 'tarea' : 'tareas'}
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                              {row.formatted || '0 min'}
                            </div>
                            {row.percent > 0 && (
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                {row.percent}% del total
                              </div>
                            )}
                          </div>
                        </div>
                        {i < breakdownRows.length - 1 && (
                          <div style={{ height: 1, background: 'var(--border-subtle)', marginLeft: 40 }} />
                        )}
                      </React.Fragment>
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
                    transition: 'transform 0.15s ease, opacity 0.15s ease, box-shadow 0.15s ease'
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
    </AnimatePresence>,
    document.body
  );
};
