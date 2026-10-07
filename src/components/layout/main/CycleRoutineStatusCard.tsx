import React, { useMemo } from 'react';
import { CheckCircle2, Clock, Sparkles, Calendar } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { useTemporalNavigationStore } from '../../../store/useTemporalNavigationStore';
import { ApplePeriodNavigator } from './ApplePeriodNavigator';
import { calculateCycleRoutineStatus } from '../../../utils/cycleRoutineStatus';
import type { CustomCycle } from '../../../models/Task';
import type { PeriodicityType } from '../../../utils/sectionRoutine';

interface CycleRoutineStatusCardProps {
  currentCycle: CustomCycle;
  cycleRoutineMode: 'only_section' | 'full_routine';
  viewColor: string;
  isMobile?: boolean;
}

export const CycleRoutineStatusCard: React.FC<CycleRoutineStatusCardProps> = ({
  currentCycle,
  cycleRoutineMode,
  viewColor,
  isMobile = false,
}) => {
  const tasks = useAppStore((state) => state.tasks);
  const cycles = useAppStore((state) => state.cycles);
  const listSections = useAppStore((state) => state.listSections);
  const lists = useAppStore((state) => state.lists);
  const temporalDate = useTemporalNavigationStore((state) => state.temporalDate);

  const referenceDate = useMemo(() => {
    return temporalDate ? new Date(temporalDate) : new Date();
  }, [temporalDate]);

  const effPeriod: PeriodicityType = useMemo(() => {
    if (currentCycle.id === 'cycle_day') return 'day';
    if (currentCycle.id === 'cycle_week') return 'week';
    if (currentCycle.id === 'cycle_month') return 'month';
    if (currentCycle.id === 'cycle_year') return 'year';
    return 'month';
  }, [currentCycle.id]);

  const status = useMemo(() => {
    return calculateCycleRoutineStatus({
      tasks,
      cycles,
      listSections,
      lists,
      currentCycle,
      cycleRoutineMode,
      referenceDate,
    });
  }, [tasks, cycles, listSections, lists, currentCycle, cycleRoutineMode, referenceDate]);

  // Icono y color según el estado
  const { statusIcon, statusColor, statusBadgeBg } = useMemo(() => {
    if (status.statusState === 'all_done') {
      return {
        statusIcon: <CheckCircle2 size={13} strokeWidth={2.4} />,
        statusColor: '#34c759',
        statusBadgeBg: 'color-mix(in srgb, #34c759 12%, transparent)',
      };
    }
    if (status.statusState === 'own_done_accumulated_pending') {
      return {
        statusIcon: <Clock size={13} strokeWidth={2.2} />,
        statusColor: viewColor,
        statusBadgeBg: `color-mix(in srgb, ${viewColor} 12%, transparent)`,
      };
    }
    if (status.statusState === 'accumulated_done_own_pending') {
      return {
        statusIcon: <Sparkles size={13} strokeWidth={2.2} />,
        statusColor: '#ff9500',
        statusBadgeBg: 'color-mix(in srgb, #ff9500 12%, transparent)',
      };
    }
    if (status.statusState === 'both_pending' || status.statusState === 'own_pending') {
      return {
        statusIcon: <Clock size={13} strokeWidth={2.2} />,
        statusColor: 'var(--text-secondary)',
        statusBadgeBg: 'color-mix(in srgb, var(--text-primary) 8%, transparent)',
      };
    }
    return {
      statusIcon: <Calendar size={13} strokeWidth={2} />,
      statusColor: 'var(--text-tertiary)',
      statusBadgeBg: 'transparent',
    };
  }, [status.statusState, viewColor]);

  const progressPercent = useMemo(() => {
    if (status.totalGoal === 0) return 0;
    return Math.min(100, Math.round((status.totalCompleted / status.totalGoal) * 100));
  }, [status.totalGoal, status.totalCompleted]);

  return (
    <div
      data-testid="cycle-routine-status-card"
      className="cycle-routine-status-card"
      style={{
        width: '100%',
        boxSizing: 'border-box',
        marginTop: 6,
        marginBottom: 8,
        padding: isMobile ? '8px 10px' : '10px 14px',
        borderRadius: 14,
        background: 'var(--bg-secondary, rgba(0, 0, 0, 0.025))',
        border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        transition: 'all 0.2s ease',
      }}
    >
      {/* Fila superior: Navegador de período a la izquierda + Resumen pill a la derecha */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ApplePeriodNavigator
            defaultPeriodicity={effPeriod}
            viewColor={viewColor}
            isMobile={isMobile}
          />
        </div>

        {status.totalGoal > 0 && (
          <div
            data-testid="cycle-status-badge"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: '0.74rem',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 999,
              color: statusColor,
              background: statusBadgeBg,
              letterSpacing: '-0.01em',
              flexShrink: 0,
            }}
          >
            {statusIcon}
            <span>
              {status.statusState === 'all_done'
                ? 'Completado'
                : `${status.totalCompleted}/${status.totalGoal} (${progressPercent}%)`}
            </span>
          </div>
        )}
      </div>

      {/* Fila central: Diagnóstico exacto y claro */}
      {status.totalGoal > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div
            data-testid="cycle-status-headline"
            style={{
              fontSize: isMobile ? '0.80rem' : '0.84rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>{status.headline}</span>
          </div>

          <div
            style={{
              fontSize: isMobile ? '0.72rem' : '0.76rem',
              color: 'var(--text-secondary)',
              letterSpacing: '-0.005em',
            }}
          >
            {status.detailText}
          </div>

          {/* Chips de desglose específico: Propias vs Acumuladas */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'wrap',
              marginTop: 4,
            }}
          >
            {/* Chip de tareas propias */}
            <span
              style={{
                fontSize: '0.70rem',
                fontWeight: 600,
                color: status.isOwnDone ? '#34c759' : viewColor,
                background: status.isOwnDone
                  ? 'color-mix(in srgb, #34c759 10%, transparent)'
                  : `color-mix(in srgb, ${viewColor} 10%, transparent)`,
                padding: '1px 6px',
                borderRadius: 6,
              }}
            >
              ● {status.ownCycleName}: {status.ownCompleted}/{status.ownTotal} hechas
            </span>

            {/* Chip de tareas acumuladas (solo en rutina completa si existen) */}
            {cycleRoutineMode === 'full_routine' && status.accumulatedTotal > 0 && (
              <span
                style={{
                  fontSize: '0.70rem',
                  fontWeight: 600,
                  color: status.isAccumulatedDone ? '#34c759' : 'var(--accent-orange, #ff9500)',
                  background: status.isAccumulatedDone
                    ? 'color-mix(in srgb, #34c759 10%, transparent)'
                    : 'color-mix(in srgb, #ff9500 10%, transparent)',
                  padding: '1px 6px',
                  borderRadius: 6,
                }}
              >
                ● Acumuladas: {status.accumulatedCompleted}/{status.accumulatedTotal} hechas
              </span>
            )}

            {/* Chip de qué falta exactamente */}
            {status.totalPending > 0 && status.missingSummary && (
              <span
                style={{
                  fontSize: '0.70rem',
                  fontWeight: 500,
                  color: 'var(--text-tertiary)',
                  marginLeft: 2,
                }}
              >
                ({status.missingSummary})
              </span>
            )}
          </div>

          {/* Mini barra de progreso Apple */}
          <div
            style={{
              width: '100%',
              height: 3,
              borderRadius: 999,
              background: 'var(--border-subtle, rgba(0, 0, 0, 0.06))',
              overflow: 'hidden',
              marginTop: 4,
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progressPercent}%`,
                background: status.isAllDone ? '#34c759' : viewColor,
                borderRadius: 999,
                transition: 'width 0.3s cubic-bezier(0.25, 1, 0.5, 1)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
