import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Sun, Moon, Sparkles, Calendar, Inbox, CheckCircle2, 
  Plus, Folder, CornerDownLeft, X, BarChart2, FileText, Play, Repeat
} from 'lucide-react';
import { useAppStore, isTaskCompleted } from '../../store/useAppStore';
import type { TaskItem } from '../../models/Task';

interface SpotlightModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onSelectView: (view: string) => void;
  onEditTask?: (id: string) => void;
  onOpenZenMode?: (id: string) => void;
}

interface CommandItem {
  id: string;
  type: 'action' | 'list' | 'cycle' | 'task';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  color?: string;
  shortcut?: string;
  action: () => void;
}

export function SpotlightModal({ isOpen, onClose, onSelectView, onEditTask, onOpenZenMode }: SpotlightModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isModalOpen = isOpen !== undefined ? isOpen : internalOpen;

  const handleClose = () => {
    setInternalOpen(false);
    onClose?.();
  };

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  const tasks = useAppStore(state => state.tasks);
  const lists = useAppStore(state => state.lists);
  const cycles = useAppStore(state => state.cycles);
  const theme = useAppStore(state => state.theme);
  const setTheme = useAppStore(state => state.setTheme);

  // Global listeners for opening Spotlight
  useEffect(() => {
    const handleOpen = () => setInternalOpen(true);
    window.addEventListener('open-command-palette', handleOpen);
    window.addEventListener('open-spotlight', handleOpen);
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setInternalOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('open-command-palette', handleOpen);
      window.removeEventListener('open-spotlight', handleOpen);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Focus input on open
  useEffect(() => {
    if (isModalOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isModalOpen]);

  const items = useMemo<CommandItem[]>(() => {
    const q = query.trim().toLowerCase();
    const result: CommandItem[] = [];

    // 1. Acciones Rápidas del Sistema
    const quickActions: CommandItem[] = [
      {
        id: 'action_today',
        type: 'action',
        title: 'Ir a Hoy',
        subtitle: 'Ver recordatorios programados para hoy',
        icon: <Calendar size={16} color="#007aff" />,
        action: () => { onSelectView('smart_today'); handleClose(); }
      },
      {
        id: 'action_all',
        type: 'action',
        title: 'Ir a Todos',
        subtitle: 'Ver todos los recordatorios activos',
        icon: <Inbox size={16} color="#48484a" />,
        action: () => { onSelectView('smart_all'); handleClose(); }
      },
      {
        id: 'action_scheduled',
        type: 'action',
        title: 'Ir a Programados',
        subtitle: 'Ver calendario y tareas futuras',
        icon: <Calendar size={16} color="#ff3b30" />,
        action: () => { onSelectView('smart_scheduled'); handleClose(); }
      },
      {
        id: 'action_ai',
        type: 'action',
        title: 'Asistente IA con MCP',
        subtitle: 'Crear o desglosar tareas en lenguaje natural',
        icon: <Sparkles size={16} color="#af52de" />,
        shortcut: 'Ctrl+J',
        action: () => {
          handleClose();
          window.dispatchEvent(new CustomEvent('open-ai-assistant'));
        }
      },
      {
        id: 'action_importer',
        type: 'action',
        title: 'Universal Importer / Brain Dump',
        subtitle: 'Importar listas masivas o notas',
        icon: <FileText size={16} color="#34c759" />,
        action: () => { onSelectView('DATA'); handleClose(); }
      },
      {
        id: 'action_analytics',
        type: 'action',
        title: 'Estadísticas y Métricas',
        subtitle: 'Panel de productividad y progreso',
        icon: <BarChart2 size={16} color="#ff9500" />,
        action: () => { onSelectView('ANALYTICS'); handleClose(); }
      },
      {
        id: 'action_theme',
        type: 'action',
        title: theme === 'dark' ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro',
        subtitle: 'Alternar aspecto visual',
        icon: theme === 'dark' ? <Sun size={16} color="#ff9500" /> : <Moon size={16} color="#5856d6" />,
        action: () => {
          const next = theme === 'dark' ? 'light' : 'dark';
          setTheme(next);
          localStorage.setItem('user_explicit_theme', next);
          handleClose();
        }
      },
      {
        id: 'action_new_task',
        type: 'action',
        title: 'Nuevo Recordatorio',
        subtitle: 'Abrir barra de creación rápida',
        icon: <Plus size={16} color="#34c759" />,
        shortcut: 'N',
        action: () => {
          handleClose();
          const quickInput = document.getElementById('quick-add-input');
          if (quickInput) {
            quickInput.focus();
          } else {
            window.dispatchEvent(new Event('open-new-task-drawer'));
          }
        }
      }
    ];

    // Filtrar acciones rápidas
    quickActions.forEach(action => {
      if (!q || (action.title || '').toLowerCase().includes(q) || (action.subtitle && action.subtitle.toLowerCase().includes(q))) {
        result.push(action);
      }
    });

    // 2. Coincidencias en Listas
    (lists || []).forEach(list => {
      if (list.id === 'user_preferences_smart_lists' || list.id === 'user_preferences_cycle_visibility') return;
      if (!q || (list.name || '').toLowerCase().includes(q)) {
        result.push({
          id: `list_${list.id}`,
          type: 'list',
          title: list.name,
          subtitle: `Lista personalizada`,
          icon: <Folder size={16} color={list.color || '#007aff'} />,
          action: () => {
            onSelectView(`list_${list.id}`);
            handleClose();
          }
        });
      }
    });

    // 3. Coincidencias en Ciclos
    (cycles || []).forEach(cycle => {
      if (!q || (cycle.name || '').toLowerCase().includes(q)) {
        result.push({
          id: `cycle_${cycle.id}`,
          type: 'cycle',
          title: `Ciclo: ${cycle.name}`,
          subtitle: 'Ciclo temporal recurrente',
          icon: <Repeat size={16} color="var(--accent-orange, #ff9500)" />,
          action: () => {
            onSelectView(cycle.id);
            handleClose();
          }
        });
      }
    });

    // 4. Coincidencias en Recordatorios (si el usuario escribió algo en el buscador)
    if (q) {
      const allTasks = (Object.values(tasks || {}) as TaskItem[])
        .filter(t => !t.deleted_at)
        .filter(t => {
          const title = (t.title || '').toLowerCase();
          const desc = (t.description || '').toLowerCase();
          return title.includes(q) || desc.includes(q);
        })
        .slice(0, 15); // Top 15 resultados para máxima velocidad

      allTasks.forEach(task => {
        const completed = isTaskCompleted(task);
        const taskList = lists?.find(l => l.id === task.categoryId);
        const listColor = taskList?.color || '#007aff';

        result.push({
          id: `task_${task.id}`,
          type: 'task',
          title: task.title,
          subtitle: task.price ? `${task.price} € · ${taskList?.name || 'Inbox'}` : (taskList?.name || 'Inbox'),
          icon: completed ? (
            <CheckCircle2 size={16} color="#34c759" />
          ) : (
            <div style={{ width: 12, height: 12, borderRadius: '50%', border: `2px solid ${listColor}` }} />
          ),
          color: listColor,
          action: () => {
            if (task.categoryId) {
              onSelectView(`list_${task.categoryId}`);
            }
            if (onEditTask) {
              onEditTask(task.id);
            }
            handleClose();
          }
        });

        if (!completed && onOpenZenMode) {
          result.push({
            id: `zen_${task.id}`,
            type: 'action',
            title: `Modo Enfoque Zen: ${task.title}`,
            subtitle: 'Enfoque inmersivo con sonido binaural',
            icon: <Play size={16} color="#af52de" />,
            action: () => {
              onOpenZenMode(task.id);
              handleClose();
            }
          });
        }
      });
    }

    return result;
  }, [query, tasks, lists, cycles, theme, onSelectView, onEditTask, onOpenZenMode, setTheme]);

  // Manejo de teclado: Flechas arriba/abajo, Enter, Escape
  useEffect(() => {
    if (!isModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1 < items.length ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 >= 0 ? prev - 1 : items.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (items[selectedIndex]) {
          items[selectedIndex].action();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, items, selectedIndex]);

  // Asegurar que el elemento seleccionado esté visible en scroll
  useEffect(() => {
    if (listContainerRef.current) {
      const selectedEl = listContainerRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  if (!isModalOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div 
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999999,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingTop: '12vh',
          paddingLeft: 16,
          paddingRight: 16,
        }}
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)'
          }}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -12 }}
          transition={{ type: 'spring', damping: 28, stiffness: 450 }}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 620,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 18,
            boxShadow: '0 24px 70px rgba(0, 0, 0, 0.32), 0 4px 18px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '72vh'
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Search Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '16px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            gap: 12
          }}>
            <Search size={20} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="Buscar recordatorios, listas o acciones..."
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: '1.05rem',
                color: 'var(--text-primary)',
                fontFamily: 'inherit'
              }}
            />
            {query && (
              <button
                onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                style={{
                  background: 'var(--bg-hover)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 22, height: 22,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--text-tertiary)'
                }}
              >
                <X size={13} />
              </button>
            )}
            <kbd style={{
              fontSize: '0.72rem',
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: 6,
              background: 'var(--bg-hover)',
              color: 'var(--text-tertiary)',
              border: '1px solid var(--border-subtle)',
              fontFamily: 'inherit'
            }}>
              ESC
            </kbd>
          </div>

          {/* Results List */}
          <div 
            ref={listContainerRef}
            style={{
              overflowY: 'auto',
              padding: '8px',
              maxHeight: 'calc(72vh - 110px)'
            }}
          >
            {items.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                No se encontraron resultados para «{query}»
              </div>
            ) : (
              items.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={item.id}
                    onClick={() => item.action()}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 12,
                      cursor: 'pointer',
                      background: isSelected ? 'var(--accent-glow, rgba(0, 122, 255, 0.12))' : 'transparent',
                      color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                      transition: 'background-color 100ms ease',
                      gap: 12
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: 'var(--bg-hover)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {item.icon}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{
                          fontWeight: 600,
                          fontSize: '0.95rem',
                          color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }}>
                          {item.title}
                        </div>
                        {item.subtitle && (
                          <div style={{
                            fontSize: '0.78rem',
                            color: 'var(--text-tertiary)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            marginTop: 1
                          }}>
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {item.shortcut && (
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          color: 'var(--text-tertiary)',
                          background: 'var(--bg-hover)',
                          padding: '2px 6px',
                          borderRadius: 6
                        }}>
                          {item.shortcut}
                        </span>
                      )}
                      {isSelected && (
                        <CornerDownLeft size={14} color="var(--accent-primary)" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Navigation Hints */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 18px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
            fontSize: '0.75rem',
            color: 'var(--text-tertiary)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span><kbd style={{ fontWeight: 700 }}>↑</kbd> <kbd style={{ fontWeight: 700 }}>↓</kbd> navegar</span>
              <span><kbd style={{ fontWeight: 700 }}>↵</kbd> seleccionar</span>
            </div>
            <span>Spotlight ⌘K</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
