import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Zap, CheckCircle, Play, ArrowRight } from 'lucide-react';
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

  const results = useMemo(() => {
    const nextResults: any[] = [];
    const q = query.toLowerCase();

    if ('brain dump'.includes(q) || 'nueva'.includes(q)) {
      nextResults.push({ type: 'action', id: 'brain_dump', title: 'Abrir Brain Dump', icon: <Zap size={16} color="var(--accent-primary)" /> });
    }

    cycles.forEach(c => {
      if (c.name.toLowerCase().includes(q)) {
        nextResults.push({ type: 'cycle', id: c.id, title: 'Ir a ' + c.name, icon: <Search size={14} color="var(--text-tertiary)" /> });
      }
    });

    allTasks.forEach(t => {
      if (t.title.toLowerCase().includes(q)) {
        const catId = t.categoryId || (t as any).category_id;
        const sub = catId === 'inbox' || !catId ? 'Bandeja de entrada' : (catId || '');
        const isHigh = t.priority === 3 || t.priority === 'high' || t.priority === '!!!' || t.title.includes('🚨');
        const titlePrefix = isHigh && !t.title.includes('🚨') ? '🚨 ' : '';
        nextResults.push({ type: 'task_flow', id: t.id, title: 'Modo Flow: ' + titlePrefix + t.title, subtitle: sub, icon: <Play size={16} /> });
        nextResults.push({ type: 'task_complete', id: t.id, title: 'Completar: ' + titlePrefix + t.title, subtitle: sub, icon: <CheckCircle size={16} color="var(--accent-green)" /> });
      }
    });

    return nextResults;
  }, [allTasks, cycles, query]);

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
        if (action.id === 'brain_dump') onSelectView('BRAIN_DUMP');
        break;
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
                    ref={el => itemRefs.current[idx] = el}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => executeAction(result)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: 'var(--space-12) var(--space-16)',
                      background: isSelected ? 'var(--accent-glow)' : 'transparent',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      color: isSelected ? 'white' : 'var(--text-secondary)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
                      {result.icon}
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '1rem', fontWeight: isSelected ? 500 : 400 }}>{result.title}</span>
                        {result.subtitle && <span style={{ fontSize: '0.75rem', color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--text-tertiary)' }}>{result.subtitle}</span>}
                      </div>
                    </div>
                    {isSelected && <ArrowRight size={16} color="var(--accent-primary)" />}
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
