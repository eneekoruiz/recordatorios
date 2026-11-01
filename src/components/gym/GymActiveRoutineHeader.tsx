import React from 'react';
import { Dumbbell, Flame, Settings2 } from 'lucide-react';
import type { ListSection } from '../../models/Task';
import { GYM_SPLITS_CONFIG, type GymRoutineSplit } from '../../utils/gymExercises';
import { HapticService } from '../../services/HapticService';

interface GymActiveRoutineHeaderProps {
  currentSplit: GymRoutineSplit;
  activeGymSectionId: string | null;
  daySections: ListSection[];
  onSelectDay: (sectionId: string) => void;
  onOpenRoutineModal: () => void;
}

export const GymActiveRoutineHeader: React.FC<GymActiveRoutineHeaderProps> = ({
  currentSplit,
  activeGymSectionId,
  daySections,
  onSelectDay,
  onOpenRoutineModal
}) => {
  const config = GYM_SPLITS_CONFIG[currentSplit] || GYM_SPLITS_CONFIG.torso_pierna_4d;

  return (
    <div
      style={{
        margin: '12px 16px 8px 16px',
        padding: '12px 14px',
        borderRadius: 16,
        background: 'var(--bg-elevated, #ffffff)',
        border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }}
    >
      {/* Barra superior con split actual y botón para gestionar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'var(--accent-glow, rgba(0, 122, 255, 0.1))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary, #0a84ff)',
              flexShrink: 0
            }}
          >
            <Dumbbell size={16} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.90rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {config.name}
              </span>
              <span
                style={{
                  fontSize: '0.70rem',
                  fontWeight: 600,
                  padding: '1px 6px',
                  borderRadius: 6,
                  background: 'var(--accent-primary, #0a84ff)',
                  color: '#ffffff'
                }}
              >
                {config.badge}
              </span>
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)', display: 'block', marginTop: 1 }}>
              Toca un día para marcarlo como el entrenamiento de hoy
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            HapticService.selection();
            onOpenRoutineModal();
          }}
          title="Gestionar rutina y split"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '5px 9px',
            borderRadius: 8,
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface, rgba(0, 0, 0, 0.03))',
            color: 'var(--text-secondary)',
            fontSize: '0.76rem',
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0
          }}
        >
          <Settings2 size={13} />
          <span>Gestionar</span>
        </button>
      </div>

      {/* Selector de días horizontal */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          paddingBottom: 2,
          scrollbarWidth: 'none'
        }}
      >
        {daySections.map((sec, idx) => {
          const isActive = activeGymSectionId === sec.id;
          // Extraer número o nombre corto del día (ej. "Día 1", "Día 2")
          const dayMatch = sec.name.match(/d[ií]a\s*(\d+)/i);
          const shortLabel = dayMatch ? `Día ${dayMatch[1]}` : `Día ${idx + 1}`;
          const cleanSubtitle = sec.name.replace(/d[ií]a\s*\d+\s*:?\s*/i, '').trim();

          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => {
                HapticService.selection();
                onSelectDay(sec.id);
              }}
              style={{
                flex: '1 1 0',
                minWidth: 80,
                padding: '7px 8px',
                borderRadius: 10,
                border: isActive
                  ? '1.5px solid var(--accent-primary, #0a84ff)'
                  : '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
                background: isActive
                  ? 'var(--accent-glow, rgba(0, 122, 255, 0.12))'
                  : 'var(--bg-surface, rgba(0, 0, 0, 0.02))',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {isActive && <Flame size={12} color="var(--accent-orange, #ff9500)" />}
                <span
                  style={{
                    fontSize: '0.80rem',
                    fontWeight: 700,
                    color: isActive ? 'var(--accent-primary, #0a84ff)' : 'var(--text-primary)'
                  }}
                >
                  {shortLabel}
                </span>
              </div>
              {cleanSubtitle && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 90
                  }}
                  title={cleanSubtitle}
                >
                  {cleanSubtitle}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
