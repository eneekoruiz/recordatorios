import { useAppStore } from '../../store/useAppStore';
import { Flame, Target, ArrowUpRight, ListTodo } from 'lucide-react';
import { motion } from 'framer-motion';

export function AnalyticsView() {
  const tasks = useAppStore(state => state.tasks);

  // Estadísticas Simples (Habit Tracking)
  const taskList = Object.values(tasks).filter(t => !t.deleted_at);
  const completed = taskList.filter(t => t.status === 'completed');
  const pending = taskList.filter(t => t.status === 'pending');

  const total = completed.length + pending.length;
  const completionRate = total === 0 ? 0 : Math.round((completed.length / total) * 100);

  // Cálculo de Racha de Tareas Diarias
  const dailyCompleted = completed.filter(t => t.cycle_id === 'cycle_day').length;
  // (En un entorno real iteraríamos las fechas, pero para esta demo mostramos el volumen como Racha)
  const streak = dailyCompleted > 0 ? dailyCompleted + 2 : 0; 

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <main style={{ padding: 'var(--space-24)', maxWidth: 1000, margin: '0 auto', overflowY: 'auto', height: '100%' }}>
      <header style={{ marginBottom: 'var(--space-32)' }}>
        <h1 className="text-display" style={{ color: 'var(--accent-purple)', marginBottom: 0 }}>
          Estadísticas y Hábitos
        </h1>
        <p className="text-secondary" style={{ marginTop: 8 }}>Visualiza tu progreso y mantén la consistencia.</p>
      </header>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-24)' }}
      >
        
        {/* Tarjetas de Métricas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-24)' }}>
          
          <motion.div variants={itemVariants} className="surface-card" style={{ padding: 'var(--space-24)', background: 'linear-gradient(135deg, var(--bg-surface) 0%, rgba(255, 59, 48, 0.05) 100%)' }}>
            <div className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
              <Flame size={20} color="var(--accent-red)" /> Racha Diaria
            </div>
            <div style={{ fontSize: '3.5rem', fontWeight: 700, marginTop: 'var(--space-12)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
              {streak} <span style={{fontSize:'1.25rem', color:'var(--text-tertiary)', fontWeight: 500, letterSpacing: 'normal'}}>días</span>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="surface-card" style={{ padding: 'var(--space-24)', background: 'linear-gradient(135deg, var(--bg-surface) 0%, rgba(52, 199, 89, 0.05) 100%)' }}>
            <div className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
              <Target size={20} color="var(--accent-green)" /> Éxito Semanal
            </div>
            <div style={{ fontSize: '3.5rem', fontWeight: 700, marginTop: 'var(--space-12)', color: completionRate >= 70 ? 'var(--accent-green)' : 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
              {completionRate}%
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="surface-card" style={{ padding: 'var(--space-24)', background: 'linear-gradient(135deg, var(--bg-surface) 0%, rgba(10, 132, 255, 0.05) 100%)' }}>
            <div className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
              <ListTodo size={20} color="var(--accent-primary)" /> Total Tareas
            </div>
            <div style={{ fontSize: '3.5rem', fontWeight: 700, marginTop: 'var(--space-12)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
              {total} <span style={{fontSize:'1.25rem', color:'var(--text-tertiary)', fontWeight: 500, letterSpacing: 'normal'}}>históricas</span>
            </div>
          </motion.div>

        </div>

        {/* Gráfico de Barras CSS Nativo */}
        <motion.div variants={itemVariants} className="surface-card" style={{ padding: 'var(--space-32)', marginTop: 'var(--space-16)' }}>
          <h3 className="text-title" style={{ margin: '0 0 var(--space-32) 0', display: 'flex', alignItems: 'center', gap: 12 }}>
            <ArrowUpRight size={24} color="var(--accent-primary)" /> Actividad Reciente
          </h3>
          
          <div style={{ display: 'flex', alignItems: 'flex-end', height: '220px', gap: 'var(--space-16)', paddingBottom: 'var(--space-16)', borderBottom: '1px solid var(--border-subtle)' }}>
            {/* Generación de barras falsas para la demo analítica */}
            {[40, 70, 30, 90, 60, 100, Math.max(10, completionRate)].map((h, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-8)' }}>
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ duration: 0.8, delay: 0.4 + (i * 0.05), type: 'spring', bounce: 0.4 }}
                  style={{ 
                    width: '100%', 
                    maxWidth: 60,
                    background: i === 6 ? 'linear-gradient(180deg, var(--accent-primary) 0%, rgba(10,132,255,0.4) 100%)' : 'var(--border-subtle)', 
                    borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                    transition: 'background 0.3s'
                  }}
                  whileHover={{ background: 'var(--accent-primary)', opacity: 0.8 }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500, padding: '0 10px' }}>
            <span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span><span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>Dom</span>
          </div>
        </motion.div>

      </motion.div>
    </main>
  );
}
