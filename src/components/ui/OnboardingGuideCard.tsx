import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Command, Headphones, X, Check, ArrowRight } from 'lucide-react';
import { SoundService } from '../../services/SoundService';

export function OnboardingGuideCard() {
  const [isVisible, setIsVisible] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem('onboarding_completed_steps');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const isHidden = localStorage.getItem('hide_onboarding_guide') === 'true';
    if (!isHidden) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('hide_onboarding_guide', 'true');
    setIsVisible(false);
    SoundService.playPop();
  };

  const handleToggleStep = (stepIndex: number) => {
    const next = completedSteps.includes(stepIndex)
      ? completedSteps.filter(s => s !== stepIndex)
      : [...completedSteps, stepIndex];
    setCompletedSteps(next);
    localStorage.setItem('onboarding_completed_steps', JSON.stringify(next));
    if (!completedSteps.includes(stepIndex)) {
      SoundService.playComplete();
    }
  };

  if (!isVisible) return null;

  const steps = [
    {
      title: 'Añadir con Lenguaje Natural',
      desc: 'Escribe en la barra inferior: "Reunión mañana a las 10:00 !alta @Trabajo"',
      icon: <Sparkles size={16} color="var(--accent-primary)" />,
      actionLabel: 'Probar',
      onAction: () => {
        const input = document.querySelector('input[placeholder*="Añadir rápido"]') as HTMLInputElement;
        if (input) {
          input.focus();
          input.value = 'Comprar pan mañana a las 18:00 !alta';
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    },
    {
      title: 'Paleta de Comandos (Ctrl + K)',
      desc: 'Pulsa Ctrl+K o "/" para buscar cualquier tarea, ciclo o lista en milisegundos.',
      icon: <Command size={16} color="var(--accent-orange)" />,
      actionLabel: 'Abrir (Ctrl+K)',
      onAction: () => {
        window.dispatchEvent(new Event('open-command-palette'));
      }
    },
    {
      title: 'Modo Enfoque Zen con Audio',
      desc: 'Pasa el ratón sobre cualquier recordatorio y pulsa el botón ▶ para activar el modo Pomodoro con sonidos de lluvia o mar.',
      icon: <Headphones size={16} color="var(--accent-green)" />,
      actionLabel: 'Ver Atajos',
      onAction: () => {
        window.dispatchEvent(new Event('open-shortcuts-modal'));
      }
    }
  ];

  const progressPercent = Math.round((completedSteps.length / steps.length) * 100);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        style={{
          background: 'var(--bg-surface-glass)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid var(--border-color)',
          borderRadius: 18,
          padding: '16px 20px',
          margin: '0 16px 20px 16px',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.05)',
          boxSizing: 'border-box'
        }}
      >
        {/* Card Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={16} color="var(--accent-primary)" />
            </div>
            <div>
              <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Guía Rápida de Productividad ({completedSteps.length}/{steps.length})
              </h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Descubre cómo aprovechar al máximo Recordatorios Élite
              </span>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center'
            }}
            title="Ocultar guía"
          >
            <X size={16} />
          </button>
        </div>

        {/* Progress Bar */}
        <div style={{ width: '100%', height: 4, background: 'var(--border-subtle)', borderRadius: 2, marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ width: `${progressPercent}%`, height: '100%', background: 'var(--accent-primary)', borderRadius: 2, transition: 'width 0.3s ease' }} />
        </div>

        {/* Step Items */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {steps.map((step, idx) => {
            const isDone = completedSteps.includes(idx);
            return (
              <div
                key={idx}
                style={{
                  background: isDone ? 'rgba(52, 199, 89, 0.08)' : 'var(--bg-elevated)',
                  border: isDone ? '1px solid rgba(52, 199, 89, 0.3)' : '1px solid var(--border-subtle)',
                  borderRadius: 12,
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 8,
                  transition: 'all 0.18s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <button
                    onClick={() => handleToggleStep(idx)}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      border: isDone ? 'none' : '1.5px solid var(--border-color)',
                      background: isDone ? 'var(--accent-green)' : 'transparent',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                      marginTop: 2
                    }}
                  >
                    {isDone && <Check size={12} strokeWidth={3} />}
                  </button>
                  <div>
                    <h4 style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px 0' }}>
                      {step.title}
                    </h4>
                    <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.35 }}>
                      {step.desc}
                    </p>
                  </div>
                </div>

                <button
                  onClick={step.onAction}
                  style={{
                    alignSelf: 'flex-end',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent-primary)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 6px'
                  }}
                >
                  {step.actionLabel} <ArrowRight size={12} />
                </button>
              </div>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
