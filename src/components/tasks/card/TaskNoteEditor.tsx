import React from 'react';
import { LayoutList } from 'lucide-react';
import type { TaskItem, CustomList } from '../../../models/Task';

interface TaskNoteEditorProps {
  task: TaskItem;
  isEditingNote: boolean;
  isEditingTitle: boolean;
  editNote: string;
  setEditNote: (v: string) => void;
  handleNoteSubmit: () => void;
  startEditingNote: () => void;
  isHovered: boolean;
  isEffectivelyDone: boolean;
  lists?: CustomList[];
  onNavigateView?: (viewId: string) => void;
}

export const TaskNoteEditor: React.FC<TaskNoteEditorProps> = ({
  task,
  isEditingNote,
  isEditingTitle,
  editNote,
  setEditNote,
  handleNoteSubmit,
  startEditingNote,
  isHovered,
  isEffectivelyDone,
  lists,
  onNavigateView
}) => {
  if (!task.description && !isEditingNote && !isEditingTitle) {
    return null;
  }

  return (
    <div style={{ marginTop: 2 }}>
      {isEditingNote ? (
        <textarea
          className="task-note-textarea"
          ref={(el) => {
            if (el && isEditingNote) {
              setTimeout(() => {
                el.focus();
                el.style.height = 'auto';
                el.style.height = `${el.scrollHeight}px`;
              }, 50);
            }
          }}
          value={editNote}
          autoFocus
          placeholder="Añadir nota..."
          onChange={e => {
            setEditNote(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          onBlur={handleNoteSubmit}
          onKeyDown={e => {
            e.stopPropagation();
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleNoteSubmit();
            }
          }}
          onClick={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
          onPointerDownCapture={e => e.stopPropagation()}
          onFocus={e => {
            const val = e.target.value;
            e.target.value = '';
            e.target.value = val;
          }}
          style={{
            fontSize: '0.84rem',
            lineHeight: '1.35',
            width: '100%',
            border: 'none',
            background: 'transparent',
            outline: 'none',
            boxShadow: 'none',
            WebkitBoxShadow: 'none',
            color: 'var(--text-secondary)',
            padding: 0,
            margin: 0,
            resize: 'none',
            minHeight: 18,
            fontFamily: 'inherit',
            display: 'block'
          }}
        />
      ) : (
        <span
          className="task-note-preview"
          onClick={(e) => { e.stopPropagation(); startEditingNote(); }}
          style={{
            fontSize: '0.84rem',
            lineHeight: '1.35',
            color: task.description ? 'var(--text-secondary)' : 'var(--text-tertiary)',
            opacity: task.description ? 1 : (isHovered || isEditingTitle ? 0.8 : 0.4),
            wordBreak: 'break-word',
            cursor: 'text',
            display: 'block',
            minHeight: (task.description || !isEffectivelyDone) ? 18 : 0,
            padding: 0,
            margin: 0,
            outline: 'none',
            border: 'none',
            boxShadow: 'none',
            WebkitBoxShadow: 'none',
            boxSizing: 'border-box'
          }}
        >
          {task.description ? (
            task.description.split(/(https?:\/\/[^\s]+|app:\/\/[^\s]+)/g).map((part, i) => {
              const isCareLink = part.startsWith('app://list/care') || (part.includes('icloud.com/reminders') && part.includes('Care'));
              const isAppList = part.startsWith('app://list/');
              if (isCareLink || isAppList) {
                const targetListId = isCareLink ? 'care' : part.replace('app://list/', '');
                const targetList = lists?.find(l => l.id === targetListId);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onNavigateView?.(`list_${targetListId}`);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: 'rgba(0, 122, 255, 0.12)',
                      color: 'var(--accent-primary)',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      margin: '2px 4px 2px 0',
                      verticalAlign: 'middle'
                    }}
                  >
                    <LayoutList size={12} />
                    <span>Abrir lista {targetList?.name || targetListId}</span>
                  </button>
                );
              }
              if (part.startsWith('app://')) {
                return null;
              }
              if (part.match(/^https?:\/\//)) {
                return (
                  <a key={i} href={part} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>
                    {part}
                  </a>
                );
              }
              return part;
            })
          ) : (!isEffectivelyDone ? 'Añadir nota...' : '')}
        </span>
      )}
    </div>
  );
};
