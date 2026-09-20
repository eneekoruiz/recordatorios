import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, SlidersHorizontal, ArrowUp, Calendar, Clock, AlertCircle, List as ListIcon, Repeat, Users, Coins } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { parseNaturalLanguage } from '../../utils/nlp';
import { SoundService } from '../../services/SoundService';
import { extractPeopleFromText, getAnticipationAlerts } from '../../services/TaskService';
import { isCaducidadesList } from '../../utils/specialLists';

interface QuickAddBarProps {
  currentView: string;
  onExpandDrawer: () => void;
}

const PRIORITY_LABELS: Record<string, string> = { high: 'alta', medium: 'media', low: 'baja' };

export function QuickAddBar({ currentView, onExpandDrawer }: QuickAddBarProps) {
  const [text, setText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const addTask = useAppStore(state => state.addTask);
  const lists = useAppStore(state => state.lists);
  const listSections = useAppStore(state => state.listSections);

  const nlp = parseNaturalLanguage(text);
  // «@Compras» es una lista, no una persona: evitamos mostrarlo dos veces.
  const matchedList = nlp.suggestedCategory
    ? lists.find((l) => l.name.toLowerCase() === nlp.suggestedCategory!.toLowerCase())
    : undefined;
  const extractedPeople = extractPeopleFromText(text).filter(
    (person) => person.toLowerCase() !== (nlp.suggestedCategory || '').toLowerCase()
  );

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanTitle = nlp.cleanTitle || text.trim();
    if (!cleanTitle) {
      onExpandDrawer();
      return;
    }

    // Determinar categoría / lista por defecto
    let targetCategory = 'inbox';
    if (currentView.startsWith('list_')) {
      targetCategory = currentView.replace('list_', '');
    } else if (nlp.suggestedCategory) {
      // Buscar si coincide con alguna lista existente
      const matchingList = lists.find(l => l.name.toLowerCase() === nlp.suggestedCategory?.toLowerCase());
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

    // Determinar dueDate
    let targetDueDate: string | undefined = undefined;
    if (currentView === 'smart_today') {
      targetDueDate = new Date().toISOString();
    } else if (nlp.suggestedDueDate) {
      targetDueDate = nlp.suggestedDueDate.toISOString();
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

    addTask({
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
    });

    SoundService.playPop();
    setText('');
    inputRef.current?.blur();
  };

  const hasChips = nlp.times.length > 0 || nlp.suggestedDueDate || nlp.suggestedCycleId || nlp.suggestedPriority || nlp.suggestedCategory || extractedPeople.length > 0 || Boolean(nlp.suggestedPrice);

  return (
    <div 
      style={{
        width: '100%',
        boxSizing: 'border-box'
      }}
    >
      <div
        className="quick-add-shell"
        style={{
          width: '100%',
          background: 'var(--bg-material, rgba(255, 255, 255, 0.88))',
          backdropFilter: 'blur(35px) saturate(190%)',
          WebkitBackdropFilter: 'blur(35px) saturate(190%)',
          border: isFocused ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-subtle, rgba(0,0,0,0.12))',
          borderRadius: 22,
          boxShadow: isFocused ? '0 12px 36px var(--accent-glow), 0 4px 16px rgba(0,0,0,0.1)' : '0 10px 32px rgba(0,0,0,0.12)',
          padding: '8px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: hasChips ? 8 : 0,
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
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
                <span className="qa-chip qa-chip--price" style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>
                  <Coins size={12} /> {nlp.suggestedPrice.toLocaleString('es-ES')} €
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
              window.dispatchEvent(new CustomEvent('open-ai-assistant', { detail: text }));
            }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: text ? 'var(--accent-primary)' : isFocused ? 'var(--accent-primary)' : 'var(--text-tertiary)',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.2s ease'
            }}
            title="Hablar con la IA / Asistente MCP (Ctrl+J)"
          >
            <Sparkles size={18} />
          </button>

          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
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
            placeholder="Nuevo recordatorio"
            style={{
              flex: 1,
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
            onClick={onExpandDrawer}
            title="Opciones detalladas (editor completo)"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 6,
              borderRadius: 8,
              transition: 'all 0.15s ease'
            }}
          >
            <SlidersHorizontal size={17} />
          </button>

          {/* Quick Submit Button */}
          <button
            type="submit"
            disabled={!text.trim()}
            title="Añadir recordatorio rápido (Enter)"
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: text.trim() ? 'var(--accent-primary)' : 'var(--border-subtle, rgba(0,0,0,0.08))',
              color: text.trim() ? '#ffffff' : 'var(--text-tertiary)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: text.trim() ? 'pointer' : 'default',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: text.trim() ? '0 2px 8px rgba(0, 122, 255, 0.35)' : 'none',
              opacity: text.trim() ? 1 : 0.4
            }}
          >
            <ArrowUp size={15} strokeWidth={2.5} />
          </button>
        </form>
      </div>
    </div>
  );
}
