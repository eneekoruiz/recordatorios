const fs = require('fs');
const path = require('path');

// 1. Refactor TaskCard.tsx
const taskCardPath = path.join(__dirname, 'src/components/tasks/TaskCard.tsx');
let taskCard = fs.readFileSync(taskCardPath, 'utf8');

// Replace the context menu rendering with a Native-like Bottom Sheet
taskCard = taskCard.replace(/\{showMenu && createPortal\([\s\S]*?<\/>,[\s\S]*?document\.body\s*\)\}/, 
        {/* Bottom Sheet nativo de iOS para acciones */}
        <AnimatePresence>
          {showMenu && createPortal(
            <>
              {/* Backdrop */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{ position: 'fixed', inset: 0, zIndex: 999998, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} 
                onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} 
              />
              {/* Sheet */}
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                style={{
                  position: 'fixed',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  zIndex: 999999,
                  background: 'var(--bg-elevated)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  padding: '24px 24px max(24px, env(safe-area-inset-bottom))',
                  borderTopLeftRadius: '24px',
                  borderTopRightRadius: '24px',
                  boxShadow: '0 -10px 40px rgba(0,0,0,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ width: '40px', height: '5px', borderRadius: '5px', background: 'var(--border-color)', alignSelf: 'center', marginBottom: '12px' }} />
                
                <button className="ios-sheet-btn" onClick={() => { setShowMenu(false); onEdit(task.id); }}>
                  <Edit3 size={20} />
                  <span>Editar Detalles</span>
                </button>
                <button className="ios-sheet-btn" onClick={() => { setShowMenu(false); onOpenZenMode(task.id); }}>
                  <Sparkles size={20} />
                  <span>Modo Zen</span>
                </button>
                <button className="ios-sheet-btn" onClick={() => { setShowMenu(false); addDependency(task.id); notify('Selecciona la tarea bloqueadora'); }}>
                  <Link2 size={20} />
                  <span>Añadir Dependencia</span>
                </button>
                
                <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '8px 0' }} />
                
                <button className="ios-sheet-btn danger" onClick={() => { setShowMenu(false); setIsDeleteConfirmOpen(true); }}>
                  <Trash2 size={20} />
                  <span>Eliminar Tarea</span>
                </button>
              </motion.div>
            </>,
            document.body
          )}
        </AnimatePresence>
);

// Replace swipe background elements to be absolute positioned correctly
taskCard = taskCard.replace(/\{.*\/\* Fondos de Swipe \*\/[\s\S]*?\{.*\/\* Tarjeta Principal \*\/[\s\S]*?<motion\.div/g, \
      {/* Fondos de Swipe Fijos */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'space-between', zIndex: 0, borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
        <div style={{ flex: 1, background: 'var(--accent-green)', display: 'flex', alignItems: 'center', padding: '0 24px' }}>
          <motion.div style={{ scale: leftScale, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle color="white" size={24} />
          </motion.div>
        </div>
        <div style={{ flex: 1, background: 'var(--accent-red)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 24px' }}>
          <motion.div style={{ scale: rightScale, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Trash2 color="white" size={24} />
          </motion.div>
        </div>
      </div>

      {/* Tarjeta Principal Deslizable */}
      <motion.div
\);

// Change motion properties of drag
taskCard = taskCard.replace(/dragElastic=\{[\s\S]*?\}/, 'dragElastic={0.08}');
taskCard = taskCard.replace(/dragTransition=\{[\s\S]*?\}/, 'dragTransition={{ bounceStiffness: 400, bounceDamping: 25 }}');

// Fix text truncation
taskCard = taskCard.replace(/WebkitLineClamp:\s*6,/g, '');
taskCard = taskCard.replace(/display:\s*'-webkit-box',/g, '');
taskCard = taskCard.replace(/WebkitBoxOrient:\s*'vertical',/g, '');
taskCard = taskCard.replace(/overflow:\s*'hidden',?/g, '');
taskCard = taskCard.replace(/wordBreak:\s*'break-word',/g, 'wordBreak: \\'break-word\\', whiteSpace: \\'pre-wrap\\',');

// Change CheckCircle to Circle when not completed
taskCard = taskCard.replace(/<CheckCircle color=\{isBlocked \? 'var\(--text-tertiary\)' : isCompletedPeriod \? 'white' : 'transparent'\}/, \
          <CheckCircle color={isBlocked ? 'var(--text-tertiary)' : isCompletedPeriod ? 'white' : 'transparent'}
\);

fs.writeFileSync(taskCardPath, taskCard);


// 2. Refactor MainContent.tsx
const mainContentPath = path.join(__dirname, 'src/components/layout/MainContent.tsx');
let mainContent = fs.readFileSync(mainContentPath, 'utf8');

// Change Section headers to small uppercase
mainContent = mainContent.replace(/fontSize:\s*'1\.1rem',\s*fontWeight:\s*600/g, 'fontSize: \\'0.8rem\\', fontWeight: 700, textTransform: \\'uppercase\\', letterSpacing: \\'0.5px\\', color: \\'var(--text-tertiary)\\'');

// Change List Title size
mainContent = mainContent.replace(/fontSize:\s*'2rem',\s*fontWeight:\s*800/g, 'fontSize: \\'32px\\', fontWeight: 700');

fs.writeFileSync(mainContentPath, mainContent);


// 3. Update index.css
const cssPath = path.join(__dirname, 'src/index.css');
let css = fs.readFileSync(cssPath, 'utf8');

if (!css.includes('.ios-sheet-btn')) {
    css += \

/* iOS Popover/Sheet Native Buttons */
.ios-sheet-btn {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: transparent;
  border: none;
  font-size: 1.1rem;
  font-weight: 500;
  color: var(--text-primary);
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s;
  text-align: left;
  width: 100%;
}
.ios-sheet-btn:active {
  background: rgba(0,0,0,0.05);
}
.ios-sheet-btn.danger {
  color: var(--accent-red);
}
.ios-sheet-btn.danger svg {
  color: var(--accent-red);
}
\;
}

fs.writeFileSync(cssPath, css);

console.log("Refactor complete.");
