import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useNavigation } from '../../hooks/useNavigation';
import { calculateRoutinePeriod, getRoutinePeriods, type RoutineFrequency, type RoutineGroup } from '../../utils/routineAnalytics';
import './RoutineAnalytics.css';

const frequencies: { value: RoutineFrequency; label: string }[] = [
  { value: 'day', label: 'Diarias' }, { value: 'week', label: 'Semanales' },
  { value: 'month', label: 'Mensuales' }, { value: 'year', label: 'Anuales' },
];
const statusLabels = { completed: 'Hecha', skipped: 'Omitida', pending: 'Pendiente', missed: 'Sin hacer', unknown: 'Sin datos' };
const dateValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const countsText = (value: { completed: number; skipped: number; automaticSkipped: number; pending: number; unknown: number }) =>
  `${value.completed} hechas · ${value.skipped - value.automaticSkipped} omitidas por ti${value.automaticSkipped ? ` · ${value.automaticSkipped} omitidas automáticamente` : ''} · ${value.pending} pendientes${value.unknown ? ` · ${value.unknown} sin datos` : ''}`;

export function RoutineAnalytics({ onOpenTask }: { onOpenTask?: (taskId: string) => void }) {
  const focus = useNavigation(state => state.routineAnalyticsFocus);
  const setFocus = useNavigation(state => state.setRoutineAnalyticsFocus);
  const tasks = useAppStore(state => state.tasks);
  const cycles = useAppStore(state => state.cycles);
  const sections = useAppStore(state => state.listSections);
  const lists = useAppStore(state => state.lists);
  const [frequency, setFrequency] = useState<RoutineFrequency>(focus?.frequency ?? 'week');
  const [reference, setReference] = useState(() => focus?.reference ?? dateValue(new Date()));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState(focus?.groupId ?? 'all');
  const [announcement, setAnnouncement] = useState('');
  const [now, setNow] = useState(() => new Date());
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!focus) return;
    setFrequency(focus.frequency);
    setReference(focus.reference);
    setGroupFilter(focus.groupId);
    setSelectedId(null);
    setFocus(null);
    panelRef.current?.scrollIntoView({ block: 'start' });
  }, [focus, setFocus]);
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  const anchor = useMemo(() => new Date(`${reference}T12:00:00`), [reference]);
  const periods = useMemo(() => getRoutinePeriods(frequency, anchor), [frequency, anchor]);
  const history = useMemo(() => periods.map(period => ({
    ...period,
    summary: calculateRoutinePeriod(Object.values(tasks), frequency, period.start, cycles, sections, lists, now),
  })), [tasks, frequency, periods, cycles, sections, lists, now]);
  const allGroups = useMemo(() => {
    const groups = new Map<string, RoutineGroup>();
    for (const period of history) for (const group of period.summary.groups) groups.set(group.id, group);
    // Keep a chosen section selectable when it has no tasks in another frequency.
    for (const item of frequencies) {
      for (const group of calculateRoutinePeriod(Object.values(tasks), item.value, now, cycles, sections, lists, now).groups) groups.set(group.id, group);
    }
    return [...groups.values()].sort((a, b) => `${a.listName} ${a.name}`.localeCompare(`${b.listName} ${b.name}`, 'es'));
  }, [history, tasks, cycles, sections, lists, now]);
  const selected = history.find(period => period.id === selectedId)
    ?? history.find(period => anchor >= period.start && anchor < period.end) ?? history[history.length - 1];
  const visibleGroups = (selected?.summary.groups ?? []).filter(group => groupFilter === 'all' || group.id === groupFilter);

  const changeReference = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(new Date(`${value}T12:00:00`).getTime())) return;
    setReference(value);
    setSelectedId(null);
    setAnnouncement('');
  };
  const moveReference = (direction: number) => {
    const next = new Date(anchor);
    if (frequency === 'day') { next.setDate(1); next.setMonth(next.getMonth() + direction); }
    else if (frequency === 'week') next.setDate(next.getDate() + direction * 7);
    else { next.setDate(1); next.setFullYear(next.getFullYear() + direction); }
    changeReference(dateValue(next));
  };
  const updateSection = (groupId: string, restore: boolean) => {
    if (!selected || selected.start > new Date()) return;
    // Re-read live data: repeated clicks cannot add duplicate omissions or touch
    // another section, frequency, or period while React catches up.
    const state = useAppStore.getState();
    const group = calculateRoutinePeriod(Object.values(state.tasks), frequency, selected.start, state.cycles, state.listSections, state.lists)
      .groups.find(item => item.id === groupId);
    if (!group) return;
    const affected = group.tasks.filter(item => restore ? item.status === 'skipped' && !item.automatic : item.status === 'pending' || item.automatic);
    const now = new Date();
    const timestamp = now >= selected.start && now < selected.end ? now : new Date(selected.start.getTime() + 12 * 60 * 60 * 1000);
    for (const { task } of affected) state.skipTask(task.id, restore, timestamp);
    setAnnouncement(`${group.listName} · ${group.name}: ${affected.length} ${restore ? 'omisiones restauradas' : 'tareas omitidas'} en ${selected.label}.`);
  };

  return (
    <section ref={panelRef} className="routine-analytics" data-testid="routine-analytics" aria-labelledby="routine-history-title">
      <div className="routine-heading">
        <div>
          <h2 id="routine-history-title">Tu rutina, período a período</h2>
          <p>Lo que hiciste y lo que decidiste saltarte, separado por listas y secciones.</p>
        </div>
        <button type="button" className="routine-button" onClick={() => changeReference(dateValue(new Date()))}><RotateCcw size={16} aria-hidden="true" /> Hoy</button>
      </div>

      <div className="routine-frequency" role="group" aria-label="Frecuencia de las rutinas">
        {frequencies.map(item => <button type="button" key={item.value} data-testid={`routine-frequency-${item.value}`} aria-pressed={frequency === item.value}
          onClick={() => { setFrequency(item.value); setSelectedId(null); setAnnouncement(''); }}>{item.label}</button>)}
      </div>

      <div className="routine-toolbar">
        <div className="routine-date-controls">
          <button type="button" className="routine-button" aria-label="Período anterior" onClick={() => moveReference(-1)}><ChevronLeft size={18} /></button>
          <label>Fecha de referencia<input type="date" data-testid="routine-reference" value={reference} onChange={event => changeReference(event.target.value)} /></label>
          <button type="button" className="routine-button" aria-label="Período siguiente" onClick={() => moveReference(1)}><ChevronRight size={18} /></button>
        </div>
        <label className="routine-filter">Lista y sección
          <select data-testid="routine-section-filter" value={groupFilter} onChange={event => setGroupFilter(event.target.value)}>
            <option value="all">Todas las secciones</option>
            {allGroups.map(group => <option key={group.id} value={group.id}>{group.listName} · {group.name}</option>)}
          </select>
        </label>
      </div>

      <div className={`routine-periods routine-periods--${frequency}`} role="group" aria-label="Historial por período">
        {frequency === 'day' && <>{['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day, index) => <span key={index} className="routine-weekday" aria-hidden="true">{day}</span>)}
          {Array.from({ length: (periods[0].start.getDay() + 6) % 7 }, (_, index) => <span key={`spacer-${index}`} aria-hidden="true" />)}</>}
        {history.map(period => {
          const groups = period.summary.groups.filter(group => groupFilter === 'all' || group.id === groupFilter);
          const counts = groups.reduce((sum, group) => ({ total: sum.total + group.total, completed: sum.completed + group.completed, skipped: sum.skipped + group.skipped,
            automaticSkipped: sum.automaticSkipped + group.automaticSkipped,
            pending: sum.pending + group.pending, unknown: sum.unknown + group.unknown }), { total: 0, completed: 0, skipped: 0, automaticSkipped: 0, pending: 0, unknown: 0 });
          return <button type="button" key={period.id} data-testid="routine-period" data-period-start={dateValue(period.start)}
            aria-pressed={selected?.id === period.id} aria-label={`${period.label}: ${counts.total ? countsText(counts) : 'sin rutinas'}`}
            onClick={() => { setSelectedId(period.id); setAnnouncement(''); }}>
            <span className="routine-period-label">{frequency === 'day' ? period.start.getDate() : period.label}</span>
            <span className="routine-period-value">{counts.total && counts.unknown !== counts.total ? `${counts.completed}/${counts.total}` : '—'}</span>
            {frequency !== 'day' && <span className="routine-period-caption">{counts.skipped ? `${counts.skipped} omitidas` : counts.unknown === counts.total ? 'Sin datos' : 'hechas'}</span>}
            {frequency === 'day' && counts.skipped > 0 && <span className="routine-omission-dot" aria-hidden="true" />}
          </button>;
        })}
      </div>
      <p className="routine-history-note">Al cerrar un período, las tareas sin completar aparecen como omitidas automáticamente. Se distinguen de las que omitiste tú. Los períodos futuros y el historial desconocido no cuentan como incumplimientos. El desglose usa las secciones actuales.</p>

      <div className="routine-selected-heading"><h3>{selected?.label}</h3><span>Detalle por sección</span></div>
      {!visibleGroups.length && <p className="routine-empty">Sin rutinas para esta sección y este período.</p>}
      {visibleGroups.map(group => {
        const suggestion = group.tasks.filter(item => item.status === 'pending')
          .sort((a, b) => (a.task.duration || Infinity) - (b.task.duration || Infinity))[0]?.task;
        return <details className="routine-group" key={group.id} data-testid="routine-group" data-list-id={group.listId} data-section-id={group.sectionId ?? ''}>
        <summary>
          <span className="routine-group-name"><strong>{group.listName}</strong><span>{group.name}</span></span>
          <span className="routine-group-summary" data-testid="routine-group-summary">{countsText(group)}</span>
        </summary>
        <div className="routine-group-body">
          {suggestion && onOpenTask && <div className="routine-suggestion">
            <p>Si hoy no te apetece todo, puedes empezar por <strong>{suggestion.title}</strong>{suggestion.duration ? ` (${suggestion.duration} min)` : ''}.</p>
            <button type="button" className="routine-button" onClick={() => onOpenTask(suggestion.id)}>Ver esta tarea</button>
          </div>}
          <ul className="routine-tasks">{group.tasks.map(({ task, status, automatic }) => <li key={task.id} data-testid="routine-task" data-task-id={task.id} data-status={status} data-automatic={!!automatic}>
            <span>{task.title}</span><span className={`routine-status routine-status--${status}`}>{automatic ? 'Omitida automáticamente' : statusLabels[status]}</span>
          </li>)}</ul>
          {(group.pending + group.automaticSkipped > 0 || group.skipped - group.automaticSkipped > 0) && <div className="routine-group-actions">
            <p>Solo afecta a esta sección y al período seleccionado. Las tareas hechas se conservan.</p>
            {group.pending + group.automaticSkipped > 0 && <button type="button" className="routine-button" onClick={() => updateSection(group.id, false)}>Omitir sección</button>}
            {group.skipped - group.automaticSkipped > 0 && <button type="button" className="routine-button" onClick={() => updateSection(group.id, true)}>Restaurar omitidas</button>}
          </div>}
        </div>
      </details>;
      })}
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
    </section>
  );
}
