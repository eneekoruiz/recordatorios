import React, { useState, useMemo } from 'react';
import { CheckCircle2, Clock, Sparkles, Calendar, Info } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { useTemporalNavigationStore } from '../../../store/useTemporalNavigationStore';
import { ApplePeriodNavigator } from './ApplePeriodNavigator';
import { RoutineDiagnosticModal } from './RoutineDiagnosticModal';
import { calculateCycleRoutineStatus } from '../../../utils/cycleRoutineStatus';
import { HapticService } from '../../../services/HapticService';
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
  const [isDiagnosticModalOpen, setIsDiagnosticModalOpen] = useState(false);

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
      {/* Fila 1: Navegador temporal ocupando todo el ancho de la pantalla de lado a lado */}
      <div style={{ width: '100%' }}>
        <ApplePeriodNavigator
          defaultPeriodicity={effPeriod}
          viewColor={viewColor}
          isMobile={isMobile}
          fullWidth={true}
        />
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

      {/* Fila 3: Píldora interactiva compacta estilo Apple que abre el modal de diagnóstico */}
      {status.totalGoal > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            data-testid="cycle-status-pill-btn"
            onClick={() => {
              HapticService.selection();
              setIsDiagnosticModalOpen(true);
            }}
            title="Toca para ver el desglose detallado de la rutina"
            aria-label="Ver diagnóstico detallado de la rutina"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 999,
              border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
              background: 'var(--bg-material, rgba(255, 255, 255, 0.65))',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              color: status.isAllDone ? '#34c759' : 'var(--text-primary)',
              fontSize: isMobile ? '0.76rem' : '0.80rem',
              fontWeight: 600,
              letterSpacing: '-0.01em',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
              transition: 'all 0.15s ease',
              maxWidth: '100%',
            }}
          >
            {statusIcon}
            <span data-testid="cycle-status-badge">
              {status.statusState === 'all_done' ? (
                'Todo al día'
              ) : (
                <>
                  <span>{status.totalCompleted} de {status.totalGoal} hechas</span>
                  <span style={{ color: viewColor, marginLeft: 3 }}>({progressPercent}%)</span>
                </>
              )}
            </span>
            <span style={{ opacity: 0.35, margin: '0 2px' }}>·</span>
            <span
              data-testid="cycle-status-headline"
              style={{
                fontWeight: 600,
                color: status.isAllDone ? '#34c759' : 'var(--text-secondary)',
                whiteSpace: 'normal',
                wordBreak: 'break-word',
              }}
            >
              {status.isAllDone ? 'Objetivo completado' : status.headline}
            </span>
            <Info size={12} strokeWidth={2.2} style={{ opacity: 0.55, marginLeft: 2, flexShrink: 0 }} />
          </button>
        </div>
      )}

      {/* Modal Apple de Diagnóstico detallado */}
      <RoutineDiagnosticModal
        isOpen={isDiagnosticModalOpen}
        onClose={() => setIsDiagnosticModalOpen(false)}
        status={status}
        currentCycle={currentCycle}
        cycleRoutineMode={cycleRoutineMode}
        viewColor={viewColor}
        referenceDate={referenceDate}
        isMobile={isMobile}
      />
    </div>
  );
};
