import { useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
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
  /** Hoy se ha elegido a mano (no es el que tocaba por rotación). */
  isManualPick: boolean;
  onSelectDay: (dayId: string) => void;
  onResetDay: () => void;
  /** Ejercicios del día, para verlo entero sin tener que recordar qué era «Día 3». */
  renderDayPreview?: (dayId: string) => ReactNode;
}

/**
 * Entreno de hoy en dos líneas: qué día toca y, a la derecha, los días de la rutina (verde = hecho esta
 * semana, anillo = hoy). Tocar un día lo hace el de hoy; tocar la tarjeta despliega sus ejercicios.
 */
export function GymRoutineHub({ days, isManualPick, onSelectDay, onResetDay, renderDayPreview }: GymRoutineHubProps) {
  const [open, setOpen] = useState(false);
  const today = days.find(d => d.status === 'today' || d.status === 'done_today');
  if (!today) return null;
  const doneToday = today.status === 'done_today';
  const doneCount = days.filter(d => d.doneThisWeek).length;
  const meta = [`${today.exercises} ${today.exercises === 1 ? 'ejercicio' : 'ejercicios'}`, today.duration].filter(Boolean).join(' · ');
  const canPreview = Boolean(renderDayPreview);

  return (
    <section className="gym-hub" aria-label="Entreno de hoy" data-testid="gym-hub">
      <button
        type="button"
        className="gym-hub-head"
        onClick={() => { if (!canPreview) return; HapticService.selection(); setOpen(v => !v); }}
        aria-expanded={canPreview ? open : undefined}
        aria-label={`${doneToday ? 'Hecho hoy' : 'Hoy'}: ${today.shortName}${today.focus ? `, ${today.focus}` : ''}. ${meta}${canPreview ? (open ? '. Ocultar ejercicios' : '. Ver ejercicios') : ''}`}
      >
        <span className="gym-hub-title" data-testid="gym-hub-title">
          <span className={`gym-hub-eyebrow${doneToday ? ' is-done' : ''}`}>
            {doneToday && <Check size={12} strokeWidth={2.8} aria-hidden="true" />}
            {doneToday ? 'Hecho hoy' : 'Hoy'}
          </span>
          <span className="gym-hub-name">{today.shortName}{today.focus && <span className="gym-hub-focus"> · {today.focus}</span>}</span>
        </span>
        {canPreview && <ChevronDown size={16} strokeWidth={2.4} aria-hidden="true" className={`gym-hub-chevron${open ? ' is-open' : ''}`} />}
      </button>

      <div className="gym-hub-row">
        <span className="gym-hub-meta">{meta}</span>
        <div className="gym-hub-days" role="radiogroup" aria-label={`Entreno de hoy. ${doneCount} de ${days.length} hechos esta semana`}>
          {days.map(day => {
            const isToday = day.id === today.id;
            return (
              <button
                key={day.id}
                type="button"
                role="radio"
                aria-checked={isToday}
                aria-label={`${day.shortName}: ${day.focus}${day.doneThisWeek ? ', hecho esta semana' : ''}`}
                title={`${day.shortName} · ${day.focus}`}
                className={`gym-hub-day hit-44${isToday ? ' is-today' : ''}${day.doneThisWeek ? ' is-done' : ''}`}
                onClick={() => {
                  if (isToday) return;
                  HapticService.selection();
                  onSelectDay(day.id);
                }}
              >
                {day.doneThisWeek ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : day.shortName.replace(/\D+/g, '') || '·'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Solo si hoy se eligió otro día a mano: volver al que tocaba por rotación. */}
      {isManualPick && (
        <button type="button" className="gym-hub-reset" onClick={onResetDay}>Volver al que tocaba</button>
      )}

      {open && renderDayPreview && (
        <div className="gym-hub-preview">{renderDayPreview(today.id)}</div>
      )}
    </section>
  );
}
