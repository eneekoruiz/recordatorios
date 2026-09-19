import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Check } from 'lucide-react';
import { useAppStore, isTaskCompleted } from '../../../store/useAppStore';
import { isCompletedInCurrentPeriod } from '../../../services/TaskService';
import { getCycleIcon } from '../../../constants/icons';
import type { CustomCycle, TaskItem } from '../../../models/Task';

interface CyclesListSectionProps {
  globalCyclesEnabled: boolean;
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

export const CyclesListSection: React.FC<CyclesListSectionProps> = ({
  globalCyclesEnabled,
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
  if (!globalCyclesEnabled) return null;

  return (
    <div style={{ marginTop: 'var(--space-16)' }}>
      <div className="section-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>Ciclos temporales</span>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {isEditCyclesMode && (() => {
            const allVisible = cycles.every(c => cycleVisibility[c.id]);
            return (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  const nextVisibility: Record<string, boolean> = {};
                  cycles.forEach(c => {
                    nextVisibility[c.id] = !allVisible;
                  });
                  useAppStore.setState({ cycleVisibility: nextVisibility });
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                title={allVisible ? "Ocultar todos los ciclos" : "Mostrar todos los ciclos"}
              >
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Todos</span>
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
            title="Nuevo Ciclo"
            onClick={(e) => { e.stopPropagation(); setIsCycleModalOpen(true); }}
          >
            <Plus size={14} color="var(--text-tertiary)" />
          </button>
        </div>
      </div>

      {cycles.filter(c => c.isPinned && (cycleVisibility[c.id] || isEditCyclesMode)).length === 0 && (
        <div style={{ padding: '8px 12px', color: 'var(--text-tertiary)', fontSize: '0.82rem', fontStyle: 'italic' }}>
          No hay ciclos visibles. Edita para activarlos.
        </div>
      )}

      <div className="ios-list-block">
        {Array.from(new Map((cycles || []).map((c: any) => [c.id, c])).values()).filter(c => c.isPinned).map(cycle => {
          const isVisible = !!cycleVisibility[cycle.id];
          const Icon = getCycleIcon(cycle.icon);
          const isActive = currentView === cycle.id;
          const taskCount = Object.values(tasks || {}).filter(t => {
            if (t.deleted_at || isTaskCompleted(t) || t.categoryId === 'primeros_pasos') return false;
            const effCycle = t.cycle_id || (t.categoryId === 'limpieza_diaria' ? 'cycle_day' : t.categoryId === 'limpieza_semanal' ? 'cycle_week' : t.categoryId === 'limpieza_mensual' ? 'cycle_month' : t.categoryId === 'limpieza_anual' ? 'cycle_year' : null);
            return effCycle === cycle.id && !isCompletedInCurrentPeriod(t as any, cycles as any);
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
                <div className="list-icon" style={{ backgroundColor: '#8e8e93', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={12} color="white" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                  <span className="title" style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)' }}>{cycle.name}</span>
                </div>
                {!isEditCyclesMode && <span className="count">{taskCount}</span>}
              </div>
              {isEditCyclesMode && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleCycleVisibility(cycle.id); }}
                  title={isVisible ? 'Desactivar ciclo' : 'Activar ciclo'}
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
