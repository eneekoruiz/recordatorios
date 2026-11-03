import { useMemo, useRef, useState, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Check, ChevronDown, Repeat } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useModalFocus } from '../../hooks/useModalFocus';
import { HapticService } from '../../services/HapticService';
import { SheetNavBar } from '../ui/SheetNavBar';
import { confirmDialog, notify } from '../ui/confirmDialog';
import { switchGymRoutineSplit, type GymRoutineSplit } from '../../utils/gymExercises';
import { GymExerciseList } from './GymDayPreview';
import {
  getGymSplitDaysLabel,
  getGymSplitTagline,
  getGymSplitTitle,
  resolveGymRoutineDays,
  splitGymDayName,
  type GymRoutineDay
} from './gymRoutineData';
import './gym-routines.css';

const stopBubble = (e: SyntheticEvent) => e.stopPropagation();

export interface GymRoutineDetailSheetProps {
  /** Rutina que se enseña; `null` cierra la hoja. */
  split: GymRoutineSplit | null;
  listId: string;
  /** Rutina en uso: no ofrece «Usar esta rutina» y lo indica. */
  currentSplit: GymRoutineSplit;
  onClose: () => void;
  /** Activa la rutina tras confirmarlo. Por defecto, `switchGymRoutineSplit`. */
  onActivate?: (split: GymRoutineSplit) => void;
  /** Si se pasa, tocar un ejercicio cierra la hoja y abre su edición. */
  onEditTask?: (taskId: string) => void;
}

/**
 * Hoja con una rutina completa: cada día con todos sus ejercicios (series, tiempo y descanso),
 * plegables, y la acción «Usar esta rutina» siempre a mano abajo. Así se puede saber qué hay en
 * cada día sin recordarlo por el nombre.
 */
export function GymRoutineDetailSheet(props: GymRoutineDetailSheetProps) {
  if (!props.split) return null;
  // La clave reinicia los días plegados al cambiar de rutina.
  return <GymRoutineDetailSheetContent key={props.split} {...props} split={props.split} />;
}

function GymRoutineDetailSheetContent({
  split,
  listId,
  currentSplit,
  onClose,
  onActivate,
  onEditTask
}: GymRoutineDetailSheetProps & { split: GymRoutineSplit }) {
  const sheetRef = useRef<HTMLDivElement>(null);
  useModalFocus(sheetRef, true, onClose);

  const listSections = useAppStore(state => state.listSections);
  const tasks = useAppStore(state => state.tasks);
  const { days, daily, fromTemplate } = useMemo(
    () => resolveGymRoutineDays(split, listId, listSections || [], tasks || {}),
    [split, listId, listSections, tasks]
  );

  // Días abiertos de inicio; la parte diaria (común a todas las rutinas), plegada.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => (daily ? { [daily.section.id]: true } : {}));
  const toggle = (id: string) => {
    HapticService.selection();
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const isCurrent = split === currentSplit;
  const title = getGymSplitTitle(split);
  const totalExercises = days.reduce((acc, d) => acc + d.exercises.length, 0);
  const summary = [getGymSplitDaysLabel(split), `${totalExercises} ejercicios`].join(' · ');

  const handleEdit = onEditTask && !fromTemplate
    ? (taskId: string) => {
        onClose();
        onEditTask(taskId);
      }
    : undefined;

  const handleActivate = async () => {
    HapticService.selection();
    const confirmed = await confirmDialog({
      title: `¿Usar «${title}»?`,
      message: `Pasará a ser tu rutina de gimnasio (${getGymSplitDaysLabel(split)}). La de ahora, «${getGymSplitTitle(currentSplit)}», se guarda con sus series, pesos y notas: puedes volver a ella cuando quieras.`,
      confirmText: 'Usar rutina',
      cancelText: 'Cancelar',
      tone: 'accent'
    });
    if (!confirmed) return;
    if (onActivate) {
      onActivate(split);
    } else {
      switchGymRoutineSplit(listId, split, useAppStore.getState().userId || '');
    }
    HapticService.notification('success');
    notify(`Rutina activada: ${title}`);
    onClose();
  };

  const renderDay = (day: GymRoutineDay, index: number | null) => {
    const name = splitGymDayName(day.section.name);
    const isOpen = !collapsed[day.section.id];
    const bodyId = `gym-rd-day-${day.section.id}`;
    const heading = index === null ? 'Todos los días' : name.focus || day.section.name;
    const count = `${day.exercises.length} ${day.exercises.length === 1 ? 'ejercicio' : 'ejercicios'}`;
    const sub = [index === null ? day.section.name.replace(/^[^:]*:\s*/, '') : name.detail, count].filter(Boolean).join(' · ');
    return (
      <section key={day.section.id} className="form-group gym-rd-day" data-testid="gym-rd-day">
        <button
          type="button"
          className="gym-rd-day-head"
          aria-expanded={isOpen}
          aria-controls={bodyId}
          onClick={() => toggle(day.section.id)}
        >
          <span className={`gym-rd-day-num${index === null ? ' is-daily' : ''}`} aria-hidden="true">
            {index === null ? <Repeat size={14} strokeWidth={2.4} /> : index}
          </span>
          <span className="gym-rd-day-text">
            <span className="gym-rd-day-title">
              {index !== null && <span className="sr-only">{name.label || `Día ${index}`}: </span>}
              {heading}
            </span>
            <span className="gym-rd-day-sub">{sub}</span>
          </span>
          <ChevronDown size={18} strokeWidth={2.4} className="gym-rd-day-chevron" aria-hidden="true" />
        </button>
        {isOpen && (
          <div id={bodyId} className="gym-rd-day-body">
            <GymExerciseList
              exercises={day.exercises}
              onEditTask={handleEdit}
              label={`Ejercicios de ${index === null ? 'todos los días' : `${name.label || `Día ${index}`} · ${heading}`}`}
            />
          </div>
        )}
      </section>
    );
  };

  return createPortal(
    // Los eventos de un portal suben por el árbol de React: no deben llegar a la fila de la lista
    // (arrastre, pulsación larga, menú contextual) en la que se pinta la sección.
    <div
      className="prompt-overlay list-config-overlay gym-rd-overlay"
      style={{ zIndex: 100000, position: 'fixed', inset: 0 }}
      onClick={e => { e.stopPropagation(); onClose(); }}
      onPointerDown={stopBubble}
      onTouchStart={stopBubble}
      onContextMenu={stopBubble}
    >
      <motion.div
        ref={sheetRef}
        className="list-config-modal form-sheet gym-rd-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`Rutina ${title}`}
        data-testid="gym-routine-detail"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }}
        onClick={e => e.stopPropagation()}
      >
        <SheetNavBar title="Rutina" onConfirm={onClose} confirmLabel="Listo" />

        <div className="form-sheet-body gym-rd-body">
          <header className="gym-rd-hero">
            <h2 className="gym-rd-title">{title}</h2>
            <p className="gym-rd-summary">{summary}</p>
            <p className="gym-rd-tagline">{getGymSplitTagline(split)}</p>
            {isCurrent && (
              <span className="gym-rd-current">
                <Check size={14} strokeWidth={2.8} aria-hidden="true" /> Rutina en uso
              </span>
            )}
          </header>

          {days.map((day, idx) => {
            const n = Number(splitGymDayName(day.section.name).label.replace(/\D+/g, '')) || idx + 1;
            return renderDay(day, n);
          })}
          {daily && daily.exercises.length > 0 && (
            <div>
              {renderDay(daily, null)}
              <p className="form-group-footer">Se hace cada día de entreno, con cualquier rutina.</p>
            </div>
          )}
        </div>

        {!isCurrent && (
          <div className="gym-rd-footer">
            <button type="button" className="gym-rd-activate" onClick={handleActivate}>
              Usar esta rutina
            </button>
          </div>
        )}
      </motion.div>
    </div>,
    document.body
  );
}
