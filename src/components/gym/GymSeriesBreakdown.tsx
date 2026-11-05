import React, { useState } from 'react';
import { Check, Dumbbell, Sparkles, ChevronRight } from 'lucide-react';
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
 * - Cada serie es un paso con su checkbox y duración.
 * - Al completar una serie, arranca automáticamente el temporizador de descanso.
 * - Muestra una tarjeta destacada e intuitiva para registrar el peso y reps de la serie.
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

  // Último peso registrado o default
  const lastLoggedWeight = logs.length > 0 ? (logs[logs.length - 1].weightKg || 40) : 40;
  const lastLoggedReps = logs.length > 0 ? (logs[logs.length - 1].reps || 10) : 10;

  const [activeRestSet, setActiveRestSet] = useState<number | null>(null);
  const [loggingSet, setLoggingSet] = useState<number | null>(null);
  const [currentWeight, setCurrentWeight] = useState<number>(lastLoggedWeight);
  const [currentReps, setCurrentReps] = useState<number>(lastLoggedReps);

  const handleToggleSet = (setNumber: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (setNumber <= effectiveCurrentCount) {
      // Si toca la serie ya hecha, desmarca
      HapticService.selection();
      SoundService.playUncomplete();
      onToggle(task.id, true);
      if (loggingSet === setNumber) setLoggingSet(null);
      if (activeRestSet === setNumber) setActiveRestSet(null);
    } else {
      // Avanza y abre registro + arranca descanso automático
      HapticService.impact('medium');
      SoundService.playPop();
      onToggle(task.id, false);

      // Precargar datos del log previo si existe
      const existing = logs.find(l => l.set === setNumber);
      setCurrentWeight(existing?.weightKg || lastLoggedWeight);
      setCurrentReps(existing?.reps || lastLoggedReps);

      // Mostrar tarjeta de registro para esta serie
      setLoggingSet(setNumber);
      // Auto-arrancar el descanso de esta serie si no es la última
      if (setNumber < sets) {
        setActiveRestSet(setNumber);
      }
    }
  };

  const handleSaveLog = (setNumber: number, e: React.MouseEvent) => {
    e.stopPropagation();
    HapticService.notification('success');
    SoundService.playComplete();

    const cleanLogs = (task.weightLogs || []).filter(l => l.set !== setNumber);
    cleanLogs.push({
      set: setNumber,
      weightKg: currentWeight,
      reps: currentReps,
      date: new Date().toISOString()
    });
    cleanLogs.sort((a, b) => a.set - b.set);

    updateTask(task.id, { weightLogs: cleanLogs });
    setLoggingSet(null);
  };

  const handleAdjustWeight = (delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    HapticService.selection();
    setCurrentWeight(prev => Math.max(0, Math.round((prev + delta) * 2) / 2));
  };

  const handleAdjustReps = (delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    HapticService.selection();
    setCurrentReps(prev => Math.max(1, prev + delta));
  };

  const rows: React.ReactNode[] = [];

  for (let s = 1; s <= sets; s++) {
    const isDone = s <= effectiveCurrentCount;
    const isCurrent = s === effectiveCurrentCount + 1;
    const log = logs.find(l => l.set === s) || (s <= logs.length ? logs[s - 1] : undefined);
    const isLoggingThisSet = loggingSet === s;

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

    // Tarjeta destacada de registro de peso / repeticiones durante el descanso
    if (isLoggingThisSet) {
      rows.push(
        <div key={`log-card-${s}`} className="gym-set-log-card" onClick={(e) => e.stopPropagation()}>
          <div className="gym-set-log-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Dumbbell size={15} color="var(--rest-accent, #ff9f0a)" />
              <span className="gym-set-log-title">Serie {s} completada · Registra tu carga</span>
            </div>
            <button
              type="button"
              className="gym-set-log-skip hit-44"
              onClick={(e) => { e.stopPropagation(); setLoggingSet(null); }}
              aria-label="Omitir registro"
            >
              Omitir
            </button>
          </div>

          <div className="gym-set-log-row">
            <span className="gym-set-log-label">Peso:</span>
            <div className="gym-set-log-btn-group">
              <button type="button" className="gym-set-adjust-btn" onClick={(e) => handleAdjustWeight(-5, e)}>-5</button>
              <button type="button" className="gym-set-adjust-btn" onClick={(e) => handleAdjustWeight(-2.5, e)}>-2.5</button>
              <span className="gym-set-val-badge">{currentWeight} kg</span>
              <button type="button" className="gym-set-adjust-btn" onClick={(e) => handleAdjustWeight(2.5, e)}>+2.5</button>
              <button type="button" className="gym-set-adjust-btn" onClick={(e) => handleAdjustWeight(5, e)}>+5</button>
            </div>
          </div>

          <div className="gym-set-log-row">
            <span className="gym-set-log-label">Reps:</span>
            <div className="gym-set-log-btn-group">
              <button type="button" className="gym-set-adjust-btn" onClick={(e) => handleAdjustReps(-1, e)}>-1</button>
              <span className="gym-set-val-badge">{currentReps} reps</span>
              <button type="button" className="gym-set-adjust-btn" onClick={(e) => handleAdjustReps(1, e)}>+1</button>
            </div>
          </div>

          <button
            type="button"
            className="gym-set-log-confirm-btn hit-44"
            onClick={(e) => handleSaveLog(s, e)}
          >
            <Sparkles size={14} />
            <span>Guardar {currentWeight} kg × {currentReps} reps</span>
            <ChevronRight size={14} />
          </button>
        </div>
      );
    }

    // Descanso entre series con auto-arranque y notificación
    if (s < sets) {
      rows.push(
        <div key={`rest-${s}`} className="gym-series-rest-container" onClick={(e) => e.stopPropagation()}>
          <RestRowTimer
            title={`Descanso serie ${s}`}
            minutes={restSec / 60}
            autoStart={activeRestSet === s}
            onFinished={() => setActiveRestSet(null)}
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
