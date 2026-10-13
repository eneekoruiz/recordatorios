import { useMemo, useEffect } from 'react';
import { CreditCard } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { buildDailyBriefing } from '../../services/DailyBriefingService';
import { NotificationService } from '../../services/NotificationService';
import { PushService } from '../../services/PushService';
import { getUserFirstName } from '../../utils/userIdentity';
import { formatRelativeDay } from '../../utils/format';
import './DailyBriefingBanner.css';
import { RoutineRecovery } from './RoutineRecovery';

/**
 * Lo que «Hoy» añade a la lista: lo que conviene retomar y una caducidad cercana. Nada más:
 * el título ya dice «Hoy», la fecha va bajo él y las tareas del día son la propia lista.
 * (El saludo con la frase del día sigue en el resumen que se abre al empezar el día.)
 */
export function DailyBriefingBanner({ onOpenTask, onStartTask, onSelectView }: { onOpenTask?: (taskId: string) => void; onStartTask?: (taskId: string) => void; onSelectView?: (view: string) => void }) {
  const tasks = useAppStore((state) => state.tasks);
  const cycles = useAppStore((state) => state.cycles);
  const listSections = useAppStore((state) => state.listSections);
  const lists = useAppStore((state) => state.lists);

  const briefing = useMemo(
    () => buildDailyBriefing(tasks, cycles, { name: getUserFirstName(), listSections, lists }),
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

  const expiring = briefing.expiring[0];
  if (!briefing.recovery.length && !expiring) return null;

  return (
    <div className="daily-briefing-container">
      {expiring && (
        <p className="briefing-expiring" data-testid="briefing-caducidad-chip">
          <CreditCard size={15} aria-hidden="true" />
          <span><strong>{expiring.title}</strong> vence {formatRelativeDay(new Date(expiring.dueDate!)).toLowerCase()}</span>
        </p>
      )}
      <RoutineRecovery groups={briefing.recovery} onStartTask={onStartTask} onOpenTask={onOpenTask} onSelectView={onSelectView} />
    </div>
  );
}
