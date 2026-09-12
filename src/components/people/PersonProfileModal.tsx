import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Sparkles, Clock, Heart, Plus } from 'lucide-react';
import type { TaskItem } from '../../models/Task';
import { getPersonRelationshipStats } from '../../services/TaskService';
import { HapticService } from '../../services/HapticService';

interface PersonProfileModalProps {
  personName: string | null;
  isOpen: boolean;
  onClose: () => void;
  allTasks: TaskItem[];
  onEditTask?: (taskId: string) => void;
  onAddMemoryWithPerson?: (personName: string) => void;
}

export const PersonProfileModal: React.FC<PersonProfileModalProps> = ({
  personName,
  isOpen,
  onClose,
  allTasks,
  onEditTask,
  onAddMemoryWithPerson
}) => {
  if (!isOpen || !personName) return null;

  const stats = getPersonRelationshipStats(personName, allTasks);

  const initial = personName.charAt(0).toUpperCase();

  const handleTaskClick = (taskId: string) => {
    HapticService.selection();
    onClose();
    if (onEditTask) {
      onEditTask(taskId);
    }
  };

  const handleAddClick = () => {
    HapticService.impact('light');
    onClose();
    if (onAddMemoryWithPerson) {
      onAddMemoryWithPerson(personName);
    }
  };

  return createPortal(
    <AnimatePresence>
      <div
        className="person-profile-overlay"
        data-testid="person-profile-modal"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)'
          }}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ type: 'spring', damping: 28, stiffness: 400 }}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 520,
            maxHeight: '85vh',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 22,
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.25), 0 4px 16px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 100000
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #5856D6, #af52de)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '1.25rem',
                fontWeight: 700,
                boxShadow: '0 4px 12px rgba(88, 86, 214, 0.35)'
              }}>
                {initial}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                  {personName}
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Bitácora de momentos compartidos
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              title="Cerrar"
              aria-label="Cerrar"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '50%',
                width: 30,
                height: 30,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-secondary)'
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Stats Cards Row */}
          <div style={{
            padding: '16px 20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
            background: 'var(--bg-card)'
          }}>
            <div style={{
              padding: '12px 10px',
              borderRadius: 14,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 4 }}>
                <Heart size={12} color="#ff2d55" />
                <span>Vivencias</span>
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 750, color: 'var(--text-primary)' }}>
                {stats.count}
              </div>
            </div>

            <div style={{
              padding: '12px 10px',
              borderRadius: 14,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 4 }}>
                <Clock size={12} color="#5856D6" />
                <span>Último plan</span>
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 750, color: '#5856D6', marginTop: 2 }}>
                {stats.lastPlanText}
              </div>
            </div>

            <div style={{
              padding: '12px 10px',
              borderRadius: 14,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 4 }}>
                <Sparkles size={12} color="#ff9500" />
                <span>Primer recuerdo</span>
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: 650, color: 'var(--text-primary)', marginTop: 4 }}>
                {stats.earliestTask
                  ? new Date(stats.earliestTask.dueDate || stats.earliestTask.created_at).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
                  : '—'}
              </div>
            </div>
          </div>

          {/* Memories List */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Historial de Recuerdos
            </div>

            {stats.allPersonTasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-tertiary)', fontSize: '0.88rem' }}>
                No hay recuerdos registrados con {personName} todavía.
              </div>
            ) : (
              stats.allPersonTasks.map(task => {
                const dateStr = task.dueDate || task.created_at;
                const formatted = dateStr
                  ? new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '';

                return (
                  <div
                    key={task.id}
                    onClick={() => handleTaskClick(task.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    title="Toca para editar este recuerdo"
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {task.title}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        {formatted && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <Calendar size={11} /> {formatted}
                          </span>
                        )}
                        {task.vibe && (
                          <span style={{ fontSize: '0.72rem', color: '#ff9500', background: 'rgba(255, 149, 0, 0.12)', padding: '1px 6px', borderRadius: 999, fontWeight: 600 }}>
                            {task.vibe}
                          </span>
                        )}
                      </div>
                    </div>

                    {task.price !== undefined && (
                      <span className="apple-price-pill" style={{ marginLeft: 8, fontSize: '0.74rem' }}>
                        {task.price} €
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Action */}
          <div style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10
          }}>
            <button
              type="button"
              onClick={handleAddClick}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                borderRadius: 10,
                background: 'var(--accent-primary)',
                color: 'white',
                border: 'none',
                fontSize: '0.86rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0, 122, 255, 0.25)'
              }}
            >
              <Plus size={15} />
              <span>Añadir recuerdo con {personName}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};
