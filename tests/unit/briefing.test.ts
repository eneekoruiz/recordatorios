import { describe, it, expect } from 'vitest';
import { buildDailyBriefing } from '../../src/services/DailyBriefingService';
import type { TaskItem } from '../../src/models/Task';

const at = (hour: number) => {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d;
};
const task = (over: Partial<TaskItem>): TaskItem => ({
  id: Math.random().toString(36).slice(2),
  user_id: '',
  type: 'task',
  title: 'Tarea',
  status: 'pending',
  version: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...over,
} as TaskItem);

const build = (tasks: TaskItem[], opts = {}) =>
  buildDailyBriefing(Object.fromEntries(tasks.map((t) => [t.id, t])), [], { now: at(10), ...opts });

describe('resumen del día', () => {
  it('saluda según la hora', () => {
    expect(build([], { now: at(9) }).greeting).toBe('Buenos días');
    expect(build([], { now: at(16) }).greeting).toBe('Buenas tardes');
    expect(build([], { now: at(22) }).greeting).toBe('Buenas noches');
  });

  it('incluye el nombre cuando se conoce', () => {
    expect(build([], { name: 'Eneko' }).greeting).toBe('Buenos días, Eneko');
  });

  it('redacta en español natural, sin "(s)"', () => {
    const today = at(12).toISOString();
    const one = build([task({ title: 'Llamar', dueDate: today })]);
    expect(one.headline).toBe('Tienes una tarea para hoy.');

    const many = build([
      task({ title: 'A', dueDate: today, priority: 'high' }),
      task({ title: 'B', dueDate: today }),
      task({ title: 'C', dueDate: today }),
    ]);
    expect(many.headline).toBe('Tienes tres tareas para hoy.');
    expect(many.detail).toBe('Una es urgente.');
    expect(`${many.headline} ${many.detail}`).not.toContain('(s)');
  });

  it('propone por dónde empezar priorizando lo urgente', () => {
    const today = at(12).toISOString();
    const briefing = build([
      task({ title: 'Normal', dueDate: today }),
      task({ title: 'Urgente', dueDate: today, priority: 'high' }),
    ]);
    expect(briefing.focus[0].title).toBe('Urgente');
    expect(briefing.focus).toHaveLength(2);
  });

  it('un día sin nada no merece interrumpir', () => {
    expect(build([]).isQuiet).toBe(true);
    expect(build([task({ title: 'Hoy', dueDate: at(12).toISOString() })]).isQuiet).toBe(false);
  });

  it('avisa de caducidades próximas', () => {
    const tomorrow = new Date(Date.now() + 20 * 3600 * 1000).toISOString();
    const briefing = build([task({ title: 'Renovar DNI', dueDate: tomorrow, categoryId: 'caducidades' })]);
    expect(briefing.expiring.map((t) => t.title)).toEqual(['Renovar DNI']);
  });

  it('«urgentes» cuenta solo lo que toca hoy, y lo de hoy no es «diaria»', () => {
    const today = at(12).toISOString();
    const inTenDays = new Date(Date.now() + 10 * 86400000).toISOString();
    const briefing = build([
      task({ title: 'Análisis', dueDate: today }),
      task({ title: 'Fregar', cycle_id: 'cycle_day', priority: 'high' }),
      task({ title: 'Hacer la cama', cycle_id: 'cycle_day' }),
      task({ title: 'Dentista', dueDate: inTenDays, priority: 'high' }),
    ]);
    expect(briefing.pendingDaily.map((t) => t.title)).toEqual(['Fregar', 'Hacer la cama']);
    expect(briefing.highPriorityToday).toBe(1);
    expect(briefing.headline).toBe('Tienes una tarea para hoy y dos diarias.');
    expect(briefing.detail).toBe('Una es urgente.');
    expect(briefing.focus[0].title).toBe('Fregar');
    expect(briefing.focus.map((t) => t.title)).not.toContain('Dentista');
  });

  it('cuenta lo vencido y la ronda semanal en su día', () => {
    const yesterday = new Date(at(12).getTime() - 86400000).toISOString();
    const briefing = build([
      task({ title: 'Pagar multa', dueDate: yesterday }),
      task({ title: 'Aspirar', cycle_id: 'cycle_week' }),
      task({ title: 'Fregar', cycle_id: 'cycle_day' }),
    ], { weeklyDayOfWeek: at(10).getDay() });
    expect(briefing.headline).toBe('Hoy toca la ronda semanal: una semanal y una diaria.');
    expect(briefing.detail).toBe('Tienes una vencida.');
  });

  it('la guía de inicio no cuenta', () => {
    const briefing = build([task({ title: 'Prueba', categoryId: 'primeros_pasos', cycle_id: 'cycle_day' })]);
    expect(briefing.pendingDaily).toHaveLength(0);
    expect(briefing.isQuiet).toBe(true);
  });

  it('resuelve las omitidas de hoy sin presentarlas como completadas', () => {
    const briefing = build([task({ title: 'Omitida', cycle_id: 'cycle_day', skipHistory: [at(8).getTime()] })]);
    expect(briefing.pendingDaily).toHaveLength(0);
    expect(briefing.completedDailyToday).toBe(0);
    expect(briefing.habitsDone).toBe(0);
    expect(briefing.headline).not.toBe('Todo hecho por hoy.');
  });

  it('el resumen inicial usa las secciones y conecta el historial con retomar hoy', () => {
    const now = new Date(2026, 9, 10, 10);
    const briefing = build([task({ categoryId: 'limpieza', sectionId: 'cocina', cycle_id: 'cycle_week', created_at: new Date(2026, 7, 1).toISOString() })], {
      now, weeklyDayOfWeek: 1,
      lists: [{ id: 'limpieza', name: 'Limpieza', color: '#000' }],
      listSections: [{ id: 'cocina', listId: 'limpieza', name: 'Cocina' }],
    });
    expect(briefing.recovery[0].label).toBe('Limpieza · Cocina');
    expect(briefing.headline).toBe('Hoy puedes retomar una sección, a tu ritmo.');
    expect(briefing.isQuiet).toBe(false);
  });
});
