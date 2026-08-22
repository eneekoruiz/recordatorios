import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Sparkles, SlidersHorizontal, ArrowUp } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { parseNaturalLanguage } from '../../utils/nlp';
import { SoundService } from '../../services/SoundService';

interface QuickAddBarProps {
  currentView: string;
  onExpandDrawer: () => void;
}

export function QuickAddBar({ currentView, onExpandDrawer }: QuickAddBarProps) {
  const [text, setText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const addTask = useAppStore(state => state.addTask);
  const lists = useAppStore(state => state.lists);
  const cycles = useAppStore(state => state.cycles);

  const nlp = parseNaturalLanguage(text);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanTitle = nlp.cleanTitle || text.trim();
    if (!cleanTitle) return;

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
    const alerts = nlp.times.map(t => ({
      id: `alert_${Date.now()}_${t}`,
      type: 'at_time' as const,
      time: t
    }));

    addTask({
      id: crypto.randomUUID(),
      title: cleanTitle,
      categoryId: targetCategory,
      cycle_id: targetCycleId,
      dueDate: targetDueDate,
      priority: nlp.suggestedPriority || 'none',
      alerts: alerts.length > 0 ? alerts : undefined,
      status: 'pending',
      created_at: new Date().toISOString()
    });

    SoundService.playPop();
    setText('');
    inputRef.current?.blur();
  };

  const hasChips = nlp.times.length > 0 || nlp.suggestedDueDate || nlp.suggestedCycleId || nlp.suggestedPriority || nlp.suggestedCategory;

  return (
    <div 
      style={{
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '12px 16px',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        background: 'linear-gradient(to top, var(--bg-elevated) 70%, transparent)',
        zIndex: 50,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '720px',
          background: 'var(--bg-surface-glass)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: isFocused ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-color)',
          borderRadius: 20,
          boxShadow: isFocused ? '0 8px 30px var(--accent-glow), 0 2px 10px rgba(0,0,0,0.06)' : '0 4px 20px rgba(0,0,0,0.06)',
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
                <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'var(--accent-glow)', color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  📅 {nlp.suggestedDueDate.toLocaleDateString()}
                </span>
              )}
              {nlp.times.map(t => (
                <span key={t} style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'var(--accent-glow)', color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  ⏰ {t}
                </span>
              ))}
              {nlp.suggestedPriority && (
                <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'rgba(255, 59, 48, 0.15)', color: 'var(--accent-red)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  🚨 Prioridad {nlp.suggestedPriority}
                </span>
              )}
              {nlp.suggestedCategory && (
                <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'rgba(52, 199, 89, 0.15)', color: 'var(--accent-green)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  📁 @{nlp.suggestedCategory}
                </span>
              )}
              {nlp.suggestedCycleId && (
                <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'rgba(255, 149, 0, 0.15)', color: 'var(--accent-orange)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  🔄 Ciclo
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
          <div style={{ color: isFocused ? 'var(--accent-primary)' : 'var(--text-tertiary)', display: 'flex', alignItems: 'center', transition: 'color 0.2s' }}>
            <Sparkles size={18} />
          </div>

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
                  // create rest as new tasks
                  lines.slice(1).forEach(line => {
                    const extracted = parseNaturalLanguage(line, lists);
                    addTask({
                      id: crypto.randomUUID(),
                      title: extracted.title,
                      categoryId: extracted.categoryId || currentListId || undefined,
                      type: 'task',
                      completed: false,
                      priority: extracted.priority || 'none',
                      dueDate: extracted.dueDate || undefined,
                      created_at: new Date().toISOString()
                    } as any);
                  });
                }
              }
            }}
            placeholder="Añadir rápido: 'Comprar pan mañana a las 18:00 !alta'..."
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: '0.95rem',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
              padding: '4px 0'
            }}
          />

          {/* Expand into full drawer */}
          <button
            type="button"
            onClick={onExpandDrawer}
            title="Opciones detalladas"
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
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: text.trim() ? 'var(--accent-primary)' : 'var(--border-color)',
              color: 'white',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: text.trim() ? 'pointer' : 'default',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              transform: text.trim() ? 'scale(1)' : 'scale(0.9)',
              opacity: text.trim() ? 1 : 0.4
            }}
          >
            <ArrowUp size={16} strokeWidth={2.5} />
          </button>
        </form>
      </div>
    </div>
  );
}
