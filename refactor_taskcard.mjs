import fs from 'fs';

const file = 'src/components/tasks/TaskCard.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove the image icon from Title Row
content = content.replace(/\{task\.image\s*&&\s*<ImageIcon[^>]+>\}/g, '');

// 2. Remove the price pill from Title Row
content = content.replace(/\{task\.price !== undefined && task\.price > 0 && \([\s\S]*?<\/span>\n\s*\)\}/, '');

// 3. Replace the right-side buttons (Info and MoreHorizontal)
const rightSideButtonsRegex = /\{\/\* Apple Reminders Info \(i\) button & subtle more options \*\/\}\s*\{\!isBlocked && \([\s\S]*?<\/div>\n\s*\)\}/;
const newRightSideButtons = `{/* Apple Reminders Info (i) button & subtle more options */}
        {!isBlocked && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            
            {/* THUMBNAIL */}
            {task.image && (
              <div
                style={{
                  width: 32, height: 32,
                  borderRadius: 6,
                  overflow: 'hidden',
                  flexShrink: 0,
                  marginRight: 4,
                  alignSelf: 'center',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  opacity: isEffectivelyDone ? 0.6 : 1
                }}
                onClick={(e) => { e.stopPropagation(); HapticService.selection(); onEdit(task.id); }}
                title="Ver imagen adjunta"
              >
                <img src={task.image} alt="Adjunto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}

            {/* HOVER QUICK ACTIONS (Desktop) */}
            {!isMobile && isHovered && !contextMenuOpen && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginRight: 2 }} className="desktop-quick-actions">
                <button
                  onClick={(e) => { e.stopPropagation(); HapticService.selection(); onEdit(task.id); }}
                  title="Editar detalles"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Calendar size={16} strokeWidth={2} />
                </button>
                <button
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    HapticService.selection(); 
                    useAppStore.getState().updateTask(task.id, { flagged: !task.flagged }); 
                  }}
                  title={task.flagged ? "Quitar destacado" : "Destacar"}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: task.flagged ? 'var(--accent-orange)' : 'var(--text-tertiary)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Flag size={16} fill={task.flagged ? 'var(--accent-orange)' : 'none'} strokeWidth={2} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); HapticService.impact('medium'); onDelete(task.id); }}
                  title="Borrar tarea"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-tertiary)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-red)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                >
                  <Trash2 size={16} strokeWidth={2} />
                </button>
              </div>
            )}

            {/* Info Button - always on mobile, or on desktop if not hovering for quick actions */}
            {(isMobile || contextMenuOpen) && (
              <button
                className="task-info-btn"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  HapticService.selection();
                  onEdit(task.id);
                }}
                aria-label="Detalles del recordatorio"
                title="Información y detalles (i)"
                style={{
                  width: 32, height: 32,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: taskColor || 'var(--accent-primary)',
                  opacity: 0.85,
                  transition: 'opacity 0.2s ease, background-color 0.15s ease',
                  WebkitTapHighlightColor: 'transparent',
                  flexShrink: 0
                }}
              >
                <Info size={18} strokeWidth={2.2} />
              </button>
            )}
          </div>
        )}`;

content = content.replace(rightSideButtonsRegex, newRightSideButtons);

// Make sure Calendar and Trash2 are imported
if (!content.includes('Trash2')) {
  content = content.replace(/import\s*\{\s*/, 'import { Trash2, Calendar, ');
}

fs.writeFileSync(file, content);
