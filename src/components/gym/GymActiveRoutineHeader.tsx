import React from 'react';
import { Dumbbell, Flame, Moon, Settings2 } from 'lucide-react';
import { getWeeklySplitSchedule } from '../../utils/weeklyPlan';
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

      {/* Planificación semanal: Lunes a Domingo con días de descanso */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          paddingBottom: 2,
          scrollbarWidth: 'none'
        }}
        role="region"
        aria-label="Planificación semanal de entrenamiento y descansos"
      >
        {getWeeklySplitSchedule(currentSplit, daySections).map((item) => {
          if (item.isRest) {
            return (
              <button
                key={`rest-${item.weekdayIndex}`}
                type="button"
                onClick={() => {
                  HapticService.selection();
                  window.dispatchEvent(new CustomEvent('show-toast', {
                    detail: `${item.fullWeekday}: Día de descanso y recuperación activa 💤`
                  }));
                }}
                style={{
                  flex: '1 1 0',
                  minWidth: 70,
                  padding: '7px 6px',
                  borderRadius: 10,
                  border: item.isToday
                    ? '1.5px solid var(--accent-orange, #ff9f0a)'
                    : '1px dashed var(--border-subtle, rgba(0, 0, 0, 0.14))',
                  background: item.isToday
                    ? 'color-mix(in srgb, var(--accent-orange, #ff9f0a) 12%, var(--bg-surface))'
                    : 'var(--bg-surface, rgba(0, 0, 0, 0.02))',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                  opacity: item.isToday ? 1 : 0.8,
                  transition: 'all 0.15s ease'
                }}
                title={`${item.fullWeekday}: ${item.title}`}
                aria-label={`${item.fullWeekday}: Descanso y recuperación`}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Moon size={11} color="var(--accent-orange, #ff9f0a)" />
                  <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--accent-orange, #ff9f0a)' }}>
                    {item.shortWeekday}
                  </span>
                </div>
                <span style={{ fontSize: '0.66rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                  Descanso
                </span>
              </button>
            );
          }

          const isActive = activeGymSectionId === item.sectionId;
          return (
            <button
              key={item.sectionId || `train-${item.weekdayIndex}`}
              type="button"
              onClick={() => {
                if (item.sectionId) {
                  HapticService.selection();
                  onSelectDay(item.sectionId);
                }
              }}
              style={{
                flex: '1 1 0',
                minWidth: 84,
                padding: '7px 6px',
                borderRadius: 10,
                border: isActive
                  ? '1.5px solid var(--accent-primary, #2997ff)'
                  : item.isToday
                  ? '1.5px solid color-mix(in srgb, var(--accent-primary, #2997ff) 45%, var(--border-subtle))'
                  : '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
                background: isActive
                  ? 'var(--accent-glow, rgba(41, 151, 255, 0.14))'
                  : 'var(--bg-surface, rgba(0, 0, 0, 0.02))',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                transition: 'all 0.15s ease'
              }}
              title={`${item.fullWeekday} · ${item.shortLabel}: ${item.title}`}
              aria-label={`${item.shortLabel} (${item.shortWeekday}): ${item.title}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {isActive && <Flame size={12} color="var(--accent-orange, #ff9500)" />}
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: isActive ? 'var(--accent-primary, #2997ff)' : 'var(--text-primary)'
                  }}
                >
                  {item.shortWeekday} · {item.shortLabel}
                </span>
              </div>
              {item.title && (
                <span
                  style={{
                    fontSize: '0.66rem',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 88
                  }}
                  title={item.title}
                >
                  {item.title}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
