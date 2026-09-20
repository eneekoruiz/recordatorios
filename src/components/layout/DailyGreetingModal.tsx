import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, CreditCard, Flame, Moon, Sun, Sunset, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { buildDailyBriefing } from '../../services/DailyBriefingService';
import { HapticService } from '../../services/HapticService';
import { getUserFirstName } from '../../utils/userIdentity';
import { formatRelativeDay, formatTime, plural } from '../../utils/format';
import './DailyGreetingModal.css';

interface DailyGreetingModalProps {
  onSelectView?: (view: string) => void;
  onOpenTask?: (taskId: string) => void;
}

const PERIOD_STYLE = {
  morning: { Icon: Sun, accent: '#ff9f0a' },
  afternoon: { Icon: Sunset, accent: '#ff6b3d' },
  evening: { Icon: Moon, accent: '#5e5ce6' },
} as const;

const DISMISSED_KEY = 'daily_greeting_dismissed_day';
const MUTED_KEY = 'daily_greeting_muted';
const SESSION_KEY = 'daily_greeting_seen_session';

const read = (storage: Storage, key: string) => {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};
const write = (storage: Storage, key: string, value: string) => {
  try {
    storage.setItem(key, value);
  } catch {
    /* almacenamiento no disponible */
  }
};

export const DailyGreetingModal: React.FC<DailyGreetingModalProps> = ({ onSelectView, onOpenTask }) => {
  const tasks = useAppStore((state) => state.tasks);
  const cycles = useAppStore((state) => state.cycles);

  const [isOpen, setIsOpen] = useState(false);
  const [muted, setMuted] = useState(() => read(localStorage, MUTED_KEY) === 'true');
  const sheetRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<Element | null>(null);

  const briefing = useMemo(
    () => buildDailyBriefing(tasks, cycles, { name: getUserFirstName() }),
    [tasks, cycles]
  );

  const handleClose = useCallback(() => {
    HapticService.selection();
    setIsOpen(false);
  }, []);

  // Apertura automática una vez al día. Nunca interrumpe si no hay nada que contar,
  // si el usuario lo ha silenciado, o mientras está haciendo la guía de inicio.
  useEffect(() => {
    if (typeof navigator !== 'undefined' && (navigator.webdriver || (window as any).__E2E__)) return;
    if (muted) return;
    if (read(localStorage, DISMISSED_KEY) === new Date().toDateString()) return;
    if (read(sessionStorage, SESSION_KEY)) return;
    if (read(localStorage, 'hide_onboarding_guide') !== 'true') return; // aún en la guía de inicio
    if (briefing.isQuiet) return;

    const timer = window.setTimeout(() => {
      setIsOpen(true);
      write(sessionStorage, SESSION_KEY, 'true');
      write(localStorage, DISMISSED_KEY, new Date().toDateString());
    }, 900);
    return () => window.clearTimeout(timer);
    // Solo se evalúa al montar: no queremos que reaparezca al cambiar una tarea.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener('open-daily-greeting', open);
    return () => window.removeEventListener('open-daily-greeting', open);
  }, []);

  // Foco y teclado mientras la hoja está abierta.
  useEffect(() => {
    if (!isOpen) {
      (previouslyFocused.current as HTMLElement | null)?.focus?.();
      return;
    }
    previouslyFocused.current = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => {
      sheetRef.current?.querySelector<HTMLElement>('.greeting-primary')?.focus();
    }, 120);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        handleClose();
        return;
      }
      if (event.key !== 'Tab' || !sheetRef.current) return;
      const focusables = sheetRef.current.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, handleClose]);

  const toggleMuted = () => {
    setMuted((current) => {
      const next = !current;
      write(localStorage, MUTED_KEY, String(next));
      return next;
    });
  };

  const goToToday = () => {
    HapticService.selection();
    setIsOpen(false);
    onSelectView?.('smart_today');
  };

  const openTask = (taskId: string) => {
    setIsOpen(false);
    if (onOpenTask) onOpenTask(taskId);
    else onSelectView?.('smart_today');
  };

  if (typeof document === 'undefined') return null;
  const { Icon, accent } = PERIOD_STYLE[briefing.period];
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 560;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="greeting-overlay">
          <motion.div
            className="greeting-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={handleClose}
          />

          <motion.div
            ref={sheetRef}
            className="greeting-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="greeting-title"
            style={{ ['--greeting-accent' as string]: accent }}
            initial={isMobile ? { y: '100%' } : { opacity: 0, y: 14, scale: 0.97 }}
            animate={isMobile ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={isMobile ? { y: '100%' } : { opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: 'spring', damping: 32, stiffness: 340, mass: 0.9 }}
            drag={isMobile ? 'y' : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 600) handleClose();
            }}
          >
            <div className="greeting-grabber" aria-hidden="true" />
            <button type="button" className="greeting-close" onClick={handleClose} aria-label="Cerrar resumen">
              <X size={16} strokeWidth={2.4} />
            </button>

            <header className="greeting-head">
              <span className="greeting-sun" aria-hidden="true"><Icon size={21} strokeWidth={2.1} /></span>
              <span className="greeting-date">{briefing.date}</span>
              <h2 id="greeting-title" className="greeting-title">{briefing.greeting}</h2>
              <p className="greeting-lead">
                <strong>{briefing.headline}</strong>
                {briefing.detail ? ` ${briefing.detail}` : ''}
              </p>
            </header>

            {briefing.focus.length > 0 && (
              <section className="greeting-focus">
                <span className="greeting-focus-label">Por dónde empezar</span>
                {briefing.focus.map((task) => {
                  const due = task.dueDate ? new Date(task.dueDate) : null;
                  const hasTime = due && (due.getHours() !== 0 || due.getMinutes() !== 0);
                  return (
                    <button type="button" key={task.id} className="greeting-task" onClick={() => openTask(task.id)}>
                      <span className="greeting-task-dot" data-priority={task.priority || 'none'} aria-hidden="true" />
                      <span className="greeting-task-text">
                        <span className="greeting-task-title">{task.title}</span>
                        {due && (
                          <span className="greeting-task-meta">
                            {hasTime ? `${formatRelativeDay(due)} · ${formatTime(due)}` : formatRelativeDay(due)}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </section>
            )}

            {(briefing.completedToday > 0 || briefing.habitsTotal > 0 || briefing.pendingToday.length > 0) && (
              <div className="greeting-stats">
                <div className="greeting-stat">
                  <b>{briefing.pendingToday.length}</b>
                  <span>{briefing.pendingToday.length === 1 ? 'pendiente' : 'pendientes'}</span>
                </div>
                {briefing.completedToday > 0 && (
                  <div className="greeting-stat">
                    <b>{briefing.completedToday}</b>
                    <span>{briefing.completedToday === 1 ? 'completada' : 'completadas'}</span>
                  </div>
                )}
                {briefing.habitsTotal > 0 && (
                  <div className="greeting-stat">
                    <b>{briefing.habitsDone}/{briefing.habitsTotal}</b>
                    <span>hábitos</span>
                  </div>
                )}
                {briefing.topStreak >= 2 && (
                  <span className="greeting-streak"><Flame size={14} /> {plural(briefing.topStreak, 'día')}</span>
                )}
              </div>
            )}

            {briefing.expiring.length > 0 && (
              <p className="greeting-note">
                <CreditCard size={16} />
                <span>
                  <strong>{briefing.expiring[0].title}</strong> vence{' '}
                  {formatRelativeDay(new Date(briefing.expiring[0].dueDate!)).toLowerCase()}
                  {briefing.expiring.length > 1 ? ` · y ${plural(briefing.expiring.length - 1, 'aviso más', 'avisos más')}` : ''}.
                </span>
              </p>
            )}

            <div className="greeting-actions">
              <button type="button" className="greeting-primary" onClick={goToToday}>
                Ver mi día <ArrowRight size={17} strokeWidth={2.4} />
              </button>
              <button type="button" className="greeting-secondary" onClick={toggleMuted} aria-pressed={muted}>
                <Check size={15} strokeWidth={3} /> No mostrar este resumen al abrir
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
