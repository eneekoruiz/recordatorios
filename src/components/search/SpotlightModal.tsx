import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Sun, Moon, Sparkles, Calendar, CalendarDays, CalendarClock, Inbox, Check,
  Plus, List, X, BarChart2, FileText, Play, Repeat, CornerDownLeft
} from 'lucide-react';
import { useAppStore, isTaskCompleted } from '../../store/useAppStore';
import type { TaskItem } from '../../models/Task';
import { formatEuro } from '../../utils/format';
import { modShortcut } from '../../utils/platform';

interface SpotlightModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onSelectView: (view: string) => void;
  onEditTask?: (id: string) => void;
  onOpenZenMode?: (id: string) => void;
}

type Group = 'task' | 'list' | 'cycle' | 'action';

interface CommandItem {
  id: string;
  group: Group;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  /** Fondo del icono (estilo Ajustes). Sin él, el icono va sin baldosa. */
  tint?: string;
  shortcut?: string;
  keywords?: string;
  action: () => void;
  /** Acción secundaria (⌘↵): enfocar un recordatorio pendiente. */
  focus?: () => void;
  score: number;
}

const GROUP_LABEL: Record<Group, string> = {
  task: 'Recordatorios',
  list: 'Listas',
  cycle: 'Frecuencias',
  action: 'Acciones',
};

/** Minúsculas y sin tildes: «telefono» encuentra «Teléfono». */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** 0 empieza igual · 1 empieza una palabra · 2 contiene · 3 solo en el detalle · -1 no coincide. */
function matchScore(q: string, title: string, extra = ''): number {
  if (!q) return 0;
  const t = fold(title);
  if (t.startsWith(q)) return 0;
  if (new RegExp(`(^|[\\s·/(-])${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(t)) return 1;
  if (t.includes(q)) return 2;
  if (extra && fold(extra).includes(q)) return 3;
  return -1;
}

export function SpotlightModal({ isOpen, onClose, onSelectView, onEditTask, onOpenZenMode }: SpotlightModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isModalOpen = isOpen !== undefined ? isOpen : internalOpen;

  const handleClose = useCallback(() => {
    setInternalOpen(false);
    onClose?.();
  }, [onClose]);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  const tasks = useAppStore(state => state.tasks);
  const lists = useAppStore(state => state.lists);
  const cycles = useAppStore(state => state.cycles);
  const theme = useAppStore(state => state.theme);
  const setTheme = useAppStore(state => state.setTheme);

  useEffect(() => {
    const handleToggle = () => setInternalOpen(prev => !prev);
    const handleOpen = () => setInternalOpen(true);
    window.addEventListener('open-command-palette', handleToggle);
    window.addEventListener('open-spotlight', handleOpen);
    return () => {
      window.removeEventListener('open-command-palette', handleToggle);
      window.removeEventListener('open-spotlight', handleOpen);
    };
  }, []);

  // Al abrir: búsqueda limpia (se ajusta durante el render) y foco en el campo.
  const [wasOpen, setWasOpen] = useState(isModalOpen);
  if (isModalOpen !== wasOpen) {
    setWasOpen(isModalOpen);
    if (isModalOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }
  useEffect(() => {
    if (!isModalOpen) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [isModalOpen]);

  const items = useMemo<CommandItem[]>(() => {
    const q = fold(query.trim());
    const go = (view: string) => () => { onSelectView(view); handleClose(); };

    const actions: Omit<CommandItem, 'score' | 'group'>[] = [
      { id: 'action_today', title: 'Ir a Hoy', subtitle: 'Lo que toca hoy', icon: <Calendar size={15} />, tint: '#007aff', action: go('smart_today') },
      { id: 'action_all', title: 'Ir a Todos', subtitle: 'Todos los recordatorios pendientes', icon: <Inbox size={15} />, tint: '#8e8e93', action: go('smart_all') },
      { id: 'action_scheduled', title: 'Ir a Programados', subtitle: 'Los que tienen fecha', icon: <CalendarClock size={15} />, tint: '#ff3b30', action: go('smart_scheduled') },
      { id: 'action_calendar', title: 'Ir a Calendario', subtitle: 'Qué toca cada día', icon: <CalendarDays size={15} />, tint: '#5856d6', action: go('smart_calendar') },
      {
        id: 'action_new_task', title: 'Nuevo recordatorio', icon: <Plus size={15} />, tint: '#34c759', shortcut: 'N', keywords: 'crear añadir tarea',
        action: () => { handleClose(); window.dispatchEvent(new Event('open-new-task-drawer')); },
      },
      {
        id: 'action_ai', title: 'Asistente', subtitle: 'Crear o desglosar tareas escribiendo con naturalidad', icon: <Sparkles size={15} />, tint: '#af52de',
        shortcut: modShortcut('J'), keywords: 'ia inteligencia artificial',
        action: () => { handleClose(); window.dispatchEvent(new CustomEvent('open-ai-assistant')); },
      },
      { id: 'action_importer', title: 'Importar', subtitle: 'Pegar listas o notas y convertirlas en recordatorios', icon: <FileText size={15} />, tint: '#30b0c7', keywords: 'pegar notas volcado', action: go('DATA') },
      { id: 'action_analytics', title: 'Estadísticas', subtitle: 'Progreso y productividad', icon: <BarChart2 size={15} />, tint: '#ff9500', keywords: 'metricas progreso', action: go('ANALYTICS') },
      {
        id: 'action_theme', title: theme === 'dark' ? 'Usar aspecto claro' : 'Usar aspecto oscuro', icon: theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />,
        tint: '#636366', keywords: 'modo tema claro oscuro',
        action: () => {
          const next = theme === 'dark' ? 'light' : 'dark';
          setTheme(next);
          localStorage.setItem('user_explicit_theme', next);
          handleClose();
        },
      },
    ];

    const result: CommandItem[] = [];

    if (q) {
      (Object.values(tasks || {}) as TaskItem[])
        .filter(t => !t.deleted_at && t.title)
        .map(task => ({ task, score: matchScore(q, task.title, task.description || '') }))
        .filter(m => m.score >= 0)
        .sort((a, b) => a.score - b.score || Number(isTaskCompleted(a.task)) - Number(isTaskCompleted(b.task)))
        .slice(0, 12)
        .forEach(({ task, score }) => {
          const completed = isTaskCompleted(task);
          const taskList = lists?.find(l => l.id === task.categoryId);
          const listColor = taskList?.color || '#007aff';
          const price = Number(task.price);
          result.push({
            id: `task_${task.id}`,
            group: 'task',
            title: task.title,
            subtitle: [taskList?.name || 'Bandeja', price > 0 ? formatEuro(price) : ''].filter(Boolean).join(' · '),
            icon: completed
              ? <span className="spotlight-check is-done" style={{ background: listColor, borderColor: listColor }}><Check size={10} strokeWidth={3.5} /></span>
              : <span className="spotlight-check" style={{ borderColor: listColor }} />,
            score,
            action: () => {
              if (task.categoryId) onSelectView(`list_${task.categoryId}`);
              onEditTask?.(task.id);
              handleClose();
            },
            focus: !completed && onOpenZenMode ? () => { onOpenZenMode(task.id); handleClose(); } : undefined,
          });
        });
    }

    (lists || []).forEach(list => {
      if (list.id === 'user_preferences_smart_lists' || list.id === 'user_preferences_cycle_visibility') return;
      const score = matchScore(q, list.name || '');
      if (score < 0) return;
      result.push({
        id: `list_${list.id}`, group: 'list', title: list.name, score,
        icon: <List size={15} />, tint: list.color || '#007aff',
        action: go(`list_${list.id}`),
      });
    });

    (cycles || []).forEach(cycle => {
      const score = matchScore(q, cycle.name || '');
      if (score < 0) return;
      result.push({
        id: `cycle_${cycle.id}`, group: 'cycle', title: cycle.name, score,
        icon: <Repeat size={15} />, tint: cycle.color || '#ff9500',
        action: go(cycle.id),
      });
    });

    actions.forEach(a => {
      const score = matchScore(q, a.title, `${a.subtitle || ''} ${a.keywords || ''}`);
      if (score >= 0) result.push({ ...a, group: 'action', score });
    });

    // Sin búsqueda: primero las acciones. Con búsqueda: primero los recordatorios y, dentro de cada grupo, lo más parecido.
    const order: Group[] = q ? ['task', 'list', 'cycle', 'action'] : ['action', 'list', 'cycle', 'task'];
    return order.flatMap(g => result.filter(r => r.group === g).sort((a, b) => a.score - b.score));
  }, [query, tasks, lists, cycles, theme, onSelectView, onEditTask, onOpenZenMode, setTheme, handleClose]);

  const selected = items[selectedIndex];

  useEffect(() => {
    if (!isModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          setSelectedIndex(prev => (prev - 1 >= 0 ? prev - 1 : items.length - 1));
        } else {
          setSelectedIndex(prev => (prev + 1 < items.length ? prev + 1 : 0));
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1 < items.length ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 >= 0 ? prev - 1 : items.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = items[selectedIndex];
        if (!item) return;
        if ((e.metaKey || e.ctrlKey) && item.focus) item.focus();
        else item.action();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, items, selectedIndex, handleClose]);

  useEffect(() => {
    const el = listContainerRef.current?.querySelector<HTMLElement>(`[data-idx="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!isModalOpen) return null;

  let lastGroup: Group | null = null;

  return createPortal(
    <AnimatePresence>
      <div className="spotlight-overlay" onClick={handleClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: -8 }}
          transition={{ type: 'spring', damping: 30, stiffness: 480 }}
          className="spotlight-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Buscar"
          onClick={e => e.stopPropagation()}
        >
          <div className="spotlight-field">
            <Search size={18} className="spotlight-field-icon" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
              placeholder="Buscar recordatorios, listas o acciones..."
              aria-label="Buscar"
              enterKeyHint="go"
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <button type="button" className="spotlight-clear" aria-label="Borrar búsqueda" onClick={() => { setQuery(''); inputRef.current?.focus(); }}>
                <X size={11} strokeWidth={3} />
              </button>
            )}
            <button type="button" className="spotlight-cancel" onClick={handleClose}>Cancelar</button>
          </div>

          <div ref={listContainerRef} className="spotlight-results" role="listbox" aria-label="Resultados" tabIndex={0}>
            {items.length === 0 ? (
              <div className="spotlight-empty">Sin resultados para «{query.trim()}»</div>
            ) : items.map((item, idx) => {
              const header = item.group !== lastGroup ? GROUP_LABEL[item.group] : null;
              lastGroup = item.group;
              const isSelected = idx === selectedIndex;
              return (
                <React.Fragment key={item.id}>
                  {header && <div className="spotlight-section">{header}</div>}
                  <div
                    data-idx={idx}
                    role="option"
                    aria-selected={isSelected}
                    className={`spotlight-row${isSelected ? ' is-selected' : ''}`}
                    onClick={() => item.action()}
                    onMouseMove={() => { if (!isSelected) setSelectedIndex(idx); }}
                  >
                    <span className={item.tint ? 'spotlight-icon' : 'spotlight-icon is-plain'} style={item.tint ? { background: item.tint } : undefined}>
                      {item.icon}
                    </span>
                    <span className="spotlight-text">
                      <span className="spotlight-title">{item.title}</span>
                      {item.subtitle && <span className="spotlight-subtitle">{item.subtitle}</span>}
                    </span>
                    {item.focus && (
                      <button
                        type="button"
                        className="spotlight-focus"
                        title={`Enfocar (${modShortcut('↵')})`}
                        onClick={e => { e.stopPropagation(); item.focus?.(); }}
                      >
                        <Play size={11} fill="currentColor" /> Enfocar
                      </button>
                    )}
                    {item.shortcut && <kbd className="kbd spotlight-shortcut">{item.shortcut}</kbd>}
                    {isSelected && <CornerDownLeft size={14} className="spotlight-enter" aria-hidden="true" />}
                  </div>
                </React.Fragment>
              );
            })}
          </div>

          <div className="spotlight-footer" aria-hidden="true">
            <span><kbd className="kbd">↑</kbd><kbd className="kbd">↓</kbd> moverse</span>
            <span><kbd className="kbd">↵</kbd> abrir</span>
            {selected?.focus && <span><kbd className="kbd">{modShortcut('↵')}</kbd> enfocar</span>}
            <span className="spotlight-footer-end"><kbd className="kbd">esc</kbd> cerrar</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
