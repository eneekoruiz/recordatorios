import type { TaskItem } from '../models/Task';
import { formatDuration } from '../utils/taskDuration';

export class IntegrationService {
  /**
   * Generates a Google Calendar Web Intent URL to add the reminder directly as a calendar event.
   */
  public static getGoogleCalendarUrl(task: TaskItem): string {
    const title = encodeURIComponent(task.title || 'Recordatorio');
    const details = encodeURIComponent(
      [
        task.description,
        task.duration ? `Duración estimada: ${formatDuration(task.duration)}` : null,
        task.url ? `Enlace: ${task.url}` : null
      ]
        .filter(Boolean)
        .join('\n\n')
    );
    const location = encodeURIComponent(task.locationName || task.location?.address || '');

    // Formatear fechas para Google Calendar: YYYYMMDDTHHMMSSZ o YYYYMMDD
    let datesParam = '';
    const start = task.dueDate ? new Date(task.dueDate) : new Date();
    const durationMinutes = task.duration || 30;
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    const formatGCalDate = (d: Date) =>
      d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    datesParam = `${formatGCalDate(start)}/${formatGCalDate(end)}`;

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${datesParam}&details=${details}&location=${location}`;
  }

  public static generateGoogleCalendarUrl(task: TaskItem): string {
    return this.getGoogleCalendarUrl(task);
  }

  /**
   * Generates a Gmail search URL to find emails related to this reminder.
   */
  public static getGmailSearchUrl(task: TaskItem): string {
    const cleanTitle = (task.title || '')
      .replace(/^[\p{Emoji}\s⏳]+/gu, '')
      .replace(/[^\w\s\u00C0-\u017F]/gi, ' ')
      .trim();

    const query = encodeURIComponent(task.gmailQuery || cleanTitle);
    return `https://mail.google.com/mail/u/0/#search/${query}`;
  }

  public static generateGmailSearchUrl(taskOrTitle: TaskItem | string): string {
    if (typeof taskOrTitle === 'string') {
      const cleanTitle = taskOrTitle
        .replace(/^[\p{Emoji}\s⏳]+/gu, '')
        .replace(/[^\w\s\u00C0-\u017F]/gi, ' ')
        .trim();
      return `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(cleanTitle)}`;
    }
    return this.getGmailSearchUrl(taskOrTitle);
  }

  /**
   * Generates a mailto URL to draft an email directly referencing this task.
   */
  public static getMailtoUrl(task: TaskItem): string {
    const subject = encodeURIComponent(task.title || 'Recordatorio');
    const body = encodeURIComponent(
      [
        task.description ? `Detalles: ${task.description}` : null,
        task.dueDate ? `Fecha límite: ${new Date(task.dueDate).toLocaleDateString()}` : null
      ]
        .filter(Boolean)
        .join('\n')
    );
    return `mailto:?subject=${subject}&body=${body}`;
  }

  /**
   * Formats a collection of tasks into a Notion-compatible Markdown database table.
   * Notion allows directly pasting Markdown tables into databases to auto-populate rows and columns.
   */
  public static exportToNotionMarkdown(tasks: TaskItem[], listName: string = 'Recordatorios'): string {
    const header = `# ${listName}\n\n| Nombre | Estado | Prioridad | Fecha | Duración | Notas |\n| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    const rows = tasks.map(t => {
      const cleanTitle = (t.title || '').replace(/\|/g, '-');
      const status = t.status === 'completed' ? 'Completada' : 'Pendiente';
      const priority = t.priority ? t.priority.toUpperCase() : 'NONE';
      const date = t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '-';
      const duration = t.duration ? `${t.duration} min` : '-';
      const notes = (t.description || '').replace(/[\n\r]+/g, ' ').replace(/\|/g, '-').slice(0, 80);
      return `| ${cleanTitle} | ${status} | ${priority} | ${date} | ${duration} | ${notes} |`;
    });

    return header + rows.join('\n');
  }

  /**
   * Exports tasks into Notion-compatible CSV format.
   */
  public static exportToNotionCsv(tasks: TaskItem[]): string {
    const headers = ['Name', 'Status', 'Priority', 'Due Date', 'Duration (min)', 'Notes', 'URL'];
    const escapeCsv = (val?: string | number | null) => {
      const str = String(val ?? '');
      return `"${str.replace(/"/g, '""')}"`;
    };

    const lines = tasks.map(t => [
      escapeCsv(t.title),
      escapeCsv(t.status === 'completed' ? 'Done' : 'To Do'),
      escapeCsv(t.priority || 'None'),
      escapeCsv(t.dueDate || ''),
      escapeCsv(t.duration || ''),
      escapeCsv(t.description || ''),
      escapeCsv(t.url || t.notionPageUrl || '')
    ].join(','));

    return [headers.join(','), ...lines].join('\n');
  }

  /**
   * Triggers a browser download of the Notion CSV export.
   */
  public static downloadNotionCsv(tasks: TaskItem[], filename: string = 'notion_recordatorios.csv') {
    const csvContent = this.exportToNotionCsv(tasks);
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
