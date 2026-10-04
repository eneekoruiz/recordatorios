import { describe, it, expect } from 'vitest';
import { IntegrationService } from '../../src/services/IntegrationService';
import type { TaskItem } from '../../src/models/Task';

describe('IntegrationService', () => {
  const mockTask: TaskItem = {
    id: 't-123',
    title: 'Comprar café en grano',
    description: 'De especialidad, tueste natural',
    dueDate: '2026-10-10T10:00:00.000Z',
    duration: 25,
    locationName: 'Tostador Central',
    priority: 'high',
    status: 'pending',
    created_at: '2026-10-01T08:00:00.000Z'
  };

  describe('Google Calendar Integration', () => {
    it('genera una URL de plantilla válida para Google Calendar', () => {
      const url = IntegrationService.getGoogleCalendarUrl(mockTask);
      expect(url).toContain('https://calendar.google.com/calendar/render?action=TEMPLATE');
      expect(url).toContain('text=Comprar%20caf%C3%A9%20en%20grano');
      expect(url).toContain('location=Tostador%20Central');
      expect(url).toContain('dates=');
    });

    it('el alias generateGoogleCalendarUrl produce el mismo resultado', () => {
      expect(IntegrationService.generateGoogleCalendarUrl(mockTask)).toEqual(
        IntegrationService.getGoogleCalendarUrl(mockTask)
      );
    });
  });

  describe('Gmail Integration', () => {
    it('genera una URL de búsqueda de Gmail a partir del título', () => {
      const url = IntegrationService.getGmailSearchUrl(mockTask);
      expect(url).toContain('https://mail.google.com/mail/u/0/#search/');
      expect(url).toContain('caf');
    });

    it('soporta llamar a generateGmailSearchUrl con un string', () => {
      const url = IntegrationService.generateGmailSearchUrl('Factura de luz');
      expect(url).toContain('https://mail.google.com/mail/u/0/#search/');
      expect(url).toContain('Factura');
    });
  });

  describe('Mailto Integration', () => {
    it('genera un enlace mailto con asunto y cuerpo', () => {
      const url = IntegrationService.getMailtoUrl(mockTask);
      expect(url).toContain('mailto:?subject=Comprar%20caf%C3%A9%20en%20grano');
      expect(url).toContain('body=');
    });
  });

  describe('Notion Export', () => {
    it('genera una tabla Markdown compatible con Notion', () => {
      const md = IntegrationService.exportToNotionMarkdown([mockTask], 'Compras');
      expect(md).toContain('# Compras');
      expect(md).toContain('| Nombre | Estado | Prioridad | Fecha | Duración | Notas |');
      expect(md).toContain('| Comprar café en grano | Pendiente | HIGH |');
      expect(md).toContain('25 min');
    });

    it('genera un archivo CSV formateado y escapado para Notion', () => {
      const csv = IntegrationService.exportToNotionCsv([mockTask]);
      expect(csv).toContain('Name,Status,Priority,Due Date,Duration (min),Notes,URL');
      expect(csv).toContain('"Comprar café en grano"');
      expect(csv).toContain('"To Do"');
      expect(csv).toContain('"high"');
    });
  });
});
