import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, Droplet, Sparkles, Hand, SprayCan, Zap } from 'lucide-react';
import type { TaskItem } from '../../../models/Task';
import { SoundService } from '../../../services/SoundService';
import { HapticService } from '../../../services/HapticService';
import { ConfettiService } from '../../../services/ConfettiService';

interface TaskHabitCounterProps {
  task: TaskItem;
  effectiveCurrentCount: number;
  isEffectivelyDone: boolean;
  targetCount: number;
  onToggle: (id: string, forceReverse?: boolean) => void;
}

export const TaskHabitCounter: React.FC<TaskHabitCounterProps> = ({
  task,
  effectiveCurrentCount,
  isEffectivelyDone,
  targetCount,
  onToggle
}) => {
  const [recentlyIncremented, setRecentlyIncremented] = useState(false);
  const incrementTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (incrementTimerRef.current) window.clearTimeout(incrementTimerRef.current);
    };
  }, []);

  const getHabitIcon = (title?: string | null) => {
    const t = (title || '').toLowerCase();
    if (t.includes('agua')) return <Droplet size={11} />;
    if (t.includes('diente')) return <Sparkles size={11} />;
    if (t.includes('mano')) return <Hand size={11} />;
    if (t.includes('aplicacion')) return <SprayCan size={11} />;
    return <Zap size={11} />;
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, verticalAlign: 'middle' }}>
      {effectiveCurrentCount > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator && navigator.vibrate) navigator.vibrate([6]);
            SoundService.playUncomplete();
            onToggle(task.id, true);
            setRecentlyIncremented(false);
          }}
          title="Restar 1 repetición (-1)"
          aria-label={`Restar una repetición de «${task.title || 'hábito'}»`}
          className="habit-counter-minus hit-44"
        >
          −
        </button>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator && navigator.vibrate) navigator.vibrate([6]);
          if (isEffectivelyDone) {
            SoundService.playUncomplete();
            onToggle(task.id, true);
            setRecentlyIncremented(false);
          } else {
            const isNextFinal = effectiveCurrentCount + 1 >= targetCount;
            if (isNextFinal) {
              SoundService.playComplete();
              ConfettiService.fire({ count: 55 });
              setRecentlyIncremented(false);
            } else {
              SoundService.playPop();
              setRecentlyIncremented(true);
              if (incrementTimerRef.current) window.clearTimeout(incrementTimerRef.current);
              incrementTimerRef.current = window.setTimeout(() => setRecentlyIncremented(false), 5000);
            }
            onToggle(task.id, false);
          }
          HapticService.selection();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (typeof document !== 'undefined' && document.querySelector('[role="dialog"], [aria-modal="true"], .duration-info-card-overlay, .spotlight-overlay, .drawer-overlay, .prompt-overlay, .premium-overlay')) {
            return;
          }
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator && navigator.vibrate) navigator.vibrate([6]);
          SoundService.playUncomplete();
          onToggle(task.id, true);
          setRecentlyIncremented(false);
        }}
        title="Clic: avanzar progreso (+1). Clic derecho o botón −: retroceder progreso (-1)."
        aria-label={`${task.title || 'Hábito'}: ${effectiveCurrentCount} de ${task.targetCount}. Sumar una`}
        // Cápsula de 26 px a la vista; la zona táctil de 44 px la pone .hit-44 sin inflar la fila.
        className={`habit-counter hit-44${isEffectivelyDone ? ' is-done' : ''}`}
      >
        <span>{getHabitIcon(task.title)}</span>
        <span>{effectiveCurrentCount}/{task.targetCount}</span>
      </button>

      {recentlyIncremented && !isEffectivelyDone && (
        <motion.button
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            HapticService.impact('light');
            SoundService.playUncomplete();
            onToggle(task.id, true);
            setRecentlyIncremented(false);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            padding: '2px 7px',
            borderRadius: 999,
            fontSize: '0.72rem',
            fontWeight: 600,
            background: 'rgba(0, 122, 255, 0.1)',
            color: 'var(--accent-primary, #007aff)',
            border: '1px solid rgba(0, 122, 255, 0.25)',
            cursor: 'pointer'
          }}
          title="Deshacer repetición (-1)"
        >
          <RotateCcw size={10} />
          <span>Deshacer</span>
        </motion.button>
      )}
    </div>
  );
};
