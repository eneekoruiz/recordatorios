import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, ArrowRight, Trash2, Rocket } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { SoundService } from '../../services/SoundService';

export function OnboardingGuideCard() {
  const [isVisible, setIsVisible] = useState(false);

  const tasksMap = useAppStore((state) => state.tasks);
  const toggleTask = useAppStore((state) => state.toggleTask);
  const removeList = useAppStore((state) => state.removeList);
  const deleteTask = useAppStore((state) => state.deleteTask);

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

  const handleSkipAndRemoveList = () => {
    localStorage.setItem('hide_onboarding_guide', 'true');
    setIsVisible(false);

    // Eliminar las tareas de onboarding y la lista 'primeros_pasos'
    Object.values(tasksMap).forEach((t) => {
      if (t.categoryId === 'primeros_pasos') {
        deleteTask(t.id);
      }
    });
    removeList('primeros_pasos');
    SoundService.playPop();
  };

  const handleGoToList = () => {
    window.dispatchEvent(new CustomEvent('select-view', { detail: 'list_primeros_pasos' }));
  };

  if (!isVisible) return null;

  // Obtener tareas reales de la lista 'primeros_pasos'
  const onboardingTasks = Object.values(tasksMap).filter(t => t.categoryId === 'primeros_pasos');
  const completedTasks = onboardingTasks.filter(t => t.status === 'completed' || !!(t as any).completed_at);

  const totalCount = onboardingTasks.length || 5;
  const completedCount = completedTasks.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  // Acciones predeterminadas asociadas a las tareas de primeros pasos
  const getActionForTask = (task: any) => {
    if (task.id === 'task_onboarding_1' || task.title.includes('lenguaje natural')) {
      return {
        label: 'Probar',
        onClick: () => {
          const input = document.querySelector('input[placeholder*="Añadir rápido"]') as HTMLInputElement;
          if (input) {
            input.focus();
            input.value = 'Comprar pan mañana a las 18:00 !alta';
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
      };
    }
    if (task.id === 'task_onboarding_2' || task.title.includes('Paleta de Comandos')) {
      return {
        label: 'Abrir (Ctrl+K)',
        onClick: () => window.dispatchEvent(new Event('open-command-palette'))
      };
    }
    if (task.id === 'task_onboarding_3' || task.title.includes('Enfoque Zen')) {
      return {
        label: 'Ver Atajos',
        onClick: () => window.dispatchEvent(new Event('open-shortcuts-modal'))
      };
    }
    return {
      label: 'Ver Lista',
      onClick: handleGoToList
    };
  };

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg, rgba(255, 45, 85, 0.15), rgba(255, 149, 0, 0.15))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Rocket size={18} color="#ff2d55" />
            </div>
            <div>
              <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                Primeros Pasos ({completedCount}/{totalCount})
              </h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Completa estas tareas reales para dominar la aplicación o táchalas directamente
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={handleGoToList}
              style={{
                background: 'rgba(255, 45, 85, 0.1)',
                border: '1px solid rgba(255, 45, 85, 0.25)',
                color: '#ff2d55',
                fontSize: '0.78rem',
                fontWeight: 600,
                borderRadius: 8,
                padding: '4px 10px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <span>Ver Lista 🚀</span>
            </button>

            <button
              onClick={handleSkipAndRemoveList}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-tertiary)',
                fontSize: '0.78rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 6px'
              }}
              title="Quitar esta guía y eliminar la lista de Primeros Pasos"
            >
              <Trash2 size={14} />
              <span>Saltar y quitar</span>
            </button>

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
              title="Ocultar banner"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ width: '100%', height: 5, background: 'var(--border-subtle)', borderRadius: 3, marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ width: `${progressPercent}%`, height: '100%', background: 'linear-gradient(90deg, #ff2d55, #ff9500)', borderRadius: 3, transition: 'width 0.35s ease' }} />
        </div>

        {/* Task Items Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
          {onboardingTasks.map((task) => {
            const isDone = task.status === 'completed' || !!(task as any).completed_at;
            const action = getActionForTask(task);

            return (
              <div
                key={task.id}
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
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <button
                    onClick={() => {
                      toggleTask(task.id);
                      if (!isDone) SoundService.playComplete();
                    }}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      border: isDone ? 'none' : '1.5px solid var(--border-color)',
                      background: isDone ? 'var(--accent-green)' : 'transparent',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                      marginTop: 2,
                      transition: 'transform 0.15s ease'
                    }}
                    title={isDone ? 'Marcar como pendiente' : 'Tachar tarea'}
                  >
                    {isDone && <Check size={13} strokeWidth={3} />}
                  </button>
                  <div>
                    <h4 style={{
                      fontSize: '0.86rem',
                      fontWeight: 600,
                      color: isDone ? 'var(--text-secondary)' : 'var(--text-primary)',
                      textDecoration: isDone ? 'line-through' : 'none',
                      margin: '0 0 2px 0'
                    }}>
                      {task.title}
                    </h4>
                    {task.description && (
                      <p style={{
                        fontSize: '0.76rem',
                        color: 'var(--text-secondary)',
                        margin: 0,
                        lineHeight: 1.35,
                        opacity: isDone ? 0.7 : 1
                      }}>
                        {task.description}
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 4 }}>
                  <button
                    onClick={action.onClick}
                    style={{
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
                    {action.label} <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
