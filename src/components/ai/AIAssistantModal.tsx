import { useState, useRef, useEffect, useEffectEvent } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, X, ArrowUp, Check, Bot, User, Settings, Mic, MicOff,
  Calendar, CheckCircle2, Volume2, VolumeX,
  Sunrise, Sun, Moon, Repeat, MapPin,
  CalendarRange, Luggage, ShoppingCart, SprayCan,
  Paperclip, FileText, Loader2, AlertCircle, HelpCircle, CheckCircle,
  Edit3, Trash2
} from 'lucide-react';
import { AIService, type ProposedBatch, type AIConfig } from '../../services/AIService';
import { useAppStore } from '../../store/useAppStore';
import { SoundService } from '../../services/SoundService';
import { HapticService } from '../../services/HapticService';
import { extractTextFromPdf } from '../../utils/pdfExtractor';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectView?: (view: string) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  fileName?: string;
  batch?: ProposedBatch;
  timestamp: string;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome_1',
  sender: 'assistant',
  text: '¡Hola! Soy tu asistente de Recordatorios con IA. Puedes hablarme, escribirme o adjuntar cualquier documento (PDF, CSV, TXT) en lenguaje natural y prepararé todos los recordatorios para importarlos al instante.',
  timestamp: '',
};

export function AIAssistantModal({ isOpen, onClose, onSelectView }: AIAssistantModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState<AIConfig>(() => AIService.getConfig());
  const [tempApiKey, setTempApiKey] = useState(config.apiKey || '');
  const [tempProvider, setTempProvider] = useState(config.provider);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  // El dictado depende del navegador: se sabe desde el primer render.
  const [speechSupported] = useState(() =>
    typeof window !== 'undefined' && Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
  );

  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    size: number;
    text: string;
    type: string;
  } | null>(null);
  const [isExtractingFile, setIsExtractingFile] = useState(false);
  const [isDraggingChat, setIsDraggingChat] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const lists = useAppStore(state => state.lists);
  const tasks = useAppStore(state => state.tasks);
  const addTask = useAppStore(state => state.addTask);
  const updateTask = useAppStore(state => state.updateTask);
  const deleteTask = useAppStore(state => state.deleteTask);
  const nestTask = useAppStore(state => state.nestTask);
  const addTasksBatch = useAppStore(state => state.addTasksBatch);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Continuous Speech Recognition if supported
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'es-ES';

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = 0; i < event.results.length; ++i) {
          currentTranscript += (currentTranscript ? ' ' : '') + event.results[i][0].transcript.trim();
        }
        if (currentTranscript.trim()) {
          setInput(currentTranscript.trim());
        }
      };

      recognition.onerror = (err: any) => {
        console.warn('Speech recognition status:', err);
        setIsListening(false);
      };
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleVoiceInput = () => {
    if (!speechSupported || !recognitionRef.current) return;
    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn(e);
      }
      setIsListening(false);
      HapticService.selection();
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        HapticService.impact('medium');
      } catch (err) {
        console.error('Speech error:', err);
      }
    }
  };

  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);

  const toggleSpeak = (msgId: string, text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*_#`~✓✅]/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'es-ES';
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const esVoice = voices.find(v => v.lang.startsWith('es'));
    if (esVoice) utterance.voice = esVoice;

    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);

    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
    HapticService.selection();
  };

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Sin conversación, el asistente saluda (el saludo pasa a la conversación al escribir).
  const shownMessages = messages.length > 0 ? messages : [WELCOME_MESSAGE];

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const processAttachedFile = async (file: File) => {
    setIsExtractingFile(true);
    try {
      let text = '';
      if (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') {
        text = await extractTextFromPdf(file);
      } else {
        text = await file.text();
      }

      if (!text.trim()) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: 'El archivo está vacío o no contiene texto legible.' }));
        return;
      }

      setAttachedFile({
        name: file.name,
        size: file.size,
        text,
        type: file.type || 'text/plain'
      });
      HapticService.selection();
      window.dispatchEvent(new CustomEvent('show-toast', { detail: `Documento "${file.name}" adjuntado.` }));
    } catch (err: any) {
      console.error('Error al procesar archivo:', err);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: `Error al leer archivo: ${err.message || 'Desconocido'}` }));
    } finally {
      setIsExtractingFile(false);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const rawText = (textToSend || input).trim();
    if ((!rawText && !attachedFile) || loading || isExtractingFile) return;

    const userDisplayTitle = rawText || `Analizar y estructurar recordatorios de "${attachedFile?.name}"`;
    const fileName = attachedFile?.name;

    // Construct prompt for AI
    let fullPrompt = rawText;
    if (attachedFile) {
      if (fullPrompt) {
        fullPrompt = `${fullPrompt}\n\n[Documento adjunto: ${attachedFile.name}]\n${attachedFile.text}`;
      } else {
        fullPrompt = `Por favor, extrae, organiza y estructura todos los recordatorios y tareas detectadas en este documento adjunto (${attachedFile.name}):\n\n${attachedFile.text}`;
      }
    }

    const userMsg: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      sender: 'user',
      text: userDisplayTitle,
      fileName,
      timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...(prev.length > 0 ? prev : [WELCOME_MESSAGE]), userMsg]);
    setInput('');
    setAttachedFile(null);
    setLoading(true);
    HapticService.impact('light');

    try {
      const history = shownMessages.map(m => ({
        role: m.sender,
        text: m.text
      }));

      const batch = await AIService.processPrompt(fullPrompt, lists, history, tasks);

      const aiMsg: ChatMessage = {
        id: `msg_ai_${Date.now()}`,
        sender: 'assistant',
        text: batch.reply,
        batch,
        timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, aiMsg]);
      SoundService.playPop();
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `msg_err_${Date.now()}`,
          sender: 'assistant',
          text: `Ocurrió un inconveniente: ${err.message || 'No se pudo procesar la solicitud'}.`,
          timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Lo que llega desde la barra rápida (✨) se envía al abrir el asistente. Se atiende en el
  // propio evento que lo abre, no en un efecto que dependa de «isOpen».
  const askFromOutside = useEffectEvent((text: string) => {
    handleSend(text);
  });
  useEffect(() => {
    const onOpen = (event: Event) => {
      const text = (event as CustomEvent<string | undefined>).detail;
      if (typeof text === 'string' && text.trim()) askFromOutside(text);
    };
    window.addEventListener('open-ai-assistant', onOpen);
    return () => window.removeEventListener('open-ai-assistant', onOpen);
  }, []);

  const handleToggleTaskSelected = (messageId: string, taskId: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId || !m.batch) return m;
      return {
        ...m,
        batch: {
          ...m.batch,
          tasks: m.batch.tasks.map(t => t.id === taskId ? { ...t, selected: !t.selected } : t)
        }
      };
    }));
  };

  const handleToggleAllTasks = (messageId: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId || !m.batch) return m;
      const allSelected = m.batch.tasks.every(t => t.selected);
      return {
        ...m,
        batch: {
          ...m.batch,
          tasks: m.batch.tasks.map(t => ({ ...t, selected: !allSelected }))
        }
      };
    }));
  };

  const handleImportBatch = (messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg || !msg.batch) return;

    const selectedTasks = msg.batch.tasks.filter(t => t.selected);
    if (selectedTasks.length === 0) return;

    let targetListToCreate: any = undefined;
    if (msg.batch.suggestedList) {
      const suggestedName = msg.batch.suggestedList.name || '';
      const existing = lists.find(l => (l.name || '').toLowerCase() === suggestedName.toLowerCase());
      if (!existing) {
        targetListToCreate = {
          id: `list_${Date.now()}`,
          name: msg.batch.suggestedList.name,
          color: msg.batch.suggestedList.color || '#007aff',
          icon: msg.batch.suggestedList.icon || 'list',
          created_at: new Date().toISOString()
        };
      }
    }

    const tasksPayload = selectedTasks.map(t => {
      let finalCatId = t.listId;
      if (t.listId === 'que_he_hecho' || t.listId === 'caducidades') {
        finalCatId = t.listId;
      } else if (targetListToCreate) {
        finalCatId = targetListToCreate.id;
      } else if (!finalCatId || !lists.some(l => l.id === finalCatId)) {
        finalCatId = lists[0]?.id || 'inbox';
      }

      return {
        id: crypto.randomUUID(),
        title: t.title,
        description: t.description,
        categoryId: finalCatId,
        dueDate: t.dueDate,
        timeOfDay: t.timeOfDay,
        price: t.price,
        quantity: t.quantity,
        priority: t.priority || 'none',
        cycle_id: t.cycle,
        people: t.people,
        vibe: t.vibe,
        locationName: t.locationName,
        status: 'pending' as const,
        created_at: new Date().toISOString()
      };
    });

    addTasksBatch(tasksPayload, { createList: targetListToCreate });
    SoundService.playComplete();
    HapticService.notification('success');

    // Notify user
    const listName = targetListToCreate?.name || lists.find(l => l.id === tasksPayload[0]?.categoryId)?.name || 'Inbox';
    window.dispatchEvent(new CustomEvent('show-toast', { 
      detail: `${tasksPayload.length} recordatorios importados a "${listName}"`
    }));

    // Mark as imported in message
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId || !m.batch) return m;
      return {
        ...m,
        batch: {
          ...m.batch,
          tasks: []
        },
        text: `${m.text}\n\n¡${tasksPayload.length} recordatorios importados con éxito!`
      };
    }));

    // If a new list was created or special list was specified, navigate
    if (targetListToCreate && onSelectView) {
      onSelectView(`list_${targetListToCreate.id}`);
    } else if (tasksPayload[0]?.categoryId === 'que_he_hecho' && onSelectView) {
      onSelectView('list_que_he_hecho');
    }

    onClose();
  };

  const handleUpdateActionParentTitle = (messageId: string, title: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId || !m.batch?.action) return m;
      return {
        ...m,
        batch: {
          ...m.batch,
          action: {
            ...m.batch.action,
            parentTitle: title
          }
        }
      };
    }));
  };

  const handleToggleActionChild = (messageId: string, childId: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId || !m.batch?.action) return m;
      return {
        ...m,
        batch: {
          ...m.batch,
          action: {
            ...m.batch.action,
            children: m.batch.action.children.map(c => c.id === childId ? { ...c, selected: !c.selected } : c)
          }
        }
      };
    }));
  };

  const handleExecuteGroupAction = (messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg || !msg.batch?.action) return;

    const { parentTitle, listId, listName, children } = msg.batch.action;
    const selectedChildren = children.filter(c => c.selected);
    if (selectedChildren.length === 0) return;

    let finalCatId = listId;
    if (!finalCatId) {
      const foundList = lists.find(l => (l.name || '').toLowerCase() === (listName || '').toLowerCase());
      finalCatId = foundList?.id || lists[0]?.id || 'inbox';
    }

    const parentTaskId = crypto.randomUUID();
    addTask({
      id: parentTaskId,
      title: parentTitle.trim(),
      categoryId: finalCatId,
      status: 'pending',
      created_at: new Date().toISOString()
    });

    selectedChildren.forEach(child => {
      if (child.isExisting) {
        nestTask(child.id, parentTaskId);
      } else {
        addTask({
          id: child.id.startsWith('ai_child_') ? crypto.randomUUID() : child.id,
          title: child.title,
          parentId: parentTaskId,
          categoryId: finalCatId,
          status: 'pending',
          price: child.price,
          created_at: new Date().toISOString()
        });
      }
    });

    SoundService.playComplete();
    HapticService.notification('success');

    const targetListName = lists.find(l => l.id === finalCatId)?.name || listName || 'tu lista';
    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: `Tarea madre "${parentTitle}" creada con ${selectedChildren.length} subtareas en ${targetListName}`
    }));

    setMessages(prev => prev.map(m => {
      if (m.id !== messageId || !m.batch) return m;
      return {
        ...m,
        batch: {
          ...m.batch,
          action: undefined
        },
        text: `${m.text}\n\n✨ ¡Acción completada con éxito! He unificado los ${selectedChildren.length} productos dentro de "${parentTitle}" en la lista ${targetListName}.`
      };
    }));

    if (onSelectView) {
      onSelectView(`list_${finalCatId}`);
    }

    onClose();
  };

  const handleToggleTaskUpdateSelected = (messageId: string, taskId: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId || !m.batch?.taskUpdates) return m;
      return {
        ...m,
        batch: {
          ...m.batch,
          taskUpdates: m.batch.taskUpdates.map(u => u.taskId === taskId ? { ...u, selected: !u.selected } : u)
        }
      };
    }));
  };

  const handleToggleAllTaskUpdates = (messageId: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId || !m.batch?.taskUpdates) return m;
      const allSelected = m.batch.taskUpdates.every(u => u.selected);
      return {
        ...m,
        batch: {
          ...m.batch,
          taskUpdates: m.batch.taskUpdates.map(u => ({ ...u, selected: !allSelected }))
        }
      };
    }));
  };

  const handleApplyTaskUpdates = (messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg || !msg.batch?.taskUpdates) return;

    const selectedUpdates = msg.batch.taskUpdates.filter(u => u.selected);
    if (selectedUpdates.length === 0) return;

    selectedUpdates.forEach(update => {
      if (update.deleted) {
        deleteTask(update.taskId);
      } else {
        const patch: any = {};
        if (update.status) patch.status = update.status;
        if (update.newTitle) patch.title = update.newTitle;
        if (update.description !== undefined) patch.description = update.description;
        if (update.price !== undefined) patch.price = update.price;
        if (update.dueDate !== undefined) patch.dueDate = update.dueDate;
        if (update.timeOfDay) patch.timeOfDay = update.timeOfDay;
        if (update.priority) patch.priority = update.priority;
        if (update.listId) patch.categoryId = update.listId;
        if (update.cycle) patch.cycle_id = update.cycle;
        updateTask(update.taskId, patch);
      }
    });

    SoundService.playComplete();
    HapticService.notification('success');
    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: `✓ ${selectedUpdates.length} modificación(es) aplicada(s) correctamente.`
    }));

    setMessages(prev => prev.map(m => {
      if (m.id !== messageId || !m.batch) return m;
      return {
        ...m,
        batch: {
          ...m.batch,
          taskUpdates: []
        },
        text: `${m.text}\n\n✅ ¡${selectedUpdates.length} modificación(es) aplicada(s) con éxito!`
      };
    }));
  };

  const handleTestConnection = async () => {
    if (!tempApiKey.trim()) {
      setTestResult({ ok: false, message: 'Introduce una clave de API primero' });
      return;
    }
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await AIService.testGeminiConnection(tempApiKey);
      if (res.ok) {
        setTestResult({ ok: true, message: `Conexión exitosa con ${res.model || 'Gemini'}` });
      } else {
        setTestResult({ ok: false, message: res.error || 'Error de conexión' });
      }
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message || 'Error de red' });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveSettings = () => {
    const updated: AIConfig = {
      provider: tempProvider,
      apiKey: tempApiKey.trim() || undefined
    };
    setConfig(updated);
    AIService.saveConfig(updated);
    setShowSettings(false);
    HapticService.impact('medium');
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div 
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--scrim)',
          }}
        />

        {/* Modal Window */}
        <motion.div
          className="ai-assistant-modal"
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ type: 'spring', damping: 28, stiffness: 420 }}
          onClick={e => e.stopPropagation()}
          onDragOver={(e) => {
            e.preventDefault();
            if (!isDraggingChat) setIsDraggingChat(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setIsDraggingChat(false);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDraggingChat(false);
            const file = e.dataTransfer.files?.[0];
            if (file) {
              processAttachedFile(file);
            }
          }}
          style={{ position: 'relative' }}
        >
          {/* Visual Drag Overlay */}
          {isDraggingChat && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0, 122, 255, 0.1)',
              border: '2px dashed var(--accent-primary)',
              borderRadius: 20,
              zIndex: 60,
              pointerEvents: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              backdropFilter: 'blur(4px)'
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: 'var(--accent-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 4px 16px rgba(0, 122, 255, 0.4)'
              }}>
                <FileText size={26} />
              </div>
              <span style={{ fontSize: '0.96rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Suelta el documento aquí para extraer los recordatorios
              </span>
              <span style={{ fontSize: '0.80rem', color: 'var(--text-tertiary)' }}>
                Compatible con PDF, CSV, TXT, MD y JSON
              </span>
            </div>
          )}

          {/* iOS sheet grab handle (visible en móvil) */}
          <div className="mobile-sheet-handle" style={{ display: 'none', justifyContent: 'center', paddingTop: 8, paddingBottom: 4, background: 'var(--bg-surface)' }}>
            <div style={{ width: 36, height: 4.5, borderRadius: 3, background: 'var(--text-tertiary)', opacity: 0.35 }} />
          </div>

          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'linear-gradient(135deg, #007aff, #af52de)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 3px 10px rgba(0, 122, 255, 0.35)'
              }}>
                <Sparkles size={18} color="white" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                  Asistente IA
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {config.provider === 'auto' ? 'Extractor Inteligente Local (MCP Ready)' : config.provider === 'gemini' ? 'Google Gemini LLM' : 'OpenAI GPT'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => setShowSettings(!showSettings)}
                style={{
                  background: showSettings ? 'var(--bg-hover)' : 'transparent',
                  border: 'none',
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  transition: 'all 0.15s ease'
                }}
                title="Ajustes de IA / Proveedor"
              >
                <Settings size={18} />
              </button>

              <button
                onClick={onClose}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '50%',
                  width: 30,
                  height: 30,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  transition: 'all 0.15s ease'
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Settings Overlay Drawer */}
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{
                  background: 'var(--bg-card)',
                  borderBottom: '1px solid var(--border-subtle)',
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  overflow: 'hidden'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 650, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Configurar Motor de IA</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>MCP Server activo en /api/mcp</span>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {(['auto', 'gemini', 'openai'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setTempProvider(p)}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: 10,
                        border: tempProvider === p ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                        background: tempProvider === p ? 'var(--accent-glow)' : 'var(--bg-surface)',
                        color: tempProvider === p ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        fontSize: '0.82rem',
                        fontWeight: tempProvider === p ? 700 : 500,
                        cursor: 'pointer'
                      }}
                    >
                      {p === 'auto' ? 'Local (Zero-Config)' : p === 'gemini' ? 'Google Gemini' : 'OpenAI'}
                    </button>
                  ))}
                </div>

                {tempProvider !== 'auto' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        Clave API ({tempProvider === 'gemini' ? 'Gemini API Key' : 'OpenAI API Key'}):
                      </label>
                      {tempProvider === 'gemini' && (
                        <button
                          type="button"
                          onClick={handleTestConnection}
                          disabled={testingConnection || !tempApiKey.trim()}
                          style={{
                            background: 'var(--accent-glow)',
                            color: 'var(--accent-primary)',
                            border: '1px solid var(--accent-primary)',
                            borderRadius: 6,
                            padding: '2px 8px',
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            cursor: (!tempApiKey.trim() || testingConnection) ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            opacity: (!tempApiKey.trim() || testingConnection) ? 0.6 : 1
                          }}
                        >
                          {testingConnection ? (
                            <>
                              <Loader2 size={11} className="animate-spin" />
                              <span>Probando...</span>
                            </>
                          ) : (
                            <span>Probar conexión</span>
                          )}
                        </button>
                      )}
                    </div>
                    <input
                      type="password"
                      value={tempApiKey}
                      onChange={e => {
                        const val = e.target.value;
                        setTempApiKey(val);
                        setTestResult(null);
                        if (val.startsWith('AIza') && tempProvider !== 'gemini') {
                          setTempProvider('gemini');
                        }
                      }}
                      placeholder={tempProvider === 'gemini' ? 'AIzaSy...' : 'sk-...'}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-surface)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem'
                      }}
                    />
                    {testResult && (
                      <div style={{
                        marginTop: 6,
                        padding: '6px 10px',
                        borderRadius: 6,
                        fontSize: '0.78rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        background: testResult.ok ? 'rgba(52, 199, 89, 0.12)' : 'rgba(255, 59, 48, 0.12)',
                        color: testResult.ok ? '#34c759' : '#ff3b30',
                        border: `1px solid ${testResult.ok ? 'rgba(52, 199, 89, 0.3)' : 'rgba(255, 59, 48, 0.3)'}`
                      }}>
                        {testResult.ok ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                        <span>{testResult.message}</span>
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                  <button
                    onClick={() => setShowSettings(false)}
                    style={{ padding: '6px 14px', borderRadius: 8, background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveSettings}
                    style={{ padding: '6px 16px', borderRadius: 8, background: 'var(--accent-primary)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                  >
                    Guardar
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Chat Messages Area */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}>
            {shownMessages.map(msg => (
              <div 
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  gap: 6
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  maxWidth: '88%',
                  flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row'
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: msg.sender === 'user' ? 'var(--accent-primary)' : 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: 2
                  }}>
                    {msg.sender === 'user' ? <User size={14} color="white" /> : <Bot size={14} color="var(--accent-primary)" />}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                    <div style={{
                      padding: '12px 16px',
                      borderRadius: 18,
                      background: msg.sender === 'user' ? 'var(--accent-primary)' : 'var(--bg-surface)',
                      color: msg.sender === 'user' ? '#ffffff' : 'var(--text-primary)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      fontSize: '0.92rem',
                      lineHeight: '1.45',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      border: msg.sender === 'user' ? 'none' : '1px solid var(--border-subtle)'
                    }}>
                      {msg.fileName && (
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: 'rgba(255, 255, 255, 0.22)',
                          marginBottom: 6,
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          color: '#ffffff'
                        }}>
                          <FileText size={12} />
                          <span>{msg.fileName}</span>
                        </div>
                      )}
                      <div>{msg.text}</div>
                    </div>

                    {msg.sender === 'assistant' && (
                      <button
                        type="button"
                        data-testid="ai-tts-btn"
                        onClick={() => toggleSpeak(msg.id, msg.text)}
                        style={{
                          background: speakingMsgId === msg.id ? 'var(--accent-primary)' : 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          color: speakingMsgId === msg.id ? 'white' : 'var(--text-secondary)',
                          borderRadius: '50%',
                          width: 28,
                          height: 28,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          flexShrink: 0,
                          marginBottom: 4,
                          transition: 'all 0.15s ease'
                        }}
                        title={speakingMsgId === msg.id ? 'Detener voz' : 'Escuchar respuesta en voz alta'}
                      >
                        {speakingMsgId === msg.id ? <VolumeX size={14} /> : <Volume2 size={14} />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Clarification Questions Box */}
                {msg.batch?.clarificationQuestions && msg.batch.clarificationQuestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      maxWidth: '88%',
                      marginLeft: msg.sender === 'user' ? 0 : 36,
                      background: 'rgba(0, 122, 255, 0.07)',
                      border: '1px solid rgba(0, 122, 255, 0.22)',
                      borderRadius: 14,
                      padding: '10px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-primary)', fontSize: '0.80rem', fontWeight: 700 }}>
                      <HelpCircle size={15} />
                      <span>Para asegurarme y hacerlo exacto:</span>
                    </div>
                    {msg.batch.clarificationQuestions.map((q, qIdx) => (
                      <div key={qIdx} style={{ fontSize: '0.86rem', color: 'var(--text-primary)', paddingLeft: 4 }}>
                        • {q}
                      </div>
                    ))}
                  </motion.div>
                )}

                {/* Suggested Quick Replies Chips */}
                {msg.batch?.suggestedReplies && msg.batch.suggestedReplies.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 7,
                      maxWidth: '88%',
                      marginLeft: msg.sender === 'user' ? 0 : 36,
                      marginTop: 2
                    }}
                  >
                    {msg.batch.suggestedReplies.map((replyText, rIdx) => (
                      <button
                        key={rIdx}
                        type="button"
                        onClick={() => handleSend(replyText)}
                        style={{
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--accent-primary)',
                          borderRadius: 999,
                          padding: '6px 13px',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          color: 'var(--accent-primary)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          boxShadow: '0 2px 6px rgba(0, 122, 255, 0.08)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span>{replyText}</span>
                        <ArrowUp size={12} style={{ transform: 'rotate(45deg)' }} />
                      </button>
                    ))}
                  </motion.div>
                )}

                {/* Proposed Task Updates Card (Modify / Complete / Delete / Reschedule) */}
                {msg.batch?.taskUpdates && msg.batch.taskUpdates.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      width: '100%',
                      maxWidth: '88%',
                      marginLeft: msg.sender === 'user' ? 0 : 36,
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 16,
                      padding: '14px 16px',
                      boxShadow: '0 4px 18px rgba(0,0,0,0.06)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Edit3 size={14} color="var(--accent-primary)" />
                        </div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {msg.batch.taskUpdates.filter(u => u.selected).length} de {msg.batch.taskUpdates.length} modificaciones propuestas
                        </span>
                      </div>
                      <button
                        onClick={() => handleToggleAllTaskUpdates(msg.id)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}
                      >
                        {msg.batch.taskUpdates.every(u => u.selected) ? 'Deseleccionar todos' : 'Seleccionar todos'}
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
                      {msg.batch.taskUpdates.map(u => (
                        <div
                          key={u.taskId}
                          onClick={() => handleToggleTaskUpdateSelected(msg.id, u.taskId)}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 10,
                            padding: '8px 10px',
                            borderRadius: 10,
                            background: u.selected ? 'var(--bg-hover)' : 'transparent',
                            border: u.selected ? '1px solid var(--border-subtle)' : '1px solid transparent',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{
                            width: 18, height: 18, borderRadius: 6,
                            border: u.selected ? '1.5px solid var(--accent-primary)' : '1.5px solid var(--text-tertiary)',
                            background: u.selected ? 'var(--accent-primary)' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                            marginTop: 2
                          }}>
                            {u.selected && <Check size={12} color="white" />}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {u.originalTitle}
                              </span>
                              {u.deleted && (
                                <span style={{ fontSize: '0.70rem', color: '#ff3b30', background: 'rgba(255, 59, 48, 0.12)', padding: '1px 6px', borderRadius: 4, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <Trash2 size={10} /> Eliminar
                                </span>
                              )}
                              {u.status === 'completed' && (
                                <span style={{ fontSize: '0.70rem', color: '#34c759', background: 'rgba(52, 199, 89, 0.12)', padding: '1px 6px', borderRadius: 4, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <CheckCircle2 size={10} /> Completar
                                </span>
                              )}
                              {u.price !== undefined && (
                                <span className="apple-price-pill" style={{ padding: '0 5px', fontSize: '0.70rem' }}>
                                  {u.price} €
                                </span>
                              )}
                              {u.newTitle && (
                                <span style={{ fontSize: '0.70rem', color: 'var(--accent-primary)', background: 'var(--accent-glow)', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                                  → {u.newTitle}
                                </span>
                              )}
                              {u.listName && (
                                <span style={{ fontSize: '0.70rem', color: 'var(--text-secondary)', background: 'var(--bg-surface)', padding: '1px 6px', borderRadius: 4 }}>
                                  Mover a: {u.listName}
                                </span>
                              )}
                            </div>
                            {u.reason && (
                              <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                                {u.reason}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => handleApplyTaskUpdates(msg.id)}
                      disabled={msg.batch.taskUpdates.filter(u => u.selected).length === 0}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        borderRadius: 12,
                        background: 'var(--accent-primary)',
                        border: 'none',
                        color: 'white',
                        fontWeight: 650,
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        cursor: msg.batch.taskUpdates.filter(u => u.selected).length === 0 ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 14px rgba(0, 122, 255, 0.3)',
                        opacity: msg.batch.taskUpdates.filter(u => u.selected).length === 0 ? 0.5 : 1
                      }}
                    >
                      <CheckCircle2 size={17} />
                      <span>Aplicar modificaciones ({msg.batch.taskUpdates.filter(u => u.selected).length})</span>
                    </button>
                  </motion.div>
                )}

                {/* Proposed Tasks Card Grid if batch exists */}
                {msg.batch && msg.batch.tasks && msg.batch.tasks.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      width: '100%',
                      maxWidth: '88%',
                      marginLeft: msg.sender === 'user' ? 0 : 36,
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 16,
                      padding: '14px 16px',
                      boxShadow: '0 4px 18px rgba(0,0,0,0.06)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12
                    }}
                  >
                    {/* Header with suggested list and toggle all */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {msg.batch.tasks.filter(t => t.selected).length} de {msg.batch.tasks.length} seleccionados
                        </span>
                        {msg.batch.suggestedList && (
                          <span style={{ fontSize: '0.75rem', background: 'var(--accent-glow)', color: 'var(--accent-primary)', padding: '2px 8px', borderRadius: 999, fontWeight: 600 }}>
                            Nueva lista: {msg.batch.suggestedList.name}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleToggleAllTasks(msg.id)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600 }}
                      >
                        {msg.batch.tasks.every(t => t.selected) ? 'Deseleccionar todos' : 'Seleccionar todos'}
                      </button>
                    </div>

                    {/* Task Rows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
                      {msg.batch.tasks.map(t => (
                        <div
                          key={t.id}
                          onClick={() => handleToggleTaskSelected(msg.id, t.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 10px',
                            borderRadius: 10,
                            background: t.selected ? 'var(--bg-hover)' : 'transparent',
                            border: t.selected ? '1px solid var(--border-subtle)' : '1px solid transparent',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{
                            width: 18, height: 18, borderRadius: 6,
                            border: t.selected ? '1.5px solid var(--accent-primary)' : '1.5px solid var(--text-tertiary)',
                            background: t.selected ? 'var(--accent-primary)' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {t.selected && <Check size={12} color="white" />}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {t.title}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                              {t.listName && (
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', background: 'var(--bg-surface)', padding: '1px 6px', borderRadius: 4 }}>
                                  {t.listName}
                                </span>
                              )}
                              {t.dueDate && (
                                <span style={{ fontSize: '0.72rem', color: 'var(--accent-blue)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                  <Calendar size={11} /> {new Date(t.dueDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                </span>
                              )}
                              {t.timeOfDay && (
                                <span style={{ fontSize: '0.72rem', color: t.timeOfDay === 'morning' ? '#ff9500' : t.timeOfDay === 'afternoon' ? '#007aff' : '#af52de', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                  {t.timeOfDay === 'morning' ? <Sunrise size={11} /> : t.timeOfDay === 'afternoon' ? <Sun size={11} /> : <Moon size={11} />}
                                  {t.timeOfDay === 'morning' ? 'Mañana' : t.timeOfDay === 'afternoon' ? 'Tarde' : 'Noche'}
                                </span>
                              )}
                              {t.price !== undefined && (
                                <span className="apple-price-pill" style={{ padding: '0 5px', fontSize: '0.72rem' }}>
                                  {t.price} €
                                </span>
                              )}
                              {t.priority && t.priority !== 'none' && (
                                <span style={{ fontSize: '0.72rem', color: t.priority === 'high' ? '#ff3b30' : '#ff9500', fontWeight: 600 }}>
                                  {t.priority === 'high' ? '!!! Urgente' : '!! Media'}
                                </span>
                              )}
                              {t.cycle && (
                                <span style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                  <Repeat size={11} /> {t.cycle === 'cycle_day' ? 'Diario' : t.cycle === 'cycle_week' ? 'Semanal' : 'Mensual'}
                                </span>
                              )}
                              {t.people && t.people.length > 0 && (
                                <div style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
                                  {t.people.map(p => (
                                    <span key={p} style={{ fontSize: '0.72rem', color: '#5856D6', background: 'rgba(88, 86, 214, 0.12)', padding: '1px 6px', borderRadius: 999, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                      <User size={10} /> {p}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {t.vibe && (
                                <span style={{ fontSize: '0.72rem', color: '#ff9500', background: 'rgba(255, 149, 0, 0.12)', padding: '1px 6px', borderRadius: 999, fontWeight: 600 }}>
                                  {t.vibe}
                                </span>
                              )}
                              {t.locationName && (
                                <span style={{ fontSize: '0.72rem', color: '#34c759', background: 'rgba(52, 199, 89, 0.12)', padding: '1px 6px', borderRadius: 999, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                                  <MapPin size={10} /> {t.locationName}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Action button */}
                    <button
                      data-testid="ai-import-all-btn"
                      onClick={() => handleImportBatch(msg.id)}
                      disabled={msg.batch.tasks.filter(t => t.selected).length === 0}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        borderRadius: 12,
                        background: 'var(--accent-primary)',
                        border: 'none',
                        color: 'white',
                        fontWeight: 650,
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(0, 122, 255, 0.3)',
                        opacity: msg.batch.tasks.filter(t => t.selected).length === 0 ? 0.5 : 1
                      }}
                    >
                      <CheckCircle2 size={17} />
                      {msg.batch.tasks[0]?.listId === 'que_he_hecho' || msg.batch.tasks[0]?.listName?.toLowerCase().includes('qué he hecho')
                        ? `Sí, apuntar e importar todo a Qué he hecho (${msg.batch.tasks.filter(t => t.selected).length})`
                        : `Sí, importar todo (${msg.batch.tasks.filter(t => t.selected).length})`}
                    </button>
                  </motion.div>
                )}

                {/* Interactive Grouping Action Card */}
                {msg.batch?.action?.type === 'group_tasks' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      width: '100%',
                      maxWidth: '90%',
                      marginLeft: msg.sender === 'user' ? 0 : 36,
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 16,
                      padding: '16px',
                      boxShadow: '0 4px 18px rgba(0,0,0,0.06)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Sparkles size={16} color="var(--accent-primary)" />
                        </div>
                        <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          Unificar en tarea madre
                        </span>
                      </div>
                      {msg.batch.action.listName && (
                        <span style={{ fontSize: '0.76rem', background: 'var(--bg-hover)', color: 'var(--text-secondary)', padding: '3px 9px', borderRadius: 999, fontWeight: 600 }}>
                          Lista: {msg.batch.action.listName}
                        </span>
                      )}
                    </div>

                    <div>
                      <label style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', display: 'block', marginBottom: 5, fontWeight: 600 }}>
                        Título de la tarea madre:
                      </label>
                      <input
                        type="text"
                        value={msg.batch.action.parentTitle}
                        onChange={(e) => handleUpdateActionParentTitle(msg.id, e.target.value)}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: 10,
                          border: '1px solid var(--border-subtle)',
                          background: 'var(--bg-surface)',
                          color: 'var(--text-primary)',
                          fontSize: '0.92rem',
                          fontWeight: 600,
                          boxSizing: 'border-box',
                          outline: 'none'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                        Subtareas seleccionadas ({msg.batch.action.children.filter(c => c.selected).length} de {msg.batch.action.children.length}):
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                        {msg.batch.action.children.map(child => (
                          <div
                            key={child.id}
                            onClick={() => handleToggleActionChild(msg.id, child.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              padding: '8px 10px',
                              borderRadius: 8,
                              background: child.selected ? 'var(--bg-hover, rgba(0,0,0,0.04))' : 'transparent',
                              border: '1px solid var(--border-subtle)',
                              cursor: 'pointer',
                              opacity: child.selected ? 1 : 0.6,
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <div style={{
                              width: 18, height: 18, borderRadius: 5,
                              border: `1.5px solid ${child.selected ? 'var(--accent-primary)' : 'var(--text-tertiary)'}`,
                              background: child.selected ? 'var(--accent-primary)' : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                              {child.selected && <Check size={12} color="#fff" strokeWidth={3} />}
                            </div>
                            <span style={{ flex: 1, fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: child.selected ? 600 : 400 }}>
                              {child.title}
                            </span>
                            {child.isExisting ? (
                              <span style={{ fontSize: '0.70rem', color: 'var(--accent-primary)', background: 'var(--accent-glow)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                                Existente
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.70rem', color: 'var(--text-tertiary)', background: 'var(--bg-surface)', padding: '2px 6px', borderRadius: 4 }}>
                                Nuevo
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => handleExecuteGroupAction(msg.id)}
                      disabled={msg.batch.action.children.filter(c => c.selected).length === 0}
                      style={{
                        width: '100%',
                        padding: '11px 16px',
                        borderRadius: 12,
                        background: 'var(--accent-primary)',
                        color: '#ffffff',
                        border: 'none',
                        fontWeight: 600,
                        fontSize: '0.92rem',
                        cursor: msg.batch.action.children.filter(c => c.selected).length === 0 ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        boxShadow: '0 4px 14px rgba(0, 122, 255, 0.3)',
                        opacity: msg.batch.action.children.filter(c => c.selected).length === 0 ? 0.5 : 1,
                        transition: 'opacity 0.2s'
                      }}
                    >
                      <Sparkles size={16} />
                      <span>Confirmar y unificar ({msg.batch.action.children.filter(c => c.selected).length} subtareas)</span>
                    </button>
                  </motion.div>
                )}
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={13} className="animate-spin" />
                </div>
                <span>Pensando y estructurando tus recordatorios...</span>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Quick Suggestions Chips */}
          {messages.length <= 2 && (
            <div style={{
              display: 'flex',
              gap: 8,
              padding: '0 20px 10px 20px',
              overflowX: 'auto',
              flexShrink: 0
            }}>
              {[
                { label: 'Importar PDF o documento', Icon: FileText, action: 'file' },
                { label: 'Planificar mi semana', Icon: CalendarRange, action: 'send' },
                { label: 'Hacer la maleta de viaje', Icon: Luggage, action: 'send' },
                { label: 'Compra semanal con precios', Icon: ShoppingCart, action: 'send' },
                { label: 'Tareas de limpieza profunda', Icon: SprayCan, action: 'send' }
              ].map(chip => (
                <button
                  key={chip.label}
                  onClick={() => {
                    if (chip.action === 'file') {
                      fileInputRef.current?.click();
                    } else {
                      handleSend(chip.label);
                    }
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 999,
                    padding: '5px 12px',
                    fontSize: '0.78rem',
                    color: 'var(--text-secondary)',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer'
                  }}
                >
                  <chip.Icon size={13} strokeWidth={2.2} />
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          {/* Attached File Preview Bar */}
          {isExtractingFile && (
            <div style={{
              padding: '8px 18px',
              background: 'var(--bg-elevated)',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '0.82rem',
              color: 'var(--text-secondary)'
            }}>
              <Loader2 size={15} className="animate-spin" color="var(--accent-primary)" />
              <span>Extrayendo y procesando documento...</span>
            </div>
          )}

          {attachedFile && !isExtractingFile && (
            <div style={{
              padding: '8px 18px',
              background: 'var(--bg-elevated)',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 6,
                  background: 'rgba(0, 122, 255, 0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <FileText size={15} color="var(--accent-primary)" />
                </div>
                <span style={{
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {attachedFile.name}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                  ({Math.round(attachedFile.size / 1024) || 1} KB)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAttachedFile(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Eliminar adjunto"
              >
                <X size={15} />
              </button>
            </div>
          )}

          {/* Input Area */}
          <div style={{
            padding: '12px 18px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            display: 'flex',
            alignItems: 'center',
            gap: 10
          }}>
            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.csv,.json,.txt,.md"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  processAttachedFile(file);
                  e.target.value = '';
                }
              }}
            />

            {/* Paperclip File Attachment Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isExtractingFile}
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: attachedFile ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                border: attachedFile ? 'none' : '1px solid var(--border-subtle)',
                color: attachedFile ? '#ffffff' : 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
              title="Adjuntar PDF, CSV o documento"
            >
              <Paperclip size={17} />
            </button>

            {speechSupported && (
              <button
                type="button"
                onClick={toggleVoiceInput}
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: isListening ? '#ff3b30' : 'var(--bg-elevated)',
                  border: isListening ? 'none' : '1px solid var(--border-subtle)',
                  color: isListening ? 'white' : 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0,
                  boxShadow: isListening ? '0 0 16px rgba(255, 59, 48, 0.6)' : 'none',
                  animation: isListening ? 'pulse-badge 1.4s ease-in-out infinite' : 'none',
                  transition: 'all 0.15s ease'
                }}
                title={isListening ? 'Detener dictado' : 'Hablar por micrófono'}
              >
                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            )}

            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              onPaste={e => {
                const file = e.clipboardData?.files?.[0];
                if (file) {
                  e.preventDefault();
                  processAttachedFile(file);
                }
              }}
              placeholder={
                isListening
                  ? 'Escuchando... di lo que necesitas apuntar'
                  : attachedFile
                    ? 'Añade una instrucción o pulsa la flecha para procesar...'
                    : 'Habla, escribe o adjunta tus documentos...'
              }
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 999,
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                fontSize: '0.92rem',
                outline: 'none'
              }}
            />

            <button
              onClick={() => handleSend()}
              disabled={(!input.trim() && !attachedFile) || loading || isExtractingFile}
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: (input.trim() || attachedFile) ? 'var(--accent-primary)' : 'var(--bg-hover)',
                border: 'none',
                color: (input.trim() || attachedFile) ? '#ffffff' : 'var(--text-tertiary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: (input.trim() || attachedFile) ? 'pointer' : 'default',
                flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
              title="Enviar"
            >
              <ArrowUp size={18} />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
