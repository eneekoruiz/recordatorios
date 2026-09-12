import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sun, Moon, Sunset, Sparkles, CheckCircle2, 
  AlertCircle, ChevronDown, ChevronUp, Flame, Calendar, CreditCard
} from 'lucide-react';
import { useAppStore, isTaskCompleted } from '../../store/useAppStore';
import { calculateHabitStreak } from '../../services/TaskService';

export function DailyBriefingBanner() {
  const tasks = useAppStore(state => state.tasks);
  const cycles = useAppStore(state => state.cycles);
  const userName = (typeof window !== 'undefined' ? (localStorage.getItem('userName') || 'Eneko') : 'Eneko').split(' ')[0];

  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('daily_briefing_collapsed') === 'true';
  });

  const toggleCollapsed = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('daily_briefing_collapsed', String(next));
      return next;
    });
  };

  const briefing = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    const todayStr = now.toDateString();

    // Saludo según hora
    let greeting = 'Buenos días';
    let GreetingIcon = Sun;
    let iconColor = '#ff9500';

    if (hour >= 13 && hour < 20) {
      greeting = 'Buenas tardes';
      GreetingIcon = Sunset;
      iconColor = '#ff5e3a';
    } else if (hour >= 20 || hour < 6) {
      greeting = 'Buenas noches';
      GreetingIcon = Moon;
      iconColor = '#5856d6';
    }

    // Formatear fecha
    const formattedDate = now.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
    const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

    // Tareas relevantes para hoy
    const allTasks = Object.values(tasks || {}).filter(t => !t.deleted_at);
    
    // Tareas con dueDate hoy
    const todayTasks = allTasks.filter(t => t.dueDate && new Date(t.dueDate).toDateString() === todayStr);
    const pendingToday = todayTasks.filter(t => !isTaskCompleted(t));
    const completedToday = todayTasks.filter(t => isTaskCompleted(t));
    const highPriorityToday = pendingToday.filter(t => t.priority === 'high');

    // Hábitos diarios (tareas con cycle_id === 'cycle_day' o targetCount)
    const dailyHabits = allTasks.filter(t => t.cycle_id === 'cycle_day' || (t.targetCount && t.targetCount > 1));
    const completedHabits = dailyHabits.filter(t => isTaskCompleted(t));

    // Mayor racha activa de hábitos
    let topStreak = 0;
    dailyHabits.forEach(habit => {
      const streak = calculateHabitStreak(habit, cycles);
      if (streak.count > topStreak) {
        topStreak = streak.count;
      }
    });

    // Suscripciones o tarjetas que vencen en las próximas 48 horas
    const upcomingCaducidades = allTasks.filter(t => {
      if ((t.categoryId === 'caducidades' || t.expirationType) && t.dueDate && !isTaskCompleted(t)) {
        const diffHours = (new Date(t.dueDate).getTime() - now.getTime()) / (1000 * 3600);
        return diffHours >= -12 && diffHours <= 48;
      }
      return false;
    });

    return {
      greeting,
      GreetingIcon,
      iconColor,
      date: capitalizedDate,
      totalToday: todayTasks.length,
      pendingCount: pendingToday.length,
      completedCount: completedToday.length,
      highPriorityCount: highPriorityToday.length,
      habitsTotal: dailyHabits.length,
      habitsCompleted: completedHabits.length,
      topStreak,
      upcomingCaducidades
    };
  }, [tasks, cycles]);

  return (
    <div 
      className="daily-briefing-container"
      style={{
        margin: '8px 16px 16px',
        borderRadius: 16,
        background: 'linear-gradient(135deg, rgba(0, 122, 255, 0.07), rgba(88, 86, 214, 0.05))',
        border: '1px solid var(--border-subtle)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        overflow: 'hidden',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)'
      }}
    >
      {/* Header bar */}
      <div 
        onClick={toggleCollapsed}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            background: 'var(--bg-elevated)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
          }}>
            <briefing.GreetingIcon size={18} color={briefing.iconColor} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--text-primary)' }}>
                {briefing.greeting}{userName ? `, ${userName}` : ''}
              </span>
              {briefing.topStreak >= 2 && (
                <span 
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    padding: '2px 6px',
                    borderRadius: 10,
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    background: 'rgba(255, 149, 0, 0.15)',
                    color: '#ff9500'
                  }}
                  title={`Racha máxima de hábitos activa`}
                >
                  <Flame size={12} />
                  <span>{briefing.topStreak}d</span>
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-tertiary)', marginTop: 1 }}>
              {briefing.date}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                fontSize: '0.78rem',
                fontWeight: 600,
                color: briefing.pendingCount > 0 ? 'var(--accent-primary)' : 'var(--accent-green)',
                background: 'var(--bg-elevated)',
                padding: '3px 8px',
                borderRadius: 12,
                border: '1px solid var(--border-subtle)'
              }}>
                {briefing.pendingCount > 0 ? `${briefing.pendingCount} pendientes` : 'Al día'}
              </span>
            </div>
          )}
          <button
            type="button"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              display: 'flex',
              padding: 4
            }}
            aria-label={isCollapsed ? 'Expandir resumen' : 'Minimizar resumen'}
          >
            {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              padding: '0 16px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10
            }}>
              {/* Stat Chips Row */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 10px',
                  borderRadius: 10,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)'
                }}>
                  <Calendar size={14} color="#007aff" />
                  <span>{briefing.pendingCount} pendientes hoy</span>
                </div>

                {briefing.highPriorityCount > 0 && (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 10px',
                    borderRadius: 10,
                    background: 'rgba(255, 59, 48, 0.1)',
                    border: '1px solid rgba(255, 59, 48, 0.25)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--accent-red)'
                  }}>
                    <AlertCircle size={14} />
                    <span>{briefing.highPriorityCount} alta prioridad</span>
                  </div>
                )}

                {briefing.completedCount > 0 && (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 10px',
                    borderRadius: 10,
                    background: 'rgba(52, 199, 89, 0.1)',
                    border: '1px solid rgba(52, 199, 89, 0.25)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--accent-green)'
                  }}>
                    <CheckCircle2 size={14} />
                    <span>{briefing.completedCount} completadas</span>
                  </div>
                )}

                {briefing.habitsTotal > 0 && (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 10px',
                    borderRadius: 10,
                    background: 'rgba(175, 82, 222, 0.1)',
                    border: '1px solid rgba(175, 82, 222, 0.25)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: '#af52de'
                  }}>
                    <Sparkles size={14} />
                    <span>{briefing.habitsCompleted}/{briefing.habitsTotal} hábitos diarios</span>
                  </div>
                )}

                {briefing.upcomingCaducidades.length > 0 && (
                  <div
                    data-testid="briefing-caducidad-chip"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '5px 10px',
                      borderRadius: 10,
                      background: 'rgba(255, 149, 0, 0.12)',
                      border: '1px solid rgba(255, 149, 0, 0.28)',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: '#ff9500'
                    }}
                  >
                    <CreditCard size={14} />
                    <span>
                      {briefing.upcomingCaducidades[0].title}
                      {briefing.upcomingCaducidades[0].price ? ` (${briefing.upcomingCaducidades[0].price} €)` : ''} vence pronto
                    </span>
                  </div>
                )}
              </div>

              {/* Dynamic message */}
              <div style={{
                fontSize: '0.82rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.4,
                padding: '6px 10px',
                borderRadius: 8,
                background: 'rgba(0, 0, 0, 0.02)',
                borderLeft: '3px solid var(--accent-primary)'
              }}>
                {briefing.pendingCount === 0 ? (
                  <span>🎉 ¡Todo al día! No tienes recordatorios pendientes para hoy. Disfruta tu tiempo o adelanta tareas futuras.</span>
                ) : briefing.highPriorityCount > 0 ? (
                  <span>🎯 Tienes {briefing.highPriorityCount} tarea(s) marcada(s) como urgentes para hoy. Concéntrate en resolverlas primero.</span>
                ) : (
                  <span>💡 Tienes {briefing.pendingCount} recordatorio(s) para hoy. Mantén el ritmo para preservar tus rachas de hábitos.</span>
                )}
              </div>

              {briefing.upcomingCaducidades.length > 0 && (
                <div 
                  data-testid="briefing-caducidad-alert"
                  style={{
                    fontSize: '0.80rem',
                    color: '#ff9500',
                    lineHeight: 1.4,
                    padding: '6px 10px',
                    borderRadius: 8,
                    background: 'rgba(255, 149, 0, 0.08)',
                    borderLeft: '3px solid #ff9500'
                  }}
                >
                  <span>💳 <strong>Aviso de caducidad:</strong> {briefing.upcomingCaducidades[0].title} vence en las próximas 48h{briefing.upcomingCaducidades[0].price ? ` por ${briefing.upcomingCaducidades[0].price} €` : ''}. Comprueba tu saldo o cancélala si ya no la estás usando.</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
