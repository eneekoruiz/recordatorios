import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Loader2, Check } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface BrainDumpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ParsedTask {
  title: string;
  categoryId: string;
  cycleId: string;
  alerts: string[];
}

export function BrainDumpModal({ isOpen, onClose }: BrainDumpModalProps) {
  const { addTask, cycles, addCycle } = useAppStore();
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedTasks, setParsedTasks] = useState<ParsedTask[] | null>(null);

  const handleProcess = () => {
    if (!inputText.trim()) return;
    setIsProcessing(true);
    
    // Simular procesamiento asíncrono pesado para no bloquear UI
    setTimeout(() => {
      const lines = inputText.split('\n');
      const results: ParsedTask[] = [];

      lines.forEach(line => {
        let title = line.trim();
        if (!title || title.startsWith('//')) return;

        let categoryId = 'inbox';
        let cycleId = 'cycle_day';
        const alerts: string[] = [];

        // Parse category @
        const catMatch = title.match(/@(\w+)/);
        if (catMatch) {
          categoryId = catMatch[1].toLowerCase();
          title = title.replace(`@${catMatch[1]}`, '').trim();
        }

        // Parse cycle #
        const cycleMatch = title.match(/#(\w+)/);
        if (cycleMatch) {
          const rawCycle = cycleMatch[1];
          title = title.replace(`#${rawCycle}`, '').trim();
          
          const existing = cycles.find(c => c.name.toLowerCase() === rawCycle.toLowerCase());
          if (existing) {
            cycleId = existing.id;
          } else {
            // New Cycle inference
            const newCycleId = `cycle_${Date.now()}_${Math.random()}`;
            addCycle({
              id: newCycleId,
              name: rawCycle,
              daysValue: 14,
              isPinned: true,
              icon: 'sparkles'
            });
            cycleId = newCycleId;
          }
        }

        // Basic time NLP
        const timeRegex = /\b([0-1]?[0-9]|2[0-3])(:[0-5][0-9])?\s*(am|pm|h)\b/i;
        const timeMatch = title.match(timeRegex);
        if (timeMatch) {
          alerts.push(timeMatch[0]);
          title = title.replace(timeMatch[0], '').trim();
        }

        if (title) {
          results.push({ title, categoryId, cycleId, alerts });
        }
      });

      setParsedTasks(results);
      setIsProcessing(false);
    }, 800); // 800ms loading feedback
  };

  const handleConfirm = () => {
    if (!parsedTasks) return;
    
    parsedTasks.forEach(task => {
      addTask({
        ...task,
        blockedBy: [],
        dueDate: new Date(),
      });
    });
    
    // Reset and Close
    setInputText('');
    setParsedTasks(null);
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
              maxWidth: '800px', 
              padding: 'var(--space-32)',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              background: 'var(--bg-base)', // Hacerlo opaco
              border: '1px solid var(--border-focus)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-24)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
                <Zap size={28} color="var(--accent-primary)" />
                <h2 className="text-title" style={{ margin: 0 }}>Brain Dump</h2>
              </div>
              <button className="btn-icon" onClick={onClose}><X size={24} /></button>
            </div>

            {isProcessing ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-64) 0', flex: 1 }}>
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                  <Loader2 size={48} color="var(--accent-primary)" />
                </motion.div>
                <p className="text-muted" style={{ marginTop: 'var(--space-16)', fontSize: '1.2rem' }}>Analizando volcado mental...</p>
              </div>
            ) : parsedTasks ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <h3 className="text-body" style={{ marginBottom: 'var(--space-16)' }}>Confirma tus tareas ({parsedTasks.length})</h3>
                <div style={{ overflowY: 'auto', flex: 1, background: 'var(--bg-base)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ background: 'var(--bg-surface)', position: 'sticky', top: 0 }}>
                      <tr>
                        <th style={{ padding: 'var(--space-12)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>Tarea</th>
                        <th style={{ padding: 'var(--space-12)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>Lista</th>
                        <th style={{ padding: 'var(--space-12)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>Ciclo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedTasks.map((t, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: 'var(--space-12)', color: 'var(--text-primary)' }}>{t.title} {t.alerts.length > 0 && <span style={{ color: 'var(--accent-primary)', fontSize: '0.8rem', marginLeft: 8 }}>({t.alerts.join(', ')})</span>}</td>
                          <td style={{ padding: 'var(--space-12)', color: 'var(--text-tertiary)' }}>{t.categoryId}</td>
                          <td style={{ padding: 'var(--space-12)', color: 'var(--text-tertiary)' }}>{cycles.find(c => c.id === t.cycleId)?.name || 'Nuevo'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-12)', marginTop: 'var(--space-24)' }}>
                  <button 
                    onClick={() => setParsedTasks(null)}
                    style={{ flex: 1, padding: 'var(--space-12)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'white', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
                  >
                    Editar Texto
                  </button>
                  <button 
                    onClick={handleConfirm}
                    style={{ flex: 2, padding: 'var(--space-12)', background: 'var(--accent-primary)', border: 'none', color: 'white', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    <Check size={18} /> Guardar Todo en mi Cerebro
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <p className="text-muted" style={{ marginBottom: 'var(--space-16)' }}>
                  Pega cualquier texto aquí. Reconocemos etiquetas (@trabajo), ciclos (#MiSemana) y horas (18:00h).
                </p>
                <textarea 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Llamar al médico mañana @salud #MiMes&#10;Comprar pan 18:00h @compras&#10;..."
                  style={{
                    flex: 1,
                    minHeight: '300px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-16)',
                    color: 'white',
                    fontFamily: 'monospace',
                    fontSize: '1rem',
                    resize: 'none',
                    marginBottom: 'var(--space-24)'
                  }}
                  autoFocus
                />
                
                <button 
                  onClick={handleProcess}
                  disabled={!inputText.trim()}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-8)',
                    padding: 'var(--space-16)',
                    background: inputText.trim() ? 'var(--text-primary)' : 'var(--border-subtle)',
                    color: inputText.trim() ? 'var(--bg-base)' : 'var(--text-tertiary)', 
                    border: 'none', borderRadius: 'var(--radius-md)',
                    fontSize: '1.1rem',
                    fontWeight: 600, cursor: inputText.trim() ? 'pointer' : 'not-allowed'
                  }}
                >
                  <Zap size={20} /> Magia
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
