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
    let iconBg = 'rgba(255, 149, 0, 0.12)';

    if (hour >= 13 && hour < 20) {
      greeting = 'Buenas tardes';
      GreetingIcon = Sunset;
      iconColor = '#ff5e3a';
      iconBg = 'rgba(255, 94, 58, 0.12)';
    } else if (hour >= 20 || hour < 6) {
      greeting = 'Buenas noches';
      GreetingIcon = Moon;
      iconColor = '#5856d6';
      iconBg = 'rgba(88, 86, 214, 0.12)';
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

    // Hábitos diarios
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
      iconBg,
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
        margin: '12px 16px 20px',
        borderRadius: 18,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
        overflow: 'hidden',
        transition: 'all 0.2s ease'
      }}
    >
      {/* Header bar */}
      <div 
        onClick={toggleCollapsed}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            background: briefing.iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <briefing.GreetingIcon size={20} color={briefing.iconColor} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                {briefing.greeting}{userName ? `, ${userName}` : ''}
              </span>
              {briefing.topStreak >= 2 && (
                <span 
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    padding: '3px 8px',
                    borderRadius: 12,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: 'rgba(255, 149, 0, 0.15)',
                    color: '#ff9500'
                  }}
                  title={`Racha máxima de hábitos activa`}
                >
                  <Flame size={13} />
                  <span>{briefing.topStreak}d</span>
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.80rem', color: 'var(--text-secondary)', marginTop: 2, fontWeight: 500 }}>
              {briefing.date}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isCollapsed && (
            <span style={{
              fontSize: '0.80rem',
              fontWeight: 600,
              color: briefing.pendingCount > 0 ? 'var(--accent-primary)' : 'var(--accent-green)',
              background: 'var(--bg-elevated)',
              padding: '4px 10px',
              borderRadius: 12,
              border: '1px solid var(--border-subtle)'
            }}>
              {briefing.pendingCount > 0 ? `${briefing.pendingCount} pendientes` : 'Al día'}
            </span>
          )}
          <button
            type="button"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '50%',
              width: 28,
              height: 28,
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0
            }}
            aria-label={isCollapsed ? 'Expandir resumen' : 'Minimizar resumen'}
          >
            {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
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
              padding: '0 18px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}>
              {/* Stat Chips Row */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 12,
                  background: 'rgba(0, 122, 255, 0.08)',
                  border: '1px solid rgba(0, 122, 255, 0.2)',
                  fontSize: '0.83rem',
                  fontWeight: 600,
                  color: 'var(--accent-primary)'
                }}>
                  <Calendar size={15} />
                  <span>{briefing.pendingCount} pendientes hoy</span>
                </div>

                {briefing.highPriorityCount > 0 && (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 12,
                    background: 'rgba(255, 59, 48, 0.08)',
                    border: '1px solid rgba(255, 59, 48, 0.2)',
                    fontSize: '0.83rem',
                    fontWeight: 600,
                    color: 'var(--accent-red)'
                  }}>
                    <AlertCircle size={15} />
                    <span>{briefing.highPriorityCount} alta prioridad</span>
                  </div>
                )}

                {briefing.completedCount > 0 && (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 12,
                    background: 'rgba(52, 199, 89, 0.08)',
                    border: '1px solid rgba(52, 199, 89, 0.2)',
                    fontSize: '0.83rem',
                    fontWeight: 600,
                    color: 'var(--accent-green)'
                  }}>
                    <CheckCircle2 size={15} />
                    <span>{briefing.completedCount} completadas</span>
                  </div>
                )}

                {briefing.habitsTotal > 0 && (
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 12,
                    background: 'rgba(175, 82, 222, 0.08)',
                    border: '1px solid rgba(175, 82, 222, 0.2)',
                    fontSize: '0.83rem',
                    fontWeight: 600,
                    color: '#af52de'
                  }}>
                    <Sparkles size={15} />
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
                      padding: '6px 12px',
                      borderRadius: 12,
                      background: 'rgba(255, 149, 0, 0.1)',
                      border: '1px solid rgba(255, 149, 0, 0.25)',
                      fontSize: '0.83rem',
                      fontWeight: 600,
                      color: '#ff9500'
                    }}
                  >
                    <CreditCard size={15} />
                    <span>
                      {briefing.upcomingCaducidades[0].title}
                      {briefing.upcomingCaducidades[0].price ? ` (${briefing.upcomingCaducidades[0].price} €)` : ''} vence pronto
                    </span>
                  </div>
                )}
              </div>

              {/* Dynamic message */}
              <div style={{
                fontSize: '0.86rem',
                color: 'var(--text-primary)',
                lineHeight: 1.45,
                padding: '10px 14px',
                borderRadius: 12,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                wordBreak: 'break-word'
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
                    fontSize: '0.84rem',
                    color: '#ff9500',
                    lineHeight: 1.45,
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: 'rgba(255, 149, 0, 0.08)',
                    border: '1px solid rgba(255, 149, 0, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    wordBreak: 'break-word'
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
