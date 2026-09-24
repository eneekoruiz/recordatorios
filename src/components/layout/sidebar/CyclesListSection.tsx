import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Check } from 'lucide-react';
import { useAppStore, isTaskCompleted } from '../../../store/useAppStore';
import { isCompletedInCurrentPeriod } from '../../../services/TaskService';
import { getCycleIcon } from '../../../constants/icons';
import { getEffectiveCycleId } from '../../../utils/sectionRoutine';
import type { CustomCycle, TaskItem } from '../../../models/Task';

interface CyclesListSectionProps {
  globalCyclesEnabled?: boolean;
  cycles: CustomCycle[];
  cycleVisibility: Record<string, boolean>;
  isEditCyclesMode: boolean;
  setIsEditCyclesMode: (val: boolean) => void;
  currentView: string;
  onSelectView: (view: string) => void;
  toggleCycleVisibility: (id: string) => void;
  setIsCycleModalOpen: (open: boolean) => void;
  tasks: Record<string, TaskItem>;
}

import { FREQUENCY_RESERVED_COLORS } from '../../../constants/colors';

const CORE_CYCLES: { id: string; name: string; daysValue: number; isPinned: boolean; icon: string; color: string }[] = [
  { id: 'cycle_day', name: 'Diario', daysValue: 1, isPinned: true, icon: 'sun', color: FREQUENCY_RESERVED_COLORS.day },
  { id: 'cycle_week', name: 'Semanal', daysValue: 7, isPinned: true, icon: 'calendar', color: FREQUENCY_RESERVED_COLORS.week },
  { id: 'cycle_month', name: 'Mensual', daysValue: 30, isPinned: true, icon: 'moon', color: FREQUENCY_RESERVED_COLORS.month },
  { id: 'cycle_year', name: 'Anual', daysValue: 365, isPinned: true, icon: 'globe', color: FREQUENCY_RESERVED_COLORS.year },
];

const getCycleColor = (cycle: CustomCycle): string => {
  if (cycle.id === 'cycle_day') return FREQUENCY_RESERVED_COLORS.day;
  if (cycle.id === 'cycle_week') return FREQUENCY_RESERVED_COLORS.week;
  if (cycle.id === 'cycle_month') return FREQUENCY_RESERVED_COLORS.month;
  if (cycle.id === 'cycle_year') return FREQUENCY_RESERVED_COLORS.year;
  return (cycle as any).color || FREQUENCY_RESERVED_COLORS.day;
};

export const CyclesListSection: React.FC<CyclesListSectionProps> = ({
  cycles,
  cycleVisibility,
  isEditCyclesMode,
  setIsEditCyclesMode,
  currentView,
  onSelectView,
  toggleCycleVisibility,
  setIsCycleModalOpen,
  tasks
}) => {
  // Merge core cycles with user cycles, ensuring Diario, Semanal, Mensual, and Anual are always available
  const cyclesMap = new Map<string, CustomCycle>();
  CORE_CYCLES.forEach(c => cyclesMap.set(c.id, { ...c } as CustomCycle));
  (cycles || []).forEach(c => {
    if (c && c.id) {
      const existing = cyclesMap.get(c.id);
      cyclesMap.set(c.id, { ...existing, ...c, isPinned: c.isPinned ?? true });
    }
  });
  const allCycles = Array.from(cyclesMap.values()).sort((a, b) => (a.daysValue || 0) - (b.daysValue || 0));
  const listSections = useAppStore(state => state.listSections);
  const lists = useAppStore(state => state.lists);

  const isCycleVisible = (c: CustomCycle) => {
    if (cycleVisibility[c.id] === false) return false;
    if (['cycle_day', 'cycle_week', 'cycle_month', 'cycle_year'].includes(c.id)) return true;
    return c.isPinned !== false;
  };

  const visibleCycles = allCycles.filter(c => isCycleVisible(c) || isEditCyclesMode);

  return (
    <div style={{ marginTop: 'var(--space-16)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 12px 8px 16px' }}>
        <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Frecuencia</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {isEditCyclesMode && (() => {
            const allVisible = allCycles.every(c => cycleVisibility[c.id] !== false);
            return (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  const nextVisibility: Record<string, boolean> = {};
                  allCycles.forEach(c => {
                    nextVisibility[c.id] = !allVisible;
                  });
                  useAppStore.setState({ cycleVisibility: nextVisibility });
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                title={allVisible ? "Ocultar todas las frecuencias" : "Mostrar todas las frecuencias"}
              >
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Todas</span>
                <div style={{
                  width: '32px', height: '18px', borderRadius: '9px',
                  background: allVisible ? 'var(--accent-primary)' : 'rgba(120,120,128,0.3)',
                  position: 'relative', transition: 'background-color 0.2s ease', flexShrink: 0
                }}>
                  <div style={{
                    width: '14px', height: '14px', borderRadius: '50%', background: '#ffffff',
                    position: 'absolute', top: '2px', left: allVisible ? '16px' : '2px',
                    transition: 'left 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                  }} />
                </div>
              </div>
            );
          })()}
          <button 
            type="button"
            onClick={() => setIsEditCyclesMode(!isEditCyclesMode)}
            style={{ background: 'transparent', border: 'none', color: isEditCyclesMode ? 'var(--accent-primary)' : 'var(--text-tertiary)', fontSize: '0.85rem', cursor: 'pointer' }}
          >
            {isEditCyclesMode ? 'Hecho' : 'Editar'}
          </button>
          <button 
            type="button"
            className="btn-icon"
            style={{ padding: 4, cursor: 'pointer' }}
            title="Nueva Frecuencia"
            onClick={(e) => { e.stopPropagation(); setIsCycleModalOpen(true); }}
          >
            <Plus size={16} color="var(--accent-primary)" />
          </button>
        </div>
      </div>

      {visibleCycles.length === 0 && (
        <div style={{ padding: '8px 16px', color: 'var(--text-tertiary)', fontSize: '0.82rem', fontStyle: 'italic' }}>
          No hay frecuencias visibles. Edita para activarlas.
        </div>
      )}

      <div className="ios-list-block">
        {visibleCycles.map(cycle => {
          const isVisible = cycleVisibility[cycle.id] !== false;
          const Icon = getCycleIcon(cycle.icon);
          const isActive = currentView === cycle.id;
          const cycleColor = getCycleColor(cycle);

          const taskCount = Object.values(tasks || {}).filter(t => {
            if (t.deleted_at || isTaskCompleted(t) || t.categoryId === 'primeros_pasos') return false;
            const effCycle = getEffectiveCycleId(t, listSections, lists);
            return effCycle === cycle.id && !isCompletedInCurrentPeriod(t as any, allCycles as any, listSections, lists);
          }).length;
          
          if (!isVisible && !isEditCyclesMode) return null;
          
          return (
            <motion.div 
              key={cycle.id}
              className={`ios-list-item ${isActive ? 'active' : ''}`}
              style={{ position: 'relative', opacity: isEditCyclesMode && !isVisible ? 0.5 : 1, transition: 'background-color 150ms ease' }}
            >
              <div 
                style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, cursor: isEditCyclesMode ? 'default' : 'pointer' }} 
                onClick={() => {
                  if (!isEditCyclesMode) {
                    onSelectView(cycle.id);
                  } else {
                    toggleCycleVisibility(cycle.id);
                  }
                }}
              >
                <div className="list-icon" style={{ backgroundColor: cycleColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={15} color="white" strokeWidth={2.4} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                  <span className="title" style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)', fontWeight: isActive ? 600 : 500 }}>{cycle.name}</span>
                </div>
                {!isEditCyclesMode && <span className="count">{taskCount}</span>}
              </div>
              {isEditCyclesMode && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleCycleVisibility(cycle.id); }}
                  title={isVisible ? 'Desactivar frecuencia' : 'Activar frecuencia'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: isVisible ? 'var(--accent-primary)' : 'var(--text-tertiary)', padding: 4, marginLeft: 4 }}
                >
                  {isVisible ? <Check size={14} /> : <Plus size={14} />}
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
