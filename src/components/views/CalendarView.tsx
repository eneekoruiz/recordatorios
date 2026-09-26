import { useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, ChevronsUpDown, Repeat } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useCalendarStore } from '../../store/useCalendarStore';
import { buildCalendar, dayKey, monthWeeks, parseDayKey } from '../../utils/calendar';
import type { CalendarDay, CalendarItem, CalendarRound } from '../../utils/calendar';
import type { PeriodicityType } from '../../../shared/periodicity.js';
import type { TaskItem } from '../../models/Task';
import { FREQUENCY_RESERVED_COLORS } from '../../constants/colors';
import { WEEKDAY_NAMES } from '../../utils/routineDay';
import { capitalize } from '../../utils/format';
import { HapticService } from '../../services/HapticService';
import './CalendarView.css';

interface CalendarViewProps {
  onSelectView: (view: string) => void;
  onEditTask: (taskId: string) => void;
}

const WEEKDAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const WEEKDAY_SHORT = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const ROUND_LABEL: Record<PeriodicityType, string> = { year: 'Anuales', month: 'Mensuales', week: 'Semanales', day: 'Diarias' };
const ROUND_VIEW: Record<PeriodicityType, string> = { year: 'cycle_year', month: 'cycle_month', week: 'cycle_week', day: 'cycle_day' };
const MAX_CHIPS = 3;
const DEFAULT_COLOR = '#007aff';
const OVERDUE_COLOR = '#ff3b30';

const monthName = (date: Date) => capitalize(date.toLocaleDateString('es-ES', { month: 'long' }));

function roundRule(periodicity: PeriodicityType, weeklyDay: number): string {
  const weekday = WEEKDAY_NAMES[weeklyDay];
  if (periodicity === 'day') return 'Cada día';
  if (periodicity === 'week') return `Cada ${weekday}`;
  if (periodicity === 'month') return `Primer ${weekday} del mes`;
  return `Primer ${weekday} de enero`;
}

function agendaTitle(date: Date, today: Date): { title: string; subtitle: string } {
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  const sameYear = date.getFullYear() === today.getFullYear();
  const long = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) });
  const relative = days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : days === -1 ? 'Ayer' : null;
  if (relative) return { title: relative, subtitle: capitalize(long) };
  const [weekday, ...rest] = long.split(', ');
  return { title: capitalize(weekday), subtitle: rest.join(', ') };
}

export function CalendarView({ onSelectView, onEditTask }: CalendarViewProps) {
  const tasks = useAppStore((s) => s.tasks);
  const lists = useAppStore((s) => s.lists);
  const listSections = useAppStore((s) => s.listSections);
  const cycles = useAppStore((s) => s.cycles);
  const toggleTask = useAppStore((s) => s.toggleTask);
  const weeklyDay = useAppStore((s) => s.weeklyTasksDay);
  const setWeeklyTasksDay = useAppStore((s) => s.setWeeklyTasksDay);
  const selectedKey = useCalendarStore((s) => s.selectedDay);
  const setSelectedDay = useCalendarStore((s) => s.setSelectedDay);

  // «Hoy» se recalcula si la app sigue abierta al cambiar de día.
  const [todayKey, setTodayKey] = useState(() => dayKey(new Date()));
  useEffect(() => {
    const tick = () => setTodayKey(dayKey(new Date()));
    const timer = window.setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  const today = useMemo(() => parseDayKey(todayKey), [todayKey]);

  // Al salir se olvida el día elegido: el calendario siempre abre en hoy.
  useEffect(() => () => setSelectedDay(null), [setSelectedDay]);

  const selected = selectedKey ? parseDayKey(selectedKey) : today;
  const currentSelectedKey = dayKey(selected);
  const [visible, setVisible] = useState(() => ({ year: selected.getFullYear(), month: selected.getMonth() }));
  const [direction, setDirection] = useState(0);

  const weeks = useMemo(() => monthWeeks(visible.year, visible.month), [visible.year, visible.month]);
  const calendar = useMemo(() => {
    const first = weeks[0][0];
    const last = weeks[weeks.length - 1][6];
    // `today` cambia al pasar la medianoche: con él cambian las rondas y los vencidos.
    return buildCalendar(Object.values(tasks), { from: first, to: last, now: today, weeklyDay, lists, sections: listSections, cycles });
  }, [tasks, lists, listSections, cycles, weeklyDay, weeks, today]);

  const listColor = (task: TaskItem) => lists.find((l) => l.id === task.categoryId)?.color || DEFAULT_COLOR;
  const listName = (task: TaskItem) => lists.find((l) => l.id === task.categoryId)?.name || 'Recordatorios';

  const select = (date: Date) => {
    if (date.getFullYear() !== visible.year || date.getMonth() !== visible.month) {
      const forward = date > new Date(visible.year, visible.month, 1);
      setDirection(forward ? 1 : -1);
      setVisible({ year: date.getFullYear(), month: date.getMonth() });
    }
    const key = dayKey(date);
    setSelectedDay(key === todayKey ? null : key);
  };

  const showMonth = (offset: number) => {
    HapticService.selection();
    const target = new Date(visible.year, visible.month + offset, 1);
    const isCurrentMonth = target.getFullYear() === today.getFullYear() && target.getMonth() === today.getMonth();
    setDirection(offset);
    setVisible({ year: target.getFullYear(), month: target.getMonth() });
    setSelectedDay(isCurrentMonth ? null : dayKey(target));
  };

  const goToday = () => {
    HapticService.selection();
    select(today);
  };

  const gridRef = useRef<HTMLDivElement>(null);
  const focusPending = useRef(false);
  useEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${currentSelectedKey}"]`)?.focus();
  }, [currentSelectedKey, visible]);

  const onGridKeyDown = (event: React.KeyboardEvent) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next: Date | null = null;
    if (event.key in moves) next = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate() + moves[event.key]);
    else if (event.key === 'PageUp') next = new Date(selected.getFullYear(), selected.getMonth() - 1, 1);
    else if (event.key === 'PageDown') next = new Date(selected.getFullYear(), selected.getMonth() + 1, 1);
    else if (event.key === 'Home') next = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate() - ((selected.getDay() + 6) % 7));
    else if (event.key === 'End') next = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate() + (6 - ((selected.getDay() + 6) % 7)));
    if (!next) return;
    event.preventDefault();
    focusPending.current = true;
    select(next);
  };

  // Deslizar el mes con el dedo, como en Calendario.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (event: React.PointerEvent) => {
    swipe.current = event.pointerType === 'touch' ? { x: event.clientX, y: event.clientY } : null;
  };
  const onPointerUp = (event: React.PointerEvent) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.5) showMonth(dx < 0 ? 1 : -1);
  };

  const selectedDay: CalendarDay = calendar.get(currentSelectedKey) || { items: [], rounds: [] };
  const isPastDay = selected < today;
  const { title, subtitle } = agendaTitle(selected, today);
  const isShowingToday = currentSelectedKey === todayKey && visible.year === today.getFullYear() && visible.month === today.getMonth();
  const monthLabel = `${monthName(new Date(visible.year, visible.month, 1))} de ${visible.year}`;

  const dayLabel = (date: Date, info: CalendarDay | undefined) => {
    const base = capitalize(date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));
    const parts: string[] = [];
    const pending = info?.items.filter((i) => !i.done).length || 0;
    if (pending) parts.push(pending === 1 ? '1 recordatorio' : `${pending} recordatorios`);
    const rounds = (info?.rounds || []).filter((r) => r.periodicity !== 'day').map((r) => ROUND_LABEL[r.periodicity].toLowerCase());
    if (rounds.length) parts.push(`tocan las ${rounds.join(' y las ')}`);
    return parts.length ? `${base}: ${parts.join(', ')}` : base;
  };

  const markers = (info: CalendarDay | undefined): string[] => {
    if (!info) return [];
    const colors: string[] = [];
    const round = info.rounds.find((r) => r.periodicity !== 'day');
    if (round) colors.push(FREQUENCY_RESERVED_COLORS[round.periodicity]);
    for (const item of info.items) {
      if (item.done) continue;
      const color = item.overdue ? OVERDUE_COLOR : listColor(item.task);
      if (!colors.includes(color)) colors.push(color);
      if (colors.length === 3) break;
    }
    return colors;
  };

  type Chip = { key: string; label: string; color: string; done?: boolean };
  const chips = (info: CalendarDay | undefined): { shown: Chip[]; more: number } => {
    if (!info) return { shown: [], more: 0 };
    const all: Chip[] = [
      ...info.rounds.filter((r) => r.periodicity !== 'day').map((r) => ({ key: r.periodicity, label: ROUND_LABEL[r.periodicity], color: FREQUENCY_RESERVED_COLORS[r.periodicity] })),
      ...info.items.map((i) => ({ key: i.key, label: i.task.title || 'Recordatorio', color: i.overdue ? OVERDUE_COLOR : listColor(i.task), done: i.done })),
    ];
    return { shown: all.slice(0, MAX_CHIPS), more: Math.max(0, all.length - MAX_CHIPS) };
  };

  const renderRound = (round: CalendarRound) => (
    <li key={round.periodicity}>
      <button type="button" className="cal-row" onClick={() => onSelectView(ROUND_VIEW[round.periodicity])}>
        <span className="cal-row-badge" style={{ background: FREQUENCY_RESERVED_COLORS[round.periodicity] }} aria-hidden="true">
          <Repeat size={15} strokeWidth={2.4} />
        </span>
        <span className="cal-row-text">
          <span className="cal-row-title">{ROUND_LABEL[round.periodicity]}</span>
          <span className="cal-row-sub">{roundRule(round.periodicity, weeklyDay)}</span>
        </span>
        <span className="cal-row-count" aria-label={`${round.pending} pendientes`}>{round.pending}</span>
        <ChevronRight size={17} className="cal-row-chevron" aria-hidden="true" />
      </button>
    </li>
  );

  const renderItem = (item: CalendarItem) => {
    const color = listColor(item.task);
    const meta = [item.kind === 'renewal' ? 'Renovación prevista' : item.overdue ? 'Vencido' : null, listName(item.task), item.time]
      .filter(Boolean)
      .join(' · ');
    return (
      <li key={item.key} className={`cal-item${item.done ? ' is-done' : ''}${item.overdue ? ' is-overdue' : ''}`}>
        {item.kind === 'renewal' ? (
          <span className="cal-item-lead cal-item-renewal" style={{ color }} aria-hidden="true">
            <Repeat size={16} strokeWidth={2.4} />
          </span>
        ) : (
          <button
            type="button"
            className="cal-item-lead cal-check hit-44"
            style={{ ['--check-color' as string]: color }}
            aria-pressed={item.done}
            aria-label={item.done ? `Marcar «${item.task.title}» como pendiente` : `Completar «${item.task.title}»`}
            onClick={() => {
              HapticService.selection();
              toggleTask(item.task.id);
            }}
          >
            {item.done && <Check size={13} strokeWidth={3} />}
          </button>
        )}
        <button type="button" className="cal-row cal-item-main" onClick={() => onEditTask(item.task.id)}>
          <span className="cal-row-text">
            <span className="cal-row-title">{item.task.title || 'Recordatorio'}</span>
            <span className="cal-row-sub">
              <span className="cal-dot" style={{ background: color }} aria-hidden="true" />
              {meta}
            </span>
          </span>
          <ChevronRight size={17} className="cal-row-chevron" aria-hidden="true" />
        </button>
      </li>
    );
  };

  const rounds = isPastDay ? [] : selectedDay.rounds;
  const isEmpty = rounds.length === 0 && selectedDay.items.length === 0;

  return (
    <div className="cal">
      <div className="cal-layout">
        <section className="cal-month" aria-label="Calendario">
          <header className="cal-head">
            <h2 className="cal-title" aria-live="polite">
              <strong>{monthName(new Date(visible.year, visible.month, 1))}</strong> {visible.year}
            </h2>
            <div className="cal-nav">
              <button type="button" className="cal-today-btn" onClick={goToday} disabled={isShowingToday}>
                Hoy
              </button>
              <button type="button" className="cal-nav-btn" onClick={() => showMonth(-1)} aria-label="Mes anterior">
                <ChevronLeft size={22} strokeWidth={2.2} />
              </button>
              <button type="button" className="cal-nav-btn" onClick={() => showMonth(1)} aria-label="Mes siguiente">
                <ChevronRight size={22} strokeWidth={2.2} />
              </button>
            </div>
          </header>

          <div className="cal-weekdays" aria-hidden="true">
            {WEEKDAY_LETTERS.map((letter, i) => (
              <span key={letter + i} className={i >= 5 ? 'is-weekend' : undefined}>
                <span className="cal-wd-letter">{letter}</span>
                <span className="cal-wd-short">{WEEKDAY_SHORT[i]}</span>
              </span>
            ))}
          </div>

          <motion.div
            key={`${visible.year}-${visible.month}`}
            ref={gridRef}
            className="cal-grid"
            role="group"
            aria-label={monthLabel}
            initial={direction ? { opacity: 0, x: direction * 28 } : false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            onKeyDown={onGridKeyDown}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => { swipe.current = null; }}
          >
            {weeks.map((week) => (
              <div key={dayKey(week[0])} className="cal-week">
                {week.map((date) => {
                  const key = dayKey(date);
                  const info = calendar.get(key);
                  const isSelected = key === currentSelectedKey;
                  const isToday = key === todayKey;
                  const inMonth = date.getMonth() === visible.month;
                  const dots = markers(info);
                  const { shown, more } = chips(info);
                  const className = [
                    'cal-day',
                    inMonth ? '' : 'is-outside',
                    isToday ? 'is-today' : '',
                    isSelected ? 'is-selected' : '',
                    WEEK_ORDER.indexOf(date.getDay()) >= 5 ? 'is-weekend' : '',
                  ].filter(Boolean).join(' ');
                  return (
                    <button
                      key={key}
                      type="button"
                      data-day={key}
                      className={className}
                      aria-pressed={isSelected}
                      aria-current={isToday ? 'date' : undefined}
                      aria-label={dayLabel(date, info)}
                      tabIndex={isSelected ? 0 : -1}
                      onClick={() => {
                        HapticService.selection();
                        select(date);
                      }}
                    >
                      <span className="cal-num">{date.getDate()}</span>
                      <span className="cal-dots" aria-hidden="true">
                        {dots.map((color) => <span key={color} style={{ ['--dot' as string]: color }} />)}
                      </span>
                      <span className="cal-chips" aria-hidden="true">
                        {shown.map((chip) => (
                          <span key={chip.key} className={`cal-chip${chip.done ? ' is-done' : ''}`} style={{ ['--chip-color' as string]: chip.color }}>
                            {chip.label}
                          </span>
                        ))}
                        {more > 0 && <span className="cal-chip-more">{more} más</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </motion.div>
        </section>

        <section className="cal-agenda" aria-label={`${title}, ${subtitle}`}>
          <header className="cal-agenda-head" aria-live="polite">
            <h3>{title}</h3>
            <p>{subtitle}</p>
          </header>

          {rounds.length > 0 && (
            <div className="cal-group">
              <h4 className="cal-group-label">Rutinas</h4>
              <ul className="cal-list">{rounds.map(renderRound)}</ul>
            </div>
          )}

          {selectedDay.items.length > 0 && (
            <div className="cal-group">
              <h4 className="cal-group-label">Recordatorios</h4>
              <ul className="cal-list">{selectedDay.items.map(renderItem)}</ul>
            </div>
          )}

          {isEmpty && (
            <div className="cal-empty">
              <p className="cal-empty-title">{isPastDay ? 'Nada ese día' : 'Nada programado'}</p>
              {!isPastDay && <p className="cal-empty-sub">Escribe abajo para añadir un recordatorio a este día.</p>}
            </div>
          )}

          <div className="cal-group cal-settings">
            <ul className="cal-list">
              <li>
                <label className="cal-row cal-setting">
                  <span className="cal-row-text">
                    <span className="cal-row-title">Día de las semanales</span>
                  </span>
                  <span className="cal-select">
                    <select value={weeklyDay} onChange={(e) => setWeeklyTasksDay(Number(e.target.value))} aria-label="Día de las tareas semanales">
                      {WEEK_ORDER.map((day) => (
                        <option key={day} value={day}>{capitalize(WEEKDAY_NAMES[day])}</option>
                      ))}
                    </select>
                    <ChevronsUpDown size={14} aria-hidden="true" />
                  </span>
                </label>
              </li>
            </ul>
            <p className="cal-footnote">
              La ronda mensual es el primer {WEEKDAY_NAMES[weeklyDay]} de cada mes y la anual, el primer {WEEKDAY_NAMES[weeklyDay]} de enero.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
