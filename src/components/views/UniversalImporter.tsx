import { useState } from 'react';
import { ViewHeader } from '../ui/ViewHeader';
import { ArrowUpDown, Download, Upload, Info, CheckCircle2, Sparkles, Target, FileText, Clipboard, Loader2, Calendar, Printer, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore, sanitizeTaskHierarchy, sanitizeSectionHierarchy } from '../../store/useAppStore';
import { detectFormatAndParse } from '../../utils/importerParser';
import { validateJsonImport } from '../../utils/importValidation';
import type { ParseResult } from '../../utils/importerParser';
import { extractTextFromPdf } from '../../utils/pdfExtractor';
import { downloadIcsFile } from '../../utils/icsExporter';
import { exportReportToPdf } from '../../utils/pdfExport';
import { useNavigation } from '../../hooks/useNavigation';
import { notify } from '../ui/confirmDialog';

interface UniversalImporterProps {
  onBack?: () => void;
}

export function UniversalImporter({ onBack }: UniversalImporterProps) {
  const { exportData, cycles, lists, tasks } = useAppStore();
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
  const [isExtracting, setIsExtracting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recordatorios_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Copia de seguridad JSON descargada con éxito' }));
  };

  const handleExportCsv = () => {
    const taskList = Object.values(tasks);
    const headers = ['Título', 'Lista', 'Estado', 'Fecha', 'Prioridad', 'Coste (€)', 'Duración (seg)', 'Notas'];
    const rows = taskList.map(t => {
      const listName = lists.find(l => l.id === t.categoryId)?.name || 'Bandeja de entrada';
      const escapeCsv = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;
      return [
        escapeCsv(t.title),
        escapeCsv(listName),
        t.status === 'completed' ? 'Completado' : 'Pendiente',
        t.dueDate ? t.dueDate.split('T')[0] : '',
        t.priority || 'none',
        t.price !== undefined ? t.price.toString() : '',
        t.duration !== undefined ? t.duration.toString() : '',
        escapeCsv(t.description || '')
      ].join(',');
    });
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recordatorios_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Archivo CSV descargado con éxito' }));
  };

  const handleExportPdfReport = () => {
    const taskList = Object.values(tasks);
    const total = taskList.length;
    const completed = taskList.filter(t => t.status === 'completed').length;
    const pending = total - completed;
    const totalCost = taskList.reduce((acc, t) => acc + (t.price || 0), 0);

    exportReportToPdf({
      title: 'Informe General de Recordatorios',
      subtitle: `Exportación completa de ${total} elementos`,
      stats: [
        { label: 'Total Recordatorios', value: total },
        { label: 'Completados', value: completed },
        { label: 'Pendientes', value: pending },
        ...(totalCost > 0 ? [{ label: 'Presupuesto Total', value: `${totalCost.toFixed(2)} €` }] : [])
      ],
      items: taskList.map(t => ({
        title: t.title,
        category: lists.find(l => l.id === t.categoryId)?.name || 'Bandeja de entrada',
        status: t.status,
        dueDate: t.dueDate ? new Date(t.dueDate).toLocaleDateString('es-ES') : undefined,
        price: t.price,
        duration: t.duration,
        notes: t.description
      }))
    });
  };

  const handleExportIcs = () => {
    const taskList = Object.values(tasks);
    downloadIcsFile(taskList, 'recordatorios.ics', 'Mis Recordatorios');
    window.dispatchEvent(new CustomEvent('show-toast', { detail: 'Calendario iCalendar (.ics) descargado con éxito' }));
  };

  const handleProcessText = () => {
    if (!inputText.trim()) return;
    try {
      const result = detectFormatAndParse(inputText, { cycles });
      setPreview(result);
    } catch (e: any) {
      notify(e.message || 'Error al procesar los datos.');
    }
  };

  const processFile = async (file: File) => {
    setIsExtracting(true);
    try {
      let text = '';
      if (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') {
        text = await extractTextFromPdf(file);
      } else {
        text = await file.text();
      }

      if (!text.trim()) {
        notify('No se pudo extraer texto del archivo.');
        return;
      }

      setInputText(text);
      const result = detectFormatAndParse(text, { cycles });
      setPreview(result);
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: `Procesado "${file.name}" (${result.tasks.length} recordatorios detectados)`
      }));
    } catch (err: any) {
      console.error(err);
      notify(err.message || 'Error al procesar el archivo.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      if (!navigator.clipboard?.readText) {
        notify('El portapapeles no está disponible.');
        return;
      }
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        notify('El portapapeles está vacío.');
        return;
      }
      setInputText(text);
      const result = detectFormatAndParse(text, { cycles });
      setPreview(result);
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: `Pegado y procesado: ${result.tasks.length} recordatorios detectados`
      }));
    } catch (err: any) {
      notify('No se pudo leer el portapapeles: ' + (err?.message || ''));
    }
  };

  const handleConfirmImport = () => {
    if (!preview) return;
    let validated: ParseResult;
    try { validated = validateJsonImport(preview); }
    catch (error) { notify(error instanceof Error ? error.message : 'Datos de importación inválidos.'); return; }
    const now = new Date().toISOString();
    
    useAppStore.setState((state) => {
      // 1. Merge de listas: conservar existentes e incorporar las nuevas del preview
      const listsMap = new Map<string, any>(state.lists.map(l => [l.id, l]));
      if (validated.lists.length > 0) {
        validated.lists.forEach(l => {
          if (!listsMap.has(l.id)) {
            listsMap.set(l.id, { ...l, updated_at: now, _is_dirty: true });
          }
        });
      }
      const finalLists = Array.from(listsMap.values());

      // 2. Merge de secciones: conservar existentes e incorporar las del preview
      const sectionsMap = new Map<string, any>((state.listSections || []).map(s => [s.id, s]));
      if (validated.listSections && validated.listSections.length > 0) {
        validated.listSections.forEach(s => {
          if (!sectionsMap.has(s.id)) {
            sectionsMap.set(s.id, { ...s, updated_at: now, _is_dirty: true });
          }
        });
      }
      const finalSections = sanitizeSectionHierarchy(Array.from(sectionsMap.values()));

      // 3. Deduplicar ciclos por identificador
      const cyclesMap = new Map<string, any>((state.cycles || []).map(c => [c.id, c]));
      if (validated.cycles.length > 0) {
        validated.cycles.forEach(c => {
          if (!cyclesMap.has(c.id)) {
            cyclesMap.set(c.id, { ...c, updated_at: now, _is_dirty: true });
          }
        });
      }
      const finalCycles = Array.from(cyclesMap.values());

      const destinationListId = targetListId || finalLists[0]?.id || 'inbox';
      const updatedTasks = { ...state.tasks };
      let importedCount = 0;

      // 4. Validar relaciones y marcar _is_dirty en cada tarea importada
      validated.tasks.forEach(t => {
        const rawCatId = t.categoryId || (t as any).listId;
        const shouldRouteToTarget = forceAllToList || targetListId !== 'inbox' || !rawCatId || rawCatId === 'inbox' || !finalLists.some(l => l.id === rawCatId);
        const resolvedCategoryId = shouldRouteToTarget ? destinationListId : (rawCatId || destinationListId);

        // Validar que sectionId pertenezca a la lista de destino
        const isSectionValid = t.sectionId && finalSections.some(s => s.id === t.sectionId && s.listId === resolvedCategoryId && !s.deleted_at);

        const taskToImport = {
          ...t,
          categoryId: resolvedCategoryId,
          sectionId: isSectionValid ? t.sectionId : undefined,
          cycle_id: finalCycles.some(c => c.id === t.cycle_id && !c.deleted_at) ? t.cycle_id : undefined,
          updated_at: now,
          _is_dirty: true,
          version: Math.max(t.version || 0, state.tasks[t.id]?.version || 0) + 1
        };

        updatedTasks[taskToImport.id] = taskToImport;
        importedCount++;
      });

      const destinationName = finalLists.find(l => l.id === destinationListId)?.name || (destinationListId === 'inbox' ? 'Bandeja de entrada' : 'Lista seleccionada');
      window.dispatchEvent(new CustomEvent('show-toast', { detail: `Importados ${importedCount} recordatorios a "${destinationName}" (preparados para sincronizar)` }));

      return {
        tasks: sanitizeTaskHierarchy(updatedTasks),
        cycles: finalCycles,
        lists: finalLists,
        listSections: finalSections,
      };
    });

    window.dispatchEvent(new CustomEvent('trigger-sync'));

    pop();
  };

  return (
    <main aria-label="Importar y exportar" style={{ 
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
      <ViewHeader
        title="Importar y exportar"
        subtitle="Copia de seguridad de tus datos, o importa desde texto, CSV o JSON."
        icon={<ArrowUpDown size={20} />}
        color="var(--accent-blue)"
        onBack={handleBackClick}
      />

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
        gap: 'var(--space-24)' 
      }}>
        
        {/* AI Assistant Conversational Importer Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="surface-card" 
          style={{ 
            padding: 'var(--space-32)', 
            background: 'linear-gradient(135deg, color-mix(in srgb, #007aff 12%, var(--bg-surface)), color-mix(in srgb, #af52de 12%, var(--bg-surface)))',
            border: '1.5px solid color-mix(in srgb, #007aff 30%, transparent)',
            borderRadius: 'var(--radius-lg)',
            gridColumn: '1 / -1',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 'var(--space-16)'
          }}
        >
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px', borderRadius: 999, background: 'var(--accent-glow)', color: 'color-mix(in srgb, var(--accent-primary) 70%, var(--text-primary))', fontSize: '0.8rem', fontWeight: 700, marginBottom: 12 }}>
              <Sparkles size={14} /> Asistente IA
            </div>
            <h3 aria-level={2} className="text-title" style={{ marginBottom: 'var(--space-8)' }}>Importación asistida</h3>
            <p className="text-secondary" style={{ margin: 0, maxWidth: 640 }}>
              Habla o pega cualquier texto en bruto (rutinas, listas de compras, mudanzas o proyectos). La IA desglosará automáticamente los recordatorios con sus precios, fechas, franjas horarias y listas adecuadas para que los confirmes con un solo clic.
            </p>
          </div>

          <motion.button 
            onClick={() => {
              window.dispatchEvent(new CustomEvent('open-ai-assistant'));
            }}
            style={{ 
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-8)', 
              background: 'linear-gradient(135deg, #007aff, #af52de)', color: 'white', border: 'none', 
              padding: '14px 24px', borderRadius: 'var(--radius-md)', fontWeight: 650, 
              cursor: 'pointer', transition: 'transform 0.2s, opacity 0.2s, background-color 0.2s, border-color 0.2s, color 0.2s, box-shadow 0.2s', boxShadow: '0 4px 16px rgba(0, 122, 255, 0.3)',
              alignSelf: 'flex-start'
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Sparkles size={18} /> Abrir el asistente
          </motion.button>
        </motion.div>

        {/* Export Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="surface-card" 
          style={{ padding: 'var(--space-32)', background: 'var(--bg-surface)' }}
        >
          <h3 aria-level={2} className="text-title" style={{ marginBottom: 'var(--space-16)' }}>Copia de seguridad</h3>
          <p className="text-muted" style={{ marginBottom: 'var(--space-32)' }}>Descarga un archivo JSON con todas tus frecuencias, listas y recordatorios.</p>
          
          <motion.button 
            onClick={handleExport}
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-8)', 
              width: '100%', background: 'var(--accent-fill, var(--accent-primary))', color: 'white', border: 'none', 
              padding: 'var(--space-16)', borderRadius: 'var(--radius-md)', fontWeight: 600, 
              cursor: 'pointer', transition: 'transform 0.2s, opacity 0.2s, background-color 0.2s, border-color 0.2s, color 0.2s, box-shadow 0.2s', boxShadow: 'var(--shadow-md)'
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
          <h3 aria-level={2} className="text-title" style={{ marginBottom: 'var(--space-16)' }}>Importar datos</h3>
          <div style={{ display: 'flex', gap: 'var(--space-12)', color: 'var(--text-tertiary)', fontSize: '0.9rem', marginBottom: 'var(--space-24)', background: 'var(--bg-elevated)', padding: 'var(--space-12)', borderRadius: 'var(--radius-sm)' }}>
            <Info size={18} style={{ flexShrink: 0, marginTop: 2, color: 'var(--accent-primary)' }} />
            <span>Pega una copia de seguridad (JSON), un CSV o simplemente tus ideas en texto plano: se detecta el formato solo.</span>
          </div>

          <div className="glass-panel" style={{ padding: 'var(--space-20)', borderRadius: 'var(--radius-xl)', marginBottom: 'var(--space-24)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 7, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  <Target size={16} strokeWidth={2.1} /> Lista de destino para importación
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Las tareas sin lista o en bandeja de entrada se reasignarán automáticamente aquí.</p>
              </div>
              <select
                aria-label="Lista de destino de la importación"
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
                <option value="inbox">Bandeja de entrada (Inbox)</option>
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
                <div 
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) processFile(file);
                  }}
                  style={{
                    position: 'relative',
                    border: isDragging ? '2px dashed var(--accent-primary)' : '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    background: isDragging ? 'color-mix(in srgb, var(--accent-primary) 8%, var(--bg-base))' : 'var(--bg-base)',
                    marginBottom: 'var(--space-24)',
                    transition: 'transform 0.2s ease, opacity 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease'
                  }}
                >
                  <textarea 
                    aria-label="Datos para importar"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Arrastra aquí tu PDF o pega texto: Ej: Comprar pintura @Hogar #MiSemana..."
                    style={{ 
                      width: '100%', minHeight: 250, background: 'transparent', 
                      border: 'none',
                      padding: 'var(--space-16)', color: 'var(--text-primary)', 
                      fontFamily: 'monospace', fontSize: '0.95rem', resize: 'vertical', 
                      outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                  {isExtracting && (
                    <div style={{
                      position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.5)',
                      backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 12, borderRadius: 'var(--radius-md)',
                      color: 'white', zIndex: 10
                    }}>
                      <Loader2 size={32} className="animate-spin" />
                      <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Extrayendo contenido del documento...</span>
                    </div>
                  )}
                  {isDragging && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 8,
                      pointerEvents: 'none', color: 'var(--accent-primary)', fontWeight: 600
                    }}>
                      <FileText size={36} />
                      <span>Suelta aquí tu PDF, CSV o archivo de texto</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-12)', flexWrap: 'wrap' }}>
                  <button 
                    onClick={handleProcessText}
                    disabled={!inputText.trim() || isExtracting}
                    style={{ 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-8)', 
                      flex: 1, minWidth: 160, background: inputText.trim() ? 'var(--text-primary)' : 'var(--bg-elevated)', 
                      color: inputText.trim() ? 'var(--bg-base)' : 'var(--text-tertiary)', border: 'none', 
                      padding: 'var(--space-16)', borderRadius: 'var(--radius-md)', fontWeight: 600, 
                      cursor: inputText.trim() ? 'pointer' : 'not-allowed', transition: 'transform 0.2s, opacity 0.2s, background-color 0.2s, border-color 0.2s, color 0.2s, box-shadow 0.2s'
                    }}
                  >
                    <Upload size={20} /> Procesar Datos
                  </button>
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-8)',
                      background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)',
                      padding: 'var(--space-16)', borderRadius: 'var(--radius-md)', fontWeight: 600,
                      cursor: 'pointer', transition: 'transform 0.2s, opacity 0.2s, background-color 0.2s, border-color 0.2s, color 0.2s, box-shadow 0.2s'
                    }}
                    title="Pegar texto copiado del portapapeles"
                  >
                    <Clipboard size={18} /> Pegar portapapeles
                  </button>
                  <label 
                    style={{ 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-8)', 
                      flex: 1, minWidth: 180, background: 'var(--bg-elevated)', 
                      color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', 
                      padding: 'var(--space-16)', borderRadius: 'var(--radius-md)', fontWeight: 600, 
                      cursor: 'pointer', transition: 'transform 0.2s, opacity 0.2s, background-color 0.2s, border-color 0.2s, color 0.2s, box-shadow 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                  >
                    <FileText size={20} color="var(--accent-primary)" /> Subir PDF, CSV o JSON
                    <input 
                      type="file" 
                      accept=".pdf,.csv,.json,.txt,.md" 
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
                  <h4 aria-level={3} style={{ color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: '1.1rem' }}>
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
                    style={{ flex: 1, padding: 'var(--space-16)', background: 'var(--accent-green)', border: 'none', color: 'white', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, transition: 'transform 0.2s, opacity 0.2s, background-color 0.2s, border-color 0.2s, color 0.2s, box-shadow 0.2s', boxShadow: 'var(--shadow-md)' }}
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

        {/* Export Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="surface-card" 
          style={{ padding: 'var(--space-32)', background: 'var(--bg-surface)', gridColumn: '1 / -1' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 'var(--space-16)' }}>
            <div>
              <h3 aria-level={2} className="text-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Download size={20} color="var(--accent-primary)" /> Exportar y calendarios
              </h3>
              <p className="text-secondary" style={{ margin: '4px 0 0 0', fontSize: '0.9rem' }}>
                Lleva tus recordatorios a cualquier dispositivo o aplicación, o genera informes para imprimir.
              </p>
            </div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>
              {Object.keys(tasks).length} recordatorios almacenados
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 14,
            marginTop: 18
          }}>
            {/* 1. iCalendar (.ics) */}
            <div 
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 14
              }}
            >
              <div>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(0, 122, 255, 0.12)', color: 'var(--accent-primary)', display: 'grid', placeItems: 'center', marginBottom: 12 }}>
                  <Calendar size={18} />
                </div>
                <h4 aria-level={3} style={{ margin: '0 0 4px 0', fontSize: '0.98rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  iCalendar (.ics)
                </h4>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Compatible con la app Calendario de Apple (Mac/iPhone), Google Calendar y Outlook.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportIcs}
                className="modal-btn-secondary"
                style={{ width: '100%', gap: 6, fontSize: '0.86rem' }}
              >
                <Download size={14} /> Descargar .ics
              </button>
            </div>

            {/* 2. Informe Editorial PDF */}
            <div 
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 14
              }}
            >
              <div>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255, 149, 0, 0.12)', color: '#ff9500', display: 'grid', placeItems: 'center', marginBottom: 12 }}>
                  <Printer size={18} />
                </div>
                <h4 aria-level={3} style={{ margin: '0 0 4px 0', fontSize: '0.98rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Informe Editorial (PDF)
                </h4>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Documento maquetado con diseño Apple para imprimir o guardar como PDF vectorial.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportPdfReport}
                className="modal-btn-secondary"
                style={{ width: '100%', gap: 6, fontSize: '0.86rem' }}
              >
                <Printer size={14} /> Imprimir / PDF
              </button>
            </div>

            {/* 3. CSV Tabular */}
            <div 
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 14
              }}
            >
              <div>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(52, 199, 89, 0.12)', color: 'var(--accent-green)', display: 'grid', placeItems: 'center', marginBottom: 12 }}>
                  <FileText size={18} />
                </div>
                <h4 aria-level={3} style={{ margin: '0 0 4px 0', fontSize: '0.98rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Hoja de Cálculo (CSV)
                </h4>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Abre tus datos en Excel, Numbers o Google Sheets con columnas de costes y fechas.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportCsv}
                className="modal-btn-secondary"
                style={{ width: '100%', gap: 6, fontSize: '0.86rem' }}
              >
                <Download size={14} /> Descargar .csv
              </button>
            </div>

            {/* 4. Backup JSON */}
            <div 
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: 18,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: 14
              }}
            >
              <div>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(175, 82, 222, 0.12)', color: 'var(--accent-purple)', display: 'grid', placeItems: 'center', marginBottom: 12 }}>
                  <Database size={18} />
                </div>
                <h4 aria-level={3} style={{ margin: '0 0 4px 0', fontSize: '0.98rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Copia de Seguridad (JSON)
                </h4>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Respaldo técnico integral de listas, ciclos temporales, secciones y recordatorios.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExport}
                className="modal-btn-secondary"
                style={{ width: '100%', gap: 6, fontSize: '0.86rem' }}
              >
                <Download size={14} /> Descargar .json
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
