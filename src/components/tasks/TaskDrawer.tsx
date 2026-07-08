import { useState, useEffect } from 'react';
import { X, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';
import type { FrequencyLevel } from '../../models/Task';
import { parseNaturalLanguage } from '../../utils/nlp';
import './TaskDrawer.css';

interface TaskDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TaskDrawer({ isOpen, onClose }: TaskDrawerProps) {
  const addTask = useAppStore(state => state.addTask);
  
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [frequency, setFrequency] = useState<FrequencyLevel>(0);
  const [category, setCategory] = useState('limpieza');
  const [alerts, setAlerts] = useState<string[]>([]);

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
      title,
      notes,
      frequencyLevel: frequency,
      categoryId: category,
      dueDate: new Date(),
      alerts
    });
    
    // Reset y cerrar
    setTitle('');
    setNotes('');
    setAlerts([]);
    setFrequency(0);
    onClose();
  };

  const removeAlert = (timeToRemove: string) => {
    setAlerts(alerts.filter(t => t !== timeToRemove));
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
                <input 
                  type="text" 
                  className="title-input" 
                  placeholder="Ej: Tomar pastillas mañana a las 5 y a las 8..." 
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  autoFocus 
                  aria-label="Título de la tarea con reconocimiento de horas"
                />
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
                  <select 
                    className="detail-select" 
                    value={frequency} 
                    onChange={e => setFrequency(Number(e.target.value) as FrequencyLevel)}
                  >
                    <option value="0">Una vez</option>
                    <option value="1">Diario</option>
                    <option value="2">Semanal</option>
                    <option value="3">Mensual</option>
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
                    <option value="limpieza">Limpieza</option>
                    <option value="compra">Compra</option>
                    <option value="skincare">Skincare</option>
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
