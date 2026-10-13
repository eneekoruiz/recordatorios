import { useState } from 'react';
import { ChevronRight, Play } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useNavigation } from '../../hooks/useNavigation';
import { buildRoutineRecovery, type RoutineRecoveryGroup } from '../../utils/routineRecovery';
import { showUndoToast } from '../../utils/undoToast';
import { formatDuration } from '../../utils/taskDuration';
import './RoutineRecovery.css';

interface RoutineRecoveryProps {
  groups: RoutineRecoveryGroup[];
  /** Abre la tarea en modo foco (empezar ya). */
  onStartTask?: (taskId: string) => void;
  /** Alternativa sin modo foco: abre el editor de la tarea. */
  onOpenTask?: (taskId: string) => void;
  onSelectView?: (view: string) => void;
}

// En móvil, una sección basta para dar un siguiente paso sin tapar las tareas de hoy.
const visibleCount = () => (typeof window !== 'undefined' && window.innerWidth <= 560 ? 1 : 3);
const periodName = (group: RoutineRecoveryGroup) => group.frequency === 'week' ? 'La semana pasada' : 'El mes pasado';
const dateValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/**
 * Del historial a una acción por sección. Describe el dato («3 sin marcar»), nunca a la persona.
 * Tres salidas: empezar por la tarea más breve, ir a la sección, u omitir ese periodo (solo esa
 * sección y ese periodo pasado; se puede deshacer).
 */
export function RoutineRecovery({ groups, onStartTask, onOpenTask, onSelectView }: RoutineRecoveryProps) {
  const [expanded, setExpanded] = useState(false);
  if (!groups.length) return null;
  const limit = visibleCount();
  const visible = expanded ? groups : groups.slice(0, limit);

  const omit = (group: RoutineRecoveryGroup) => {
    // Relee los datos vivos: no omite una tarea marcada desde que se pintó.
    const state = useAppStore.getState();
    const live = buildRoutineRecovery(Object.values(state.tasks), state.cycles, state.listSections, state.lists);
    const selected = live.find(item => item.id === group.id);
    if (!selected) return;
    const ids = selected.tasks.map(task => task.id);
    for (const id of ids) state.skipTask(id, false, group.periodStart);
    showUndoToast(`${periodName(group)} omitida en ${group.label}`, () => {
      const latest = useAppStore.getState();
      for (const id of ids) latest.skipTask(id, true, group.periodStart);
    });
  };

  const start = (group: RoutineRecoveryGroup) => {
    if (onStartTask) onStartTask(group.candidate.id);
    else if (onOpenTask) onOpenTask(group.candidate.id);
    else onSelectView?.(`list_${group.listId}`);
  };

  const showHistory = (group: RoutineRecoveryGroup) => {
    useNavigation.getState().setRoutineAnalyticsFocus({
      frequency: group.frequency,
      reference: dateValue(group.periodStart),
      groupId: JSON.stringify([group.listId, group.sectionId || null]),
    });
    onSelectView?.('ANALYTICS');
  };

  return (
    <section className="routine-recovery" aria-label="Para retomar" data-testid="routine-recovery">
      <h3 className="routine-recovery-title">Para retomar</h3>
      {visible.map(group => {
        const minutes = group.candidate.duration && group.candidate.duration > 0 ? group.candidate.duration : 0;
        const omitLabel = `Omitir ${group.frequency === 'week' ? 'la semana pasada' : 'el mes pasado'} en ${group.label}`;
        return (
          <div className="routine-recovery-row" key={group.id} data-testid="recovery-group" data-frequency={group.frequency} data-list-id={group.listId} data-section-id={group.sectionId}>
            <div className="routine-recovery-head">
              <p className="routine-recovery-label">
                <strong>{group.label}</strong>
                <span className="routine-recovery-fact">{periodName(group)}: {group.tasks.length} sin marcar</span>
              </p>
              {onSelectView && (
                <button type="button" className="routine-recovery-link" onClick={() => showHistory(group)} aria-label={`Ver historial de ${group.label}`}>
                  Historial <ChevronRight size={14} aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="routine-recovery-actions">
              <button type="button" className="routine-recovery-start" onClick={() => start(group)}
                aria-label={`Empezar por «${group.candidate.title}»${minutes ? `, ${formatDuration(minutes)}` : ''}`}>
                <Play size={13} fill="currentColor" aria-hidden="true" />
                <span className="routine-recovery-start-text">{group.candidate.title}</span>
                {minutes > 0 && <span className="routine-recovery-minutes">{formatDuration(minutes)}</span>}
              </button>
              {onSelectView && (
                <button type="button" onClick={() => onSelectView(`list_${group.listId}`)}>Ir a la sección</button>
              )}
              <button type="button" onClick={() => omit(group)} aria-label={omitLabel} title={omitLabel}>Omitir</button>
            </div>
          </div>
        );
      })}
      <div className="routine-recovery-footer">
        {groups.length > limit && (
          <button type="button" className="routine-recovery-link" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
            {expanded ? 'Mostrar menos' : `${groups.length - limit} ${groups.length - limit === 1 ? 'sección más' : 'secciones más'}`}
          </button>
        )}
        {onSelectView && (
          <button className="routine-recovery-link routine-recovery-stats" type="button" onClick={() => onSelectView('ANALYTICS')}>
            Ver estadísticas <ChevronRight size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
}
