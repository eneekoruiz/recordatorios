import { useState, useEffect } from 'react';
import { X, Clock, Mic, MicOff, Settings2, Calendar as CalendarIcon, Repeat, Link2, PlusCircle, Flag, MapPin, Link, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';
import { parseNaturalLanguage } from '../../utils/nlp';
import './TaskDrawer.css';

interface TaskDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategoryId?: string;
}

export function TaskDrawer({ isOpen, onClose, defaultCategoryId }: TaskDrawerProps) {
  const addTask = useAppStore(state => state.addTask);
  const cycles = useAppStore(state => state.cycles);
  
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [cycleId, setCycleId] = useState<string | undefined>(undefined);
  const [dueDate, setDueDate] = useState<Date>(new Date());
  const [category, setCategory] = useState(defaultCategoryId || 'limpieza');
  const [type, setType] = useState<'task' | 'log'>('task');
  const [alerts, setAlerts] = useState<import('../../models/Task').AlertDef[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [blockedBy, setBlockedBy] = useState<string[]>([]);
  const [sectionId, setSectionId] = useState<string | undefined>(undefined);
  const [showAdvanced, setShowAdvanced] = useState(false);
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

  // Suggested chips purely for visual feedback
  const [suggestedChips, setSuggestedChips] = useState<{type: 'time'|'date'|'cycle', label: string}[]>([]);

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

    addTask({
      categoryId: category,
      type,
      title,
      description: notes || undefined,
      cycleId,
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
      price: isDetailed ? price : undefined,
      quantity: isDetailed ? quantity : undefined,
      brand: isDetailed && brand ? brand : undefined
    });
    
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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="drawer-backdrop" 
            onClick={onClose} 
          />
      )}
      
      {isOpen && (
          <motion.div 
            key="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="drawer"
          >
            <div className="drawer-header" role="banner">
              <button className="cancel-btn" onClick={onClose} aria-label="Cancelar creación de tarea">Cancelar</button>
              <h3 id="drawer-title">Nueva Tarea</h3>
              <button className="save-btn" onClick={handleSave} disabled={!title.trim()} aria-label="Guardar nueva tarea">
                Añadir
              </button>
            </div>

            <div className="drawer-content" role="form" aria-labelledby="drawer-title" style={{ overflowY: 'auto' }}>
              
              <div className="input-group">
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
              </div>

              {/* Muestra chips dinámicos detectados por NLP */}
              {suggestedChips.length > 0 && (
                <div style={{ display: 'flex', gap: 'var(--space-8)', flexWrap: 'wrap' }}>
                  {alerts.map((alert) => (
                    <span key={alert.id} className="pill">{alert.time}</span>
                  ))}
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

              <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
                <button 
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  style={{
                    background: 'none', border: 'none', color: 'var(--text-secondary)',
                    display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer'
                  }}
                >
                  <Settings2 size={14} />
                  {showAdvanced ? 'Ocultar Opciones Avanzadas' : 'Opciones Avanzadas'}
                </button>
              </div>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
                    animate={{ opacity: 1, height: 'auto', transitionEnd: { overflow: 'visible' } }}
                    exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
                  >
                    <div className="input-group">
                      <textarea 
                        className="notes-input" 
                        placeholder="Notas adicionales" 
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        rows={3} 
                        aria-label="Notas de la tarea"
                      />
                    </div>

                    {/* Only show Financial Mode if the list is financial or if it's inbox/uncategorized */}
                    {(category === 'inbox' || useAppStore.getState().lists.find(l => l.id === category)?.isFinancial) && (
                      <>
                        <div className="section-title">Modo Financiero (Shopping)</div>
                        <div className="details-group">
                          <div className="detail-row frequency-row" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span className="detail-label" style={{ marginBottom: 0 }}>Habilitar Detalle</span>
                            <label className="switch">
                              <input type="checkbox" checked={isDetailed} onChange={e => setIsDetailed(e.target.checked)} />
                              <span className="slider round"></span>
                            </label>
                          </div>

                          <AnimatePresence>
                            {isDetailed && (
                          <motion.div
                            initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
                            animate={{ opacity: 1, height: 'auto', transitionEnd: { overflow: 'visible' } }}
                            exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                          >
                            <div className="divider"></div>
                            
                            <div className="detail-row" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                              <span className="detail-label" style={{ marginBottom: 0 }}>Precio/Unidad ($)</span>
                              <input 
                                type="number" 
                                step="0.01" 
                                min="0" 
                                placeholder="0.00" 
                                value={price || ''} 
                                onChange={e => setPrice(parseFloat(e.target.value))}
                                style={{ width: 80, textAlign: 'right', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-primary)' }}
                              />
                            </div>
                            
                            <div className="detail-row" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                              <span className="detail-label" style={{ marginBottom: 0 }}>Cantidad</span>
                              <input 
                                type="number" 
                                step="1" 
                                min="1" 
                                value={quantity} 
                                onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                                style={{ width: 80, textAlign: 'right', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-primary)' }}
                              />
                            </div>

                            <div className="detail-row" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 8 }}>
                              <span className="detail-label" style={{ marginBottom: 0 }}>Marca sugerida</span>
                              <input 
                                type="text" 
                                placeholder="Ej: Nestlé" 
                                value={brand} 
                                onChange={e => setBrand(e.target.value)}
                                style={{ width: 120, textAlign: 'right', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '4px 8px', color: 'var(--text-primary)' }}
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    </>
                    )}

                    <div className="section-title">Detalles</div>
                    <div className="details-group">
                      <div className="detail-row frequency-row" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className="detail-label" style={{ marginBottom: 0 }}>Repetir</span>
                        <select 
                          className="detail-select"
                          value={cycleId || ''}
                          onChange={e => setCycleId(e.target.value || undefined)}
                          style={{ width: 'auto', textAlign: 'right', border: 'none', background: 'transparent' }}
                        >
                          <option value="">Nunca</option>
                          {cycles.map(cycle => (
                            <option key={cycle.id} value={cycle.id}>{cycle.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="divider"></div>
                      
                      <div className="detail-row" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <CalendarIcon size={18} color="var(--accent-red)" />
                          <span className="detail-label" style={{ marginBottom: 0 }}>Fecha</span>
                        </div>
                        <label className="switch">
                          <input type="checkbox" checked={hasDate} onChange={e => setHasDate(e.target.checked)} />
                          <span className="slider round"></span>
                        </label>
                      </div>
                      {hasDate && (
                        <div className="detail-row" style={{ marginTop: -8 }}>
                          <input 
                            type="date" 
                            className="detail-select" 
                            value={dueDate.toISOString().split('T')[0]}
                            onChange={e => setDueDate(new Date(e.target.value))}
                          />
                        </div>
                      )}
                      
                      <div className="divider"></div>

                      <div className="detail-row" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Clock size={18} color="var(--accent-blue)" />
                          <span className="detail-label" style={{ marginBottom: 0 }}>Hora</span>
                        </div>
                        <label className="switch">
                          <input type="checkbox" checked={hasTime} onChange={e => {
                            setHasTime(e.target.checked);
                            if (e.target.checked && alerts.length === 0) setAlerts([{ id: `alert_${Date.now()}`, type: 'at_time', time: '09:00' }]);
                          }} />
                          <span className="slider round"></span>
                        </label>
                      </div>
                      {hasTime && (
                        <div className="detail-row" style={{ marginTop: -8 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                              className="add-alert-btn"
                              onClick={() => setAlerts([...alerts, { id: `alert_${Date.now()}`, type: 'at_time', time: '12:00' }])}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-primary)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '8px 0', fontSize: '0.9rem' }}
                            >
                              <PlusCircle size={16} /> Añadir hora
                            </button>
                          </div>
                        </div>
                      )}
                      
                      <div className="divider"></div>
                      <div className="detail-row">
                        <span className="detail-label">Tipo</span>
                        <select 
                          className="detail-select"
                          value={type}
                          onChange={e => setType(e.target.value as 'task' | 'log')}
                        >
                          <option value="task">Acción (Checklist)</option>
                          <option value="log">Registro / Evento (Historial)</option>
                        </select>
                      </div>

                      <div className="divider"></div>
                      <div className="detail-row">
                        <span className="detail-label">Lista</span>
                        <select 
                          className="detail-select"
                          value={category}
                          onChange={e => setCategory(e.target.value)}
                        >
                          {useAppStore.getState().lists?.map(list => (
                            <option key={list.id} value={list.id}>{list.name}</option>
                          ))}
                          <option value="inbox">Bandeja de Entrada</option>
                        </select>
                      </div>
                      
                      {availableSections.length > 0 && (
                        <>
                          <div className="divider"></div>
                          <div className="detail-row">
                            <span className="detail-label">Sección</span>
                            <select 
                              className="detail-select"
                              value={sectionId || ''}
                              onChange={e => setSectionId(e.target.value || undefined)}
                            >
                              <option value="">Automática (Por Frecuencia)</option>
                              {availableSections.map(sec => (
                                <option key={sec.id} value={sec.id}>{sec.name}</option>
                              ))}
                            </select>
                          </div>
                        </>
                      )}

                      <div className="divider"></div>
                      <div className="detail-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                          <Link2 size={18} color="var(--text-tertiary)" />
                          <span className="detail-label" style={{ marginBottom: 0 }}>Bloqueada Por</span>
                        </div>
                        
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                          {blockedBy.map(tId => {
                            const bTask = availableTasks.find(t => t.id === tId);
                            if (!bTask) return null;
                            return (
                              <div key={tId} style={{ 
                                display: 'flex', alignItems: 'center', gap: 4, 
                                background: 'var(--bg-surface)', padding: '4px 10px', 
                                borderRadius: 16, fontSize: '0.85rem' 
                              }}>
                                <span>{bTask.title}</span>
                                <button className="chip-remove" onClick={() => setBlockedBy(blockedBy.filter(id => id !== tId))} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 2 }}>
                                  <X size={14} />
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        <select 
                          className="detail-select"
                          value=""
                          onChange={e => {
                            if (e.target.value && !blockedBy.includes(e.target.value)) {
                              setBlockedBy([...blockedBy, e.target.value]);
                            }
                          }}
                          style={{ width: '100%' }}
                        >
                          <option value="">+ Tarea bloqueadora...</option>
                          {availableTasks.filter(t => !blockedBy.includes(t.id)).map(t => (
                            <option key={t.id} value={t.id}>{t.title}</option>
                          ))}
                        </select>
                      </div>

                      <div className="divider"></div>

                      <div className="detail-row" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Flag size={18} color="var(--accent-orange)" />
                          <span className="detail-label" style={{ marginBottom: 0 }}>Destacado</span>
                        </div>
                        <label className="switch">
                          <input type="checkbox" checked={flagged} onChange={e => setFlagged(e.target.checked)} />
                          <span className="slider round"></span>
                        </label>
                      </div>

                      <div className="divider"></div>

                      <div className="detail-row" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="detail-label" style={{ marginBottom: 0 }}>Prioridad</span>
                        </div>
                        <select 
                          className="detail-select"
                          value={priority}
                          onChange={e => setPriority(e.target.value as any)}
                          style={{ width: 'auto', textAlign: 'right', border: 'none', background: 'transparent' }}
                        >
                          <option value="none">Ninguna</option>
                          <option value="low">Baja</option>
                          <option value="medium">Media</option>
                          <option value="high">Alta</option>
                        </select>
                      </div>

                      <div className="divider"></div>
                      
                      <div className="detail-row" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
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
                        <div className="detail-row" style={{ marginTop: -8 }}>
                          <input 
                            type="text" 
                            className="detail-select" 
                            placeholder="Buscar dirección o usar actual..."
                            value={locationName === 'Dirección actual' ? '' : locationName}
                            onChange={e => setLocationName(e.target.value)}
                          />
                        </div>
                      )}

                      <div className="divider"></div>

                      <div className="detail-row" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Link size={18} color="var(--text-tertiary)" />
                          <span className="detail-label" style={{ marginBottom: 0 }}>URL</span>
                        </div>
                      </div>
                      <div className="detail-row" style={{ marginTop: -12 }}>
                        <input 
                          type="url" 
                          className="detail-select" 
                          placeholder="https://..."
                          value={url}
                          onChange={e => setUrl(e.target.value)}
                        />
                      </div>

                      <div className="divider"></div>

                      <div className="detail-row" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <ImageIcon size={18} color="var(--text-tertiary)" />
                          <span className="detail-label" style={{ marginBottom: 0 }}>Imagen</span>
                        </div>
                        <label className="switch">
                          <input type="checkbox" checked={!!image} onChange={e => setImage(e.target.checked ? 'https://picsum.photos/200/300' : '')} />
                          <span className="slider round"></span>
                        </label>
                      </div>
                      {!!image && (
                        <div className="detail-row" style={{ marginTop: -8 }}>
                          <input 
                            type="url" 
                            className="detail-select" 
                            placeholder="URL de imagen..."
                            value={image === 'https://picsum.photos/200/300' ? '' : image}
                            onChange={e => setImage(e.target.value)}
                          />
                        </div>
                      )}

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="section-title">Alertas Detectadas</div>
              <div className="details-group alerts-group">
                <div className="alerts-description">
                  Las horas detectadas al escribir aparecerán aquí automáticamente.
                </div>
                
                <div className="chips-container">
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

            </div>
          </motion.div>
      )}
    </AnimatePresence>
  );
}
