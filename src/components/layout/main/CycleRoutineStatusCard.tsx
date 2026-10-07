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

  // Icono según el estado
  const statusIcon = useMemo(() => {
    if (status.statusState === 'all_done') {
      return <CheckCircle2 size={13} strokeWidth={2.4} color="#34c759" />;
    }
    if (status.statusState === 'own_done_accumulated_pending') {
      return <Clock size={13} strokeWidth={2.2} color={viewColor} />;
    }
    if (status.statusState === 'accumulated_done_own_pending') {
      return <Sparkles size={13} strokeWidth={2.2} color="#ff9500" />;
    }
    if (status.statusState === 'both_pending' || status.statusState === 'own_pending') {
      return <Clock size={13} strokeWidth={2.2} color="var(--text-secondary)" />;
    }
    return <Calendar size={13} strokeWidth={2} color="var(--text-tertiary)" />;
  }, [status.statusState, viewColor]);

  const progressPercent = useMemo(() => {
    if (status.totalGoal === 0) return 0;
    return Math.min(100, Math.round((status.totalCompleted / status.totalGoal) * 100));
  }, [status.totalGoal, status.totalCompleted]);

  return (
    <div
      data-testid="cycle-routine-status-card"
      className="cycle-routine-status-strip"
      style={{
        width: '100%',
        boxSizing: 'border-box',
        padding: isMobile ? '8px 0 12px 0' : '10px 0 14px 0',
        borderTop: currentCycle.id === 'cycle_day' ? '0.5px solid var(--separator)' : 'none',
        borderBottom: '0.5px solid var(--separator)',
        marginTop: currentCycle.id === 'cycle_day' ? 6 : 0,
        marginBottom: 12,
        background: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        transition: 'all 0.2s ease',
      }}
    >
      {/* Fila 1: Navegador de período a la izquierda + Resumen métrico sutil a la derecha */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
          minHeight: 28,
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
              fontSize: isMobile ? '0.78rem' : '0.82rem',
              fontWeight: 600,
              color: status.statusState === 'all_done' ? '#34c759' : 'var(--text-secondary)',
              letterSpacing: '-0.01em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {statusIcon}
            <span>
              {status.statusState === 'all_done' ? (
                'Todo al día'
              ) : (
                <>
                  <span>{status.totalCompleted} de {status.totalGoal} hechas</span>
                  <span style={{ color: viewColor, marginLeft: 4 }}>({progressPercent}%)</span>
                </>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Fila 2: Barra de progreso ultra-fina estilo Apple */}
      {status.totalGoal > 0 && (
        <div
          style={{
            width: '100%',
            height: 3,
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
              transition: 'width 0.35s cubic-bezier(0.25, 1, 0.5, 1)',
            }}
          />
        </div>
      )}

      {/* Fila 3: Diagnóstico limpio y tipográfico sin cajas ni redundancias */}
      {status.totalGoal > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap',
            fontSize: isMobile ? '0.76rem' : '0.80rem',
            letterSpacing: '-0.01em',
            lineHeight: 1.35,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span
              data-testid="cycle-status-headline"
              style={{
                fontWeight: 650,
                color: status.isAllDone
                  ? '#34c759'
                  : status.statusState === 'own_done_accumulated_pending'
                  ? viewColor
                  : 'var(--text-primary)',
              }}
            >
              {status.headline}
            </span>

            <span style={{ opacity: 0.35, color: 'var(--text-tertiary)' }}>·</span>

            <span style={{ color: 'var(--text-secondary)', fontWeight: 450 }}>
              {status.detailText}
            </span>
          </div>

          {/* Si estamos en rutina completa con acumuladas, mostrar desglose sintético */}
          {cycleRoutineMode === 'full_routine' && status.accumulatedTotal > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.72rem',
                fontWeight: 600,
                color: 'var(--text-tertiary)',
              }}
            >
              <span style={{ color: status.isOwnDone ? '#34c759' : viewColor }}>
                ● {status.ownCycleName}: {status.ownCompleted}/{status.ownTotal}
              </span>
              <span style={{ opacity: 0.35 }}>·</span>
              <span style={{ color: status.isAccumulatedDone ? '#34c759' : '#ff9500' }}>
                ● Acumuladas: {status.accumulatedCompleted}/{status.accumulatedTotal}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
