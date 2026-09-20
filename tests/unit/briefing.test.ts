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
});
