import { useEffect, type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SheetNavBar } from '../ui/SheetNavBar';
import { modKey } from '../../utils/platform';

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

  const mod = modKey();

  // Solo los atajos que la app implementa de verdad (App.tsx).
  const groups: { title: string; items: { label: string; keys: string[] }[] }[] = [
    {
      title: 'Ir a',
      items: [
        { label: 'Diario', keys: ['1'] },
        { label: 'Semanal', keys: ['2'] },
        { label: 'Todos', keys: ['3'] },
        { label: 'Bandeja de entrada', keys: ['4'] },
        { label: 'Estadísticas', keys: ['5'] },
        { label: 'Importar', keys: ['6'] },
      ],
    },
    {
      title: 'Acciones',
      items: [
        { label: 'Buscar', keys: ['/'] },
        { label: 'Buscar (desde cualquier campo)', keys: [mod, 'K'] },
        { label: 'Nuevo recordatorio', keys: ['N'] },
        { label: 'Asistente', keys: [mod, 'J'] },
        { label: 'Deshacer la última eliminación', keys: [mod, 'Z'] },
        { label: 'Cerrar', keys: ['Esc'] },
        { label: 'Mostrar estos atajos', keys: ['?'] },
      ],
    },
    {
      title: 'Gestos',
      items: [
        { label: 'Completar un recordatorio', keys: ['Deslizar →'] },
        { label: 'Eliminar un recordatorio', keys: ['← Deslizar'] },
        { label: 'Más opciones', keys: ['Mantener pulsado'] },
        { label: 'Volver a las listas (móvil)', keys: ['Desde el borde →'] },
      ],
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="premium-overlay list-config-overlay" style={{ position: 'fixed', inset: 0, zIndex: 100000 }} onClick={onClose}>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Atajos de teclado"
            className="shortcuts-sheet form-sheet"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <SheetNavBar title="Atajos de teclado" onConfirm={onClose} confirmLabel="Listo" />
            <div className="form-sheet-body" tabIndex={0}>
              {groups.map((group) => (
                <div key={group.title}>
                  <p className="form-group-label">{group.title}</p>
                  <div className="form-group">
                    {group.items.map((item) => (
                      <div key={item.label} className="form-row" style={{ cursor: 'default' }}>
                        <span className="form-row-text"><span className="form-row-title">{item.label}</span></span>
                        <span className="kbd-group">
                          {item.keys.map((k) => <kbd key={k} className="kbd">{k}</kbd>)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
