import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useModalFocus } from '../../hooks/useModalFocus';
import { SheetNavBar } from '../ui/SheetNavBar';
import { HapticService } from '../../services/HapticService';
import { getSectionGymSplit, type GymRoutineSplit } from '../../utils/gymExercises';
import { GymRoutineDetailSheet } from './GymRoutineDetailSheet';
import { GYM_SPLIT_ORDER, getGymSplitDaysLabel, getGymSplitTagline, getGymSplitTitle, splitGymDayName } from './gymRoutineData';
import './gym-routines.css';

interface GymRoutineModalProps {
  isOpen: boolean;
  onClose: () => void;
  listId: string;
}

/**
 * Ajustes de la rutina del Gimnasio, al estilo de Ajustes de iOS: qué día toca hoy, qué rutina se
 * usa (cada una se abre completa antes de activarla) y si se ven los descansos entre ejercicios.
 */
export function GymRoutineModal({ isOpen, onClose, listId }: GymRoutineModalProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [detailSplit, setDetailSplit] = useState<GymRoutineSplit | null>(null);
  // Hoy, fijado al abrir: una elección de día solo vale para el día en que se hizo.
  const [todayKey] = useState(() => new Date().toDateString());
  useModalFocus(sheetRef, isOpen, onClose);

  const lists = useAppStore(state => state.lists);
  const listSections = useAppStore(state => state.listSections);
  const updateList = useAppStore(state => state.updateList);
  const currentList = lists.find(l => l.id === listId);

  if (!currentList) return null;

  const currentSplit: GymRoutineSplit = (currentList.activeRoutineSplit as GymRoutineSplit) || 'torso_pierna_4d';
  const pickedDayId = currentList.activeGymDaySectionId && currentList.activeGymDaySetAt
    && new Date(currentList.activeGymDaySetAt).toDateString() === todayKey
    ? currentList.activeGymDaySectionId : undefined;
  const showRestPeriods = currentList.showRestPeriods ?? false;

  // Solo los días de la rutina en uso (las otras rutinas también viven en la lista).
  const daySections = listSections
    .filter(s => {
      if (s.listId !== listId || s.deleted_at) return false;
      const split = getSectionGymSplit(s);
      return split === currentSplit || (split === 'other' && /d[ií]a\s*\d/i.test(s.name));
    })
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const handleSelectDay = (sectionId?: string) => {
    HapticService.selection();
    updateList(listId, sectionId
      ? { activeGymDaySectionId: sectionId, activeGymDaySetAt: Date.now() }
      : { activeGymDaySectionId: undefined, activeGymDaySetAt: undefined });
  };

  const handleToggleRest = () => {
    HapticService.selection();
    updateList(listId, { showRestPeriods: !showRestPeriods });
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="prompt-overlay list-config-overlay" style={{ zIndex: 100000, position: 'fixed', inset: 0 }} onClick={onClose}>
          <motion.div
            ref={sheetRef}
            className="list-config-modal form-sheet gym-rd-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Rutina de gimnasio"
            data-testid="gym-routine-modal"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
            onClick={(e) => e.stopPropagation()}
          >
            <SheetNavBar title="Rutina de gimnasio" onConfirm={onClose} confirmLabel="Listo" />

            <div className="form-sheet-body">
              <div>
                <p className="form-group-label">Entreno de hoy</p>
                <div className="form-group" role="radiogroup" aria-label="Entreno de hoy">
                  <button type="button" className="form-row" role="radio" aria-checked={!pickedDayId} onClick={() => handleSelectDay(undefined)}>
                    <span className="form-row-text">
                      <span className="form-row-title">Automático</span>
                      <span className="form-row-sub">Sigue el orden de la rutina según lo que ya has entrenado.</span>
                    </span>
                    {!pickedDayId && <Check size={18} strokeWidth={2.6} color="var(--accent-blue, #007aff)" aria-hidden="true" />}
                  </button>
                  {daySections.map(sec => {
                    const isSelected = pickedDayId === sec.id;
                    const name = splitGymDayName(sec.name);
                    return (
                      <button key={sec.id} type="button" className="form-row" role="radio" aria-checked={isSelected} onClick={() => handleSelectDay(sec.id)}>
                        <span className="form-row-text">
                          <span className="form-row-title">{name.label ? `${name.label} · ${name.focus}` : sec.name}</span>
                          {name.detail && <span className="form-row-sub">{name.detail}</span>}
                        </span>
                        {isSelected && <Check size={18} strokeWidth={2.6} color="var(--accent-blue, #007aff)" aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
                <p className="form-group-footer">Elegir un día lo deja como entreno de hoy; mañana vuelve el orden automático.</p>
              </div>

              <div>
                <p className="form-group-label">Rutina</p>
                <div className="form-group">
                  {GYM_SPLIT_ORDER.map(split => {
                    const isCurrent = split === currentSplit;
                    return (
                      <button
                        key={split}
                        type="button"
                        className="form-row"
                        data-testid={`gym-routine-row-${split}`}
                        aria-label={`${getGymSplitTitle(split)}, ${getGymSplitDaysLabel(split)}${isCurrent ? ', en uso' : ''}. Ver rutina completa`}
                        onClick={() => {
                          HapticService.selection();
                          setDetailSplit(split);
                        }}
                      >
                        <span className="form-row-text">
                          <span className="form-row-title">{getGymSplitTitle(split)}</span>
                          <span className="form-row-sub">{getGymSplitDaysLabel(split)} · {getGymSplitTagline(split)}</span>
                        </span>
                        {isCurrent && <span className="form-row-sub" style={{ marginTop: 0 }}>En uso</span>}
                        <ChevronRight size={17} strokeWidth={2.4} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
                <p className="form-group-footer">Abre una rutina para ver todos sus días y ejercicios antes de usarla.</p>
              </div>

              <div>
                <p className="form-group-label">Descansos</p>
                <div className="form-group">
                  <div className="form-row" style={{ cursor: 'default' }}>
                    <span className="form-row-text">
                      <span className="form-row-title" id="gym-rest-toggle-label">Mostrar descansos</span>
                      <span className="form-row-sub">Una fila con cronómetro entre ejercicios.</span>
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={showRestPeriods}
                      aria-labelledby="gym-rest-toggle-label"
                      onClick={handleToggleRest}
                      style={{
                        width: 51,
                        height: 31,
                        borderRadius: 16,
                        background: showRestPeriods ? '#34c759' : 'var(--fill-tertiary, rgba(120, 120, 128, 0.16))',
                        position: 'relative',
                        border: 'none',
                        cursor: 'pointer',
                        flexShrink: 0,
                        transition: 'background-color 0.2s ease'
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          top: 2,
                          left: showRestPeriods ? 22 : 2,
                          width: 27,
                          height: 27,
                          borderRadius: '50%',
                          background: '#fff',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                          transition: 'left 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                        }}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <GymRoutineDetailSheet
            split={detailSplit}
            listId={listId}
            currentSplit={currentSplit}
            onClose={() => setDetailSplit(null)}
          />
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
