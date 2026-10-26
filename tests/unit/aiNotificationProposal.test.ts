import { afterEach, describe, expect, it, vi } from 'vitest';
import { AIService } from '../../src/services/AIService';

afterEach(() => vi.useRealTimers());

describe('notification test proposals', () => {
  it('preserves the requested time and asks for confirmation instead of claiming delivery', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-26T12:00:00+01:00'));
    const batch = AIService.localSemanticExtract('Quiero probar las notificaciones mañana a las 9', [], []);
    expect(batch.tasks).toHaveLength(1);
    expect(batch.tasks[0].title).toBe('Prueba de notificaciones');
    expect(batch.tasks[0].alerts?.[0]).toMatchObject({ type: 'at_time', time: '09:00' });
    expect(batch.reply).toMatch(/confirmarlo/);
    expect(batch.reply).not.toMatch(/he programado|dentro de un minuto|te saltará/i);
  });

  it('does not invent a one-minute schedule when no time was requested', () => {
    const batch = AIService.localSemanticExtract('Quiero probar las notificaciones', [], []);
    expect(batch.tasks).toHaveLength(1);
    expect(batch.reply).toMatch(/Revisa la fecha y el aviso/);
    expect(batch.reply).not.toMatch(/he programado|dentro de un minuto|te saltará/i);
  });
});
