import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Dumbbell, 
  Calendar, 
  Check, 
  Timer
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useModalFocus } from '../../hooks/useModalFocus';
import { SheetNavBar } from '../ui/SheetNavBar';
import { HapticService } from '../../services/HapticService';
import { confirmDialog } from '../ui/confirmDialog';
import { 
  switchGymRoutineSplit, 
  type GymRoutineSplit 
} from '../../utils/gymExercises';

interface GymRoutineModalProps {
  isOpen: boolean;
  onClose: () => void;
  listId: string;
}

export function GymRoutineModal({ isOpen, onClose, listId }: GymRoutineModalProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  useModalFocus(sheetRef, isOpen, onClose);

  const lists = useAppStore(state => state.lists);
  const listSections = useAppStore(state => state.listSections);
  const updateList = useAppStore(state => state.updateList);
  const currentList = lists.find(l => l.id === listId);


  if (!currentList) return null;

  const currentSplit: GymRoutineSplit = (currentList.activeRoutineSplit as GymRoutineSplit) || 'torso_pierna_4d';
  const activeGymDaySectionId = currentList.activeGymDaySectionId;
  const showRestPeriods = currentList.showRestPeriods ?? false;

  const daySections = listSections
    .filter(s => s.listId === listId && !s.deleted_at && /d[ií]a\s*\d/i.test(s.name))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const handleSelectDay = (sectionId?: string) => {
    HapticService.selection();
    updateList(listId, { activeGymDaySectionId: sectionId });
  };

  const handleToggleRest = () => {
    HapticService.selection();
    updateList(listId, { showRestPeriods: !showRestPeriods });
  };

  const handleSelectSplit = async (newSplit: GymRoutineSplit) => {
    if (newSplit === currentSplit) return;
    
    const splitNames: Record<GymRoutineSplit, string> = {
      torso_pierna_4d: 'Torso / Pierna (4 días)',
      ppl_3d: 'Empuje / Tirón / Pierna - PPL (3 días)',
      fullbody_3d: 'Cuerpo Completo / Full Body (3 días)'
    };

    const confirmed = await confirmDialog({
      title: `¿Cambiar a ${splitNames[newSplit]}?`,
      message: 'Se actualizarán las secciones y ejercicios del plan para adaptarse a esta división. Tus series previas y notas se conservarán.',
      confirmText: 'Cambiar rutina',
      cancelText: 'Cancelar'
    });

    if (confirmed) {
      const state = useAppStore.getState();
      switchGymRoutineSplit(listId, newSplit, state.userId || '');
      HapticService.notification('success');
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9998,
              background: 'rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)'
            }}
            onClick={onClose}
          />
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Gestionar rutina de gimnasio"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 9999,
              background: 'var(--glass-fill, var(--bg-material, rgba(255, 255, 255, 0.94)))',
              backdropFilter: 'blur(40px) saturate(180%)',
              WebkitBackdropFilter: 'blur(40px) saturate(180%)',
              borderTop: '1px solid var(--border-subtle)',
              borderRadius: '24px 24px 0 0',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.18)',
              padding: '12px 16px calc(24px + env(safe-area-inset-bottom, 0px)) 16px',
              maxHeight: '88dvh',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              maxWidth: 620,
              margin: '0 auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab handle */}
            <div
              style={{
                width: 36,
                height: 5,
                borderRadius: 3,
                background: 'var(--border-strong, rgba(0,0,0,0.22))',
                margin: '0 auto 12px auto'
              }}
            />

            <SheetNavBar
              title="Rutina de Gimnasio"
              onConfirm={onClose}
              confirmLabel="Listo"
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 12 }}>
              {/* SECCIÓN 1: DÍA DE ENTRENAMIENTO PARA HOY */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingLeft: 4 }}>
                  <Calendar size={16} color="var(--accent-primary)" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Día de hoy
                  </span>
                </div>

                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    borderRadius: 14,
                    border: '1px solid var(--border-subtle)',
                    overflow: 'hidden'
                  }}
                >
                  {/* Opción Automática */}
                  <button
                    type="button"
                    onClick={() => handleSelectDay(undefined)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '12px 16px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Automático (inteligente)
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                        Avanza según tu progreso real y cuándo entrenaste por última vez.
                      </div>
                    </div>
                    {!activeGymDaySectionId && (
                      <Check size={18} color="var(--accent-primary)" strokeWidth={2.5} />
                    )}
                  </button>

                  {/* Días de la rutina */}
                  {daySections.map((sec, idx) => {
                    const isSelected = activeGymDaySectionId === sec.id;
                    return (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => handleSelectDay(sec.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          padding: '12px 16px',
                          background: isSelected ? 'var(--bg-hover, rgba(0,122,255,0.06))' : 'transparent',
                          border: 'none',
                          borderBottom: idx < daySections.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              background: isSelected ? 'var(--accent-primary)' : 'var(--bg-hover, rgba(0,0,0,0.08))',
                              color: isSelected ? '#fff' : 'var(--text-secondary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem',
                              fontWeight: 700
                            }}
                          >
                            {idx + 1}
                          </span>
                          <span style={{ fontSize: '0.92rem', fontWeight: isSelected ? 600 : 500, color: 'var(--text-primary)' }}>
                            {sec.name}
                          </span>
                        </div>
                        {isSelected && (
                          <Check size={18} color="var(--accent-primary)" strokeWidth={2.5} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* SECCIÓN 2: DIVISIÓN DE RUTINA (SPLIT) */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingLeft: 4 }}>
                  <Dumbbell size={16} color="var(--accent-primary)" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    División de rutina (Split)
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10
                  }}
                >
                  {[
                    {
                      id: 'torso_pierna_4d' as const,
                      title: 'Torso / Pierna (4 días)',
                      desc: '4 días semanales. Día 1 Tren Superior A, Día 2 Tren Inferior A, Día 3 Tren Superior B, Día 4 Tren Inferior B.',
                      badge: 'Actual'
                    },
                    {
                      id: 'ppl_3d' as const,
                      title: 'Empuje / Tirón / Pierna - PPL (3 días)',
                      desc: '3 días semanales. Día 1 Empuje (pecho/hombro/tríceps), Día 2 Tirón (espalda/bíceps), Día 3 Pierna & glúteo.',
                      badge: 'Recomendado'
                    },
                    {
                      id: 'fullbody_3d' as const,
                      title: 'Cuerpo Completo / Full Body (3 días)',
                      desc: '3 días semanales (L-X-V). Ejercicios multiarticulares equilibrados en cada sesión para máxima eficiencia.',
                      badge: 'Equilibrado'
                    }
                  ].map(split => {
                    const isCurrent = currentSplit === split.id;
                    return (
                      <div
                        key={split.id}
                        onClick={() => handleSelectSplit(split.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          padding: '14px 16px',
                          borderRadius: 14,
                          background: isCurrent ? 'var(--accent-glow, rgba(0, 122, 255, 0.08))' : 'var(--bg-elevated)',
                          border: isCurrent ? '1.5px solid var(--accent-primary, #007aff)' : '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ flex: 1, paddingRight: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {split.title}
                            </span>
                            {isCurrent && (
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  padding: '2px 6px',
                                  borderRadius: 6,
                                  background: 'var(--accent-primary, #007aff)',
                                  color: '#fff'
                                }}
                              >
                                Activo
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.80rem', color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.35 }}>
                            {split.desc}
                          </div>
                        </div>

                        {isCurrent ? (
                          <div
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              background: 'var(--accent-primary, #007aff)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#fff',
                              flexShrink: 0
                            }}
                          >
                            <Check size={14} strokeWidth={2.5} />
                          </div>
                        ) : (
                          <div
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              border: '1.5px solid var(--border-strong, rgba(0,0,0,0.25))',
                              flexShrink: 0
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECCIÓN 3: DESCANSOS INTERMEDIOS */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingLeft: 4 }}>
                  <Timer size={16} color="var(--accent-orange, #ff9500)" />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Visualización de descansos
                  </span>
                </div>

                <div
                  style={{
                    background: 'var(--bg-elevated)',
                    borderRadius: 14,
                    border: '1px solid var(--border-subtle)',
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ paddingRight: 16 }}>
                    <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Mostrar descansos entre ejercicios
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                      Muestra recordatorios estrechos de descanso intermedio en la lista, permitiendo ajustar su tiempo o moverlos.
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={showRestPeriods}
                    onClick={handleToggleRest}
                    style={{
                      width: 50,
                      height: 30,
                      borderRadius: 15,
                      background: showRestPeriods ? 'var(--accent-primary, #007aff)' : 'var(--bg-hover, rgba(0,0,0,0.15))',
                      position: 'relative',
                      border: 'none',
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'background 0.2s ease'
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: 2,
                        left: showRestPeriods ? 22 : 2,
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        background: '#fff',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        transition: 'left 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                      }}
                    />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
