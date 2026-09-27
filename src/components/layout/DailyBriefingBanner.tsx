import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, CreditCard, Flame, Moon, Sun, Sunset, Bell } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { buildDailyBriefing } from '../../services/DailyBriefingService';
import { NotificationService } from '../../services/NotificationService';
import { PushService } from '../../services/PushService';
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
      // Con los avisos push activos, el resumen ya llega del servidor: no se duplica.
      PushService.status().then((status) => {
        if (status === 'on') return;
        NotificationService.getInstance().checkAndSendWeeklyNotification(
          briefing.pendingDaily.length,
          briefing.pendingWeekly.length
        );
      });
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
  const canAskNotifications = 'Notification' in window && Notification.permission === 'default';

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

            {/* Solo lo que la frase no dice: la caducidad cercana, la racha y activar avisos */}
            {(expiring || briefing.topStreak >= 2 || canAskNotifications) && (
              <div className="briefing-stats">
                {expiring && (
                  <span className="briefing-chip briefing-chip--info" data-testid="briefing-caducidad-chip">
                    <CreditCard size={14} />
                    <span>{expiring.title} vence {formatRelativeDay(new Date(expiring.dueDate!)).toLowerCase()}</span>
                  </span>
                )}
                {briefing.topStreak >= 2 && (
                  <span className="briefing-chip"><Flame size={14} /> <span>Racha de {plural(briefing.topStreak, 'día')}</span></span>
                )}
                {canAskNotifications && (
                  <button
                    type="button"
                    onClick={async () => {
                      const result = await PushService.enable();
                      if (!result.ok) await NotificationService.getInstance().requestPermissions();
                      window.dispatchEvent(new CustomEvent('show-toast', {
                        detail: result.ok ? 'Listo: un resumen al día y tus alertas con hora, aunque cierres la app' : result.reason,
                      }));
                    }}
                    className="briefing-chip briefing-chip--action"
                    title="Un resumen al día y las alertas con hora, aunque cierres la app"
                  >
                    <Bell size={13} />
                    <span>Activar avisos</span>
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
