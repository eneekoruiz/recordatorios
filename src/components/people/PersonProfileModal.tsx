import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Share2, Coffee, ChevronRight } from 'lucide-react';
import type { TaskItem } from '../../models/Task';
import { getPersonRelationshipStats } from '../../services/TaskService';
import { HapticService } from '../../services/HapticService';
import { SheetNavBar } from '../ui/SheetNavBar';

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
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !personName) return null;

  const stats = getPersonRelationshipStats(personName, allTasks);

  const initial = personName.charAt(0).toUpperCase();

  const handleShare = async () => {
    if (!personName) return;
    const memories = stats.allPersonTasks.map((t: TaskItem) => {
      const date = new Date(t.dueDate || t.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
      return `• ${t.title} (${date}${t.locationName ? ` en ${t.locationName}` : ''}${t.vibe ? ` ${t.vibe}` : ''})`;
    }).join('\n');

    const shareText = `✨ Momentos compartidos con ${personName} (${stats.count} vivencias):\n\n${memories}\n\n— Registrado en Recordatorios Élite`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Vivencias con ${personName}`,
          text: shareText
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(shareText);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: `Resumen de vivencias con ${personName} copiado al portapapeles` }));
    }
  };

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

  const firstMemory = stats.earliestTask
    ? new Date(stats.earliestTask.dueDate || stats.earliestTask.created_at).toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
    : '—';

  return createPortal(
    <AnimatePresence>
      <div
        className="premium-overlay list-config-overlay person-profile-overlay"
        data-testid="person-profile-modal"
        style={{ position: 'fixed', inset: 0, zIndex: 99999 }}
        onClick={onClose}
      >
        <motion.div
          className="person-profile-sheet form-sheet"
          role="dialog"
          aria-modal="true"
          aria-label={personName}
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ type: 'spring', damping: 30, stiffness: 400 }}
          onClick={e => e.stopPropagation()}
        >
          <SheetNavBar title={personName} onConfirm={onClose} confirmLabel="Listo" confirmTitle="Cerrar" />

          <div className="form-sheet-body">
            {/* Cabecera: inicial + nombre */}
            <div className="form-hero" style={{ paddingBottom: 4 }}>
              <div className="form-hero-icon" style={{ background: 'linear-gradient(135deg, #5856D6, #af52de)', fontSize: '1.9rem', fontWeight: 700, ['--hero-color' as string]: 'rgba(88, 86, 214, 0.5)' } as React.CSSProperties}>
                {initial}
              </div>
            </div>

            {/* Cifras */}
            <div className="form-group stat-grid">
              <div><strong>{stats.count}</strong><span>{stats.count === 1 ? 'momento' : 'momentos'}</span></div>
              <div><strong style={{ color: '#5856D6' }}>{stats.lastPlanText}</strong><span>último plan</span></div>
              <div><strong>{firstMemory}</strong><span>primer recuerdo</span></div>
            </div>

            {/* Hace tiempo que no os veis */}
            {stats.daysSinceLast !== null && stats.daysSinceLast >= 30 && (
              <div className="form-group" data-testid="long-time-no-see-alert">
                <button type="button" className="form-row" onClick={handleAddClick}>
                  <span className="form-row-icon" style={{ background: '#ff9500' }}><Coffee size={15} /></span>
                  <span className="form-row-text">
                    <span className="form-row-title">Hace {stats.daysSinceLast} días del último plan</span>
                    <span className="form-row-sub">¿Qué tal un café o una llamada?</span>
                  </span>
                  <span style={{ color: 'var(--accent-blue, #007aff)', fontWeight: 600, fontSize: '0.9rem' }}>Planear algo</span>
                </button>
              </div>
            )}

            {/* Momentos */}
            <div>
              <p className="form-group-label">Momentos</p>
              <div className="form-group">
                <button type="button" className="form-row" onClick={handleAddClick}>
                  <span className="form-row-icon" style={{ background: 'var(--accent-blue, #007aff)' }}><Plus size={16} strokeWidth={2.6} /></span>
                  <span className="form-row-text"><span className="form-row-title" style={{ color: 'var(--accent-blue, #007aff)' }}>Añadir un momento con {personName}</span></span>
                </button>
                {stats.allPersonTasks.map(task => {
                  const dateStr = task.dueDate || task.created_at;
                  const formatted = dateStr
                    ? new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '';
                  const meta = [formatted, task.locationName, task.vibe].filter(Boolean).join(' · ');
                  return (
                    <button type="button" key={task.id} className="form-row" onClick={() => handleTaskClick(task.id)} title="Abrir este recuerdo">
                      <span className="form-row-text" style={{ paddingLeft: 40 }}>
                        <span className="form-row-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</span>
                        {meta && <span className="form-row-sub">{meta}</span>}
                      </span>
                      {task.price !== undefined && <span style={{ color: 'var(--text-secondary)', fontSize: '0.86rem' }}>{task.price} €</span>}
                      <ChevronRight size={16} color="var(--text-tertiary)" />
                    </button>
                  );
                })}
              </div>
              {stats.allPersonTasks.length === 0 && (
                <p className="form-group-footer">Todavía no hay momentos guardados con {personName}.</p>
              )}
            </div>

            {stats.allPersonTasks.length > 0 && (
              <div className="form-group">
                <button type="button" className="form-row" onClick={handleShare}>
                  <span className="form-row-icon" style={{ background: '#8e8e93' }}><Share2 size={15} /></span>
                  <span className="form-row-text"><span className="form-row-title">Compartir estos momentos</span></span>
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};
