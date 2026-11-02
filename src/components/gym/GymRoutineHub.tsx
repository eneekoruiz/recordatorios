import { Check, ChevronRight } from 'lucide-react';
import { HapticService } from '../../services/HapticService';
import type { TrainingDayStatus } from '../../utils/trainingDays';

export interface GymHubDay {
  id: string;
  /** «Día 1» */
  shortName: string;
  /** «Tren Superior A» */
  focus: string;
  status: TrainingDayStatus;
  doneThisWeek: boolean;
  exercises: number;
  duration?: string;
}

interface GymRoutineHubProps {
  days: GymHubDay[];
  splitName: string;
  /** Hoy se ha elegido a mano (no es el que tocaba por rotación). */
  isManualPick: boolean;
  onSelectDay: (dayId: string) => void;
  onResetDay: () => void;
  onOpenRoutines: () => void;
}

/**
 * Cabecera de la rutina del Gimnasio: qué toca hoy, cuánto es y cómo va la semana. Una sola fuente
 * de «hoy» (antes cada día llevaba su etiqueta y su botón «Hacer hoy»). Las pastillas de los días
 * sirven para cambiar el entreno de hoy con un toque, como el selector de semana de Fitness.
 */
export function GymRoutineHub({ days, splitName, isManualPick, onSelectDay, onResetDay, onOpenRoutines }: GymRoutineHubProps) {
  const today = days.find(d => d.status === 'today' || d.status === 'done_today');
  if (!today) return null;
  const doneToday = today.status === 'done_today';
  const doneCount = days.filter(d => d.doneThisWeek).length;
  const meta = [`${today.exercises} ${today.exercises === 1 ? 'ejercicio' : 'ejercicios'}`, today.duration].filter(Boolean).join(' · ');

  return (
    <section className="gym-hub" aria-label="Entreno de hoy" data-testid="gym-hub">
      <div className="gym-hub-top">
        <span className={`gym-hub-eyebrow${doneToday ? ' is-done' : ''}`}>
          {doneToday ? <><Check size={13} strokeWidth={2.8} aria-hidden="true" /> Hecho hoy</> : 'Hoy'}
        </span>
        <button type="button" className="gym-hub-split hit-44" onClick={onOpenRoutines} aria-label={`Rutina: ${splitName}. Cambiar de rutina`}>
          {splitName}
          <ChevronRight size={14} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>

      <h2 className="gym-hub-title" data-testid="gym-hub-title">
        {today.shortName}
        {today.focus && <span className="gym-hub-focus"> · {today.focus}</span>}
      </h2>
      <p className="gym-hub-meta">
        {meta}
        {isManualPick && (
          <>
            {' · '}
            <button type="button" className="gym-hub-reset" onClick={onResetDay}>Volver al que tocaba</button>
          </>
        )}
      </p>

      <div className="gym-hub-week">
        <div className="gym-hub-days" role="radiogroup" aria-label="Entreno de hoy">
          {days.map(day => {
            const isToday = day.id === today.id;
            return (
              <button
                key={day.id}
                type="button"
                role="radio"
                aria-checked={isToday}
                aria-label={`${day.shortName}: ${day.focus}${day.doneThisWeek ? ', hecho esta semana' : ''}`}
                className={`gym-hub-day${isToday ? ' is-today' : ''}${day.doneThisWeek ? ' is-done' : ''}`}
                onClick={() => {
                  if (isToday) return;
                  HapticService.selection();
                  onSelectDay(day.id);
                }}
              >
                {day.doneThisWeek ? <Check size={15} strokeWidth={3} aria-hidden="true" /> : day.shortName.replace(/\D+/g, '') || '·'}
              </button>
            );
          })}
        </div>
        <span className="gym-hub-progress" aria-live="polite">
          <strong>{doneCount} de {days.length}</strong>
          <span>esta semana</span>
        </span>
      </div>
    </section>
  );
}
