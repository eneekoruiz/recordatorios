import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../src/store/useAppStore';
import type { TaskItem } from '../../src/models/Task';

describe('Gestión de Ciclos Temporales y Frecuencias', () => {
  beforeEach(() => {
    useAppStore.setState({
      cycles: [
        { id: 'cycle_day', name: 'Diario', daysValue: 1, isPinned: true, icon: 'sun' },
        { id: 'cycle_week', name: 'Semanal', daysValue: 7, isPinned: true, icon: 'calendar' },
        { id: 'cycle_month', name: 'Mensual', daysValue: 30, isPinned: true, icon: 'moon' },
        { id: 'cycle_year', name: 'Anual', daysValue: 365, isPinned: true, icon: 'globe' },
      ],
      tasks: {},
      tombstones: { lists: [], tasks: [], tags: [], sections: [], cycles: [], habits: [] },
    });
  });

  it('permite añadir un nuevo ciclo temporal personalizado con color e icono y se ordena por días', () => {
    const store = useAppStore.getState();

    store.addCycle({
      id: 'cycle_trimestral',
      name: 'Trimestral',
      daysValue: 90,
      isPinned: true,
      icon: 'sparkles',
      color: '#AF52DE',
    });

    const updatedCycles = useAppStore.getState().cycles;
    const added = updatedCycles.find(c => c.id === 'cycle_trimestral');
    expect(added).toBeDefined();
    expect(added?.name).toBe('Trimestral');
    expect(added?.daysValue).toBe(90);
    expect(added?.color).toBe('#AF52DE');
    expect(added?.icon).toBe('sparkles');

    // Comprobar ordenación: Diario (1) < Semanal (7) < Mensual (30) < Trimestral (90) < Anual (365)
    const daysArray = updatedCycles.map(c => c.daysValue);
    expect(daysArray).toEqual([1, 7, 30, 90, 365]);
  });

  it('al eliminar un ciclo personalizado, se eliminan sus asignaciones en tareas y se registra en tombstones', () => {
    const store = useAppStore.getState();

    store.addCycle({
      id: 'cycle_custom_test',
      name: 'Custom Test',
      daysValue: 45,
      isPinned: true,
      icon: 'star',
      color: '#FF9500',
    });

    const taskWithCycle: TaskItem = {
      id: 'task_c1',
      title: 'Tarea en ciclo custom',
      categoryId: 'default_inbox',
      status: 'pending',
      cycle_id: 'cycle_custom_test',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
    };
    store.addTask(taskWithCycle);

    expect(useAppStore.getState().tasks['task_c1']?.cycle_id).toBe('cycle_custom_test');

    // Eliminar ciclo
    store.deleteCycle('cycle_custom_test');

    const stateAfter = useAppStore.getState();
    expect(stateAfter.cycles.some(c => c.id === 'cycle_custom_test')).toBe(false);
    expect(stateAfter.tasks['task_c1']?.cycle_id).toBeUndefined();
    expect(stateAfter.tombstones.cycles.some(c => c.id === 'cycle_custom_test')).toBe(true);
  });

  it('getListBadgeInfo devuelve el distintivo adecuado para listas de duraciones, financieras y normales', async () => {
    const { getListBadgeInfo } = await import('../../src/utils/specialLists');

    // Lista de rutinas -> Duraciones
    expect(getListBadgeInfo({ id: 'l1', name: 'Limpieza', color: '#007aff', listType: 'routines' })).toEqual({
      label: 'Duraciones',
      color: '#0a84ff'
    });

    // Lista financiera -> Financiera
    expect(getListBadgeInfo({ id: 'l2', name: 'Presupuesto', color: '#30d158', isFinancial: true })).toEqual({
      label: 'Financiera',
      color: '#30d158'
    });

    // Lista de compras -> Financiera
    expect(getListBadgeInfo({ id: 'l3', name: 'Supermercado', color: '#30d158' })).toEqual({
      label: 'Financiera',
      color: '#30d158'
    });

    // Lista simple/checklist -> Anotar, marcada como genérica (las cabeceras no pintan distintivo)
    expect(getListBadgeInfo({ id: 'l4', name: 'Ideas sueltas', color: '#ff9500', listType: 'simple' })).toEqual({
      label: 'Anotar',
      color: 'var(--text-tertiary)',
      generic: true
    });
  });
});
