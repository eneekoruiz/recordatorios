import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Dumbbell, Check, X, ArrowRight, Minus, Plus } from 'lucide-react';
import type { TaskItem } from '../../models/Task';
import { HapticService } from '../../services/HapticService';

interface QuickWeightPromptModalProps {
  isOpen: boolean;
  task: TaskItem | null;
  onConfirm: (weightKg: number, reps?: number) => void;
  onSkip: () => void;
  onCancel: () => void;
}

interface QuickWeightFormProps {
  task: TaskItem;
  onConfirm: (weightKg: number, reps?: number) => void;
  onSkip: () => void;
  onCancel: () => void;
}

const QuickWeightForm: React.FC<QuickWeightFormProps> = ({
  task,
  onConfirm,
  onSkip,
  onCancel,
}) => {
  const lastLog = task.weightLogs && task.weightLogs.length > 0
    ? task.weightLogs[task.weightLogs.length - 1]
    : null;

  const lastRecordedWeight = lastLog ? lastLog.weightKg : null;
  const lastRecordedReps = lastLog?.reps || task.targetCount || 10;

  const [weight, setWeight] = useState<string>(
    lastRecordedWeight !== null ? String(lastRecordedWeight) : '50'
  );
  const [reps, setReps] = useState<string>(String(lastRecordedReps));

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = useCallback(() => {
    const parsedWeight = parseFloat(weight.replace(',', '.'));
    const parsedReps = parseInt(reps, 10);
    if (!isNaN(parsedWeight) && parsedWeight > 0) {
      HapticService.notification('success');
      onConfirm(parsedWeight, !isNaN(parsedReps) && parsedReps > 0 ? parsedReps : undefined);
    } else {
      onSkip();
    }
  }, [weight, reps, onConfirm, onSkip]);

  const adjustWeight = useCallback((delta: number) => {
    HapticService.selection();
    const current = parseFloat(weight.replace(',', '.')) || 0;
    const next = Math.max(0, current + delta);
    setWeight(String(Math.round(next * 100) / 100));
  }, [weight]);

  const adjustReps = useCallback((delta: number) => {
    HapticService.selection();
    const current = parseInt(reps, 10) || 10;
    const next = Math.max(1, current + delta);
    setReps(String(next));
  }, [reps]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onSkip();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmit, onSkip]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      style={{
        width: '100%',
        maxWidth: 410,
        background: 'var(--bg-elevated, #1c1c1e)',
        borderRadius: 20,
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.4), 0 0 0 1px var(--border-subtle, rgba(255, 255, 255, 0.08))',
        padding: '24px 22px',
        color: 'var(--text-primary, #ffffff)',
        boxSizing: 'border-box',
      }}
      role="dialog"
      aria-modal="true"
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: 'rgba(10, 132, 255, 0.15)',
              color: 'var(--accent-primary, #0a84ff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Dumbbell size={20} />
          </div>
          <div style={{ minWidth: 0 }}>
            <h3
              style={{
                margin: 0,
                fontSize: '1.05rem',
                fontWeight: 700,
                lineHeight: 1.25,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {task.title}
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #8e8e93)' }}>
              {lastRecordedWeight !== null
                ? `Último: ${lastRecordedWeight} kg × ${lastRecordedReps} reps`
                : 'Registrar carga de hoy'}
            </span>
          </div>
        </div>

        <button
          onClick={onCancel}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-tertiary, #636366)',
            cursor: 'pointer',
            padding: 6,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Cancelar"
        >
          <X size={18} />
        </button>
      </div>

      {/* Stepper Peso (kg) */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary, #8e8e93)' }}>
            PESO
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            {[-5, -2.5, 2.5, 5].map((delta) => (
              <button
                key={delta}
                type="button"
                onClick={() => adjustWeight(delta)}
                style={{
                  padding: '3px 8px',
                  borderRadius: 6,
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  background: 'var(--bg-surface, #2c2c2e)',
                  border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                  color: 'var(--text-secondary, #8e8e93)',
                  cursor: 'pointer',
                }}
              >
                {delta > 0 ? `+${delta}` : delta}
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={() => adjustWeight(-2.5)}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'var(--bg-surface, #2c2c2e)',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
              color: 'var(--text-primary, #ffffff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title="-2.5 kg"
          >
            <Minus size={18} />
          </button>

          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'center',
              background: 'var(--bg-surface, #2c2c2e)',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
              borderRadius: 14,
              padding: '6px 14px',
            }}
          >
            <input
              ref={inputRef}
              type="number"
              step="0.5"
              min="0"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              style={{
                width: 90,
                fontSize: '1.8rem',
                fontWeight: 800,
                textAlign: 'center',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary, #ffffff)',
                fontFamily: 'inherit',
                fontVariantNumeric: 'tabular-nums',
              }}
            />
            <span style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-secondary, #8e8e93)' }}>
              kg
            </span>
          </div>

          <button
            type="button"
            onClick={() => adjustWeight(2.5)}
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'var(--bg-surface, #2c2c2e)',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
              color: 'var(--text-primary, #ffffff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title="+2.5 kg"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* Stepper Repeticiones */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary, #8e8e93)' }}>
            REPETICIONES
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            {[8, 10, 12].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => {
                  HapticService.selection();
                  setReps(String(num));
                }}
                style={{
                  padding: '3px 8px',
                  borderRadius: 6,
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  background: reps === String(num) ? 'var(--accent-primary, #0a84ff)' : 'var(--bg-surface, #2c2c2e)',
                  color: reps === String(num) ? '#ffffff' : 'var(--text-secondary, #8e8e93)',
                  border: reps === String(num) ? 'none' : '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                  cursor: 'pointer',
                }}
              >
                {num} reps
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
          }}
        >
          <button
            type="button"
            onClick={() => adjustReps(-1)}
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: 'var(--bg-surface, #2c2c2e)',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
              color: 'var(--text-primary, #ffffff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title="-1 rep"
          >
            <Minus size={16} />
          </button>

          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'center',
              background: 'var(--bg-surface, #2c2c2e)',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
              borderRadius: 12,
              padding: '5px 12px',
            }}
          >
            <input
              type="number"
              min="1"
              max="999"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              style={{
                width: 70,
                fontSize: '1.4rem',
                fontWeight: 700,
                textAlign: 'center',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary, #ffffff)',
                fontFamily: 'inherit',
                fontVariantNumeric: 'tabular-nums',
              }}
            />
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary, #8e8e93)' }}>
              reps
            </span>
          </div>

          <button
            type="button"
            onClick={() => adjustReps(1)}
            style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: 'var(--bg-surface, #2c2c2e)',
              border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
              color: 'var(--text-primary, #ffffff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title="+1 rep"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          type="button"
          onClick={handleSubmit}
          style={{
            width: '100%',
            padding: '13px 18px',
            borderRadius: 14,
            background: 'var(--accent-primary, #0a84ff)',
            color: '#ffffff',
            border: 'none',
            fontSize: '0.95rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            cursor: 'pointer',
            transition: 'opacity 0.15s ease',
          }}
        >
          <Check size={18} strokeWidth={2.5} />
          Guardar {weight} kg × {reps} reps y completar
        </button>

        <button
          type="button"
          onClick={onSkip}
          style={{
            width: '100%',
            padding: '9px 14px',
            borderRadius: 12,
            background: 'transparent',
            color: 'var(--text-secondary, #8e8e93)',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            cursor: 'pointer',
          }}
        >
          Omitir peso (completar sin apuntar)
          <ArrowRight size={14} />
        </button>
      </div>
    </motion.div>
  );
};

export const QuickWeightPromptModal: React.FC<QuickWeightPromptModalProps> = ({
  isOpen,
  task,
  onConfirm,
  onSkip,
  onCancel,
}) => {
  if (!isOpen || !task) return null;

  return createPortal(
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          background: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onCancel();
        }}
      >
        <QuickWeightForm
          key={task.id}
          task={task}
          onConfirm={onConfirm}
          onSkip={onSkip}
          onCancel={onCancel}
        />
      </div>
    </AnimatePresence>,
    document.body
  );
};
