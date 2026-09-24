import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';
import { parseNaturalLanguage } from '../../utils/nlp';
import { ConfirmModal } from '../ui/ConfirmModal';
import { isCaducidadesList } from '../../utils/specialLists';
import './TaskDrawer.css';

// Modular drawer subcomponents
import { DrawerHeaderSection } from './drawer/DrawerHeaderSection';
import { DrawerDateTimeSection } from './drawer/DrawerDateTimeSection';
import { DrawerRecurrenceSection } from './drawer/DrawerRecurrenceSection';
import { DrawerLocationSection } from './drawer/DrawerLocationSection';
import { DrawerRequirementsSection } from './drawer/DrawerRequirementsSection';
import { DrawerMetaSection } from './drawer/DrawerMetaSection';
import { DrawerFinanceSection } from './drawer/DrawerFinanceSection';
import { DrawerPeopleSection } from './drawer/DrawerPeopleSection';
import { DrawerExpirationSection } from './drawer/DrawerExpirationSection';

interface TaskDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategoryId?: string;
  defaultSectionId?: string;
  taskId?: string;
  initialFocus?: string;
}

export function TaskDrawer({ isOpen, onClose, defaultCategoryId, defaultSectionId, taskId, initialFocus }: TaskDrawerProps) {
  const addTask = useAppStore(state => state.addTask);
  const updateTask = useAppStore(state => state.updateTask);
  const deleteTask = useAppStore(state => state.deleteTask);
  const cycles = useAppStore(state => state.cycles);
  const lists = useAppStore(state => state.lists);
  const listSections = useAppStore(state => state.listSections);
  const addListSection = useAppStore(state => state.addListSection);
  
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
  
  // Card collapsible states (collapsed by default for clean learning curve)
  const [cardTimeOpen, setCardTimeOpen] = useState(false);
  const [cardRepeatOpen, setCardRepeatOpen] = useState(false);
  const [cardReqOpen, setCardReqOpen] = useState(false);
  const [cardDetailsOpen, setCardDetailsOpen] = useState(false);
  const [cardFinanceOpen, setCardFinanceOpen] = useState(false);
  const [cardCaducidadOpen, setCardCaducidadOpen] = useState(false);
  const [cardPeopleOpen, setCardPeopleOpen] = useState(false);

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

  const [showInlineInput, setShowInlineInput] = useState(false);
  const [inlineInputValue, setInlineInputValue] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmProps, setConfirmProps] = useState({ title: '', message: '', onConfirm: () => {} });
  const [toast, setToast] = useState<string | null>(null);
  
  const showAlert = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

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
  const [vibe, setVibe] = useState<string | undefined>(undefined);
  const [issuerMask, setIssuerMask] = useState<string>('');
  const [autoRollover, setAutoRollover] = useState<boolean>(true);
  const [subscriptionPeriod, setSubscriptionPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [managementUrl, setManagementUrl] = useState<string>('');

  // Suggested chips purely for visual feedback
  const [suggestedChips, setSuggestedChips] = useState<{ type: 'time' | 'date' | 'cycle' | 'priority' | 'category'; label: string }[]>([]);

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
        
        // Abrir inteligentemente solo las tarjetas que contienen datos relevantes o el foco solicitado
        setCardTimeOpen(
          initialFocus === 'duration' || initialFocus === 'date' || initialFocus === 'timeOfDay' ||
          Boolean(task.dueDate || task.alerts?.length || task.duration || task.timeOfDay)
        );
        setCardRepeatOpen(
          initialFocus === 'frequency' || initialFocus === 'location' ||
          Boolean(task.cycle_id || task.location)
        );
        setCardReqOpen(Boolean(task.blockedBy?.length));
        setCardDetailsOpen(Boolean(task.url || task.image || task.flagged || (task.priority && task.priority !== 'none')));
        setCardFinanceOpen(
          initialFocus === 'price' ||
          task.price !== undefined || Boolean(task.brand) || (task.quantity || 1) > 1
        );
        setCardCaducidadOpen(
          initialFocus === 'expiration' ||
          Boolean(task.expirationType) || isCaducidadesList(task.categoryId)
        );
        setCardPeopleOpen(
          initialFocus === 'people' ||
          Boolean(task.people?.length) || task.categoryId === 'que_he_hecho'
        );
      } else {
        // Reset defaults
        setTitle('');
        setNotes('');
        setDueDate(new Date());
        setCategory(defaultCategoryId || 'inbox');
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
        setSelectedPreset('current');
        setUrl('');
        setImage('');
        setIsDetailed(false);
        setPrice(undefined);
        setQuantity(1);
        setBrand('');
        setDuration('');
        const isCad = isCaducidadesList(defaultCategoryId);
        const isShopping = defaultCategoryId === 'compras' || defaultCategoryId?.toLowerCase().includes('compra');
        const isSub = defaultSectionId?.includes('suscrip');
        setHasDate(isCad || initialFocus === 'date');
        setHasTime(false);
        setPeople([]);
        setExpirationType(isCad ? (isSub ? 'subscription' : 'card') : undefined);
        setVibe(undefined);
        setIssuerMask('');
        setAutoRollover(true);
        setSubscriptionPeriod('monthly');
        
        // Al crear, mantener interfaz limpia salvo si se solicitó un foco específico
        setCardTimeOpen(initialFocus === 'duration' || initialFocus === 'date' || initialFocus === 'timeOfDay');
        setCardRepeatOpen(initialFocus === 'frequency' || initialFocus === 'location');
        setCardReqOpen(false);
        setCardDetailsOpen(false);
        setCardFinanceOpen(Boolean(isShopping) || initialFocus === 'price');
        setCardCaducidadOpen(isCad || initialFocus === 'expiration');
        setCardPeopleOpen(defaultCategoryId === 'que_he_hecho' || initialFocus === 'people');
        setCycleId(undefined);
        setTimeOfDay(undefined);
        setManagementUrl('');
      }
    }
  }, [isOpen, taskId, task, defaultCategoryId, defaultSectionId, initialFocus]);

  // Enfoque directo y desplazamiento al campo solicitado cuando el usuario pulsa para editarlo
  useEffect(() => {
    if (!isOpen || !initialFocus) return;

    const performFocus = () => {
      let targetEl: HTMLElement | null = null;
      if (initialFocus === 'duration') {
        targetEl = document.getElementById('drawer-duration-input') || document.querySelector('.drawer-duration-input');
      } else if (initialFocus === 'frequency') {
        targetEl = document.getElementById('drawer-recurrence-select') || document.getElementById('drawer-recurrence-row');
      } else if (initialFocus === 'date') {
        targetEl = document.getElementById('drawer-date-input') || document.querySelector('.drawer-date-input');
      } else if (initialFocus === 'price') {
        targetEl = document.getElementById('drawer-price-input') || document.querySelector('.drawer-price-input');
      } else if (initialFocus === 'people') {
        targetEl = document.getElementById('drawer-person-input') || document.querySelector('.drawer-person-input');
      } else if (initialFocus === 'location') {
        targetEl = document.getElementById('drawer-location-input') || document.querySelector('.drawer-location-input');
      } else if (initialFocus === 'expiration') {
        targetEl = document.getElementById('drawer-expiration-section');
      }

      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (targetEl instanceof HTMLInputElement || targetEl instanceof HTMLTextAreaElement || targetEl instanceof HTMLButtonElement) {
          targetEl.focus();
          if (targetEl instanceof HTMLInputElement && targetEl.type !== 'date') {
            targetEl.select();
          }
        }
        targetEl.classList.remove('apple-focus-pulse');
        void targetEl.offsetWidth;
        targetEl.classList.add('apple-focus-pulse');
        setTimeout(() => targetEl?.classList.remove('apple-focus-pulse'), 1600);
      }
    };

    const t1 = setTimeout(performFocus, 80);
    const t2 = setTimeout(performFocus, 220);
    const t3 = setTimeout(performFocus, 380);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isOpen, initialFocus, taskId]);

  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
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

  const availableTasks = Object.values(useAppStore(state => state.tasks)).filter(t => t.status === 'pending' && !t.deleted_at);

  useEffect(() => {
    if (title) {
      const nlp = parseNaturalLanguage(title);
      const newChips: { type: 'time' | 'date' | 'cycle' | 'priority' | 'category'; label: string }[] = [];
      
      if (nlp.times.length > 0) {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator && navigator.vibrate) navigator.vibrate(20);
        const newAlerts = nlp.times.filter(t => !alerts.find(a => a.time === t)).map(t => ({ id: `alert_${Date.now()}_${t}`, type: 'at_time' as const, time: t }));
        if (newAlerts.length > 0) {
          setAlerts(prev => [...prev, ...newAlerts]);
        }
        nlp.times.forEach(t => newChips.push({ type: 'time', label: t }));
      }

      if (nlp.suggestedDueDate) {
        setDueDate(nlp.suggestedDueDate);
        setHasDate(true);
        newChips.push({ type: 'date', label: nlp.suggestedDueDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }) });
      }

      if (nlp.suggestedCycleId) {
        setCycleId(nlp.suggestedCycleId);
        const cName = cycles.find(c => c.id === nlp.suggestedCycleId)?.name || 'Ciclo';
        newChips.push({ type: 'cycle', label: cName });
      }

      if (nlp.suggestedPriority) {
        setPriority(nlp.suggestedPriority);
        const prioLabel = nlp.suggestedPriority === 'high' ? 'Alta' : nlp.suggestedPriority === 'medium' ? 'Media' : 'Baja';
        newChips.push({ type: 'priority', label: prioLabel });
      }

      if (nlp.suggestedCategory) {
        newChips.push({ type: 'category', label: `@${nlp.suggestedCategory}` });
      }
      
      setSuggestedChips(newChips);
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
        setSelectedPreset('custom');
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
        setSelectedPreset('custom');
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
    if (!title.trim()) {
      if (taskId) {
        deleteTask(taskId);
        onClose();
      }
      return;
    }
    
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
      expirationType: expirationType || (isCaducidadesList(category) ? (sectionId?.includes('suscrip') ? 'subscription' : 'card') : undefined),
      vibe: vibe || undefined,
      issuerMask: issuerMask.trim() || undefined,
      autoRollover: expirationType === 'subscription' ? autoRollover : undefined,
      subscriptionPeriod: expirationType === 'subscription' ? subscriptionPeriod : undefined,
      managementUrl: managementUrl.trim() || undefined
    };

    if (taskId) {
      updateTask(taskId, payload);
      if (duration !== '' && duration !== task?.duration) {
        useAppStore.getState().setLearnedDuration(taskId, Number(duration));
      }
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

    if (isListening) return;

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

  const handleAddListSection = (name: string) => {
    const newId = crypto.randomUUID();
    addListSection({
      id: newId,
      listId: category,
      name
    });
    setSectionId(newId);
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
                <h3 id="drawer-title">{taskId ? 'Detalles' : 'Nuevo recordatorio'}</h3>
              </div>
              <button className="save-btn" onClick={handleSave} disabled={!title.trim()} aria-label={taskId ? 'Guardar cambios' : 'Guardar nueva tarea'}>
                {taskId ? 'Listo' : 'Añadir'}
              </button>
            </div>

            <div className="drawer-content" role="form" aria-labelledby="drawer-title" style={{ overflowY: 'auto', padding: '16px' }}>
              
              {/* Header: Title, Notes, Mic, NLP Chips, List & Type */}
              <DrawerHeaderSection
                taskId={taskId}
                task={task}
                title={title}
                setTitle={setTitle}
                notes={notes}
                setNotes={setNotes}
                isListening={isListening}
                toggleListening={toggleListening}
                suggestedChips={suggestedChips}
                category={category}
                setCategory={setCategory}
                type={type}
                setType={setType}
                lists={lists}
              />

              {/* Card 1: Fecha y Horarios */}
              <DrawerDateTimeSection
                cardTimeOpen={cardTimeOpen}
                setCardTimeOpen={setCardTimeOpen}
                hasDate={hasDate}
                setHasDate={setHasDate}
                dueDate={dueDate}
                setDueDate={setDueDate}
                hasTime={hasTime}
                setHasTime={setHasTime}
                alerts={alerts}
                setAlerts={setAlerts}
                timeOfDay={timeOfDay}
                setTimeOfDay={setTimeOfDay}
                category={category}
                expirationType={expirationType}
                duration={duration}
                setDuration={setDuration}
                removeAlert={removeAlert}
                addAnticipationAlert={addAnticipationAlert}
              />

              {/* Card 2: Repetición y Ubicación */}
              <DrawerRecurrenceSection
                cardRepeatOpen={cardRepeatOpen}
                setCardRepeatOpen={setCardRepeatOpen}
                cycleId={cycleId}
                setCycleId={setCycleId}
                cycles={cycles}
                sectionId={sectionId}
                setSectionId={setSectionId}
                category={category}
                listSections={listSections}
                showInlineInput={showInlineInput}
                setShowInlineInput={setShowInlineInput}
                inlineInputValue={inlineInputValue}
                setInlineInputValue={setInlineInputValue}
                onAddListSection={handleAddListSection}
              >
                <DrawerLocationSection
                  locationName={locationName}
                  setLocationName={setLocationName}
                  hasLocationAlert={hasLocationAlert}
                  setHasLocationAlert={setHasLocationAlert}
                  locationLat={locationLat}
                  locationLng={locationLng}
                  locationRadius={locationRadius}
                  setLocationRadius={setLocationRadius}
                  locationAddress={locationAddress}
                  selectedPreset={selectedPreset}
                  setSelectedPreset={setSelectedPreset}
                  selectPresetLocation={selectPresetLocation}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  handleAddressSearch={handleAddressSearch}
                  isSearching={isSearching}
                  searchResults={searchResults}
                  handleSelectSearchResult={handleSelectSearchResult}
                  saveHomeLocation={saveHomeLocation}
                  saveWorkLocation={saveWorkLocation}
                  showAlert={showAlert}
                />
              </DrawerRecurrenceSection>

              {/* Card 3: Requisitos / Dependencias */}
              <DrawerRequirementsSection
                cardReqOpen={cardReqOpen}
                setCardReqOpen={setCardReqOpen}
                blockedBy={blockedBy}
                setBlockedBy={setBlockedBy}
                availableTasks={availableTasks}
              />

              {/* Card 4: Detalles Adicionales */}
              <DrawerMetaSection
                cardDetailsOpen={cardDetailsOpen}
                setCardDetailsOpen={setCardDetailsOpen}
                priority={priority}
                setPriority={setPriority}
                flagged={flagged}
                setFlagged={setFlagged}
                url={url}
                setUrl={setUrl}
                image={image}
                setImage={setImage}
                targetCount={targetCount}
                setTargetCount={setTargetCount}
              />

              {/* Card 5: Modo Financiero (Costes) */}
              <DrawerFinanceSection
                cardFinanceOpen={cardFinanceOpen}
                setCardFinanceOpen={setCardFinanceOpen}
                isDetailed={isDetailed}
                setIsDetailed={setIsDetailed}
                price={price}
                setPrice={setPrice}
                quantity={quantity}
                setQuantity={setQuantity}
                brand={brand}
                setBrand={setBrand}
              />

              {/* Card Especial: Personas involucradas */}
              <DrawerPeopleSection
                cardPeopleOpen={cardPeopleOpen}
                setCardPeopleOpen={setCardPeopleOpen}
                people={people}
                setPeople={setPeople}
                personInput={personInput}
                setPersonInput={setPersonInput}
                vibe={vibe}
                setVibe={setVibe}
              />

              {/* Card Especial: Caducidades y Suscripciones */}
              <DrawerExpirationSection
                cardCaducidadOpen={cardCaducidadOpen}
                setCardCaducidadOpen={setCardCaducidadOpen}
                expirationType={expirationType}
                setExpirationType={setExpirationType}
                issuerMask={issuerMask}
                setIssuerMask={setIssuerMask}
                autoRollover={autoRollover}
                setAutoRollover={setAutoRollover}
                subscriptionPeriod={subscriptionPeriod}
                setSubscriptionPeriod={setSubscriptionPeriod}
                managementUrl={managementUrl}
                setManagementUrl={setManagementUrl}
              />

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
