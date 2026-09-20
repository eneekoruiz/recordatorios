import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sun, Moon, Sunset, CheckCircle2, 
  AlertCircle, Flame, Calendar, CreditCard, ArrowRight, Sparkles
} from 'lucide-react';
import { useAppStore, isTaskCompleted } from '../../store/useAppStore';
import { calculateHabitStreak } from '../../services/TaskService';
import { HapticService } from '../../services/HapticService';
import { getUserFirstName } from '../../utils/userIdentity';

interface DailyGreetingModalProps {
  onSelectView?: (view: string) => void;
}

// Toggle iOS-style custom para evitar el checkbox nativo
function IOSToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 42,
        height: 24,
        borderRadius: 999,
        background: checked ? '#34c759' : 'var(--border-color, rgba(0,0,0,0.15))',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        padding: 0,
        flexShrink: 0,
        transition: 'background 0.22s cubic-bezier(0.16,1,0.3,1)'
      }}
      whileTap={{ scale: 0.92 }}
    >
      <motion.div
        animate={{ x: checked ? 20 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#ffffff',
          position: 'absolute',
          top: 2,
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
        }}
      />
    </motion.button>
  );
}

export const DailyGreetingModal: React.FC<DailyGreetingModalProps> = ({ onSelectView }) => {
  const tasks = useAppStore(state => state.tasks);
  const cycles = useAppStore(state => state.cycles);
  const userName = getUserFirstName();

  const [isOpen, setIsOpen] = useState(false);
  const [dontShowAgainToday, setDontShowAgainToday] = useState(false);

  // Mostrar modal al cargar si no fue descartado hoy
  useEffect(() => {
    if (typeof navigator !== 'undefined' && (navigator.webdriver || (window as any).__E2E__)) {
      return;
    }

    const todayKey = new Date().toDateString();
    const lastDismissedDay = localStorage.getItem('daily_greeting_dismissed_day');
    const sessionSeen = sessionStorage.getItem('daily_greeting_seen_session');

    if (lastDismissedDay === todayKey) return;
    if (sessionSeen) return;

    const timer = setTimeout(() => {
      setIsOpen(true);
      sessionStorage.setItem('daily_greeting_seen_session', 'true');
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  // Permite reabrirlo desde cualquier punto de la app
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

    let greeting = 'Buenos días';
    let GreetingIcon = Sun;
    let iconColor = '#ff9500';
    let accentGradient = 'linear-gradient(135deg, #ff9500 0%, #ff6b35 100%)';
    let bgGradient = 'linear-gradient(160deg, rgba(255,149,0,0.10) 0%, rgba(255,107,53,0.06) 100%)';

    if (hour >= 13 && hour < 20) {
      greeting = 'Buenas tardes';
      GreetingIcon = Sunset;
      iconColor = '#ff5e3a';
      accentGradient = 'linear-gradient(135deg, #ff5e3a 0%, #ff2d55 100%)';
      bgGradient = 'linear-gradient(160deg, rgba(255,94,58,0.10) 0%, rgba(255,45,85,0.06) 100%)';
    } else if (hour >= 20 || hour < 6) {
      greeting = 'Buenas noches';
      GreetingIcon = Moon;
      iconColor = '#5856d6';
      accentGradient = 'linear-gradient(135deg, #5856d6 0%, #007aff 100%)';
      bgGradient = 'linear-gradient(160deg, rgba(88,86,214,0.10) 0%, rgba(0,122,255,0.06) 100%)';
    }

    const formattedDate = now.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
    const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

    const allTasks = Object.values(tasks || {}).filter(t => !t.deleted_at);
    const todayTasks = allTasks.filter(t => t.dueDate && new Date(t.dueDate).toDateString() === todayStr);
    const pendingToday = todayTasks.filter(t => !isTaskCompleted(t));
    const completedToday = todayTasks.filter(t => isTaskCompleted(t));
    const highPriorityToday = pendingToday.filter(t => t.priority === 'high');

    const dailyHabits = allTasks.filter(t => t.cycle_id === 'cycle_day' || (t.targetCount && t.targetCount > 1));
    const completedHabits = dailyHabits.filter(t => isTaskCompleted(t));

    let topStreak = 0;
    dailyHabits.forEach(habit => {
      const streak = calculateHabitStreak(habit, cycles);
      if (streak.count > topStreak) topStreak = streak.count;
    });

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
      accentGradient,
      bgGradient,
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

  // Mensaje motivacional sin emojis en el texto (van como icono separado)
  const motivationText = briefing.pendingCount === 0
    ? '¡Todo al día! No tienes recordatorios pendientes para hoy.'
    : briefing.highPriorityCount > 0
      ? `Tienes ${briefing.highPriorityCount} tarea${briefing.highPriorityCount > 1 ? 's' : ''} urgente${briefing.highPriorityCount > 1 ? 's' : ''} para hoy. Da el primer paso.`
      : `Tienes ${briefing.pendingCount} recordatorio${briefing.pendingCount > 1 ? 's' : ''} para hoy. ¡Vamos a por ello!`;

  const motivationEmoji = briefing.pendingCount === 0 ? '🎉' : briefing.highPriorityCount > 0 ? '🎯' : '💡';

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
            padding: '20px 16px',
            boxSizing: 'border-box'
          }}
        >
          {/* Backdrop difuminado */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={handleClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.35)',
              backdropFilter: 'blur(20px) saturate(150%)',
              WebkitBackdropFilter: 'blur(20px) saturate(150%)'
            }}
          />

          {/* Modal Card — Apple sheet style */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="greeting-title"
            initial={{ opacity: 0, scale: 0.88, y: 32 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.90, y: 24 }}
            transition={{ type: 'spring', damping: 28, stiffness: 380, mass: 0.8 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 420,
              background: 'var(--bg-elevated, #ffffff)',
              borderRadius: 28,
              boxShadow: '0 40px 80px rgba(0,0,0,0.25), 0 8px 20px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.04)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 1
            }}
          >
            {/* ── Header ── */}
            <div style={{
              position: 'relative',
              padding: '32px 24px 24px',
              background: briefing.bgGradient,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: 0
            }}>
              {/* Icono del momento del día con glow ring */}
              <div style={{ position: 'relative', marginBottom: 16 }}>
                {/* Glow ring difuso */}
                <div style={{
                  position: 'absolute',
                  inset: -8,
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${briefing.iconColor}30 0%, transparent 70%)`,
                  pointerEvents: 'none'
                }} />
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 18, stiffness: 300, delay: 0.12 }}
                  style={{
                    width: 68,
                    height: 68,
                    borderRadius: '50%',
                    background: briefing.accentGradient,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 10px 30px ${briefing.iconColor}50, inset 0 1px 0 rgba(255,255,255,0.25)`,
                    position: 'relative'
                  }}
                >
                  <briefing.GreetingIcon size={34} color="#ffffff" strokeWidth={1.8} />
                </motion.div>
              </div>

              {/* Saludo */}
              <motion.h2
                id="greeting-title"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, duration: 0.4 }}
                style={{
                  margin: '0 0 4px 0',
                  fontSize: '1.55rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.03em',
                  lineHeight: 1.2
                }}
              >
                {briefing.greeting}{userName ? `, ${userName}` : ''}
              </motion.h2>

              {/* Fecha */}
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.24, duration: 0.4 }}
                style={{
                  fontSize: '0.88rem',
                  color: 'var(--text-secondary)',
                  fontWeight: 500,
                  letterSpacing: '0.01em'
                }}
              >
                {briefing.date}
              </motion.span>

              {/* Badge de racha */}
              {briefing.topStreak >= 2 && (
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', delay: 0.3, stiffness: 400 }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    marginTop: 12,
                    padding: '5px 13px',
                    borderRadius: 999,
                    background: 'rgba(255, 149, 0, 0.15)',
                    border: '1px solid rgba(255, 149, 0, 0.3)',
                    color: '#ff9500',
                    fontWeight: 700,
                    fontSize: '0.80rem'
                  }}
                >
                  <Flame size={13} />
                  <span>¡Racha de {briefing.topStreak} días!</span>
                </motion.div>
              )}
            </div>

            {/* ── Métricas ── */}
            <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Grid de stats 2-col */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {/* Pendientes hoy */}
                <StatCard
                  icon={<Calendar size={16} color="#007aff" />}
                  label="Pendientes hoy"
                  value={briefing.pendingCount > 0 ? `${briefing.pendingCount}` : 'Al día ✓'}
                  valueColor={briefing.pendingCount === 0 ? 'var(--accent-green, #34c759)' : 'var(--text-primary)'}
                />

                {/* Hábitos diarios */}
                <StatCard
                  icon={<Sparkles size={16} color="#af52de" />}
                  label="Hábitos"
                  value={briefing.habitsTotal > 0 ? `${briefing.habitsCompleted}/${briefing.habitsTotal}` : 'Sin hábitos'}
                  valueColor="var(--text-primary)"
                />
              </div>

              {/* Alerta prioridad alta */}
              {briefing.highPriorityCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 14,
                    background: 'rgba(255, 59, 48, 0.07)',
                    border: '1px solid rgba(255, 59, 48, 0.18)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    fontSize: '0.84rem',
                    color: 'var(--accent-red, #ff3b30)',
                    fontWeight: 600
                  }}
                >
                  <AlertCircle size={16} />
                  <span>{briefing.highPriorityCount} tarea{briefing.highPriorityCount > 1 ? 's' : ''} urgente{briefing.highPriorityCount > 1 ? 's' : ''} para hoy</span>
                </motion.div>
              )}

              {/* Completadas hoy */}
              {briefing.completedCount > 0 && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 14,
                  background: 'rgba(52, 199, 89, 0.07)',
                  border: '1px solid rgba(52, 199, 89, 0.18)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  fontSize: '0.84rem',
                  color: 'var(--accent-green, #34c759)',
                  fontWeight: 600
                }}>
                  <CheckCircle2 size={16} />
                  <span>{briefing.completedCount} tarea{briefing.completedCount > 1 ? 's' : ''} ya completada{briefing.completedCount > 1 ? 's' : ''} hoy</span>
                </div>
              )}

              {/* Mensaje motivacional — sin borde izquierdo, más limpio */}
              <div style={{
                padding: '13px 15px',
                borderRadius: 14,
                background: 'var(--bg-hover, rgba(0,0,0,0.03))',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 9
              }}>
                <span style={{ fontSize: '1.05rem', flexShrink: 0 }}>{motivationEmoji}</span>
                <span>{motivationText}</span>
              </div>

              {/* Aviso de caducidad */}
              {briefing.upcomingCaducidades.length > 0 && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 14,
                  background: 'rgba(255, 149, 0, 0.08)',
                  border: '1px solid rgba(255, 149, 0, 0.22)',
                  fontSize: '0.82rem',
                  color: '#ff9500',
                  lineHeight: 1.45,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 9
                }}>
                  <CreditCard size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <strong>Caducidad próxima: </strong>
                    {briefing.upcomingCaducidades[0].title}
                    {briefing.upcomingCaducidades[0].price ? ` — ${briefing.upcomingCaducidades[0].price} €` : ''}
                  </div>
                </div>
              )}
            </div>

            {/* ── Footer ── */}
            <div style={{
              padding: '16px 20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14
            }}>
              {/* CTA principal */}
              <motion.button
                type="button"
                onClick={() => {
                  handleClose();
                  onSelectView?.('smart_today');
                }}
                whileHover={{ scale: 1.02, boxShadow: '0 8px 28px rgba(0,122,255,0.45)' }}
                whileTap={{ scale: 0.97 }}
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  borderRadius: 16,
                  border: 'none',
                  background: 'var(--accent-primary, #007aff)',
                  color: '#ffffff',
                  fontSize: '0.97rem',
                  fontWeight: 650,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 6px 20px rgba(0,122,255,0.35)',
                  transition: 'box-shadow 0.2s ease'
                }}
              >
                <span>Ver mis tareas de hoy</span>
                <ArrowRight size={17} strokeWidth={2.2} />
              </motion.button>

              {/* Toggle iOS de "no mostrar hoy" */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 2px',
                gap: 12
              }}>
                <span style={{
                  fontSize: '0.80rem',
                  color: 'var(--text-tertiary)',
                  lineHeight: 1.4,
                  userSelect: 'none'
                }}>
                  No volver a mostrar hoy
                </span>
                <IOSToggle
                  checked={dontShowAgainToday}
                  onChange={setDontShowAgainToday}
                />
              </div>

              {/* Botón cerrar secundario — solo texto, sin border */}
              <button
                type="button"
                onClick={handleClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  fontSize: '0.84rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  padding: '4px 0 0',
                  textAlign: 'center',
                  letterSpacing: '0.005em'
                }}
              >
                Cerrar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

// ── Sub-componente de tarjeta de estadística ──
function StatCard({
  icon,
  label,
  value,
  valueColor = 'var(--text-primary)'
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div style={{
      padding: '13px 14px',
      borderRadius: 16,
      background: 'var(--bg-hover, rgba(0,0,0,0.025))',
      border: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        color: 'var(--text-secondary)',
        fontSize: '0.77rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em'
      }}>
        {icon}
        <span>{label}</span>
      </div>
      <span style={{
        fontSize: '1.35rem',
        fontWeight: 700,
        color: valueColor,
        letterSpacing: '-0.02em',
        lineHeight: 1
      }}>
        {value}
      </span>
    </div>
  );
}
