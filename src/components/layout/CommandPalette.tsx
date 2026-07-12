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

  const { tasks, cycles, toggleTask } = useAppStore();
  const inputRef = useRef<HTMLInputElement>(null);

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
        nextResults.push({ type: 'task_flow', id: t.id, title: 'Modo Flow: ' + t.title, icon: <Play size={16} /> });
        nextResults.push({ type: 'task_complete', id: t.id, title: 'Completar: ' + t.title, icon: <CheckCircle size={16} color="var(--accent-green)" /> });
      }
    });

    return nextResults;
  }, [allTasks, cycles, query]);

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
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }

      if (isOpen) {
        if (e.key === 'Escape') setIsOpen(false);
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, Math.max(results.length - 1, 0)));
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          const selected = results[selectedIndex];
          if (selected) executeAction(selected);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [executeAction, isOpen, results, selectedIndex]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

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
                  flex: 1, background: 'transparent', border: 'none', color: 'white',
                  fontSize: '1.2rem', padding: '0 var(--space-16)', outline: 'none'
                }}
              />
              <div style={{ display: 'flex', gap: 4 }}>
                <kbd style={{ background: 'var(--bg-base)', padding: '4px 8px', borderRadius: 4, fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>ESC</kbd>
              </div>
            </div>

            <div style={{ maxHeight: '400px', overflowY: 'auto', padding: 'var(--space-8)' }}>
              {results.slice(0, 15).map((result, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={result.type + '_' + result.id}
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
                      <span style={{ fontSize: '1rem', fontWeight: isSelected ? 500 : 400 }}>{result.title}</span>
                    </div>
                    {isSelected && <ArrowRight size={16} color="var(--accent-primary)" />}
                  </div>
                );
              })}
              {results.length === 0 && (
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
