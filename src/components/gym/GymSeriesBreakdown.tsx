import React from 'react';
import { Check } from 'lucide-react';
import type { TaskItem } from '../../models/Task';
import { HapticService } from '../../services/HapticService';
import { SoundService } from '../../services/SoundService';
import { RestRowTimer } from './RestRowTimer';

interface GymSeriesBreakdownProps {
  task: TaskItem;
  effectiveCurrentCount: number;
  onToggle: (id: string, forceReverse?: boolean, customTimestamp?: number | Date) => void;
  updateTask: (id: string, updates: Partial<TaskItem>) => void;
}

/**
 * Desglose interactivo serie a serie para ejercicios de gimnasio:
 * Muestra cada serie como un paso individual con su checkbox, duración y peso registrado,
 * e intercala los cronómetros de descanso entre series con selector directo de tiempo.
 */
export const GymSeriesBreakdown: React.FC<GymSeriesBreakdownProps> = ({
  task,
  effectiveCurrentCount,
  onToggle,
  updateTask
}) => {
  const sets = Math.min(12, Math.max(1, task.targetCount || 1));
  const workMin = task.duration && task.duration > 0 ? task.duration : 1;
  const restSec = task.restDuration && task.restDuration > 0 ? task.restDuration : 75;
  const logs = task.weightLogs || [];

  const handleToggleSet = (setNumber: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (setNumber <= effectiveCurrentCount) {
      // Si toca la última serie completada (o una anterior), retrocede
      HapticService.selection();
      SoundService.playUncomplete();
      onToggle(task.id, true);
    } else {
      // Avanza al siguiente paso
      HapticService.impact('light');
      SoundService.playPop();
      onToggle(task.id, false);
    }
  };

  const rows: React.ReactNode[] = [];

  for (let s = 1; s <= sets; s++) {
    const isDone = s <= effectiveCurrentCount;
    const isCurrent = s === effectiveCurrentCount + 1;
    const log = logs.find(l => l.set === s) || (s <= logs.length ? logs[s - 1] : undefined);

    rows.push(
      <div
        key={`set-${s}`}
        className={`gym-series-row${isDone ? ' is-done' : ''}${isCurrent ? ' is-current' : ''}`}
        onClick={(e) => handleToggleSet(s, e)}
        role="button"
        tabIndex={0}
        aria-label={`Serie ${s} de ${sets}. ${isDone ? 'Completada' : 'Pendiente'}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggleSet(s, e as any);
          }
        }}
      >
        <span className={`gym-series-check hit-44${isDone ? ' is-done' : ''}`} aria-hidden="true">
          {isDone ? <Check size={12} strokeWidth={3} /> : <span className="gym-series-check-dot" />}
        </span>
        <div className="gym-series-info">
          <span className="gym-series-title">Serie {s} de {sets}</span>
          <span className="gym-series-meta">
            {workMin} min
            {log?.weightKg ? ` · ${log.weightKg} kg` : ''}
            {log?.reps ? ` × ${log.reps}` : ''}
          </span>
        </div>
      </div>
    );

    // Descanso entre series (solo entre una serie y la siguiente)
    if (s < sets) {
      rows.push(
        <div key={`rest-${s}`} className="gym-series-rest-container" onClick={(e) => e.stopPropagation()}>
          <RestRowTimer
            title={`Descanso serie ${s}`}
            minutes={restSec / 60}
            onChangeMinutes={(min) => updateTask(task.id, { restDuration: Math.round(min * 60) })}
          />
        </div>
      );
    }
  }

  return (
    <div className="gym-series-breakdown" onClick={(e) => e.stopPropagation()}>
      {rows}
    </div>
  );
};
