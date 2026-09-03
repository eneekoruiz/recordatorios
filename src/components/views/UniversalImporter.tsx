import { useState } from 'react';
import { Download, Upload, Info, CheckCircle2, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';
import { detectFormatAndParse } from '../../utils/importerParser';
import type { ParseResult } from '../../utils/importerParser';
import { useNavigation } from '../../hooks/useNavigation';

interface UniversalImporterProps {
  onBack?: () => void;
}

export function UniversalImporter({ onBack }: UniversalImporterProps) {
  const { exportData, cycles, lists } = useAppStore();
  const { pop, reset } = useNavigation();

  const handleBackClick = () => {
    if (onBack) {
      onBack();
    } else {
      reset('HOME');
    }
  };
  const [inputText, setInputText] = useState('');
  const [preview, setPreview] = useState<ParseResult | null>(null);
  const [targetListId, setTargetListId] = useState<string>(lists[0]?.id || 'inbox');
  const [forceAllToList, setForceAllToList] = useState<boolean>(true); // Por defecto true para que todos los recordatorios vayan a la lista seleccionada por el usuario

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

  const handleProcessText = () => {
    if (!inputText.trim()) return;
    try {
      const result = detectFormatAndParse(inputText, { cycles });
      setPreview(result);
    } catch (e: any) {
      alert(e.message || "Error al procesar los datos.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) {
        setInputText(text);
        try {
          const result = detectFormatAndParse(text, { cycles });
          setPreview(result);
        } catch (err: any) {
          alert(err.message || "Error al procesar el archivo.");
        }
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (!preview) return;
    
    useAppStore.setState((state) => {
      const destinationListId = targetListId || state.lists[0]?.id || 'inbox';
      const updatedTasks = { ...state.tasks };
      let importedCount = 0;

      preview.tasks.forEach(t => {
        const taskCatId = t.categoryId || (t as any).listId;
        const shouldRouteToTarget = forceAllToList || targetListId !== 'inbox' || !taskCatId || taskCatId === 'inbox' || !state.lists.some(l => l.id === taskCatId);
        const taskToImport = {
          ...t,
          categoryId: shouldRouteToTarget ? destinationListId : (taskCatId || destinationListId)
        };
        updatedTasks[taskToImport.id] = taskToImport;
        importedCount++;
      });
      
      const nextLists = preview.lists && preview.lists.length > 0 ? preview.lists : state.lists;
      const nextSections = preview.listSections && preview.listSections.length > 0 ? preview.listSections : state.listSections;

      const destinationName = nextLists.find(l => l.id === destinationListId)?.name || (destinationListId === 'inbox' ? 'Bandeja de entrada' : 'Lista seleccionada');
      window.dispatchEvent(new CustomEvent('show-toast', { detail: `Importados ${importedCount} recordatorios a "${destinationName}"` }));

      return {
        tasks: updatedTasks,
        cycles: [...state.cycles, ...preview.cycles],
        lists: nextLists,
        listSections: nextSections,
      };
    });

    pop();
  };

  return (
    <div style={{ 
      padding: 'var(--space-24)', 
      maxWidth: 900, 
      margin: '0 auto', 
      display: 'flex', 
      flexDirection: 'column', 
      gap: 'var(--space-32)',
      width: '100%',
      height: '100%',
      overflowY: 'auto'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-16)' }}>
        <button 
          onClick={handleBackClick} 
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-full)', padding: '8px 16px', color: 'var(--text-primary)', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s ease' }}
        >
          <ChevronLeft size={18} /> Volver a Listas
        </button>
      </div>

      <header>
        <h1 className="text-display" style={{ marginBottom: 'var(--space-8)' }}>Importar y Exportar</h1>
        <p className="text-secondary">Haz backup de tus datos o importa desde texto plano, CSV o JSON.</p>
      </header>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: 'var(--space-24)' 
      }}>
        
        {/* Export Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="surface-card" 
          style={{ padding: 'var(--space-32)', background: 'var(--bg-surface)' }}
        >
          <h3 className="text-title" style={{ marginBottom: 'var(--space-16)' }}>Exportar Backup</h3>
          <p className="text-muted" style={{ marginBottom: 'var(--space-32)' }}>Descarga un archivo JSON con absolutamente todos tus ciclos, listas y tareas.</p>
          
          <motion.button 
            onClick={handleExport}
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-8)', 
              width: '100%', background: 'var(--accent-primary)', color: 'white', border: 'none', 
              padding: 'var(--space-16)', borderRadius: 'var(--radius-md)', fontWeight: 600, 
              cursor: 'pointer', transition: 'all 0.2s', boxShadow: 'var(--shadow-md)'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            whileTap={{ scale: 0.98 }}
          >
            <Download size={20} /> Descargar JSON
          </motion.button>
        </motion.div>

        {/* Import Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="surface-card" 
          style={{ padding: 'var(--space-32)', background: 'var(--bg-surface)', gridColumn: '1 / -1' }}
        >
          <h3 className="text-title" style={{ marginBottom: 'var(--space-16)' }}>Omni-Importador</h3>
          <div style={{ display: 'flex', gap: 'var(--space-12)', color: 'var(--text-tertiary)', fontSize: '0.9rem', marginBottom: 'var(--space-24)', background: 'var(--bg-elevated)', padding: 'var(--space-12)', borderRadius: 'var(--radius-sm)' }}>
            <Info size={18} style={{ flexShrink: 0, marginTop: 2, color: 'var(--accent-primary)' }} />
            <span>Pega tu Backup JSON, un CSV estructurado, o simplemente suelta tus pensamientos en texto plano. El sistema detectará el formato.</span>
          </div>

          <div className="glass-panel" style={{ padding: 'var(--space-20)', borderRadius: 'var(--radius-xl)', marginBottom: 'var(--space-24)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>🎯 Lista de destino para importación</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Las tareas sin lista o en bandeja de entrada se reasignarán automáticamente aquí.</p>
              </div>
              <select
                value={targetListId}
                onChange={(e) => setTargetListId(e.target.value)}
                style={{
                  background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-focus)',
                  borderRadius: 'var(--radius-md)', padding: '10px 16px', fontSize: '0.95rem', fontWeight: 500, outline: 'none', cursor: 'pointer'
                }}
              >
                {lists.map(l => (
                  <option key={l.id} value={l.id}>{l.icon ? `${l.name}` : l.name}</option>
                ))}
                <option value="inbox">📥 Bandeja de entrada (Inbox)</option>
              </select>
            </div>
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                id="forceAllToList"
                checked={forceAllToList}
                onChange={(e) => setForceAllToList(e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--accent-primary)' }}
              />
              <label htmlFor="forceAllToList" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Forzar que el 100% de las tareas importadas vayan a esta lista (sobreescribir sus listas originales)
              </label>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {!preview ? (
              <motion.div
                key="input"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <textarea 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Ej: Comprar pintura @Hogar #MiSemana..."
                  style={{ 
                    width: '100%', minHeight: 250, background: 'var(--bg-base)', 
                    border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', 
                    padding: 'var(--space-16)', color: 'var(--text-primary)', 
                    fontFamily: 'monospace', fontSize: '0.95rem', resize: 'vertical', 
                    marginBottom: 'var(--space-24)', transition: 'border-color 0.2s',
                    outline: 'none'
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
                />
                  <div style={{ display: 'flex', gap: 'var(--space-12)' }}>
                    <button 
                      onClick={handleProcessText}
                      disabled={!inputText.trim()}
                      style={{ 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-8)', 
                        flex: 1, background: inputText.trim() ? 'var(--text-primary)' : 'var(--bg-elevated)', 
                        color: inputText.trim() ? 'var(--bg-base)' : 'var(--text-tertiary)', border: 'none', 
                        padding: 'var(--space-16)', borderRadius: 'var(--radius-md)', fontWeight: 600, 
                        cursor: inputText.trim() ? 'pointer' : 'not-allowed', transition: 'all 0.2s' 
                      }}
                    >
                      <Upload size={20} /> Procesar Datos
                    </button>
                    <label 
                      style={{ 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-8)', 
                        flex: 1, background: 'var(--bg-elevated)', 
                        color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', 
                        padding: 'var(--space-16)', borderRadius: 'var(--radius-md)', fontWeight: 600, 
                        cursor: 'pointer', transition: 'all 0.2s' 
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                    >
                      <Upload size={20} /> Subir Archivo JSON
                      <input 
                        type="file" 
                        accept=".json,.txt,.csv" 
                        style={{ display: 'none' }} 
                        onChange={handleFileUpload} 
                      />
                    </label>
                  </div>
                </motion.div>
            ) : (
              <motion.div
                key="preview"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-24)' }}
              >
                <div style={{ 
                  background: 'rgba(52, 199, 89, 0.1)', padding: 'var(--space-24)', 
                  borderRadius: 'var(--radius-md)', border: '1px solid var(--accent-green)' 
                }}>
                  <h4 style={{ color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: '1.1rem' }}>
                    <CheckCircle2 size={24} /> Análisis Exitoso
                  </h4>
                  <ul style={{ color: 'var(--text-primary)', marginLeft: 24, fontSize: '0.95rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <li><strong style={{ color: 'var(--accent-green)' }}>{preview.tasks.length}</strong> Tareas detectadas</li>
                    <li><strong style={{ color: 'var(--accent-green)' }}>{preview.cycles.length}</strong> Nuevos ciclos detectados</li>
                    <li><strong style={{ color: 'var(--accent-green)' }}>{preview.lists?.length || 0}</strong> Listas nuevas</li>
                    {preview.listSections && preview.listSections.length > 0 && (
                      <li><strong style={{ color: 'var(--accent-green)' }}>{preview.listSections.length}</strong> Secciones de lista</li>
                    )}
                  </ul>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-16)' }}>
                  <button 
                    onClick={() => setPreview(null)}
                    style={{ flex: 1, padding: 'var(--space-16)', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, transition: 'background 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleConfirmImport}
                    style={{ flex: 1, padding: 'var(--space-16)', background: 'var(--accent-green)', border: 'none', color: 'white', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s', boxShadow: 'var(--shadow-md)' }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    Confirmar e Importar
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
