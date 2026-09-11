import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, X, ArrowUp, Check, Bot, User, Settings, Mic, MicOff, 
  Calendar, CheckCircle2
} from 'lucide-react';
import { AIService, type ProposedBatch, type AIConfig } from '../../services/AIService';
import { useAppStore } from '../../store/useAppStore';
import { SoundService } from '../../services/SoundService';
import { HapticService } from '../../services/HapticService';

interface AIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
  onSelectView?: (view: string) => void;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  batch?: ProposedBatch;
  timestamp: string;
}

export function AIAssistantModal({ isOpen, onClose, initialPrompt = '', onSelectView }: AIAssistantModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState<AIConfig>(() => AIService.getConfig());
  const [tempApiKey, setTempApiKey] = useState(config.apiKey || '');
  const [tempProvider, setTempProvider] = useState(config.provider);
  const [speechSupported, setSpeechSupported] = useState(false);

  const lists = useAppStore(state => state.lists);
  const addTasksBatch = useAppStore(state => state.addTasksBatch);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition if supported
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'es-ES';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput(prev => (prev ? `${prev} ${transcript}` : transcript));
        }
        setIsListening(false);
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleVoiceInput = () => {
    if (!speechSupported || !recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        HapticService.impact('light');
      } catch (err) {
        console.error('Speech error:', err);
      }
    }
  };

  // Process initial prompt when opened with text
  useEffect(() => {
    if (isOpen) {
      if (initialPrompt && messages.length === 0) {
        handleSend(initialPrompt);
      } else if (messages.length === 0) {
        setMessages([
          {
            id: 'welcome_1',
            sender: 'assistant',
            text: '¡Hola! Soy tu asistente de Recordatorios con IA. Puedes hablarme o escribirme tus tareas en lenguaje natural (con fechas, horas, listas y precios en euros) y prepararé todos los recordatorios para importarlos al instante.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
    }
  }, [isOpen, initialPrompt]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `msg_user_${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    HapticService.impact('light');

    try {
      const history = messages.map(m => ({
        role: m.sender,
        text: m.text
      }));

      const batch = await AIService.processPrompt(text, lists, history);

      const aiMsg: ChatMessage = {
        id: `msg_ai_${Date.now()}`,
        sender: 'assistant',
        text: batch.reply,
        batch,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

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
      const existing = lists.find(l => l.name.toLowerCase() === msg.batch!.suggestedList!.name.toLowerCase());
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
      if (targetListToCreate) {
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
      detail: `✓ ${tasksPayload.length} recordatorios importados a "${listName}"` 
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
        text: `${m.text}\n\n✅ ¡${tasksPayload.length} recordatorios importados con éxito!`
      };
    }));

    // If a new list was created or specified, optionally navigate
    if (targetListToCreate && onSelectView) {
      onSelectView(`list_${targetListToCreate.id}`);
    }

    onClose();
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
            background: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ type: 'spring', damping: 28, stiffness: 420 }}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 680,
            height: '84vh',
            maxHeight: 740,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 22,
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.25), 0 4px 16px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 100000
          }}
          onClick={e => e.stopPropagation()}
        >
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
                  {config.provider === 'auto' ? '⚡ Extractor Inteligente Local (MCP Ready)' : config.provider === 'gemini' ? '✨ Google Gemini LLM' : '🧠 OpenAI GPT'}
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
                      {p === 'auto' ? '⚡ Local (Zero-Config)' : p === 'gemini' ? 'Google Gemini' : 'OpenAI'}
                    </button>
                  ))}
                </div>

                {tempProvider !== 'auto' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                      Clave API ({tempProvider === 'gemini' ? 'Gemini API Key' : 'OpenAI API Key'}):
                    </label>
                    <input
                      type="password"
                      value={tempApiKey}
                      onChange={e => setTempApiKey(e.target.value)}
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
            {messages.map(msg => (
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
                    {msg.text}
                  </div>
                </div>

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
                                <span style={{ fontSize: '0.72rem', color: t.timeOfDay === 'morning' ? '#ff9500' : t.timeOfDay === 'afternoon' ? '#007aff' : '#af52de' }}>
                                  {t.timeOfDay === 'morning' ? '🌅 Mañana' : t.timeOfDay === 'afternoon' ? '☀️ Tarde' : '🌙 Noche'}
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
                                <span style={{ fontSize: '0.72rem', color: 'var(--accent-primary)' }}>
                                  🔄 {t.cycle === 'cycle_day' ? 'Diario' : t.cycle === 'cycle_week' ? 'Semanal' : 'Mensual'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Action button */}
                    <button
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
                      Importar {msg.batch.tasks.filter(t => t.selected).length} recordatorios
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
                '🗓️ Planificar mi semana',
                '🧳 Hacer la maleta de viaje',
                '🛒 Compra semanal con precios',
                '🧹 Tareas de limpieza profunda'
              ].map(chip => (
                <button
                  key={chip}
                  onClick={() => handleSend(chip)}
                  style={{
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
                  {chip}
                </button>
              ))}
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
              placeholder={isListening ? 'Escuchando... di lo que necesitas apuntar' : 'Habla o escribe tus recordatorios...'}
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
              disabled={!input.trim() || loading}
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: input.trim() ? 'var(--accent-primary)' : 'var(--bg-hover)',
                border: 'none',
                color: input.trim() ? '#ffffff' : 'var(--text-tertiary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: input.trim() ? 'pointer' : 'default',
                flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
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
