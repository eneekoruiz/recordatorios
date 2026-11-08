import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isTaskCompleted } from '../../src/store/useAppStore';
import { getTaskPeriodicity, getEffectiveCycleId } from '../../shared/periodicity.js';
import type { TaskItem, ListSection, CustomList } from '../../src/models/Task';

describe('Renovación semanal de gimnasio y detección de periodicidad', () => {
  // Lunes 9 de noviembre de 2026, 10:00 AM
  const FIXED_NOW = new Date('2026-11-09T10:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const sections: ListSection[] = [
    { id: 'sec_gym_diaria', listId: 'gimnasio', name: 'Diaria: Core y Estiramientos', order: 0 },
    { id: 'sec_gym_sup_a', listId: 'gimnasio', name: 'Día 1: Tren Superior A', order: 1 },
    { id: 'sec_gym_inf_a', listId: 'gimnasio', name: 'Día 2: Tren Inferior A', order: 2 },
  ];

  const lists: CustomList[] = [
    { id: 'gimnasio', name: 'Gimnasio', color: '#2997ff' }
  ];

  it('detecta periodicidad semanal para ejercicios en secciones de entrenamiento del gimnasio', () => {
    const pressBanca: TaskItem = {
      id: 'task_press',
      title: 'Press de banca en máquina',
      categoryId: 'gimnasio',
      sectionId: 'sec_gym_sup_a',
      targetCount: 4,
      currentCount: 0,
      user_id: 'u1',
      type: 'task',
      status: 'pending'
    };

    expect(getTaskPeriodicity(pressBanca, sections, lists)).toBe('week');
    expect(getEffectiveCycleId(pressBanca, sections, lists)).toBe('cycle_week');
  });

  it('detecta periodicidad diaria para ejercicios de la sección diaria del gimnasio', () => {
    const abs: TaskItem = {
      id: 'task_abs',
      title: 'Abdominales y core',
      categoryId: 'gimnasio',
      sectionId: 'sec_gym_diaria',
      targetCount: 3,
      currentCount: 0,
      user_id: 'u1',
      type: 'task',
      status: 'pending'
    };

    expect(getTaskPeriodicity(abs, sections, lists)).toBe('day');
    expect(getEffectiveCycleId(abs, sections, lists)).toBe('cycle_day');
  });

  it('una tarea de sentadillas completada hace 3 semanas NO figura como completada en la semana actual', () => {
    // Hace 3 semanas: 19 de octubre de 2026
    const threeWeeksAgo = new Date('2026-10-19T11:00:00.000Z');

    const sentadillas: TaskItem = {
      id: 'task_gym_2_sentadilla',
      title: 'Sentadilla Jaca',
      categoryId: 'gimnasio',
      sectionId: 'sec_gym_inf_a',
      cycle_id: 'cycle_week',
      targetCount: 4,
      currentCount: 4, // Las 4 series hechas hace 3 semanas
      status: 'completed',
      completionHistory: [threeWeeksAgo.getTime()],
      updated_at: threeWeeksAgo.toISOString(),
      user_id: 'u1',
      type: 'task'
    };

    // Para la semana actual (9 de noviembre), la tarea debe figurar como PENDIENTE (no completada)
    expect(isTaskCompleted(sentadillas, FIXED_NOW)).toBe(false);
  });

  it('si la semana pasada no fue al gimnasio, la tarea sigue estando pendiente para la semana en curso', () => {
    // La semana pasada: 2 de noviembre de 2026 (sin entrenar)
    // Última vez que fue: hace 2 semanas (26 de octubre de 2026)
    const twoWeeksAgo = new Date('2026-10-26T11:00:00.000Z');

    const sentadillas: TaskItem = {
      id: 'task_gym_2_sentadilla',
      title: 'Sentadilla Jaca',
      categoryId: 'gimnasio',
      sectionId: 'sec_gym_inf_a',
      cycle_id: 'cycle_week',
      targetCount: 4,
      currentCount: 4,
      status: 'pending',
      completionHistory: [twoWeeksAgo.getTime()],
      updated_at: twoWeeksAgo.toISOString(),
      user_id: 'u1',
      type: 'task'
    };

    expect(isTaskCompleted(sentadillas, FIXED_NOW)).toBe(false);
  });

  it('cuando se completa en la semana en curso, figura como completada para esta semana', () => {
    const todayTimestamp = FIXED_NOW.getTime();

    const sentadillas: TaskItem = {
      id: 'task_gym_2_sentadilla',
      title: 'Sentadilla Jaca',
      categoryId: 'gimnasio',
      sectionId: 'sec_gym_inf_a',
      cycle_id: 'cycle_week',
      targetCount: 4,
      currentCount: 4,
      status: 'pending',
      completionHistory: [
        new Date('2026-10-19T11:00:00.000Z').getTime(), // Hace 3 semanas
        todayTimestamp // Completado hoy en la semana en curso
      ],
      updated_at: FIXED_NOW.toISOString(),
      user_id: 'u1',
      type: 'task'
    };

    expect(isTaskCompleted(sentadillas, FIXED_NOW)).toBe(true);
  });
});
