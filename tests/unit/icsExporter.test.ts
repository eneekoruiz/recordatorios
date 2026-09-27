import { describe, it, expect } from 'vitest';
import { generateIcsCalendar } from '../../src/utils/icsExporter';
import { TaskItem } from '../../src/models/Task';

describe('icsExporter', () => {
  it('genera un archivo iCalendar válido con cabeceras estándar RFC 5545', () => {
    const ics = generateIcsCalendar([], 'Mi Calendario');
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('X-WR-CALNAME:Mi Calendario');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('exporta tareas VTODO y eventos VEVENT para tareas con fecha', () => {
    const tasks: TaskItem[] = [
      {
        id: 'task-1',
        user_id: 'user-1',
        title: 'Revisión médica',
        description: 'Llevar analíticas previas, ayunas.',
        type: 'task',
        status: 'pending',
        priority: 'high',
        dueDate: '2026-10-15T09:30:00.000Z',
        duration: 2700, // 45 minutos
      },
      {
        id: 'task-2',
        user_id: 'user-1',
        title: 'Comprar pan',
        type: 'task',
        status: 'completed',
        priority: 'none',
      }
    ];

    const ics = generateIcsCalendar(tasks, 'Tareas');
    expect(ics).toContain('BEGIN:VTODO');
    expect(ics).toContain('SUMMARY:Revisión médica');
    expect(ics).toContain('DESCRIPTION:Llevar analíticas previas\\, ayunas.');
    expect(ics).toContain('PRIORITY:1');
    expect(ics).toContain('STATUS:NEEDS-ACTION');

    // Comprobar que genera VEVENT con fecha de fin calculada por duración
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('DTSTART:20261015T093000Z');
    expect(ics).toContain('DTEND:20261015T101500Z');

    // Tarea 2 (completada, sin fecha)
    expect(ics).toContain('SUMMARY:Comprar pan');
    expect(ics).toContain('STATUS:COMPLETED');
  });

  it('escapa caracteres especiales como comas, punto y coma y saltos de línea', () => {
    const tasks: TaskItem[] = [
      {
        id: 'task-special',
        user_id: 'user-1',
        title: 'Reunión: Pedro; María, y Juan',
        description: 'Línea 1\nLínea 2',
        type: 'task',
        status: 'pending',
      }
    ];

    const ics = generateIcsCalendar(tasks);
    expect(ics).toContain('SUMMARY:Reunión: Pedro\\; María\\, y Juan');
    expect(ics).toContain('DESCRIPTION:Línea 1\\nLínea 2');
  });
});
