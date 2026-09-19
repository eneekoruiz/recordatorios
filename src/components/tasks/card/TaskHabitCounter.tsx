import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
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

  const getHabitIcon = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes('agua')) return '💧';
    if (t.includes('diente')) return '🪥';
    if (t.includes('mano')) return '🧼';
    if (t.includes('aplicacion')) return '🧴';
    return '⚡';
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, verticalAlign: 'middle' }}>
      {effectiveCurrentCount > 0 && !isEffectivelyDone && (
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
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
            borderRadius: '50%',
            border: '1px solid var(--border-subtle, rgba(0,0,0,0.15))',
            background: 'var(--bg-hover, rgba(0,0,0,0.05))',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 700,
            padding: 0,
            lineHeight: 1
          }}
        >
          -
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
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator && navigator.vibrate) navigator.vibrate([6]);
          SoundService.playUncomplete();
          onToggle(task.id, true);
          setRecentlyIncremented(false);
        }}
        title="Clic: avanzar progreso (+1). Clic derecho o botón -: retroceder progreso (-1)."
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          borderRadius: 12,
          fontSize: '0.78rem',
          fontWeight: 600,
          background: isEffectivelyDone ? 'rgba(52, 199, 89, 0.15)' : 'rgba(0, 122, 255, 0.12)',
          color: isEffectivelyDone ? '#34C759' : '#007AFF',
          border: 'none',
          cursor: 'pointer',
          verticalAlign: 'middle',
          lineHeight: '1.2'
        }}
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
