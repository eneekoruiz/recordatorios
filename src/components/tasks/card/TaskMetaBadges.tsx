import { useMemo, type ReactNode, type MouseEvent } from 'react';
import { Calendar, CalendarX2, Sun, Clock, Moon, LayoutList, ChevronRight, Link2, Repeat, FolderOpen, Flame } from 'lucide-react';
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
  cycleBadge?: { type?: 'day' | 'week' | 'month' | 'year' | 'custom'; label: string; color?: string; icon?: string } | null;
  timeOfDayInfo?: { tag: 'morning' | 'afternoon' | 'night'; label: string; next: 'morning' | 'afternoon' | 'night' } | null;
  onEdit: (id: string, initialFocus?: string) => void;
  onNavigateView?: (viewId: string) => void;
  lists?: CustomList[];
  onOpenFrequencyPicker?: (e: React.MouseEvent) => void;
  /** Escribe la frecuencia en lugar de mostrar solo el glifo (secciones con frecuencias mezcladas). */
  frequencyAsLabel?: boolean;
  /** Racha de un hábito (≥ 2): un dato más de la línea, no una etiqueta junto al título. */
  streak?: { count: number; unit: string } | null;
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
  lists,
  onOpenFrequencyPicker,
  streak,
  frequencyAsLabel = false
}: TaskMetaBadgesProps) {
  const updateTask = useAppStore(state => state.updateTask);
  const tasks = useAppStore(state => state.tasks);
  const listSections = useAppStore(state => state.listSections);
  const showDuration = useAppStore(state => state.showDuration);
  const durationInfo = getTaskDuration(task, listSections, lists);

  // Subtareas directas e indirectas para acumulación de precio y duración en tarea padre
  const childTasks = useMemo(() => {
    if (!tasks || !task.id) return [];
    const result: TaskItem[] = [];
    const queue = [task.id];
    const allList = Object.values(tasks);
    while (queue.length > 0) {
      const parent = queue.shift()!;
      for (const t of allList) {
        if (t && t.parentId === parent && !t.deleted_at) {
          result.push(t);
          queue.push(t.id);
        }
      }
    }
    return result;
  }, [tasks, task.id]);

  // Cálculo acumulado de precio: propio + subtareas
  const ownPrice = (task.price !== undefined && task.price > 0) ? (task.price * (task.quantity || 1)) : 0;
  const subtasksPrice = childTasks.reduce((sum: number, c: TaskItem) => {
    if (c.price !== undefined && c.price > 0) {
      return sum + (c.price * (c.quantity || 1));
    }
    return sum;
  }, 0);
  const totalPrice = ownPrice + subtasksPrice;
  const hasPrice = totalPrice > 0;

  // Cálculo acumulado de duración: propia + subtareas
  const subtasksDuration = useMemo(() => {
    if (childTasks.length === 0) return { activeMinutes: 0, parallelMinutes: 0, hasSubtasksDuration: false };
    let act = 0;
    let par = 0;
    for (const c of childTasks) {
      const d = getTaskDuration(c, listSections, lists);
      if (d.activeMinutes > 0) act += d.activeMinutes;
      if (d.parallelMinutes > 0) par += d.parallelMinutes;
    }
    return { activeMinutes: act, parallelMinutes: par, hasSubtasksDuration: act > 0 || par > 0 };
  }, [childTasks, listSections, lists]);

  const totalActiveMinutes = (durationInfo?.activeMinutes || 0) + subtasksDuration.activeMinutes;
  const totalParallelMinutes = (durationInfo?.parallelMinutes || 0) + subtasksDuration.parallelMinutes;
  const isParallel = durationInfo?.isParallel || subtasksDuration.parallelMinutes > 0;

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

  const dateIsRedundant = hideDueDate && task.dueDate &&
    new Date(task.dueDate).toDateString() === new Date().toDateString() &&
    (dueDateColor || '').toLowerCase() !== '#ff3b30';
  const isShopping = isShoppingList(task.categoryId, taskList);
  const hasDuration = !isShopping && showDuration && (totalActiveMinutes > 0 || totalParallelMinutes > 0);


  const isRed = (dueDateColor || '').toLowerCase() === '#ff3b30';
  const isBlue = (dueDateColor || '').toLowerCase() === '#007aff';
  const ownActive = durationInfo?.activeMinutes || 0;
  const subActive = subtasksDuration.activeMinutes;
  const durationDescription = subtasksDuration.hasSubtasksDuration && ownActive > 0
    ? `${formatDuration(totalActiveMinutes)}: ${formatDuration(ownActive)} propia y ${formatDuration(subActive)} en subtareas`
    : subtasksDuration.hasSubtasksDuration
      ? `${formatDuration(totalActiveMinutes)} en subtareas`
      : formatDuration(totalActiveMinutes);
  const priceDescription = subtasksPrice > 0 && ownPrice > 0
    ? `${formatEuro(totalPrice)}: ${formatEuro(ownPrice)} propio y ${formatEuro(subtasksPrice)} en subtareas`
    : formatEuro(totalPrice);

  /* Una sola línea secundaria con lo que ayuda a actuar. Los datos no son botones sueltos de 44 px: toda la
     fila es la zona táctil y TaskCard abre el editor en el campo tocado (data-meta-field). El desglose
     (propio/subtareas, paralelo) se queda en el título accesible y en el editor. */
  const items: ReactNode[] = [];
  let hasExactTime = false;
  let hasDateText = false;
  if (showListName && taskList) {
    items.push(<span key="list-name" className="task-meta-item task-meta-list" style={{ color: taskList.color || undefined }}>{taskList.name}</span>);
  }
  if (task.dueDate && !dateIsRedundant) {
    const due = new Date(task.dueDate);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const dueZero = new Date(due); dueZero.setHours(0, 0, 0, 0);
    let dueText = due.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '');
    if (dueZero.getTime() === today.getTime()) dueText = 'Hoy';
    else if (dueZero.getTime() === tomorrow.getTime()) dueText = 'Mañana';
    const hasTime = due.getHours() !== 0 || due.getMinutes() !== 0;
    const timeText = hasTime ? due.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';
    hasExactTime = hasTime;
    hasDateText = true;
    items.push(
      <span key="due-date" className={`task-meta-item${isRed ? ' is-overdue' : isBlue ? ' is-today' : ''}`} data-meta-field="date" title="Fecha · toca para editar">
        {isRed ? <CalendarX2 size={13} aria-hidden="true" /> : <Calendar size={13} aria-hidden="true" />}
        {isRed && <span className="sr-only">Vencida: </span>}
        <span>{dueText}{timeText ? `, ${timeText}` : ''}</span>
      </span>
    );
  }
  // Con hora exacta, el momento del día sobra (y «Hoy, 14:55 · Mañana» se contradecía). Junto a una
  // fecha se escribe «por la mañana»: a secas, «Mañana» se leía como el día siguiente.
  if (timeOfDayInfo && !hasExactTime) {
    const timeOfDayText = hasDateText ? `por la ${timeOfDayInfo.label.toLowerCase()}` : timeOfDayInfo.label;
    const TimeIcon = timeOfDayInfo.tag === 'morning' ? Sun : timeOfDayInfo.tag === 'afternoon' ? Clock : Moon;
    items.push(
      <span key="time-of-day" className="task-meta-item" data-meta-field="time-of-day" data-next-time={timeOfDayInfo.next}
        title={`${timeOfDayInfo.label} · toca para cambiar el momento del día`}>
        <TimeIcon size={13} aria-hidden="true" /><span>{timeOfDayText}</span>
      </span>
    );
  }
  if (hasDuration) {
    items.push(
      <span key="duration" className="task-meta-item task-meta-num" data-meta-field="duration" title={`Duración: ${durationDescription}${isParallel ? `, más ${formatDuration(totalParallelMinutes)} de espera en segundo plano` : ''}`}>
        <Clock size={13} aria-hidden="true" />
        <span className="sr-only">Duración: </span>
        <span>{formatDuration(totalActiveMinutes)}</span>
        {/* «+2 h» a secas no se entendía: es el tiempo que la tarea sigue sola (lavadora, horno…). */}
        {isParallel && <span className="task-meta-aside">+ {formatDuration(totalParallelMinutes)} de espera</span>}
      </span>
    );
  }
  if (hasPrice) {
    items.push(
      <span key="price" className="task-meta-item task-meta-num" data-meta-field="price" title={`Precio: ${priceDescription}`}>
        <span className="sr-only">Precio: </span>
        {task.quantity && task.quantity > 1 && subtasksPrice === 0
          ? <span>{task.quantity} × {formatEuro(task.price || 0)}</span>
          : <span>{formatEuro(totalPrice)}</span>}
      </span>
    );
  }
  const renderFrequency = (withLabel: boolean) => cycleBadge && (
    <span key="frequency" className="task-meta-item task-meta-glyph" data-meta-field="frequency" title={`Se repite: ${cycleBadge.label}`}>
      <Repeat size={13} aria-hidden="true" />
      {withLabel ? <span>{cycleBadge.label}</span> : <span className="sr-only">Se repite: {cycleBadge.label}</span>}
    </span>
  );
  // Con racha («3 días») ya se ve que se repite: el icono suelto de repetición sobra.
  const hasStreak = Boolean(streak && streak.count >= 2);
  if (cycleBadge && (frequencyAsLabel || !hasStreak)) {
    items.push(renderFrequency(frequencyAsLabel));
  }
  if (streak && hasStreak) {
    items.push(
      <span key="streak" className="task-meta-item task-meta-num task-meta-streak" data-meta-field="streak"
        title={`Racha: ${streak.count} ${streak.unit} seguidos`}>
        <Flame size={13} aria-hidden="true" /><span className="sr-only">Racha: </span><span>{streak.count} {streak.unit}</span>
      </span>
    );
  }
  if (inAppListTarget) {
    items.push(
      <span key="in-app-list" className="task-meta-item task-meta-link" data-meta-field="in-app-list" data-target-view={`list_${inAppListTarget.id}`} title={`Ir a ${inAppListTarget.name}`}>
        <LayoutList size={13} aria-hidden="true" /><span>{inAppListTarget.name}</span><ChevronRight size={12} aria-hidden="true" />
      </span>
    );
  }
  // Una línea entera solo para el icono de repetición no decía nada: si va sola, lleva su nombre («Diaria»).
  if (cycleBadge && !frequencyAsLabel && items.length === 1) {
    items[0] = renderFrequency(true);
  }
  // Tocar un dato abre su edición (como en la versión original); el teclado llega por el (i) y el menú contextual.
  const handleMetaClick = (event: MouseEvent<HTMLDivElement>) => {
    const item = (event.target as HTMLElement).closest<HTMLElement>('[data-meta-field]');
    event.stopPropagation();
    const field = item?.dataset.metaField;
    if (field === 'time-of-day' && timeOfDayInfo) {
      updateTask(task.id, { timeOfDay: timeOfDayInfo.next });
      HapticService.selection();
    } else if (field === 'in-app-list' && item?.dataset.targetView) {
      onNavigateView?.(item.dataset.targetView);
    } else if (field === 'frequency' && onOpenFrequencyPicker) {
      onOpenFrequencyPicker(event);
    } else {
      onEdit(task.id, field && field !== 'list-name' && field !== 'streak' ? field : undefined);
    }
  };

  return (
    <>
      {items.length > 0 && <div className="task-meta-line" onClick={handleMetaClick}>{items}</div>}

      {/* Enlace: una línea con el sitio («doctoralia.es»), no una tarjeta con la URL entera repetida. */}
      {(() => {
        if (!task.url || !task.url.startsWith('http')) return null;
        const isDrive = task.url.includes('drive.google.com');
        const isDocs = task.url.includes('docs.google.com');
        const host = (() => { try { return new URL(task.url).hostname.replace(/^www\./, ''); } catch { return 'Enlace web'; } })();
        const label = isDrive ? 'Google Drive' : isDocs ? 'Google Docs' : host;
        return (
          <a
            href={task.url}
            target="_blank"
            rel="noreferrer"
            className="task-link hit-44"
            title={task.url}
            aria-label={`Abrir ${label} (en otra pestaña)`}
            onClick={e => e.stopPropagation()}
          >
            {isDrive || isDocs ? <FolderOpen size={14} aria-hidden="true" /> : <Link2 size={14} aria-hidden="true" />}
            <span>{label}</span>
          </a>
        );
      })()}
    </>
  );
}
