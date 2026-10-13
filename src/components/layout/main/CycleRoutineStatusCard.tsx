import React, { useState, useMemo } from 'react';
import { CheckCircle2 } from 'lucide-react';
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
  /** Duración de la vista: va al principio de la segunda línea, junto al progreso. */
  durationNode?: React.ReactNode;
  /** Botón «Rutina completa»: va en la misma línea que el periodo, a la derecha. */
  routineToggle?: React.ReactNode;
}

export const CycleRoutineStatusCard: React.FC<CycleRoutineStatusCardProps> = ({
  currentCycle,
  cycleRoutineMode,
  viewColor,
  isMobile = false,
  durationNode,
  routineToggle,
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
        padding: isMobile ? '4px 0 10px 0' : '6px 0 12px 0',
        borderTop: currentCycle.id === 'cycle_day' ? '0.5px solid var(--separator)' : 'none',
        borderBottom: '0.5px solid var(--separator)',
        marginTop: currentCycle.id === 'cycle_day' ? 6 : 0,
        marginBottom: 12,
        background: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, fill 0.2s ease, opacity 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease',
      }}
    >
      {/* Línea 1, bajo el título: duración · progreso (el progreso abre el diagnóstico). */}
      {(durationNode || status.totalGoal > 0) && (
        <div className="cycle-strip-meta">
          {durationNode}
          {durationNode && status.totalGoal > 0 && <span className="section-head-dot" aria-hidden="true">·</span>}
          {status.totalGoal > 0 && (
            <button
              type="button"
              data-testid="cycle-status-pill-btn"
              className={`cycle-strip-status${status.isAllDone ? ' is-done' : ''}`}
              onClick={() => {
                HapticService.selection();
                setIsDiagnosticModalOpen(true);
              }}
              title="Ver el detalle de la rutina"
              aria-label={`${status.statusState === 'all_done' ? 'Todo al día' : `${status.totalCompleted} de ${status.totalGoal} hechas`}. Ver el detalle de la rutina`}
              aria-description={status.headline}
            >
              {status.isAllDone && <CheckCircle2 size={13} strokeWidth={2.4} aria-hidden="true" />}
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
              {(status.statusState === 'own_done_accumulated_pending' || status.statusState === 'accumulated_done_own_pending') && (
                <span data-testid="cycle-status-headline" className="status-exception">· {status.headline}</span>
              )}
            </button>
          )}
        </div>
      )}

      {/* Línea 2: periodo (‹ Octubre 2026 ›) y, a la derecha, «Rutina completa». */}
      <div className="cycle-strip-row">
        <ApplePeriodNavigator
          defaultPeriodicity={effPeriod}
          viewColor={viewColor}
          isMobile={isMobile}
          fullWidth={false}
        />
        {routineToggle}
      </div>

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
