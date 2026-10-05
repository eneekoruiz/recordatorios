import { CheckSquare } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { 
  Edit3, 
  Plus, 
  Trash2, 
  FolderPlus, 
  Play,
  ArrowUp,
  ArrowDown,
  CheckCheck,
  RotateCcw,
  ArrowUpDown,
  FolderInput,
  ChevronRight,
  Copy,
  Eraser,
  ArrowLeft,
  Zap,
  Calendar,
  Layers
} from 'lucide-react';
import { SpotlightBackdrop, type SpotlightRect } from '../../ui/SpotlightBackdrop';
import { HapticService } from '../../../services/HapticService';
import { useFitMenuInViewport } from '../../../hooks/useFitMenuInViewport';
import type { CustomList, ListSection } from '../../../models/Task';

export interface SectionMenuState {
  open: boolean;
  x: number;
  y: number;
  sectionId?: string;
  sectionName?: string;
  pendingTaskCount?: number;
  sectionTaskIds?: string[];
  color?: string;
  category?: string;
  /** Rectángulo de la cabecera de sección que abrió el menú. */
  triggerRect?: SpotlightRect | null;
  /** La cabecera en sí: el hueco nítido la sigue si la lista se desplaza. */
  getTriggerElement?: () => HTMLElement | null;
}

export interface SectionContextMenuProps {
  sectionMenu: SectionMenuState;
  onClose: () => void;
  onRename?: () => void;
  onAddTask?: () => void;
  onAddNestedSection?: () => void;
  onStartSequence?: () => void;
  onDelete?: () => void;

  // Acciones avanzadas de sección
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  taskCount?: number;
  allCompleted?: boolean;
  onToggleAllCompleted?: () => void;
  onDuplicateSection?: () => void;
  onEmptySection?: () => void;
  onSortTasks?: (criteria: 'priority' | 'dueDate' | 'title') => void;
  onMoveAllTasks?: (targetListId: string, targetSectionId?: string) => void;
  lists?: CustomList[];
  sections?: ListSection[];
}

function SubmenuHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px 6px' }}>
      <button
        type="button"
        onClick={onBack}
        aria-label="Volver al menú anterior"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'transparent',
          border: 'none',
          color: 'var(--accent-primary)',
          cursor: 'pointer',
          fontSize: '0.88rem',
          fontWeight: 600,
          padding: '4px 6px',
          borderRadius: 6
        }}
      >
        <ArrowLeft size={16} /> Volver
      </button>
      <span style={{ flex: 1, textAlign: 'center', fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-secondary)', marginRight: 24 }}>
        {title}
      </span>
    </div>
  );
}

export const SectionContextMenu: React.FC<SectionContextMenuProps> = ({
  sectionMenu,
  onClose,
  onRename,
  onAddTask,
  onAddNestedSection,
  onStartSequence,
  onDelete,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
  taskCount = 0,
  allCompleted = false,
  onToggleAllCompleted,
  onDuplicateSection,
  onEmptySection,
  onSortTasks,
  onMoveAllTasks,
  lists = [],
  sections = [],
}) => {
  const [currentSubmenu, setCurrentSubmenu] = useState<'main' | 'sort' | 'move_tasks'>('main');
  const sheetRef = useRef<HTMLDivElement>(null);
  // Escritorio: con su altura real, el menú cabe siempre (debajo, encima o pegado al borde).
  useFitMenuInViewport(sheetRef, sectionMenu.triggerRect, sectionMenu.open && window.innerWidth > 768);

  // Al cerrarse, el menú vuelve a su pantalla principal (se ajusta durante el render).
  if (!sectionMenu.open && currentSubmenu !== 'main') {
    setCurrentSubmenu('main');
  }

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

  // Dimensiones seguras
  const menuWidth = 260;
  const menuHeight = 360;
  const trigger = sectionMenu.triggerRect;
  const targetX = Math.min(Math.max(12, sectionMenu.x), window.innerWidth - menuWidth - 12);
  let targetY = sectionMenu.y;

  // Si colocarlo abajo sobrepasa la pantalla pero hay espacio arriba, lo colocamos arriba para no tapar nunca la cabecera
  if (trigger && !isMobile) {
    const spaceBelow = Math.max(0, window.innerHeight - (trigger.top + trigger.height + 6) - 12);
    const spaceAbove = Math.max(0, trigger.top - 6 - 12);
    if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
      targetY = Math.max(12, trigger.top - Math.min(menuHeight, spaceAbove) - 6);
    } else {
      targetY = trigger.top + trigger.height + 6;
    }
  }

  return createPortal(
    <>
      <SpotlightBackdrop
        rect={sectionMenu.triggerRect ?? null}
        getTarget={sectionMenu.getTriggerElement}
        sheetRef={isMobile ? sheetRef : undefined}
        onClose={onClose}
        onWheel={onClose}
        radius={10}
        padding={0}
      />
      <motion.div
        ref={sheetRef}
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
          gap: 4,
          maxHeight: '85vh',
          overflowY: 'auto',
          overflowX: 'hidden'
        } : {
          position: 'fixed',
          left: targetX,
          top: targetY,
          zIndex: 999995,
          width: menuWidth,
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
          gap: 2,
          maxHeight: trigger && targetY < trigger.top
            ? `${Math.max(160, trigger.top - targetY - 6)}px`
            : `calc(100dvh - ${targetY}px - 16px)`,
          overflowY: 'auto',
          overflowX: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {isMobile && (
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-subtle, rgba(142, 142, 147, 0.4))', margin: '0 auto 10px', flexShrink: 0 }} />
        )}

        {/* SUBMENÚ: ORDENAR TAREAS */}
        {currentSubmenu === 'sort' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <SubmenuHeader title="Ordenar tareas" onBack={() => setCurrentSubmenu('main')} />
            <div className="ios-dropdown-divider" />
            <button
              type="button"
              className="ios-dropdown-item"
              onClick={() => {
                HapticService.selection();
                onSortTasks?.('priority');
                onClose();
              }}
            >
              <Zap size={16} color="#FF3B30" />
              <span>Por prioridad / urgencia</span>
            </button>
            <button
              type="button"
              className="ios-dropdown-item"
              onClick={() => {
                HapticService.selection();
                onSortTasks?.('dueDate');
                onClose();
              }}
            >
              <Calendar size={16} color="#007AFF" />
              <span>Por fecha límite</span>
            </button>
            <button
              type="button"
              className="ios-dropdown-item"
              onClick={() => {
                HapticService.selection();
                onSortTasks?.('title');
                onClose();
              }}
            >
              <ArrowUpDown size={16} color="#34C759" />
              <span>Alfabéticamente (A-Z)</span>
            </button>
          </div>
        )}

        {/* SUBMENÚ: MOVER TAREAS A... */}
        {currentSubmenu === 'move_tasks' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <SubmenuHeader title="Mover tareas a..." onBack={() => setCurrentSubmenu('main')} />
            <div className="ios-dropdown-divider" />
            <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, padding: '2px 0' }}>
              {/* Secciones en la lista actual */}
              {sections && sections.filter(s => s.id !== sectionMenu.sectionId && !s.deleted_at).length > 0 && (
                <>
                  <div style={{ padding: '4px 10px 2px', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                    En esta lista
                  </div>
                  {sections
                    .filter(s => s.id !== sectionMenu.sectionId && !s.deleted_at)
                    .map(sec => (
                      <button
                        key={sec.id}
                        type="button"
                        className="ios-dropdown-item"
                        onClick={() => {
                          HapticService.impact('medium');
                          onMoveAllTasks?.(sec.listId, sec.id);
                          onClose();
                        }}
                        style={{ gap: 8 }}
                      >
                        <Layers size={15} color="var(--accent-primary)" />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sec.name}
                        </span>
                      </button>
                    ))}
                  <div className="ios-dropdown-divider" />
                </>
              )}

              {/* Otras listas disponibles */}
              <div style={{ padding: '4px 10px 2px', fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                Otras listas
              </div>
              {lists?.map(l => (
                <button
                  key={l.id}
                  type="button"
                  className="ios-dropdown-item"
                  onClick={() => {
                    HapticService.impact('medium');
                    onMoveAllTasks?.(l.id, undefined);
                    onClose();
                  }}
                  style={{ gap: 8 }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: l.color || 'var(--accent-primary)', flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* MENÚ PRINCIPAL */}
        {currentSubmenu === 'main' && (
          <>
            {/* Subir / Bajar (plegar ya se hace tocando la cabecera). Solo si hay otras secciones. */}
            {(canMoveUp || canMoveDown) && (
              <>
                <div className="section-move-bar">
                  <button
                    type="button"
                    className="section-move-btn"
                    disabled={!canMoveUp}
                    onClick={() => {
                      HapticService.selection();
                      onMoveUp?.();
                      onClose();
                    }}
                    title={canMoveUp ? 'Subir sección' : 'Ya es la primera'}
                  >
                    <ArrowUp size={15} aria-hidden="true" />
                    <span>Subir</span>
                  </button>
                  <button
                    type="button"
                    className="section-move-btn"
                    disabled={!canMoveDown}
                    onClick={() => {
                      HapticService.selection();
                      onMoveDown?.();
                      onClose();
                    }}
                    title={canMoveDown ? 'Bajar sección' : 'Ya es la última'}
                  >
                    <ArrowDown size={15} aria-hidden="true" />
                    <span>Bajar</span>
                  </button>
                </div>
                <div className="ios-dropdown-divider" />
              </>
            )}

            {/* ACCIONES DE TAREAS */}
            {onToggleAllCompleted && taskCount > 0 && (
              <button
                type="button"
                className="ios-dropdown-item"
                onClick={() => {
                  HapticService.impact('medium');
                  onClose();
                  onToggleAllCompleted();
                }}
              >
                {allCompleted ? (
                  <>
                    <RotateCcw size={16} color="var(--accent-primary)" />
                    <span>Desmarcar tareas ({taskCount})</span>
                  </>
                ) : (
                  <>
                    <CheckCheck size={16} color="#34C759" />
                    <span>Marcar completadas ({taskCount})</span>
                  </>
                )}
              </button>
            )}

            {onSortTasks && taskCount > 1 && (
              <button
                type="button"
                className="ios-dropdown-item"
                onClick={() => setCurrentSubmenu('sort')}
                style={{ justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ArrowUpDown size={16} />
                  <span>Ordenar tareas</span>
                </div>
                <ChevronRight size={15} color="var(--text-tertiary)" />
              </button>
            )}

            {onMoveAllTasks && taskCount > 0 && (
              <button
                type="button"
                className="ios-dropdown-item"
                onClick={() => setCurrentSubmenu('move_tasks')}
                style={{ justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FolderInput size={16} />
                  <span>Mover tareas a...</span>
                </div>
                <ChevronRight size={15} color="var(--text-tertiary)" />
              </button>
            )}

            {((onToggleAllCompleted && taskCount > 0) || (onSortTasks && taskCount > 1) || (onMoveAllTasks && taskCount > 0)) && (
              <div className="ios-dropdown-divider" />
            )}

            {/* GESTIÓN DE LA SECCIÓN («+ Diarias» está en la propia cabecera) */}
            
              {sectionMenu.pendingTaskCount !== undefined && sectionMenu.pendingTaskCount > 0 && (
                <button
                  type="button"
                  className="ios-dropdown-item"
                  onClick={() => {
                    HapticService.selection();
                    window.dispatchEvent(new CustomEvent('complete-all-tasks', { detail: { taskIds: sectionMenu.sectionTaskIds } }));
                    onClose();
                  }}
                >
                  <CheckSquare size={16} color="var(--text-primary)" />
                  <span>Marcar todas como hechas</span>
                </button>
              )}

              {onStartSequence && (sectionMenu.pendingTaskCount ?? 0) > 0 && (
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
            )}

            {onAddTask && (
              <button 
                type="button"
                className="ios-dropdown-item" 
                onClick={() => { onClose(); onAddTask(); }}
              >
                <Plus size={16} />
                <span>Añadir tarea aquí</span>
              </button>
            )}

            {sectionMenu.sectionId && onRename && (
              <button 
                type="button"
                className="ios-dropdown-item" 
                onClick={() => { onClose(); onRename(); }}
              >
                <Edit3 size={16} />
                <span>Renombrar sección</span>
              </button>
            )}

            {sectionMenu.sectionId && onDuplicateSection && (
              <button 
                type="button"
                className="ios-dropdown-item" 
                onClick={() => { 
                  HapticService.notification('success');
                  onClose(); 
                  onDuplicateSection(); 
                }}
              >
                <Copy size={16} />
                <span>Duplicar sección</span>
              </button>
            )}

            {sectionMenu.sectionId && onAddNestedSection && (
              <button 
                type="button"
                className="ios-dropdown-item" 
                onClick={() => { onClose(); onAddNestedSection(); }}
              >
                <FolderPlus size={16} />
                <span>Añadir subsección</span>
              </button>
            )}

            {/* ZONA DESTRUCTIVA O DE LIMPIEZA */}
            {(onEmptySection || (sectionMenu.sectionId && onDelete)) && (
              <>
                <div className="ios-dropdown-divider" />
                {onEmptySection && taskCount > 0 && (
                  <button 
                    type="button"
                    className="ios-dropdown-item"
                    style={{ color: '#FF9500' }}
                    onClick={() => { onClose(); onEmptySection(); }}
                  >
                    <Eraser size={16} color="#FF9500" />
                    <span>Vaciar sección</span>
                  </button>
                )}

                {sectionMenu.sectionId && onDelete && (
                  <button 
                    type="button"
                    className="ios-dropdown-item danger" 
                    onClick={() => { onClose(); onDelete(); }}
                  >
                    <Trash2 size={16} />
                    <span>Eliminar sección</span>
                  </button>
                )}
              </>
            )}
          </>
        )}
      </motion.div>
    </>,
    document.body
  );
};

