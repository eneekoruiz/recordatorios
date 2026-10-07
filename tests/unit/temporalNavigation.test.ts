import { describe, it, expect, beforeEach } from 'vitest';
import { useTemporalNavigationStore } from '../../src/store/useTemporalNavigationStore';
import { isCompletedInCurrentPeriod } from '../../src/services/TaskService';
import type { TaskItem } from '../../src/models/Task';

describe('Navegación Temporal y Estado Histórico de Listas (Apple Style)', () => {
  beforeEach(() => {
    useTemporalNavigationStore.getState().resetToNow();
  });

  describe('useTemporalNavigationStore', () => {
    it('inicia en tiempo real con temporalDate null', () => {
      const state = useTemporalNavigationStore.getState();
      expect(state.temporalDate).toBeNull();
      expect(state.isCurrentRealTime()).toBe(true);
    });

    it('permite avanzar y retroceder años con stepPeriod("year")', () => {
      const store = useTemporalNavigationStore.getState();
      const currentYear = new Date().getFullYear();

      // Retroceder 1 año (ej. 2026 -> 2025)
      store.stepPeriod(-1, 'year');
      let updated = useTemporalNavigationStore.getState();
      expect(updated.temporalDate).not.toBeNull();
      expect(updated.temporalDate?.getFullYear()).toBe(currentYear - 1);
      expect(updated.isCurrentRealTime('year')).toBe(false);

      // Avanzar 2 años (ej. 2025 -> 2027)
      store.stepPeriod(1, 'year');
      store.stepPeriod(1, 'year');
      updated = useTemporalNavigationStore.getState();
      expect(updated.temporalDate?.getFullYear()).toBe(currentYear + 1);

      // Resetear a hoy
      store.resetToNow();
      updated = useTemporalNavigationStore.getState();
      expect(updated.temporalDate).toBeNull();
      expect(updated.isCurrentRealTime()).toBe(true);
    });

    it('permite navegar meses con stepPeriod("month")', () => {
      const store = useTemporalNavigationStore.getState();
      const baseMonth = new Date().getMonth();

      store.stepPeriod(1, 'month');
      let updated = useTemporalNavigationStore.getState();
      expect(updated.temporalDate).not.toBeNull();
      expect(updated.temporalDate?.getMonth()).toBe((baseMonth + 1) % 12);

      store.resetToNow();
      expect(useTemporalNavigationStore.getState().temporalDate).toBeNull();
    });
  });

  describe('isCompletedInCurrentPeriod con referenceDate', () => {
    it('evalúa correctamente tareas anuales en 2025 vs 2026 vs 2027', () => {
      // Tarea completada el 15 de diciembre de 2025
      const ts2025 = new Date(2025, 11, 15).getTime();
      const task2025: Partial<TaskItem> = {
        id: 't_annual',
        title: 'Revisión médica anual',
        cycle_id: 'cycle_year',
        completionHistory: [ts2025]
      };

      // Si navegamos a 2025: estaba completada
      const ref2025 = new Date(2025, 5, 1);
      expect(isCompletedInCurrentPeriod(task2025, [], undefined, undefined, ref2025)).toBe(true);

      // Si navegamos a 2026: está pendiente (para hacer en 2026)
      const ref2026 = new Date(2026, 5, 1);
      expect(isCompletedInCurrentPeriod(task2025, [], undefined, undefined, ref2026)).toBe(false);

      // Si navegamos a 2027: está pendiente para 2027
      const ref2027 = new Date(2027, 5, 1);
      expect(isCompletedInCurrentPeriod(task2025, [], undefined, undefined, ref2027)).toBe(false);
    });

    it('evalúa correctamente tareas mensuales en meses pasados y futuros', () => {
      // Completada el 10 de septiembre de 2026
      const tsSep = new Date(2026, 8, 10).getTime();
      const taskMonthly: Partial<TaskItem> = {
        id: 't_month',
        title: 'Pagar alquiler',
        cycle_id: 'cycle_month',
        completionHistory: [tsSep]
      };

      // En Septiembre 2026: completada
      const refSep = new Date(2026, 8, 15);
      expect(isCompletedInCurrentPeriod(taskMonthly, [], undefined, undefined, refSep)).toBe(true);

      // En Octubre 2026: pendiente
      const refOct = new Date(2026, 9, 5);
      expect(isCompletedInCurrentPeriod(taskMonthly, [], undefined, undefined, refOct)).toBe(false);

      // En Noviembre 2026: pendiente
      const refNov = new Date(2026, 10, 5);
      expect(isCompletedInCurrentPeriod(taskMonthly, [], undefined, undefined, refNov)).toBe(false);
    });

    it('evalúa tareas diarias en días históricos', () => {
      // Completada el 5 de octubre de 2026
      const tsDay5 = new Date(2026, 9, 5, 14, 0).getTime();
      const taskDaily: Partial<TaskItem> = {
        id: 't_day',
        title: 'Meditar 10 minutos',
        cycle_id: 'cycle_day',
        completionHistory: [tsDay5]
      };

      // El 5 de octubre de 2026: completada
      const refOct5 = new Date(2026, 9, 5);
      expect(isCompletedInCurrentPeriod(taskDaily, [], undefined, undefined, refOct5)).toBe(true);

      // El 6 de octubre de 2026: pendiente
      const refOct6 = new Date(2026, 9, 6);
      expect(isCompletedInCurrentPeriod(taskDaily, [], undefined, undefined, refOct6)).toBe(false);
    });
  });
});
