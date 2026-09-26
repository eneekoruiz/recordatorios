import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, X } from 'lucide-react';
import { SectionTrailing } from './SectionTrailing';
import { CustomSelect } from '../../ui/CustomSelect';
import type { TaskItem } from '../../../models/Task';

interface DrawerRequirementsSectionProps {
  cardReqOpen: boolean;
  setCardReqOpen: (open: boolean) => void;
  blockedBy: string[];
  setBlockedBy: (blockedBy: string[]) => void;
  availableTasks: TaskItem[];
}

export const DrawerRequirementsSection: React.FC<DrawerRequirementsSectionProps> = ({
  cardReqOpen,
  setCardReqOpen,
  blockedBy,
  setBlockedBy,
  availableTasks
}) => {
  return (
    <div className="section-card">
      <button 
        type="button"
        className="section-card-header"
        onClick={() => setCardReqOpen(!cardReqOpen)}
        aria-expanded={cardReqOpen}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link2 size={16} color="var(--accent-orange)" />
          Requisitos y dependencias
        </span>
        <SectionTrailing open={cardReqOpen} summary={blockedBy.length === 0 ? '' : blockedBy.length === 1 ? '1 requisito' : `${blockedBy.length} requisitos`} />
      </button>
      <AnimatePresence>
        {cardReqOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ height: { duration: 0.3, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.2 } }} style={{ overflow: 'hidden' }}>
            <div className="section-card-content">
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 8px 0', lineHeight: 1.3 }}>
                Esta tarea estará bloqueada y no se podrá marcar como completada hasta que se finalicen primero los requisitos seleccionados abajo:
              </p>
              
              {blockedBy.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  {blockedBy.map(tId => {
                    const bTask = availableTasks.find(t => t.id === tId);
                    if (!bTask) return null;
                    return (
                      <div key={tId} style={{ 
                        display: 'flex', alignItems: 'center', gap: 4, 
                        background: 'var(--bg-surface)', padding: '4px 10px', 
                        borderRadius: 16, fontSize: '0.85rem', border: '1px solid var(--border-subtle)'
                      }}>
                        <span>{bTask.title}</span>
                        <button 
                          type="button"
                          className="chip-remove" 
                          onClick={() => setBlockedBy(blockedBy.filter(id => id !== tId))} 
                          style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 2 }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <CustomSelect 
                className="detail-select"
                value=""
                onChange={val => {
                  if (val && !blockedBy.includes(val)) {
                    setBlockedBy([...blockedBy, val]);
                  }
                }}
                placeholder="+ Añadir tarea bloqueadora (requisito)..."
                options={[
                  { value: '', label: '+ Añadir tarea bloqueadora (requisito)...' },
                  ...availableTasks.filter(t => !blockedBy.includes(t.id)).map(t => ({ value: t.id, label: t.title }))
                ]}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
