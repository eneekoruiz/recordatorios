import { Calendar, Sun, Clock, Moon, LayoutList, ChevronRight, Link2, Repeat, FolderOpen, CalendarDays, Globe, Zap } from 'lucide-react';
import type { TaskItem, CustomList } from '../../../models/Task';
import { useAppStore } from '../../../store/useAppStore';
import { HapticService } from '../../../services/HapticService';
import { getTaskDuration, formatDuration } from '../../../utils/taskDuration';

export interface TaskMetaBadgesProps {
  task: TaskItem;
  showListName?: boolean;
  /** En la vista «Hoy» la fecha es obvia: se oculta para no repetir información. */
  hideDueDate?: boolean;
  taskList?: CustomList;
  dueDateColor: string;
  cycleBadge?: { type?: 'day' | 'week' | 'month' | 'year' | 'custom'; label: string } | null;
  timeOfDayInfo?: { tag: 'morning' | 'afternoon' | 'night'; label: string; next: 'morning' | 'afternoon' | 'night' } | null;
  onEdit: (id: string) => void;
  onNavigateView?: (viewId: string) => void;
  lists?: CustomList[];
}

export function TaskMetaBadges({
  task,
  showListName,
  hideDueDate,
  taskList,
  dueDateColor,
  cycleBadge,
  timeOfDayInfo,
  onEdit,
  onNavigateView,
  lists
}: TaskMetaBadgesProps) {
  const updateTask = useAppStore(state => state.updateTask);
  const listSections = useAppStore(state => state.listSections);
  const durationInfo = getTaskDuration(task, listSections, lists);

  const inAppListTarget = (() => {
    const url = task.url || '';
    const taskTitleLower = (task?.title || '').toLowerCase();
    const isCareUrl = url.startsWith('app://list/care') || (url.includes('icloud.com/reminders') && url.includes('Care')) || taskTitleLower.includes('skin-care') || taskTitleLower.includes('skincare');
    const isAppListUrl = url.startsWith('app://list/');
    if (isCareUrl || isAppListUrl) {
      const targetListId = isCareUrl ? 'care' : url.replace('app://list/', '');
      const targetList = lists?.find(l => l.id === targetListId);
      return { id: targetListId, name: targetList?.name || 'Care' };
    }
    return null;
  })();

  const showDueDate = !!task.dueDate && !hideDueDate;
  const hasDuration = Boolean(durationInfo && durationInfo.activeMinutes > 0);
  const hasMeta = showListName || showDueDate || Boolean(cycleBadge) || timeOfDayInfo || Boolean(inAppListTarget) || hasDuration;

  return (
    <>
      {/* Meta row - Native iOS HIG Style */}
      {hasMeta && (
        <div style={{ display: 'flex', gap: '6px', marginTop: 3, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-tertiary)', lineHeight: '1.3' }}>
          {showListName && taskList && (
            <span style={{ 
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: 'var(--bg-hover, rgba(0,0,0,0.04))', padding: '1px 7px', borderRadius: '6px',
              fontWeight: 500, fontSize: '0.75rem', color: taskList.color || 'var(--text-secondary)'
            }}>
              {taskList.name}
            </span>
          )}
          {showDueDate && (() => {
            const isRed = (dueDateColor || '').toLowerCase() === '#ff3b30';
            const isBlue = (dueDateColor || '').toLowerCase() === '#007aff';
            const dueBg = isRed
              ? 'rgba(255, 59, 48, 0.10)'
              : isBlue
              ? 'rgba(0, 122, 255, 0.09)'
              : 'var(--fill-quaternary, rgba(142, 142, 147, 0.09))';
            const dueBorder = isRed
              ? '1px solid rgba(255, 59, 48, 0.25)'
              : isBlue
              ? '1px solid rgba(0, 122, 255, 0.22)'
              : '1px solid var(--separator-subtle, rgba(142, 142, 147, 0.20))';
            const dueText = isRed ? '#ff3b30' : isBlue ? '#007aff' : 'var(--text-secondary)';

            return (
              <span 
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(task.id);
                }}
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: 4, 
                  color: dueText, 
                  fontWeight: 600,
                  fontSize: '0.73rem',
                  cursor: 'pointer',
                  lineHeight: 1.2,
                  padding: '2px 7px',
                  borderRadius: 7,
                  background: dueBg,
                  border: dueBorder,
                  transition: 'all 0.15s ease',
                  userSelect: 'none'
                }}
                title="Fecha de vencimiento (Toca para editar)"
              >
                <Calendar size={11} strokeWidth={2.2} style={{ flexShrink: 0 }} />
                <span>{(() => {
                  const due = new Date(task.dueDate!);
                  const today = new Date(); today.setHours(0, 0, 0, 0);
                  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
                  const dueZero = new Date(due); dueZero.setHours(0, 0, 0, 0);
                  if (dueZero.getTime() === today.getTime()) return 'Hoy';
                  if (dueZero.getTime() === tomorrow.getTime()) return 'Mañana';
                  return due.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
                })()}</span>
              </span>
            );
          })()}

          {hasDuration && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onEdit(task.id);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 7px',
                borderRadius: 7,
                fontSize: '0.73rem',
                fontWeight: 600,
                background: durationInfo.isParallel ? 'rgba(255, 149, 0, 0.11)' : 'rgba(0, 122, 255, 0.09)',
                color: durationInfo.isParallel ? '#ff9500' : '#007aff',
                border: durationInfo.isParallel ? '1px solid rgba(255, 149, 0, 0.25)' : '1px solid rgba(0, 122, 255, 0.22)',
                cursor: 'pointer',
                lineHeight: 1.2,
                transition: 'all 0.15s ease',
                userSelect: 'none'
              }}
              title={`Duración estimada: ${formatDuration(durationInfo.activeMinutes)}${durationInfo.isParallel ? ` (+${formatDuration(durationInfo.parallelMinutes)} en paralelo)` : ''}. Pulsa para editar.`}
            >
              {durationInfo.isParallel ? (
                <Zap size={11} strokeWidth={2.4} style={{ flexShrink: 0 }} />
              ) : (
                <Clock size={11} strokeWidth={2.2} style={{ flexShrink: 0 }} />
              )}
              <span>{formatDuration(durationInfo.activeMinutes)}</span>
              {durationInfo.isParallel && (
                <span style={{ fontSize: '0.64rem', opacity: 0.85 }}>(+{formatDuration(durationInfo.parallelMinutes)})</span>
              )}
            </span>
          )}
          
          {inAppListTarget && (
            <span 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onNavigateView?.(`list_${inAppListTarget.id}`);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 7px',
                borderRadius: 7,
                fontSize: '0.73rem',
                fontWeight: 600,
                background: 'rgba(0, 122, 255, 0.09)',
                border: '1px solid rgba(0, 122, 255, 0.22)',
                color: 'var(--accent-primary)',
                cursor: 'pointer',
                lineHeight: 1.2
              }}
              title={`Ir a ${inAppListTarget.name}`}
            >
              <LayoutList size={11} style={{ flexShrink: 0 }} />
              <span>Ir a {inAppListTarget.name}</span>
              <ChevronRight size={10} style={{ opacity: 0.7, flexShrink: 0 }} />
            </span>
          )}
          
          {cycleBadge && (() => {
            const badgeStyles = {
              day: {
                color: 'var(--accent-orange, #ff9500)',
                background: 'rgba(255, 149, 0, 0.09)',
                border: '1px solid rgba(255, 149, 0, 0.22)',
                icon: <Sun size={11} strokeWidth={2.2} style={{ flexShrink: 0 }} />
              },
              week: {
                color: 'var(--accent-blue, #007aff)',
                background: 'rgba(0, 122, 255, 0.09)',
                border: '1px solid rgba(0, 122, 255, 0.22)',
                icon: <CalendarDays size={11} strokeWidth={2.2} style={{ flexShrink: 0 }} />
              },
              month: {
                color: 'var(--accent-purple, #af52de)',
                background: 'rgba(175, 82, 222, 0.09)',
                border: '1px solid rgba(175, 82, 222, 0.22)',
                icon: <Moon size={11} strokeWidth={2.2} style={{ flexShrink: 0 }} />
              },
              year: {
                color: 'var(--accent-green, #34c759)',
                background: 'rgba(52, 199, 89, 0.09)',
                border: '1px solid rgba(52, 199, 89, 0.22)',
                icon: <Globe size={11} strokeWidth={2.2} style={{ flexShrink: 0 }} />
              },
              custom: {
                color: 'var(--text-secondary)',
                background: 'var(--fill-quaternary, rgba(142, 142, 147, 0.09))',
                border: '1px solid var(--separator-subtle, rgba(142, 142, 147, 0.20))',
                icon: <Repeat size={11} strokeWidth={2.2} style={{ flexShrink: 0 }} />
              }
            };

            const currentStyle = badgeStyles[cycleBadge.type as keyof typeof badgeStyles] || badgeStyles.custom;

            return (
              <span 
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(task.id);
                }}
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: 4, 
                  color: currentStyle.color, 
                  fontWeight: 600,
                  fontSize: '0.73rem',
                  cursor: 'pointer',
                  lineHeight: 1.2,
                  padding: '2px 7px',
                  borderRadius: 7,
                  background: currentStyle.background,
                  border: currentStyle.border,
                  transition: 'all 0.15s ease',
                  userSelect: 'none'
                }}
                title={`Frecuencia: ${cycleBadge.label} (Toca para editar)`}
              >
                {currentStyle.icon}
                <span>{cycleBadge.label}</span>
              </span>
            );
          })()}

          {/* Time of Day Pills (Morning, Afternoon, Night) */}
          {timeOfDayInfo && (() => {
            const timeStyles = {
              morning: {
                color: '#ff9500',
                background: 'rgba(255, 149, 0, 0.09)',
                border: '1px solid rgba(255, 149, 0, 0.22)',
                icon: <Sun size={11} strokeWidth={2.2} style={{ flexShrink: 0 }} />
              },
              afternoon: {
                color: '#007aff',
                background: 'rgba(0, 122, 255, 0.09)',
                border: '1px solid rgba(0, 122, 255, 0.22)',
                icon: <Clock size={11} strokeWidth={2.2} style={{ flexShrink: 0 }} />
              },
              night: {
                color: '#5856d6',
                background: 'rgba(88, 86, 214, 0.09)',
                border: '1px solid rgba(88, 86, 214, 0.22)',
                icon: <Moon size={11} strokeWidth={2.2} style={{ flexShrink: 0 }} />
              }
            };
            const currentStyle = timeStyles[timeOfDayInfo.tag] || timeStyles.morning;

            return (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  updateTask(task.id, { timeOfDay: timeOfDayInfo.next });
                  HapticService.selection();
                }}
                style={{
                  background: currentStyle.background,
                  border: currentStyle.border,
                  padding: '2px 7px',
                  borderRadius: 7,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  color: currentStyle.color,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.73rem',
                  lineHeight: 1.2,
                  transition: 'all 0.15s ease',
                  userSelect: 'none'
                }}
                title={`Momento del día: ${timeOfDayInfo.label}. Pulsa para cambiar (Mañana ➔ Tarde ➔ Noche).`}
              >
                {currentStyle.icon}
                <span>{timeOfDayInfo.label}</span>
              </button>
            );
          })()}
        </div>
      )}

      {/* Rich Links (External URLs) */}
      {(() => {
        if (task.url && task.url.startsWith('http')) {
          return (
            <a
              href={task.url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                textDecoration: 'none', color: 'var(--text-primary)',
                marginTop: 8, padding: '8px 12px', borderRadius: '12px',
                background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)', boxSizing: 'border-box',
                maxWidth: '100%', overflow: 'hidden'
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {task.url.includes('drive.google.com') || task.url.includes('docs.google.com') ? (
                  <FolderOpen size={16} color="var(--accent-primary)" />
                ) : (
                  <Link2 size={16} color="var(--accent-primary)" />
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {task.url.includes('drive.google.com') ? 'Google Drive' : task.url.includes('docs.google.com') ? 'Google Docs' : task.url}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {(() => { try { return new URL(task.url).hostname.replace('www.', ''); } catch { return 'Enlace web'; } })()}
                </span>
              </div>
            </a>
          );
        }

        return null;
      })()}
    </>
  );
}
