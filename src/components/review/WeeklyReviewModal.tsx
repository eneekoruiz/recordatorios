import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, CheckCircle2, Trophy, ArrowRight, ArrowLeft,
  Sparkles, Heart, RotateCcw
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { ReviewAgentService, type WeeklyReviewReport } from '../../services/ReviewAgentService';
import { formatDuration } from '../../utils/taskDuration';
import { HapticService } from '../../services/HapticService';
import { ConfettiService } from '../../services/ConfettiService';

export interface WeeklyReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WeeklyReviewModal: React.FC<WeeklyReviewModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const tasks = useAppStore(state => state.tasks);
  const lists = useAppStore(state => state.lists);
  const listSections = useAppStore(state => state.listSections);
  const updateTask = useAppStore(state => state.updateTask);
  const toggleTask = useAppStore(state => state.toggleTask);

  const report: WeeklyReviewReport = useMemo(() => {
    return ReviewAgentService.generateWeeklyAudit(tasks, lists, listSections);
  }, [tasks, lists, listSections]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleNextStep = () => {
    HapticService.selection();
    if (step === 1) {
      ConfettiService.fire({ count: 60 });
    }
    if (step < 4) {
      setStep((step + 1) as any);
    } else {
      onClose();
    }
  };

  const handlePrevStep = () => {
    HapticService.selection();
    if (step > 1) {
      setStep((step - 1) as any);
    }
  };

  const handlePostponeWeek = useCallback((taskId: string) => {
    HapticService.selection();
    const task = tasks[taskId];
    if (!task) return;
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    updateTask(taskId, {
      dueDate: nextWeek,
      postponeCount: (task.postponeCount || 0) + 1
    });
  }, [tasks, updateTask]);

  const STEPS_TITLE = [
    'Logros de la Semana',
    'Triaje & Limpieza',
    'Hábitos & Bienestar',
    'Plan Próxima Semana'
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            pointerEvents: 'auto'
          }}
        >
          {/* Backdrop con blur profundo Apple */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)'
            }}
          />

          {/* Modal flotante */}
          <motion.div
            role="dialog"
            aria-label="Agente de Revisión Semanal"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', damping: 28, stiffness: 360 }}
            onClick={e => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '540px',
              borderRadius: '28px',
              background: 'var(--bg-elevated, #ffffff)',
              color: 'var(--text-primary, #1c1c1e)',
              boxShadow: '0 28px 70px rgba(0, 0, 0, 0.32), 0 4px 16px rgba(0, 0, 0, 0.08)',
              border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh'
            }}
          >
            {/* Cabecera */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 24px 16px',
                borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.06))'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'rgba(88, 86, 214, 0.14)',
                    color: '#5856D6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                    Agente de Revisión Semanal
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Paso {step} de 4 · {STEPS_TITLE[step - 1]}
                    </p>
                    <div style={{ display: 'inline-flex', gap: 3, marginLeft: 2 }} aria-hidden="true">
                      {[1, 2, 3, 4].map(idx => (
                        <div
                          key={idx}
                          style={{
                            height: 3,
                            width: 14,
                            borderRadius: 2,
                            background: idx <= step ? 'var(--accent-primary, #0a84ff)' : 'var(--border-subtle, rgba(0,0,0,0.12))',
                            transition: 'background 0.25s ease'
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'var(--bg-tertiary, rgba(0,0,0,0.06))',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={17} />
              </button>
            </div>

            {/* Contenido según el paso */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {/* PASO 1: CELEBRAR LOGROS */}
              {step === 1 && (
                <div>
                  <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: '50%',
                        background: 'rgba(255, 204, 0, 0.16)',
                        color: '#ffcc00',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 12px'
                      }}
                    >
                      <Trophy size={28} />
                    </div>
                    <h4 style={{ margin: '0 0 6px', fontSize: '1.25rem', fontWeight: 800 }}>
                      ¡Celebrando tu semana!
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                      Revisemos lo que has conseguido durante los últimos 7 días.
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                    <div style={{ padding: '16px', borderRadius: 18, background: 'var(--bg-secondary, rgba(0,0,0,0.03))', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-tertiary)' }}>
                        Completados
                      </span>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#30d158', marginTop: 4 }}>
                        {report.completedCount}
                      </div>
                    </div>

                    <div style={{ padding: '16px', borderRadius: 18, background: 'var(--bg-secondary, rgba(0,0,0,0.03))', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-tertiary)' }}>
                        Tiempo invertido
                      </span>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0a84ff', marginTop: 4 }}>
                        ~{formatDuration(report.completedMinutes)}
                      </div>
                    </div>
                  </div>

                  {report.topAchievements.length > 0 && (
                    <div>
                      <h5 style={{ margin: '0 0 8px', fontSize: '0.82rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 700 }}>
                        Logros destacados
                      </h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {report.topAchievements.map((title, i) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '10px 14px',
                              borderRadius: 12,
                              background: 'var(--bg-secondary, rgba(0,0,0,0.025))',
                              fontSize: '0.88rem',
                              fontWeight: 600
                            }}
                          >
                            <CheckCircle2 size={16} color="#30d158" style={{ flexShrink: 0 }} />
                            <span>{title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* PASO 2: TRIAJE Y LIMPIEZA */}
              {step === 2 && (
                <div>
                  <h4 style={{ margin: '0 0 6px', fontSize: '1.1rem', fontWeight: 700 }}>
                    Triaje de tareas estancadas y vencidas
                  </h4>
                  <p style={{ margin: '0 0 16px', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                    Mantén tu mente ligera resolviendo las tareas pendientes con más de una semana.
                  </p>

                  {report.staleTasks.length === 0 && report.overdueTasks.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 16px', color: '#30d158' }}>
                      <CheckCircle2 size={36} style={{ margin: '0 auto 10px' }} />
                      <div style={{ fontWeight: 700, fontSize: '1rem' }}>¡Bandeja impecable!</div>
                      <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                        No tienes tareas estancadas ni vencidas pendientes.
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[...report.overdueTasks, ...report.staleTasks].slice(0, 6).map(t => (
                        <div
                          key={t.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 14px',
                            borderRadius: 14,
                            background: 'var(--bg-secondary, rgba(0,0,0,0.025))',
                            border: '1px solid var(--border-subtle, rgba(0,0,0,0.04))',
                            gap: 10
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: '0.88rem', fontWeight: 650, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {t.title}
                            </div>
                            <div style={{ fontSize: '0.74rem', color: '#ff9500', marginTop: 2 }}>
                              {t.dueDate ? `Vencida ${t.dueDate}` : 'Estancada > 7 días'}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => handlePostponeWeek(t.id)}
                              style={{
                                padding: '6px 10px',
                                borderRadius: 10,
                                background: 'rgba(0, 122, 255, 0.1)',
                                color: '#007aff',
                                border: '1px solid rgba(0, 122, 255, 0.22)',
                                fontSize: '0.76rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                transition: 'background 0.15s ease, transform 0.1s ease'
                              }}
                              title="Posponer 1 semana"
                            >
                              <RotateCcw size={12} /> +1 sem
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                HapticService.selection();
                                toggleTask(t.id);
                              }}
                              style={{
                                padding: '6px 10px',
                                borderRadius: 10,
                                background: 'rgba(48, 209, 88, 0.1)',
                                color: '#30d158',
                                border: '1px solid rgba(48, 209, 88, 0.22)',
                                fontSize: '0.76rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'background 0.15s ease, transform 0.1s ease'
                              }}
                              title="Marcar completada"
                            >
                              Hecho
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* PASO 3: HÁBITOS & BIENESTAR */}
              {step === 3 && (
                <div>
                  <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: '50%',
                        background: 'rgba(255, 45, 85, 0.14)',
                        color: '#ff2d55',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 10px'
                      }}
                    >
                      <Heart size={26} />
                    </div>
                    <h4 style={{ margin: '0 0 6px', fontSize: '1.2rem', fontWeight: 800 }}>
                      Hábitos Vitales & Salud
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                      Los hábitos esenciales aseguran tu energía para todo lo demás.
                    </p>
                  </div>

                  <div style={{ padding: '18px', borderRadius: 20, background: 'var(--bg-secondary, rgba(0,0,0,0.03))', textAlign: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ff2d55' }}>
                      {report.vitalHabitsCompliancePercent}%
                    </div>
                    <span style={{ fontSize: '0.80rem', fontWeight: 650, color: 'var(--text-secondary)' }}>
                      Cumplimiento de hábitos vitales
                    </span>
                  </div>

                  <div style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(50, 173, 230, 0.08)', border: '1px solid rgba(50, 173, 230, 0.2)' }}>
                    <div style={{ fontSize: '0.86rem', lineHeight: 1.4, color: 'var(--text-primary)' }}>
                      💧 <strong>Recordatorio del Agente:</strong> Beber agua, comer a tus horas y descansar no son tareas opcionales ni negociables. Tu lista de hábitos vitales se reinicia cada día para ayudarte a mantener el equilibrio.
                    </div>
                  </div>
                </div>
              )}

              {/* PASO 4: PLAN & RECOMENDACIONES */}
              {step === 4 && (
                <div>
                  <h4 style={{ margin: '0 0 6px', fontSize: '1.15rem', fontWeight: 800 }}>
                    Recomendaciones para la próxima semana
                  </h4>
                  <p style={{ margin: '0 0 16px', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                    El agente ha sintetizado las claves de tu ritmo actual:
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                    {report.recommendations.map((rec, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '12px 16px',
                          borderRadius: 14,
                          background: 'var(--bg-secondary, rgba(0,0,0,0.03))',
                          fontSize: '0.88rem',
                          lineHeight: 1.45,
                          borderLeft: '4px solid #5856D6'
                        }}
                      >
                        {rec}
                      </div>
                    ))}
                  </div>

                  <div style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(48, 209, 88, 0.1)', textAlign: 'center', color: '#30d158', fontWeight: 700 }}>
                    ✨ ¡Revisión semanal completada! Todo listo para una semana productiva y en calma.
                  </div>
                </div>
              )}
            </div>

            {/* Pie con botones de navegación */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 24px 20px',
                borderTop: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
                background: 'var(--bg-elevated, #ffffff)'
              }}
            >
              {step > 1 ? (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 12,
                    background: 'var(--bg-secondary, rgba(0,0,0,0.06))',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    fontWeight: 650,
                    fontSize: '0.84rem',
                    cursor: 'pointer'
                  }}
                >
                  <ArrowLeft size={14} /> Anterior
                </button>
              ) : <div />}

              <button
                type="button"
                onClick={handleNextStep}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 20px',
                  borderRadius: 14,
                  background: 'var(--accent-primary, #0a84ff)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(10, 132, 255, 0.35)'
                }}
              >
                {step === 4 ? 'Finalizar revisión' : 'Continuar'} <ArrowRight size={14} />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
