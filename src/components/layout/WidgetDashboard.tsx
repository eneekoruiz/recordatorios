import { useAppStore } from '../../store/useAppStore';
import { motion, AnimatePresence } from 'framer-motion';
import './Layout.css';

/**
 * Componente modular para modo Widget.
 * Pensado para ser renderizado en un iframe, WebView de Capacitor o Chrome OS widget.
 */
export function WidgetDashboard() {
  const smartTasks = useAppStore(state => state.getSmartSortTasks());
  const toggleTask = useAppStore(state => state.toggleTask);

  // Filtramos tareas para el widget
  const topTasks = smartTasks.slice(0, 3);

  return (
    <div style={{ padding: '16px', background: 'transparent', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: '#0a84ff' }}>Up Next</h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <AnimatePresence>
          {topTasks.map(task => (
            <motion.div 
              key={task.id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9, height: 0 }}
              style={{ background: 'var(--card-bg)', padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
            >
              <div 
                className="checkbox" 
                onClick={() => {
                  if (navigator.vibrate) navigator.vibrate([30]);
                  toggleTask(task.id);
                }}
                style={{ width: '20px', height: '20px', minWidth: '20px', cursor: 'pointer' }}
              />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{task.title}</div>
                {(task.alerts?.length || 0) > 0 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{task.alerts.join(', ')}</div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {topTasks.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '20px' }}>
            Estás al día.
          </div>
        )}
      </div>
    </div>
  );
}
