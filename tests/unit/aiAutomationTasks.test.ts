import { describe, it, expect } from 'vitest';
import { AIService } from '../../src/services/AIService';
import type { CustomList, TaskItem } from '../../src/models/Task';

describe('AI Automation & Task Execution Differentiation', () => {
  const lists: CustomList[] = [
    { id: 'l_sistema', name: 'Mantenimiento y Sistema', listType: 'routines', color: '#0a84ff', order: 0 }
  ];

  const tasks: TaskItem[] = [
    {
      id: 'task_winget',
      user_id: 'user_1',
      title: 'Actualizar software con winget upgrade --all',
      status: 'pending',
      type: 'task',
      created_at: '2026-11-01T08:00:00.000Z',
      updated_at: '2026-11-01T08:00:00.000Z',
      version: 1,
      canAiExecute: true
    },
    {
      id: 'task_cache',
      user_id: 'user_1',
      title: 'Limpiar caché y archivos temporales',
      status: 'completed',
      completedBy: 'ai',
      type: 'task',
      created_at: '2026-11-01T08:00:00.000Z',
      updated_at: '2026-11-01T08:00:00.000Z',
      version: 1
    },
    {
      id: 'task_manual',
      user_id: 'user_1',
      title: 'Limpiar el horno a fondo',
      status: 'completed',
      completedBy: 'user',
      type: 'task',
      created_at: '2026-11-01T08:00:00.000Z',
      updated_at: '2026-11-01T08:00:00.000Z',
      version: 1
    }
  ];

  it('detecta tareas automatizables y devuelve balance y propuesta de ejecución por la IA', () => {
    const res = AIService.localSemanticExtract('¿Qué tareas puedes hacer por mí?', lists, tasks);
    expect(res.reply).toContain('Balance de tareas técnicas y automatizaciones');
    expect(res.reply).toContain('Actualizar software con winget');
    expect(res.reply).toContain('Hechas por la IA');
    expect(res.reply).toContain('Limpiar caché y archivos temporales');
    expect(res.taskUpdates).toBeDefined();
    expect(res.taskUpdates?.length).toBeGreaterThan(0);
    expect(res.taskUpdates?.[0].taskId).toBe('task_winget');
    expect(res.taskUpdates?.[0].completedBy).toBe('ai');
  });

  it('distingue autoría en el resumen mensual', async () => {
    const summary = await AIService.generateMonthlySummary(tasks, 'noviembre');
    expect(summary).toContain('Asistencia digital');
    expect(summary).toContain('autónoma por la IA');
    expect(summary).toContain('completada');
  });
});
