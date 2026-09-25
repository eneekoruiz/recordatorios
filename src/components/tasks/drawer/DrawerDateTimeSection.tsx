import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, ChevronDown, Clock, PlusCircle, X, Zap, CreditCard, Bell } from 'lucide-react';
import type { AlertDef } from '../../../models/Task';
import { isCaducidadesList, getListType, doesListSupportDuration } from '../../../utils/specialLists';
import { Sunrise, Sun, Moon } from 'lucide-react';
import { AppleTimerPicker } from '../../ui/AppleTimerPicker';

interface DrawerDateTimeSectionProps {
  cardTimeOpen: boolean;
  setCardTimeOpen: (open: boolean) => void;
  hasDate: boolean;
  setHasDate: (has: boolean) => void;
  dueDate: Date;
  setDueDate: (date: Date) => void;
  hasTime: boolean;
  setHasTime: (has: boolean) => void;
  alerts: AlertDef[];
  setAlerts: React.Dispatch<React.SetStateAction<AlertDef[]>>;
  timeOfDay?: 'morning' | 'afternoon' | 'night';
  setTimeOfDay: (timeOfDay?: 'morning' | 'afternoon' | 'night') => void;
  category: string;
  expirationType?: 'card' | 'subscription' | 'other';
  duration?: number | '';
  setDuration?: (duration: number | '') => void;
  removeAlert: (id: string) => void;
  addAnticipationAlert: (offsetMinutes: number, label: string) => void;
}

export const DrawerDateTimeSection: React.FC<DrawerDateTimeSectionProps> = ({
  cardTimeOpen,
  setCardTimeOpen,
  hasDate,
  setHasDate,
  dueDate,
  setDueDate,
  hasTime,
  setHasTime,
  alerts,
  setAlerts,
  timeOfDay,
  setTimeOfDay,
  category,
  expirationType,
  duration,
  setDuration,
  removeAlert,
  addAnticipationAlert
}) => {
  return (
    <div className="section-card">
      <button 
        type="button"
        className="section-card-header"
        onClick={() => setCardTimeOpen(!cardTimeOpen)}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarIcon size={16} color="var(--accent-red)" />
          Fecha y hora
        </span>
        <ChevronDown size={18} style={{ transform: cardTimeOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      <AnimatePresence>
        {cardTimeOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ height: { duration: 0.3, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.2 } }} style={{ overflow: 'hidden' }}>
            <div className="section-card-content">
              <div className="detail-row" style={{ padding: '8px 0' }}>
                <span className="detail-label">Fecha</span>
                <label className="switch">
                  <input type="checkbox" checked={hasDate} onChange={e => setHasDate(e.target.checked)} />
                  <span className="slider round"></span>
                </label>
              </div>
              {hasDate && (
                <div className="detail-row" style={{ padding: '4px 0', marginTop: -8 }}>
                  <input 
                    type="date" 
                    id="drawer-date-input"
                    className="detail-select drawer-date-input" 
                    value={dueDate.toISOString().split('T')[0]}
                    onChange={e => setDueDate(new Date(e.target.value))}
                    style={{ width: '100%', textAlign: 'right' }}
                  />
                </div>
              )}
              
              <div className="divider"></div>
              
              <div className="detail-row" style={{ padding: '8px 0' }}>
                <span className="detail-label">Hora</span>
                <label className="switch">
                  <input type="checkbox" checked={hasTime} onChange={e => {
                    setHasTime(e.target.checked);
                    if (e.target.checked && alerts.length === 0) setAlerts([{ id: `alert_${Date.now()}`, type: 'at_time', time: '09:00' }]);
                  }} />
                  <span className="slider round"></span>
                </label>
              </div>
              {hasTime && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 8 }}>
                  {alerts.map((alert, idx) => (
                    <div key={alert.id || idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input 
                        type="time" 
                        className="detail-select" 
                        value={alert.time || '09:00'}
                        onChange={e => {
                          const newAlerts = [...alerts];
                          newAlerts[idx] = { ...newAlerts[idx], time: e.target.value };
                          setAlerts(newAlerts);
                        }}
                        style={{ flex: 1 }}
                      />
                      <button className="icon-btn" onClick={() => removeAlert(alert.id)} style={{ background: 'var(--bg-surface)' }}>
                        <X size={16} color="var(--text-tertiary)" />
                      </button>
                    </div>
                  ))}
                  <button 
                    type="button"
                    className="add-alert-btn"
                    onClick={() => setAlerts([...alerts, { id: `alert_${Date.now()}`, type: 'at_time', time: '12:00' }])}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-primary)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px 0', fontSize: '0.9rem' }}
                  >
                    <PlusCircle size={16} /> Añadir hora
                  </button>
                </div>
              )}

              <div className="divider"></div>
              
              {/* Franja Horaria Diaria (Mañana, Tarde, Noche) */}
              <div className="detail-row" style={{ padding: '8px 0', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span className="detail-label" style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>Momento del día</span>
                  {timeOfDay && (
                    <button
                      type="button"
                      onClick={() => setTimeOfDay(undefined)}
                      style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '0.78rem', cursor: 'pointer', padding: 0 }}
                    >
                      Restablecer (Auto)
                    </button>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, width: '100%' }}>
                  {[
                    { id: 'morning', label: 'Mañana', Icon: Sunrise, color: 'var(--accent-orange)' },
                    { id: 'afternoon', label: 'Tarde', Icon: Sun, color: 'var(--accent-primary)' },
                    { id: 'night', label: 'Noche', Icon: Moon, color: 'var(--accent-purple)' }
                  ].map(item => {
                    const isSelected = timeOfDay === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setTimeOfDay(isSelected ? undefined : item.id as any)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          padding: '8px 4px',
                          borderRadius: 10,
                          fontSize: '0.82rem',
                          fontWeight: isSelected ? 600 : 450,
                          background: isSelected ? `color-mix(in srgb, ${item.color} 12%, transparent)` : 'transparent',
                          color: isSelected ? item.color : 'var(--text-secondary)',
                          border: `1px solid ${isSelected ? `color-mix(in srgb, ${item.color} 40%, transparent)` : 'var(--border-subtle)'}`,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <item.Icon size={15} strokeWidth={2.2} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Alertas Detectadas */}
              {alerts.length > 0 && (
                <>
                  <div className="divider"></div>
                  <div style={{ padding: '8px 0' }}>
                    <span className="detail-label" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Alertas configuradas</span>
                    <div className="chips-container" style={{ marginTop: 8 }}>
                      <AnimatePresence>
                        {alerts.map((alert) => (
                          <motion.div 
                            key={alert.id}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.5 }}
                            className="alert-chip"
                          >
                            <Clock size={14} />
                            <span>{alert.label || alert.time || `-${alert.offsetMinutes}m`}</span>
                            <button className="chip-remove" onClick={() => removeAlert(alert.id)}>
                              <X size={14} />
                            </button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                </>
              )}

              {/* Alertas preventivas inteligentes de caducidad */}
              {(category === 'caducidades' || isCaducidadesList(category) || expirationType || hasDate) && (
                <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--bg-card, rgba(0,0,0,0.03))', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                    <Zap size={13} strokeWidth={2.4} /> Alertas preventivas rápidas:
                  </span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => addAnticipationAlert(30 * 24 * 60, '1 mes antes')}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', fontSize: '0.76rem', borderRadius: 8, border: '1px solid rgba(255, 149, 0, 0.3)', background: 'rgba(255, 149, 0, 0.1)', color: '#ff9500', fontWeight: 600, cursor: 'pointer' }}
                    >
                      <CreditCard size={12} strokeWidth={2.4} /> + 1 mes antes
                    </button>
                    <button
                      type="button"
                      onClick={() => addAnticipationAlert(15 * 24 * 60, '15 días antes')}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', fontSize: '0.76rem', borderRadius: 8, border: '1px solid rgba(255, 149, 0, 0.3)', background: 'rgba(255, 149, 0, 0.1)', color: '#ff9500', fontWeight: 600, cursor: 'pointer' }}
                    >
                      <CreditCard size={12} strokeWidth={2.4} /> + 15 días antes
                    </button>
                    <button
                      type="button"
                      onClick={() => addAnticipationAlert(3 * 24 * 60, '3 días antes')}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', fontSize: '0.76rem', borderRadius: 8, border: '1px solid rgba(0, 122, 255, 0.3)', background: 'rgba(0, 122, 255, 0.1)', color: '#007aff', fontWeight: 600, cursor: 'pointer' }}
                    >
                      <Bell size={12} strokeWidth={2.4} /> + 3 días antes
                    </button>
                    <button
                      type="button"
                      onClick={() => addAnticipationAlert(1440, '1 día antes')}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', fontSize: '0.76rem', borderRadius: 8, border: '1px solid rgba(0, 122, 255, 0.3)', background: 'rgba(0, 122, 255, 0.1)', color: '#007aff', fontWeight: 600, cursor: 'pointer' }}
                    >
                      <Bell size={12} strokeWidth={2.4} /> + 1 día antes
                    </button>
                  </div>
                </div>
              )}

              <div className="divider" style={{ margin: '10px 0' }}></div>

              {/* Selector de Duración Nativo estilo Temporizador Apple */}
              <div id="drawer-duration-row" style={{ padding: '4px 0 2px' }}>
                <AppleTimerPicker
                  duration={duration}
                  onChange={(mins) => setDuration?.(mins)}
                  isRoutineCategory={doesListSupportDuration(getListType(undefined, category))}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
