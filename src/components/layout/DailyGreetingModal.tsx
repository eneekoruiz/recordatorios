import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sun, Moon, Sunset, Sparkles, CheckCircle2, 
  AlertCircle, Flame, Calendar, CreditCard, X, ArrowRight
} from 'lucide-react';
import { useAppStore, isTaskCompleted } from '../../store/useAppStore';
import { calculateHabitStreak } from '../../services/TaskService';
import { HapticService } from '../../services/HapticService';

interface DailyGreetingModalProps {
  onSelectView?: (view: string) => void;
}

export const DailyGreetingModal: React.FC<DailyGreetingModalProps> = ({ onSelectView }) => {
  const tasks = useAppStore(state => state.tasks);
  const cycles = useAppStore(state => state.cycles);
  const userName = (typeof window !== 'undefined' ? (localStorage.getItem('userName') || 'Eneko') : 'Eneko').split(' ')[0];

  const [isOpen, setIsOpen] = useState(false);
  const [dontShowAgainToday, setDontShowAgainToday] = useState(false);

  // Check on mount if modal should be shown
  useEffect(() => {
    // Never auto-open in automated test / headless environments
    if (typeof navigator !== 'undefined' && (navigator.webdriver || (window as any).__E2E__)) {
      return;
    }

    const todayKey = new Date().toDateString();
    const lastDismissedDay = localStorage.getItem('daily_greeting_dismissed_day');
    const sessionSeen = sessionStorage.getItem('daily_greeting_seen_session');

    // If user marked "don't show again today" and it's still today, don't show
    if (lastDismissedDay === todayKey) return;

    // If already seen in this browser session/tab, don't show automatically
    if (sessionSeen) return;

    // Small delay to let the app load smoothly first
    const timer = setTimeout(() => {
      setIsOpen(true);
      sessionStorage.setItem('daily_greeting_seen_session', 'true');
    }, 700);

    return () => clearTimeout(timer);
  }, []);

  // Allow reopening via custom window event
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-daily-greeting', handleOpen);
    return () => window.removeEventListener('open-daily-greeting', handleOpen);
  }, []);

  const handleClose = () => {
    HapticService.selection();
    if (dontShowAgainToday) {
      localStorage.setItem('daily_greeting_dismissed_day', new Date().toDateString());
    }
    setIsOpen(false);
  };

  const briefing = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    const todayStr = now.toDateString();

    // Saludo según hora
    let greeting = 'Buenos días';
    let GreetingIcon = Sun;
    let iconColor = '#ff9500';
    let gradientBg = 'linear-gradient(135deg, rgba(255, 149, 0, 0.18), rgba(255, 94, 58, 0.12))';

    if (hour >= 13 && hour < 20) {
      greeting = 'Buenas tardes';
      GreetingIcon = Sunset;
      iconColor = '#ff5e3a';
      gradientBg = 'linear-gradient(135deg, rgba(255, 94, 58, 0.18), rgba(255, 45, 85, 0.12))';
    } else if (hour >= 20 || hour < 6) {
      greeting = 'Buenas noches';
      GreetingIcon = Moon;
      iconColor = '#5856d6';
      gradientBg = 'linear-gradient(135deg, rgba(88, 86, 214, 0.18), rgba(0, 122, 255, 0.12))';
    }

    // Formatear fecha en español
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
      gradientBg,
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

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div 
          className="daily-greeting-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            boxSizing: 'border-box'
          }}
        >
          {/* Backdrop con desenfoque elegante iOS */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={handleClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)'
            }}
          />

          {/* Modal Card */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="greeting-title"
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', damping: 26, stiffness: 350 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 440,
              background: 'var(--bg-elevated, #ffffff)',
              borderRadius: 24,
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.28), 0 4px 16px rgba(0, 0, 0, 0.08)',
              border: '1px solid var(--border-subtle)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 1
            }}
          >
            {/* Header con icono y botón de cierre */}
            <div style={{
              position: 'relative',
              padding: '24px 24px 16px',
              background: briefing.gradientBg,
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center'
            }}>
              {/* Botón cerrar X */}
              <button
                type="button"
                onClick={handleClose}
                aria-label="Cerrar ventana emergente"
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'rgba(0, 0, 0, 0.08)',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s'
                }}
              >
                <X size={16} />
              </button>

              {/* Icono central de hora del día */}
              <div style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: 'var(--bg-base, #ffffff)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 8px 24px ${briefing.iconColor}35`,
                marginBottom: 14
              }}>
                <briefing.GreetingIcon size={32} color={briefing.iconColor} />
              </div>

              {/* Título de saludo y fecha */}
              <h2 id="greeting-title" style={{
                margin: '0 0 4px 0',
                fontSize: '1.45rem',
                fontWeight: 750,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em'
              }}>
                {briefing.greeting}{userName ? `, ${userName}` : ''}
              </h2>
              <span style={{
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                fontWeight: 500
              }}>
                {briefing.date}
              </span>

              {/* Racha activa si existe */}
              {briefing.topStreak >= 2 && (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  marginTop: 10,
                  padding: '4px 12px',
                  borderRadius: 999,
                  background: 'rgba(255, 149, 0, 0.18)',
                  color: '#ff9500',
                  fontWeight: 700,
                  fontSize: '0.80rem'
                }}>
                  <Flame size={14} />
                  <span>¡Racha activa de {briefing.topStreak} días!</span>
                </div>
              )}
            </div>

            {/* Contenido / Resumen de métricas */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Chips de estado rápido */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {/* Pendientes hoy */}
                <div style={{
                  padding: '12px 14px',
                  borderRadius: 14,
                  background: 'var(--bg-card, rgba(0,0,0,0.03))',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                    <Calendar size={14} color="#007aff" />
                    <span>Pendientes hoy</span>
                  </div>
                  <span style={{
                    fontSize: '1.25rem',
                    fontWeight: 750,
                    color: briefing.pendingCount > 0 ? 'var(--text-primary)' : 'var(--accent-green)'
                  }}>
                    {briefing.pendingCount > 0 ? `${briefing.pendingCount}` : '0 (Al día)'}
                  </span>
                </div>

                {/* Hábitos diarios */}
                <div style={{
                  padding: '12px 14px',
                  borderRadius: 14,
                  background: 'var(--bg-card, rgba(0,0,0,0.03))',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
                    <Sparkles size={14} color="#af52de" />
                    <span>Hábitos diarios</span>
                  </div>
                  <span style={{ fontSize: '1.25rem', fontWeight: 750, color: 'var(--text-primary)' }}>
                    {briefing.habitsTotal > 0 ? `${briefing.habitsCompleted}/${briefing.habitsTotal}` : 'Sin hábitos'}
                  </span>
                </div>

                {/* Prioridad alta si hay */}
                {briefing.highPriorityCount > 0 && (
                  <div style={{
                    gridColumn: '1 / -1',
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: 'rgba(255, 59, 48, 0.08)',
                    border: '1px solid rgba(255, 59, 48, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: '0.84rem',
                    color: 'var(--accent-red)',
                    fontWeight: 600
                  }}>
                    <AlertCircle size={16} />
                    <span>Tienes {briefing.highPriorityCount} tarea(s) de alta prioridad para hoy</span>
                  </div>
                )}

                {/* Completadas hoy si ya hizo algunas */}
                {briefing.completedCount > 0 && (
                  <div style={{
                    gridColumn: briefing.highPriorityCount > 0 ? '1 / -1' : 'auto',
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: 'rgba(52, 199, 89, 0.08)',
                    border: '1px solid rgba(52, 199, 89, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: '0.82rem',
                    color: 'var(--accent-green)',
                    fontWeight: 600
                  }}>
                    <CheckCircle2 size={16} />
                    <span>{briefing.completedCount} tareas ya completadas hoy</span>
                  </div>
                )}
              </div>

              {/* Mensaje motivacional dinámico */}
              <div style={{
                padding: '12px 14px',
                borderRadius: 12,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderLeft: '4px solid var(--accent-primary)',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.45
              }}>
                {briefing.pendingCount === 0 ? (
                  <span>🎉 <strong>¡Todo al día!</strong> No tienes recordatorios pendientes para hoy. Disfruta tu descanso o adelanta tareas futuras.</span>
                ) : briefing.highPriorityCount > 0 ? (
                  <span>🎯 Tienes <strong>{briefing.highPriorityCount} tarea(s) urgente(s)</strong> para hoy. Da el primer paso para tener la jornada resuelta.</span>
                ) : (
                  <span>💡 Tienes <strong>{briefing.pendingCount} recordatorio(s)</strong> para hoy. ¡A por un día productivo!</span>
                )}
              </div>

              {/* Alerta de caducidad si vence en <48h */}
              {briefing.upcomingCaducidades.length > 0 && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: 'rgba(255, 149, 0, 0.1)',
                  border: '1px solid rgba(255, 149, 0, 0.25)',
                  fontSize: '0.80rem',
                  color: '#ff9500',
                  lineHeight: 1.4,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8
                }}>
                  <CreditCard size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong>Aviso de caducidad:</strong> {briefing.upcomingCaducidades[0].title} vence en las próximas 48h{briefing.upcomingCaducidades[0].price ? ` (${briefing.upcomingCaducidades[0].price} €)` : ''}.
                  </div>
                </div>
              )}
            </div>

            {/* Footer con botón de acción y opción de silenciar */}
            <div style={{
              padding: '0 24px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}>
              <button
                type="button"
                onClick={() => {
                  handleClose();
                  onSelectView?.('smart_today');
                }}
                style={{
                  width: '100%',
                  padding: '13px 18px',
                  borderRadius: 14,
                  border: 'none',
                  background: 'var(--accent-primary, #007aff)',
                  color: '#ffffff',
                  fontSize: '0.96rem',
                  fontWeight: 650,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 4px 14px rgba(0, 122, 255, 0.35)',
                  transition: 'opacity 0.15s ease'
                }}
              >
                <span>Ver mis tareas de hoy</span>
                <ArrowRight size={16} />
              </button>

              <label style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontSize: '0.78rem',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                userSelect: 'none'
              }}>
                <input
                  type="checkbox"
                  checked={dontShowAgainToday}
                  onChange={(e) => setDontShowAgainToday(e.target.checked)}
                  style={{ cursor: 'pointer', width: 14, height: 14 }}
                />
                <span>No volver a mostrar durante el día de hoy</span>
              </label>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
