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
        padding: '4px 0 8px 0',
        borderTop: 'none',
        borderBottom: 'none',
        marginTop: 0,
        marginBottom: 4,
        background: 'transparent',
        // Una sola línea: periodo ‹ › y avance. En pantallas estrechas el avance baja sin romper el control.
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '4px 16px',
      }}
    >
      {/* Fila 1: Navegador temporal ocupando todo el ancho de la pantalla de lado a lado */}
      <div style={{ flex: '0 1 auto', minWidth: 0 }}>
        <ApplePeriodNavigator
          defaultPeriodicity={effPeriod}
          viewColor={viewColor}
          isMobile={isMobile}
          fullWidth={false}
        />
      </div>

      {/* Fila 2: Barra de progreso ultra-fina estilo Apple */}
      {/* A single count-first status replaces duplicate visual progress. */}

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
            aria-description={`${status.totalCompleted} de ${status.totalGoal} hechas. ${status.headline}`}
            className="cycle-status-text-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 6,
              minHeight: 44,
              padding: '0 4px',
              borderRadius: 10,
              border: 'none',
              background: 'transparent',
              color: status.isAllDone ? 'var(--accent-green-text, #248a3d)' : 'var(--label-2)',
              fontSize: 'var(--type-subhead)',
              fontWeight: 500,
              fontVariantNumeric: 'tabular-nums',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease, color 0.15s ease',
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
                  <span className="sr-only"> ({progressPercent}%)</span>
                </>
              )}
            </span>
            <span className="sr-only"> · </span>
            <span
              data-testid="cycle-status-headline"
              style={{
                fontWeight: 600,
                color: status.isAllDone ? '#34c759' : 'var(--text-secondary)',
                whiteSpace: 'normal',
                wordBreak: 'break-word',
              }} className={status.statusState === 'own_done_accumulated_pending' || status.statusState === 'accumulated_done_own_pending' ? 'status-exception' : 'sr-only'}
            >
              {status.isAllDone ? 'Objetivo completado' : status.headline}
            </span>
            <Info size={14} strokeWidth={2} aria-hidden="true" style={{ color: 'var(--label-3)', flexShrink: 0 }} />
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
