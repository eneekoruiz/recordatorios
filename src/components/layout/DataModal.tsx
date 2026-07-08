import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Upload, Info } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface DataModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DataModal({ isOpen, onClose }: DataModalProps) {
  const { exportData, importData, parsePlainTextTasks } = useAppStore();
  const [inputText, setInputText] = useState('');

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recordatorios_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportText = () => {
    if (!inputText.trim()) return;
    
    // Check if it's JSON
    if (inputText.trim().startsWith('{') && inputText.trim().endsWith('}')) {
      importData(inputText);
    } else {
      parsePlainTextTasks(inputText);
    }
    
    setInputText('');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="surface-glass"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-24)',
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
            pointerEvents: 'auto'
          }}
          onClick={onClose}
        >
          <motion.div 
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="surface-card"
            style={{ 
              width: '100%', 
              maxWidth: '600px', 
              padding: 'var(--space-32)',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--bg-base)', // Hacerlo opaco
              border: '1px solid var(--border-focus)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
            }}
            onClick={(e) => e.stopPropagation()} // Evitar cerrar al hacer click dentro
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-24)' }}>
              <h2 className="text-title">Soberanía de Datos</h2>
              <button className="btn-icon" onClick={onClose}><X size={24} /></button>
            </div>

            {/* Exportar */}
            <div style={{ marginBottom: 'var(--space-32)', padding: 'var(--space-16)', background: 'var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
              <h3 className="text-body" style={{ fontWeight: 600, marginBottom: 'var(--space-8)' }}>Exportar mi cerebro</h3>
              <p className="text-muted" style={{ marginBottom: 'var(--space-16)' }}>
                Descarga un JSON estructurado con todas tus tareas, ciclos y configuraciones.
              </p>
              <button 
                onClick={handleExport}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-8)',
                  padding: 'var(--space-12) var(--space-24)',
                  background: 'var(--accent-primary)',
                  color: 'white', border: 'none', borderRadius: 'var(--radius-md)',
                  fontWeight: 600, cursor: 'pointer'
                }}
              >
                <Download size={18} /> Descargar Backup (.json)
              </button>
            </div>

            {/* Omni-Importador */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <h3 className="text-body" style={{ fontWeight: 600, marginBottom: 'var(--space-8)' }}>Omni-Importador (JSON / Texto)</h3>
              <div style={{ display: 'flex', alignItems: 'start', gap: 'var(--space-8)', marginBottom: 'var(--space-16)', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                <Info size={16} />
                <span>Pega un backup JSON o texto plano. Sintaxis de texto: <br/><code>Comprar pintura @Hogar #MiSemana</code></span>
              </div>
              
              <textarea 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Pega aquí tu JSON o lista de tareas..."
                style={{
                  flex: 1,
                  minHeight: '150px',
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-12)',
                  color: 'white',
                  fontFamily: 'monospace',
                  resize: 'none',
                  marginBottom: 'var(--space-16)'
                }}
              />
              
              <button 
                onClick={handleImportText}
                disabled={!inputText.trim()}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-8)',
                  padding: 'var(--space-12) var(--space-24)',
                  background: inputText.trim() ? 'var(--text-primary)' : 'var(--border-subtle)',
                  color: inputText.trim() ? 'var(--bg-base)' : 'var(--text-tertiary)', 
                  border: 'none', borderRadius: 'var(--radius-md)',
                  fontWeight: 600, cursor: inputText.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                <Upload size={18} /> Procesar e Importar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
