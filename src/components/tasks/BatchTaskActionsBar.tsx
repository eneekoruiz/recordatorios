import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutList, IndentIncrease, CheckCircle2, Trash2, X, FolderInput } from 'lucide-react';
import type { TaskItem, ListSection } from '../../models/Task';
import { useAppStore } from '../../store/useAppStore';
import { showUndoToast } from '../../utils/undoToast';
import { HapticService } from '../../services/HapticService';
import { SoundService } from '../../services/SoundService';

interface BatchTaskActionsBarProps {
  selectedTaskIds: Set<string>;
  onClearSelection: () => void;
  listSections: ListSection[];
  tasks: Record<string, TaskItem>;
  currentListId?: string;
}

export const BatchTaskActionsBar: React.FC<BatchTaskActionsBarProps> = ({
  selectedTaskIds,
  onClearSelection,
  listSections,
  tasks,
  currentListId,
}) => {
  const updateTask = useAppStore(state => state.updateTask);
  const nestTask = useAppStore(state => state.nestTask);
  const deleteTask = useAppStore(state => state.deleteTask);
  const toggleTask = useAppStore(state => state.toggleTask);

  const [activeModal, setActiveModal] = useState<'section' | 'nest' | 'delete' | null>(null);

  if (selectedTaskIds.size === 0) return null;

  const count = selectedTaskIds.size;

  // Secciones disponibles en esta lista
  const availableSections = listSections.filter(s => !s.deleted_at && (!currentListId || s.listId === currentListId));

  // Tareas candidatas para anidar (excluyendo las seleccionadas y sus descendientes)
  const candidateParentTasks = Object.values(tasks).filter(t => {
    if (!t || t.deleted_at) return false;
    if (selectedTaskIds.has(t.id)) return false;
    if (currentListId && t.categoryId !== currentListId) return false;
    return true;
  });

  const handleMoveToSection = (sectionId: string | undefined) => {
    HapticService.notification('success');
    selectedTaskIds.forEach(id => {
      updateTask(id, { sectionId });
    });
    setActiveModal(null);
    onClearSelection();
  };

  const handleNestInTask = (parentTaskId: string) => {
    HapticService.notification('success');
    selectedTaskIds.forEach(id => {
      nestTask(id, parentTaskId);
    });
    setActiveModal(null);
    onClearSelection();
  };

  const handleBatchToggle = () => {
    HapticService.notification('success');
    SoundService.playComplete();
    selectedTaskIds.forEach(id => {
      const t = tasks[id];
      if (t) toggleTask(id, t.status === 'completed');
    });
    onClearSelection();
  };

  const handleBatchDelete = () => {
    HapticService.impact('heavy');
    const ids = Array.from(selectedTaskIds).filter((id) => tasks[id]);
    ids.forEach(id => {
      deleteTask(id);
    });
    if (ids.length > 0) {
      showUndoToast(
        ids.length === 1 ? `«${tasks[ids[0]].title}» eliminado` : `${ids.length} recordatorios eliminados`,
        () => ids.forEach((id) => useAppStore.getState().restoreTask(id))
      );
    }
    setActiveModal(null);
    onClearSelection();
  };

  return (
    <>
      <motion.div
        initial={{ y: 80, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 80, opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 999995,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px 6px 14px',
          background: 'var(--bg-surface-glass, rgba(255, 255, 255, 0.88))',
          backdropFilter: 'blur(30px) saturate(180%)',
          WebkitBackdropFilter: 'blur(30px) saturate(180%)',
          borderRadius: 999,
          border: '1px solid var(--border-subtle, rgba(0,0,0,0.12))',
          boxShadow: '0 12px 36px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.06)',
          maxWidth: 'calc(100vw - 32px)',
          overflowX: 'auto',
          userSelect: 'none'
        }}
      >
        {/* Contador de seleccionados */}
        <span
          style={{
            fontSize: '0.85rem',
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
            paddingRight: 6,
            borderRight: '1px solid var(--border-subtle)'
          }}
        >
          {count} {count === 1 ? 'seleccionado' : 'seleccionados'}
        </span>

        {/* Botón: Mover a sección */}
        <button
          type="button"
          onClick={() => setActiveModal('section')}
          title="Mover todos a otra sección"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '6px 12px',
            borderRadius: 999,
            background: 'var(--bg-elevated, rgba(0,0,0,0.05))',
            border: 'none',
            color: 'var(--text-primary)',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'background 0.15s ease'
          }}
        >
          <LayoutList size={15} color="var(--accent-primary)" />
          <span>Sección</span>
        </button>

        {/* Botón: Anidar en tarea */}
        <button
          type="button"
          onClick={() => setActiveModal('nest')}
          title="Anidar todos como subtareas de otra tarea"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '6px 12px',
            borderRadius: 999,
            background: 'var(--bg-elevated, rgba(0,0,0,0.05))',
            border: 'none',
            color: 'var(--text-primary)',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'background 0.15s ease'
          }}
        >
          <IndentIncrease size={15} color="var(--accent-primary)" />
          <span>Anidar</span>
        </button>

        {/* Botón: Marcar completados */}
        <button
          type="button"
          onClick={handleBatchToggle}
          title="Alternar estado de completado"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '6px 10px',
            borderRadius: 999,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          <CheckCircle2 size={16} color="#30d158" />
        </button>

        {/* Botón: Eliminar */}
        <button
          type="button"
          onClick={() => setActiveModal('delete')}
          title="Eliminar recordatorios seleccionados"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '6px 10px',
            borderRadius: 999,
            background: 'transparent',
            border: 'none',
            color: 'var(--accent-red, #ff3b30)',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          <Trash2 size={15} />
        </button>

        {/* Botón: Cancelar / Deseleccionar */}
        <button
          type="button"
          onClick={onClearSelection}
          title="Cancelar selección"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'var(--bg-hover, rgba(0,0,0,0.06))',
            border: 'none',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            marginLeft: 2
          }}
        >
          <X size={15} />
        </button>
      </motion.div>

      {/* Modal selector de Sección */}
      <AnimatePresence>
        {activeModal === 'section' && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999998,
              background: 'rgba(0,0,0,0.3)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16
            }}
            onClick={() => setActiveModal(null)}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 380,
                background: 'var(--bg-card, #ffffff)',
                borderRadius: 16,
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
                overflow: 'hidden'
              }}
            >
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                  Mover {count} {count === 1 ? 'recordatorio' : 'recordatorios'} a:
                </span>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ maxHeight: 320, overflowY: 'auto', padding: '6px 8px' }}>
                {/* Opción Sin Sección (General) */}
                <button
                  type="button"
                  className="ios-dropdown-item"
                  onClick={() => handleMoveToSection(undefined)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                    fontSize: '0.92rem',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    textAlign: 'left'
                  }}
                >
                  <FolderInput size={16} color="var(--text-tertiary)" />
                  <span>Sin sección (General)</span>
                </button>

                {availableSections.map(sec => (
                  <button
                    key={sec.id}
                    type="button"
                    className="ios-dropdown-item"
                    onClick={() => handleMoveToSection(sec.id)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 10,
                      border: 'none',
                      background: 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      cursor: 'pointer',
                      fontSize: '0.92rem',
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      textAlign: 'left'
                    }}
                  >
                    <LayoutList size={16} color="var(--accent-primary)" />
                    <span>{sec.name}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal selector de Tarea Padre para Anidar */}
      <AnimatePresence>
        {activeModal === 'nest' && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999998,
              background: 'rgba(0,0,0,0.3)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16
            }}
            onClick={() => setActiveModal(null)}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 420,
                background: 'var(--bg-card, #ffffff)',
                borderRadius: 16,
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
                overflow: 'hidden'
              }}
            >
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                  Anidar {count} {count === 1 ? 'recordatorio' : 'recordatorios'} dentro de:
                </span>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ maxHeight: 340, overflowY: 'auto', padding: '6px 8px' }}>
                {candidateParentTasks.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.88rem' }}>
                    No hay otras tareas disponibles para anidar.
                  </div>
                ) : (
                  candidateParentTasks.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      className="ios-dropdown-item"
                      onClick={() => handleNestInTask(t.id)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: 'none',
                        background: 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        cursor: 'pointer',
                        fontSize: '0.92rem',
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        textAlign: 'left'
                      }}
                    >
                      <IndentIncrease size={16} color="var(--accent-primary)" />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.title || 'Recordatorio sin título'}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de confirmación para eliminar */}
      <AnimatePresence>
        {activeModal === 'delete' && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999998,
              background: 'rgba(0,0,0,0.3)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16
            }}
            onClick={() => setActiveModal(null)}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 360,
                background: 'var(--bg-card, #ffffff)',
                borderRadius: 16,
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
                padding: '20px',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                ¿Eliminar {count} {count === 1 ? 'recordatorio' : 'recordatorios'}?
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
                Se moverán a la papelera y podrás recuperarlos durante 30 días.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-elevated)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: 'var(--text-primary)'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleBatchDelete}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'var(--accent-red, #ff3b30)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#ffffff'
                  }}
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
