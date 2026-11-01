import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Dumbbell, Zap, Edit3 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { 
  GYM_SPLITS_CONFIG, 
  getSectionGymSplit, 
  type GymRoutineSplit 
} from '../../utils/gymExercises';
import { HapticService } from '../../services/HapticService';

interface GymOtherRoutinesSectionProps {
  listId: string;
  currentSplit: GymRoutineSplit;
  onSwitchSplit: (newSplit: GymRoutineSplit) => void;
  onEditTask: (taskId: string) => void;
}

export const GymOtherRoutinesSection: React.FC<GymOtherRoutinesSectionProps> = ({
  listId,
  currentSplit,
  onSwitchSplit,
  onEditTask
}) => {
  const [isSectionOpen, setIsSectionOpen] = useState(false);
  const [expandedRoutines, setExpandedRoutines] = useState<Record<string, boolean>>({
    ppl_3d: true,
    fullbody_3d: false,
    torso_pierna_4d: false
  });

  const listSections = useAppStore(state => state.listSections) || [];
  const tasks = useAppStore(state => state.tasks) || {};

  const allGymSections = listSections.filter(s => s.listId === listId && !s.deleted_at);
  const allGymTasks = Object.values(tasks).filter(t => !t.deleted_at && (t.categoryId === listId || (t as any).category_id === listId));

  // Rutinas que no son la actual
  const allSplitKeys: GymRoutineSplit[] = ['torso_pierna_4d', 'ppl_3d', 'fullbody_3d'];
  const otherSplits = allSplitKeys.filter(splitKey => splitKey !== currentSplit);

  const toggleRoutineExpanded = (splitKey: string) => {
    HapticService.selection();
    setExpandedRoutines(prev => ({
      ...prev,
      [splitKey]: !prev[splitKey]
    }));
  };

  return (
    <div
      style={{
        margin: '16px 16px 28px 16px',
        padding: '14px 16px',
        borderRadius: 18,
        background: 'var(--bg-elevated, #ffffff)',
        border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)'
      }}
    >
      {/* Cabecera principal del acordeón "Otras rutinas" */}
      <button
        type="button"
        onClick={() => {
          HapticService.selection();
          setIsSectionOpen(prev => !prev);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: 'var(--accent-glow, rgba(0, 122, 255, 0.08))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary, #0a84ff)',
              flexShrink: 0
            }}
          >
            <Dumbbell size={16} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Otras rutinas
              </span>
              <span
                style={{
                  fontSize: '0.70rem',
                  fontWeight: 600,
                  padding: '1px 7px',
                  borderRadius: 10,
                  background: 'var(--bg-surface, rgba(0, 0, 0, 0.05))',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                {otherSplits.length} disponibles
              </span>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'block', marginTop: 1 }}>
              Prepara y personaliza tus rutinas de 3 días antes de activarlas
            </span>
          </div>
        </div>

        <div style={{ color: 'var(--text-tertiary)', paddingLeft: 8 }}>
          {isSectionOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </div>
      </button>

      {/* Contenido desplegable con las otras rutinas */}
      {isSectionOpen && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {otherSplits.map(splitKey => {
            const config = GYM_SPLITS_CONFIG[splitKey];
            const isExpanded = Boolean(expandedRoutines[splitKey]);

            // Secciones que pertenecen a este split
            const splitSections = allGymSections
              .filter(s => getSectionGymSplit(s) === splitKey)
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

            return (
              <div
                key={splitKey}
                style={{
                  borderRadius: 14,
                  border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
                  background: 'var(--bg-surface, rgba(0, 0, 0, 0.02))',
                  overflow: 'hidden'
                }}
              >
                {/* Cabecera del split */}
                <div
                  style={{
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    background: 'var(--bg-elevated, #ffffff)',
                    borderBottom: isExpanded ? '1px solid var(--border-subtle)' : 'none'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleRoutineExpanded(splitKey)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      textAlign: 'left',
                      flex: 1,
                      minWidth: 0
                    }}
                  >
                    <div style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {config.name}
                        </span>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 600,
                            padding: '1px 6px',
                            borderRadius: 6,
                            background: 'var(--bg-hover, rgba(0, 0, 0, 0.06))',
                            color: 'var(--text-secondary)'
                          }}
                        >
                          {config.badge}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block', marginTop: 2 }}>
                        {config.description}
                      </span>
                    </div>
                  </button>

                  {/* Botón para activar esta rutina */}
                  <button
                    type="button"
                    onClick={() => {
                      HapticService.selection();
                      onSwitchSplit(splitKey);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '6px 11px',
                      borderRadius: 8,
                      background: 'var(--accent-primary, #0a84ff)',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  >
                    <Zap size={13} />
                    <span>Activar</span>
                  </button>
                </div>

                {/* Lista de días y ejercicios de este split */}
                {isExpanded && (
                  <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {splitSections.map((sec) => {
                      const secTasks = allGymTasks
                        .filter(t => t.sectionId === sec.id && !t.isRest)
                        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

                      return (
                        <div
                          key={sec.id}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 10,
                            background: 'var(--bg-elevated, #ffffff)',
                            border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.06))'
                          }}
                        >
                          {/* Título del día */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {sec.name}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                              {secTasks.length} ejercicios
                            </span>
                          </div>

                          {/* Ejercicios del día */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {secTasks.map(task => {
                              const sets = task.targetCount || 3;
                              const workMins = typeof task.duration === 'number' && task.duration > 0 ? task.duration : 1;
                              const restSec = task.restDuration || 90;

                              return (
                                <div
                                  key={task.id}
                                  onClick={() => {
                                    HapticService.selection();
                                    onEditTask(task.id);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '6px 8px',
                                    borderRadius: 6,
                                    background: 'var(--bg-surface, rgba(0, 0, 0, 0.02))',
                                    cursor: 'pointer',
                                    transition: 'background 0.15s ease'
                                  }}
                                  title="Toca para editar series, duración o descansos"
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                    <Edit3 size={12} color="var(--text-tertiary)" />
                                    <span style={{ fontSize: '0.80rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {task.title}
                                    </span>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                    <span
                                      style={{
                                        fontSize: '0.72rem',
                                        fontWeight: 600,
                                        color: 'var(--text-secondary)',
                                        background: 'var(--bg-elevated)',
                                        padding: '2px 5px',
                                        borderRadius: 4,
                                        border: '1px solid var(--border-subtle)'
                                      }}
                                    >
                                      {sets}×{workMins}m
                                    </span>
                                    <span
                                      style={{
                                        fontSize: '0.70rem',
                                        fontWeight: 600,
                                        color: 'var(--accent-primary, #0a84ff)',
                                        background: 'var(--accent-glow, rgba(0, 122, 255, 0.08))',
                                        padding: '2px 5px',
                                        borderRadius: 4
                                      }}
                                    >
                                      {restSec}s desc
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
