import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../src/store/useAppStore';
import { getStartOfWeek, getStartOfNextWeek, isTaskCreatedAfterPeriod } from '../../src/services/TaskService';
import { mergeServerTasks } from '../../src/sync/merge';
import { sanitizeSectionHierarchy } from '../../src/store/useAppStore';
import type { TaskItem, ListSection } from '../../src/models/Task';

describe('Requisitos de la Iteración Premium Apple HIG', () => {
  beforeEach(() => {
    useAppStore.setState({
      tasks: {},
      cycles: [
        { id: 'cycle_day', name: 'Diario', daysValue: 1, isPinned: true },
        { id: 'cycle_week', name: 'Semanal', daysValue: 7, isPinned: true },
        { id: 'cycle_month', name: 'Mensual', daysValue: 30, isPinned: true },
        { id: 'cycle_year', name: 'Anual', daysValue: 365, isPinned: true },
      ],
      lists: [],
      listSections: [],
      tombstones: { tasks: [], lists: [], sections: [], cycles: [] }
    });
  });

  describe('Req 2: Motor Avanzado de Dependencias y Bloqueo Activo', () => {
    it('impide completar una tarea si su tarea bloqueadora está pendiente', () => {
      const blockerTask: TaskItem = {
        id: 'blocker-1',
        title: 'Preparar ingredientes',
        status: 'pending',
        type: 'task',
        created_at: new Date().toISOString()
      };

      const blockedTask: TaskItem = {
        id: 'blocked-1',
        title: 'Cocinar plato',
        status: 'pending',
        type: 'task',
        blockedBy: ['blocker-1'],
        created_at: new Date().toISOString()
      };

      useAppStore.setState({
        tasks: {
          'blocker-1': blockerTask,
          'blocked-1': blockedTask
        }
      });

      // Intento de completar tarea bloqueada
      useAppStore.getState().toggleTask('blocked-1');

      // Debe permanecer pendiente porque blocker-1 está pendiente
      expect(useAppStore.getState().tasks['blocked-1'].status).toBe('pending');

      // Completamos el bloqueador
      useAppStore.getState().toggleTask('blocker-1');
      expect(useAppStore.getState().tasks['blocker-1'].status).toBe('completed');

      // Ahora que el bloqueador está completo, debe permitir completarla
      useAppStore.getState().toggleTask('blocked-1');
      expect(useAppStore.getState().tasks['blocked-1'].status).toBe('completed');
    });

    it('permite saltar dependencia con skipDependency', () => {
      const blockerTask: TaskItem = {
        id: 'blocker-2',
        title: 'Comprar pintura',
        status: 'pending',
        type: 'task',
        created_at: new Date().toISOString()
      };

      const blockedTask: TaskItem = {
        id: 'blocked-2',
        title: 'Pintar pared',
        status: 'pending',
        type: 'task',
        blockedBy: ['blocker-2'],
        created_at: new Date().toISOString()
      };

      useAppStore.setState({
        tasks: {
          'blocker-2': blockerTask,
          'blocked-2': blockedTask
        }
      });

      // Saltar la dependencia
      useAppStore.getState().skipDependency('blocked-2', 'blocker-2');
      expect(useAppStore.getState().tasks['blocked-2'].blockedBy).toEqual([]);

      // Ahora se puede completar inmediatamente
      useAppStore.getState().toggleTask('blocked-2');
      expect(useAppStore.getState().tasks['blocked-2'].status).toBe('completed');
    });
  });

  describe('Req 5: Aislamiento Histórico (Creation-Awareness)', () => {
    it('detecta correctamente si una tarea fue creada después del periodo de referencia', () => {
      const taskNovember: Partial<TaskItem> = {
        id: 'task-nov',
        title: 'Revisión calefacción',
        cycle_id: 'cycle_month',
        created_at: '2026-11-05T10:00:00.000Z'
      };

      // Si consultamos en Octubre 2026 (período anterior)
      const pastRef = new Date('2026-10-15T12:00:00.000Z');
      expect(isTaskCreatedAfterPeriod(taskNovember, 'cycle_month', pastRef)).toBe(true);

      // Si consultamos en Noviembre 2026 (mismo período)
      const currentRef = new Date('2026-11-08T12:00:00.000Z');
      expect(isTaskCreatedAfterPeriod(taskNovember, 'cycle_month', currentRef)).toBe(false);

      // Si consultamos en Diciembre 2026 (período posterior)
      const futureRef = new Date('2026-12-01T12:00:00.000Z');
      expect(isTaskCreatedAfterPeriod(taskNovember, 'cycle_month', futureRef)).toBe(false);
    });

    it('excluye tareas creadas después del periodo de referencia en getTasksByCycle', () => {
      const oldMonthlyTask: TaskItem = {
        id: 'task-old',
        title: 'Factura luz',
        cycle_id: 'cycle_month',
        status: 'pending',
        type: 'task',
        created_at: '2026-09-01T10:00:00.000Z'
      };

      const newMonthlyTask: TaskItem = {
        id: 'task-new',
        title: 'Pagar nuevo seguro',
        cycle_id: 'cycle_month',
        status: 'pending',
        type: 'task',
        created_at: '2026-11-01T10:00:00.000Z'
      };

      useAppStore.setState({
        tasks: {
          'task-old': oldMonthlyTask,
          'task-new': newMonthlyTask
        }
      });

      // Consultar ciclo mensual en Octubre 2026
      const octRef = new Date('2026-10-15T12:00:00.000Z');
      const octTasks = useAppStore.getState().getTasksByCycle('cycle_month', false, [], octRef);
      const allOctTasks = Object.values(octTasks).flat();

      expect(allOctTasks.some(t => t.id === 'task-old')).toBe(true);
      expect(allOctTasks.some(t => t.id === 'task-new')).toBe(false);
    });
  });

  describe('Req 6: Purgado de Resurrecciones Fantasma por Tombstones', () => {
    it('no resucita una tarea eliminada si su ID está en tombstones', () => {
      const local: Record<string, TaskItem> = {};
      const incoming = [
        {
          id: 'ghost-1',
          title: 'Tarea que fue borrada',
          status: 'pending',
          version: 1,
          updated_at: '2026-11-08T10:00:00.000Z'
        }
      ];

      const tombstones = new Set(['ghost-1']);
      const result = mergeServerTasks(local, incoming, tombstones);

      expect(result.tasks['ghost-1']).toBeUndefined();
      expect(result.changed).toBe(false);
    });

    it('elimina la tarea local si el servidor la envía con deleted_at', () => {
      const local: Record<string, TaskItem> = {
        'task-to-delete': {
          id: 'task-to-delete',
          title: 'Tarea activa',
          status: 'pending',
          type: 'task',
          version: 1,
          created_at: '2026-11-01T10:00:00.000Z',
          updated_at: '2026-11-01T10:00:00.000Z'
        }
      };

      const incoming = [
        {
          id: 'task-to-delete',
          title: 'Tarea activa',
          deleted_at: '2026-11-08T11:00:00.000Z',
          updated_at: '2026-11-08T11:00:00.000Z',
          version: 2
        }
      ];

      const result = mergeServerTasks(local, incoming);
      expect(result.tasks['task-to-delete']).toBeUndefined();
      expect(result.changed).toBe(true);
    });
  });

  describe('Req 8: Configuración de Intervalos de Ciclo Semanal', () => {
    it('calcula el inicio de semana según startDay personalizado (ej. Viernes a Jueves)', () => {
      // Viernes 6 de Noviembre de 2026
      const friday = new Date(2026, 10, 6, 14, 0, 0); // Month 10 = November
      // startDay = 5 (Viernes)
      const startOfCycle = getStartOfWeek(friday, 5);
      expect(startOfCycle.getDay()).toBe(5);
      expect(startOfCycle.getDate()).toBe(6);

      // Siguiente Miércoles 11 de Noviembre de 2026 (pertenece al mismo ciclo de Viernes a Jueves)
      const wednesday = new Date(2026, 10, 11, 10, 0, 0);
      const startOfWedCycle = getStartOfWeek(wednesday, 5);
      expect(startOfWedCycle.getDay()).toBe(5);
      expect(startOfWedCycle.getDate()).toBe(6);

      // Jueves 12 de Noviembre de 2026 (último día del ciclo)
      const thursday = new Date(2026, 10, 12, 23, 0, 0);
      const startOfThuCycle = getStartOfWeek(thursday, 5);
      expect(startOfThuCycle.getDate()).toBe(6);

      // Siguiente ciclo arranca el Viernes 13
      const nextWeekStart = getStartOfNextWeek(friday, 5);
      expect(nextWeekStart.getDate()).toBe(13);
    });
  });

  describe('Req 10: Limpieza Estructural de Secciones y Detección de Ciclos', () => {
    it('rompe anidaciones circulares entre secciones y sanea sufijos repetidos', () => {
      const sections: ListSection[] = [
        {
          id: 'sec-a',
          name: 'Cocina (copia) (copia)',
          listId: 'list-1',
          order: 0,
          parentId: 'sec-b' // sec-a es hija de sec-b
        },
        {
          id: 'sec-b',
          name: 'sec_section_General',
          listId: 'list-1',
          order: 1,
          parentId: 'sec-a' // sec-b es hija de sec-a -> BUCLE CIRCULAR
        }
      ];

      const sanitized = sanitizeSectionHierarchy(sections);

      // Debe sanear sufijos y prefijos rotos
      const secA = sanitized.find(s => s.id === 'sec-a')!;
      const secB = sanitized.find(s => s.id === 'sec-b')!;

      expect(secA.name).toBe('Cocina (copia)');
      expect(secB.name).toBe('General');

      // El bucle circular debe quedar roto (al menos una de ellas desanidada)
      const hasLoop = secA.parentId === 'sec-b' && secB.parentId === 'sec-a';
      expect(hasLoop).toBe(false);
    });
  });
});
