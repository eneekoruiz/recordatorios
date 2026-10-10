import { ArrowRight } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useNavigation } from '../../hooks/useNavigation';
import { buildRoutineRecovery, type RoutineRecoveryGroup } from '../../utils/routineRecovery';
import './RoutineRecovery.css';

interface RoutineRecoveryProps {
  groups: RoutineRecoveryGroup[];
  onOpenTask?: (taskId: string) => void;
  onSelectView?: (view: string) => void;
}

export function RoutineRecovery({ groups, onOpenTask, onSelectView }: RoutineRecoveryProps) {
  if (!groups.length) return null;
  const omit = (group: RoutineRecoveryGroup) => {
    // Re-read live evidence so an action cannot omit a task completed since rendering.
    const state = useAppStore.getState();
    const live = buildRoutineRecovery(Object.values(state.tasks), state.cycles, state.listSections, state.lists);
    const selected = live.find(item => item.id === group.id);
    if (!selected) return;
    for (const task of selected.tasks) state.skipTask(task.id, false, group.periodStart);
    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: `${group.frequency === 'week' ? 'Semana anterior' : 'Mes anterior'} omitido en ${group.label}. Puedes deshacerlo en Estadísticas.`,
    }));
  };
  return (
    <section className="routine-recovery" aria-label="Retomar rutinas por sección" data-testid="routine-recovery">
      <h3>Un paso para retomar</h3>
      {groups.map(group => (
        <div className="routine-recovery-row" key={group.id} data-testid="recovery-group" data-frequency={group.frequency} data-list-id={group.listId} data-section-id={group.sectionId}>
          <p><strong>{group.frequency === 'week' ? 'La semana pasada' : 'El mes pasado'} {group.tasks.length === 1 ? 'quedó' : 'quedaron'} {group.tasks.length} sin marcar en {group.label}.</strong></p>
          <p className="routine-recovery-hint">¿Te apetece empezar por «{group.candidate.title}»{group.candidate.duration && group.candidate.duration > 0 ? ` (${group.candidate.duration} min)` : ''}? Basta con una.</p>
          <div className="routine-recovery-actions">
            {(onOpenTask || onSelectView) && <button type="button" className="routine-recovery-start" onClick={() => onOpenTask ? onOpenTask(group.candidate.id) : onSelectView?.(`list_${group.listId}`)}>Empezar por una <ArrowRight size={14} aria-hidden="true" /></button>}
            <button type="button" onClick={() => omit(group)}>Omitir período</button>
            {onSelectView && <button type="button" onClick={() => onSelectView(`list_${group.listId}`)}>{group.frequency === 'week' ? 'Esta semana' : 'Este mes'}</button>}
            {onSelectView && <button type="button" onClick={() => {
              const start = group.periodStart;
              const reference = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
              useNavigation.getState().setRoutineAnalyticsFocus({ frequency: group.frequency, reference, groupId: JSON.stringify([group.listId, group.sectionId || null]) });
              onSelectView('ANALYTICS');
            }}>Ver historial</button>}
          </div>
        </div>
      ))}
      {onSelectView && <button className="routine-recovery-stats" type="button" onClick={() => onSelectView('ANALYTICS')}>Ver estadísticas <ArrowRight size={14} aria-hidden="true" /></button>}
    </section>
  );
}
