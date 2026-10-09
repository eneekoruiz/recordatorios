import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Layers } from 'lucide-react';
import { HapticService } from '../../../services/HapticService';
import type { CycleRoutineStatus } from '../../../utils/cycleRoutineStatus';
import type { CustomCycle } from '../../../models/Task';

interface RoutineDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: CycleRoutineStatus;
  currentCycle: CustomCycle;
  cycleRoutineMode: 'only_section' | 'full_routine';
  viewColor: string;
  referenceDate: Date;
  isMobile?: boolean;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export const RoutineDiagnosticModal: React.FC<RoutineDiagnosticModalProps> = ({
  isOpen,
  onClose,
  status,
  currentCycle,
  cycleRoutineMode,
  viewColor,
  referenceDate,
  isMobile = false,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        HapticService.selection();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const periodLabel = useMemo(() => {
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();
    if (currentCycle.id === 'cycle_year') return `Año ${year}`;
    if (currentCycle.id === 'cycle_month') return `${MONTH_NAMES[month]} ${year}`;
    if (currentCycle.id === 'cycle_week') {
      const d = new Date(Date.UTC(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
      return `Semana ${weekNo} (${year})`;
    }
    return referenceDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
  }, [referenceDate, currentCycle.id]);

  const progressPercent = useMemo(() => {
    if (status.totalGoal === 0) return 0;
    return Math.min(100, Math.round((status.totalCompleted / status.totalGoal) * 100));
  }, [status.totalGoal, status.totalCompleted]);

  const ownPercent = useMemo(() => {
    if (status.ownTotal === 0) return 0;
    return Math.min(100, Math.round((status.ownCompleted / status.ownTotal) * 100));
  }, [status.ownTotal, status.ownCompleted]);



  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div
          data-testid="routine-diagnostic-modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: isMobile ? 'flex-end' : 'center',
            justifyContent: 'center',
            padding: isMobile ? 0 : 20,
            background: 'rgba(0, 0, 0, 0.42)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              HapticService.selection();
              onClose();
            }
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Diagnóstico de rutina ${status.ownCycleName}`}
            data-testid="routine-diagnostic-modal"
            initial={{ opacity: 0, scale: isMobile ? 1 : 0.95, y: isMobile ? '100%' : 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: isMobile ? 1 : 0.95, y: isMobile ? '100%' : 15 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            style={{
              width: '100%',
              maxWidth: 480,
              maxHeight: isMobile ? '90vh' : '86vh',
              overflowY: 'auto',
              background: 'var(--bg-material, rgba(255, 255, 255, 0.92))',
              backdropFilter: 'blur(40px) saturate(190%)',
              WebkitBackdropFilter: 'blur(40px) saturate(190%)',
              borderRadius: isMobile ? '24px 24px 0 0' : 24,
              border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.1))',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.22), 0 8px 24px rgba(0, 0, 0, 0.1)',
              padding: isMobile ? '20px 18px 28px 18px' : '24px 24px 26px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              boxSizing: 'border-box',
              color: 'var(--text-primary)',
            }}
          >
            {/* Header con icono, título y botón cerrar estilo Apple */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: `color-mix(in srgb, ${viewColor} 15%, transparent)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: viewColor,
                    flexShrink: 0,
                  }}
                >
                  <Layers size={18} strokeWidth={2.4} />
                </div>
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '1.08rem',
                      fontWeight: 700,
                      letterSpacing: '-0.02em',
                      lineHeight: 1.25,
                    }}
                  >
                    Diagnóstico de Rutina
                  </h3>
                  <p
                    style={{
                      margin: '2px 0 0 0',
                      fontSize: '0.80rem',
                      color: 'var(--text-secondary)',
                      fontWeight: 500,
                    }}
                  >
                    {status.ownCycleName} · {periodLabel}
                  </p>
                </div>
              </div>

              <button
                type="button"
                data-testid="routine-diagnostic-close-btn"
                onClick={() => {
                  HapticService.selection();
                  onClose();
                }}
                title="Cerrar"
                aria-label="Cerrar diagnóstico"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'var(--border-subtle, rgba(0, 0, 0, 0.08))',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'opacity 0.15s ease',
                  flexShrink: 0,
                }}
              >
                <X size={15} strokeWidth={2.4} />
              </button>
            </div>

            {/* Tarjeta hero con porcentaje de cumplimiento y mensaje principal */}
            <div
              style={{
                borderRadius: 18,
                padding: '16px 18px',
                background: status.isAllDone
                  ? 'color-mix(in srgb, #34c759 12%, transparent)'
                  : `color-mix(in srgb, ${viewColor} 8%, transparent)`,
                border: `1px solid ${status.isAllDone ? 'rgba(52, 199, 89, 0.3)' : `color-mix(in srgb, ${viewColor} 20%, transparent)`}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <span
                  style={{
                    fontSize: '2rem',
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                    lineHeight: 1,
                    color: status.isAllDone ? '#34c759' : viewColor,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {progressPercent}%
                </span>
                <span
                  style={{
                    fontSize: '0.84rem',
                    fontWeight: 650,
                    color: 'var(--text-secondary)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {status.totalCompleted} de {status.totalGoal} completadas
                </span>
              </div>

              {/* Barra de progreso */}
              <div
                style={{
                  width: '100%',
                  height: 6,
                  borderRadius: 999,
                  background: 'var(--separator, rgba(60, 60, 67, 0.12))',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${progressPercent}%`,
                    background: status.isAllDone ? '#34c759' : viewColor,
                    borderRadius: 999,
                    transition: 'width 0.35s ease',
                  }}
                />
              </div>

              <div style={{ marginTop: 2 }}>
                <div
                  style={{
                    fontSize: '0.90rem',
                    fontWeight: 700,
                    color: status.isAllDone ? '#34c759' : 'var(--text-primary)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {status.headline}
                </div>
                <div
                  style={{
                    fontSize: '0.80rem',
                    color: 'var(--text-secondary)',
                    marginTop: 3,
                    lineHeight: 1.35,
                  }}
                >
                  {status.detailText}
                </div>
              </div>
            </div>

            {/* Desglose detallado por secciones de rutina */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--text-tertiary)',
                  paddingLeft: 2,
                }}
              >
                Desglose del Período
              </span>

              {/* Bloque 1: Tareas propias del ciclo */}
              <div
                style={{
                  borderRadius: 14,
                  padding: '12px 14px',
                  background: 'var(--card-bg, rgba(255, 255, 255, 0.6))',
                  border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: status.isOwnDone ? '#34c759' : viewColor,
                      }}
                    />
                    <span style={{ fontSize: '0.86rem', fontWeight: 650 }}>
                      {status.ownCycleName}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: status.isOwnDone ? 'rgba(52, 199, 89, 0.15)' : 'rgba(0, 0, 0, 0.06)',
                      color: status.isOwnDone ? '#34c759' : 'var(--text-secondary)',
                    }}
                  >
                    {status.isOwnDone ? 'Al día ✓' : `${status.ownCompleted}/${status.ownTotal}`}
                  </span>
                </div>

                <div
                  style={{
                    width: '100%',
                    height: 4,
                    borderRadius: 999,
                    background: 'var(--separator, rgba(60, 60, 67, 0.12))',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${ownPercent}%`,
                      background: status.isOwnDone ? '#34c759' : viewColor,
                      borderRadius: 999,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>

              {/* Desglose individual de cada frecuencia no-propia */}
              {cycleRoutineMode === 'full_routine' && status.otherBreakdown && status.otherBreakdown.length > 0 && (
                status.otherBreakdown.map((item) => {
                  const percent = item.total > 0 ? Math.min(100, Math.round((item.completed / item.total) * 100)) : 0;
                  const itemColor = item.color || (item.cycleId === 'cycle_day' ? '#ff9500' : item.cycleId === 'cycle_week' ? '#af52de' : item.cycleId === 'cycle_month' ? '#007aff' : '#ff2d55');

                  return (
                    <div
                      key={item.cycleId}
                      style={{
                        borderRadius: 14,
                        padding: '12px 14px',
                        background: 'var(--card-bg, rgba(255, 255, 255, 0.6))',
                        border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: item.isDone ? '#34c759' : itemColor,
                            }}
                          />
                          <span style={{ fontSize: '0.86rem', fontWeight: 650 }}>
                            {item.name}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 999,
                            background: item.isDone ? 'rgba(52, 199, 89, 0.15)' : 'rgba(0, 0, 0, 0.06)',
                            color: item.isDone ? '#34c759' : 'var(--text-secondary)',
                          }}
                        >
                          {item.isDone ? 'Al día ✓' : `${item.completed}/${item.total} (${item.pending} ${item.pending === 1 ? 'pendiente' : 'pendientes'})`}
                        </span>
                      </div>

                      <div
                        style={{
                          width: '100%',
                          height: 4,
                          borderRadius: 999,
                          background: 'var(--separator, rgba(60, 60, 67, 0.12))',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${percent}%`,
                            background: item.isDone ? '#34c759' : itemColor,
                            borderRadius: 999,
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Nota informativa estilo Apple */}
            <div
              style={{
                fontSize: '0.76rem',
                color: 'var(--text-tertiary)',
                lineHeight: 1.4,
                padding: '0 4px',
              }}
            >
              Cada frecuencia se evalúa de forma independiente para el período correspondiente ({periodLabel}). Al comenzar un nuevo período, las tareas se reinician automáticamente para ese ciclo.
            </div>

            {/* Botón principal inferior */}
            <button
              type="button"
              onClick={() => {
                HapticService.selection();
                onClose();
              }}
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: 14,
                border: 'none',
                background: viewColor,
                color: '#ffffff',
                fontWeight: 650,
                fontSize: '0.88rem',
                cursor: 'pointer',
                letterSpacing: '-0.01em',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
                transition: 'opacity 0.15s ease',
              }}
            >
              Entendido
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
