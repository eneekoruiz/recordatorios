import { describe, it, expect } from 'vitest';
import { planNotifications, zonedTimeToUtc, alertFireTimes } from '../../server/notifications.js';

const TZ = 'Europe/Madrid';
// Sábado 26 de septiembre de 2026, 9:05 en Madrid (7:05 UTC, horario de verano)
const saturday905 = new Date('2026-09-26T07:05:00Z');

const daily = (id) => ({ id, title: `Diaria ${id}`, cycle_id: 'cycle_day', status: 'pending' });
const weekly = (id) => ({ id, title: `Semanal ${id}`, cycle_id: 'cycle_week', status: 'pending' });

describe('resumen del día (sin saturar)', () => {
  it('manda un único resumen a partir de la hora elegida y no lo repite', () => {
    const tasks = [daily('a'), daily('b')];
    const first = planNotifications({ tasks, prefs: { timeZone: TZ, weeklyDay: 1 }, now: saturday905 });
    expect(first.messages).toHaveLength(1);
    expect(first.messages[0].title).toBe('Completa tus recordatorios diarios');
    expect(first.messages[0].body).toBe('Pendientes: 2 diarios.');
    const again = planNotifications({ tasks, prefs: { timeZone: TZ, weeklyDay: 1 }, now: new Date(saturday905.getTime() + 600_000), sentLog: first.sentLog });
    expect(again.messages).toHaveLength(0);
  });

  it('antes de la hora del resumen no manda nada', () => {
    const early = new Date('2026-09-26T05:30:00Z'); // 7:30 en Madrid
    expect(planNotifications({ tasks: [daily('a')], prefs: { timeZone: TZ }, now: early }).messages).toHaveLength(0);
  });

  it('en su día semanal avisa de los semanales junto a los diarios', () => {
    const r = planNotifications({ tasks: [daily('a'), weekly('b'), weekly('c')], prefs: { timeZone: TZ, weeklyDay: 6 }, now: saturday905 });
    expect(r.messages).toHaveLength(1);
    expect(r.messages[0].title).toBe('Hoy te tocan los recordatorios semanales');
    expect(r.messages[0].body).toBe('Pendientes: 2 semanales y 1 diario.');
  });

  it('el día 1 toca la ronda mensual y el 1 de enero la anual', () => {
    const tasks = [{ id: 'm', title: 'Mensual', cycle_id: 'cycle_month' }, { id: 'y', title: 'Anual', cycle_id: 'cycle_year' }];
    const oct1 = new Date('2026-10-01T08:00:00Z');
    expect(planNotifications({ tasks, prefs: { timeZone: TZ }, now: oct1 }).messages[0].title).toBe('Hoy toca la ronda mensual');
    const jan1 = new Date('2027-01-01T09:00:00Z');
    expect(planNotifications({ tasks, prefs: { timeZone: TZ }, now: jan1 }).messages[0].title).toBe('Hoy toca la revisión anual');
  });

  it('no avisa de lo completado ni si no hay nada', () => {
    const done = { ...daily('a'), status: 'completed' };
    expect(planNotifications({ tasks: [done], prefs: { timeZone: TZ }, now: saturday905 }).messages).toHaveLength(0);
  });
});

describe('alertas con hora', () => {
  it('suena la alerta de la hora elegida en la zona horaria del usuario', () => {
    const task = { id: 't', title: 'Llamar al médico', dueDate: '2026-09-26T08:00:00Z', alerts: [{ id: '1', type: 'at_time', time: '10:30' }] };
    const at = zonedTimeToUtc(2026, 9, 26, 10, 30, TZ);
    expect(at.toISOString()).toBe('2026-09-26T08:30:00.000Z');
    const r = planNotifications({ tasks: [task], prefs: { timeZone: TZ }, now: new Date('2026-09-26T08:31:00Z'), since: new Date('2026-09-26T08:21:00Z'), sentLog: { digest: '2026-09-26' } });
    expect(r.messages).toEqual([expect.objectContaining({ title: 'Recordatorio', body: 'Llamar al médico' })]);
  });

  it('agrupa varias alertas de la misma pasada en una sola notificación', () => {
    const mk = (id, title) => ({ id, title, dueDate: '2026-09-27T08:00:00Z', alerts: [{ id, type: 'before', offsetMinutes: 60 }] });
    const r = planNotifications({
      tasks: [mk('a', 'Pan'), mk('b', 'Leche'), mk('c', 'Huevos'), mk('d', 'Café')],
      prefs: { timeZone: TZ },
      now: new Date('2026-09-27T07:05:00Z'),
      since: new Date('2026-09-27T06:55:00Z'),
      sentLog: { digest: '2026-09-27' },
    });
    expect(r.messages).toHaveLength(1);
    expect(r.messages[0].title).toBe('4 recordatorios');
    expect(r.messages[0].body).toBe('Pan, Leche, Huevos y 1 más');
  });

  it('no dispara alertas antiguas en tromba tras mucho tiempo sin ejecutarse', () => {
    const task = { id: 't', title: 'Viejo', dueDate: '2026-09-20T08:00:00Z', alerts: [{ id: '1', type: 'at_time', time: '10:00' }] };
    const r = planNotifications({ tasks: [task], prefs: { timeZone: TZ }, now: saturday905, since: new Date('2026-09-01T00:00:00Z'), sentLog: { digest: '2026-09-26' } });
    expect(r.messages).toHaveLength(0);
  });

  it('las diarias sin fecha suenan cada día a su hora', () => {
    const task = { id: 't', title: 'Pastillas', cycle_id: 'cycle_day', alerts: [{ id: '1', type: 'at_time', time: '09:00' }] };
    const times = alertFireTimes(task, TZ, new Date('2026-09-26T06:55:00Z'), new Date('2026-09-26T07:05:00Z'));
    expect(times.map((t) => t.toISOString())).toEqual(['2026-09-26T07:00:00.000Z']);
  });

  it('respeta el cambio de hora de invierno', () => {
    expect(zonedTimeToUtc(2026, 11, 2, 9, 0, TZ).toISOString()).toBe('2026-11-02T08:00:00.000Z');
  });
});
