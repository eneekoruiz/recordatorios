import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, Mic, MicOff, Settings2, Calendar as CalendarIcon, Repeat, Link2, PlusCircle, Flag, MapPin, Link, Image as ImageIcon, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';
import { parseNaturalLanguage } from '../../utils/nlp';
import './TaskDrawer.css';

interface TaskDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategoryId?: string;
  taskId?: string;
}

export function TaskDrawer({ isOpen, onClose, defaultCategoryId, taskId }: TaskDrawerProps) {
  const addTask = useAppStore(state => state.addTask);
  const updateTask = useAppStore(state => state.updateTask);
  const cycles = useAppStore(state => state.cycles);
  
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [cycleId, setCycleId] = useState<string | undefined>(undefined);
  const [dueDate, setDueDate] = useState<Date>(new Date());
  const [category, setCategory] = useState(defaultCategoryId || 'inbox');
  const [type, setType] = useState<'task' | 'log'>('task');
  const [alerts, setAlerts] = useState<import('../../models/Task').AlertDef[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [blockedBy, setBlockedBy] = useState<string[]>([]);
  const [sectionId, setSectionId] = useState<string | undefined>(undefined);
  const [cardTimeOpen, setCardTimeOpen] = useState(true);
  const [cardRepeatOpen, setCardRepeatOpen] = useState(false);
  const [cardReqOpen, setCardReqOpen] = useState(false);
  const [cardDetailsOpen, setCardDetailsOpen] = useState(false);
  const [cardFinanceOpen, setCardFinanceOpen] = useState(false);
  const [hasDate, setHasDate] = useState(false);
  const [hasTime, setHasTime] = useState(false);
  const [url, setUrl] = useState('');
  const [flagged, setFlagged] = useState(false);
  const [priority, setPriority] = useState<'none' | 'low' | 'medium' | 'high'>('none');
  const [locationName, setLocationName] = useState('');
  const [image, setImage] = useState('');

  // Finance Fields
  const [isDetailed, setIsDetailed] = useState(false);
  const [price, setPrice] = useState<number | undefined>(undefined);
  const [quantity, setQuantity] = useState<number>(1);
  const [brand, setBrand] = useState('');
  const [duration, setDuration] = useState<number | ''>('');

  // Suggested chips purely for visual feedback
  const [suggestedChips, setSuggestedChips] = useState<{type: 'time'|'date'|'cycle', label: string}[]>([]);

  const task = useAppStore(state => taskId ? state.tasks[taskId] : undefined);

  useEffect(() => {
    if (isOpen) {
      if (task) {
        setTitle(task.title || '');
        setNotes(task.description || '');
        setCycleId(task.cycle_id || undefined);
        setDueDate(task.dueDate ? new Date(task.dueDate) : new Date());
        setCategory(task.categoryId || 'inbox');
        setType(task.type || 'task');
        setAlerts(task.alerts || []);
        setBlockedBy(task.blockedBy || []);
        setSectionId(task.sectionId || undefined);
        setFlagged(!!task.flagged);
        setPriority(task.priority || 'none');
        setLocationName(task.locationName || '');
        setUrl(task.url || '');
        setImage(task.image || '');
        setIsDetailed(!!task.isDetailed);
        setPrice(task.price !== undefined ? task.price : undefined);
        setQuantity(task.quantity !== undefined ? task.quantity : 1);
        setBrand(task.brand || '');
        setDuration(task.duration || '');
        setHasDate(!!task.dueDate);
        setHasTime(!!task.alerts?.some(a => a.type === 'at_time'));
        
        // Open cards dynamically if they have values configured
        setCardTimeOpen(!!task.dueDate || !!task.alerts?.some(a => a.type === 'at_time'));
        setCardRepeatOpen(!!task.cycle_id || !!task.sectionId || !!task.locationName);
        setCardReqOpen(task.blockedBy && task.blockedBy.length > 0);
        setCardDetailsOpen(task.priority !== 'none' || !!task.flagged || !!task.url || !!task.image);
        setCardFinanceOpen(!!task.isDetailed);
      } else {
        setTitle('');
        setNotes('');
        setCycleId(undefined);
        setDueDate(new Date());
        setCategory(defaultCategoryId || 'inbox');
        setType('task');
        setAlerts([]);
        setBlockedBy([]);
        setSectionId(undefined);
        setFlagged(false);
        setPriority('none');
        setLocationName('');
        setUrl('');
        setImage('');
        setIsDetailed(false);
        setPrice(undefined);
        setQuantity(1);
        setBrand('');
        setDuration('');
        setHasDate(false);
        setHasTime(false);
        
        // Reset to default collapsed status on create
        setCardTimeOpen(true);
        setCardRepeatOpen(false);
        setCardReqOpen(false);
        setCardDetailsOpen(false);
        setCardFinanceOpen(false);
      }
    }
  }, [isOpen, taskId, task, defaultCategoryId]);

  useEffect(() => {
    if (isOpen && defaultCategoryId) {
      setCategory(defaultCategoryId);
    }
  }, [isOpen, defaultCategoryId]);

  // Tareas disponibles para bloquear (no pueden ser la misma, y deben estar PENDING)
  const availableTasks = Object.values(useAppStore(state => state.tasks)).filter(t => t.status === 'pending' && !t.deleted_at);
  const listSections = useAppStore(state => state.listSections || []);
  const availableSections = listSections.filter(s => s.listId === category);

  // Efecto NLP en tiempo real: Escucha el título y autocompleta horas, fechas, ciclos
  useEffect(() => {
    if (title) {
      const nlp = parseNaturalLanguage(title);
      const newChips: {type: 'time'|'date'|'cycle', label: string}[] = [];
      
      // Manejar tiempos
      if (nlp.times.length > 0) {
        if (navigator.vibrate) navigator.vibrate(20);
        const newAlerts = nlp.times.filter(t => !alerts.find(a => a.time === t)).map(t => ({ id: `alert_${Date.now()}_${t}`, type: 'at_time' as const, time: t }));
        if (newAlerts.length > 0) {
          setAlerts(prev => [...prev, ...newAlerts]);
        }
        nlp.times.forEach(t => newChips.push({ type: 'time', label: t }));
      }
      
      // Manejar sugerencia de fecha
      if (nlp.suggestedDueDate) {
        setDueDate(nlp.suggestedDueDate);
        newChips.push({ type: 'date', label: nlp.suggestedDueDate.toLocaleDateString() });
      } else {
        setDueDate(new Date()); // Volver a hoy por defecto
      }

      // Manejar sugerencia de ciclo
      if (nlp.suggestedCycleId) {
        setCycleId(nlp.suggestedCycleId);
        const cName = cycles.find(c => c.id === nlp.suggestedCycleId)?.name || 'Ciclo';
        newChips.push({ type: 'cycle', label: cName });
      } else {
        setCycleId(undefined); // Volver a one-off
      }
      
      setSuggestedChips(newChips);
    } else {
      setSuggestedChips([]);
      setCycleId(undefined);
      setDueDate(new Date());
    }
  }, [title]);

  const handleSave = () => {
    if (!title.trim()) return;
    
    // Si no hay cycleId y es "One-off", removemos dependencias vacías para limpiar
    const finalBlockedBy = blockedBy.length > 0 ? blockedBy : undefined;

    const payload: any = {
      categoryId: category,
      type,
      title,
      description: notes || undefined,
      cycle_id: cycleId,
      blockedBy: finalBlockedBy,
      dueDate: dueDate.toISOString(),
      alerts,
      sectionId,
      url: url || undefined,
      flagged: flagged || undefined,
      priority: priority !== 'none' ? priority : undefined,
      locationName: locationName || undefined,
      image: image || undefined,
      isDetailed,
      price: isDetailed && price !== undefined ? Number(price) : undefined,
      quantity: isDetailed && quantity !== undefined ? Number(quantity) : undefined,
      brand: isDetailed && brand ? brand : undefined,
      duration: duration !== '' ? Number(duration) : undefined
    };

    if (taskId) {
      updateTask(taskId, payload);
    } else {
      addTask(payload);
    }
    
    // Reset y cerrar
    setTitle('');
    setNotes('');
    setCycleId(undefined);
    setSectionId(undefined);
    setDueDate(new Date());
    setAlerts([]);
    setBlockedBy([]);
    setShowAdvanced(false);
    setHasDate(false);
    setHasTime(false);
    setUrl('');
    setFlagged(false);
    setPriority('none');
    setLocationName('');
    setImage('');
    setIsDetailed(false);
    setPrice(undefined);
    setQuantity(1);
    setBrand('');
    setDuration('');
    onClose();
  };

  const removeAlert = (idToRemove: string) => {
    setAlerts(alerts.filter(a => a.id !== idToRemove));
  };

  const toggleListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Tu navegador no soporta captura de voz nativa.');
      return;
    }

    if (isListening) return; // Ya está escuchando

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = 'es-ES';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setTitle(prev => prev ? `${prev} ${transcript}` : transcript);
      setIsListening(false);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="drawer-overlay" onClick={onClose}>
          <motion.div 
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
            key="drawer"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-header" role="banner">
              <button className="cancel-btn" onClick={onClose} aria-label={taskId ? 'Cancelar edición' : 'Cancelar creación de tarea'}>Cancelar</button>
              <h3 id="drawer-title">{taskId ? 'Detalles de Tarea' : 'Nueva Tarea'}</h3>
              <button className="save-btn" onClick={handleSave} disabled={!title.trim()} aria-label={taskId ? 'Guardar cambios' : 'Guardar nueva tarea'}>
                {taskId ? 'Aceptar' : 'Añadir'}
              </button>
            </div>

            <div className="drawer-content" role="form" aria-labelledby="drawer-title" style={{ overflowY: 'auto', padding: '16px' }}>
              
              <div className="input-group" style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <input 
                    type="text" 
                    className="title-input" 
                    placeholder="Ej: Tomar pastillas mañana a las 5 y a las 8..." 
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    autoFocus 
                    aria-label="Título de la tarea con reconocimiento de horas"
                    style={{ flex: 1 }}
                  />
                  <button 
                    onClick={toggleListening} 
                    aria-label="Dictar por voz"
                    style={{ background: 'none', border: 'none', color: isListening ? '#ff3b30' : 'var(--accent-color)', cursor: 'pointer', padding: '0 16px' }}
                  >
                    {isListening ? <MicOff size={20} className="pulse-anim" /> : <Mic size={20} />}
                  </button>
                </div>
                <textarea 
                  className="notes-input" 
                  placeholder="Notas adicionales..." 
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3} 
                  aria-label="Notas de la tarea"
                />
              </div>

              {/* Muestra chips dinámicos detectados por NLP */}
              {suggestedChips.length > 0 && (
                <div style={{ display: 'flex', gap: 'var(--space-8)', flexWrap: 'wrap', marginBottom: '16px' }}>
                  {suggestedChips.map((chip, idx) => (
                    <div key={idx} style={{ 
                      fontSize: '0.75rem', 
                      background: 'var(--accent-glow)', 
                      color: 'var(--accent-primary)',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      {chip.type === 'time' && <Clock size={12} />}
                      {chip.type === 'date' && <CalendarIcon size={12} />}
                      {chip.type === 'cycle' && <Repeat size={12} />}
                      {chip.label}
                    </div>
                  ))}
                </div>
              )}

              {/* List and Type pickers */}
              <div className="details-group" style={{ marginBottom: '20px' }}>
                <div className="detail-row" style={{ padding: '12px 0' }}>
                  <span className="detail-label">Mover a Lista</span>
                  <select 
                    className="detail-select"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    style={{ width: 'auto', textAlign: 'right', border: 'none', background: 'transparent' }}
                  >
                    {useAppStore.getState().lists?.map(list => (
                      <option key={list.id} value={list.id}>{list.name}</option>
                    ))}
                    <option value="inbox">Bandeja de Entrada</option>
                  </select>
                </div>
                
                <div className="divider"></div>
                
                <div className="detail-row" style={{ padding: '12px 0' }}>
                  <span className="detail-label">Tipo de Recordatorio</span>
                  <select 
                    className="detail-select"
                    value={type}
                    onChange={e => setType(e.target.value as 'task' | 'log')}
                    style={{ width: 'auto', textAlign: 'right', border: 'none', background: 'transparent' }}
                  >
                    <option value="task">Acción (Checklist)</option>
                    <option value="log">Registro (Historial)</option>
                  </select>
                </div>
              </div>

              {/* Card 1: Fecha y Horarios */}
              <div className="section-card">
                <button 
                  type="button"
                  className="section-card-header"
                  onClick={() => setCardTimeOpen(!cardTimeOpen)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CalendarIcon size={16} color="var(--accent-red)" />
                    Fecha y Horarios
                  </span>
                  <ChevronDown size={18} style={{ transform: cardTimeOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
                {cardTimeOpen && (
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
                          className="detail-select" 
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
                                  <span>{alert.time || `-${alert.offsetMinutes}m`}</span>
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
                  </div>
                )}
              </div>

              {/* Card 2: Repetición y Ubicación */}
              <div className="section-card">
                <button 
                  type="button"
                  className="section-card-header"
                  onClick={() => setCardRepeatOpen(!cardRepeatOpen)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Repeat size={16} color="var(--accent-green)" />
                    Repetición y Ubicación
                  </span>
                  <ChevronDown size={18} style={{ transform: cardRepeatOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
                {cardRepeatOpen && (
                  <div className="section-card-content">
                    <div className="detail-row" style={{ padding: '8px 0' }}>
                      <span className="detail-label">Repetir (Ciclo)</span>
                      <select 
                        className="detail-select"
                        value={cycleId || ''}
                        onChange={e => setCycleId(e.target.value || undefined)}
                      >
                        <option value="">Nunca</option>
                        {cycles.map(cycle => (
                          <option key={cycle.id} value={cycle.id}>{cycle.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="divider"></div>
                    
                    <div className="detail-row" style={{ padding: '8px 0' }}>
                      <span className="detail-label">Sección de Lista</span>
                      <select 
                        className="detail-select"
                        value={sectionId || ''}
                        onChange={async e => {
                          if (e.target.value === 'new') {
                            const name = prompt('Nombre de la nueva sección:');
                            if (name && name.trim()) {
                              const newId = crypto.randomUUID();
                              useAppStore.getState().addListSection({
                                id: newId,
                                listId: category,
                                name: name.trim()
                              });
                              setSectionId(newId);
                            }
                          } else {
                            setSectionId(e.target.value || undefined);
                          }
                        }}
                      >
                        <option value="">Automática / General</option>
                        {availableSections.map(sec => (
                          <option key={sec.id} value={sec.id}>{sec.name}</option>
                        ))}
                        <option value="new">+ Añadir nueva sección...</option>
                      </select>
                    </div>

                    <div className="divider"></div>

                    <div className="detail-row" style={{ padding: '8px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <MapPin size={18} color="var(--accent-blue)" />
                        <span className="detail-label" style={{ marginBottom: 0 }}>Ubicación</span>
                      </div>
                      <label className="switch">
                        <input type="checkbox" checked={!!locationName} onChange={e => setLocationName(e.target.checked ? 'Dirección actual' : '')} />
                        <span className="slider round"></span>
                      </label>
                    </div>
                    {!!locationName && (
                      <div className="detail-row" style={{ padding: '4px 0', marginTop: -8 }}>
                        <input 
                          type="text" 
                          className="detail-select" 
                          placeholder="Buscar dirección o usar actual..."
                          value={locationName === 'Dirección actual' ? '' : locationName}
                          onChange={e => setLocationName(e.target.value)}
                          style={{ width: '100%', textAlign: 'right', borderBottom: '1px solid var(--border-subtle)' }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Card 3: Requisitos (Tareas que la bloquean) */}
              <div className="section-card">
                <button 
                  type="button"
                  className="section-card-header"
                  onClick={() => setCardReqOpen(!cardReqOpen)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Link2 size={16} color="var(--accent-orange)" />
                    Requisitos / Dependencias
                  </span>
                  <ChevronDown size={18} style={{ transform: cardReqOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
                {cardReqOpen && (
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

                    <select 
                      className="detail-select"
                      value=""
                      onChange={e => {
                        if (e.target.value && !blockedBy.includes(e.target.value)) {
                          setBlockedBy([...blockedBy, e.target.value]);
                        }
                      }}
                      style={{ width: '100%', border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', borderRadius: 6, padding: 8, textAlign: 'left' }}
                    >
                      <option value="">+ Añadir tarea bloqueadora (requisito)...</option>
                      {availableTasks.filter(t => !blockedBy.includes(t.id)).map(t => (
                        <option key={t.id} value={t.id}>{t.title}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Card 4: Detalles Adicionales */}
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
                {cardDetailsOpen && (
                  <div className="section-card-content">
                    <div className="detail-row" style={{ padding: '8px 0' }}>
                      <span className="detail-label">Prioridad</span>
                      <select 
                        className="detail-select"
                        value={priority}
                        onChange={e => setPriority(e.target.value as any)}
                        style={{ border: 'none', background: 'transparent' }}
                      >
                        <option value="none">Ninguna</option>
                        <option value="low">Baja</option>
                        <option value="medium">Media</option>
                        <option value="high">Alta</option>
                      </select>
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
                  </div>
                )}
              </div>

              {/* Card 5: Modo Financiero (Costes) */}
              {(category === 'inbox' || useAppStore.getState().lists.find(l => l.id === category)?.isFinancial) && (
                <div className="section-card" style={{ marginBottom: '0' }}>
                  <button 
                    type="button"
                    className="section-card-header"
                    onClick={() => setCardFinanceOpen(!cardFinanceOpen)}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14 }}>💰</span>
                      Modo Financiero (Costes)
                    </span>
                    <ChevronDown size={18} style={{ transform: cardFinanceOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                  </button>
                  {cardFinanceOpen && (
                    <div className="section-card-content">
                      <div className="detail-row" style={{ padding: '8px 0' }}>
                        <span className="detail-label">Habilitar Detalles</span>
                        <label className="switch">
                          <input type="checkbox" checked={isDetailed} onChange={e => setIsDetailed(e.target.checked)} />
                          <span className="slider round"></span>
                        </label>
                      </div>

                      {isDetailed && (
                        <>
                          <div className="divider"></div>
                          
                          <div className="detail-row" style={{ padding: '8px 0' }}>
                            <span className="detail-label">Precio/Unidad ($)</span>
                            <input 
                              type="number" 
                              step="0.01" 
                              min="0" 
                              placeholder="0.00" 
                              value={price || ''} 
                              onChange={e => setPrice(parseFloat(e.target.value))}
                              style={{ width: 80, textAlign: 'right', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-primary)' }}
                            />
                          </div>
                          
                          <div className="divider"></div>

                          <div className="detail-row" style={{ padding: '8px 0' }}>
                            <span className="detail-label">Cantidad</span>
                            <input 
                              type="number" 
                              step="1" 
                              min="1" 
                              value={quantity} 
                              onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                              style={{ width: 80, textAlign: 'right', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-primary)' }}
                            />
                          </div>

                          <div className="divider"></div>

                          <div className="detail-row" style={{ padding: '8px 0' }}>
                            <span className="detail-label">Marca sugerida</span>
                            <input 
                              type="text" 
                              placeholder="Ej: Nestlé" 
                              value={brand} 
                              onChange={e => setBrand(e.target.value)}
                              style={{ width: 120, textAlign: 'right', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-primary)' }}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
