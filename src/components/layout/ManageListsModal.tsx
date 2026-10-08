import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Search, 
  Check, 
  Folder, 
  List, 
  Trash2, 
  Pin, 
  PinOff, 
  ChevronUp, 
  ChevronDown, 
  Edit2, 
  Plus, 
  FolderPlus, 
  AlertCircle
} from 'lucide-react';
import { useAppStore, isTaskCompleted } from '../../store/useAppStore';
import { HapticService } from '../../services/HapticService';
import { confirmDialog } from '../ui/confirmDialog';
import { LIST_ICON_MAP } from '../../constants/icons';
import type { CustomList } from '../../models/Task';

export interface ManageListsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEditList?: (listId: string) => void;
  onCreateList?: (isFolder?: boolean) => void;
}

export const ManageListsModal: React.FC<ManageListsModalProps> = ({
  isOpen,
  onClose,
  onEditList,
  onCreateList,
}) => {
  const lists = useAppStore((state) => state.lists);
  const tasks = useAppStore((state) => state.tasks);
  const removeList = useAppStore((state) => state.removeList);
  const updateList = useAppStore((state) => state.updateList);
  const reorderLists = useAppStore((state) => state.reorderLists);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<'all' | 'folders' | 'pinned'>('all');

  // Reset selection on open
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setSelectedIds(new Set());
      setSearchQuery('');
    }
  }

  // Escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Active (non-deleted) lists
  const activeLists = useMemo(() => {
    return (lists || []).filter((l) => !l.deleted_at);
  }, [lists]);

  // Filtered lists
  const displayedLists = useMemo(() => {
    return activeLists.filter((l) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        if (!l.name.toLowerCase().includes(query)) return false;
      }
      if (filterType === 'folders' && !l.isFolder) return false;
      if (filterType === 'pinned' && !l.isPinned) return false;
      return true;
    });
  }, [activeLists, searchQuery, filterType]);

  // Task counts per list
  const taskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const taskValues = Object.values(tasks || {});
    taskValues.forEach((t) => {
      if (!t.deleted_at && !isTaskCompleted(t) && t.categoryId) {
        counts[t.categoryId] = (counts[t.categoryId] || 0) + 1;
      }
    });
    return counts;
  }, [tasks]);

  const toggleSelect = (id: string) => {
    HapticService.selection();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    HapticService.selection();
    if (selectedIds.size === displayedLists.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayedLists.map((l) => l.id)));
    }
  };

  // Reorder up/down
  const handleMove = (index: number, direction: 'up' | 'down') => {
    HapticService.selection();
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= displayedLists.length) return;

    const currentItem = displayedLists[index];
    const targetItem = displayedLists[targetIndex];
    if (!currentItem || !targetItem) return;

    // Build new full list order
    const orderedIds = activeLists.map((l) => l.id);
    const fromIdx = orderedIds.indexOf(currentItem.id);
    const toIdx = orderedIds.indexOf(targetItem.id);
    if (fromIdx === -1 || toIdx === -1) return;

    const newOrder = [...orderedIds];
    const [moved] = newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, moved);

    reorderLists(newOrder);
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    HapticService.impact();

    const count = selectedIds.size;
    const ok = await confirmDialog({
      title: `¿Eliminar ${count} ${count === 1 ? 'lista' : 'listas'}?`,
      message: `Se ${count === 1 ? 'eliminará la lista seleccionada' : `eliminarán las ${count} listas seleccionadas`} y todas sus tareas asociadas. Podrás deshacer la acción.`,
      confirmText: `Eliminar ${count === 1 ? 'lista' : `${count} listas`}`,
      tone: 'danger',
    });

    if (!ok) return;

    const undoFns: Array<() => void> = [];
    selectedIds.forEach((id) => {
      const result = removeList(id);
      if (result?.undo) undoFns.push(result.undo);
    });

    setSelectedIds(new Set());

    window.dispatchEvent(
      new CustomEvent('show-toast', {
        detail: {
          message: `${count === 1 ? 'Lista eliminada' : `${count} listas eliminadas`}`,
          onUndo: () => {
            undoFns.forEach((fn) => fn());
            window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Listas restauradas' }));
          },
        },
      })
    );
  };

  // Bulk Pin/Unpin
  const handleBulkTogglePin = () => {
    if (selectedIds.size === 0) return;
    HapticService.selection();

    // If any is unpinned, pin all; else unpin all
    const anyUnpinned = Array.from(selectedIds).some((id) => {
      const l = activeLists.find((item) => item.id === id);
      return l && !l.isPinned;
    });

    selectedIds.forEach((id) => {
      updateList(id, { isPinned: anyUnpinned });
    });

    window.dispatchEvent(
      new CustomEvent('show-toast', {
        detail: anyUnpinned
          ? `${selectedIds.size} ${selectedIds.size === 1 ? 'lista fijada' : 'listas fijadas'}`
          : `${selectedIds.size} ${selectedIds.size === 1 ? 'lista desfijada' : 'listas desfijadas'}`,
      })
    );
  };

  // Single delete
  const handleDeleteSingle = async (list: CustomList) => {
    HapticService.impact();
    const ok = await confirmDialog({
      title: `¿Eliminar "${list.name}"?`,
      message: `Se eliminará la lista y todas sus tareas asociadas.`,
      confirmText: 'Eliminar lista',
      tone: 'danger',
    });
    if (!ok) return;

    const result = removeList(list.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(list.id);
      return next;
    });

    window.dispatchEvent(
      new CustomEvent('show-toast', {
        detail: {
          message: `Lista "${list.name}" eliminada`,
          onUndo: () => {
            result?.undo();
            window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Lista restaurada' }));
          },
        },
      })
    );
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          pointerEvents: 'auto',
        }}
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
          }}
        />

        {/* Modal Window */}
        <motion.div
          role="dialog"
          data-testid="manage-lists-modal"
          aria-label="Gestionar listas"
          aria-modal="true"
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ type: 'spring', damping: 28, stiffness: 360 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '560px',
            maxHeight: '90vh',
            borderRadius: '26px',
            background: 'var(--bg-elevated, #ffffff)',
            color: 'var(--text-primary, #1c1c1e)',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.28), 0 4px 16px rgba(0, 0, 0, 0.08)',
            border: '1px solid var(--border-subtle, rgba(0, 0, 0, 0.08))',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 22px 14px',
              borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
            }}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.24rem',
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                }}
              >
                Gestionar listas
              </h3>
              <p
                style={{
                  margin: '3px 0 0',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary, #8e8e93)',
                }}
              >
                {activeLists.length} {activeLists.length === 1 ? 'lista' : 'listas'} · Selecciona para acciones en lote
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {displayedLists.length > 0 && (
                <button
                  type="button"
                  data-testid="manage-lists-select-all-btn"
                  onClick={handleSelectAll}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent-primary, #007aff)',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '6px 10px',
                    borderRadius: 8,
                  }}
                >
                  {selectedIds.size === displayedLists.length ? 'Deseleccionar' : 'Seleccionar todo'}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'var(--bg-tertiary, rgba(0,0,0,0.06))',
                  color: 'var(--text-secondary, #8e8e93)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div
            style={{
              padding: '12px 20px',
              borderBottom: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              background: 'var(--bg-card, rgba(0,0,0,0.02))',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--bg-base, #ffffff)',
                border: '1px solid var(--border-subtle, rgba(0,0,0,0.1))',
                borderRadius: 12,
                padding: '6px 12px',
              }}
            >
              <Search size={16} color="var(--text-tertiary, #8e8e93)" style={{ flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Buscar listas por nombre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: '0.88rem',
                  color: 'var(--text-primary)',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-tertiary)',
                    padding: 2,
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter pills */}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => setFilterType('all')}
                style={{
                  padding: '4px 12px',
                  borderRadius: 20,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: filterType === 'all' ? 'var(--accent-primary, #007aff)' : 'var(--bg-elevated)',
                  color: filterType === 'all' ? '#ffffff' : 'var(--text-secondary)',
                  boxShadow: filterType === 'all' ? '0 2px 6px rgba(0,122,255,0.25)' : 'none',
                }}
              >
                Todas ({activeLists.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('pinned')}
                style={{
                  padding: '4px 12px',
                  borderRadius: 20,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: filterType === 'pinned' ? 'var(--accent-primary, #007aff)' : 'var(--bg-elevated)',
                  color: filterType === 'pinned' ? '#ffffff' : 'var(--text-secondary)',
                  boxShadow: filterType === 'pinned' ? '0 2px 6px rgba(0,122,255,0.25)' : 'none',
                }}
              >
                Fijadas ({activeLists.filter((l) => l.isPinned).length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('folders')}
                style={{
                  padding: '4px 12px',
                  borderRadius: 20,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: filterType === 'folders' ? 'var(--accent-primary, #007aff)' : 'var(--bg-elevated)',
                  color: filterType === 'folders' ? '#ffffff' : 'var(--text-secondary)',
                  boxShadow: filterType === 'folders' ? '0 2px 6px rgba(0,122,255,0.25)' : 'none',
                }}
              >
                Carpetas ({activeLists.filter((l) => l.isFolder).length})
              </button>
            </div>
          </div>

          {/* List of items */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              minHeight: 220,
            }}
          >
            {displayedLists.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '40px 16px',
                  color: 'var(--text-tertiary)',
                  gap: 10,
                  textAlign: 'center',
                }}
              >
                <AlertCircle size={32} strokeWidth={1.5} />
                <p style={{ margin: 0, fontSize: '0.92rem' }}>
                  {searchQuery ? 'No se encontraron listas con esa búsqueda' : 'No tienes listas creadas'}
                </p>
              </div>
            ) : (
              displayedLists.map((list, index) => {
                const isSelected = selectedIds.has(list.id);
                const IconComponent = (list.icon && LIST_ICON_MAP[list.icon]) || (list.isFolder ? Folder : List);
                const count = taskCounts[list.id] || 0;

                return (
                  <motion.div
                    key={list.id}
                    layout
                    data-testid={`manage-lists-item-${list.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 14px',
                      borderRadius: 14,
                      background: isSelected ? 'rgba(0, 122, 255, 0.08)' : 'var(--bg-card, rgba(0,0,0,0.02))',
                      border: isSelected
                        ? '1.5px solid var(--accent-primary, #007aff)'
                        : '1px solid var(--border-subtle, rgba(0,0,0,0.05))',
                      transition: 'background-color 0.15s ease, border-color 0.15s ease',
                    }}
                  >
                    {/* Multi-select checkbox */}
                    <button
                      type="button"
                      data-testid="manage-lists-item-select"
                      aria-label={isSelected ? `Deseleccionar ${list.name}` : `Seleccionar ${list.name}`}
                      onClick={() => toggleSelect(list.id)}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        border: isSelected ? 'none' : '2px solid var(--border-subtle, #8e8e93)',
                        background: isSelected ? 'var(--accent-primary, #007aff)' : 'transparent',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0,
                        padding: 0,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {isSelected && <Check size={14} strokeWidth={3} />}
                    </button>

                    {/* Color dot / icon */}
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: list.color || 'var(--accent-primary)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <IconComponent size={18} strokeWidth={2} />
                    </div>

                    {/* Info */}
                    <div
                      style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                      onClick={() => toggleSelect(list.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            fontSize: '0.95rem',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {list.name}
                        </span>
                        {list.isPinned && (
                          <span
                            title="Fijada"
                            style={{
                              fontSize: '0.7rem',
                              padding: '1px 6px',
                              borderRadius: 6,
                              background: 'rgba(255, 149, 0, 0.15)',
                              color: '#ff9500',
                              fontWeight: 700,
                            }}
                          >
                            Fijada
                          </span>
                        )}
                        {list.isFolder && (
                          <span
                            title="Carpeta"
                            style={{
                              fontSize: '0.7rem',
                              padding: '1px 6px',
                              borderRadius: 6,
                              background: 'rgba(90, 200, 250, 0.15)',
                              color: '#007aff',
                              fontWeight: 700,
                            }}
                          >
                            Carpeta
                          </span>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: '0.78rem',
                          color: 'var(--text-tertiary, #8e8e93)',
                        }}
                      >
                        {count} {count === 1 ? 'tarea pendiente' : 'tareas pendientes'}
                      </span>
                    </div>

                    {/* Item controls: Reorder & Edit & Pin & Delete */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      {/* Reorder Up */}
                      <button
                        type="button"
                        aria-label="Subir orden"
                        disabled={index === 0}
                        onClick={() => handleMove(index, 'up')}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          border: 'none',
                          background: 'transparent',
                          color: index === 0 ? 'var(--border-subtle)' : 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: index === 0 ? 'default' : 'pointer',
                        }}
                      >
                        <ChevronUp size={16} />
                      </button>

                      {/* Reorder Down */}
                      <button
                        type="button"
                        aria-label="Bajar orden"
                        disabled={index === displayedLists.length - 1}
                        onClick={() => handleMove(index, 'down')}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          border: 'none',
                          background: 'transparent',
                          color:
                            index === displayedLists.length - 1
                              ? 'var(--border-subtle)'
                              : 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: index === displayedLists.length - 1 ? 'default' : 'pointer',
                        }}
                      >
                        <ChevronDown size={16} />
                      </button>

                      {/* Pin Toggle */}
                      <button
                        type="button"
                        aria-label={list.isPinned ? 'Desfijar lista' : 'Fijar lista'}
                        onClick={() => {
                          HapticService.selection();
                          updateList(list.id, { isPinned: !list.isPinned });
                        }}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          border: 'none',
                          background: 'transparent',
                          color: list.isPinned ? '#ff9500' : 'var(--text-tertiary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                        title={list.isPinned ? 'Desfijar' : 'Fijar'}
                      >
                        {list.isPinned ? <Pin size={15} /> : <PinOff size={15} />}
                      </button>

                      {/* Edit (opens ListConfigModal for this list) */}
                      {onEditList && (
                        <button
                          type="button"
                          aria-label={`Editar ${list.name}`}
                          onClick={() => {
                            HapticService.selection();
                            onClose();
                            onEditList(list.id);
                          }}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                          title="Personalizar nombre, icono o color"
                        >
                          <Edit2 size={15} />
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        type="button"
                        aria-label={`Eliminar ${list.name}`}
                        onClick={() => handleDeleteSingle(list)}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--accent-red, #ff3b30)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                        title="Eliminar lista"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Floating Bulk Actions Bar (when >=1 selected) */}
          <AnimatePresence>
            {selectedIds.size > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                style={{
                  padding: '12px 20px',
                  borderTop: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                  background: 'var(--bg-elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
                }}
              >
                <span style={{ fontSize: '0.88rem', fontWeight: 650 }}>
                  {selectedIds.size} {selectedIds.size === 1 ? 'seleccionada' : 'seleccionadas'}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={handleBulkTogglePin}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 12px',
                      borderRadius: 10,
                      background: 'var(--bg-secondary, rgba(0,0,0,0.05))',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle, rgba(0,0,0,0.1))',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Pin size={14} /> Fijar / Desfijar
                  </button>

                  <button
                    type="button"
                    data-testid="manage-lists-bulk-delete-btn"
                    onClick={handleBulkDelete}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 14px',
                      borderRadius: 10,
                      background: 'var(--accent-red, #ff3b30)',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '0.82rem',
                      fontWeight: 650,
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(255, 59, 48, 0.3)',
                    }}
                  >
                    <Trash2 size={14} /> Eliminar ({selectedIds.size})
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom Footer with Add buttons */}
          <div
            style={{
              padding: '12px 20px',
              borderTop: selectedIds.size > 0 ? 'none' : '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-card, rgba(0,0,0,0.02))',
            }}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              {onCreateList && (
                <>
                  <button
                    type="button"
                    data-testid="manage-lists-new-list-btn"
                    onClick={() => {
                      HapticService.selection();
                      onClose();
                      onCreateList(false);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 12px',
                      borderRadius: 10,
                      background: 'transparent',
                      color: 'var(--accent-primary, #007aff)',
                      border: '1px solid var(--accent-primary, #007aff)',
                      fontSize: '0.82rem',
                      fontWeight: 650,
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={14} strokeWidth={2.5} /> Nueva lista
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      HapticService.selection();
                      onClose();
                      onCreateList(true);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 12px',
                      borderRadius: 10,
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-subtle, rgba(0,0,0,0.12))',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <FolderPlus size={14} /> Nueva carpeta
                  </button>
                </>
              )}
            </div>

            <button
              type="button"
              data-testid="manage-lists-done-btn"
              onClick={onClose}
              style={{
                padding: '7px 18px',
                borderRadius: 10,
                background: 'var(--accent-primary, #007aff)',
                color: '#ffffff',
                border: 'none',
                fontSize: '0.86rem',
                fontWeight: 650,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,122,255,0.25)',
              }}
            >
              Listo
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};
