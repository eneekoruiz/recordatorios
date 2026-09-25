import { Fragment, type ReactNode } from 'react';
import { Calendar, Sun, Clock, Moon, LayoutList, ChevronRight, Link2, Repeat, FolderOpen, Zap, Tag } from 'lucide-react';
import type { TaskItem, CustomList } from '../../../models/Task';
import { useAppStore } from '../../../store/useAppStore';
import { HapticService } from '../../../services/HapticService';
import { getTaskDuration, formatDuration } from '../../../utils/taskDuration';
import { isShoppingList } from '../../../utils/specialLists';
import { formatEuro } from '../../../utils/format';

export interface TaskMetaBadgesProps {
  task: TaskItem;
  showListName?: boolean;
  /** En la vista «Hoy» la fecha es obvia: se oculta para no repetir información. */
  hideDueDate?: boolean;
  taskList?: CustomList;
  dueDateColor: string;
  cycleBadge?: { type?: 'day' | 'week' | 'month' | 'year' | 'custom'; label: string } | null;
  timeOfDayInfo?: { tag: 'morning' | 'afternoon' | 'night'; label: string; next: 'morning' | 'afternoon' | 'night' } | null;
  onEdit: (id: string, initialFocus?: string) => void;
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
  const showDuration = useAppStore(state => state.showDuration);
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
  const isShopping = isShoppingList(task.categoryId, taskList);
  const hasDuration = !isShopping && showDuration && Boolean(durationInfo && durationInfo.activeMinutes > 0);
  const hasMeta = showListName || showDueDate || Boolean(cycleBadge) || timeOfDayInfo || Boolean(inAppListTarget) || hasDuration || (task.price !== undefined && task.price > 0);


  return (
    <>
      {/* Meta row - Native Apple Reminders HIG Style (clean typography + colored micro-icons, zero bulky boxes) */}
      {hasMeta && (() => {
        const items: ReactNode[] = [];

            if (showListName && taskList) {
              items.push(
                <span 
                  key="list-name"
                  style={{ 
                    display: 'inline-flex', alignItems: 'center', gap: 3.5,
                    fontWeight: 650, fontSize: '0.74rem', color: taskList.color || 'var(--text-secondary)'
                  }}
                >
                  {taskList.name}
                </span>
              );
            }

            if (showDueDate) {
              const isRed = (dueDateColor || '').toLowerCase() === '#ff3b30';
              const isBlue = (dueDateColor || '').toLowerCase() === '#007aff';
              const dueColor = isRed ? '#ff3b30' : isBlue ? '#007aff' : 'var(--text-secondary)';

              const due = new Date(task.dueDate!);
              const today = new Date(); today.setHours(0, 0, 0, 0);
              const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
              const dueZero = new Date(due); dueZero.setHours(0, 0, 0, 0);
              let dueText = due.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
              if (dueZero.getTime() === today.getTime()) dueText = 'Hoy';
              else if (dueZero.getTime() === tomorrow.getTime()) dueText = 'Mañana';

              items.push(
                <span 
                  key="due-date"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(task.id, 'date');
                  }}
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: 3.5, 
                    color: dueColor, 
                    fontWeight: isRed || isBlue ? 650 : 600,
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'opacity 0.15s ease'
                  }}
                  title="Fecha de vencimiento (Toca para editar)"
                >
                  <Calendar size={11} strokeWidth={2.4} style={{ flexShrink: 0, color: dueColor }} />
                  <span>{dueText}</span>
                </span>
              );
            }

            if (cycleBadge) {
              const freqColors: Record<string, string> = {
                day: '#ff9500',
                week: '#007aff',
                month: '#af52de',
                year: '#34c759',
                custom: 'var(--text-tertiary)'
              };
              const freqColor = freqColors[cycleBadge.type || 'custom'] || 'var(--accent-primary)';

              items.push(
                <span 
                  key="frequency"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(task.id, 'frequency');
                  }}
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: 3.5, 
                    color: 'var(--text-secondary)', 
                    fontWeight: 600,
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'opacity 0.15s ease'
                  }}
                  title={`Frecuencia: ${cycleBadge.label} (Toca para editar)`}
                >
                  <Repeat size={11} strokeWidth={2.5} style={{ color: freqColor, flexShrink: 0 }} />
                  <span>{cycleBadge.label}</span>
                </span>
              );
            }

            if (hasDuration && durationInfo) {
              items.push(
                <span
                  key="duration"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(task.id, 'duration');
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3.5,
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontVariantNumeric: 'tabular-nums',
                    userSelect: 'none',
                    transition: 'opacity 0.15s ease'
                  }}
                  title={`Duración estimada: ${formatDuration(durationInfo.activeMinutes)}${durationInfo.isParallel ? ` (+${formatDuration(durationInfo.parallelMinutes)} en paralelo)` : ''}. Pulsa para editar.`}
                >
                  {durationInfo.isParallel ? (
                    <Zap size={11} strokeWidth={2.4} style={{ flexShrink: 0, color: '#ff9500' }} />
                  ) : (
                    <Clock size={11} strokeWidth={2.2} style={{ flexShrink: 0, color: 'var(--accent-primary)', opacity: 0.85 }} />
                  )}
                  <span>{formatDuration(durationInfo.activeMinutes)}</span>
                  {durationInfo.isParallel && (
                    <span style={{ fontSize: '0.67rem', color: 'var(--text-tertiary)', fontWeight: 500 }}>(+{formatDuration(durationInfo.parallelMinutes)})</span>
                  )}
                </span>
              );
            }

            if (task.price !== undefined && task.price > 0) {
              items.push(
                <span
                  key="price"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(task.id, 'price');
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3.5,
                    color: 'var(--text-secondary)',
                    fontWeight: 650,
                    fontVariantNumeric: 'tabular-nums',
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'opacity 0.15s ease'
                  }}
                  title={`Precio: ${task.price} €${task.quantity && task.quantity > 1 ? ` (${task.quantity} uds)` : ''} (Toca para editar)`}
                >
                  <Tag size={11} strokeWidth={2.4} style={{ color: '#30d158', flexShrink: 0 }} />
                  {task.quantity && task.quantity > 1 && (
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '0.72rem', fontWeight: 500 }}>{task.quantity}×</span>
                  )}
                  <span>{formatEuro(task.price)}</span>
                </span>
              );
            }

            if (timeOfDayInfo) {
              const timeIcon = timeOfDayInfo.tag === 'morning'
                ? <Sun size={11} strokeWidth={2.4} style={{ color: '#ff9500', flexShrink: 0 }} />
                : timeOfDayInfo.tag === 'afternoon'
                ? <Clock size={11} strokeWidth={2.4} style={{ color: '#007aff', flexShrink: 0 }} />
                : <Moon size={11} strokeWidth={2.4} style={{ color: '#5856d6', flexShrink: 0 }} />;

              items.push(
                <button
                  key="time-of-day"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateTask(task.id, { timeOfDay: timeOfDayInfo.next });
                    HapticService.selection();
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3.5,
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    lineHeight: '1.2',
                    userSelect: 'none',
                    transition: 'opacity 0.15s ease'
                  }}
                  title={`Momento del día: ${timeOfDayInfo.label}. Pulsa para alternar (Mañana ➔ Tarde ➔ Noche).`}
                >
                  {timeIcon}
                  <span>{timeOfDayInfo.label}</span>
                </button>
              );
            }

            if (inAppListTarget) {
              items.push(
                <span 
                  key="in-app-list"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onNavigateView?.(`list_${inAppListTarget.id}`);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3.5,
                    color: 'var(--accent-primary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'opacity 0.15s ease'
                  }}
                  title={`Ir a ${inAppListTarget.name}`}
                >
                  <LayoutList size={11} strokeWidth={2.2} style={{ flexShrink: 0 }} />
                  <span>Ir a {inAppListTarget.name}</span>
                  <ChevronRight size={10} style={{ opacity: 0.7, flexShrink: 0 }} />
                </span>
              );
            }

            return (
              <div style={{ display: 'inline-flex', gap: '6px', marginTop: 3, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.75rem', lineHeight: '1.2' }}>
                {items.map((item, idx) => (
                  <Fragment key={idx}>
                    {idx > 0 && (
                      <span aria-hidden="true" style={{ color: 'var(--text-tertiary)', opacity: 0.5, fontSize: '0.62rem', userSelect: 'none', margin: '0 1px' }}>
                        ·
                      </span>
                    )}
                    {item}
                  </Fragment>
                ))}
              </div>
            );
          })()}

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
