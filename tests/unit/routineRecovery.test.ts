import { describe, expect, it } from 'vitest';
import type { TaskItem } from '../../src/models/Task';
import { buildRoutineRecovery } from '../../src/utils/routineRecovery';

const now = new Date(2026, 9, 10, 12);
const previousWeek = new Date(2026, 8, 30, 12).getTime();
const currentWeek = new Date(2026, 9, 7, 12).getTime();
const lists = [{ id: 'clean', name: 'Limpieza', color: '#000' }];
const sections = [{ id: 'kitchen', listId: 'clean', name: 'Cocina' }];
const task = (id: string, extra: Partial<TaskItem> = {}): TaskItem => ({
  id, user_id: '', title: id, type: 'task', status: 'pending', categoryId: 'clean',
  sectionId: 'kitchen', cycle_id: 'cycle_week', version: 1,
  created_at: new Date(2026, 7, 1).toISOString(), updated_at: now.toISOString(), ...extra,
});
const build = (tasks: TaskItem[]) => buildRoutineRecovery(tasks, [], sections, lists, now);

describe('retomar rutinas por período y sección', () => {
  it('agrupa semanal y mensual sin mezclar períodos y ofrece la tarea más breve', () => {
    const groups = build([task('larga', { duration: 30 }), task('corta', { duration: 5 }), task('mensual', { cycle_id: 'cycle_month' })]);
    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe('Limpieza · Cocina');
    expect(groups[0].frequency).toBe('week');
    expect(groups[0].candidate.id).toBe('corta');
    expect(groups[0].periodStart).toEqual(new Date(2026, 8, 28));
    expect(groups[1].frequency).toBe('month');
    expect(groups[1].periodStart).toEqual(new Date(2026, 8, 1));
  });
  it('no insiste tras una omisión explícita anterior ni tras resolver el período actual', () => {
    expect(build([
      task('omitida antes', { skipHistory: [previousWeek] }),
      task('hecha antes', { completionHistory: [previousWeek] }),
      task('hecha ahora', { completionHistory: [currentWeek] }),
      task('omitida ahora', { skipHistory: [currentWeek] }),
    ])).toEqual([]);
  });
  it('no interpreta como incumplimiento los períodos anteriores a la creación ni desconocidos', () => {
    expect(build([
      task('nueva', { created_at: new Date(2026, 9, 6).toISOString() }),
      task('sin fecha', { created_at: '' }), task('eliminada', { deleted_at: now.toISOString() }),
    ])).toEqual([]);
  });
  it('solo sugiere dos secciones y leer no escribe omisiones en el historial', () => {
    const tasks = [task('a'), task('b', { sectionId: 'bath' }), task('c', { sectionId: 'bed' })];
    const snapshot = JSON.stringify(tasks);
    expect(build(tasks)).toHaveLength(2);
    expect(JSON.stringify(tasks)).toBe(snapshot);
    expect(tasks.every(item => item.skipHistory === undefined)).toBe(true);
  });
});
