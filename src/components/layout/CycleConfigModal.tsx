import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';

interface CycleConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (cycleId: string) => void;
}

export function CycleConfigModal({ isOpen, onClose, onSuccess }: CycleConfigModalProps) {
  const addCycle = useAppStore(state => state.addCycle);
  const [name, setName] = useState('');
  const [days, setDays] = useState<number | ''>('');

  if (!isOpen) return null;

  const handleSave = () => {
    if (!name.trim() || !days || days <= 0) return;
    
    const newCycleId = `cycle_${Date.now()}`;
    addCycle({
      id: newCycleId,
      name: name.trim(),
      daysValue: Number(days),
      isPinned: true,
      icon: 'star'
    });
    
    onSuccess(newCycleId);
    setName('');
    setDays('');
  };

  return (
    <AnimatePresence>
      <div className="prompt-overlay" onClick={onClose} style={{ zIndex: 1000 }}>
        <motion.div 
          className="prompt-modal"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={e => e.stopPropagation()}
        >
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>Nuevo Ciclo Temporal</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Nombre del ciclo</label>
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ej: Siguiente Trimestre"
                style={{ width: '100%', padding: '12px 16px', borderRadius: 10, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                autoFocus
              />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Repetición (Días)</label>
              <input 
                type="number" 
                value={days}
                onChange={e => setDays(e.target.value === '' ? '' : parseInt(e.target.value))}
                placeholder="Ej: 30"
                min="1"
                style={{ width: '100%', padding: '12px 16px', borderRadius: 10, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 8 }}>
                Esto determinará la frecuencia con la que las tareas de este ciclo se repiten en las "Opciones Avanzadas".
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
            <button 
              onClick={onClose}
              style={{ padding: '10px 16px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontWeight: 500, cursor: 'pointer' }}
            >
              Cancelar
            </button>
            <button 
              onClick={handleSave}
              disabled={!name.trim() || !days || days <= 0}
              style={{ padding: '10px 16px', background: 'var(--accent-primary)', border: 'none', borderRadius: 10, color: 'white', fontWeight: 600, cursor: (!name.trim() || !days || days <= 0) ? 'not-allowed' : 'pointer', opacity: (!name.trim() || !days || days <= 0) ? 0.5 : 1 }}
            >
              Crear Ciclo
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
