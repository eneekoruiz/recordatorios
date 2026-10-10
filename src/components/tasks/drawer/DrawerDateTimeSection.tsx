import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, Clock, PlusCircle, X, Zap, CreditCard, Bell, Sparkles, Minus, Plus } from 'lucide-react';
import { SectionTrailing } from './SectionTrailing';
import { formatRelativeDay, formatTime } from '../../../utils/format';
import type { AlertDef, TaskItem } from '../../../models/Task';
import { isCaducidadesList, getListType, doesListSupportDuration } from '../../../utils/specialLists';
import { formatDuration } from '../../../utils/taskDuration';
import { Sunrise, Sun, Moon } from 'lucide-react';
import { AppleTimerPicker } from '../../ui/AppleTimerPicker';
import { useAppStore } from '../../../store/useAppStore';

interface DrawerDateTimeSectionProps {
  task?: TaskItem;
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
  disableDuration?: boolean;
  setDisableDuration?: (disabled: boolean) => void;
  isParallel?: boolean;
  setIsParallel?: (parallel: boolean) => void;
  parallelDuration?: number;
  setParallelDuration?: (mins: number) => void;
  removeAlert: (id: string) => void;
  addAnticipationAlert: (offsetMinutes: number, label: string) => void;
}

export const DrawerDateTimeSection: React.FC<DrawerDateTimeSectionProps> = ({
  task,
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
  disableDuration = false,
  setDisableDuration,
  isParallel,
  setIsParallel,
  parallelDuration,
  setParallelDuration,
  removeAlert,
  addAnticipationAlert
}) => {
  const list = useAppStore((state) => state.lists.find((l) => l.id === category));
  const isRoutineList = doesListSupportDuration(getListType(list, category));

  return (
    <div className="section-card">
      <button 
        type="button"
        className="section-card-header"
        onClick={() => setCardTimeOpen(!cardTimeOpen)}
        aria-expanded={cardTimeOpen}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarIcon size={16} color="var(--accent-red)" />
          Fecha y hora
        </span>
        <SectionTrailing open={cardTimeOpen} summary={hasDate ? `${formatRelativeDay(dueDate)}${hasTime ? `, ${formatTime(dueDate)}` : ''}` : timeOfDay ? ({ morning: 'Por la mañana', afternoon: 'Por la tarde', night: 'Por la noche' } as const)[timeOfDay] : ''} />
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
                          transition: 'background-color, border-color, color, fill, opacity, transform, box-shadow 0.15s ease'
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
                            <span>{alert.label || alert.time || `${formatDuration(alert.offsetMinutes || 0)} antes`}</span>
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
                {/* Cabecera con switch para activar/desactivar duración explícitamente */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  marginBottom: 10,
                  padding: '4px 2px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: disableDuration ? 'var(--bg-material, rgba(0,0,0,0.04))' : 'rgba(0, 122, 255, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Clock size={17} strokeWidth={2.4} color={disableDuration ? 'var(--text-tertiary)' : 'var(--accent-primary, #007aff)'} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.86rem', fontWeight: 650, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                        Duración
                      </div>
                      <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', lineHeight: 1.25, marginTop: 2 }}>
                        {disableDuration ? 'Desactivada para esta tarea' : (isParallel ? 'Dedicación activa y espera en paralelo' : 'Tiempo estimado o asignado')}
                      </div>
                    </div>
                  </div>
                  <label className="switch switch--blue" style={{ flexShrink: 0 }}>
                    <input
                      type="checkbox"
                      checked={!disableDuration}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        setDisableDuration?.(!enabled);
                        if (!enabled) {
                          setDuration?.(0);
                        } else {
                          setDuration?.(typeof duration === 'number' && duration > 0 ? duration : 15);
                        }
                      }}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>

                {disableDuration ? (
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: 'var(--bg-card, rgba(0,0,0,0.02))',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    marginBottom: 4
                  }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Duración desactivada. No sumará minutos a tu rutina ni mostrará estimaciones.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setDisableDuration?.(false);
                        setDuration?.(typeof duration === 'number' && duration > 0 ? duration : 15);
                      }}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 8,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        border: '1px solid var(--accent-primary, #007aff)',
                        background: 'rgba(0, 122, 255, 0.08)',
                        color: 'var(--accent-primary, #007aff)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Activar
                    </button>
                  </div>
                ) : (
                  <>
                    <AppleTimerPicker
                      duration={duration}
                      onChange={(mins) => {
                        if (mins === 0) {
                          setDisableDuration?.(true);
                          setDuration?.(0);
                        } else {
                          setDisableDuration?.(false);
                          setDuration?.(mins);
                        }
                      }}
                      isRoutineCategory={isRoutineList}
                      label={isParallel ? 'Tiempo activo (tu dedicación)' : 'Duración estimada'}
                      sublabel={isParallel ? 'El tiempo que estás ocupado realizándola (ej: 20 seg para ponértela, 2 min para cargarla)' : undefined}
                      isParallel={Boolean(isParallel)}
                    />

                    {/* Personalización y Smart Durations */}
                    {task?.suggestedDuration !== undefined && task.suggestedDuration !== duration && (
                      <div style={{
                        marginTop: 12, padding: '10px 14px', borderRadius: 12,
                        background: 'rgba(10, 132, 255, 0.1)', border: '1px solid rgba(10, 132, 255, 0.25)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-primary, #0a84ff)' }}>
                          <Sparkles size={16} />
                          <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>IA: Sueles tardar {task.suggestedDuration} min</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setDisableDuration?.(false);
                            setDuration?.(task.suggestedDuration as number);
                          }}
                          style={{
                            padding: '4px 10px', borderRadius: 8, background: 'var(--accent-primary, #0a84ff)', color: 'white',
                            border: 'none', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer'
                          }}
                        >
                          ¿Actualizar?
                        </button>
                      </div>
                    )}

                    {task?.postponeCount !== undefined && task.postponeCount > 3 && (
                      <div style={{
                        marginTop: 8, padding: '10px 14px', borderRadius: 12,
                        background: 'rgba(255, 59, 48, 0.1)', border: '1px solid rgba(255, 59, 48, 0.25)',
                        display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-red, #ff3b30)'
                      }}>
                        <Clock size={16} />
                        <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                          Has pospuesto esto varias veces. ¿Quieres dividirla o eliminarla?
                        </span>
                      </div>
                    )}

                {/* Opción Tarea en Paralelo / Segundo plano (ej: lavadora, mascarilla, secadora) */}
                {setIsParallel && (isRoutineList || isParallel) && (
                  <div style={{
                    marginTop: 12,
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: isParallel ? 'rgba(255, 149, 0, 0.08)' : 'var(--bg-elevated)',
                    border: isParallel ? '1px solid rgba(255, 149, 0, 0.28)' : '1px solid var(--border-subtle)',
                    transition: 'background-color, border-color, color, fill, opacity, transform, box-shadow 0.2s ease'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: isParallel ? 'rgba(255, 149, 0, 0.18)' : 'var(--bg-material, rgba(0,0,0,0.04))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                          <Zap size={17} strokeWidth={2.4} color={isParallel ? '#ff9500' : 'var(--text-tertiary)'} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.86rem', fontWeight: 650, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                            Tarea en segundo plano
                          </div>
                          <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)', lineHeight: 1.25, marginTop: 2 }}>
                            Lavadora, mascarilla, secadora... se ejecuta sola mientras haces otras tareas
                          </div>
                        </div>
                      </div>
                      <label className="switch switch--orange" style={{ flexShrink: 0 }}>
                        <input
                          type="checkbox"
                          checked={Boolean(isParallel)}
                          onChange={(e) => {
                            setIsParallel(e.target.checked);
                            if (e.target.checked && (!parallelDuration || parallelDuration <= 0)) {
                              setParallelDuration?.(5);
                            }
                          }}
                        />
                        <span className="slider round"></span>
                      </label>
                    </div>

                    {isParallel && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255, 149, 0, 0.18)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <div>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 650 }}>
                              Tiempo de espera pasivo (actúa sola):
                            </span>
                            <div style={{ fontSize: '0.71rem', color: 'var(--text-secondary)', marginTop: 1 }}>
                              No te quita tiempo de tu jornada activa.
                            </div>
                          </div>
                          <span style={{
                            fontSize: '0.84rem',
                            fontWeight: 700,
                            fontVariantNumeric: 'tabular-nums',
                            color: '#ff9500',
                            background: 'rgba(255, 149, 0, 0.14)',
                            padding: '2px 8px',
                            borderRadius: 6,
                            flexShrink: 0
                          }}>
                            {formatDuration(parallelDuration || 5)}
                          </span>
                        </div>

                        {/* Presets rápidos con 5m, 10m, 15m, 20m, 30m... */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {[5, 10, 15, 20, 30, 45, 60, 90, 120, 180].map((mins) => {
                            const isSelected = (parallelDuration || 5) === mins;
                            return (
                              <button
                                key={mins}
                                type="button"
                                onClick={() => setParallelDuration?.(mins)}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: 8,
                                  fontSize: '0.75rem',
                                  fontWeight: isSelected ? 700 : 500,
                                  background: isSelected ? '#ff9500' : 'var(--bg-material, rgba(0,0,0,0.04))',
                                  color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                                  border: isSelected ? '1px solid #ff9500' : '1px solid var(--border-subtle)',
                                  cursor: 'pointer',
                                  transition: 'background-color, border-color, color, fill, opacity, transform, box-shadow 0.15s ease'
                                }}
                              >
                                {formatDuration(mins)}
                              </button>
                            );
                          })}
                        </div>

                        {/* Stepper manual para regular minutos exactos */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'var(--bg-card, rgba(0,0,0,0.03))',
                          padding: '6px 12px',
                          borderRadius: 10,
                          border: '1px solid var(--border-subtle)'
                        }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                            Ajustar minutos exactos:
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => setParallelDuration?.(Math.max(1, (parallelDuration || 5) - 5))}
                              style={{
                                width: 26, height: 26, borderRadius: 6,
                                border: '1px solid var(--border-subtle)',
                                background: 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', color: 'var(--text-primary)'
                              }}
                              title="-5 min"
                            >
                              <Minus size={13} />
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={1440}
                              value={parallelDuration || 5}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (!isNaN(val) && val > 0) setParallelDuration?.(val);
                              }}
                              style={{
                                width: 44,
                                textAlign: 'center',
                                fontSize: '0.86rem',
                                fontWeight: 700,
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--text-primary)',
                                outline: 'none'
                              }}
                            />
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>min</span>
                            <button
                              type="button"
                              onClick={() => setParallelDuration?.((parallelDuration || 5) + 5)}
                              style={{
                                width: 26, height: 26, borderRadius: 6,
                                border: '1px solid var(--border-subtle)',
                                background: 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', color: 'var(--text-primary)'
                              }}
                              title="+5 min"
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Píldora de resumen educativo */}
                        <div style={{
                          padding: '8px 12px',
                          borderRadius: 10,
                          background: 'rgba(255, 149, 0, 0.12)',
                          border: '1px solid rgba(255, 149, 0, 0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: '0.76rem',
                          color: 'var(--text-primary)',
                          lineHeight: 1.3
                        }}>
                          <Sparkles size={14} color="#ff9500" style={{ flexShrink: 0 }} />
                          <span>
                            <strong>Planificación:</strong> {(() => {
                              if (typeof duration !== 'number' || duration <= 0) return '0 min';
                              const totalSec = Math.round(duration * 60);
                              const m = Math.floor(totalSec / 60);
                              const s = totalSec % 60;
                              if (m === 0) return `${s} seg`;
                              if (s === 0) return `${m} min`;
                              return `${m} min ${s} seg`;
                            })()} de dedicación activa + {formatDuration(parallelDuration || 5)} de espera pasiva
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
