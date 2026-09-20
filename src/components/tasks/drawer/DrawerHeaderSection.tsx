import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Mic, MicOff, Calendar as CalendarIcon, Repeat } from 'lucide-react';
import { CustomSelect } from '../../ui/CustomSelect';
import type { TaskItem, CustomList } from '../../../models/Task';

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
  lists
}) => {
  return (
    <>
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
            type="button"
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
          <span className="detail-label">Lista</span>
          <CustomSelect 
            className="detail-select"
            value={category}
            onChange={val => setCategory(val)}
            options={[
              ...lists.map(list => ({ value: list.id, label: list.name })),
              { value: 'inbox', label: 'Bandeja de Entrada' }
            ]}
          />
        </div>
        
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
      </div>
    </>
  );
};
