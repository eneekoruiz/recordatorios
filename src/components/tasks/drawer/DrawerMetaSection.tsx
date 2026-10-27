import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings2, Timer } from 'lucide-react';
import { SectionTrailing } from './SectionTrailing';
import { CustomSelect } from '../../ui/CustomSelect';
import type { TaskWeightLog } from '../../../models/Task';

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
  restDuration?: number;
  setRestDuration?: (seconds?: number) => void;
  weightLogs?: TaskWeightLog[];
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
  setTargetCount,
  restDuration,
  setRestDuration,
  weightLogs
}) => {
  const hasSeries = Boolean(targetCount && targetCount > 1);

  return (
    <div className="section-card">
      <button
        type="button"
        className="section-card-header"
        onClick={() => setCardDetailsOpen(!cardDetailsOpen)}
      >
        <span className="section-card-title">
          <Settings2 size={16} /> Metadatos y Series
        </span>
        <SectionTrailing open={cardDetailsOpen} />
      </button>

      <AnimatePresence>
        {cardDetailsOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="section-card-content" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="detail-row">
                <span className="detail-label">Prioridad</span>
                <CustomSelect
                  value={priority}
                  onChange={(val) => setPriority(val as any)}
                  options={[
                    { value: 'none', label: 'Ninguna' },
                    { value: 'low', label: 'Baja (!)' },
                    { value: 'medium', label: 'Media (!!)' },
                    { value: 'high', label: 'Alta (!!!)' }
                  ]}
                  aria-label="Prioridad"
                />
              </div>

              <div className="detail-row">
                <span className="detail-label">Destacado (Flag)</span>
                <button
                  type="button"
                  onClick={() => setFlagged(!flagged)}
                  className={`chip ${flagged ? 'active' : ''}`}
                  style={{
                    borderRadius: 999,
                    padding: '6px 14px',
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    border: flagged ? 'none' : '1px solid var(--border-subtle)',
                    background: flagged ? 'var(--accent-orange, #ff9500)' : 'transparent',
                    color: flagged ? '#ffffff' : 'var(--text-secondary)'
                  }}
                >
                  {flagged ? 'Marcado' : 'Sin marcar'}
                </button>
              </div>

              <div className="detail-row">
                <span className="detail-label">URL Enlace</span>
                <input
                  type="url"
                  placeholder="https://..."
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  style={{ flex: 1, minWidth: 0, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 10px', color: 'var(--text-primary)' }}
                />
              </div>

              <div className="detail-row">
                <span className="detail-label">URL Imagen</span>
                <input
                  type="url"
                  placeholder="https://..."
                  value={image}
                  onChange={e => setImage(e.target.value)}
                  style={{ flex: 1, minWidth: 0, background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 10px', color: 'var(--text-primary)' }}
                />
              </div>

              {image && (
                <div style={{ marginTop: 4, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-subtle)', maxHeight: 120, display: 'flex', justifyContent: 'center', background: 'var(--bg-surface)' }}>
                  <img
                    src={image}
                    alt="Preview"
                    style={{ maxHeight: 120, width: '100%', objectFit: 'cover' }}
                    onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                  />
                </div>
              )}

              <div className="divider"></div>

              {/* Repeticiones / Series del ejercicio */}
              <div className="detail-row" style={{ padding: '4px 0' }}>
                <div>
                  <span className="detail-label" style={{ display: 'block' }}>Repeticiones / Series</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    Para gimnasio (número de series) o hábitos diarios
                  </span>
                </div>
                <input
                  type="number"
                  min="1"
                  max="100"
                  placeholder="Ej: 3 ó 4"
                  value={targetCount || ''}
                  onChange={e => setTargetCount(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                  style={{ width: 85, textAlign: 'right', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '6px 8px', color: 'var(--text-primary)', fontWeight: 600 }}
                  aria-label="Repeticiones o series"
                />
              </div>

              {/* Descanso entre series si tiene series configuradas */}
              {hasSeries && setRestDuration && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    background: 'var(--bg-surface, rgba(0,0,0,0.03))',
                    borderRadius: 12,
                    padding: '10px 12px',
                    border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Timer size={14} color="var(--accent-primary, #0a84ff)" /> Descanso entre series
                    </span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-primary, #0a84ff)' }}>
                      {restDuration ? `${Math.floor(restDuration / 60)}m ${restDuration % 60 ? (restDuration % 60) + 's' : ''}`.trim() : '90s (defecto)'}
                    </span>
                  </div>

                  {/* Chips rápidos de descanso */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {[
                      { label: '60s', sec: 60 },
                      { label: '90s', sec: 90 },
                      { label: '2 min', sec: 120 },
                      { label: '2.5 min', sec: 150 },
                      { label: '3 min', sec: 180 },
                      { label: '3.5 min', sec: 210 },
                      { label: '4 min', sec: 240 }
                    ].map(preset => {
                      const isSelected = restDuration === preset.sec || (!restDuration && preset.sec === 90);
                      return (
                        <button
                          key={preset.sec}
                          type="button"
                          onClick={() => setRestDuration(preset.sec)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 8,
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            background: isSelected ? 'var(--accent-primary, #0a84ff)' : 'transparent',
                            color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                            border: isSelected ? 'none' : '1px solid var(--border-subtle)'
                          }}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Historial de pesos / cargas registradas */}
                  {weightLogs && weightLogs.length > 0 && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: '10px 12px',
                        background: 'var(--bg-elevated, #ffffff)',
                        borderRadius: 10,
                        border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))'
                      }}
                    >
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                        🏋️ Historial de cargas registradas
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {weightLogs.slice(-6).map((log, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                            <span>Serie {log.set}</span>
                            <span style={{ fontWeight: 600, color: 'var(--accent-primary, #0a84ff)' }}>
                              {log.weightKg} kg {log.reps ? `× ${log.reps} reps` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
