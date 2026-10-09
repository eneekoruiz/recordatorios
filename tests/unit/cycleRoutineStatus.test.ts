import { describe, it, expect } from 'vitest';
import { calculateCycleRoutineStatus } from '../../src/utils/cycleRoutineStatus';
import type { TaskItem, CustomCycle } from '../../src/models/Task';

describe('calculateCycleRoutineStatus', () => {
  const cycles: CustomCycle[] = [
    { id: 'cycle_day', name: 'Diario', daysValue: 1, isPinned: true, icon: 'sun' },
    { id: 'cycle_week', name: 'Semanal', daysValue: 7, isPinned: true, icon: 'calendar' },
    { id: 'cycle_month', name: 'Mensual', daysValue: 30, isPinned: true, icon: 'moon' },
    { id: 'cycle_year', name: 'Anual', daysValue: 365, isPinned: true, icon: 'globe' },
  ];

  const currentMonthCycle = cycles.find((c) => c.id === 'cycle_month')!;
  const refDate = new Date(2026, 9, 15); // Octubre 2026

  it('detecta estado vacío si no hay tareas en scope', () => {
    const status = calculateCycleRoutineStatus({
      tasks: [],
      cycles,
      currentCycle: currentMonthCycle,
      cycleRoutineMode: 'full_routine',
      referenceDate: refDate,
    });

    expect(status.statusState).toBe('empty');
    expect(status.totalGoal).toBe(0);
    expect(status.isAllDone).toBe(false);
  });

  it('diferencia mensuales pendientes vs acumuladas pendientes', () => {
    const tasks: TaskItem[] = [
      // 2 tareas mensuales: 1 hecha en Octubre 2026, 1 pendiente
      {
        id: 't-m1',
        title: 'Revisar cuentas del mes',
        cycle_id: 'cycle_month',
        completionHistory: [new Date(2026, 9, 5).getTime()],
        status: 'pending',
      } as TaskItem,
      {
        id: 't-m2',
        title: 'Pagar alquiler',
        cycle_id: 'cycle_month',
        completionHistory: [],
        status: 'pending',
      } as TaskItem,

      // 1 tarea diaria: hecha hoy (15 Oct 2026)
      {
        id: 't-d1',
        title: 'Beber agua',
        cycle_id: 'cycle_day',
        completionHistory: [new Date(2026, 9, 15).getTime()],
        status: 'pending',
      } as TaskItem,

      // 1 tarea semanal: pendiente esta semana
      {
        id: 't-w1',
        title: 'Hacer la colada',
        cycle_id: 'cycle_week',
        completionHistory: [],
        status: 'pending',
      } as TaskItem,
    ];

    const status = calculateCycleRoutineStatus({
      tasks,
      cycles,
      currentCycle: currentMonthCycle,
      cycleRoutineMode: 'full_routine',
      referenceDate: refDate,
    });

    expect(status.ownTotal).toBe(2);
    expect(status.ownCompleted).toBe(1);
    expect(status.ownPending).toBe(1);

    expect(status.accumulatedTotal).toBe(2);
    expect(status.accumulatedCompleted).toBe(1); // diaria hecha
    expect(status.accumulatedPending).toBe(1); // semanal pendiente

    expect(status.dailyTotal).toBe(1);
    expect(status.dailyCompleted).toBe(1);
    expect(status.dailyPending).toBe(0);

    expect(status.weeklyTotal).toBe(1);
    expect(status.weeklyCompleted).toBe(0);
    expect(status.weeklyPending).toBe(1);

    expect(status.statusState).toBe('both_pending');
    expect(status.headline).toContain('Faltan 1 mensual y 1 semanal');
    expect(status.otherBreakdown).toHaveLength(2);
    expect(status.missingSummary).toContain('1 mensual');
    expect(status.missingSummary).toContain('1 semanal');
  });

  it('identifica cuando todas las mensuales están al día pero faltan acumuladas', () => {
    const tasks: TaskItem[] = [
      // Mensual hecha
      {
        id: 't-m1',
        title: 'Revisar cuentas',
        cycle_id: 'cycle_month',
        completionHistory: [new Date(2026, 9, 2).getTime()],
        status: 'pending',
      } as TaskItem,
      // Diaria pendiente
      {
        id: 't-d1',
        title: 'Vitaminas',
        cycle_id: 'cycle_day',
        completionHistory: [],
        status: 'pending',
      } as TaskItem,
    ];

    const status = calculateCycleRoutineStatus({
      tasks,
      cycles,
      currentCycle: currentMonthCycle,
      cycleRoutineMode: 'full_routine',
      referenceDate: refDate,
    });

    expect(status.isOwnDone).toBe(true);
    expect(status.isAccumulatedDone).toBe(false);
    expect(status.statusState).toBe('own_done_accumulated_pending');
    expect(status.headline).toContain('Mensuales al día · Faltan 1 diaria');
    expect(status.missingSummary).toContain('1 diaria');
  });

  it('identifica cuando las acumuladas están al día pero faltan mensuales', () => {
    const tasks: TaskItem[] = [
      // Mensual pendiente
      {
        id: 't-m1',
        title: 'Revisar cuentas',
        cycle_id: 'cycle_month',
        completionHistory: [],
        status: 'pending',
      } as TaskItem,
      // Diaria hecha
      {
        id: 't-d1',
        title: 'Vitaminas',
        cycle_id: 'cycle_day',
        completionHistory: [new Date(2026, 9, 15).getTime()],
        status: 'pending',
      } as TaskItem,
    ];

    const status = calculateCycleRoutineStatus({
      tasks,
      cycles,
      currentCycle: currentMonthCycle,
      cycleRoutineMode: 'full_routine',
      referenceDate: refDate,
    });

    expect(status.isOwnDone).toBe(false);
    expect(status.isAccumulatedDone).toBe(true);
    expect(status.statusState).toBe('accumulated_done_own_pending');
    expect(status.headline).toContain('Demás frecuencias al día · Faltan 1 mensual');
    expect(status.missingSummary).toContain('1 mensual');
  });

  it('identifica cuando el objetivo mensual global está 100% completado', () => {
    const tasks: TaskItem[] = [
      // Mensual hecha
      {
        id: 't-m1',
        title: 'Revisar cuentas',
        cycle_id: 'cycle_month',
        completionHistory: [new Date(2026, 9, 2).getTime()],
        status: 'pending',
      } as TaskItem,
      // Semanal hecha
      {
        id: 't-w1',
        title: 'Colada',
        cycle_id: 'cycle_week',
        completionHistory: [new Date(2026, 9, 14).getTime()],
        status: 'pending',
      } as TaskItem,
    ];

    const status = calculateCycleRoutineStatus({
      tasks,
      cycles,
      currentCycle: currentMonthCycle,
      cycleRoutineMode: 'full_routine',
      referenceDate: refDate,
    });

    expect(status.isAllDone).toBe(true);
    expect(status.isOwnDone).toBe(true);
    expect(status.isAccumulatedDone).toBe(true);
    expect(status.statusState).toBe('all_done');
    expect(status.headline).toBe('¡Objetivo mensual completado!');
    expect(status.missingSummary).toBe('Todo al día');
  });

  it('calcula correctamente en modo solo_seccion (excluyendo acumuladas de la meta)', () => {
    const tasks: TaskItem[] = [
      // Mensual hecha
      {
        id: 't-m1',
        title: 'Revisar cuentas',
        cycle_id: 'cycle_month',
        completionHistory: [new Date(2026, 9, 2).getTime()],
        status: 'pending',
      } as TaskItem,
      // Diaria pendiente (ignorada en la meta de solo_seccion)
      {
        id: 't-d1',
        title: 'Vitaminas',
        cycle_id: 'cycle_day',
        completionHistory: [],
        status: 'pending',
      } as TaskItem,
    ];

    const status = calculateCycleRoutineStatus({
      tasks,
      cycles,
      currentCycle: currentMonthCycle,
      cycleRoutineMode: 'only_section',
      referenceDate: refDate,
    });

    expect(status.totalGoal).toBe(1);
    expect(status.totalCompleted).toBe(1);
    expect(status.isAllDone).toBe(true);
    expect(status.statusState).toBe('all_done');
    expect(status.headline).toContain('Todas las mensuales completadas');
  });
});
