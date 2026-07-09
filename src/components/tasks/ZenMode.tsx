import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, CheckCircle, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface ZenModeProps {
  taskId: string | null;
  onClose: () => void;
}

export function ZenMode({ taskId, onClose }: ZenModeProps) {
  const { tasks, toggleTask } = useAppStore();
  const task = taskId ? tasks[taskId] : null;
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (task && task.duration) {
      setTimeLeft(task.duration * 60);
    } else {
      setTimeLeft(25 * 60);
    }
    setIsActive(false);
  }, [taskId, task]);

  useEffect(() => {
    let interval: any;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  if (!taskId || !task) return null;

  const handleComplete = () => {
    toggleTask(task.id);
    onClose();
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'var(--bg-base)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-64)'
        }}
      >
        <button 
          onClick={onClose}
          style={{ position: 'absolute', top: 'var(--space-32)', right: 'var(--space-32)', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}
        >
          <X size={32} />
        </button>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          style={{ textAlign: 'center', maxWidth: '800px' }}
        >
          <h2 className="text-display" style={{ fontSize: '4rem', lineHeight: 1.1, marginBottom: 'var(--space-24)', color: 'white' }}>
            {task.title}
          </h2>
          {task.description && (
            <p className="text-body" style={{ fontSize: '1.5rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-48)' }}>
              {task.description}
            </p>
          )}

          {/* Pomodoro Timer */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-16)', marginBottom: 'var(--space-64)' }}>
            <div style={{ fontSize: '6rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: isActive ? 'var(--accent-primary)' : 'var(--text-tertiary)', transition: 'color 0.3s ease' }}>
              {formatTime(timeLeft)}
            </div>
            <button 
              onClick={() => setIsActive(!isActive)}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-8)',
                padding: 'var(--space-12) var(--space-32)',
                background: isActive ? 'rgba(255, 255, 255, 0.1)' : 'var(--accent-primary)',
                color: 'white', border: 'none', borderRadius: 'var(--radius-full)',
                fontSize: '1.2rem', fontWeight: 600, cursor: 'pointer'
              }}
            >
              {isActive ? <><Pause /> Pausar</> : <><Play /> Enfocarse</>}
            </button>
          </div>

          <button 
            onClick={handleComplete}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-12)',
              width: '100%', padding: 'var(--space-24)',
              background: 'var(--accent-green)',
              color: 'var(--bg-base)', border: 'none', borderRadius: 'var(--radius-lg)',
              fontSize: '1.5rem', fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 8px 32px rgba(48, 209, 88, 0.3)'
            }}
          >
            <CheckCircle size={28} /> Misión Cumplida
          </button>
        </motion.div>

      </motion.div>
    </AnimatePresence>
  );
}
