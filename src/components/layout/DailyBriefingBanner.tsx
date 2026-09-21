import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, ChevronDown, ChevronUp, CreditCard, Flame, Moon, Sun, Sunset, Calendar, Bell } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { buildDailyBriefing } from '../../services/DailyBriefingService';
import { NotificationService } from '../../services/NotificationService';
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
  const listSections = useAppStore((state) => state.listSections);
  const lists = useAppStore((state) => state.lists);

  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem('daily_briefing_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const briefing = useMemo(
    () => buildDailyBriefing(tasks, cycles, { 
      name: getUserFirstName(),
      listSections,
      lists
    }),
    [tasks, cycles, listSections, lists]
  );

  useEffect(() => {
    if (briefing.isWeeklyDay && (briefing.pendingWeekly.length > 0 || briefing.pendingDaily.length > 0)) {
      NotificationService.getInstance().checkAndSendWeeklyNotification(
        briefing.pendingDaily.length,
        briefing.pendingWeekly.length
      );
    }
  }, [briefing.isWeeklyDay, briefing.pendingDaily.length, briefing.pendingWeekly.length]);

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
              <span><b>{briefing.pendingDaily.length}</b> {briefing.pendingDaily.length === 1 ? 'diaria pendiente' : 'diarias pendientes'}</span>
              {briefing.isWeeklyDay && (
                <span className="briefing-chip" style={{ background: 'rgba(0, 122, 255, 0.12)', color: '#007aff', fontWeight: 600 }}>
                  <Calendar size={14} /> 
                  <span>{briefing.pendingWeekly.length} {briefing.pendingWeekly.length === 1 ? 'semanal pendiente' : 'semanales pendientes'}</span>
                </span>
              )}
              {briefing.completedDailyToday > 0 && (
                <span><b>{briefing.completedDailyToday}</b> completadas hoy</span>
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
              {'Notification' in window && Notification.permission === 'default' && (
                <button
                  type="button"
                  onClick={async () => {
                    await NotificationService.getInstance().requestPermissions();
                  }}
                  className="briefing-chip"
                  style={{ cursor: 'pointer', background: 'rgba(255, 149, 0, 0.12)', color: '#ff9500', border: 'none', fontWeight: 600 }}
                  title="Permitir notificaciones de tareas periódicas"
                >
                  <Bell size={13} />
                  <span>Avisos semanales</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
