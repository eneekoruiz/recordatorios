import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { HapticService } from '../../services/HapticService';
import type { GymRoutineSplit } from '../../utils/gymExercises';
import { GymRoutineDetailSheet } from './GymRoutineDetailSheet';
import { GYM_SPLIT_ORDER, getGymSplitDaysLabel, getGymSplitTagline, getGymSplitTitle } from './gymRoutineData';
import './gym-routines.css';

interface GymOtherRoutinesSectionProps {
  listId: string;
  currentSplit: GymRoutineSplit;
  onSwitchSplit: (newSplit: GymRoutineSplit) => void;
  onEditTask: (taskId: string) => void;
}

/**
 * «Otras rutinas» al pie del Gimnasio: una lista agrupada de iOS con una fila por rutina. Cada fila
 * abre la rutina completa (todos los días y ejercicios) y, desde ahí, se puede activar.
 */
export const GymOtherRoutinesSection: React.FC<GymOtherRoutinesSectionProps> = ({
  listId,
  currentSplit,
  onSwitchSplit,
  onEditTask
}) => {
  const [openSplit, setOpenSplit] = useState<GymRoutineSplit | null>(null);
  const otherSplits = GYM_SPLIT_ORDER.filter(split => split !== currentSplit);
  if (otherSplits.length === 0) return null;

  return (
    <section className="gym-other" aria-labelledby="gym-other-label" data-testid="gym-other-routines">
      <h3 id="gym-other-label" className="gym-other-label">Otras rutinas</h3>
      <div className="gym-other-group">
        {otherSplits.map(split => (
          <button
            key={split}
            type="button"
            className="gym-other-row"
            data-testid={`gym-other-row-${split}`}
            onClick={() => {
              HapticService.selection();
              setOpenSplit(split);
            }}
          >
            <span className="gym-other-text">
              <span className="gym-other-title">{getGymSplitTitle(split)}</span>
              <span className="gym-other-sub">{getGymSplitTagline(split)}</span>
            </span>
            <span className="gym-other-value">{getGymSplitDaysLabel(split)}</span>
            <ChevronRight size={17} strokeWidth={2.4} className="gym-other-chevron" aria-hidden="true" />
          </button>
        ))}
      </div>
      <p className="gym-other-footer">Toca una rutina para ver todos sus días y ejercicios antes de usarla.</p>

      <GymRoutineDetailSheet
        split={openSplit}
        listId={listId}
        currentSplit={currentSplit}
        onClose={() => setOpenSplit(null)}
        onActivate={onSwitchSplit}
        onEditTask={onEditTask}
      />
    </section>
  );
};
