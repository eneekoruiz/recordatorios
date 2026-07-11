import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, Mic, MicOff, Settings2, Calendar as CalendarIcon, Repeat, Link2, PlusCircle, Flag, MapPin, Link, Image as ImageIcon, ChevronDown, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';
import { parseNaturalLanguage } from '../../utils/nlp';
import './TaskDrawer.css';

interface TaskDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategoryId?: string;
  defaultSectionId?: string;
  taskId?: string;
}
import { CustomSelect } from '../ui/CustomSelect';

export function TaskDrawer({ isOpen, onClose, defaultCategoryId, defaultSectionId, taskId }: TaskDrawerProps) {
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
  const [sectionId, setSectionId] = useState<string | undefined>(defaultSectionId);
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
  const [hasLocationAlert, setHasLocationAlert] = useState(false);
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [locationRadius, setLocationRadius] = useState<number>(100);
  const [locationAddress, setLocationAddress] = useState<string>('');
  
  // Location Presets
  const [homeLocation, setHomeLocation] = useState<{ lat: number; lng: number; address: string } | null>(() => {
    const val = localStorage.getItem('home_location');
    return val ? JSON.parse(val) : null;
  });
  const [workLocation, setWorkLocation] = useState<{ lat: number; lng: number; address: string } | null>(() => {
    const val = localStorage.getItem('work_location');
    return val ? JSON.parse(val) : null;
  });
  const [selectedPreset, setSelectedPreset] = useState<'current' | 'home' | 'work' | 'custom'>('current');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ lat: string; lon: string; display_name: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [image, setImage] = useState('');

  // Finance Fields
  const [isDetailed, setIsDetailed] = useState(false);
  const [price, setPrice] = useState<number | undefined>(undefined);
  const [quantity, setQuantity] = useState<number>(1);
  const [brand, setBrand] = useState('');
  const [duration, setDuration] = useState<number | ''>('');
  const [showAdvanced, setShowAdvanced] = useState(false);

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
        setHasLocationAlert(!!task.location);
        setLocationLat(task.location ? task.location.lat : null);
        setLocationLng(task.location ? task.location.lng : null);
        setLocationRadius(task.location ? task.location.radius : 100);
        setLocationAddress(task.location ? task.location.address : '');
        
        // Hydrate selected preset if it matches home/work within close tolerance
        if (task.location) {
          const homeVal = localStorage.getItem('home_location');
          const workVal = localStorage.getItem('work_location');
          const home = homeVal ? JSON.parse(homeVal) : null;
          const work = workVal ? JSON.parse(workVal) : null;
          const isHome = home && Math.abs(task.location.lat - home.lat) < 0.0001 && Math.abs(task.location.lng - home.lng) < 0.0001;
          const isWork = work && Math.abs(task.location.lat - work.lat) < 0.0001 && Math.abs(task.location.lng - work.lng) < 0.0001;
          
          if (isHome) {
            setSelectedPreset('home');
          } else if (isWork) {
            setSelectedPreset('work');
          } else {
            setSelectedPreset('custom');
          }
        } else {
          setSelectedPreset('current');
        }
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
        setCardRepeatOpen(!!task.cycle_id || !!task.sectionId || !!task.locationName || !!task.location);
        setCardReqOpen(task.blockedBy && task.blockedBy.length > 0);
        setCardDetailsOpen(task.priority !== 'none' || !!task.flagged || !!task.url || !!task.image);
        setCardFinanceOpen(!!task.isDetailed);
      } else {
        // Nueva tarea
        setTitle('');
        setNotes('');
        setCategory(defaultCategoryId || 'inbox');
        setSectionId(defaultSectionId);
        setCycleId(undefined);
        setDueDate(new Date());
        setType('task');
        setAlerts([]);
        setBlockedBy([]);
        setSectionId(undefined);
        setFlagged(false);
        setPriority('none');
        setLocationName('');
        setHasLocationAlert(false);
        setLocationLat(null);
        setLocationLng(null);
        setLocationRadius(100);
        setLocationAddress('');
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

  const saveHomeLocation = (loc: { lat: number; lng: number; address: string }) => {
    localStorage.setItem('home_location', JSON.stringify(loc));
    setHomeLocation(loc);
  };

  const saveWorkLocation = (loc: { lat: number; lng: number; address: string }) => {
    localStorage.setItem('work_location', JSON.stringify(loc));
    setWorkLocation(loc);
  };

  const obtenerUbicacionActual = () => {
    if (!navigator.geolocation) {
      alert('La geolocalización no está soportada por tu navegador.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationLat(pos.coords.latitude);
        setLocationLng(pos.coords.longitude);
        if (!locationAddress) {
          setLocationAddress('Mi ubicación actual');
        }
      },
      (err) => {
        alert(`Error obteniendo coordenadas: ${err.message}`);
      }
    );
  };

  const selectPresetLocation = (preset: 'current' | 'home' | 'work' | 'custom') => {
    setSelectedPreset(preset);
    if (preset === 'current') {
      obtenerUbicacionActual();
    } else if (preset === 'home') {
      if (homeLocation) {
        setLocationLat(homeLocation.lat);
        setLocationLng(homeLocation.lng);
        setLocationAddress(homeLocation.address);
      } else {
        const confirmSave = confirm('No tienes configurada la ubicación de Casa. ¿Quieres obtener tu ubicación actual y guardarla como Casa?');
        if (confirmSave) {
          if (!navigator.geolocation) {
            alert('Geolocalización no soportada.');
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, address: 'Casa' };
              saveHomeLocation(loc);
              setLocationLat(loc.lat);
              setLocationLng(loc.lng);
              setLocationAddress(loc.address);
            },
            (err) => alert(`Error: ${err.message}`)
          );
        } else {
          setSelectedPreset('custom');
        }
      }
    } else if (preset === 'work') {
      if (workLocation) {
        setLocationLat(workLocation.lat);
        setLocationLng(workLocation.lng);
        setLocationAddress(workLocation.address);
      } else {
        const confirmSave = confirm('No tienes configurada la ubicación de Trabajo. ¿Quieres obtener tu ubicación actual y guardarla como Trabajo?');
        if (confirmSave) {
          if (!navigator.geolocation) {
            alert('Geolocalización no soportada.');
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, address: 'Trabajo' };
              saveWorkLocation(loc);
              setLocationLat(loc.lat);
              setLocationLng(loc.lng);
              setLocationAddress(loc.address);
            },
            (err) => alert(`Error: ${err.message}`)
          );
        } else {
          setSelectedPreset('custom');
        }
      }
    }
  };

  const handleAddressSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`, {
        headers: {
          'Accept-Language': 'es-ES,es;q=0.9'
        }
      });
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      console.error(err);
      alert('Error al buscar dirección. Por favor inténtalo de nuevo.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (result: { lat: string; lon: string; display_name: string }) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    const address = result.display_name;
    
    setLocationLat(lat);
    setLocationLng(lng);
    setLocationAddress(address);
    setSearchResults([]);
    setSearchQuery('');
  };

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
      dueDate: hasDate ? dueDate.toISOString() : undefined,
      alerts,
      sectionId,
      url: url || undefined,
      flagged: flagged || undefined,
      priority: priority !== 'none' ? priority : undefined,
      locationName: locationName || undefined,
      location: hasLocationAlert && locationLat !== null && locationLng !== null ? { lat: locationLat, lng: locationLng, radius: locationRadius, address: locationAddress } : undefined,
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
    setHasLocationAlert(false);
    setLocationLat(null);
    setLocationLng(null);
    setLocationRadius(100);
    setLocationAddress('');
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
            initial={{ opacity: 0, scale: 0.95, y: '100%' }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: '100%' }}
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
                  <CustomSelect 
                    className="detail-select"
                    value={category}
                    onChange={val => setCategory(val)}
                    options={[
                      ...(useAppStore.getState().lists?.map(list => ({ value: list.id, label: list.name })) || []),
                      { value: 'inbox', label: 'Bandeja de Entrada' }
                    ]}
                  />
                </div>
                
                <div className="divider"></div>
                
                <div className="detail-row" style={{ padding: '12px 0' }}>
                  <span className="detail-label">Tipo de Recordatorio</span>
                  <CustomSelect 
                    className="detail-select"
                    value={type}
                    onChange={val => setType(val as 'task' | 'log')}
                    options={[
                      { value: 'task', label: 'Acción (Checklist)' },
                      { value: 'log', label: 'Registro (Historial)' }
                    ]}
                  />
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
                      <CustomSelect
                        className="detail-select"
                        value={cycleId || ''}
                        onChange={val => setCycleId(val || undefined)}
                        options={[
                          { value: '', label: 'Nunca' },
                          ...cycles.map(c => ({ value: c.id, label: c.name }))
                        ]}
                      />
                    </div>
                    
                    <div className="divider"></div>
                    
                    <div className="detail-row" style={{ padding: '8px 0' }}>
                      <span className="detail-label">Sección de Lista</span>
                      <CustomSelect 
                        className="detail-select"
                        value={sectionId || ''}
                        onChange={async val => {
                          if (val === 'new') {
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
                            setSectionId(val || undefined);
                          }
                        }}
                        options={[
                          { value: '', label: 'Sin sección' },
                          ...availableSections.map(s => ({ value: s.id, label: s.name })),
                          { value: 'new', label: '+ Crear nueva sección' }
                        ]}
                      />
                    </div>

                    <div className="divider"></div>

                    {/* Ubicación Informativa */}
                    <div className="detail-row" style={{ padding: '8px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <MapPin size={18} color="var(--accent-blue)" />
                        <span className="detail-label" style={{ marginBottom: 0 }}>Información de Ubicación</span>
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
                          placeholder="Escribe la dirección, URL de Google Maps, etc..."
                          value={locationName === 'Dirección actual' ? '' : locationName}
                          onChange={e => setLocationName(e.target.value)}
                          style={{ width: '100%', textAlign: 'right', borderBottom: '1px solid var(--border-subtle)' }}
                        />
                      </div>
                    )}

                    <div className="divider"></div>

                    {/* Alerta de Aviso al Llegar */}
                    <div className="detail-row" style={{ padding: '8px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Clock size={18} color="var(--accent-red)" />
                        <span className="detail-label" style={{ marginBottom: 0 }}>Aviso al Llegar (Geocerca)</span>
                      </div>
                      <label className="switch">
                        <input type="checkbox" checked={hasLocationAlert} onChange={e => {
                          setHasLocationAlert(e.target.checked);
                          if (e.target.checked && locationLat === null) {
                            selectPresetLocation('current');
                          }
                        }} />
                        <span className="slider round"></span>
                      </label>
                    </div>
                    {hasLocationAlert && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px', background: 'var(--bg-surface)', borderRadius: 8, marginTop: -4, border: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                        
                        {/* Selector de Presets */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button 
                            type="button"
                            onClick={() => selectPresetLocation('current')}
                            style={{ 
                              flex: 1, minWidth: '70px', padding: '6px 4px', fontSize: '0.75rem', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border-subtle)',
                              background: selectedPreset === 'current' ? 'var(--accent-glow)' : 'transparent',
                              color: selectedPreset === 'current' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                              fontWeight: selectedPreset === 'current' ? 600 : 400
                            }}
                          >
                            📍 Actual
                          </button>
                          <button 
                            type="button"
                            onClick={() => selectPresetLocation('home')}
                            style={{ 
                              flex: 1, minWidth: '70px', padding: '6px 4px', fontSize: '0.75rem', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border-subtle)',
                              background: selectedPreset === 'home' ? 'var(--accent-glow)' : 'transparent',
                              color: selectedPreset === 'home' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                              fontWeight: selectedPreset === 'home' ? 600 : 400
                            }}
                          >
                            🏠 Casa
                          </button>
                          <button 
                            type="button"
                            onClick={() => selectPresetLocation('work')}
                            style={{ 
                              flex: 1, minWidth: '70px', padding: '6px 4px', fontSize: '0.75rem', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border-subtle)',
                              background: selectedPreset === 'work' ? 'var(--accent-glow)' : 'transparent',
                              color: selectedPreset === 'work' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                              fontWeight: selectedPreset === 'work' ? 600 : 400
                            }}
                          >
                            💼 Trabajo
                          </button>
                          <button 
                            type="button"
                            onClick={() => setSelectedPreset('custom')}
                            style={{ 
                              flex: 1, minWidth: '70px', padding: '6px 4px', fontSize: '0.75rem', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border-subtle)',
                              background: selectedPreset === 'custom' ? 'var(--accent-glow)' : 'transparent',
                              color: selectedPreset === 'custom' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                              fontWeight: selectedPreset === 'custom' ? 600 : 400
                            }}
                          >
                            🔍 Buscar
                          </button>
                        </div>

                        {/* Buscador de Nominatim si está seleccionado "custom" */}
                        {selectedPreset === 'custom' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <input 
                                type="text"
                                className="detail-select"
                                placeholder="Buscar dirección (ej: Mercadona, Sol, etc.)"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddressSearch();
                                  }
                                }}
                                style={{ flex: 1, padding: 6, borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'transparent' }}
                              />
                              <button 
                                type="button"
                                onClick={handleAddressSearch}
                                disabled={isSearching}
                                style={{ padding: '6px 12px', borderRadius: 6, background: 'var(--accent-glow)', color: 'var(--accent-primary)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                {isSearching ? '...' : <Search size={14} />}
                              </button>
                            </div>

                            {searchResults.length > 0 && (
                              <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '150px', overflowY: 'auto' }}>
                                {searchResults.map((res, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleSelectSearchResult(res)}
                                    style={{ width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 'none', borderBottom: idx < searchResults.length - 1 ? '1px solid var(--border-subtle)' : 'none', color: 'var(--text-primary)', fontSize: '0.8rem', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                  >
                                    {res.display_name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Detalle de la Ubicación Configurada */}
                        {locationLat !== null && locationLng !== null && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.8rem', borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                              <span style={{ fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.2 }}>
                                {locationAddress || 'Ubicación seleccionada'}
                              </span>
                              
                              {/* Botón para guardar ubicación actual como Casa / Trabajo */}
                              {(selectedPreset === 'current' || selectedPreset === 'custom') && (
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      saveHomeLocation({ lat: locationLat, lng: locationLng, address: locationAddress || 'Casa' });
                                      alert('Ubicación guardada como Casa');
                                    }}
                                    style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                                  >
                                    Guardar Casa
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      saveWorkLocation({ lat: locationLat, lng: locationLng, address: locationAddress || 'Trabajo' });
                                      alert('Ubicación guardada como Trabajo');
                                    }}
                                    style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                                  >
                                    Guardar Trab.
                                  </button>
                                </div>
                              )}
                            </div>
                            
                            <div style={{ display: 'flex', gap: 12, color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                              <span>Lat: {locationLat.toFixed(5)}</span>
                              <span>Lng: {locationLng.toFixed(5)}</span>
                            </div>

                            <div className="detail-row" style={{ padding: '4px 0', justifyContent: 'space-between', marginTop: 4 }}>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Radio de aviso</span>
                              <select 
                                className="detail-select"
                                value={locationRadius}
                                onChange={e => setLocationRadius(Number(e.target.value))}
                                style={{ width: 'auto', border: 'none', background: 'transparent', paddingRight: 4 }}
                              >
                                <option value={100}>100 metros</option>
                                <option value={250}>250 metros</option>
                                <option value={500}>500 metros</option>
                                <option value={1000}>1 kilómetro</option>
                              </select>
                            </div>
                          </div>
                        )}
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

                    <CustomSelect 
                      className="detail-select"
                      value=""
                      onChange={val => {
                        if (val && !blockedBy.includes(val)) {
                          setBlockedBy([...blockedBy, val]);
                        }
                      }}
                      placeholder="+ Añadir tarea bloqueadora (requisito)..."
                      options={[
                        { value: '', label: '+ Añadir tarea bloqueadora (requisito)...' },
                        ...availableTasks.filter(t => !blockedBy.includes(t.id)).map(t => ({ value: t.id, label: t.title }))
                      ]}
                    />
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
