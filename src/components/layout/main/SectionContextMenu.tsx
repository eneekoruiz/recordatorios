import React from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Edit3, Plus, Trash2 } from 'lucide-react';

interface SectionContextMenuProps {
  sectionMenu: { open: boolean; x: number; y: number; sectionId?: string; sectionName?: string };
  onClose: () => void;
  onRename: () => void;
  onAddTask: () => void;
  onDelete: () => void;
}

export const SectionContextMenu: React.FC<SectionContextMenuProps> = ({
  sectionMenu,
  onClose,
  onRename,
  onAddTask,
  onDelete
}) => {
  if (!sectionMenu.open) return null;

  return createPortal(
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 999990 }}
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      <motion.div
        className="ios-dropdown-menu glass-panel"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        style={{
          position: 'fixed',
          left: Math.min(sectionMenu.x, window.innerWidth - 220),
          top: Math.min(sectionMenu.y, window.innerHeight - 150),
          zIndex: 999995,
          minWidth: 200,
          boxShadow: '0 12px 36px rgba(0,0,0,0.3)',
          border: '1px solid var(--border-subtle, rgba(255,255,255,0.15))',
          borderRadius: 12,
          background: 'var(--bg-elevated, #1c1c1e)',
          padding: 6
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="ios-dropdown-item" onClick={onRename}>
          <Edit3 size={16} /> Renombrar sección
        </button>
        <button className="ios-dropdown-item" onClick={onAddTask}>
          <Plus size={16} /> Añadir tarea aquí
        </button>
        {sectionMenu.sectionId && (
          <>
            <div className="ios-dropdown-divider" style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 0' }} />
            <button className="ios-dropdown-item danger" style={{ color: 'var(--accent-red)' }} onClick={onDelete}>
              <Trash2 size={16} /> Eliminar sección
            </button>
          </>
        )}
      </motion.div>
    </>,
    document.body
  );
};
