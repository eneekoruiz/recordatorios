import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Repeat } from 'lucide-react';
import { SectionTrailing } from './SectionTrailing';
import { CustomSelect } from '../../ui/CustomSelect';
import type { CustomCycle, ListSection } from '../../../models/Task';
import { formatSectionTitle } from '../../../utils/sectionRoutine';

interface DrawerRecurrenceSectionProps {
  cardRepeatOpen: boolean;
  setCardRepeatOpen: (open: boolean) => void;
  cycleId?: string;
  setCycleId: (cycleId?: string) => void;
  cycles: CustomCycle[];
  sectionId?: string;
  setSectionId: (sectionId?: string) => void;
  category: string;
  listSections: ListSection[];
  showInlineInput: boolean;
  setShowInlineInput: (show: boolean) => void;
  inlineInputValue: string;
  setInlineInputValue: (val: string) => void;
  onAddListSection: (name: string) => void;
  children?: React.ReactNode;
}

export const DrawerRecurrenceSection: React.FC<DrawerRecurrenceSectionProps> = ({
  cardRepeatOpen,
  setCardRepeatOpen,
  cycleId,
  setCycleId,
  cycles,
  sectionId,
  setSectionId,
  category,
  listSections,
  showInlineInput,
  setShowInlineInput,
  inlineInputValue,
  setInlineInputValue,
  onAddListSection,
  children
}) => {
  return (
    <div id="drawer-recurrence-card" className="section-card">
      <button 
        type="button"
        className="section-card-header"
        onClick={() => setCardRepeatOpen(!cardRepeatOpen)}
        aria-expanded={cardRepeatOpen}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Repeat size={16} color="var(--accent-green)" />
          Repetición y ubicación
        </span>
        <SectionTrailing open={cardRepeatOpen} summary={cycleId ? (cycles.find((c) => c.id === cycleId)?.name ?? '') : ''} />
      </button>
      <AnimatePresence>
        {cardRepeatOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ height: { duration: 0.3, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.2 } }} style={{ overflow: 'hidden' }}>
            <div className="section-card-content">
              <div id="drawer-recurrence-row" className="detail-row" style={{ padding: '8px 0' }}>
                <span className="detail-label">Repetir (Ciclo)</span>
                <CustomSelect
                  id="drawer-recurrence-select"
                  className="detail-select"
                  value={cycleId || ''}
                  onChange={val => setCycleId(val || undefined)}
                  options={[
                    { value: '', label: 'Nunca' },
                    ...cycles.map(c => ({ value: c.id, label: c.name }))
                  ]}
                />
              </div>
              
              <div className="divider"></div>
              
              <div className="detail-row" style={{ padding: '8px 0' }}>
                <span className="detail-label">Sección de Lista</span>
                <CustomSelect 
                  className="detail-select"
                  value={sectionId || ''}
                  onChange={val => {
                    if (val === 'new') {
                      setShowInlineInput(true);
                      setInlineInputValue('');
                    } else {
                      setSectionId(val || undefined);
                    }
                  }}
                  options={[
                    { value: '', label: 'Sin sección' },
                    { value: 'new', label: '+ Crear nueva sección...' },
                    ...listSections
                      .filter(s => s.listId === category && !s.deleted_at)
                      .map(s => ({ value: s.id, label: formatSectionTitle(s.name) }))
                  ]}
                />
                
                {showInlineInput && (
                  <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-subtle)', display: 'flex', gap: '8px', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>Nueva sección</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        autoFocus
                        value={inlineInputValue} 
                        onChange={e => setInlineInputValue(e.target.value)} 
                        placeholder="Nombre de sección" 
                        style={{ flex: 1, padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', fontSize: '0.9rem' }}
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          if (inlineInputValue.trim()) {
                            onAddListSection(inlineInputValue.trim());
                            setShowInlineInput(false);
                          }
                        }}
                        style={{ background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Guardar
                      </button>
                      <button 
                        type="button"
                        onClick={() => setShowInlineInput(false)}
                        style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', padding: '6px 8px', cursor: 'pointer' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
