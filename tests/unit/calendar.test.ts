import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { TaskItem } from '../../src/models/Task';
import { addMonthsClamped, buildCalendar, dayKey, firstAlertTime, monthWeeks } from '../../src/utils/calendar';

// Sábado 26 de septiembre de 2026, 10:00 (hora local del entorno de pruebas)
const NOW = new Date(2026, 8, 26, 10, 0);

const task = (over: Partial<TaskItem>): TaskItem => ({
  id: over.id || Math.random().toString(36).slice(2),
  user_id: 'u',
  type: 'task',
  title: 'Tarea',
  status: 'pending',
  created_at: NOW.toISOString(),
  updated_at: NOW.toISOString(),
  version: 1,
  ...over,
});

const range = (from: Date, to: Date, tasks: TaskItem[], weeklyDay = 6) =>
  buildCalendar(tasks, { from, to, now: NOW, weeklyDay });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe('rejilla del mes', () => {
  it('empieza en lunes y usa tantas semanas como hagan falta', () => {
    const sept = monthWeeks(2026, 8);
    expect(sept).toHaveLength(5);
    expect(dayKey(sept[0][0])).toBe('2026-08-31');
    expect(dayKey(sept[4][6])).toBe('2026-10-04');
    expect(monthWeeks(2027, 1)).toHaveLength(4); // febrero de 2027 empieza en lunes
    expect(monthWeeks(2026, 10)).toHaveLength(6); // noviembre de 2026 empieza en domingo
  });

  it('suma meses sin desbordar', () => {
    expect(dayKey(addMonthsClamped(new Date(2027, 0, 31), 1))).toBe('2027-02-28');
    expect(dayKey(addMonthsClamped(new Date(2027, 0, 31), 2))).toBe('2027-03-31');
  });

  it('la hora es la del primer aviso a hora fija', () => {
    expect(firstAlertTime({ alerts: [{ id: 'a', type: 'at_time', time: '18:00' }, { id: 'b', type: 'at_time', time: '9:30' }] })).toBe('09:30');
    expect(firstAlertTime({ alerts: [{ id: 'a', type: 'before', offsetMinutes: 60 }] })).toBeNull();
  });
});

describe('qué toca cada día', () => {
  it('pone cada recordatorio con fecha en su día y marca los vencidos', () => {
    const tasks = [
      task({ id: 'cita', title: 'Dentista', dueDate: new Date(2026, 8, 28, 9).toISOString(), alerts: [{ id: '1', type: 'at_time', time: '09:00' }] }),
      task({ id: 'vieja', title: 'Pagar multa', dueDate: new Date(2026, 8, 20, 9).toISOString() }),
      task({ id: 'hecha', title: 'Renovar DNI', dueDate: new Date(2026, 8, 21, 9).toISOString(), status: 'completed' }),
      task({ id: 'borrada', title: 'Borrada', dueDate: new Date(2026, 8, 28, 9).toISOString(), deleted_at: NOW.toISOString() }),
    ];
    const days = range(new Date(2026, 8, 1), new Date(2026, 8, 30), tasks);
    expect(days.get('2026-09-28')?.items.map((i) => [i.task.title, i.time, i.overdue])).toEqual([['Dentista', '09:00', false]]);
    expect(days.get('2026-09-20')?.items[0]).toMatchObject({ overdue: true, done: false });
    expect(days.get('2026-09-21')?.items[0]).toMatchObject({ overdue: false, done: true });
  });

  it('proyecta las próximas renovaciones de las suscripciones', () => {
    const netflix = task({ id: 'nf', title: 'Netflix', expirationType: 'subscription', subscriptionPeriod: 'monthly', dueDate: new Date(2026, 8, 30, 12).toISOString() });
    const seguro = task({ id: 'sg', title: 'Seguro', autoRollover: true, subscriptionPeriod: 'yearly', dueDate: new Date(2026, 9, 15, 12).toISOString() });
    const days = range(new Date(2026, 8, 1), new Date(2027, 11, 31), [netflix, seguro]);
    expect(days.get('2026-09-30')?.items[0].kind).toBe('dated');
    expect(days.get('2026-10-30')?.items[0]).toMatchObject({ kind: 'renewal', task: netflix });
    expect(days.get('2027-02-28')?.items[0].task).toBe(netflix); // 30 de febrero no existe
    expect(days.get('2027-10-15')?.items[0]).toMatchObject({ kind: 'renewal', task: seguro });
    expect(days.get('2026-11-15')).toBeUndefined();
  });

  it('las rondas caen en su día y cuentan lo que quedará pendiente', () => {
    const tasks = [
      task({ id: 'd', title: '[D] Fregar', cycle_id: 'cycle_day' }),
      task({ id: 'w1', title: 'Aspirar', cycle_id: 'cycle_week' }),
      // Hecha el lunes de esta semana: hoy ya no toca, el sábado que viene sí.
      task({ id: 'w2', title: 'Baño', cycle_id: 'cycle_week', completionHistory: [new Date(2026, 8, 21, 11).getTime()] }),
      task({ id: 'm', title: 'Horno', cycle_id: 'cycle_month' }),
      task({ id: 'y', title: 'Colchón', cycle_id: 'cycle_year' }),
      task({ id: 'guia', title: '[S] Prueba', categoryId: 'primeros_pasos' }),
    ];
    const days = range(new Date(2026, 8, 1), new Date(2027, 0, 31), tasks);
    const rounds = (key: string) => days.get(key)?.rounds.map((r) => `${r.periodicity}:${r.pending}`) || [];
    expect(rounds('2026-09-25')).toEqual([]); // ayer: el pasado no se debe
    expect(rounds('2026-09-26')).toEqual(['week:1', 'day:1']);
    expect(rounds('2026-09-27')).toEqual(['day:1']);
    expect(rounds('2026-10-03')).toEqual(['month:1', 'week:2', 'day:1']); // primer sábado de octubre
    expect(rounds('2026-10-10')).toEqual(['week:2', 'day:1']);
    expect(rounds('2027-01-02')).toEqual(['year:1', 'month:1', 'week:2', 'day:1']); // primer sábado del año
  });

  it('respeta el día semanal elegido', () => {
    const tasks = [task({ id: 'w', title: 'Aspirar', cycle_id: 'cycle_week' })];
    const days = range(new Date(2026, 8, 26), new Date(2026, 9, 4), tasks, 1);
    expect(days.get('2026-09-26')?.rounds ?? []).toEqual([]);
    expect(days.get('2026-09-28')?.rounds).toEqual([{ periodicity: 'week', pending: 1 }]);
  });
});
