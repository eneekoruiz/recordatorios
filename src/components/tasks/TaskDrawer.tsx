import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, Mic, MicOff, Settings2, Calendar as CalendarIcon, Repeat, Link2, PlusCircle, MapPin, ChevronDown, Search } from 'lucide-react';
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
import { ConfirmModal } from '../ui/ConfirmModal';
import { isCaducidadesList, isQueHeHechoList } from '../../utils/specialLists';

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
  const [cardRepeatOpen, setCardRepeatOpen] = useState(true);
  const [cardReqOpen, setCardReqOpen] = useState(true);
  const [cardDetailsOpen, setCardDetailsOpen] = useState(true);
  const [cardFinanceOpen, setCardFinanceOpen] = useState(true);
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

  const [showInlineInput, setShowInlineInput] = useState(false);
  const [inlineInputValue, setInlineInputValue] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmProps, setConfirmProps] = useState({ title: '', message: '', onConfirm: () => {} });
  const [toast, setToast] = useState<string | null>(null);
  
  const showAlert = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };
  const [searchResults, setSearchResults] = useState<{ lat: string; lon: string; display_name: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [image, setImage] = useState('');

  // Finance Fields
  const [isDetailed, setIsDetailed] = useState(false);
  const [price, setPrice] = useState<number | undefined>(undefined);
  const [quantity, setQuantity] = useState<number>(1);
  const [brand, setBrand] = useState('');
  const [duration, setDuration] = useState<number | ''>('');
  const [targetCount, setTargetCount] = useState<number | undefined>(undefined);
  const [currentCount, setCurrentCount] = useState<number | undefined>(undefined);
  const [timeOfDay, setTimeOfDay] = useState<'morning' | 'afternoon' | 'night' | undefined>(undefined);
  const [, setShowAdvanced] = useState(false);
  const [people, setPeople] = useState<string[]>([]);
  const [personInput, setPersonInput] = useState('');
  const [expirationType, setExpirationType] = useState<'card' | 'subscription' | 'other' | undefined>(undefined);
  const [cardCaducidadOpen, setCardCaducidadOpen] = useState(true);
  const [cardPeopleOpen, setCardPeopleOpen] = useState(true);
  const [vibe, setVibe] = useState<string | undefined>(undefined);
  const [issuerMask, setIssuerMask] = useState<string>('');
  const [autoRollover, setAutoRollover] = useState<boolean>(true);
  const [subscriptionPeriod, setSubscriptionPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [managementUrl, setManagementUrl] = useState<string>('');

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
        setTargetCount(task.targetCount);
        setCurrentCount(task.currentCount);
        setTimeOfDay(task.timeOfDay);
        setHasDate(!!task.dueDate);
        setHasTime(!!task.alerts?.some(a => a.type === 'at_time'));
        
        setPeople(task.people || []);
        const taskIsCad = isCaducidadesList(task.categoryId);
        const taskIsSub = task.sectionId?.includes('suscrip');
        setExpirationType(task.expirationType || (taskIsCad ? (taskIsSub ? 'subscription' : 'card') : undefined));
        setVibe(task.vibe);
        setIssuerMask(task.issuerMask || '');
        setAutoRollover(task.autoRollover ?? true);
        setSubscriptionPeriod(task.subscriptionPeriod || 'monthly');
        setManagementUrl(task.managementUrl || '');
        
        // Open cards dynamically if they have values configured
        setCardTimeOpen(!!task.dueDate || !!task.alerts?.some(a => a.type === 'at_time') || !!task.timeOfDay);
        setCardRepeatOpen(!!task.cycle_id || !!task.sectionId || !!task.locationName || !!task.location);
        setCardReqOpen(!!(task.blockedBy && task.blockedBy.length > 0));
        setCardDetailsOpen(task.priority !== 'none' || !!task.flagged || !!task.url || !!task.image || !!task.targetCount);
        setCardFinanceOpen(!!task.isDetailed || task.price !== undefined);
        setCardCaducidadOpen(taskIsCad || !!task.expirationType);
        setCardPeopleOpen(isQueHeHechoList(task.categoryId) || (!!task.people && task.people.length > 0) || !!task.vibe);
      } else {
        // Nueva tarea
        setTitle('');
        setNotes('');
        setCategory(defaultCategoryId || 'inbox');
        setSectionId(defaultSectionId);
        setCycleId(undefined);
        setTimeOfDay(undefined);
        setDueDate(new Date());
        setType('task');
        setAlerts([]);
        setBlockedBy([]);
        setSectionId(defaultSectionId);
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
        setPeople([]);
        const isCad = isCaducidadesList(defaultCategoryId);
        const isSub = defaultSectionId?.includes('suscrip');
        setExpirationType(isCad ? (isSub ? 'subscription' : 'card') : undefined);
        setVibe(undefined);
        setIssuerMask('');
        setAutoRollover(true);
        setSubscriptionPeriod('monthly');
        
        // Reset to default collapsed status on create
        setCardTimeOpen(true);
        setCardRepeatOpen(true);
        setCardReqOpen(true);
        setCardDetailsOpen(true);
        if (isCad) setCardCaducidadOpen(true);
        setCardFinanceOpen(true);
        setCardCaducidadOpen(isCad);
        setCardPeopleOpen(defaultCategoryId === 'que_he_hecho');
        setCycleId(undefined);
        setTimeOfDay(undefined);
        setManagementUrl('');
      }
    }
  }, [isOpen, taskId, task, defaultCategoryId, defaultSectionId]);

  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      // Allow click to pass through to the task but close the drawer
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        // Need a slight delay to ensure the event isn't swallowed by react tearing down the UI
        setTimeout(() => onClose(), 10);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const previousActiveElement = document.activeElement as HTMLElement | null;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        previousActiveElement.focus();
      }
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && defaultCategoryId) {
      setCategory(defaultCategoryId);
    }
  }, [isOpen, defaultCategoryId]);

  // Tareas disponibles para bloquear (no pueden ser la misma, y deben estar PENDING)
  const availableTasks = Object.values(useAppStore(state => state.tasks)).filter(t => t.status === 'pending' && !t.deleted_at);
  // Efecto NLP en tiempo real: Escucha el título y autocompleta horas, fechas, ciclos, prioridades y listas
  useEffect(() => {
    if (title) {
      const nlp = parseNaturalLanguage(title);
      const newChips: {type: 'time'|'date'|'cycle'|'priority'|'category', label: string}[] = [];
      
      // Manejar tiempos
      if (nlp.times.length > 0) {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator && navigator.vibrate) navigator.vibrate(20);
        const newAlerts = nlp.times.filter(t => !alerts.find(a => a.time === t)).map(t => ({ id: `alert_${Date.now()}_${t}`, type: 'at_time' as const, time: t }));
        if (newAlerts.length > 0) {
          setAlerts(prev => [...prev, ...newAlerts]);
        }
        nlp.times.forEach(t => newChips.push({ type: 'time', label: `⏰ ${t}` }));
      }
      
      // Manejar sugerencia de fecha
      if (nlp.suggestedDueDate) {
        setDueDate(nlp.suggestedDueDate);
        setHasDate(true);
        newChips.push({ type: 'date', label: `📅 ${nlp.suggestedDueDate.toLocaleDateString()}` });
      }

      // Manejar sugerencia de ciclo
      if (nlp.suggestedCycleId) {
        setCycleId(nlp.suggestedCycleId);
        const cName = cycles.find(c => c.id === nlp.suggestedCycleId)?.name || 'Ciclo';
        newChips.push({ type: 'cycle', label: `🔄 ${cName}` });
      }

      // Manejar prioridad
      if (nlp.suggestedPriority) {
        setPriority(nlp.suggestedPriority);
        const prioLabel = nlp.suggestedPriority === 'high' ? '🚨 Alta' : nlp.suggestedPriority === 'medium' ? '⚡ Media' : '🔵 Baja';
        newChips.push({ type: 'priority', label: prioLabel });
      }

      // Manejar categoría
      if (nlp.suggestedCategory) {
        newChips.push({ type: 'category', label: `@${nlp.suggestedCategory}` });
      }
      
      setSuggestedChips(newChips as any);
    } else {
      setSuggestedChips([]);
    }
  }, [title, alerts, cycles]);

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
      showAlert('La geolocalización no está soportada por tu navegador.');
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
        showAlert(`Error obteniendo coordenadas: ${err.message}`);
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
        setConfirmProps({
          title: 'Configurar Casa',
          message: 'No tienes configurada la ubicación de Casa. ¿Quieres obtener tu ubicación actual y guardarla como Casa?',
          onConfirm: () => {
            if (!navigator.geolocation) {
              showAlert('Geolocalización no soportada.');
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
              (err) => showAlert(`Error: ${err.message}`)
            );
          }
        });
        setIsConfirmOpen(true);
        setSelectedPreset('custom'); // reset preset visually until they confirm
      }
    } else if (preset === 'work') {
      if (workLocation) {
        setLocationLat(workLocation.lat);
        setLocationLng(workLocation.lng);
        setLocationAddress(workLocation.address);
      } else {
        setConfirmProps({
          title: 'Configurar Trabajo',
          message: 'No tienes configurada la ubicación de Trabajo. ¿Quieres obtener tu ubicación actual y guardarla como Trabajo?',
          onConfirm: () => {
            if (!navigator.geolocation) {
              showAlert('Geolocalización no soportada.');
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
              (err) => showAlert(`Error: ${err.message}`)
            );
          }
        });
        setIsConfirmOpen(true);
        setSelectedPreset('custom'); // reset preset visually until they confirm
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
      showAlert('Error al buscar dirección. Por favor inténtalo de nuevo.');
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
      timeOfDay: timeOfDay || undefined,
      url: url || undefined,
      flagged: flagged || undefined,
      priority: priority !== 'none' ? priority : undefined,
      locationName: locationName || undefined,
      location: hasLocationAlert && locationLat !== null && locationLng !== null ? { lat: locationLat, lng: locationLng, radius: locationRadius, address: locationAddress } : undefined,
      image: image || undefined,
      isDetailed,
      price: price !== undefined && price !== null && !isNaN(Number(price)) && Number(price) > 0 ? Number(price) : undefined,
      quantity: quantity !== undefined ? Number(quantity) : 1,
      brand: brand || undefined,
      duration: duration !== '' ? Number(duration) : undefined,
      targetCount: targetCount && targetCount > 1 ? Number(targetCount) : undefined,
      currentCount: targetCount && targetCount > 1 ? (currentCount || 0) : undefined,
      people: people.length > 0 ? people : undefined,
      expirationType: expirationType || (category === 'caducidades' ? (sectionId === 'sec_suscripciones' ? 'subscription' : 'card') : undefined),
      vibe: vibe || undefined,
      issuerMask: issuerMask.trim() || undefined,
      autoRollover: expirationType === 'subscription' ? autoRollover : undefined,
      subscriptionPeriod: expirationType === 'subscription' ? subscriptionPeriod : undefined,
      managementUrl: managementUrl.trim() || undefined
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
    setTargetCount(undefined);
    setCurrentCount(undefined);
    setPeople([]);
    setExpirationType(undefined);
    setVibe(undefined);
    setIssuerMask('');
    setAutoRollover(true);
    setSubscriptionPeriod('monthly');
    setManagementUrl('');
    onClose();
  };

  const removeAlert = (idToRemove: string) => {
    setAlerts(alerts.filter(a => a.id !== idToRemove));
  };

  const addAnticipationAlert = (offsetMinutes: number, label: string) => {
    setHasDate(true);
    setAlerts(prev => [
      ...prev,
      {
        id: `alert_ant_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'before',
        offsetMinutes,
        label
      }
    ]);
  };

  const toggleListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      showAlert('Tu navegador no soporta captura de voz nativa.');
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
    <>
    <AnimatePresence>
      {isOpen && (
        <div className="drawer-overlay" onClick={onClose}>
          <motion.div 
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
            key="drawer"
            layoutId={taskId ? "task-card-shell-" + taskId : undefined}
            initial={{ opacity: 0, scale: 0.95, y: '100%' }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: '100%' }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="drawer"
            onClick={(e) => e.stopPropagation()}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_e, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) {
                onClose();
              }
            }}
          >
            <div className="drawer-header" role="banner">
              <button className="cancel-btn" onClick={onClose} aria-label={taskId ? 'Cancelar edición' : 'Cancelar creación de tarea'}>Cancelar</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {taskId && (
                  <motion.div
                    layoutId={taskId ? "task-status-" + taskId : undefined}
                    style={{
                      width: 14, height: 14, borderRadius: '50%',
                      background: task?.status === 'completed' ? 'var(--accent-primary)' : 'transparent',
                      border: '2px solid ' + (task?.status === 'completed' ? 'var(--accent-primary)' : 'var(--border-color)')
                    }}
                  />
                )}
                <h3 id="drawer-title">{taskId ? 'Detalles de Tarea' : 'Nueva Tarea'}</h3>
              </div>
              <button className="save-btn" onClick={handleSave} disabled={!title.trim()} aria-label={taskId ? 'Guardar cambios' : 'Guardar nueva tarea'}>
                {taskId ? 'Aceptar' : 'Añadir'}
              </button>
            </div>

            <div className="drawer-content" role="form" aria-labelledby="drawer-title" style={{ overflowY: 'auto', padding: '16px' }}>
              
              <div className="input-group" style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <motion.input 
                    layoutId={taskId ? "task-title-" + taskId : undefined}
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
                          { id: 'morning', label: 'Mañana', icon: '🌅', color: '#FF9500' },
                          { id: 'afternoon', label: 'Tarde', icon: '☀️', color: '#007AFF' },
                          { id: 'night', label: 'Noche', icon: '🌙', color: '#AF52DE' }
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
                                background: isSelected ? `${item.color}18` : 'var(--bg-card, rgba(0,0,0,0.03))',
                                color: isSelected ? item.color : 'var(--text-secondary)',
                                border: isSelected ? `1.5px solid ${item.color}` : '1px solid var(--border-subtle)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <span style={{ fontSize: '0.95rem' }}>{item.icon}</span>
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
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                          ⚡ Alertas preventivas rápidas:
                        </span>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => addAnticipationAlert(30 * 24 * 60, '1 mes antes')}
                            style={{ padding: '4px 10px', fontSize: '0.76rem', borderRadius: 8, border: '1px solid rgba(255, 149, 0, 0.3)', background: 'rgba(255, 149, 0, 0.1)', color: '#ff9500', fontWeight: 600, cursor: 'pointer' }}
                          >
                            💳 + 1 mes antes
                          </button>
                          <button
                            type="button"
                            onClick={() => addAnticipationAlert(15 * 24 * 60, '15 días antes')}
                            style={{ padding: '4px 10px', fontSize: '0.76rem', borderRadius: 8, border: '1px solid rgba(255, 149, 0, 0.3)', background: 'rgba(255, 149, 0, 0.1)', color: '#ff9500', fontWeight: 600, cursor: 'pointer' }}
                          >
                            💳 + 15 días antes
                          </button>
                          <button
                            type="button"
                            onClick={() => addAnticipationAlert(3 * 24 * 60, '3 días antes')}
                            style={{ padding: '4px 10px', fontSize: '0.76rem', borderRadius: 8, border: '1px solid rgba(0, 122, 255, 0.3)', background: 'rgba(0, 122, 255, 0.1)', color: '#007aff', fontWeight: 600, cursor: 'pointer' }}
                          >
                            📱 + 3 días antes
                          </button>
                          <button
                            type="button"
                            onClick={() => addAnticipationAlert(1440, '1 día antes')}
                            style={{ padding: '4px 10px', fontSize: '0.76rem', borderRadius: 8, border: '1px solid rgba(0, 122, 255, 0.3)', background: 'rgba(0, 122, 255, 0.1)', color: '#007aff', fontWeight: 600, cursor: 'pointer' }}
                          >
                            📱 + 1 día antes
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  </motion.div>
                )}
                </AnimatePresence>
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
                <AnimatePresence>
                {cardRepeatOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ height: { duration: 0.3, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.2 } }} style={{ overflow: 'hidden' }}>
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
                        onChange={val => {
                          if (val === 'new') {
                            setShowInlineInput(true);
                            setInlineInputValue('');
                          } else {
                            setSectionId(val || undefined);
                          }
                        }}
                        options={[
                          { value: '', label: 'Sin sección' },
                          { value: 'new', label: '+ Crear nueva sección...' },
                          ...(useAppStore.getState().listSections
                              .filter(s => s.listId === category && !s.deleted_at)
                              .map(s => ({ value: s.id, label: s.name })))
                        ]}
                      />
                      
                      {showInlineInput && (
                        <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-subtle)', display: 'flex', gap: '8px', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>Nueva Sección</span>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input 
                              autoFocus
                              value={inlineInputValue} 
                              onChange={e => setInlineInputValue(e.target.value)} 
                              placeholder="Nombre de sección" 
                              style={{ flex: 1, padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', fontSize: '0.9rem' }}
                            />
                            <button 
                              onClick={() => {
                                if (inlineInputValue.trim()) {
                                  const newId = crypto.randomUUID();
                                  useAppStore.getState().addListSection({
                                    id: newId,
                                    listId: category,
                                    name: inlineInputValue.trim()
                                  });
                                  setSectionId(newId);
                                  setShowInlineInput(false);
                                }
                              }}
                              style={{ background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 12px', fontWeight: 600, cursor: 'pointer' }}
                            >
                              Guardar
                            </button>
                            <button 
                              onClick={() => setShowInlineInput(false)}
                              style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', padding: '6px 8px', cursor: 'pointer' }}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
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
                                      showAlert('Ubicación guardada como Casa');
                                    }}
                                    style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                                  >
                                    Guardar Casa
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      saveWorkLocation({ lat: locationLat, lng: locationLng, address: locationAddress || 'Trabajo' });
                                      showAlert('Ubicación guardada como Trabajo');
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
                  </motion.div>
                )}
                </AnimatePresence>
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
                <AnimatePresence>
                {cardReqOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ height: { duration: 0.3, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.2 } }} style={{ overflow: 'hidden' }}>
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
                  </motion.div>
                )}
                </AnimatePresence>
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

              {/* Card 5: Modo Financiero (Costes) */}
              {(category === 'inbox' || useAppStore.getState().lists.find(l => l.id === category)?.isFinancial || (task && task.price !== undefined)) && (
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
                  <AnimatePresence>
                  {cardFinanceOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ height: { duration: 0.3, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.2 } }} style={{ overflow: 'hidden' }}>
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
                            <span className="detail-label">Precio/Unidad (€)</span>
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
                    </motion.div>
                  )}
                  </AnimatePresence>
                </div>
              )}

              {/* Card Especial: Personas involucradas (Qué he hecho / Recuerdos) */}
              <div className="section-card">
                <button 
                  type="button"
                  className="section-card-header"
                  onClick={() => setCardPeopleOpen(!cardPeopleOpen)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>👥</span>
                    Personas involucradas ({people.length})
                  </span>
                  <ChevronDown size={18} style={{ transform: cardPeopleOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
                <AnimatePresence>
                {cardPeopleOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ height: { duration: 0.3, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.2 } }} style={{ overflow: 'hidden' }}>
                  <div className="section-card-content">
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: people.length > 0 ? 10 : 0 }}>
                      {people.map(p => (
                        <span 
                          key={p} 
                          style={{ 
                            display: 'inline-flex', alignItems: 'center', gap: 4, 
                            padding: '3px 10px', borderRadius: 12, fontSize: '0.8rem', fontWeight: 600,
                            background: 'rgba(88, 86, 214, 0.14)', color: '#5856d6', border: '1px solid rgba(88, 86, 214, 0.25)' 
                          }}
                        >
                          <span>👤 {p}</span>
                          <button
                            type="button"
                            onClick={() => setPeople(people.filter(x => x !== p))}
                            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                          >
                            <X size={13} />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <input
                        type="text"
                        placeholder="Nombre de la persona (ej. Laura, Carlos)..."
                        value={personInput}
                        onChange={e => setPersonInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = personInput.trim().replace(/^@/, '');
                            if (val && !people.includes(val)) {
                              setPeople([...people, val]);
                              setPersonInput('');
                            }
                          }
                        }}
                        style={{ flex: 1, padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', fontSize: '0.85rem', color: 'var(--text-primary)' }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const val = personInput.trim().replace(/^@/, '');
                          if (val && !people.includes(val)) {
                            setPeople([...people, val]);
                            setPersonInput('');
                          }
                        }}
                        style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: 'var(--accent-primary)', color: 'white', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                      >
                        Añadir
                      </button>
                    </div>

                    {/* Vibe / Estado de ánimo estilo Apple Journal */}
                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 650, color: 'var(--text-secondary)', marginBottom: 6 }}>
                        Vibe / Estado de Ánimo (Apple Journal)
                      </label>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {[
                          '✨ Especial',
                          '🏔️ Aventura',
                          '🎉 Celebración',
                          '💼 Logro',
                          '🍕 Relax',
                          '💪 Deporte',
                          '❤️ Familia'
                        ].map(v => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setVibe(vibe === v ? undefined : v)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 999,
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              border: vibe === v ? '1.5px solid #ff9500' : '1px solid var(--border-subtle)',
                              background: vibe === v ? 'rgba(255, 149, 0, 0.16)' : 'var(--bg-surface)',
                              color: vibe === v ? '#ff9500' : 'var(--text-secondary)',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  </motion.div>
                )}
                </AnimatePresence>
              </div>

              {/* Card Especial: Caducidades y Suscripciones */}
              <div className="section-card">
                <button 
                  type="button"
                  className="section-card-header"
                  onClick={() => setCardCaducidadOpen(!cardCaducidadOpen)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14 }}>💳</span>
                    Tipo de Caducidad {expirationType ? `(${expirationType === 'card' ? 'Tarjeta' : expirationType === 'subscription' ? 'Suscripción' : 'Otro'})` : ''}
                  </span>
                  <ChevronDown size={18} style={{ transform: cardCaducidadOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
                <AnimatePresence>
                {cardCaducidadOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ height: { duration: 0.3, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.2 } }} style={{ overflow: 'hidden' }}>
                  <div className="section-card-content">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setExpirationType(expirationType === 'card' ? undefined : 'card')}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 6px',
                          borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s ease',
                          background: expirationType === 'card' ? 'rgba(255, 149, 0, 0.16)' : 'var(--bg-surface)',
                          border: expirationType === 'card' ? '1.5px solid #ff9500' : '1px solid var(--border-subtle)',
                          color: expirationType === 'card' ? '#ff9500' : 'var(--text-secondary)',
                          fontWeight: expirationType === 'card' ? 600 : 400
                        }}
                      >
                        <span style={{ fontSize: '1.2rem' }}>💳</span>
                        <span style={{ fontSize: '0.78rem' }}>Tarjeta / Doc</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpirationType(expirationType === 'subscription' ? undefined : 'subscription')}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 6px',
                          borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s ease',
                          background: expirationType === 'subscription' ? 'rgba(0, 122, 255, 0.16)' : 'var(--bg-surface)',
                          border: expirationType === 'subscription' ? '1.5px solid #007aff' : '1px solid var(--border-subtle)',
                          color: expirationType === 'subscription' ? '#007aff' : 'var(--text-secondary)',
                          fontWeight: expirationType === 'subscription' ? 600 : 400
                        }}
                      >
                        <span style={{ fontSize: '1.2rem' }}>📱</span>
                        <span style={{ fontSize: '0.78rem' }}>Suscripción</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpirationType(expirationType === 'other' ? undefined : 'other')}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 6px',
                          borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s ease',
                          background: expirationType === 'other' ? 'rgba(142, 142, 147, 0.16)' : 'var(--bg-surface)',
                          border: expirationType === 'other' ? '1.5px solid #8e8e93' : '1px solid var(--border-subtle)',
                          color: expirationType === 'other' ? 'var(--text-primary)' : 'var(--text-secondary)',
                          fontWeight: expirationType === 'other' ? 600 : 400
                        }}
                      >
                        <span style={{ fontSize: '1.2rem' }}>📋</span>
                        <span style={{ fontSize: '0.78rem' }}>Otro</span>
                      </button>
                    </div>

                    {/* Tarjeta / Documento: Campo de Emisor/Identificador estilo Apple Wallet */}
                    {expirationType === 'card' && (
                      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 650, color: 'var(--text-secondary)', marginBottom: 6 }}>
                          Identificador / Tarjeta (Apple Wallet)
                        </label>
                        <input
                          type="text"
                          value={issuerMask}
                          onChange={e => setIssuerMask(e.target.value)}
                          placeholder="ej. VISA •• 4821, DNI, Revolut..."
                          style={{
                            width: '100%',
                            padding: '7px 12px',
                            borderRadius: 8,
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-surface)',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem'
                          }}
                        />
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                          {['VISA', 'Mastercard', 'DNI', 'Pasaporte', 'Carnet', 'Revolut'].map(preset => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setIssuerMask(issuerMask ? `${preset} ${issuerMask.replace(/^(VISA|Mastercard|DNI|Pasaporte|Carnet|Revolut)\s*/i, '')}` : preset)}
                              style={{
                                padding: '2px 8px',
                                borderRadius: 6,
                                border: '1px solid var(--border-subtle)',
                                background: 'var(--bg-elevated)',
                                fontSize: '0.72rem',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer'
                              }}
                            >
                              +{preset}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Suscripción: Auto-rollover y periodicidad */}
                    {expirationType === 'subscription' && (
                      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 650, color: 'var(--text-primary)' }}>
                            Renovación automática (Auto-rollover)
                          </span>
                          <input
                            type="checkbox"
                            checked={autoRollover}
                            onChange={e => setAutoRollover(e.target.checked)}
                            style={{ cursor: 'pointer', width: 16, height: 16 }}
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                            Periodicidad de cobro:
                          </span>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              type="button"
                              onClick={() => setSubscriptionPeriod('monthly')}
                              style={{
                                padding: '3px 10px',
                                borderRadius: 6,
                                border: subscriptionPeriod === 'monthly' ? '1.5px solid #007aff' : '1px solid var(--border-subtle)',
                                background: subscriptionPeriod === 'monthly' ? 'rgba(0, 122, 255, 0.12)' : 'var(--bg-surface)',
                                color: subscriptionPeriod === 'monthly' ? '#007aff' : 'var(--text-secondary)',
                                fontSize: '0.76rem',
                                fontWeight: subscriptionPeriod === 'monthly' ? 700 : 500,
                                cursor: 'pointer'
                              }}
                            >
                              Mensual
                            </button>
                            <button
                              type="button"
                              onClick={() => setSubscriptionPeriod('yearly')}
                              style={{
                                padding: '3px 10px',
                                borderRadius: 6,
                                border: subscriptionPeriod === 'yearly' ? '1.5px solid #007aff' : '1px solid var(--border-subtle)',
                                background: subscriptionPeriod === 'yearly' ? 'rgba(0, 122, 255, 0.12)' : 'var(--bg-surface)',
                                color: subscriptionPeriod === 'yearly' ? '#007aff' : 'var(--text-secondary)',
                                fontSize: '0.76rem',
                                fontWeight: subscriptionPeriod === 'yearly' ? 700 : 500,
                                cursor: 'pointer'
                              }}
                            >
                              Anual
                            </button>
                          </div>
                        </div>

                        {/* Enlace para gestionar o cancelar suscripción */}
                        <div style={{ marginTop: 4 }}>
                          <label style={{ display: 'block', fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: 5 }}>
                            🔗 Enlace para gestionar o cancelar suscripción:
                          </label>
                          <input
                            type="url"
                            value={managementUrl}
                            onChange={e => setManagementUrl(e.target.value)}
                            placeholder="https://netflix.com/youraccount, spotify.com..."
                            style={{
                              width: '100%',
                              padding: '7px 10px',
                              borderRadius: 8,
                              border: '1px solid var(--border-subtle)',
                              background: 'var(--bg-surface)',
                              color: 'var(--text-primary)',
                              fontSize: '0.82rem'
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  </motion.div>
                )}
                </AnimatePresence>
              </div>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
    <ConfirmModal 
      isOpen={isConfirmOpen}
      title={confirmProps.title}
      message={confirmProps.message}
      onConfirm={() => { confirmProps.onConfirm(); setIsConfirmOpen(false); }}
      onCancel={() => setIsConfirmOpen(false)}
    />
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 50, x: "-50%", scale: 0.9 }}
          animate={{ opacity: 1, y: 0, x: "-50%", scale: 1 }}
          exit={{ opacity: 0, y: 20, x: "-50%", scale: 0.9 }}
          drag="x"
          dragConstraints={{ left: -100, right: 100 }}
          onDragEnd={(_, info) => { if (Math.abs(info.offset.x) > 50) setToast(null); }}
          style={{
            position: 'fixed', bottom: 'env(safe-area-inset-bottom, 24px)', left: '50%',
            background: 'var(--bg-elevated)', color: 'var(--text-primary)', padding: '12px 16px',
            borderRadius: '999px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', zIndex: 99999,
            fontWeight: 500, fontSize: '0.9rem', border: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', minWidth: 260, boxSizing: 'border-box'
          }}
        >
          <span>{toast}</span>
          <button
            onClick={() => setToast(null)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', padding: 4 }}
            title="Cerrar"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
    </>,
    document.body
  );
}
