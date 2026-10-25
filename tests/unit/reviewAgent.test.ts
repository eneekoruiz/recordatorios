import { describe, it, expect, vi, afterEach } from 'vitest';
import { ReviewAgentService } from '../../src/services/ReviewAgentService';
import type { TaskItem } from '../../src/models/Task';

describe('ReviewAgentService', () => {
  afterEach(() => vi.useRealTimers());
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  it('audita correctamente tareas completadas, estancadas y vencidas', () => {
    const tasks: Record<string, TaskItem> = {
      t1: {
        id: 't1',
        title: 'Presentar declaración',
        status: 'completed',
        completed_at: threeDaysAgo,
        duration: 30,
        created_at: tenDaysAgo
      },
      t2: {
        id: 't2',
        title: 'Llevar coche al taller',
        status: 'pending',
        dueDate: yesterday, // Vencida
        created_at: threeDaysAgo
      },
      t3: {
        id: 't3',
        title: 'Pintar habitación de invitados',
        status: 'pending',
        created_at: tenDaysAgo, // Estancada (>7 días)
        postponeCount: 0
      },
      t4: {
        id: 't4',
        title: 'Renovar pasaporte',
        status: 'pending',
        created_at: threeDaysAgo,
        postponeCount: 2 // Estancada por postergaciones
      },
      t5: {
        id: 't5',
        title: 'Beber agua',
        categoryId: 'habitos_vitales',
        status: 'completed',
        created_at: tenDaysAgo
      },
      t6: {
        id: 't6',
        title: 'Comer sano',
        categoryId: 'habitos_vitales',
        status: 'pending',
        created_at: tenDaysAgo
      }
    };

    const audit = ReviewAgentService.generateWeeklyAudit(tasks);

    // 1. Completadas
    expect(audit.completedCount).toBe(2); // t1 + t5
    expect(audit.completedTasks.some(t => t.id === 't1')).toBe(true);

    // 2. Vencidas
    expect(audit.overdueTasks.length).toBe(1);
    expect(audit.overdueTasks[0].id).toBe('t2');

    // 3. Estancadas (excluye hábitos vitales)
    expect(audit.staleTasks.length).toBe(2);
    expect(audit.staleTasks.map(t => t.id).sort()).toEqual(['t3', 't4']);

    // 4. Cumplimiento de hábitos vitales (1 de 2 = 50%)
    expect(audit.vitalHabitsCompliancePercent).toBe(50);

    // 5. Recomendaciones generadas
    expect(audit.recommendations.length).toBeGreaterThan(0);
    expect(audit.recommendations.some(r => r.includes('vencida'))).toBe(true);
  });

  it('conserva logros y duración de rutinas renovadas, sin duplicar una tarea por sus marcas', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-26T12:00:00+01:00'));
    const routine = {
      id: 'weekly', title: 'Limpiar muebles', status: 'pending', cycle_id: 'cycle_week',
      duration: 30, currentCount: 0, targetCount: 2, created_at: '2026-09-01T10:00:00Z',
      completionHistory: [new Date('2026-10-24T12:00:00+02:00').getTime(), new Date('2026-10-25T12:00:00+01:00').getTime()],
    } as TaskItem;
    const report = ReviewAgentService.generateWeeklyAudit({ weekly: routine });
    expect(report.completedCount).toBe(1);
    expect(report.completedMinutes).toBe(30);
    expect(report.topAchievements).toEqual(['Limpiar muebles']);
    expect(report.staleTasks).toEqual([]);
  });

  it('excluye marcas futuras, antiguas, inválidas, omisiones y tareas eliminadas', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-26T12:00:00+01:00'));
    const task = (id: string, extra: Partial<TaskItem>): TaskItem => ({
      id, title: id, status: 'pending', cycle_id: 'cycle_week', duration: 15,
      created_at: '2026-09-01T10:00:00Z', ...extra,
    } as TaskItem);
    const report = ReviewAgentService.generateWeeklyAudit({
      old: task('old', { completionHistory: [new Date('2026-10-18T12:00:00Z').getTime()] }),
      future: task('future', { status: 'completed', completed_at: '2026-10-27T12:00:00Z' }),
      invalid: task('invalid', { completionHistory: [NaN] }),
      skipped: task('skipped', { skipHistory: [Date.now()] }),
      deleted: task('deleted', { completionHistory: [Date.now()], deleted_at: new Date().toISOString() }),
    });
    expect(report.completedCount).toBe(0);
    expect(report.completedMinutes).toBe(0);
    expect(report.staleTasks).toEqual([]);
  });

  it('mantiene el límite de siete días naturales a través del cambio de hora', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 26, 12));
    const boundary = new Date(2026, 9, 19, 12).getTime();
    const report = ReviewAgentService.generateWeeklyAudit({
      at: { id: 'at', title: 'En el límite', status: 'pending', cycle_id: 'cycle_day', duration: 10, completionHistory: [boundary] } as TaskItem,
      before: { id: 'before', title: 'Anterior', status: 'pending', cycle_id: 'cycle_day', duration: 20, completionHistory: [boundary - 1] } as TaskItem,
    });
    expect(report.weekStartDate.getTime()).toBe(boundary);
    expect(report.completedTasks.map(task => task.id)).toEqual(['at']);
    expect(report.completedMinutes).toBe(10);
  });

  it('no suma dos veces el tiempo de un bloque y sus subtareas completadas', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-26T12:00:00+01:00'));
    const mark = new Date('2026-10-24T10:00:00Z').getTime();
    const report = ReviewAgentService.generateWeeklyAudit({
      parent: { id: 'parent', title: 'Limpiar cocina', status: 'pending', cycle_id: 'cycle_week', duration: 40, completionHistory: [mark] } as TaskItem,
      child: { id: 'child', title: 'Encimera', parentId: 'parent', status: 'pending', cycle_id: 'cycle_week', duration: 10, completionHistory: [mark] } as TaskItem,
    });
    expect(report.completedCount).toBe(2);
    expect(report.completedMinutes).toBe(40);
  });
});
