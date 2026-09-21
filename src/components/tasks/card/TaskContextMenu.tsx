import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, Info, IndentIncrease, IndentDecrease, Calendar, 
  AlertCircle, Flag, FolderInput, LayoutList, Copy, Play, Trash2, 
  ChevronRight, ArrowLeft, Sun, CalendarDays, Clock, CalendarX, Edit3,
  ArrowUp, ArrowDown, ChevronDown, SlidersHorizontal
} from 'lucide-react';
import type { TaskItem } from '../../../models/Task';
import { useAppStore } from '../../../store/useAppStore';
import { HapticService } from '../../../services/HapticService';

export interface TaskContextMenuProps {
  task: TaskItem;
  isOpen: boolean;
  onClose: () => void;
  position: { x: number; y: number; maxHeight: number };
  onEdit: (id: string) => void;
  nestTask: (taskId: string, parentId?: string) => void;
  previousTaskId?: string;
  setIsDeleteConfirmOpen: (open: boolean) => void;
  onOpenZenMode?: (id: string) => void;
  onToggle: (id: string, forceReverse?: boolean) => void;
  isCompleted: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export function TaskContextMenu({
  task,
  isOpen,
  onClose,
  position,
  onEdit,
  nestTask,
  previousTaskId,
  setIsDeleteConfirmOpen,
  onOpenZenMode,
  onToggle,
  isCompleted,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown
}: TaskContextMenuProps) {
  const updateTask = useAppStore(state => state.updateTask);
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  // Escape cierra el menú (antes el fondo invisible seguía bloqueando los clics).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop matching SectionContextMenu */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999990,
              background: 'rgba(0, 0, 0, 0.22)',
              backdropFilter: 'blur(2px)',
              WebkitBackdropFilter: 'blur(2px)'
            }}
            onClick={onClose}
            onWheel={onClose}
            onContextMenu={(e) => { e.preventDefault(); onClose(); }}
          />

          {/* Floating Popover Container / Mobile Bottom Action Sheet */}
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
              maxHeight: '85vh',
              overflowY: 'auto',
              overflowX: 'hidden',
              boxSizing: 'border-box',
              overscrollBehavior: 'contain',
              WebkitOverflowScrolling: 'touch',
            } : {
              position: 'fixed',
              zIndex: 999995,
              top: position.y,
              left: position.x,
              width: Math.min(300, window.innerWidth - 24),
              minWidth: 280,
              background: 'var(--bg-elevated, #ffffff)',
              backdropFilter: 'blur(35px) saturate(190%)',
              WebkitBackdropFilter: 'blur(35px) saturate(190%)',
              borderRadius: '14px',
              boxShadow: '0 14px 40px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.06)',
              border: '1px solid var(--border-subtle, rgba(0,0,0,0.12))',
              padding: '6px',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: `${position.maxHeight}px`,
              overflowY: 'auto',
              overflowX: 'hidden',
              boxSizing: 'border-box',
              overscrollBehavior: 'contain',
              WebkitOverflowScrolling: 'touch',
            }}
            onClick={e => e.stopPropagation()}
          >
            {isMobile && (
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-subtle, rgba(142, 142, 147, 0.4))', margin: '0 auto 10px', flexShrink: 0 }} />
            )}
            <MenuActions 
              task={task} 
              setContextMenuOpen={(open) => { if (!open) onClose(); }} 
              onEdit={onEdit} 
              nestTask={nestTask} 
              previousTaskId={previousTaskId} 
              setIsDeleteConfirmOpen={setIsDeleteConfirmOpen} 
              updateTask={updateTask} 
              onOpenZenMode={onOpenZenMode}
              onToggle={onToggle}
              isCompleted={isCompleted}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              canMoveUp={canMoveUp}
              canMoveDown={canMoveDown}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

interface MenuActionsProps {
  task: TaskItem;
  setContextMenuOpen: (open: boolean) => void;
  onEdit: (id: string) => void;
  nestTask: (taskId: string, parentId?: string) => void;
  previousTaskId?: string;
  setIsDeleteConfirmOpen: (open: boolean) => void;
  updateTask: (id: string, updates: Partial<TaskItem>) => void;
  onOpenZenMode?: (id: string) => void;
  onToggle: (id: string, forceReverse?: boolean) => void;
  isCompleted: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

function MenuActions({
  task,
  setContextMenuOpen,
  onEdit,
  nestTask,
  previousTaskId,
  setIsDeleteConfirmOpen,
  updateTask,
  onOpenZenMode,
  onToggle,
  isCompleted,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown
}: MenuActionsProps) {
  const addTask = useAppStore(state => state.addTask);
  const lists = useAppStore(state => state.lists);
  const listSections = useAppStore(state => state.listSections);
  const [currentSubmenu, setCurrentSubmenu] = useState<'main' | 'move_list' | 'move_section' | 'due_date' | 'priority'>('main');
  const [showMoreActions, setShowMoreActions] = useState(false);

  const availableSections = (listSections || []).filter(
    s => s.listId === task.categoryId && !s.deleted_at
  );

  // Submenu: Mover a lista
  if (currentSubmenu === 'move_list') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <SubmenuHeader title="Trasladar a lista" onBack={() => setCurrentSubmenu('main')} />
        <div className="ios-dropdown-divider" />
        <div style={{ maxHeight: 280, overflowY: 'auto', padding: '4px 0' }}>
          {lists?.map(list => {
            const isCurrent = task.categoryId === list.id;
            return (
              <button
                key={list.id}
                type="button"
                className="ios-dropdown-item"
                onClick={() => {
                  updateTask(task.id, { categoryId: list.id, sectionId: undefined });
                  setContextMenuOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  color: isCurrent ? 'var(--accent-primary)' : 'var(--text-primary)',
                  fontWeight: isCurrent ? 600 : 500,
                }}
              >
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: list.color || 'var(--accent-primary)', flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{list.name}</span>
                {isCurrent && <CheckCircle size={15} color="var(--accent-primary)" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Submenu: Trasladar a sección
  if (currentSubmenu === 'move_section') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <SubmenuHeader title="Trasladar a sección" onBack={() => setCurrentSubmenu('main')} />
        <div className="ios-dropdown-divider" />
        <div style={{ maxHeight: 280, overflowY: 'auto', padding: '4px 0' }}>
          <button
            type="button"
            className="ios-dropdown-item"
            onClick={() => {
              updateTask(task.id, { sectionId: undefined });
              setContextMenuOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              color: !task.sectionId ? 'var(--accent-primary)' : 'var(--text-primary)',
              fontWeight: !task.sectionId ? 600 : 500,
            }}
          >
            <span>Sin sección</span>
            {!task.sectionId && <CheckCircle size={15} color="var(--accent-primary)" />}
          </button>
          {availableSections.map(sec => {
            const isCurrent = task.sectionId === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                className="ios-dropdown-item"
                onClick={() => {
                  updateTask(task.id, { sectionId: sec.id });
                  setContextMenuOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  color: isCurrent ? 'var(--accent-primary)' : 'var(--text-primary)',
                  fontWeight: isCurrent ? 600 : 500,
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sec.name}</span>
                {isCurrent && <CheckCircle size={15} color="var(--accent-primary)" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Submenu: Fecha límite
  if (currentSubmenu === 'due_date') {
    const handleSetDueDate = (iso?: string) => {
      updateTask(task.id, { dueDate: iso });
      setContextMenuOpen(false);
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <SubmenuHeader title="Fecha límite" onBack={() => setCurrentSubmenu('main')} />
        <div className="ios-dropdown-divider" />
        <div style={{ padding: '4px 0' }}>
          <ActionRow 
            icon={<Sun size={16} color="#007aff" />} 
            label="Hoy" 
            sublabel="18:00"
            onClick={() => {
              const d = new Date(); d.setHours(18, 0, 0, 0);
              handleSetDueDate(d.toISOString());
            }} 
          />
          <ActionRow 
            icon={<Calendar size={16} color="#ff9500" />} 
            label="Mañana" 
            sublabel="09:00"
            onClick={() => {
              const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0);
              handleSetDueDate(d.toISOString());
            }} 
          />
          <ActionRow 
            icon={<CalendarDays size={16} color="#5856d6" />} 
            label="Este fin de semana" 
            sublabel="Sábado 10:00"
            onClick={() => {
              const d = new Date();
              const day = d.getDay();
              const diff = day === 6 ? 7 : (6 - day);
              d.setDate(d.getDate() + diff); d.setHours(10, 0, 0, 0);
              handleSetDueDate(d.toISOString());
            }} 
          />
          <ActionRow 
            icon={<Clock size={16} color="#34c759" />} 
            label="Próxima semana" 
            sublabel="Lunes 09:00"
            onClick={() => {
              const d = new Date();
              const day = d.getDay();
              const diff = (day === 0 ? 1 : 8 - day);
              d.setDate(d.getDate() + diff); d.setHours(9, 0, 0, 0);
              handleSetDueDate(d.toISOString());
            }} 
          />
          {task.dueDate && (
            <>
              <div className="ios-dropdown-divider" />
              <ActionRow 
                icon={<CalendarX size={16} color="var(--accent-red)" />} 
                label="Sin fecha límite" 
                labelColor="var(--accent-red)"
                onClick={() => handleSetDueDate(undefined)} 
              />
            </>
          )}
          <div className="ios-dropdown-divider" />
          <ActionRow 
            icon={<Edit3 size={16} color="var(--accent-primary)" />} 
            label="Personalizar fecha..." 
            onClick={() => {
              setContextMenuOpen(false);
              onEdit(task.id);
            }} 
          />
        </div>
      </div>
    );
  }

  // Submenu: Prioridad
  if (currentSubmenu === 'priority') {
    const priorities: { value: 'none' | 'low' | 'medium' | 'high'; label: string; marks: string; color: string }[] = [
      { value: 'none', label: 'Ninguna', marks: '', color: 'var(--text-primary)' },
      { value: 'low', label: 'Baja', marks: '!', color: '#34c759' },
      { value: 'medium', label: 'Media', marks: '!!', color: '#ff9500' },
      { value: 'high', label: 'Alta (Urgente)', marks: '!!!', color: '#ff3b30' },
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <SubmenuHeader title="Prioridad" onBack={() => setCurrentSubmenu('main')} />
        <div className="ios-dropdown-divider" />
        <div style={{ padding: '4px 0' }}>
          {priorities.map(p => {
            const isCurrent = (task.priority || 'none') === p.value;
            return (
              <button
                key={p.value}
                type="button"
                className="ios-dropdown-item"
                onClick={() => {
                  updateTask(task.id, { priority: p.value });
                  setContextMenuOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  color: isCurrent ? 'var(--accent-primary)' : 'var(--text-primary)',
                  fontWeight: isCurrent ? 600 : 500,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {p.marks && <span style={{ fontWeight: 800, color: p.color, width: 22 }}>{p.marks}</span>}
                  <span>{p.label}</span>
                </div>
                {isCurrent && <CheckCircle size={15} color="var(--accent-primary)" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Vista Principal
  const isUrgent = task.priority === 'high';

  return (
    <>
      {/* Header: Reminder Title Header matching SectionContextMenu */}
      <div style={{ padding: '2px 8px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-primary)', flexShrink: 0 }} />
        <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {task.title || 'Recordatorio'}
        </span>
      </div>
      <div className="ios-dropdown-divider" />

      {/* 1. Marcar como completado */}
      <ActionRow 
        icon={<CheckCircle size={16} color="var(--accent-primary)" />} 
        label={isCompleted ? "Marcar como pendiente" : "Marcar como completado"} 
        onClick={() => { 
          setContextMenuOpen(false); 
          onToggle(task.id); 
        }} 
      />

      {/* 2. Editar recordatorio (Panel de metadatos) */}
      <ActionRow
        icon={<Info size={16} color="var(--accent-primary)" />}
        label="Editar recordatorio"
        sublabel="Metadatos y notas"
        onClick={() => {
          setContextMenuOpen(false);
          onEdit(task.id);
        }}
      />

      <div className="ios-dropdown-divider" />

      {/* 3. Fecha límite */}
      <ActionRow 
        icon={<Calendar size={16} color="#007aff" />} 
        label="Fecha límite"
        sublabel={task.dueDate ? new Date(task.dueDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : undefined}
        trailing={<ChevronRight size={14} color="var(--text-tertiary)" />}
        onClick={() => setCurrentSubmenu('due_date')} 
      />

      {/* 4. Marcar como urgente / Prioridad */}
      <ActionRow 
        icon={<AlertCircle size={16} color={isUrgent ? '#ff3b30' : 'var(--text-secondary)'} />} 
        label={isUrgent ? "Quitar urgencia" : "Marcar como urgente"}
        trailing={<ChevronRight size={14} color="var(--text-tertiary)" />}
        onClick={() => setCurrentSubmenu('priority')} 
      />

      {/* 5. Con marca */}
      <ActionRow 
        icon={<Flag size={16} color={task.flagged ? '#ff9500' : 'var(--text-secondary)'} fill={task.flagged ? '#ff9500' : 'none'} />} 
        label={task.flagged ? "Quitar marca" : "Con marca"} 
        onClick={() => { 
          setContextMenuOpen(false); 
          updateTask(task.id, { flagged: !task.flagged }); 
        }} 
      />

      <div className="ios-dropdown-divider" />

      {/* Botón desplegable: Más opciones... */}
      <button
        type="button"
        className="ios-dropdown-item"
        onClick={() => {
          HapticService.selection();
          setShowMoreActions(prev => !prev);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          background: showMoreActions ? 'var(--bg-hover, rgba(0,0,0,0.04))' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          fontSize: '0.86rem',
          fontWeight: 500,
          borderRadius: 8,
          transition: 'all 0.15s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <SlidersHorizontal size={16} color="var(--text-secondary)" />
          <span>{showMoreActions ? 'Menos opciones' : 'Más opciones...'}</span>
        </div>
        <ChevronDown size={14} style={{ transform: showMoreActions ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {showMoreActions && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '2px 0' }}>
          {/* Reordenación manual rápida: Mover arriba / Mover abajo */}
          {(onMoveUp || onMoveDown) && (
            <div style={{ display: 'flex', gap: 6, padding: '4px 6px' }}>
              <button
                type="button"
                disabled={!canMoveUp}
                onClick={() => {
                  setContextMenuOpen(false);
                  onMoveUp?.();
                }}
                className="ios-dropdown-item"
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  padding: '6px 8px',
                  borderRadius: 8,
                  background: canMoveUp ? 'var(--bg-hover, rgba(0,0,0,0.06))' : 'transparent',
                  color: canMoveUp ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.80rem',
                  fontWeight: 600,
                  cursor: canMoveUp ? 'pointer' : 'default',
                  opacity: canMoveUp ? 1 : 0.4,
                  minHeight: 34,
                }}
                title="Subir posición en la lista"
              >
                <ArrowUp size={13} strokeWidth={2.5} />
                <span>Mover arriba</span>
              </button>
              <button
                type="button"
                disabled={!canMoveDown}
                onClick={() => {
                  setContextMenuOpen(false);
                  onMoveDown?.();
                }}
                className="ios-dropdown-item"
                style={{
                  flex: 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  padding: '6px 8px',
                  borderRadius: 8,
                  background: canMoveDown ? 'var(--bg-hover, rgba(0,0,0,0.06))' : 'transparent',
                  color: canMoveDown ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.80rem',
                  fontWeight: 600,
                  cursor: canMoveDown ? 'pointer' : 'default',
                  opacity: canMoveDown ? 1 : 0.4,
                  minHeight: 34,
                }}
                title="Bajar posición en la lista"
              >
                <ArrowDown size={13} strokeWidth={2.5} />
                <span>Mover abajo</span>
              </button>
            </div>
          )}

          {/* Sangrar / Anular sangría de recordatorio */}
          {task.parentId ? (
            <ActionRow 
              icon={<IndentDecrease size={16} color="var(--accent-primary)" />} 
              label="Anular sangría" 
              sublabel="Convertir en principal"
              onClick={() => { 
                setContextMenuOpen(false); 
                nestTask(task.id, undefined); 
              }} 
            />
          ) : previousTaskId ? (
            <ActionRow 
              icon={<IndentIncrease size={16} color="var(--accent-primary)" />} 
              label="Sangrar recordatorio" 
              sublabel="Hacer subtarea"
              onClick={() => { 
                setContextMenuOpen(false); 
                nestTask(task.id, previousTaskId); 
              }} 
            />
          ) : null}

          {/* Trasladar a lista */}
          <ActionRow 
            icon={<FolderInput size={16} />} 
            label="Trasladar a lista..." 
            trailing={<ChevronRight size={14} color="var(--text-tertiary)" />}
            onClick={() => setCurrentSubmenu('move_list')} 
          />

          {/* Trasladar a sección (si hay secciones disponibles en esta lista) */}
          {availableSections.length > 0 && (
            <ActionRow 
              icon={<LayoutList size={16} />} 
              label="Trasladar a sección..." 
              trailing={<ChevronRight size={14} color="var(--text-tertiary)" />}
              onClick={() => setCurrentSubmenu('move_section')} 
            />
          )}

          {/* Duplicar */}
          <ActionRow 
            icon={<Copy size={16} />} 
            label="Duplicar" 
            onClick={() => { 
              addTask({ 
                ...task, 
                id: crypto.randomUUID(), 
                title: `${task.title} (copia)`, 
                created_at: new Date().toISOString(), 
                updated_at: new Date().toISOString(),
                status: 'pending'
              }); 
              setContextMenuOpen(false); 
            }} 
          />

          {/* Modo Enfoque Zen (opcional) */}
          {onOpenZenMode && (
            <ActionRow 
              icon={<Play size={16} color="var(--accent-primary)" fill="var(--accent-primary)" />} 
              label="Modo Enfoque Zen" 
              onClick={() => { setContextMenuOpen(false); onOpenZenMode(task.id); }} 
            />
          )}
        </div>
      )}

      <div className="ios-dropdown-divider" />

      {/* 6. Eliminar recordatorio */}
      <ActionRow 
        icon={<Trash2 size={16} color="var(--accent-red)" />} 
        label="Eliminar" 
        labelColor="var(--accent-red)" 
        onClick={() => { setContextMenuOpen(false); setIsDeleteConfirmOpen(true); }} 
      />
    </>
  );
}

/** Cabecera reutilizable de submenú: botón "Volver" + título centrado. */
function SubmenuHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px 8px' }}>
      <button
        type="button"
        onClick={onBack}
        aria-label="Volver al menú anterior"
        style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, padding: 0 }}
      >
        <ArrowLeft size={16} /> Volver
      </button>
      <span style={{ flex: 1, textAlign: 'center', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginRight: 20 }}>
        {title}
      </span>
    </div>
  );
}

function ActionRow({
  icon, label, sublabel, trailing, onClick, labelColor, disabled
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  trailing?: React.ReactNode;
  onClick: () => void;
  labelColor?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`ios-dropdown-item ${labelColor === 'var(--accent-red)' ? 'danger' : ''}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.38 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        color: labelColor || 'inherit',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, color: labelColor || 'var(--text-secondary)', flexShrink: 0 }}>
          {icon}
        </div>
        <span style={{ fontSize: '0.88rem', fontWeight: 500, color: labelColor || 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </span>
      </div>
      {(sublabel || trailing) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
          {sublabel && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
              {sublabel}
            </span>
          )}
          {trailing}
        </div>
      )}
    </button>
  );
}
