import { describe, it, expect } from 'vitest';
import { hasGenuineGymProgress, isGymDayFullyDone, getActiveGymDaySectionId } from '../../src/utils/gymAdaptiveDay';
import type { TaskItem, ListSection } from '../../src/models/Task';

describe('Gimnasio - Días flexibles y detección adaptativa', () => {
  const sections: ListSection[] = [
    { id: 'sec_dia_1', listId: 'gimnasio', name: 'Día 1: Tren Superior A', order: 1 },
    { id: 'sec_dia_2', listId: 'gimnasio', name: 'Día 2: Tren Inferior A', order: 2 },
    { id: 'sec_dia_3', listId: 'gimnasio', name: 'Día 3: Tren Superior B', order: 3 },
    { id: 'sec_dia_4', listId: 'gimnasio', name: 'Día 4: Tren Inferior B', order: 4 },
  ];

  it('no marca como empezado si el usuario solo tiene 1 serie de 1 ejercicio multi-serie (toque accidental)', () => {
    const tasks: TaskItem[] = [
      {
        id: 't1',
        title: 'Press de banca',
        sectionId: 'sec_dia_1',
        targetCount: 4,
        currentCount: 1, // Solo 1 serie
        status: 'pending'
      } as any,
      {
        id: 't2',
        title: 'Remo con barra',
        sectionId: 'sec_dia_1',
        targetCount: 4,
        currentCount: 0,
        status: 'pending'
      } as any
    ];

    expect(hasGenuineGymProgress(tasks)).toBe(false);
  });

  it('sí marca como empezado si tiene al menos 2 series de un ejercicio multi-serie', () => {
    const tasks: TaskItem[] = [
      {
        id: 't1',
        title: 'Press de banca',
        sectionId: 'sec_dia_1',
        targetCount: 4,
        currentCount: 2, // 2 series
        status: 'pending'
      } as any
    ];

    expect(hasGenuineGymProgress(tasks)).toBe(true);
  });

  it('sí marca como empezado si completa un ejercicio de serie única (ej: cardio)', () => {
    const tasks: TaskItem[] = [
      {
        id: 't_cardio',
        title: 'Cardio final',
        sectionId: 'sec_dia_1',
        targetCount: 1,
        currentCount: 1,
        status: 'completed'
      } as any
    ];

    expect(hasGenuineGymProgress(tasks)).toBe(true);
  });

  it('se adapta inmediatamente si el usuario decide hacer el Día 2 en vez del Día 1', () => {
    const now = Date.now();
    const tasks: TaskItem[] = [
      // Día 1: Sin tocar
      { id: 'd1_t1', sectionId: 'sec_dia_1', title: 'Press banca', targetCount: 4, currentCount: 0, status: 'pending' } as any,
      // Día 2: El usuario empezó hoy e hizo 2 series de Sentadilla Jaca
      { id: 'd2_t1', sectionId: 'sec_dia_2', title: 'Sentadilla Jaca', targetCount: 4, currentCount: 2, status: 'pending', updated_at: new Date(now).toISOString() } as any,
      { id: 'd2_t2', sectionId: 'sec_dia_2', title: 'Curl femoral', targetCount: 4, currentCount: 0, status: 'pending' } as any,
    ];

    const activeId = getActiveGymDaySectionId(sections, tasks, null, now);
    expect(activeId).toBe('sec_dia_2');
  });

  it('no cambia al Día 2 si en el Día 2 solo hubo 1 serie accidental, manteniendo el día correspondiente', () => {
    const now = Date.now();
    const tasks: TaskItem[] = [
      // Día 1: Sin tocar
      { id: 'd1_t1', sectionId: 'sec_dia_1', title: 'Press banca', targetCount: 4, currentCount: 0, status: 'pending' } as any,
      // Día 2: 1 serie accidental
      { id: 'd2_t1', sectionId: 'sec_dia_2', title: 'Sentadilla Jaca', targetCount: 4, currentCount: 1, status: 'pending', updated_at: new Date(now).toISOString() } as any,
    ];

    const activeId = getActiveGymDaySectionId(sections, tasks, null, now);
    expect(activeId).toBe('sec_dia_1');
  });

  it('identifica correctamente cuando un día de gimnasio está completado al 100%', () => {
    const tasksDone: TaskItem[] = [
      { id: 't1', user_id: 'u1', type: 'task', title: 'Press', sectionId: 'sec_dia_1', status: 'completed' },
      { id: 't2', user_id: 'u1', type: 'task', title: 'Remo', sectionId: 'sec_dia_1', status: 'completed' },
    ];
    const tasksPending: TaskItem[] = [
      { id: 't1', user_id: 'u1', type: 'task', title: 'Press', sectionId: 'sec_dia_1', status: 'pending' },
    ];
    expect(isGymDayFullyDone(tasksDone)).toBe(true);
    expect(isGymDayFullyDone(tasksPending)).toBe(false);
  });

  it('cuenta como terminado un día si se hizo >= 75% aunque falte alguna serie por falta de tiempo', () => {
    const tasksAlmostDone: TaskItem[] = [
      { id: 't1', user_id: 'u1', type: 'task', title: 'Jaca', sectionId: 'sec_dia_2', targetCount: 4, currentCount: 4, status: 'completed' },
      { id: 't2', user_id: 'u1', type: 'task', title: 'Femoral', sectionId: 'sec_dia_2', targetCount: 4, currentCount: 4, status: 'completed' },
      { id: 't3', user_id: 'u1', type: 'task', title: 'Glúteo', sectionId: 'sec_dia_2', targetCount: 3, currentCount: 3, status: 'completed' },
      // Falta solo 1 serie en extensiones porque se acabó el tiempo
      { id: 't4', user_id: 'u1', type: 'task', title: 'Extensiones', sectionId: 'sec_dia_2', targetCount: 3, currentCount: 2, status: 'pending' },
    ];
    expect(isGymDayFullyDone(tasksAlmostDone)).toBe(true);
  });

  it('si el Día 2 se hizo ayer casi entero, hoy propone el Día 3 y no vuelve a insistir en el Día 2', () => {
    const today = new Date('2026-10-30T10:00:00.000Z').getTime();
    const yesterdayIso = new Date('2026-10-29T18:00:00.000Z').toISOString();

    const tasks: TaskItem[] = [
      // Día 1: Completado hace días
      { id: 'd1_t1', sectionId: 'sec_dia_1', title: 'Press', targetCount: 4, currentCount: 4, status: 'completed', completed_at: '2026-10-27T18:00:00.000Z' } as any,
      // Día 2: Hecho ayer (casi todo hecho, faltaron 2 series)
      { id: 'd2_t1', sectionId: 'sec_dia_2', title: 'Jaca', targetCount: 4, currentCount: 4, status: 'completed', completed_at: yesterdayIso } as any,
      { id: 'd2_t2', sectionId: 'sec_dia_2', title: 'Femoral', targetCount: 4, currentCount: 4, status: 'completed', completed_at: yesterdayIso } as any,
      { id: 'd2_t3', sectionId: 'sec_dia_2', title: 'Glúteo', targetCount: 3, currentCount: 2, status: 'pending', updated_at: yesterdayIso } as any,
      // Día 3: Pendiente
      { id: 'd3_t1', sectionId: 'sec_dia_3', title: 'Espalda', targetCount: 4, currentCount: 0, status: 'pending' } as any,
      // Día 4: Pendiente
      { id: 'd4_t1', sectionId: 'sec_dia_4', title: 'Pierna B', targetCount: 4, currentCount: 0, status: 'pending' } as any,
    ];

    const activeId = getActiveGymDaySectionId(sections, tasks, null, today);
    expect(activeId).toBe('sec_dia_3');
  });

  it('respeta la anulación manual del día si el usuario elige un día concreto a mano', () => {
    const tasks: TaskItem[] = [
      { id: 'd1_t1', sectionId: 'sec_dia_1', title: 'Press banca', targetCount: 4, currentCount: 0, status: 'pending' } as any,
      { id: 'd2_t1', sectionId: 'sec_dia_2', title: 'Sentadilla', targetCount: 4, currentCount: 2, status: 'pending' } as any,
    ];

    // El usuario fuerza manualmente el Día 4
    const activeId = getActiveGymDaySectionId(sections, tasks, 'sec_dia_4');
    expect(activeId).toBe('sec_dia_4');
  });
});
