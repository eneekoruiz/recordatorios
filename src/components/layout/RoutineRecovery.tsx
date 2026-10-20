import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Play } from 'lucide-react';
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

// En móvil, una sugerencia basta para dar un siguiente paso sin tapar las tareas de hoy.
const visibleCount = () => (typeof window !== 'undefined' && window.innerWidth <= 560 ? 1 : 2);
const pastPeriod = (group: RoutineRecoveryGroup) => group.frequency === 'week' ? 'la semana pasada' : 'el mes pasado';
const dateValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/**
 * «Para retomar»: cada sugerencia es una fila con el aspecto de una tarea. Tocarla empieza la tarea
 * más breve de esa sección; el resto de acciones (ir a la sección, omitir ese periodo, historial)
 * viven en su menú «···», como las de cualquier fila. El texto describe el dato, no a la persona.
 */
export function RoutineRecovery({ groups, onStartTask, onOpenTask, onSelectView }: RoutineRecoveryProps) {
  const [expanded, setExpanded] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuFor) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      // Dentro del menú, o sobre su propio «···» (ese botón ya alterna: si se cerrara aquí, el clic
      // lo volvía a abrir y el menú no había forma de cerrarlo con él).
      if (event instanceof PointerEvent && (event.target as Element | null)?.closest?.(`[data-menu-anchor="${CSS.escape(menuFor)}"]`)) return;
      setMenuFor(null);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
  }, [menuFor]);

  if (!groups.length) return null;
  const limit = visibleCount();
  const visible = expanded ? groups : groups.slice(0, limit);

  const omit = (group: RoutineRecoveryGroup) => {
    setMenuFor(null);
    // Relee los datos vivos: no omite una tarea marcada desde que se pintó.
    const state = useAppStore.getState();
    const live = buildRoutineRecovery(Object.values(state.tasks), state.cycles, state.listSections, state.lists);
    const selected = live.find(item => item.id === group.id);
    if (!selected) return;
    const ids = selected.tasks.map(task => task.id);
    for (const id of ids) state.skipTask(id, false, group.periodStart);
    showUndoToast(`${group.label}: ${pastPeriod(group)} omitida`, () => {
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
    setMenuFor(null);
    useNavigation.getState().setRoutineAnalyticsFocus({
      frequency: group.frequency,
      reference: dateValue(group.periodStart),
      groupId: JSON.stringify([group.listId, group.sectionId || null]),
    });
    onSelectView?.('ANALYTICS');
  };

  return (
    <section className="routine-recovery" aria-labelledby="routine-recovery-title" data-testid="routine-recovery">
      <div className="routine-recovery-head">
        <h2 id="routine-recovery-title" className="routine-recovery-title">Para retomar</h2>
        {groups.length > limit && (
          <button type="button" className="routine-recovery-more" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
            {expanded ? 'Menos' : `${groups.length - limit} más`}
          </button>
        )}
      </div>
      {visible.map(group => {
        const minutes = group.candidate.duration && group.candidate.duration > 0 ? group.candidate.duration : 0;
        // El nombre de la sección basta (la lista solo si no hay sección); el número exacto va en el nombre accesible.
        const place = group.label.split(' · ').pop() || group.label;
        const fact = `${place}, sin marcar ${pastPeriod(group)}`;
        return (
          <div className="routine-recovery-row" key={group.id} data-testid="recovery-group" data-frequency={group.frequency} data-list-id={group.listId} data-section-id={group.sectionId}>
            <button type="button" className="routine-recovery-start" onClick={() => start(group)}
              aria-label={`Empezar por «${group.candidate.title}»${minutes ? `, ${formatDuration(minutes)}` : ''}. ${group.label}: ${group.tasks.length} sin marcar ${pastPeriod(group)}`}>
              <span className="routine-recovery-glyph" aria-hidden="true"><Play size={11} fill="currentColor" /></span>
              <span className="routine-recovery-text">
                <span className="routine-recovery-task">{group.candidate.title}</span>
                <span className="routine-recovery-fact">
                  {minutes > 0 && <><span className="tabular">{formatDuration(minutes)}</span> · </>}{fact}
                </span>
              </span>
            </button>
            <div className="routine-recovery-menu-anchor" data-menu-anchor={group.id}>
              <button type="button" className="routine-recovery-more-btn" aria-haspopup="menu" aria-expanded={menuFor === group.id}
                aria-label={`Más opciones para ${group.label}`} onClick={() => setMenuFor(menuFor === group.id ? null : group.id)}>
                <MoreHorizontal size={18} aria-hidden="true" />
              </button>
              {menuFor === group.id && (
                <div ref={menuRef} role="menu" aria-label={group.label} className="ios-dropdown-menu routine-recovery-menu">
                  {onSelectView && (
                    <button type="button" role="menuitem" className="ios-dropdown-item" onClick={() => { setMenuFor(null); onSelectView(`list_${group.listId}`); }}>Ir a la sección</button>
                  )}
                  {onSelectView && (
                    <button type="button" role="menuitem" className="ios-dropdown-item" onClick={() => showHistory(group)}>Ver historial</button>
                  )}
                  <div className="ios-dropdown-divider" role="separator" />
                  <button type="button" role="menuitem" className="ios-dropdown-item" onClick={() => omit(group)}>
                    Omitir {pastPeriod(group)}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
