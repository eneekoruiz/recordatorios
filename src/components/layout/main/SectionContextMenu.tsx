import React from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Edit3, Plus, Trash2, FolderPlus, Play } from 'lucide-react';

export interface SectionMenuState {
  open: boolean;
  x: number;
  y: number;
  sectionId?: string;
  sectionName?: string;
  pendingTaskCount?: number;
  color?: string;
  category?: string;
}

interface SectionContextMenuProps {
  sectionMenu: SectionMenuState;
  onClose: () => void;
  onRename: () => void;
  onAddTask: () => void;
  onAddNestedSection?: () => void;
  onStartSequence?: () => void;
  onDelete: () => void;
}

export const SectionContextMenu: React.FC<SectionContextMenuProps> = ({
  sectionMenu,
  onClose,
  onRename,
  onAddTask,
  onAddNestedSection,
  onStartSequence,
  onDelete
}) => {
  if (!sectionMenu.open) return null;

  // Garantizar que no se desborde fuera de la pantalla en móvil o escritorio
  const menuWidth = 235;
  const menuHeight = 220;
  const targetX = Math.min(Math.max(12, sectionMenu.x), window.innerWidth - menuWidth - 12);
  const targetY = Math.min(Math.max(12, sectionMenu.y), window.innerHeight - menuHeight - 12);

  return createPortal(
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 999990, background: 'rgba(0,0,0,0.18)' }}
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      <motion.div
        className="ios-dropdown-menu"
        initial={{ opacity: 0, scale: 0.95, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -4 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={{
          position: 'fixed',
          left: targetX,
          top: targetY,
          zIndex: 999995,
          minWidth: menuWidth,
          boxShadow: '0 16px 44px rgba(0,0,0,0.22), 0 4px 14px rgba(0,0,0,0.1)',
          border: '1px solid var(--border-subtle, rgba(0,0,0,0.12))',
          borderRadius: 14,
          background: 'var(--bg-elevated, #ffffff)',
          padding: 6
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {onStartSequence && (sectionMenu.pendingTaskCount ?? 0) > 0 && (
          <>
            <button 
              className="ios-dropdown-item" 
              onClick={() => { onClose(); onStartSequence(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}
            >
              <Play size={15} fill={sectionMenu.color || '#007AFF'} color={sectionMenu.color || '#007AFF'} />
              <span style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                Empezar sección ({sectionMenu.pendingTaskCount})
              </span>
            </button>
            <div className="ios-dropdown-divider" />
          </>
        )}

        {sectionMenu.sectionId && (
          <button 
            className="ios-dropdown-item" 
            onClick={() => { onClose(); onRename(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}
          >
            <Edit3 size={15} color="var(--text-secondary)" />
            <span style={{ whiteSpace: 'nowrap' }}>Renombrar sección</span>
          </button>
        )}

        <button 
          className="ios-dropdown-item" 
          onClick={() => { onClose(); onAddTask(); }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}
        >
          <Plus size={15} color="var(--text-secondary)" />
          <span style={{ whiteSpace: 'nowrap' }}>Añadir tarea aquí</span>
        </button>

        {sectionMenu.sectionId && onAddNestedSection && (
          <button 
            className="ios-dropdown-item" 
            onClick={() => { onClose(); onAddNestedSection(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}
          >
            <FolderPlus size={15} color="var(--text-secondary)" />
            <span style={{ whiteSpace: 'nowrap' }}>Añadir sección anidada</span>
          </button>
        )}

        {sectionMenu.sectionId && (
          <>
            <div className="ios-dropdown-divider" />
            <button 
              className="ios-dropdown-item danger" 
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', color: 'var(--accent-red)' }} 
              onClick={() => { onClose(); onDelete(); }}
            >
              <Trash2 size={15} />
              <span style={{ whiteSpace: 'nowrap' }}>Eliminar sección</span>
            </button>
          </>
        )}
      </motion.div>
    </>,
    document.body
  );
};
