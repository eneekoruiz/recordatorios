import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, ChevronDown, ChevronUp, CreditCard, Flame, Moon, Sun, Sunset } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { buildDailyBriefing } from '../../services/DailyBriefingService';
import { getUserFirstName } from '../../utils/userIdentity';
import { formatRelativeDay, plural } from '../../utils/format';
import './DailyBriefingBanner.css';

const PERIOD_STYLE = {
  morning: { Icon: Sun, accent: '#ff9f0a' },
  afternoon: { Icon: Sunset, accent: '#ff6b3d' },
  evening: { Icon: Moon, accent: '#5e5ce6' },
} as const;

export function DailyBriefingBanner() {
  const tasks = useAppStore((state) => state.tasks);
  const cycles = useAppStore((state) => state.cycles);

  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem('daily_briefing_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const briefing = useMemo(
    () => buildDailyBriefing(tasks, cycles, { name: getUserFirstName() }),
    [tasks, cycles]
  );

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('daily_briefing_collapsed', String(next));
      } catch { /* sin almacenamiento */ }
      return next;
    });
  };

  const { Icon, accent } = PERIOD_STYLE[briefing.period];
  const expiring = briefing.expiring[0];

  return (
    <div className="daily-briefing-container" style={{ ['--briefing-accent' as string]: accent }}>
      <div className="briefing-top">
        <span className="briefing-icon" aria-hidden="true"><Icon size={18} strokeWidth={2.1} /></span>
        <div className="briefing-heading">
          <span className="briefing-greeting">{briefing.greeting}</span>
          <span className="briefing-date">{briefing.date}</span>
        </div>
        <button
          type="button"
          className="briefing-toggle"
          onClick={toggleCollapsed}
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? 'Mostrar resumen del día' : 'Ocultar resumen del día'}
        >
          {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            className="briefing-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <p className="briefing-lead">
              <strong>{briefing.headline}</strong>
              {briefing.detail ? ` ${briefing.detail}` : ''}
            </p>

            <div className="briefing-stats">
              <span><b>{briefing.pendingToday.length}</b> {briefing.pendingToday.length === 1 ? 'pendiente' : 'pendientes'}</span>
              {briefing.completedToday > 0 && (
                <span><b>{briefing.completedToday}</b> {briefing.completedToday === 1 ? 'completada' : 'completadas'}</span>
              )}
              {briefing.habitsTotal > 0 && (
                <span><b>{briefing.habitsDone}/{briefing.habitsTotal}</b> hábitos</span>
              )}
              {briefing.topStreak >= 2 && (
                <span className="briefing-chip"><Flame size={14} /> <span>Racha de {plural(briefing.topStreak, 'día')}</span></span>
              )}
              {briefing.highPriorityToday > 0 && (
                <span className="briefing-chip briefing-chip--urgent">
                  <AlertCircle size={14} />
                  <span>{briefing.highPriorityToday === 1 ? '1 urgente' : `${briefing.highPriorityToday} urgentes`}</span>
                </span>
              )}
              {expiring && (
                <span className="briefing-chip" data-testid="briefing-caducidad-chip">
                  <CreditCard size={14} />
                  <span>{expiring.title} vence {formatRelativeDay(new Date(expiring.dueDate!)).toLowerCase()}</span>
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
