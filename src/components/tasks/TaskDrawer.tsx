import { useState, useEffect } from 'react';
import { X, Clock, Mic, MicOff } from 'lucide-react';
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
  const [cycleId, setCycleId] = useState('cycle_day');
  const [category, setCategory] = useState(defaultCategoryId || 'limpieza');
  const [alerts, setAlerts] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [blockedBy, setBlockedBy] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && defaultCategoryId) {
      setCategory(defaultCategoryId);
    }
  }, [isOpen, defaultCategoryId]);

  // Tareas disponibles para bloquear (no pueden ser la misma, y deben estar PENDING)
  const availableTasks = Object.values(useAppStore(state => state.tasks)).filter(t => t.status === 'PENDING' && !t.is_deleted);

  // Efecto NLP en tiempo real: Escucha el título y autocompleta horas
  useEffect(() => {
    if (title) {
      const { times: detectedTimes } = parseNaturalLanguage(title);
      if (detectedTimes.length > 0) {
        if (navigator.vibrate) navigator.vibrate(20);
        
        const merged = Array.from(new Set([...alerts, ...detectedTimes]));
        if (merged.length !== alerts.length) {
          setAlerts(merged);
        }
      }
    }
  }, [title]);

  const handleSave = () => {
    if (!title.trim()) return;
    
    addTask({
      categoryId: category,
      title,
      notes,
      cycleId,
      blockedBy,
      dueDate: new Date(),
      alerts
    });
    
    // Reset y cerrar
    setTitle('');
    setNotes('');
    setCycleId('cycle_day');
    setAlerts([]);
    setBlockedBy([]);
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
                <div className="detail-row">
                  <span className="detail-label">Frecuencia</span>
                  <div className="frequency-selector">
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
