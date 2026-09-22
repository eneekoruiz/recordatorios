import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Edit3, Plus, Trash2, FolderPlus, Play } from 'lucide-react';
import type { SpotlightRect } from '../../ui/SpotlightBackdrop';

export interface SectionMenuState {
  open: boolean;
  x: number;
  y: number;
  sectionId?: string;
  sectionName?: string;
  pendingTaskCount?: number;
  color?: string;
  category?: string;
  /** Rectángulo de la cabecera de sección que abrió el menú. */
  triggerRect?: SpotlightRect | null;
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
  // Escape cierra el menú
  useEffect(() => {
    if (!sectionMenu.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sectionMenu.open, onClose]);

  if (!sectionMenu.open) return null;

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  // Garantizar que no se desborde fuera de la pantalla en móvil o escritorio
  const menuWidth = 230;
  const menuHeight = 220;
  const targetX = Math.min(Math.max(12, sectionMenu.x), window.innerWidth - menuWidth - 12);
  const targetY = Math.min(Math.max(12, sectionMenu.y), window.innerHeight - menuHeight - 12);

  return createPortal(
    <>
      {/* Telón transparente para cerrar con un clic fuera, idéntico al menú de listas y tareas */}
      <div 
        style={{ position: 'fixed', inset: 0, zIndex: 999990, background: 'transparent' }} 
        onClick={onClose} 
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      <motion.div
        className="ios-dropdown-menu"
        initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: -4 }}
        animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
        exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: -4 }}
        transition={{ type: 'spring', damping: 28, stiffness: 450 }}
        drag={isMobile ? "y" : false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.05, bottom: 0.7 }}
        onDragEnd={isMobile ? (_e, info) => {
          if (info.offset.y > 80 || info.velocity.y > 400) {
            onClose();
          }
        } : undefined}
        style={isMobile ? {
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 999995,
          background: 'var(--bg-material, rgba(255,255,255,0.85))',
          backdropFilter: 'blur(30px) saturate(180%)',
          WebkitBackdropFilter: 'blur(30px) saturate(180%)',
          borderTop: '1px solid var(--border-subtle, rgba(0,0,0,0.12))',
          borderRadius: '20px 20px 0 0',
          padding: '12px 16px max(24px, env(safe-area-inset-bottom))',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 4
        } : {
          position: 'fixed',
          left: targetX,
          top: targetY,
          zIndex: 999995,
          minWidth: menuWidth,
          border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
          borderRadius: 14,
          background: 'var(--bg-material, rgba(255,255,255,0.85))',
          backdropFilter: 'blur(30px) saturate(180%)',
          WebkitBackdropFilter: 'blur(30px) saturate(180%)',
          boxShadow: '0 10px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.04)',
          padding: 6,
          scrollbarWidth: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 2
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {isMobile && (
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-subtle, rgba(142, 142, 147, 0.4))', margin: '0 auto 10px' }} />
        )}

        {onStartSequence && (sectionMenu.pendingTaskCount ?? 0) > 0 && (
          <>
            <button 
              type="button"
              className="ios-dropdown-item" 
              onClick={() => { onClose(); onStartSequence(); }}
            >
              <Play size={16} fill="var(--accent-primary)" color="var(--accent-primary)" />
              <span style={{ fontWeight: 600 }}>
                Empezar sección ({sectionMenu.pendingTaskCount})
              </span>
            </button>
            <div className="ios-dropdown-divider" />
          </>
        )}

        {sectionMenu.sectionId && (
          <button 
            type="button"
            className="ios-dropdown-item" 
            onClick={() => { onClose(); onRename(); }}
          >
            <Edit3 size={16} />
            <span>Renombrar sección</span>
          </button>
        )}

        <button 
          type="button"
          className="ios-dropdown-item" 
          onClick={() => { onClose(); onAddTask(); }}
        >
          <Plus size={16} />
          <span>Añadir tarea aquí</span>
        </button>

        {sectionMenu.sectionId && onAddNestedSection && (
          <button 
            type="button"
            className="ios-dropdown-item" 
            onClick={() => { onClose(); onAddNestedSection(); }}
          >
            <FolderPlus size={16} />
            <span>Añadir sección anidada</span>
          </button>
        )}

        {sectionMenu.sectionId && (
          <>
            <div className="ios-dropdown-divider" />
            <button 
              type="button"
              className="ios-dropdown-item danger" 
              onClick={() => { onClose(); onDelete(); }}
            >
              <Trash2 size={16} />
              <span>Eliminar sección</span>
            </button>
          </>
        )}
      </motion.div>
    </>,
    document.body
  );
};
