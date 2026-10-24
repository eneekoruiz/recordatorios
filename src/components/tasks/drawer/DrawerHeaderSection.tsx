import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Mic, MicOff, Calendar as CalendarIcon, Repeat, Flag, Sparkles, X } from 'lucide-react';
import { CustomSelect } from '../../ui/CustomSelect';
import type { TaskItem, CustomList } from '../../../models/Task';
import type { HabitSuggestion } from '../../../utils/habitSuggestions';
import { focusOnMount } from '../../../utils/focusOnMount';

interface DrawerHeaderSectionProps {
  taskId?: string;
  task?: TaskItem;
  title: string;
  setTitle: (title: string) => void;
  notes: string;
  setNotes: (notes: string) => void;
  isListening: boolean;
  toggleListening: () => void;
  suggestedChips: { type: 'time' | 'date' | 'cycle' | 'priority' | 'category'; label: string }[];
  category: string;
  setCategory: (category: string) => void;
  type: 'task' | 'log';
  setType: (type: 'task' | 'log') => void;
  lists: CustomList[];
  habitSuggestion?: HabitSuggestion | null;
  onApplyHabitSuggestion?: () => void;
  onDismissHabitSuggestion?: () => void;
}

export const DrawerHeaderSection: React.FC<DrawerHeaderSectionProps> = ({
  taskId,
  title,
  setTitle,
  notes,
  setNotes,
  isListening,
  toggleListening,
  suggestedChips,
  category,
  setCategory,
  type,
  setType,
  lists,
  habitSuggestion,
  onApplyHabitSuggestion,
  onDismissHabitSuggestion
}) => {
  return (
    <>
      <div className="input-group" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <motion.input 
            layoutId={taskId ? "task-title-" + taskId : undefined}
            type="text" 
            className="title-input" 
            placeholder="Título · p. ej. «Pastillas mañana 9:00»" 
            value={title}
            onChange={e => setTitle(e.target.value)}
            // Solo al crear: al abrir una tarea existente, el teclado tapaba media hoja en el móvil.
            ref={taskId ? undefined : focusOnMount}
            aria-label="Título de la tarea con reconocimiento de horas"
            style={{ flex: 1 }}
          />
          <button 
            type="button"
            onClick={toggleListening} 
            aria-label="Dictar por voz"
            style={{ background: 'none', border: 'none', color: isListening ? '#ff3b30' : 'var(--accent-blue)', cursor: 'pointer', padding: '0 16px' }}
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
              {chip.type === 'priority' && <Flag size={12} />}
              {chip.label}
            </div>
          ))}
        </div>
      )}

      {/* Sugerencia inteligente de conversión a hábito recurrente */}
      {habitSuggestion && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '8px 12px',
            marginBottom: '16px',
            borderRadius: '12px',
            background: 'rgba(255, 149, 0, 0.08)',
            border: '1px solid rgba(255, 149, 0, 0.25)',
            fontSize: '0.8rem',
            color: 'var(--text-primary)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
            <Sparkles size={15} style={{ color: '#ff9500', flexShrink: 0 }} />
            <span style={{ lineHeight: 1.3 }}>
              ¿Convertir en hábito de <strong>{habitSuggestion.targetCount} veces al {habitSuggestion.periodName}</strong>?
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <button
              type="button"
              onClick={onApplyHabitSuggestion}
              style={{
                background: '#ff9500',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '4px 10px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Convertir
            </button>
            {onDismissHabitSuggestion && (
              <button
                type="button"
                onClick={onDismissHabitSuggestion}
                title="Ignorar sugerencia"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* List and Type pickers */}
      <div className="details-group" style={{ marginBottom: '20px' }}>
        <div className="detail-row" style={{ padding: '12px 0' }}>
          <span className="detail-label">Lista</span>
          <CustomSelect 
            className="detail-select"
            value={category}
            onChange={val => setCategory(val)}
            options={[
              ...lists.map(list => ({ value: list.id, label: list.name })),
              { value: 'inbox', label: 'Bandeja de entrada' }
            ]}
          />
        </div>
        
        {(category === 'que_he_hecho' || type === 'log') && (
          <>
            <div className="divider"></div>
            <div className="detail-row" style={{ padding: '12px 0' }}>
              <span className="detail-label">Tipo</span>
              <CustomSelect 
                className="detail-select"
                value={type}
                onChange={val => setType(val as 'task' | 'log')}
                options={[
                  { value: 'task', label: 'Tarea por hacer' },
                  { value: 'log', label: 'Algo que ya hice' }
                ]}
              />
            </div>
          </>
        )}
      </div>
    </>
  );
};
