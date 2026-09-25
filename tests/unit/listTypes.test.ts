import { describe, it, expect } from 'vitest';
import { 
  getListType, 
  doesListSupportDuration, 
  doesListSupportSequenceMode, 
  isEventsList, 
  isGoalsList, 
  isRoutineList, 
  isShoppingList,
  LIST_TYPE_CONFIG 
} from '../../src/utils/specialLists';
import { getTaskDuration, calculateTasksDuration } from '../../src/utils/taskDuration';
import type { CustomList, TaskItem } from '../../src/models/Task';

describe('List Types & Duration Engine', () => {
  describe('getListType detection', () => {
    it('respects explicit listType over name heuristics', () => {
      const explicitSimple: CustomList = {
        id: 'l1',
        name: 'Limpieza rápida', // would match routines by name, but explicit listType wins
        listType: 'simple',
        color: '#0a84ff',
        isFolder: false,
        showCompleted: false
      };
      expect(getListType(explicitSimple)).toBe('simple');

      const explicitEvents: CustomList = {
        id: 'l2',
        name: 'Mis quehaceres',
        listType: 'events',
        color: '#ff2d55',
        isFolder: false,
        showCompleted: false
      };
      expect(getListType(explicitEvents)).toBe('events');
    });

    it('identifies events lists via keywords or ID', () => {
      expect(isEventsList('eventos')).toBe(true);
      expect(isEventsList('citas')).toBe(true);
      expect(isEventsList('cumpleanos')).toBe(true);

      const eventList: CustomList = { id: 'list_123', name: 'Cumpleaños y Aniversarios', color: '#ff2d55', isFolder: false, showCompleted: false };
      expect(getListType(eventList)).toBe('events');
      expect(isEventsList(eventList.id, eventList)).toBe(true);
    });

    it('identifies goals and purpose lists via keywords', () => {
      expect(isGoalsList('propositos')).toBe(true);
      expect(isGoalsList('metas')).toBe(true);
      expect(isGoalsList('objetivos')).toBe(true);

      const goalsList: CustomList = { id: 'list_456', name: 'Propósitos de Año Nuevo 2026', color: '#af52de', isFolder: false, showCompleted: false };
      expect(getListType(goalsList)).toBe('goals');
      expect(isGoalsList(goalsList.id, goalsList)).toBe(true);
    });

    it('identifies routine lists (cleaning, chores)', () => {
      expect(isRoutineList('limpieza')).toBe(true);
      expect(isRoutineList('quehaceres')).toBe(true);

      const routineList: CustomList = { id: 'list_789', name: 'Limpieza del hogar', color: '#0a84ff', isFolder: false, showCompleted: false };
      expect(getListType(routineList)).toBe('routines');
      expect(isRoutineList(routineList.id, routineList)).toBe(true);
    });

    it('identifies shopping lists as simple lists without duration', () => {
      expect(isShoppingList('compra')).toBe(true);
      expect(isShoppingList('compras')).toBe(true);
      expect(isRoutineList('compra')).toBe(false);

      const compraList: CustomList = { id: 'compra', name: 'Lista de la compra', color: '#30d158', isFolder: false, showCompleted: false };
      expect(getListType(compraList)).toBe('simple');
      expect(isShoppingList(compraList.id, compraList)).toBe(true);
    });

    it('falls back to simple for notes, ideas, or generic lists', () => {
      const simpleList: CustomList = { id: 'list_abc', name: 'Ideas de regalos', color: '#30d158', isFolder: false, showCompleted: false };
      expect(getListType(simpleList)).toBe('simple');
      expect(doesListSupportDuration('simple')).toBe(false);
    });
  });

  describe('doesListSupportDuration and doesListSupportSequenceMode', () => {
    it('only enables duration calculations for routines', () => {
      expect(doesListSupportDuration('routines')).toBe(true);
      expect(doesListSupportDuration('simple')).toBe(false);
      expect(doesListSupportDuration('events')).toBe(false);
      expect(doesListSupportDuration('goals')).toBe(false);
      expect(doesListSupportDuration('caducidades')).toBe(false);
      expect(doesListSupportDuration('que_he_hecho')).toBe(false);
    });

    it('only enables sequence focus mode (▶ Empezar) for routines', () => {
      expect(doesListSupportSequenceMode('routines')).toBe(true);
      expect(doesListSupportSequenceMode('simple')).toBe(false);
      expect(doesListSupportSequenceMode('events')).toBe(false);
      expect(doesListSupportSequenceMode('goals')).toBe(false);
      expect(doesListSupportSequenceMode('caducidades')).toBe(false);
      expect(doesListSupportSequenceMode('que_he_hecho')).toBe(false);
    });

    it('provides UI configuration metadata for all 6 types', () => {
      expect(LIST_TYPE_CONFIG.routines.badgeLabel).toBe('Rutinas');
      expect(LIST_TYPE_CONFIG.simple.badgeLabel).toBe('Checklist');
      expect(LIST_TYPE_CONFIG.events.badgeLabel).toBe('Eventos');
      expect(LIST_TYPE_CONFIG.goals.badgeLabel).toBe('Propósitos');
      expect(LIST_TYPE_CONFIG.caducidades.badgeLabel).toBe('Caducidades');
      expect(LIST_TYPE_CONFIG.que_he_hecho.badgeLabel).toBe('Bitácora');
    });
  });

  describe('Task Duration in Event, Goal, and Simple Lists', () => {
    const eventList: CustomList = { id: 'list_events', name: 'Eventos', listType: 'events', color: '#ff2d55', isFolder: false, showCompleted: false };
    const goalList: CustomList = { id: 'list_goals', name: 'Propósitos', listType: 'goals', color: '#af52de', isFolder: false, showCompleted: false };
    const simpleList: CustomList = { id: 'list_simple', name: 'Notas rápidas', listType: 'simple', color: '#30d158', isFolder: false, showCompleted: false };
    const routineList: CustomList = { id: 'list_routines', name: 'Limpieza', listType: 'routines', color: '#0a84ff', isFolder: false, showCompleted: false };

    it('returns 0 duration for tasks in an events list', () => {
      const eventTask: TaskItem = {
        id: 't1',
        title: 'Cumpleaños de Papá',
        status: 'pending',
        categoryId: 'list_events',
        created_at: '',
        version: 1,
        user_id: 'u1',
        type: 'task'
      };
      const duration = getTaskDuration(eventTask, eventList);
      expect(duration.activeMinutes).toBe(0);
      expect(duration.parallelMinutes).toBe(0);
    });

    it('returns 0 duration for tasks in a goals list', () => {
      const goalTask: TaskItem = {
        id: 't2',
        title: 'Aprender a tocar el piano',
        status: 'pending',
        categoryId: 'list_goals',
        created_at: '',
        version: 1,
        user_id: 'u1',
        type: 'task'
      };
      const duration = getTaskDuration(goalTask, goalList);
      expect(duration.activeMinutes).toBe(0);
    });

    it('returns 0 duration for tasks in a simple list without duration', () => {
      const simpleTask: TaskItem = {
        id: 't3',
        title: 'Comprar bombilla de repuesto',
        status: 'pending',
        categoryId: 'list_simple',
        created_at: '',
        version: 1,
        user_id: 'u1',
        type: 'task'
      };
      const duration = getTaskDuration(simpleTask, simpleList);
      expect(duration.activeMinutes).toBe(0);
    });

    it('calculates duration normally for routine lists', () => {
      const routineTask: TaskItem = {
        id: 't4',
        title: 'Fregar el suelo de la cocina',
        status: 'pending',
        categoryId: 'list_routines',
        created_at: '',
        version: 1,
        user_id: 'u1',
        type: 'task'
      };
      const duration = getTaskDuration(routineTask, routineList);
      expect(duration.activeMinutes).toBeGreaterThan(0);
    });

    it('respects explicit duration set by user even in non-routine lists', () => {
      const userTimedEvent: TaskItem = {
        id: 't5',
        title: 'Cita con el médico especialista',
        duration: 45, // user explicitly wants 45 min
        status: 'pending',
        categoryId: 'list_events',
        created_at: '',
        version: 1,
        user_id: 'u1',
        type: 'task'
      };
      const duration = getTaskDuration(userTimedEvent, eventList);
      expect(duration.activeMinutes).toBe(45);
    });

    it('calculateTasksDuration totals 0 for event lists with tasks', () => {
      const eventTasks: TaskItem[] = [
        { id: '1', title: 'Cumpleaños de Ana', status: 'pending', categoryId: 'list_events', created_at: '', version: 1, user_id: 'u1', type: 'task' },
        { id: '2', title: 'Boda de Carlos y Marta', status: 'pending', categoryId: 'list_events', created_at: '', version: 1, user_id: 'u1', type: 'task' },
        { id: '3', title: 'Concierto en el auditorio', status: 'pending', categoryId: 'list_events', created_at: '', version: 1, user_id: 'u1', type: 'task' }
      ];
      const summary = calculateTasksDuration(eventTasks, [], [eventList]);
      expect(summary.activeMinutes).toBe(0);
      expect(summary.formattedActive).toBe('0 min');
    });
  });
});
