import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Edit3, Plus, Trash2, FolderPlus, Play } from 'lucide-react';
import { formatSectionTitle } from '../../../utils/sectionRoutine';
import { SpotlightBackdrop, type SpotlightRect } from '../../ui/SpotlightBackdrop';

export interface SectionMenuState {
  open: boolean;
  x: number;
  y: number;
  sectionId?: string;
  sectionName?: string;
  pendingTaskCount?: number;
  color?: string;
  category?: string;
  /** Rectángulo de la cabecera de sección que abrió el menú, para mantenerla nítida sobre el telón. */
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
  // Escape cierra el menú, igual que en TaskContextMenu.
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
  const menuWidth = 235;
  const menuHeight = 220;
  const targetX = Math.min(Math.max(12, sectionMenu.x), window.innerWidth - menuWidth - 12);
  const targetY = Math.min(Math.max(12, sectionMenu.y), window.innerHeight - menuHeight - 12);

  return createPortal(
    <>
      <SpotlightBackdrop
        rect={isMobile ? null : (sectionMenu.triggerRect ?? null)}
        onClose={onClose}
        radius={10}
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
          background: 'var(--bg-elevated, #ffffff)',
          backdropFilter: 'blur(35px) saturate(190%)',
          WebkitBackdropFilter: 'blur(35px) saturate(190%)',
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
          border: '1px solid var(--border-subtle, rgba(0,0,0,0.12))',
          borderRadius: 14,
          background: 'var(--bg-elevated, #ffffff)',
          padding: 6
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {isMobile && (
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-subtle, rgba(142, 142, 147, 0.4))', margin: '0 auto 10px' }} />
        )}

        {/* Section Title Header */}
        <div style={{ padding: '2px 8px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: sectionMenu.color || 'var(--accent-primary)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {formatSectionTitle(sectionMenu.sectionName) || 'Sección'}
          </span>
        </div>
        <div className="ios-dropdown-divider" />
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
