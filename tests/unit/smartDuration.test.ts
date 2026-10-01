import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../src/store/useAppStore';
import type { TaskItem } from '../../src/models/Task';

describe('Smart Durations & Personalization Engine', () => {
  beforeEach(() => {
    // Reset store state with a sample task
    const sampleTask: TaskItem = {
      id: 'task-test-1',
      title: 'Comprar fruta fresca',
      user_id: 'test-user',
      type: 'task',
      status: 'pending',
      duration: 5, // 5 minutos fijados inicialmente
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1
    };

    useAppStore.setState({
      tasks: {
        'task-test-1': sampleTask
      }
    });
  });

  describe('trackTaskExecution', () => {
    it('ignora tiempos de ejecución inválidos (cero, negativos o NaN)', () => {
      const store = useAppStore.getState();
      store.trackTaskExecution('task-test-1', 0);
      store.trackTaskExecution('task-test-1', -15);
      store.trackTaskExecution('task-test-1', NaN);

      const task = useAppStore.getState().tasks['task-test-1'];
      expect(task.executionHistory).toBeUndefined();
    });

    it('registra una única ejecución sin generar sugerencia prematura', () => {
      const store = useAppStore.getState();
      store.trackTaskExecution('task-test-1', 120); // 2 minutos

      const task = useAppStore.getState().tasks['task-test-1'];
      expect(task.executionHistory).toEqual([120]);
      expect(task.suggestedDuration).toBeUndefined();
    });

    it('detecta desviación significativa (>30%) tras 2 o más ejecuciones y sugiere nueva duración', () => {
      const store = useAppStore.getState();
      // Marcada a 5 minutos, pero se completa dos veces en ~2 minutos (110s y 130s => media 120s = 2 min)
      store.trackTaskExecution('task-test-1', 110);
      store.trackTaskExecution('task-test-1', 130);

      const task = useAppStore.getState().tasks['task-test-1'];
      expect(task.executionHistory).toEqual([110, 130]);
      // Desviación: |5 - 2| / 5 = 60% > 30%
      expect(task.suggestedDuration).toBe(2);
    });

    it('no genera sugerencia si la duración real se mantiene dentro del 30% del tiempo fijado', () => {
      const store = useAppStore.getState();
      // Marcada a 5 minutos (300s). Se completa en 4 minutos y medio (270s y 280s => media 275s = ~5 min)
      store.trackTaskExecution('task-test-1', 270);
      store.trackTaskExecution('task-test-1', 280);

      const task = useAppStore.getState().tasks['task-test-1'];
      expect(task.executionHistory).toEqual([270, 280]);
      expect(task.suggestedDuration).toBeUndefined();
    });

    it('sugiere 0.5 minutos si la tarea se realiza consistentemente en menos de 45 segundos', () => {
      const store = useAppStore.getState();
      // Marcada a 5 minutos, se hace en 25s y 35s (media 30s)
      store.trackTaskExecution('task-test-1', 25);
      store.trackTaskExecution('task-test-1', 35);

      const task = useAppStore.getState().tasks['task-test-1'];
      expect(task.suggestedDuration).toBe(0.5);
    });

    it('limita la ventana rodante de historial a un máximo de 10 ejecuciones para evitar fugas de memoria', () => {
      const store = useAppStore.getState();
      for (let i = 1; i <= 15; i++) {
        store.trackTaskExecution('task-test-1', i * 10);
      }

      const task = useAppStore.getState().tasks['task-test-1'];
      expect(task.executionHistory).toHaveLength(10);
      // Las primeras 5 (10, 20, 30, 40, 50) deben haberse descartado
      expect(task.executionHistory?.[0]).toBe(60);
      expect(task.executionHistory?.[9]).toBe(150);
    });
  });

  describe('postponeTask & Anti-Burnout tracking', () => {
    it('incrementa el contador de postergaciones acumuladas', () => {
      const store = useAppStore.getState();
      expect(store.tasks['task-test-1'].postponeCount).toBeUndefined();

      store.postponeTask('task-test-1');
      expect(useAppStore.getState().tasks['task-test-1'].postponeCount).toBe(1);

      store.postponeTask('task-test-1');
      store.postponeTask('task-test-1');
      store.postponeTask('task-test-1');

      const task = useAppStore.getState().tasks['task-test-1'];
      expect(task.postponeCount).toBe(4);
      // Con más de 3 postergaciones, el banner anti-burnout en DrawerDateTimeSection se activa
      expect(task.postponeCount > 3).toBe(true);
    });
  });
});
