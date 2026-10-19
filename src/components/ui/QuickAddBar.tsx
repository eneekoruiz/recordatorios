import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, SlidersHorizontal, ArrowUp, Calendar, Clock, AlertCircle, List as ListIcon, Repeat, Users, Coins, Loader2, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { parseNaturalLanguage } from '../../utils/nlp';
import { SoundService } from '../../services/SoundService';
import { extractPeopleFromText, getAnticipationAlerts } from '../../services/TaskService';
import { isCaducidadesList } from '../../utils/specialLists';
import { formatEuro } from '../../utils/format';
import { useCalendarStore } from '../../store/useCalendarStore';
import { parseDayKey } from '../../utils/calendar';
import { AIService, type ProposedBatch } from '../../services/AIService';
import { HapticService } from '../../services/HapticService';
import type { TaskItem, CustomList } from '../../models/Task';
import { buildTasksFromBatch, canAutoApply, isConversationalRequest, plainReply, summarizeCreated } from '../../utils/aiQuickAdd';
import { sendToAssistant, type AssistantRequest } from '../../utils/aiAssistantInbox';

interface QuickAddBarProps {
  currentView: string;
  /** Abre el editor completo; recibe lo ya escrito para no perderlo. */
  onExpandDrawer: (initialTitle?: string) => void;
}

const PRIORITY_LABELS: Record<string, string> = { high: 'alta', medium: 'media', low: 'baja' };

export function QuickAddBar({ currentView, onExpandDrawer }: QuickAddBarProps) {
  const [text, setText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  // La barra es la conversación con la IA: mientras piensa, y lo que responde después.
  const [isThinking, setIsThinking] = useState(false);
  const [aiReply, setAiReply] = useState<{ text: string; detail?: string; createdIds: string[]; request?: AssistantRequest } | null>(null);
  const replyTimerRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const addTask = useAppStore(state => state.addTask);
  const addTasksBatch = useAppStore(state => state.addTasksBatch);
  const deleteTask = useAppStore(state => state.deleteTask);
  const lists = useAppStore(state => state.lists);
  const listSections = useAppStore(state => state.listSections);
  const calendarDay = useCalendarStore(state => state.selectedDay);
  // En el calendario, lo que se escribe va al día elegido (salvo que diga otra fecha).
  const calendarDate = currentView === 'smart_calendar' ? (calendarDay ? parseDayKey(calendarDay) : new Date()) : null;

  const nlp = parseNaturalLanguage(text);
  // «@Compras» es una lista, no una persona: evitamos mostrarlo dos veces.
  const matchedList = nlp.suggestedCategory
    ? lists.find((l) => (l.name || '').toLowerCase() === (nlp.suggestedCategory || '').toLowerCase())
    : undefined;
  const extractedPeople = extractPeopleFromText(text).filter(
    (person) => (person || '').toLowerCase() !== (nlp.suggestedCategory || '').toLowerCase()
  );

  // El intérprete propio de la barra: «!alta», «@Compras», precios, caducidades, horas…
  // Sin un modelo de lenguaje configurado es más fiable que el extractor local para un solo
  // recordatorio, así que se usa para eso; la IA entra con varios a la vez o con preguntas.
  const buildLocalTask = (): Partial<TaskItem> | null => {
    const cleanTitle = nlp.cleanTitle || text.trim();
    if (!cleanTitle) return null;

    // Determinar categoría / lista por defecto
    let targetCategory = 'inbox';
    if (currentView.startsWith('list_')) {
      targetCategory = currentView.replace('list_', '');
    } else if (nlp.suggestedCategory) {
      // Buscar si coincide con alguna lista existente
      const matchingList = lists.find(l => (l.name || '').toLowerCase() === (nlp.suggestedCategory || '').toLowerCase());
      if (matchingList) {
        targetCategory = matchingList.id;
      }
    }

    // Auto-detección para Caducidades y Suscripciones
    let expirationType: 'card' | 'subscription' | 'other' | undefined = undefined;
    let targetSectionId: string | undefined = undefined;

    const isCad = isCaducidadesList(targetCategory) || /caduca|tarjeta|suscrip|renovaci/i.test(text);
    if (isCad) {
      if (!isCaducidadesList(targetCategory)) {
        targetCategory = 'caducidades';
      }
      const isSub = /suscrip|netflix|spotify|gimnasio|cloud|hosting|mensualidad|seguro|alquiler|cuota|disney|prime|apple|hbo|youtube/i.test(text);
      expirationType = isSub ? 'subscription' : 'card';
      
      const matchingSec = listSections.find(s => 
        s.listId === targetCategory && 
        (isSub ? /suscrip|recurrente/i.test(s.name) : /tarjeta|doc|banco/i.test(s.name))
      );
      targetSectionId = matchingSec?.id || (isSub 
        ? (targetCategory === 'caducidades' ? 'sec_suscripciones' : `sec_suscripciones_${targetCategory}`)
        : (targetCategory === 'caducidades' ? 'sec_tarjetas' : `sec_tarjetas_${targetCategory}`)
      );
    }

    // Si tiene menciones de personas y estamos en que_he_hecho o no hay categoría fija
    const people = extractedPeople;
    if (targetCategory === 'inbox' && people.length > 0 && currentView === 'list_que_he_hecho') {
      targetCategory = 'que_he_hecho';
    }

    // Determinar ciclo por defecto
    let targetCycleId: string | undefined = undefined;
    if (currentView.startsWith('cycle_')) {
      targetCycleId = currentView;
    } else if (nlp.suggestedCycleId) {
      targetCycleId = nlp.suggestedCycleId;
    }

    // Determinar dueDate: manda la fecha escrita («mañana», «el viernes»…); si no hay,
    // la de la vista (Hoy, o el día elegido en el calendario, a mediodía).
    let targetDueDate: string | undefined = undefined;
    if (nlp.suggestedDueDate) {
      targetDueDate = nlp.suggestedDueDate.toISOString();
    } else if (currentView === 'smart_today') {
      targetDueDate = new Date().toISOString();
    } else if (currentView === 'smart_calendar') {
      const day = calendarDay ? parseDayKey(calendarDay) : new Date();
      targetDueDate = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12).toISOString();
    }

    // Alertas por hora
    let alerts: import('../../models/Task').AlertDef[] = nlp.times.map(t => ({
      id: `alert_${Date.now()}_${t}`,
      type: 'at_time' as const,
      time: t
    }));

    // Alertas preventivas automáticas para tarjetas y suscripciones
    if (expirationType && targetDueDate) {
      const autoAlerts = getAnticipationAlerts(expirationType).map(a => ({
        ...a,
        id: `alert_auto_${Date.now()}_${a.offsetMinutes}`
      }));
      alerts = [...alerts, ...autoAlerts];
    }

    return {
      id: crypto.randomUUID(),
      title: cleanTitle,
      categoryId: targetCategory,
      sectionId: targetSectionId,
      cycle_id: targetCycleId,
      dueDate: targetDueDate,
      priority: nlp.suggestedPriority || 'none',
      price: nlp.suggestedPrice !== undefined && nlp.suggestedPrice > 0 ? nlp.suggestedPrice : undefined,
      alerts: alerts.length > 0 ? alerts : undefined,
      people: people.length > 0 ? people : undefined,
      expirationType,
      status: 'pending',
      created_at: new Date().toISOString()
    };
  };

  useEffect(() => () => {
    if (replyTimerRef.current) window.clearTimeout(replyTimerRef.current);
  }, []);

  const showReply = (reply: { text: string; detail?: string; createdIds: string[]; request?: AssistantRequest }, ms = 8000) => {
    if (replyTimerRef.current) window.clearTimeout(replyTimerRef.current);
    setAiReply(reply);
    replyTimerRef.current = window.setTimeout(() => setAiReply(null), ms);
  };

  // Valores de la vista para lo que la IA no diga: la lista abierta, el día de Hoy o del
  // calendario y la frecuencia de la vista de frecuencia.
  const viewDefaults = () => {
    const defaultListId = currentView.startsWith('list_') ? currentView.replace('list_', '') : undefined;
    let defaultDueDate: string | undefined;
    if (currentView === 'smart_today') defaultDueDate = new Date().toISOString();
    else if (currentView === 'smart_calendar') {
      const day = calendarDay ? parseDayKey(calendarDay) : new Date();
      defaultDueDate = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12).toISOString();
    }
    const defaultCycleId = currentView.startsWith('cycle_') ? currentView : undefined;
    return { defaultListId, defaultDueDate, defaultCycleId };
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isThinking) return;
    const raw = text.trim();
    if (!raw) {
      onExpandDrawer();
      return;
    }
    setAiReply(null);

    // Una pregunta no es un recordatorio: se continúa en el chat de la IA.
    if (isConversationalRequest(raw)) {
      sendToAssistant({ text: raw });
      setText('');
      return;
    }

    const usesModel = AIService.hasLanguageModel();
    const localTask = buildLocalTask();
    let batch: ProposedBatch | null = null;
    setIsThinking(true);
    try {
      batch = await AIService.processPrompt(raw, lists, [], useAppStore.getState().tasks, undefined, listSections);
    } catch {
      batch = null; // sin IA disponible: se apunta con el intérprete de la barra
    } finally {
      setIsThinking(false);
    }

    // La IA necesita hablarlo (aclarar algo, cambiar o agrupar recordatorios que ya existen):
    // se abre el chat con su respuesta, sin volver a preguntar.
    if (batch && !canAutoApply(batch) && (usesModel || batch.tasks.length === 0 || Boolean(batch.taskUpdates?.length) || Boolean(batch.action))) {
      sendToAssistant({ text: raw, batch });
      setText('');
      return;
    }

    const proposedCount = batch ? batch.tasks.filter(t => t.selected !== false).length : 0;
    let payload: Partial<TaskItem>[] = [];
    let createList: CustomList | undefined;
    if (!batch || (!usesModel && proposedCount <= 1)) {
      payload = localTask ? [localTask] : [];
    } else {
      const built = buildTasksFromBatch(batch, lists, { ...viewDefaults(), fallbackListId: 'inbox', sourceText: raw });
      payload = built.tasks;
      createList = built.createList;
    }
    if (payload.length === 0) {
      onExpandDrawer(raw);
      setText('');
      return;
    }

    const before = useAppStore.getState().tasks;
    addTasksBatch(payload, createList ? { createList } : undefined);
    const after = useAppStore.getState().tasks;
    const created = payload.filter(t => t.id && after[t.id] && !before[t.id]);

    SoundService.playPop();
    HapticService.selection();
    setText('');
    inputRef.current?.blur();

    const summary = summarizeCreated(created, useAppStore.getState().lists);
    const modelReply = usesModel && batch ? plainReply(batch.reply) : '';
    showReply({
      text: summary,
      detail: modelReply && modelReply !== summary ? modelReply : undefined,
      createdIds: created.map(t => t.id!).filter(Boolean),
      // «Abrir chat» continúa esta misma conversación (lo apuntado ya no se vuelve a proponer).
      request: { text: raw, batch: { ...(batch || { reply: '', tasks: [] }), tasks: [], reply: `${batch?.reply ? `${batch.reply}\n\n` : ''}✅ ${summary}` } },
    });
  };

  const undoLastReply = () => {
    if (!aiReply) return;
    aiReply.createdIds.forEach(id => deleteTask(id));
    HapticService.selection();
    showReply({ text: 'Deshecho.', createdIds: [] }, 2500);
  };

  const showCalendarDay = Boolean(calendarDate && text.trim() && !nlp.suggestedDueDate);
  const hasChips = nlp.times.length > 0 || nlp.suggestedDueDate || showCalendarDay || nlp.suggestedCycleId || nlp.suggestedPriority || nlp.suggestedCategory || extractedPeople.length > 0 || Boolean(nlp.suggestedPrice);

  return (
    <div 
      style={{
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      {/* Respuesta de la IA: qué ha apuntado, con «Deshacer» y «Abrir chat» para seguir hablando */}
      <AnimatePresence>
        {aiReply && (
          <motion.div
            key="qa-ai-reply"
            className="qa-ai-reply"
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18 }}
          >
            <Sparkles size={15} aria-hidden="true" className="qa-ai-reply-icon" />
            <div className="qa-ai-reply-body">
              <p className="qa-ai-reply-text">{aiReply.text}</p>
              {aiReply.detail && <p className="qa-ai-reply-detail">{aiReply.detail}</p>}
            </div>
            <div className="qa-ai-reply-actions">
              {aiReply.createdIds.length > 0 && (
                <button type="button" onClick={undoLastReply}>Deshacer</button>
              )}
              {aiReply.request && (
                <button
                  type="button"
                  onClick={() => {
                    const request = aiReply.request!;
                    setAiReply(null);
                    sendToAssistant(request);
                  }}
                >
                  Abrir chat
                </button>
              )}
              <button type="button" className="qa-ai-reply-close" aria-label="Cerrar respuesta" onClick={() => setAiReply(null)}>
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="quick-add-shell"
        style={{
          width: '100%',
          background: 'var(--bg-material, rgba(255, 255, 255, 0.88))',
          backdropFilter: 'blur(35px) saturate(190%)',
          WebkitBackdropFilter: 'blur(35px) saturate(190%)',
          border: isFocused ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle, rgba(0,0,0,0.12))',
          borderRadius: 30,
          boxShadow: isFocused ? '0 12px 36px var(--accent-glow), 0 4px 16px rgba(0,0,0,0.1)' : '0 10px 32px rgba(0,0,0,0.12)',
          padding: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: hasChips ? 8 : 0,
          transition: 'border-color 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          boxSizing: 'border-box'
        }}
      >
        {/* NLP Interactive Chips Row */}
        <AnimatePresence>
          {hasChips && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ display: 'flex', gap: 6, flexWrap: 'wrap', overflow: 'hidden' }}
            >
              {nlp.suggestedDueDate && (
                <span className="qa-chip">
                  <Calendar size={12} /> {nlp.suggestedDueDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
              )}
              {showCalendarDay && calendarDate && (
                <span className="qa-chip">
                  <Calendar size={12} /> {calendarDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
              )}
              {nlp.times.map(t => (
                <span key={t} className="qa-chip">
                  <Clock size={12} /> {t}
                </span>
              ))}
              {nlp.suggestedPriority && (
                <span className="qa-chip qa-chip--priority">
                  <AlertCircle size={12} /> Prioridad {PRIORITY_LABELS[nlp.suggestedPriority] || nlp.suggestedPriority}
                </span>
              )}
              {nlp.suggestedCategory && (
                <span className="qa-chip qa-chip--list">
                  <ListIcon size={12} /> {matchedList?.name || nlp.suggestedCategory}
                </span>
              )}
              {nlp.suggestedCycleId && (
                <span className="qa-chip qa-chip--cycle">
                  <Repeat size={12} /> Se repite
                </span>
              )}
              {extractedPeople.length > 0 && (
                <span className="qa-chip qa-chip--people">
                  <Users size={12} /> {extractedPeople.join(', ')}
                </span>
              )}
              {nlp.suggestedPrice && (
                <span className="qa-chip qa-chip--price" style={{ fontWeight: 600, color: 'var(--accent-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  <Coins size={12} /> {formatEuro(nlp.suggestedPrice)}
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
          <button
            type="button"
            onClick={() => {
              const draft = text.trim();
              sendToAssistant({ text: draft });
              if (draft) setText('');
            }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 10,
              minWidth: 44,
              minHeight: 44,
              flexShrink: 0,
              borderRadius: 22,
              color: text ? 'var(--accent-primary)' : isFocused ? 'var(--accent-primary)' : 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.2s ease, transform 0.2s ease'
            }}
            title="Abrir el chat de la IA (Ctrl+J)"
            aria-label="Abrir el chat de la IA"
          >
            <Sparkles size={18} />
          </button>

          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={e => { setText(e.target.value); if (aiReply) setAiReply(null); }}
            readOnly={isThinking}
            aria-busy={isThinking}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onPaste={e => {
              const pasted = e.clipboardData.getData('text');
              if (pasted.includes('\n')) {
                e.preventDefault();
                const lines = pasted.split('\n').map(l => l.trim()).filter(Boolean);
                if (lines.length > 0) {
                  setText(lines[0]);
                  const defaultCategory = currentView.startsWith('list_') ? currentView.replace('list_', '') : 'inbox';
                  lines.slice(1).forEach(line => {
                    const extracted = parseNaturalLanguage(line);
                    addTask({
                      id: crypto.randomUUID(),
                      title: extracted.cleanTitle || line,
                      categoryId: defaultCategory,
                      type: 'task',
                      status: 'pending',
                      priority: extracted.suggestedPriority || 'none',
                      dueDate: extracted.suggestedDueDate ? extracted.suggestedDueDate.toISOString() : undefined,
                      created_at: new Date().toISOString()
                    });
                  });
                }
              }
            }}
            placeholder={isThinking ? 'Pensando…' : 'Nuevo recordatorio'}
            aria-label="Nuevo recordatorio o mensaje para la IA"
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 44,
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: '0.94rem',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
              padding: '4px 0'
            }}
          />

          {/* Expand into full drawer */}
          <button
            type="button"
            onClick={() => {
              const draft = text.trim();
              onExpandDrawer(draft || undefined);
              if (draft) setText('');
            }}
            title="Opciones detalladas (editor completo)"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 12,
              minWidth: 44,
              minHeight: 44,
              flexShrink: 0,
              borderRadius: 22,
              transition: 'color 0.15s ease, background-color 0.15s ease'
            }}
          >
            <SlidersHorizontal size={17} />
          </button>

          {/* Quick Submit Button */}
          <button
            type="submit"
            disabled={!text.trim() || isThinking}
            title="Enviar a la IA (Intro)"
            aria-label={isThinking ? 'La IA está pensando' : 'Enviar a la IA'}
            style={{
              width: 44,
              height: 44,
              flexShrink: 0,
              borderRadius: '50%',
              background: text.trim() ? 'var(--accent-primary)' : 'var(--border-subtle, rgba(0,0,0,0.08))',
              color: text.trim() ? '#ffffff' : 'var(--text-tertiary)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: text.trim() ? 'pointer' : 'default',
              transition: 'background-color 0.2s cubic-bezier(0.16, 1, 0.3, 1), color 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: text.trim() ? '0 2px 8px rgba(0, 122, 255, 0.35)' : 'none',
              opacity: text.trim() ? 1 : 0.4
            }}
          >
            {isThinking
              ? <Loader2 size={16} strokeWidth={2.5} className="spin-anim" aria-hidden="true" />
              : <ArrowUp size={15} strokeWidth={2.5} aria-hidden="true" />}
          </button>
        </form>
      </div>
    </div>
  );
}
