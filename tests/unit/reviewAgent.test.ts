import { describe, it, expect } from 'vitest';
import { ReviewAgentService } from '../../src/services/ReviewAgentService';
import type { TaskItem } from '../../src/models/Task';

describe('ReviewAgentService', () => {
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
});
