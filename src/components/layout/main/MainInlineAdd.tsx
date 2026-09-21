import React from 'react';
import { Plus } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { HapticService } from '../../../services/HapticService';
import { extractPrice } from '../../../utils/priceExtractor';
import { parseNaturalLanguage } from '../../../utils/nlpParser';

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
      let dueDate: string | undefined = undefined;
      const nlp = parseNaturalLanguage(rawText);
      if (nlp.dueDate) {
        dueDate = nlp.dueDate;
      } else if (currentView === 'smart_today') {
        const today = new Date();
        today.setHours(12, 0, 0, 0);
        dueDate = today.toISOString();
      }
      const { addTask } = useAppStore.getState();
      addTask({
        id: crypto.randomUUID(),
        title: newTaskTitle,
        categoryId: defaultCategoryId,
        dueDate,
        price: extractedPrice,
        completed: false,
        created_at: new Date().toISOString()
      } as any);
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
            alignItems: 'center',
            padding: '8px 12px',
            borderRadius: 12,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            gap: 8
          }}
        >
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
            placeholder="Nuevo recordatorio"
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
              }
            }}
            onBlur={() => {
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
