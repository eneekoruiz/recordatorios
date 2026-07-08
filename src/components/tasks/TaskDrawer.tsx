import { useState, useEffect } from 'react';
import { X, Clock, Mic, MicOff, Settings2, Calendar as CalendarIcon, Repeat } from 'lucide-react';
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
  const [alerts, setAlerts] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [blockedBy, setBlockedBy] = useState<string[]>([]);
  const [sectionId, setSectionId] = useState<string | undefined>(undefined);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Suggested chips purely for visual feedback
  const [suggestedChips, setSuggestedChips] = useState<{type: 'time'|'date'|'cycle', label: string}[]>([]);

  useEffect(() => {
    if (isOpen && defaultCategoryId) {
      setCategory(defaultCategoryId);
    }
  }, [isOpen, defaultCategoryId]);

  // Tareas disponibles para bloquear (no pueden ser la misma, y deben estar PENDING)
  const availableTasks = Object.values(useAppStore(state => state.tasks)).filter(t => t.status === 'PENDING' && !t.is_deleted);
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
        const merged = Array.from(new Set([...alerts, ...nlp.times]));
        if (merged.length !== alerts.length) {
          setAlerts(merged);
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
      title,
      notes: notes || undefined,
      cycleId,
      blockedBy: finalBlockedBy,
      dueDate,
      alerts,
      sectionId
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
    onClose();
  };

  const removeAlert = (timeToRemove: string) => {
    setAlerts(alerts.filter(t => t !== timeToRemove));
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
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="drawer-backdrop" 
            onClick={onClose} 
          />
          
          <motion.div 
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

            <div className="drawer-content" role="form" aria-labelledby="drawer-title">
              
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
                <div style={{ display: 'flex', gap: '8px', padding: '0 16px', flexWrap: 'wrap' }}>
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
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '16px' }}
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

                    <div className="section-title">Detalles</div>
                    <div className="details-group">
                      <div className="detail-row frequency-row">
                        <span className="detail-label">Frecuencia</span>
                        <div className="frequency-selector">
                          <button 
                            className={`freq-btn ${!cycleId ? 'active' : ''}`}
                            onClick={() => setCycleId(undefined)}
                            type="button"
                          >
                            Una Vez
                          </button>
                          {cycles.map(cycle => (
                            <button 
                              key={cycle.id}
                              className={`freq-btn ${cycleId === cycle.id ? 'active' : ''}`}
                              onClick={() => setCycleId(cycle.id)}
                              type="button"
                            >
                              {cycle.name}
                            </button>
                          ))}
                        </div>
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
                      <div className="detail-row">
                        <span className="detail-label">Bloqueada Por</span>
                        <select 
                          multiple
                          className="detail-select"
                          value={blockedBy}
                          onChange={e => {
                            const options = Array.from(e.target.selectedOptions, option => option.value);
                            setBlockedBy(options);
                          }}
                          style={{ height: '80px' }}
                        >
                          {availableTasks.map(t => (
                            <option key={t.id} value={t.id}>{t.title}</option>
                          ))}
                        </select>
                      </div>
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
                    {alerts.map((time) => (
                      <motion.div 
                        key={time}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        className="alert-chip"
                      >
                        <Clock size={14} />
                        <span>{time}</span>
                        <button className="chip-remove" onClick={() => removeAlert(time)}>
                          <X size={14} />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
