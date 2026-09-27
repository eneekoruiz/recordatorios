import type { TaskItem } from '../models/Task';

function escapeIcsText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function formatDateToIcs(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function priorityToIcs(priority?: string): number {
  switch (priority) {
    case 'high': return 1;
    case 'medium': return 5;
    case 'low': return 9;
    default: return 0;
  }
}

/**
 * Genera un archivo iCalendar (.ics) estándar RFC 5545 compatible con Apple Calendar,
 * Google Calendar, Microsoft Outlook y Apple Recordatorios.
 */
export function generateIcsCalendar(tasks: TaskItem[], calendarName = 'Recordatorios'): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Apple Reminders Sovereign//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    'X-WR-TIMEZONE:UTC',
  ];

  const nowIcs = formatDateToIcs(new Date());

  tasks.forEach((task) => {
    if (!task.title) return;

    const summary = escapeIcsText(task.title);
    const desc = escapeIcsText(task.description || '');
    const priority = priorityToIcs(task.priority);
    const status = task.status === 'completed' ? 'COMPLETED' : 'NEEDS-ACTION';
    const uid = `${task.id}@recordatorios.app`;

    const dueDate = task.dueDate ? new Date(task.dueDate) : null;
    const isValidDate = dueDate && !isNaN(dueDate.getTime());

    // 1. Tarea VTODO (Para apps de tareas y recordatorios nativas de Apple)
    lines.push('BEGIN:VTODO');
    lines.push(`UID:todo-${uid}`);
    lines.push(`DTSTAMP:${nowIcs}`);
    lines.push(`SUMMARY:${summary}`);
    if (desc) lines.push(`DESCRIPTION:${desc}`);
    lines.push(`STATUS:${status}`);
    if (priority > 0) lines.push(`PRIORITY:${priority}`);

    if (isValidDate) {
      const dueIcs = formatDateToIcs(dueDate);
      lines.push(`DUE:${dueIcs}`);
      lines.push(`DTSTART:${dueIcs}`);
    }

    if (task.url) {
      lines.push(`URL:${task.url}`);
    }

    lines.push('END:VTODO');

    // 2. Si tiene fecha, crear también VEVENT para que aparezca en la vista de eventos de Google Calendar y Apple Calendar
    if (isValidDate) {
      const startIcs = formatDateToIcs(dueDate);
      const durationMinutes = task.duration ? Math.max(1, Math.round(task.duration / 60)) : 30;
      const endDate = new Date(dueDate.getTime() + durationMinutes * 60 * 1000);
      const endIcs = formatDateToIcs(endDate);

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:event-${uid}`);
      lines.push(`DTSTAMP:${nowIcs}`);
      lines.push(`DTSTART:${startIcs}`);
      lines.push(`DTEND:${endIcs}`);
      lines.push(`SUMMARY:${summary}`);
      if (desc) lines.push(`DESCRIPTION:${desc}`);
      lines.push(`STATUS:${task.status === 'completed' ? 'CONFIRMED' : 'TENTATIVE'}`);
      if (priority > 0) lines.push(`PRIORITY:${priority}`);
      if (task.url) lines.push(`URL:${task.url}`);
      lines.push('END:VEVENT');
    }
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Descarga directamente el calendario .ics en el navegador del usuario.
 */
export function downloadIcsFile(tasks: TaskItem[], filename = 'recordatorios.ics', calendarName = 'Mis Recordatorios'): void {
  const icsContent = generateIcsCalendar(tasks, calendarName);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
