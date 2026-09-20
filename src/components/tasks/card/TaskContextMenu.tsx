import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, Info, IndentIncrease, IndentDecrease, Calendar, 
  AlertCircle, Flag, FolderInput, LayoutList, Copy, Play, Trash2, 
  ChevronRight, ArrowLeft, Sun, CalendarDays, Clock, CalendarX, Edit3,
  ArrowUp, ArrowDown
} from 'lucide-react';
import type { TaskItem } from '../../../models/Task';
import { useAppStore } from '../../../store/useAppStore';

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
          {/* Backdrop: sin desenfoque global para mantener la nitidez */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99998,
              background: 'rgba(0, 0, 0, 0.12)',
            }}
            onClick={onClose}
            onWheel={onClose}
            onContextMenu={(e) => { e.preventDefault(); onClose(); }}
          />

          {/* Floating Popover Container */}
          <motion.div
            className="ios-dropdown-menu"
            initial={{ opacity: 0, scale: 0.92, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ type: 'spring', damping: 26, stiffness: 450 }}
            style={{
              position: 'fixed',
              zIndex: 100000,
              top: position.y,
              left: position.x,
              width: Math.min(300, window.innerWidth - 24),
              minWidth: 280,
              background: 'var(--bg-material, rgba(255,255,255,0.92))',
              backdropFilter: 'blur(35px) saturate(190%)',
              WebkitBackdropFilter: 'blur(35px) saturate(190%)',
              borderRadius: '14px',
              boxShadow: '0 14px 40px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.06)',
              border: '1px solid var(--border-subtle)',
              padding: '6px 0',
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

  const availableSections = (listSections || []).filter(
    s => s.listId === task.categoryId && !s.deleted_at
  );

  // Submenu: Mover a lista
  if (currentSubmenu === 'move_list') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
          <button 
            onClick={() => setCurrentSubmenu('main')}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, padding: 0 }}
          >
            <ArrowLeft size={16} /> Volver
          </button>
          <span style={{ flex: 1, textAlign: 'center', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginRight: 20 }}>
            Trasladar a lista
          </span>
        </div>
        <div style={{ maxHeight: 280, overflowY: 'auto', padding: '4px 0' }}>
          {lists?.map(list => {
            const isCurrent = task.categoryId === list.id;
            return (
              <button
                key={list.id}
                onClick={() => {
                  updateTask(task.id, { categoryId: list.id, sectionId: undefined });
                  setContextMenuOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 14px',
                  width: '100%',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: isCurrent ? 'var(--accent-primary)' : 'var(--text-primary)',
                  textAlign: 'left',
                  fontSize: '0.92rem',
                  borderRadius: 6
                }}
                onPointerDown={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onPointerUp={e => { e.currentTarget.style.background = 'transparent'; }}
                onPointerLeave={e => { e.currentTarget.style.background = 'transparent'; }}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
          <button 
            onClick={() => setCurrentSubmenu('main')}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, padding: 0 }}
          >
            <ArrowLeft size={16} /> Volver
          </button>
          <span style={{ flex: 1, textAlign: 'center', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginRight: 20 }}>
            Trasladar a sección
          </span>
        </div>
        <div style={{ maxHeight: 280, overflowY: 'auto', padding: '4px 0' }}>
          <button
            onClick={() => {
              updateTask(task.id, { sectionId: undefined });
              setContextMenuOpen(false);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 14px',
              width: '100%',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: !task.sectionId ? 'var(--accent-primary)' : 'var(--text-primary)',
              textAlign: 'left',
              fontSize: '0.92rem',
              borderRadius: 6
            }}
            onPointerDown={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onPointerUp={e => { e.currentTarget.style.background = 'transparent'; }}
            onPointerLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span>Sin sección</span>
            {!task.sectionId && <CheckCircle size={15} color="var(--accent-primary)" />}
          </button>
          {availableSections.map(sec => {
            const isCurrent = task.sectionId === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => {
                  updateTask(task.id, { sectionId: sec.id });
                  setContextMenuOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 14px',
                  width: '100%',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: isCurrent ? 'var(--accent-primary)' : 'var(--text-primary)',
                  textAlign: 'left',
                  fontSize: '0.92rem',
                  borderRadius: 6
                }}
                onPointerDown={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onPointerUp={e => { e.currentTarget.style.background = 'transparent'; }}
                onPointerLeave={e => { e.currentTarget.style.background = 'transparent'; }}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
          <button 
            onClick={() => setCurrentSubmenu('main')}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, padding: 0 }}
          >
            <ArrowLeft size={16} /> Volver
          </button>
          <span style={{ flex: 1, textAlign: 'center', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginRight: 20 }}>
            Fecha límite
          </span>
        </div>
        <div style={{ padding: '4px 0' }}>
          <ActionRow 
            icon={<Sun size={17} color="#007aff" />} 
            label="Hoy" 
            sublabel="18:00"
            onClick={() => {
              const d = new Date(); d.setHours(18, 0, 0, 0);
              handleSetDueDate(d.toISOString());
            }} 
          />
          <ActionRow 
            icon={<Calendar size={17} color="#ff9500" />} 
            label="Mañana" 
            sublabel="09:00"
            onClick={() => {
              const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0);
              handleSetDueDate(d.toISOString());
            }} 
          />
          <ActionRow 
            icon={<CalendarDays size={17} color="#5856d6" />} 
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
            icon={<Clock size={17} color="#34c759" />} 
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
              <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 14px' }} />
              <ActionRow 
                icon={<CalendarX size={17} color="var(--accent-red)" />} 
                label="Sin fecha límite" 
                labelColor="var(--accent-red)"
                onClick={() => handleSetDueDate(undefined)} 
              />
            </>
          )}
          <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 14px' }} />
          <ActionRow 
            icon={<Edit3 size={17} color="var(--accent-primary)" />} 
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
          <button 
            onClick={() => setCurrentSubmenu('main')}
            style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, padding: 0 }}
          >
            <ArrowLeft size={16} /> Volver
          </button>
          <span style={{ flex: 1, textAlign: 'center', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginRight: 20 }}>
            Prioridad
          </span>
        </div>
        <div style={{ padding: '4px 0' }}>
          {priorities.map(p => {
            const isCurrent = (task.priority || 'none') === p.value;
            return (
              <button
                key={p.value}
                onClick={() => {
                  updateTask(task.id, { priority: p.value });
                  setContextMenuOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 14px',
                  width: '100%',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: isCurrent ? 'var(--accent-primary)' : 'var(--text-primary)',
                  textAlign: 'left',
                  fontSize: '0.92rem',
                  borderRadius: 6
                }}
                onPointerDown={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onPointerUp={e => { e.currentTarget.style.background = 'transparent'; }}
                onPointerLeave={e => { e.currentTarget.style.background = 'transparent'; }}
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
      {/* Header: Selected Reminder Title */}
      <div style={{
        padding: '8px 14px 8px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        marginBottom: '4px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(0, 122, 255, 0.05)',
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
      }}>
        <div style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: 'var(--accent-primary)',
          flexShrink: 0
        }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: 'var(--accent-primary)',
            lineHeight: 1.2,
            marginBottom: 2
          }}>
            Recordatorio seleccionado
          </div>
          <div style={{
            fontSize: '0.86rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {task.title || 'Sin título'}
          </div>
        </div>
      </div>

      {/* 1. Marcar como completado */}
      <ActionRow 
        icon={<CheckCircle size={18} color="var(--accent-primary)" />} 
        label={isCompleted ? "Marcar como pendiente" : "Marcar como completado"} 
        onClick={() => { 
          setContextMenuOpen(false); 
          onToggle(task.id); 
        }} 
      />

      {/* 2. Editar recordatorio (Panel de metadatos) */}
      <ActionRow 
        icon={<Info size={18} color="var(--accent-primary)" />} 
        label="Editar recordatorio" 
        sublabel="Metadatos y notas"
        trailing={<span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>ℹ️</span>}
        onClick={() => { 
          setContextMenuOpen(false); 
          onEdit(task.id); 
        }} 
      />

      {/* Reordenación manual rápida: Mover arriba / Mover abajo */}
      {(onMoveUp || onMoveDown) && (
        <div style={{ display: 'flex', gap: 6, padding: '4px 12px 2px' }}>
          <button
            type="button"
            disabled={!canMoveUp}
            onClick={() => {
              setContextMenuOpen(false);
              onMoveUp?.();
            }}
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
              transition: 'all 0.15s ease'
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
              transition: 'all 0.15s ease'
            }}
            title="Bajar posición en la lista"
          >
            <ArrowDown size={13} strokeWidth={2.5} />
            <span>Mover abajo</span>
          </button>
        </div>
      )}

      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 14px' }} />

      {/* 3. Sangrar / Anular sangría de recordatorio */}
      {task.parentId ? (
        <ActionRow 
          icon={<IndentDecrease size={18} color="var(--accent-primary)" />} 
          label="Anular sangría" 
          sublabel="Convertir en principal"
          onClick={() => { 
            setContextMenuOpen(false); 
            nestTask(task.id, undefined); 
          }} 
        />
      ) : previousTaskId ? (
        <ActionRow 
          icon={<IndentIncrease size={18} color="var(--accent-primary)" />} 
          label="Sangrar recordatorio" 
          sublabel="Hacer subtarea"
          onClick={() => { 
            setContextMenuOpen(false); 
            nestTask(task.id, previousTaskId); 
          }} 
        />
      ) : (
        <ActionRow 
          icon={<IndentIncrease size={18} color="var(--text-tertiary)" />} 
          label="Sangrar recordatorio" 
          sublabel="Requiere tarea previa"
          disabled={true}
          onClick={() => {}} 
        />
      )}

      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 14px' }} />

      {/* 4. Fecha límite */}
      <ActionRow 
        icon={<Calendar size={18} color="#007aff" />} 
        label="Fecha límite"
        sublabel={task.dueDate ? new Date(task.dueDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : undefined}
        trailing={<ChevronRight size={14} color="var(--text-tertiary)" />}
        onClick={() => setCurrentSubmenu('due_date')} 
      />

      {/* 5. Marcar como urgente / Prioridad */}
      <ActionRow 
        icon={<AlertCircle size={18} color={isUrgent ? '#ff3b30' : 'var(--text-primary)'} />} 
        label={isUrgent ? "Quitar urgencia" : "Marcar como urgente"}
        trailing={<ChevronRight size={14} color="var(--text-tertiary)" />}
        onClick={() => setCurrentSubmenu('priority')} 
      />

      {/* 6. Con marca */}
      <ActionRow 
        icon={<Flag size={18} color={task.flagged ? '#ff9500' : 'var(--text-primary)'} fill={task.flagged ? '#ff9500' : 'none'} />} 
        label={task.flagged ? "Quitar marca" : "Con marca"} 
        onClick={() => { 
          setContextMenuOpen(false); 
          updateTask(task.id, { flagged: !task.flagged }); 
        }} 
      />

      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 14px' }} />

      {/* 7. Trasladar a lista */}
      <ActionRow 
        icon={<FolderInput size={18} />} 
        label="Trasladar a lista..." 
        trailing={<ChevronRight size={14} color="var(--text-tertiary)" />}
        onClick={() => setCurrentSubmenu('move_list')} 
      />

      {/* 8. Trasladar a sección (si hay secciones disponibles en esta lista) */}
      {availableSections.length > 0 && (
        <ActionRow 
          icon={<LayoutList size={18} />} 
          label="Trasladar a sección..." 
          trailing={<ChevronRight size={14} color="var(--text-tertiary)" />}
          onClick={() => setCurrentSubmenu('move_section')} 
        />
      )}

      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 14px' }} />

      {/* 9. Duplicar */}
      <ActionRow 
        icon={<Copy size={18} />} 
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

      {/* 10. Modo Enfoque Zen (opcional) */}
      {onOpenZenMode && (
        <ActionRow 
          icon={<Play size={18} color="var(--accent-primary)" fill="var(--accent-primary)" />} 
          label="Modo Enfoque Zen" 
          onClick={() => { setContextMenuOpen(false); onOpenZenMode(task.id); }} 
        />
      )}

      <div style={{ height: 1, background: 'var(--border-subtle)', margin: '4px 14px' }} />

      {/* 11. Eliminar recordatorio */}
      <ActionRow 
        icon={<Trash2 size={18} color="var(--accent-red)" />} 
        label="Eliminar" 
        labelColor="var(--accent-red)" 
        onClick={() => { setContextMenuOpen(false); setIsDeleteConfirmOpen(true); }} 
      />
    </>
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
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.98, backgroundColor: 'var(--bg-hover)' }}
      transition={{ type: 'spring', damping: 25, stiffness: 450 }}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        padding: '0 14px',
        background: 'none',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        WebkitTapHighlightColor: 'transparent',
        minHeight: 42,
        borderRadius: 8,
        transition: 'background-color 0.12s ease',
        opacity: disabled ? 0.38 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        boxSizing: 'border-box'
      }}
      onPointerDown={e => { if (!disabled) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
      onPointerUp={e => { if (!disabled) e.currentTarget.style.backgroundColor = 'transparent'; }}
      onPointerLeave={e => { if (!disabled) e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: '1 0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, color: labelColor || 'var(--text-primary)', flexShrink: 0 }}>
          {icon}
        </div>
        <span style={{ fontSize: '0.89rem', fontWeight: 450, color: labelColor || 'var(--text-primary)', whiteSpace: 'nowrap' }}>
          {label}
        </span>
      </div>
      {(sublabel || trailing) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0, marginLeft: 8, overflow: 'hidden' }}>
          {sublabel && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {sublabel}
            </span>
          )}
          {trailing}
        </div>
      )}
    </motion.button>
  );
}
