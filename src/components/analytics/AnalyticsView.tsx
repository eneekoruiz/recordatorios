import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Flame, Target, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useNavigation } from '../../hooks/useNavigation';
import { ViewHeader } from '../ui/ViewHeader';
import { completionsByDay, currentStreak, totals, weeklySuccess } from '../../utils/stats';
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

  const { streak, week, days, sum } = useMemo(() => {
    const list = Object.values(tasks);
    return { streak: currentStreak(list), week: weeklySuccess(list), days: completionsByDay(list), sum: totals(list) };
  }, [tasks]);

  const max = Math.max(...days.map((d) => d.count));
  const chartSummary = days.map((d) => `${weekday(d.day)}: ${plural(d.count, 'completada')}`).join(', ');

  const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 26 } } };

  return (
    <main className="stats-page" aria-label="Estadísticas">
      <ViewHeader
        title="Estadísticas"
        subtitle="Tu constancia, con lo que de verdad has completado."
        icon={<BarChart3 size={20} />}
        color="var(--accent-purple)"
        onBack={() => (onBack ? onBack() : reset('HOME'))}
      />

      <motion.div className="stat-cards" initial="hidden" animate="show" transition={{ staggerChildren: 0.06 }}>
        <motion.section variants={item} className="stat-card" aria-label="Racha diaria">
          <div className="stat-card-label"><Flame size={16} color="var(--accent-red-text)" aria-hidden="true" /> Racha</div>
          <div className="stat-card-value">{streak}<span className="stat-card-unit">{streak === 1 ? 'día' : 'días'}</span></div>
          <div className="stat-card-hint">{streak > 0 ? 'Días seguidos completando algo' : 'Completa algo hoy para empezar'}</div>
        </motion.section>

        <motion.section variants={item} className="stat-card" aria-label="Éxito de la semana">
          <div className="stat-card-label"><Target size={16} color="var(--accent-green)" aria-hidden="true" /> Semana</div>
          <div className="stat-card-value" style={{ color: week.rate !== null && week.rate >= 70 ? 'var(--accent-green)' : undefined }}>
            {week.rate !== null ? `${week.rate}%` : '—'}
          </div>
          <div className="stat-card-hint">
            {week.rate === null ? 'Aún nada que medir' : `${plural(week.done, 'hecha')}${week.missed ? ` · ${week.missed} sin hacer` : ''}`}
          </div>
        </motion.section>

        <motion.section variants={item} className="stat-card" aria-label="Completadas en total">
          <div className="stat-card-label"><CheckCircle2 size={16} color="var(--accent-blue)" aria-hidden="true" /> Total</div>
          <div className="stat-card-value">{sum.completed}<span className="stat-card-unit">{sum.completed === 1 ? 'hecha' : 'hechas'}</span></div>
          <div className="stat-card-hint">{plural(sum.pending, 'pendiente')}</div>
        </motion.section>
      </motion.div>

      <motion.section className="week-chart" variants={item} initial="hidden" animate="show" aria-label="Actividad de los últimos 7 días">
        <h2 className="week-chart-title">Últimos 7 días</h2>
        <div className="week-chart-plot" role="img" aria-label={chartSummary}>
          {max === 0 && <p className="week-chart-empty">Aún no has completado nada esta semana.<br />Cada recordatorio que marques aparecerá aquí.</p>}
          {days.map((d, i) => {
            const isToday = i === days.length - 1;
            return (
              <div key={d.day} className="week-bar-col">
                <div className="week-bar-track">
                  <span className="week-bar-count" aria-hidden="true">{d.count > 0 ? d.count : ''}</span>
                  <motion.div
                    className={`week-bar${isToday ? ' is-today' : ''}`}
                    initial={{ height: 0 }}
                    animate={{ height: d.count === 0 ? 3 : `${Math.max(8, (d.count / max) * 84)}%` }}
                    transition={{ duration: 0.6, delay: 0.25 + i * 0.05, type: 'spring', bounce: 0.3 }}
                  />
                </div>
                <span className={`week-bar-label${isToday ? ' is-today' : ''}`} aria-hidden="true">{weekday(d.day)}</span>
              </div>
            );
          })}
        </div>
      </motion.section>
    </main>
  );
}
