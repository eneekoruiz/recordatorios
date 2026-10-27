import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Dumbbell, Check, X, ArrowRight, Minus, Plus } from 'lucide-react';
import type { TaskItem } from '../../models/Task';

interface QuickWeightPromptModalProps {
  isOpen: boolean;
  task: TaskItem | null;
  onConfirm: (weightKg: number) => void;
  onSkip: () => void;
  onCancel: () => void;
}

export const QuickWeightPromptModal: React.FC<QuickWeightPromptModalProps> = ({
  isOpen,
  task,
  onConfirm,
  onSkip,
  onCancel,
}) => {
  const lastRecordedWeight = task?.weightLogs && task.weightLogs.length > 0
    ? task.weightLogs[task.weightLogs.length - 1].weightKg
    : null;

  const [weight, setWeight] = useState<string>(
    lastRecordedWeight !== null ? String(lastRecordedWeight) : '50'
  );

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (lastRecordedWeight !== null) {
        setWeight(String(lastRecordedWeight));
      } else {
        setWeight('50');
      }
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [isOpen, lastRecordedWeight]);

  useEffect(() => {
    if (!isOpen) return;

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
  }, [isOpen, weight]);

  const handleSubmit = () => {
    const parsed = parseFloat(weight.replace(',', '.'));
    if (!isNaN(parsed) && parsed > 0) {
      onConfirm(parsed);
    } else {
      onSkip();
    }
  };

  const adjustWeight = (delta: number) => {
    const current = parseFloat(weight.replace(',', '.')) || 0;
    const next = Math.max(0, current + delta);
    setWeight(String(Math.round(next * 100) / 100));
  };

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
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onCancel();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          style={{
            width: '100%',
            maxWidth: 400,
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'rgba(10, 132, 255, 0.15)',
                  color: 'var(--accent-primary, #0a84ff)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Dumbbell size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.2 }}>
                  {task.title}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #8e8e93)' }}>
                  {lastRecordedWeight !== null ? `Última carga: ${lastRecordedWeight} kg` : 'Registrar peso de hoy'}
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

          {/* Stepper & Input */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              margin: '20px 0 16px 0',
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
                fontSize: '1rem',
                fontWeight: 600,
              }}
              title="-2.5 kg"
            >
              <Minus size={18} />
            </button>

            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                background: 'var(--bg-surface, #2c2c2e)',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
                borderRadius: 14,
                padding: '8px 18px',
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
                  fontSize: '2rem',
                  fontWeight: 800,
                  textAlign: 'center',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary, #ffffff)',
                  fontFamily: 'inherit',
                }}
              />
              <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-secondary, #8e8e93)' }}>
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
                fontSize: '1rem',
                fontWeight: 600,
              }}
              title="+2.5 kg"
            >
              <Plus size={18} />
            </button>
          </div>

          {/* Quick Increments */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 24,
            }}
          >
            {[-5, -1.25, 1.25, 5].map((delta) => (
              <button
                key={delta}
                type="button"
                onClick={() => adjustWeight(delta)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 8,
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  background: 'var(--bg-surface, #2c2c2e)',
                  border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
                  color: 'var(--text-secondary, #8e8e93)',
                  cursor: 'pointer',
                }}
              >
                {delta > 0 ? `+${delta}` : delta} kg
              </button>
            ))}
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
              Guardar peso y completar
            </button>

            <button
              type="button"
              onClick={onSkip}
              style={{
                width: '100%',
                padding: '10px 14px',
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
      </div>
    </AnimatePresence>,
    document.body
  );
};
