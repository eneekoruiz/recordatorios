import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Check, Trash2 } from 'lucide-react';
import { useAppStore, isTaskCompleted } from '../../../store/useAppStore';
import { confirmDialog } from '../../ui/confirmDialog';
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
  const isCanonicalCore = (id: string) => ['cycle_day', 'cycle_week', 'cycle_month', 'cycle_year'].includes(id);
  const CORE_NAMES = new Set(['diario', 'diaria', 'semanal', 'mensual', 'anual']);
  const CORE_DAYS = new Set([1, 7, 30, 365]);

  const cyclesMap = new Map<string, CustomCycle>();
  CORE_CYCLES.forEach(c => cyclesMap.set(c.id, { ...c } as CustomCycle));

  const duplicateCycleIdsToDelete: string[] = [];

  (cycles || []).forEach(c => {
    if (!c || !c.id || c.deleted_at) return;

    if (isCanonicalCore(c.id)) {
      const existing = cyclesMap.get(c.id);
      cyclesMap.set(c.id, { ...existing, ...c, color: getCycleColor(c), isPinned: c.isPinned ?? true });
      return;
    }

    const norm = (c.name || '').trim().toLowerCase();
    const days = Number(c.daysValue);

    // Si es un duplicado de las 4 frecuencias principales que no tiene el ID canónico, descartar y eliminar
    if (CORE_NAMES.has(norm) || CORE_DAYS.has(days)) {
      duplicateCycleIdsToDelete.push(c.id);
      return;
    }

    cyclesMap.set(c.id, { ...c, isPinned: c.isPinned ?? true });
  });

  const allCycles = Array.from(cyclesMap.values()).sort((a, b) => (a.daysValue || 0) - (b.daysValue || 0));
  const listSections = useAppStore(state => state.listSections);
  const lists = useAppStore(state => state.lists);
  const deleteCycle = useAppStore(state => state.deleteCycle);

  const duplicateCycleIdsKey = duplicateCycleIdsToDelete.join(',');

  React.useEffect(() => {
    if (!duplicateCycleIdsKey) return;
    const ids = duplicateCycleIdsKey.split(',');
    useAppStore.setState(state => {
      const nextCycles = state.cycles.filter(c => !ids.includes(c.id));
      const updatedTasks = { ...state.tasks };
      let tasksChanged = false;
      Object.entries(updatedTasks).forEach(([taskId, task]) => {
        if (task.cycle_id && ids.includes(task.cycle_id)) {
          const oldCycle = state.cycles.find(c => c.id === task.cycle_id);
          const norm = (oldCycle?.name || '').trim().toLowerCase();
          const days = Number(oldCycle?.daysValue);
          let canonical = 'cycle_day';
          if (norm === 'semanal' || days === 7) canonical = 'cycle_week';
          else if (norm === 'mensual' || days === 30) canonical = 'cycle_month';
          else if (norm === 'anual' || days === 365) canonical = 'cycle_year';

          updatedTasks[taskId] = { ...task, cycle_id: canonical, _is_dirty: true };
          tasksChanged = true;
        }
      });
      return {
        cycles: nextCycles,
        tasks: tasksChanged ? updatedTasks : state.tasks
      };
    });
  }, [duplicateCycleIdsKey]);

  const isCycleVisible = (c: CustomCycle) => {
    if (cycleVisibility[c.id] === false) return false;
    if (['cycle_day', 'cycle_week', 'cycle_month', 'cycle_year'].includes(c.id)) return true;
    return c.isPinned !== false;
  };

  const visibleCycles = allCycles.filter(c => isCycleVisible(c) || isEditCyclesMode);

  return (
    <div style={{ marginTop: 'var(--space-16)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 0 8px 0' }}>
        <span style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Frecuencia</span>
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
            className={isEditCyclesMode ? "btn-icon" : undefined}
            onClick={() => setIsEditCyclesMode(!isEditCyclesMode)}
            aria-label={isEditCyclesMode ? 'Hecho' : 'Editar frecuencias'}
            title={isEditCyclesMode ? 'Hecho' : 'Editar frecuencias'}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--accent-primary)', 
              fontSize: '0.94rem', 
              fontWeight: isEditCyclesMode ? 600 : 400, 
              cursor: 'pointer', 
              padding: isEditCyclesMode ? 4 : '6px 2px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {isEditCyclesMode ? <Check size={16} strokeWidth={2.8} /> : 'Editar'}
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
                style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0, minWidth: 0, cursor: isEditCyclesMode ? 'default' : 'pointer' }} 
                onClick={() => {
                  if (!isEditCyclesMode) {
                    onSelectView(cycle.id);
                  } else {
                    toggleCycleVisibility(cycle.id);
                  }
                }}
              >
                <div className="list-icon" style={{ backgroundColor: cycleColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={16} color="white" strokeWidth={2.2} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                  <span className="title" style={{ fontSize: '1.05rem', color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)', fontWeight: isActive ? 600 : 500 }}>{cycle.name}</span>
                </div>
                {!isEditCyclesMode && <span className="count">{taskCount}</span>}
              </div>
              {isEditCyclesMode && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleCycleVisibility(cycle.id); }}
                    title={isVisible ? 'Desactivar frecuencia' : 'Activar frecuencia'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: isVisible ? 'var(--accent-primary)' : 'var(--text-tertiary)', padding: 4 }}
                  >
                    {isVisible ? <Check size={14} /> : <Plus size={14} />}
                  </button>
                  {!['cycle_day', 'cycle_week', 'cycle_month', 'cycle_year'].includes(cycle.id) && (
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const ok = await confirmDialog({
                          title: 'Eliminar Frecuencia',
                          message: `¿Estás seguro de eliminar la frecuencia "${cycle.name}"? Esta acción no se puede deshacer.`,
                          confirmText: 'Eliminar',
                          tone: 'danger',
                        });
                        if (ok) {
                          deleteCycle(cycle.id);
                          if (currentView === cycle.id) {
                            onSelectView('smart_today');
                          }
                          window.dispatchEvent(
                            new CustomEvent('show-toast', {
                              detail: `Frecuencia "${cycle.name}" eliminada`,
                            })
                          );
                        }
                      }}
                      title="Eliminar frecuencia personalizada"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--accent-danger, #ff3b30)',
                        padding: 4,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
