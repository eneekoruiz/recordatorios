import { Calendar, Repeat, Sun, Clock, Moon, LayoutList, ChevronRight, Link2 } from 'lucide-react';
import type { TaskItem, CustomList } from '../../../models/Task';
import { useAppStore } from '../../../store/useAppStore';
import { HapticService } from '../../../services/HapticService';

export interface TaskMetaBadgesProps {
  task: TaskItem;
  showListName?: boolean;
  taskList?: CustomList;
  dueDateColor: string;
  cycleBadge?: { label: string } | null;
  timeOfDayInfo?: { tag: 'morning' | 'afternoon' | 'night'; label: string; next: 'morning' | 'afternoon' | 'night' } | null;
  onEdit: (id: string) => void;
  onNavigateView?: (viewId: string) => void;
  lists?: CustomList[];
}

export function TaskMetaBadges({
  task,
  showListName,
  taskList,
  dueDateColor,
  cycleBadge,
  timeOfDayInfo,
  onEdit,
  onNavigateView,
  lists
}: TaskMetaBadgesProps) {
  const updateTask = useAppStore(state => state.updateTask);

  const hasMeta = showListName || task.dueDate || cycleBadge || timeOfDayInfo;

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
          {task.dueDate && (
            <span 
              onClick={(e) => {
                e.stopPropagation();
                onEdit(task.id);
              }}
              style={{ 
                display: 'inline-flex', alignItems: 'center', gap: 4, 
                color: dueDateColor, fontWeight: dueDateColor === '#FF3B30' ? 600 : 400,
                cursor: 'pointer'
              }}
              title="Fecha de vencimiento (Toca para editar)"
            >
              <Calendar size={11} style={{ flexShrink: 0 }} /> {(() => {
                const due = new Date(task.dueDate);
                const today = new Date(); today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
                const dueZero = new Date(due); dueZero.setHours(0, 0, 0, 0);
                if (dueZero.getTime() === today.getTime()) return 'Hoy';
                if (dueZero.getTime() === tomorrow.getTime()) return 'Mañana';
                return due.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
              })()}
            </span>
          )}
          {cycleBadge && (
            <span 
              onClick={(e) => {
                e.stopPropagation();
                onEdit(task.id);
              }}
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: 4, 
                color: 'var(--text-secondary)',
                background: 'var(--bg-hover, rgba(0,0,0,0.04))',
                border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                padding: '1.5px 7px',
                borderRadius: 6,
                fontSize: '0.74rem',
                fontWeight: 500,
                letterSpacing: '-0.1px',
                cursor: 'pointer'
              }}
              title={`Frecuencia de repetición: ${cycleBadge.label} (Toca para editar)`}
            >
              <Repeat size={11} style={{ color: 'var(--text-tertiary)' }} />
              <span>{cycleBadge.label}</span>
            </span>
          )}
          {timeOfDayInfo && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                updateTask(task.id, { timeOfDay: timeOfDayInfo.next });
                HapticService.selection();
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '1.5px 7px',
                borderRadius: 6,
                fontSize: '0.74rem',
                fontWeight: 500,
                background: 'var(--bg-hover, rgba(0,0,0,0.04))',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                cursor: 'pointer',
                letterSpacing: '-0.1px'
              }}
              title={`Momento del día: ${timeOfDayInfo.label}. Pulsa para cambiar (Mañana ➔ Tarde ➔ Noche).`}
            >
              {timeOfDayInfo.tag === 'morning' ? <Sun size={11} style={{ color: 'var(--text-tertiary)' }} /> :
               timeOfDayInfo.tag === 'afternoon' ? <Clock size={11} style={{ color: 'var(--text-tertiary)' }} /> :
               <Moon size={11} style={{ color: 'var(--text-tertiary)' }} />}
              <span>{timeOfDayInfo.label}</span>
            </button>
          )}
        </div>
      )}

      {/* In-app list navigation button if URL is Care or an in-app list */}
      {(() => {
        if (!task.url) return null;
        const isCareUrl = task.url.startsWith('app://list/care') || (task.url.includes('icloud.com/reminders') && task.url.includes('Care')) || task.title.toLowerCase().includes('skin-care') || task.title.toLowerCase().includes('skincare');
        const isAppListUrl = task.url.startsWith('app://list/');
        
        if (isCareUrl || isAppListUrl) {
          const targetListId = isCareUrl ? 'care' : task.url.replace('app://list/', '');
          const targetList = lists?.find(l => l.id === targetListId);
          return (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onNavigateView?.(`list_${targetListId}`);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 8,
                padding: '7px 14px',
                borderRadius: 10,
                background: 'rgba(0, 122, 255, 0.12)',
                color: 'var(--accent-primary)',
                border: '1px solid rgba(0, 122, 255, 0.25)',
                fontWeight: 600,
                fontSize: '0.84rem',
                cursor: 'pointer'
              }}
            >
              <LayoutList size={15} />
              <span>Ir a lista {targetList?.name || 'Care'}</span>
              <ChevronRight size={14} style={{ opacity: 0.7 }} />
            </button>
          );
        }

        // External URLs (exclude app:// so Safari doesn't throw invalid scheme error)
        if (task.url.startsWith('http')) {
          return (
            <a
              href={task.url}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                textDecoration: 'none', color: 'var(--text-primary)',
                marginTop: 8,
                padding: '8px 12px',
                borderRadius: '12px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                boxSizing: 'border-box',
                maxWidth: '100%',
                overflow: 'hidden'
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {task.url.includes('drive.google.com') || task.url.includes('docs.google.com') ? (
                  <span style={{ fontSize: '1.1rem' }}>📁</span>
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
