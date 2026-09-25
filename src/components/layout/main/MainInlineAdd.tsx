import React, { useState } from 'react';
import { Plus, Calendar, Clock, Flag, Sparkles } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { HapticService } from '../../../services/HapticService';
import { extractPrice } from '../../../utils/priceExtractor';
import { parseNaturalLanguage } from '../../../utils/nlpParser';
import { getGroceryCategory } from '../../../utils/specialLists';

interface MainInlineAddProps {
  currentView: string;
  viewColor: string;
  isInlineAdding: boolean;
  setIsInlineAdding: (val: boolean) => void;
  inlineTitle: string;
  setInlineTitle: (val: string) => void;
  inlineInputRef: React.RefObject<HTMLInputElement | null>;
}

export const MainInlineAdd: React.FC<MainInlineAddProps> = ({
  currentView,
  viewColor,
  isInlineAdding,
  setIsInlineAdding,
  inlineTitle,
  setInlineTitle,
  inlineInputRef
}) => {
  const [selectedDueDate, setSelectedDueDate] = useState<string | undefined>(undefined);
  const [selectedPriority, setSelectedPriority] = useState<'none' | 'low' | 'medium' | 'high'>('none');

  if (currentView === 'TRASH' || currentView === 'smart_completed') {
    return null;
  }

  const handleCommitTask = () => {
    if (inlineTitle.trim()) {
      const rawText = inlineTitle.trim();
      setInlineTitle('');
      const priceResult = extractPrice(rawText, false);
      const newTaskTitle = (priceResult && priceResult.cleanText) ? priceResult.cleanText : rawText;
      const extractedPrice = (priceResult && priceResult.price > 0) ? priceResult.price : undefined;

      const defaultCategoryId = currentView.startsWith('list_') ? currentView.replace('list_', '') : undefined;
      
      let dueDate: string | undefined = selectedDueDate;
      if (!dueDate) {
        const nlp = parseNaturalLanguage(rawText);
        if (nlp.dueDate) {
          dueDate = nlp.dueDate;
        } else if (currentView === 'smart_today') {
          const today = new Date();
          today.setHours(12, 0, 0, 0);
          dueDate = today.toISOString();
        }
      }

      // Auto-categorización en listas de la compra (Apple iOS 17 Grocery feature)
      let sectionId: string | undefined = undefined;
      const { lists, listSections, addListSection, addTask } = useAppStore.getState();
      const currentListObj = defaultCategoryId ? lists?.find(l => l.id === defaultCategoryId) : null;
      const isShopping = defaultCategoryId === 'compras' || defaultCategoryId === 'compra' || 
                         (currentListObj && (currentListObj.name || '').toLowerCase().includes('compra'));

      if (isShopping) {
        const suggestedSecName = getGroceryCategory(newTaskTitle);
        if (suggestedSecName) {
          const existingSec = (listSections || []).find(
            s => s.listId === defaultCategoryId && (s.name || '').toLowerCase() === suggestedSecName.toLowerCase() && !s.deleted_at
          );
          if (existingSec) {
            sectionId = existingSec.id;
          } else if (defaultCategoryId) {
            const newSecId = `sec_compra_${suggestedSecName.toLowerCase().replace(/\s+/g, '_')}`;
            addListSection({
              id: newSecId,
              listId: defaultCategoryId,
              name: suggestedSecName,
              order: 99
            });
            sectionId = newSecId;
          }
        }
      }

      addTask({
        id: crypto.randomUUID(),
        title: newTaskTitle,
        categoryId: defaultCategoryId,
        sectionId,
        dueDate,
        priority: selectedPriority !== 'none' ? selectedPriority : undefined,
        flagged: selectedPriority === 'high',
        price: extractedPrice,
        completed: false,
        created_at: new Date().toISOString()
      } as any);

      setSelectedDueDate(undefined);
      setSelectedPriority('none');
      HapticService.selection();
      return true;
    }
    return false;
  };

  return (
    <div style={{ padding: '6px 16px 14px', width: '100%', boxSizing: 'border-box' }}>
      {isInlineAdding ? (
        <div 
          style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '10px 12px',
            borderRadius: 14,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            gap: 10
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 22, height: 22,
              borderRadius: '50%',
              border: `1.5px solid ${viewColor}`,
              flexShrink: 0
            }} />
            <input
              ref={inlineInputRef}
              type="text"
              value={inlineTitle}
              placeholder="Nuevo recordatorio..."
              onChange={(e) => setInlineTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const added = handleCommitTask();
                  if (added) {
                    setTimeout(() => inlineInputRef.current?.focus(), 50);
                  } else {
                    setIsInlineAdding(false);
                  }
                } else if (e.key === 'Escape') {
                  setIsInlineAdding(false);
                  setInlineTitle('');
                  setSelectedDueDate(undefined);
                  setSelectedPriority('none');
                }
              }}
              onBlur={(e) => {
                // Si el foco pasa a un chip rápido dentro del mismo componente, no cancelar
                if (e.relatedTarget && (e.relatedTarget as HTMLElement).closest('.apple-quick-chip')) {
                  return;
                }
                handleCommitTask();
                setIsInlineAdding(false);
              }}
              style={{
                fontSize: '1.02rem',
                fontWeight: 400,
                width: '100%',
                border: 'none',
                background: 'transparent',
                outline: 'none',
                color: 'var(--text-primary)',
                padding: 0
              }}
            />
          </div>

          {/* Barra de chips rápidos Apple Reminders */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 6, 
            flexWrap: 'wrap', 
            paddingTop: 6, 
            borderTop: '1px solid var(--border-subtle, rgba(0,0,0,0.06))' 
          }}>
            <button
              type="button"
              className={`apple-quick-chip ${selectedDueDate ? 'active' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                HapticService.selection();
                const today = new Date();
                today.setHours(12, 0, 0, 0);
                setSelectedDueDate(prev => prev ? undefined : today.toISOString());
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px',
                borderRadius: 999,
                fontSize: '0.74rem',
                fontWeight: 600,
                border: selectedDueDate ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                background: selectedDueDate ? 'rgba(0, 122, 255, 0.12)' : 'var(--bg-hover, rgba(0,0,0,0.03))',
                color: selectedDueDate ? 'var(--accent-primary)' : 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              <Calendar size={12} />
              <span>Hoy</span>
            </button>

            <button
              type="button"
              className="apple-quick-chip"
              onMouseDown={(e) => {
                e.preventDefault();
                HapticService.selection();
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(12, 0, 0, 0);
                setSelectedDueDate(tomorrow.toISOString());
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px',
                borderRadius: 999,
                fontSize: '0.74rem',
                fontWeight: 600,
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-hover, rgba(0,0,0,0.03))',
                color: 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              <Calendar size={12} />
              <span>Mañana</span>
            </button>

            <button
              type="button"
              className="apple-quick-chip"
              onMouseDown={(e) => {
                e.preventDefault();
                HapticService.selection();
                const date = new Date(selectedDueDate || Date.now());
                date.setHours(9, 0, 0, 0);
                setSelectedDueDate(date.toISOString());
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px',
                borderRadius: 999,
                fontSize: '0.74rem',
                fontWeight: 600,
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-hover, rgba(0,0,0,0.03))',
                color: 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              <Clock size={12} />
              <span>09:00</span>
            </button>

            <button
              type="button"
              className={`apple-quick-chip ${selectedPriority === 'high' ? 'active' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                HapticService.selection();
                setSelectedPriority(prev => prev === 'high' ? 'none' : 'high');
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px',
                borderRadius: 999,
                fontSize: '0.74rem',
                fontWeight: 600,
                border: selectedPriority === 'high' ? '1px solid var(--accent-orange, #ff9500)' : '1px solid var(--border-subtle)',
                background: selectedPriority === 'high' ? 'rgba(255, 149, 0, 0.15)' : 'var(--bg-hover, rgba(0,0,0,0.03))',
                color: selectedPriority === 'high' ? 'var(--accent-orange, #ff9500)' : 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              <Flag size={12} fill={selectedPriority === 'high' ? 'currentColor' : 'none'} />
              <span>Urgente</span>
            </button>

            {/* Hint sutil para la compra si detecta categoría */}
            {(() => {
              const groceryCat = getGroceryCategory(inlineTitle);
              if (groceryCat && (currentView.includes('compra') || currentView === 'list_compras')) {
                return (
                  <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <Sparkles size={11} />
                    <span>{groceryCat}</span>
                  </span>
                );
              }
              return null;
            })()}
          </div>
        </div>
      ) : (
        <div 
          onClick={() => {
            setIsInlineAdding(true);
            setTimeout(() => inlineInputRef.current?.focus(), 50);
          }}
          className="apple-inline-add-row"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 12,
            cursor: 'pointer',
            color: 'var(--text-tertiary)',
            fontSize: '0.95rem',
            background: 'transparent',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{
            width: 22, height: 22, borderRadius: '50%',
            border: '1.5px dashed var(--border-color)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0
          }}>
            <Plus size={13} color="var(--text-tertiary)" />
          </div>
          <span style={{ fontWeight: 500 }}>Nuevo recordatorio</span>
        </div>
      )}
    </div>
  );
};
