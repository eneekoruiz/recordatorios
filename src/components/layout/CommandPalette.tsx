import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Zap, CheckCircle, Play, ArrowRight, Plus } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface CommandPaletteProps {
  onSelectView: (view: string) => void;
  onOpenZenMode: (taskId: string) => void;
}

export function CommandPalette({ onSelectView, onOpenZenMode }: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeFilter, setActiveFilter] = useState<'all' | 'cycles' | 'inbox' | 'high'>('all');

  const { tasks, cycles, toggleTask } = useAppStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const allTasks = useMemo(
    () => Object.values(tasks).filter(t => !t.deleted_at && t.status === 'pending'),
    [tasks]
  );

  const lists = useAppStore(state => state.lists);

  const results = useMemo(() => {
    const nextResults: any[] = [];
    const q = query.toLowerCase().trim();

    // 1. Acciones del sistema
    if ('nueva tarea'.includes(q) || 'crear'.includes(q) || 'añadir'.includes(q) || q === '') {
      nextResults.push({ type: 'action', id: 'new_task', title: '✨ Crear nueva tarea...', subtitle: 'Acceso rápido', icon: <Plus size={16} color="var(--accent-primary)" /> });
    }

    if ('brain dump'.includes(q) || 'importar texto'.includes(q)) {
      nextResults.push({ type: 'action', id: 'brain_dump', title: '📥 Abrir Universal Importer / Brain Dump', subtitle: 'Importar en lote', icon: <Zap size={16} color="var(--accent-primary)" /> });
    }

    if ('estadísticas'.includes(q) || 'analytics'.includes(q) || 'métricas'.includes(q)) {
      nextResults.push({ type: 'action', id: 'analytics', title: '📊 Ver Estadísticas y Métricas', subtitle: 'Productividad', icon: <Zap size={16} color="var(--accent-primary)" /> });
    }

    // 2. Listas Inteligentes
    const smartLists = [
      { id: 'smart_today', name: 'Hoy', icon: '☀️' },
      { id: 'smart_scheduled', name: 'Programados', icon: '📅' },
      { id: 'smart_all', name: 'Todos', icon: '📋' },
      { id: 'smart_flagged', name: 'Marcados', icon: '🚩' },
      { id: 'smart_completed', name: 'Completados', icon: '✅' },
      { id: 'TRASH', name: 'Papelera', icon: '🗑️' }
    ];

    smartLists.forEach(sl => {
      if (sl.name.toLowerCase().includes(q) || q === '') {
        nextResults.push({ type: 'smart', id: sl.id, title: `${sl.icon} Ir a ${sl.name}`, subtitle: 'Lista inteligente', icon: <Search size={14} color="var(--text-tertiary)" /> });
      }
    });

    // 3. Listas personalizadas
    const uniqueLists = Array.from(new Map((lists || []).map(l => [l.id, l])).values());
    uniqueLists.filter(l => l.id !== 'user_preferences_smart_lists').forEach(l => {
      if (l.name.toLowerCase().includes(q) || q === '') {
        nextResults.push({ type: 'list', id: `list_${l.id}`, title: `📁 ${l.name}`, subtitle: 'Mis listas', icon: <Search size={14} color="var(--accent-primary)" /> });
      }
    });

    // 4. Ciclos Temporales
    cycles.forEach(c => {
      if (c.name.toLowerCase().includes(q) || q === '') {
        nextResults.push({ type: 'cycle', id: c.id, title: `🔄 Ciclo ${c.name}`, subtitle: 'Ciclo temporal', icon: <Search size={14} color="var(--accent-orange)" /> });
      }
    });

    // 5. Tareas
    allTasks.forEach(t => {
      if (t.title.toLowerCase().includes(q) && q !== '') {
        const catId = t.categoryId || (t as any).category_id;
        const sub = catId === 'inbox' || !catId ? 'Bandeja de entrada' : (catId || '');
        const isHigh = t.priority === 'high' || (t.priority as any) === 1;
        const titlePrefix = isHigh ? '🚨 ' : '';
        nextResults.push({ type: 'task_flow', id: t.id, title: 'Modo Enfoque: ' + titlePrefix + t.title, subtitle: sub, icon: <Play size={16} /> });
        nextResults.push({ type: 'task_complete', id: t.id, title: 'Completar: ' + titlePrefix + t.title, subtitle: sub, icon: <CheckCircle size={16} color="var(--accent-green)" /> });
      }
    });

    return nextResults;
  }, [allTasks, cycles, lists, query]);

  const filteredResults = results.filter(item => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'cycles') return item.type === 'cycle';
    if (activeFilter === 'inbox') return item.type === 'task_complete' && (item.subtitle?.toLowerCase().includes('inbox') || item.subtitle?.toLowerCase().includes('bandeja'));
    if (activeFilter === 'high') return item.type === 'task_complete' && item.title.toLowerCase().includes('🚨');
    return true;
  });

  const executeAction = useCallback((action: any) => {
    switch (action.type) {
      case 'action':
        if (action.id === 'brain_dump') onSelectView('DATA');
        else if (action.id === 'analytics') onSelectView('ANALYTICS');
        else if (action.id === 'new_task') {
          window.dispatchEvent(new Event('open-new-task-drawer'));
        }
        break;
      case 'smart':
      case 'list':
      case 'cycle':
        onSelectView(action.id);
        break;
      case 'task_flow':
        onOpenZenMode(action.id);
        break;
      case 'task_complete':
        toggleTask(action.id);
        break;
    }
    setIsOpen(false);
  }, [onOpenZenMode, onSelectView, toggleTask]);

  useEffect(() => {
    const handleOpenCommandPalette = () => setIsOpen(true);
    window.addEventListener('open-command-palette', handleOpenCommandPalette);
    return () => window.removeEventListener('open-command-palette', handleOpenCommandPalette);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }

      if (isOpen) {
        if (e.key === 'Escape') setIsOpen(false);
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, Math.max(filteredResults.length - 1, 0)));
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          const selected = filteredResults[selectedIndex];
          if (selected) executeAction(selected);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [executeAction, isOpen, filteredResults, selectedIndex]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
      setActiveFilter('all');
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex, isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="command-palette-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '15vh'
          }}
        >
          <motion.div
            initial={{ scale: 0.95, y: -20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: -20 }}
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '600px',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', padding: 'var(--space-16) var(--space-24)', borderBottom: '1px solid var(--border-subtle)' }}>
              <Search size={20} color="var(--text-tertiary)" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
                placeholder="Busca tareas, ciclos o acciones..."
                style={{
                  flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)',
                  fontSize: '1.2rem', padding: '0 var(--space-16)', outline: 'none'
                }}
              />
              <div style={{ display: 'flex', gap: 4 }}>
                <kbd style={{ background: 'var(--bg-base)', padding: '4px 8px', borderRadius: 4, fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>ESC</kbd>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              {[
                { id: 'all', label: '✨ Todos' },
                { id: 'cycles', label: '📅 Ciclos' },
                { id: 'inbox', label: '📥 Bandeja' },
                { id: 'high', label: '🚨 Prioridad' }
              ].map(pill => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => { setActiveFilter(pill.id as any); setSelectedIndex(0); }}
                  style={{
                    background: activeFilter === pill.id ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                    color: activeFilter === pill.id ? 'white' : 'var(--text-secondary)',
                    border: 'none', borderRadius: 14, padding: '4px 12px', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s ease', whiteSpace: 'nowrap'
                  }}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            <div style={{ maxHeight: '400px', overflowY: 'auto', padding: 'var(--space-8)' }}>
              {filteredResults.slice(0, 15).map((result, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={result.type + '_' + result.id}
                    ref={el => { itemRefs.current[idx] = el; }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => executeAction(result)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: isSelected ? 'var(--accent-primary)' : 'transparent',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      transition: 'background-color 0.1s ease',
                      color: isSelected ? 'white' : 'var(--text-primary)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ 
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: isSelected ? 'white' : 'var(--text-secondary)'
                      }}>
                        {result.icon}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: '0.95rem', fontWeight: 500, color: isSelected ? 'white' : 'var(--text-primary)' }}>{result.title}</span>
                        {result.subtitle && <span style={{ fontSize: '0.78rem', color: isSelected ? 'rgba(255,255,255,0.85)' : 'var(--text-tertiary)' }}>{result.subtitle}</span>}
                      </div>
                    </div>
                    {isSelected && <ArrowRight size={16} color="white" />}
                  </div>
                );
              })}
              {filteredResults.length === 0 && (
                <div style={{ padding: 'var(--space-32)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  No se encontraron resultados
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
