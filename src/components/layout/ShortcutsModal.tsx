import { useEffect, type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard, Navigation, Zap, CheckCircle2 } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const categories = [
    {
      title: 'Navegación Rápida',
      icon: <Navigation size={18} color="var(--accent-blue)" />,
      items: [
        { label: 'Ir a Hoy / Día', keys: ['1'] },
        { label: 'Ir a Semana', keys: ['2'] },
        { label: 'Ir a Todos', keys: ['3'] },
        { label: 'Bandeja de entrada', keys: ['4'] },
        { label: 'Estadísticas / Hábitos', keys: ['5'] },
        { label: 'Importador Universal', keys: ['6'] },
        { label: 'Búsqueda / Paleta de Comandos', keys: ['/', '⌘K'] },
      ]
    },
    {
      title: 'Acciones de Productividad',
      icon: <Zap size={18} color="var(--accent-orange)" />,
      items: [
        { label: 'Crear nueva tarea', keys: ['N'] },
        { label: 'Modo Zen en tarea destacada', keys: ['Z'] },
        { label: 'Cerrar menús o modales activos', keys: ['Esc'] },
        { label: 'Abrir este panel de atajos', keys: ['?'] },
      ]
    },
    {
      title: 'Gestos y Edición',
      icon: <CheckCircle2 size={18} color="var(--accent-green)" />,
      items: [
        { label: 'Completar / Desmarcar tarea', keys: ['Deslizar der. 65px'] },
        { label: 'Eliminar tarea', keys: ['Deslizar izq. 65px'] },
        { label: 'Menú contextual de tarea', keys: ['Pulsación larga'] },
      ]
    }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-16)' }}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-title"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 620,
              maxHeight: '86vh',
              overflowY: 'auto',
              background: 'var(--bg-surface)',
              borderRadius: 24,
              padding: 28,
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
              color: 'var(--text-primary)',
              display: 'flex',
              flexDirection: 'column',
              gap: 24
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Keyboard size={24} color="var(--accent-primary)" />
                </div>
                <div>
                  <h2 id="shortcuts-title" style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>Atajos de Teclado</h2>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Navegación de alta velocidad sin tocar el ratón</p>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Cerrar panel de atajos"
                style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-elevated)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'background-color 0.15s ease' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {categories.map((cat, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
                    {cat.icon}
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{cat.title}</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {cat.items.map((item, j) => (
                      <div key={j} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 4px' }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{item.label}</span>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {item.keys.map((k, idx) => (
                            <kbd key={idx} style={{
                              background: 'var(--bg-elevated)',
                              border: '1px solid var(--border-color)',
                              borderRadius: 6,
                              padding: '2px 8px',
                              fontSize: '0.8rem',
                              fontFamily: 'monospace',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                            }}>
                              {k}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: 'var(--bg-elevated)', padding: '12px 16px', borderRadius: 12, fontSize: '0.85rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
              💡 Pulsa <kbd style={{ padding: '2px 6px', borderRadius: 4, background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>?</kbd> en cualquier momento para abrir esta guía.
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
