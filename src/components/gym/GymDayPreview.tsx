import { ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
import type { TaskItem } from '../../models/Task';
import { useAppStore } from '../../store/useAppStore';
import { HapticService } from '../../services/HapticService';
import { getSectionExercises, splitGymDayName, summarizeDay, summarizeExercise } from './gymRoutineData';
import './gym-routines.css';

interface GymExerciseListProps {
  exercises: TaskItem[];
  /** Si se pasa, cada ejercicio es un botón que abre su edición. */
  onEditTask?: (taskId: string) => void;
  /** Nombre accesible de la lista («Ejercicios del Día 1»). */
  label?: string;
}

/**
 * Lista compacta de los ejercicios de un día: número, nombre y una línea con series × tiempo y
 * descanso. Sin tarjeta propia: toma el fondo de donde se pinte (hoja, tarjeta «Hoy»…).
 */
export function GymExerciseList({ exercises, onEditTask, label }: GymExerciseListProps) {
  if (exercises.length === 0) {
    return <p className="gym-ex-empty">Este día no tiene ejercicios.</p>;
  }
  return (
    <ol className="gym-ex-list" aria-label={label}>
      {exercises.map((task, idx) => {
        const { volume, rest } = summarizeExercise(task);
        const meta = [volume, rest].filter(Boolean).join(' · ');
        const content = (
          <>
            <span className="gym-ex-index" aria-hidden="true">{idx + 1}</span>
            <span className="gym-ex-text">
              <span className="gym-ex-title">{task.title}</span>
              {meta && <span className="gym-ex-meta">{meta}</span>}
            </span>
          </>
        );
        return (
          <li key={task.id} className="gym-ex-item" data-testid="gym-ex-row">
            {onEditTask ? (
              <button
                type="button"
                className="gym-ex-row is-button"
                onClick={() => {
                  HapticService.selection();
                  onEditTask(task.id);
                }}
                aria-label={`${task.title}${meta ? `, ${meta}` : ''}. Editar`}
              >
                {content}
                <ChevronRight size={16} strokeWidth={2.4} className="gym-ex-chevron" aria-hidden="true" />
              </button>
            ) : (
              <div className="gym-ex-row">{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export interface GymDayPreviewProps {
  /** Id de la sección (día) de la lista de Gimnasio. */
  sectionId: string;
  /** Muestra encima «Día 1 · Empuje» y «6 ejercicios · 20 series». Por defecto, no. */
  showHeader?: boolean;
  /** Si se pasa, tocar un ejercicio abre su edición. */
  onEditTask?: (taskId: string) => void;
  className?: string;
}

/**
 * Vista previa completa de un día de entreno, leída del almacén: sirve para ver qué hay en un día
 * (p. ej. al elegir otro en la tarjeta «Hoy») sin tener que recordarlo por el nombre.
 */
export function GymDayPreview({ sectionId, showHeader = false, onEditTask, className }: GymDayPreviewProps) {
  const tasks = useAppStore(state => state.tasks);
  const section = useAppStore(state => state.listSections.find(s => s.id === sectionId));
  const exercises = useMemo(() => getSectionExercises(sectionId, tasks || {}), [sectionId, tasks]);
  if (!section) return null;
  const name = splitGymDayName(section.name);
  const heading = [name.label, name.focus].filter(Boolean).join(' · ');

  return (
    <div className={`gym-day-preview${className ? ` ${className}` : ''}`} data-testid="gym-day-preview">
      {showHeader && (
        <div className="gym-day-preview-head">
          <span className="gym-day-preview-title">{heading}</span>
          <span className="gym-day-preview-meta">{summarizeDay(exercises)}</span>
        </div>
      )}
      <GymExerciseList exercises={exercises} onEditTask={onEditTask} label={`Ejercicios de ${heading || section.name}`} />
    </div>
  );
}
