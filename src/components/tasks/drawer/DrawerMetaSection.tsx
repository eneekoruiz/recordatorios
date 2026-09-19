import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings2, ChevronDown } from 'lucide-react';
import { CustomSelect } from '../../ui/CustomSelect';

interface DrawerMetaSectionProps {
  cardDetailsOpen: boolean;
  setCardDetailsOpen: (open: boolean) => void;
  priority: 'none' | 'low' | 'medium' | 'high';
  setPriority: (priority: 'none' | 'low' | 'medium' | 'high') => void;
  flagged: boolean;
  setFlagged: (flagged: boolean) => void;
  url: string;
  setUrl: (url: string) => void;
  image: string;
  setImage: (image: string) => void;
  targetCount?: number;
  setTargetCount: (count?: number) => void;
}

export const DrawerMetaSection: React.FC<DrawerMetaSectionProps> = ({
  cardDetailsOpen,
  setCardDetailsOpen,
  priority,
  setPriority,
  flagged,
  setFlagged,
  url,
  setUrl,
  image,
  setImage,
  targetCount,
  setTargetCount
}) => {
  return (
    <div className="section-card">
      <button 
        type="button"
        className="section-card-header"
        onClick={() => setCardDetailsOpen(!cardDetailsOpen)}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Settings2 size={16} color="var(--text-secondary)" />
          Detalles Adicionales
        </span>
        <ChevronDown size={18} style={{ transform: cardDetailsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      <AnimatePresence>
        {cardDetailsOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ height: { duration: 0.3, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.2 } }} style={{ overflow: 'hidden' }}>
            <div className="section-card-content">
              <div className="detail-row" style={{ padding: '8px 0' }}>
                <span className="detail-label">Prioridad</span>
                <CustomSelect 
                  className="detail-select"
                  value={priority}
                  onChange={val => setPriority(val as any)}
                  options={[
                    { value: 'none', label: 'Ninguna' },
                    { value: 'low', label: 'Baja' },
                    { value: 'medium', label: 'Media' },
                    { value: 'high', label: 'Alta' }
                  ]}
                />
              </div>

              <div className="divider"></div>

              <div className="detail-row" style={{ padding: '8px 0' }}>
                <span className="detail-label">Destacado</span>
                <label className="switch">
                  <input type="checkbox" checked={flagged} onChange={e => setFlagged(e.target.checked)} />
                  <span className="slider round"></span>
                </label>
              </div>

              <div className="divider"></div>

              <div className="detail-row" style={{ padding: '8px 0' }}>
                <span className="detail-label">URL del enlace</span>
                <input 
                  type="url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  style={{ width: '60%', textAlign: 'right', border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-secondary)' }}
                />
              </div>

              <div className="divider"></div>

              <div className="detail-row" style={{ padding: '8px 0' }}>
                <span className="detail-label">Adjuntar Imagen</span>
                <label className="switch">
                  <input type="checkbox" checked={!!image} onChange={e => setImage(e.target.checked ? 'https://picsum.photos/200/300' : '')} />
                  <span className="slider round"></span>
                </label>
              </div>
              {!!image && (
                <div className="detail-row" style={{ padding: '4px 0', marginTop: -8 }}>
                  <input 
                    type="text" 
                    className="detail-select" 
                    placeholder="URL de imagen..."
                    value={image === 'https://picsum.photos/200/300' ? '' : image}
                    onChange={e => setImage(e.target.value)}
                    style={{ width: '100%', textAlign: 'right', borderBottom: '1px solid var(--border-subtle)' }}
                  />
                </div>
              )}

              <div className="divider"></div>

              <div className="detail-row" style={{ padding: '8px 0' }}>
                <span className="detail-label">Repeticiones diarias (Hábito)</span>
                <input 
                  type="number" 
                  min="1"
                  max="100"
                  placeholder="Ej: 10 (veces)" 
                  value={targetCount || ''} 
                  onChange={e => setTargetCount(e.target.value ? parseInt(e.target.value) : undefined)}
                  style={{ width: 90, textAlign: 'right', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-primary)' }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
