import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  Flame,
  Target,
  CheckCircle2,
  Repeat,
  Sun,
  Calendar,
  CalendarDays,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Clock,
  ListTodo,
  Check,
  AlertCircle
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useNavigation } from '../../hooks/useNavigation';
import { ViewHeader } from '../ui/ViewHeader';
import {
  completionsByDay,
  currentStreak,
  totals,
  weeklySuccess,
  bestStreak,
  timeOfDayDistribution,
  calculateCyclesBreakdown,
  calculateListBreakdown,
  type CycleStatItem
} from '../../utils/stats';
import { plural } from '../../utils/format';

interface AnalyticsViewProps {
  onBack?: () => void;
}

const weekday = (ms: number) => {
  const label = new Date(ms).toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '');
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export function AnalyticsView({ onBack }: AnalyticsViewProps) {
  const { reset } = useNavigation();
  const tasks = useAppStore((state) => state.tasks);
  const cycles = useAppStore((state) => state.cycles);
  const listSections = useAppStore((state) => state.listSections);
  const lists = useAppStore((state) => state.lists);

  // Estado para expandir qué tareas se hacen y cuáles faltan en cada ciclo
  const [expandedCycle, setExpandedCycle] = useState<string | null>(null);

  const taskList = useMemo(() => Object.values(tasks), [tasks]);

  const {
    streak,
    best,
    week,
    days,
    sum,
    timeDist,
    cyclesBreakdown,
    listBreakdown
  } = useMemo(() => {
    return {
      streak: currentStreak(taskList),
      best: bestStreak(taskList),
      week: weeklySuccess(taskList),
      days: completionsByDay(taskList),
      sum: totals(taskList),
      timeDist: timeOfDayDistribution(taskList),
      cyclesBreakdown: calculateCyclesBreakdown(taskList, cycles, listSections, lists),
      listBreakdown: calculateListBreakdown(taskList, lists),
    };
  }, [taskList, cycles, listSections, lists]);

  const maxDaily = Math.max(1, ...days.map((d) => d.count));
  const chartSummary = days.map((d) => `${weekday(d.day)}: ${plural(d.count, 'completada')}`).join(', ');

  const itemAnim = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 320, damping: 28 } }
  };

  const getListName = (categoryId?: string) => {
    if (!categoryId) return 'Bandeja de entrada';
    const found = lists.find((l) => l.id === categoryId);
    return found ? found.name : categoryId;
  };

  const cycleIcons: Record<string, typeof Sun> = {
    cycle_day: Sun,
    cycle_week: Calendar,
    cycle_month: CalendarDays,
    cycle_year: Sparkles,
  };

  const renderCycleCard = (item: CycleStatItem) => {
    const IconComp = cycleIcons[item.cycleId] || Repeat;
    const isExpanded = expandedCycle === item.cycleId;
    const isComplete = item.total > 0 && item.pending === 0;

    return (
      <div
        key={item.cycleId}
        style={{
          borderRadius: 16,
          background: 'var(--bg-card, #ffffff)',
          border: '0.5px solid var(--separator, rgba(60,60,67,0.14))',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: `color-mix(in srgb, ${item.color} 14%, transparent)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: item.color,
              }}
            >
              <IconComp size={17} strokeWidth={2.4} />
            </div>
            <div>
              <div style={{ fontWeight: 650, fontSize: '0.94rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                {item.cycleName}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                {item.total > 0
                  ? `${item.completed} de ${item.total} hechas este período`
                  : 'Sin tareas configuradas'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {item.total > 0 && (
              <span
                style={{
                  fontSize: '0.80rem',
                  fontWeight: 700,
                  color: isComplete ? '#34c759' : item.color,
                  background: isComplete
                    ? 'color-mix(in srgb, #34c759 12%, transparent)'
                    : `color-mix(in srgb, ${item.color} 10%, transparent)`,
                  padding: '2px 8px',
                  borderRadius: 999,
                }}
              >
                {isComplete ? '✓ 100%' : `${item.rate}%`}
              </span>
            )}
            {item.total > 0 && (
              <button
                type="button"
                onClick={() => setExpandedCycle(isExpanded ? null : item.cycleId)}
                aria-label={`Ver detalle de tareas ${item.cycleName}`}
                style={{
                  border: 'none',
                  background: 'var(--bg-surface, rgba(0,0,0,0.04))',
                  borderRadius: 8,
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                }}
              >
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            )}
          </div>
        </div>

        {/* Barra de progreso */}
        {item.total > 0 && (
          <div
            style={{
              width: '100%',
              height: 5,
              borderRadius: 999,
              background: 'var(--separator, rgba(60,60,67,0.12))',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${item.rate || 0}%`,
                background: isComplete ? '#34c759' : item.color,
                borderRadius: 999,
                transition: 'width 0.4s cubic-bezier(0.25, 1, 0.5, 1)',
              }}
            />
          </div>
        )}

        {/* Desglose desplegable: Cuáles haces y cuáles no */}
        <AnimatePresence>
          {isExpanded && item.total > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}
            >
              {/* Tareas pendientes */}
              {item.pendingTasks.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 650,
                      color: 'var(--accent-orange, #ff9500)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: 6,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <AlertCircle size={12} /> Pendientes por hacer ({item.pendingTasks.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {item.pendingTasks.map((t) => (
                      <div
                        key={t.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          borderRadius: 8,
                          background: 'var(--bg-surface, rgba(0,0,0,0.03))',
                          fontSize: '0.82rem',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.title}
                        </span>
                        <span style={{ fontSize: '0.70rem', color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: 8 }}>
                          {getListName(t.categoryId)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tareas ya completadas este período */}
              {item.completedTasks.length > 0 && (
                <div>
                  <div
                    style={{
                      fontSize: '0.74rem',
                      fontWeight: 650,
                      color: '#34c759',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: 6,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Check size={12} /> Ya completadas este período ({item.completedTasks.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {item.completedTasks.map((t) => (
                      <div
                        key={t.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          borderRadius: 8,
                          background: 'var(--bg-surface, rgba(0,0,0,0.02))',
                          fontSize: '0.82rem',
                          color: 'var(--text-secondary)',
                          textDecoration: 'line-through',
                          opacity: 0.85,
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.title}
                        </span>
                        <span style={{ fontSize: '0.70rem', color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: 8, textDecoration: 'none' }}>
                          {getListName(t.categoryId)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <main className="stats-page" aria-label="Estadísticas">
      <ViewHeader
        title="Estadísticas"
        subtitle="Rendimiento, constancia y progreso exacto por ciclos de frecuencia."
        icon={<BarChart3 size={20} />}
        color="var(--accent-purple)"
        onBack={() => (onBack ? onBack() : reset('HOME'))}
      />

      {/* ── 1. Cuatro Métricas Clave de Cabecera ─────────────────────── */}
      <motion.div
        className="stat-cards"
        initial="hidden"
        animate="show"
        transition={{ staggerChildren: 0.05 }}
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}
      >
        {/* Racha */}
        <motion.section variants={itemAnim} className="stat-card" aria-label="Racha diaria">
          <div className="stat-card-label">
            <Flame size={16} color="var(--accent-orange, #ff9500)" aria-hidden="true" /> Racha actual
          </div>
          <div className="stat-card-value">
            {streak}
            <span className="stat-card-unit">{streak === 1 ? 'día' : 'días'}</span>
          </div>
          <div className="stat-card-hint">
            {best > 0 ? `Récord personal: ${best} ${best === 1 ? 'día' : 'días'}` : 'Completa una tarea hoy'}
          </div>
        </motion.section>

        {/* Éxito de la Semana */}
        <motion.section variants={itemAnim} className="stat-card" aria-label="Éxito de la semana">
          <div className="stat-card-label">
            <Target size={16} color="var(--accent-green, #34c759)" aria-hidden="true" /> Esta semana
          </div>
          <div
            className="stat-card-value"
            style={{ color: week.rate !== null && week.rate >= 70 ? 'var(--accent-green)' : undefined }}
          >
            {week.rate !== null ? `${week.rate}%` : '—'}
          </div>
          <div className="stat-card-hint">
            {week.rate === null
              ? 'Aún nada que medir'
              : `${plural(week.done, 'hecha')}${week.missed ? ` · ${week.missed} vencidas` : ''}`}
          </div>
        </motion.section>

        {/* Cumplimiento de Frecuencias */}
        <motion.section variants={itemAnim} className="stat-card" aria-label="Rutinas al día">
          <div className="stat-card-label">
            <Repeat size={16} color="var(--accent-purple, #af52de)" aria-hidden="true" /> Frecuencias al día
          </div>
          <div
            className="stat-card-value"
            style={{ color: cyclesBreakdown.allRoutinesRate !== null && cyclesBreakdown.allRoutinesRate >= 70 ? '#af52de' : undefined }}
          >
            {cyclesBreakdown.allRoutinesRate !== null ? `${cyclesBreakdown.allRoutinesRate}%` : '—'}
          </div>
          <div className="stat-card-hint">
            {cyclesBreakdown.allRoutinesGoal > 0
              ? `${cyclesBreakdown.allRoutinesCompleted} de ${cyclesBreakdown.allRoutinesGoal} periódicas al día`
              : 'Sin tareas periódicas'}
          </div>
        </motion.section>

        {/* Total General */}
        <motion.section variants={itemAnim} className="stat-card" aria-label="Completadas en total">
          <div className="stat-card-label">
            <CheckCircle2 size={16} color="var(--accent-blue, #007aff)" aria-hidden="true" /> Total histórico
          </div>
          <div className="stat-card-value">
            {sum.completed}
            <span className="stat-card-unit">{sum.completed === 1 ? 'marca' : 'marcas'}</span>
          </div>
          <div className="stat-card-hint">
            {plural(sum.pending, 'pendiente activa')}
          </div>
        </motion.section>
      </motion.div>

      {/* ── 2. Desglose Exhaustivo por Ciclos y Frecuencias (Apple Style) ──── */}
      <section style={{ marginTop: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 650, letterSpacing: '-0.015em', color: 'var(--text-primary)' }}>
              Cumplimiento por Frecuencia
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.80rem', color: 'var(--text-secondary)' }}>
              Qué tareas tienes completadas y cuáles te faltan en cada período
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          {renderCycleCard(cyclesBreakdown.daily)}
          {renderCycleCard(cyclesBreakdown.weekly)}
          {renderCycleCard(cyclesBreakdown.monthly)}
          {renderCycleCard(cyclesBreakdown.yearly)}
        </div>
      </section>

      {/* ── 3. Gráfico de Actividad de los Últimos 7 Días ────────────── */}
      <motion.section
        className="week-chart"
        variants={itemAnim}
        initial="hidden"
        animate="show"
        aria-label="Actividad de los últimos 7 días"
        style={{ marginTop: 22 }}
      >
        <h2 className="week-chart-title">Actividad en los últimos 7 días</h2>
        <div className="week-chart-plot" role="img" aria-label={chartSummary}>
          {maxDaily === 1 && days.every((d) => d.count === 0) && (
            <p className="week-chart-empty">
              Aún no has completado nada esta semana.<br />Cada recordatorio que marques aparecerá aquí.
            </p>
          )}
          {days.map((d, i) => {
            const isToday = i === days.length - 1;
            return (
              <div key={d.day} className="week-bar-col">
                <div className="week-bar-track">
                  <span className="week-bar-count" aria-hidden="true">
                    {d.count > 0 ? d.count : ''}
                  </span>
                  <motion.div
                    className={`week-bar${isToday ? ' is-today' : ''}`}
                    initial={{ height: 0 }}
                    animate={{ height: d.count === 0 ? 3 : `${Math.max(8, (d.count / maxDaily) * 84)}%` }}
                    transition={{ duration: 0.6, delay: 0.2 + i * 0.05, type: 'spring', bounce: 0.3 }}
                  />
                </div>
                <span className={`week-bar-label${isToday ? ' is-today' : ''}`} aria-hidden="true">
                  {weekday(d.day)}
                </span>
              </div>
            );
          })}
        </div>
      </motion.section>

      {/* ── 4. Patrones de Productividad y Distribución por Listas ─────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14, marginTop: 22 }}>
        {/* Momentos del Día */}
        <div
          style={{
            borderRadius: 16,
            background: 'var(--bg-card, #ffffff)',
            border: '0.5px solid var(--separator, rgba(60,60,67,0.14))',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={17} color="var(--accent-blue)" />
            <span style={{ fontWeight: 650, fontSize: '0.94rem', color: 'var(--text-primary)' }}>
              Momento de mayor actividad
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {timeDist.peakLabel}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            {[
              { label: 'Mañanas (06–12h)', count: timeDist.morning, color: '#ff9500' },
              { label: 'Tardes (12–20h)', count: timeDist.afternoon, color: '#007aff' },
              { label: 'Noches (20–06h)', count: timeDist.night, color: '#af52de' },
            ].map((slot) => {
              const totalSlots = Math.max(1, timeDist.morning + timeDist.afternoon + timeDist.night);
              const pct = Math.round((slot.count / totalSlots) * 100);
              return (
                <div key={slot.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: 3 }}>
                    <span>{slot.label}</span>
                    <span style={{ fontWeight: 600 }}>{slot.count} ({pct}%)</span>
                  </div>
                  <div style={{ width: '100%', height: 4, borderRadius: 999, background: 'var(--separator, rgba(60,60,67,0.12))', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: slot.color, borderRadius: 999 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cumplimiento por Listas */}
        <div
          style={{
            borderRadius: 16,
            background: 'var(--bg-card, #ffffff)',
            border: '0.5px solid var(--separator, rgba(60,60,67,0.14))',
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ListTodo size={17} color="var(--accent-purple)" />
            <span style={{ fontWeight: 650, fontSize: '0.94rem', color: 'var(--text-primary)' }}>
              Cumplimiento por Lista
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
            {listBreakdown.length === 0 && (
              <div style={{ fontSize: '0.80rem', color: 'var(--text-secondary)' }}>
                No hay tareas asignadas a listas aún.
              </div>
            )}
            {listBreakdown.slice(0, 6).map((item) => (
              <div key={item.listId}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 3 }}>
                  <span style={{ fontWeight: 550, color: 'var(--text-primary)' }}>
                    {item.listName}
                  </span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.74rem' }}>
                    {item.completed}/{item.total} ({item.rate}%)
                  </span>
                </div>
                <div style={{ width: '100%', height: 4, borderRadius: 999, background: 'var(--separator, rgba(60,60,67,0.12))', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${item.rate}%`,
                      height: '100%',
                      background: item.color || 'var(--accent-blue)',
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

