import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../src/store/useAppStore';
import { classifyDropZone } from '../../src/utils/dragDrop';
import { isCompletedInCurrentPeriod, getRoutineSessionDates } from '../../src/services/TaskService';
import { calculateTasksDuration } from '../../src/utils/taskDuration';
import { isGymTask, isGymList } from '../../src/utils/specialLists';
import type { TaskItem, CustomCycle, CustomList } from '../../src/models/Task';

describe('Subtask Outdent Hierarchy', () => {
  beforeEach(() => {
    useAppStore.setState({
      tasks: {},
      lists: [{ id: 'list-1', name: 'General', color: '#007aff' }],
      listSections: [],
      cycles: []
    });
  });

  it('outdenting child 1 turns subsequent children into its children', () => {
    const parent: TaskItem = {
      id: 'p1',
      title: 'Parent Task',
      categoryId: 'list-1',
      order: 0,
      status: 'pending',
      type: 'task',
      created_at: '2026-10-31T10:00:00.000Z'
    };
    const c1: TaskItem = {
      id: 'c1',
      parentId: 'p1',
      title: 'Child 1',
      categoryId: 'list-1',
      order: 0,
      status: 'pending',
      type: 'task',
      created_at: '2026-10-31T10:01:00.000Z'
    };
    const c2: TaskItem = {
      id: 'c2',
      parentId: 'p1',
      title: 'Child 2',
      categoryId: 'list-1',
      order: 1,
      status: 'pending',
      type: 'task',
      created_at: '2026-10-31T10:02:00.000Z'
    };
    const c3: TaskItem = {
      id: 'c3',
      parentId: 'p1',
      title: 'Child 3',
      categoryId: 'list-1',
      order: 2,
      status: 'pending',
      type: 'task',
      created_at: '2026-10-31T10:03:00.000Z'
    };
    const c4: TaskItem = {
      id: 'c4',
      parentId: 'p1',
      title: 'Child 4',
      categoryId: 'list-1',
      order: 3,
      status: 'pending',
      type: 'task',
      created_at: '2026-10-31T10:04:00.000Z'
    };

    useAppStore.setState({
      tasks: { p1: parent, c1, c2, c3, c4 }
    });

    // Outdent C1
    useAppStore.getState().nestTask('c1', undefined);

    const tasks = useAppStore.getState().tasks;
    // C1 is now root right after P1
    expect(tasks['c1'].parentId).toBeUndefined();
    expect(tasks['p1'].order).toBe(0);
    expect(tasks['c1'].order).toBe(1);

    // C2, C3, C4 are now children of C1!
    expect(tasks['c2'].parentId).toBe('c1');
    expect(tasks['c3'].parentId).toBe('c1');
    expect(tasks['c4'].parentId).toBe('c1');

    // Their orders under C1 are 0, 1, 2
    expect(tasks['c2'].order).toBe(0);
    expect(tasks['c3'].order).toBe(1);
    expect(tasks['c4'].order).toBe(2);
  });

  it('outdenting child 2 leaves child 1 with original parent, and moves child 3 and 4 under child 2', () => {
    const parent: TaskItem = {
      id: 'p1',
      title: 'Parent Task',
      categoryId: 'list-1',
      order: 0,
      status: 'pending',
      type: 'task',
      created_at: '2026-10-31T10:00:00.000Z'
    };
    const c1: TaskItem = {
      id: 'c1',
      parentId: 'p1',
      title: 'Child 1',
      categoryId: 'list-1',
      order: 0,
      status: 'pending',
      type: 'task',
      created_at: '2026-10-31T10:01:00.000Z'
    };
    const c2: TaskItem = {
      id: 'c2',
      parentId: 'p1',
      title: 'Child 2',
      categoryId: 'list-1',
      order: 1,
      status: 'pending',
      type: 'task',
      created_at: '2026-10-31T10:02:00.000Z'
    };
    const c3: TaskItem = {
      id: 'c3',
      parentId: 'p1',
      title: 'Child 3',
      categoryId: 'list-1',
      order: 2,
      status: 'pending',
      type: 'task',
      created_at: '2026-10-31T10:03:00.000Z'
    };

    useAppStore.setState({
      tasks: { p1: parent, c1, c2, c3 }
    });

    // Outdent C2
    useAppStore.getState().nestTask('c2', undefined);

    const tasks = useAppStore.getState().tasks;
    expect(tasks['c1'].parentId).toBe('p1');
    expect(tasks['c2'].parentId).toBeUndefined();
    expect(tasks['c3'].parentId).toBe('c2');
  });
});

describe('Drop Zone Classification', () => {
  it('narrows inside drop zone to prevent accidental nesting on touch', () => {
    expect(classifyDropZone(0.1)).toBe('top');
    expect(classifyDropZone(0.37)).toBe('top');
    expect(classifyDropZone(0.5)).toBe('inside');
    expect(classifyDropZone(0.63)).toBe('bottom');
    expect(classifyDropZone(0.9)).toBe('bottom');
  });
});

describe('Routine Duration Consistency (Monthly >= Weekly)', () => {
  it('does not falsely mark weekly tasks completed because of earlier monthly session dates', () => {
    // Current date: Saturday Oct 31, 2026 (week: Oct 26 - Nov 1)
    const refDate = new Date(2026, 9, 31, 12, 0);

    // Monthly task completed on Oct 5, 2026
    const oct5 = new Date(2026, 9, 5, 10, 0).getTime();
    const monthlyTask: TaskItem = {
      id: 'm1',
      title: 'Limpieza profunda mensual',
      cycle_id: 'cycle_month',
      duration: 40,
      status: 'pending',
      type: 'task',
      created_at: '2026-10-01T00:00:00.000Z',
      completionHistory: [oct5]
    };

    // Weekly task: was also completed on Oct 5 (3 weeks ago), but is PENDING for current week (Oct 26-Nov 1)
    const weeklyTask: TaskItem = {
      id: 'w1',
      title: 'Limpieza semanal de baños',
      cycle_id: 'cycle_week',
      duration: 82, // 1h 22m
      status: 'pending',
      type: 'task',
      created_at: '2026-10-01T00:00:00.000Z',
      completionHistory: [oct5]
    };

    const cycles: CustomCycle[] = [
      { id: 'cycle_day', name: 'Diarias', daysValue: 1 },
      { id: 'cycle_week', name: 'Semanales', daysValue: 7 },
      { id: 'cycle_month', name: 'Mensuales', daysValue: 30 }
    ];

    // Weekly session dates for current week: empty
    const weeklySessionDates = getRoutineSessionDates('cycle_week', [weeklyTask], refDate, cycles);
    // Weekly task is pending this week
    expect(isCompletedInCurrentPeriod(weeklyTask, cycles, [], [], refDate, weeklySessionDates)).toBe(false);

    // Monthly session dates includes Oct 5
    const monthlySessionDates = getRoutineSessionDates('cycle_month', [monthlyTask], refDate, cycles);
    expect(monthlySessionDates.has(new Date(oct5).toDateString())).toBe(true);

    // CRITICAL: Weekly task MUST STILL BE PENDING on Oct 31, even when monthlySessionDates is passed!
    expect(isCompletedInCurrentPeriod(weeklyTask, cycles, [], [], refDate, monthlySessionDates)).toBe(false);

    // Therefore, pending weekly duration is 82 min
    const weeklyDuration = calculateTasksDuration([weeklyTask], [], [], cycles, refDate, weeklySessionDates).activeMinutes;
    expect(weeklyDuration).toBe(82);

    // Cumulative tasks in monthly routine: [monthlyTask (already done), weeklyTask (pending)]
    // Pending cumulative duration must be AT LEAST weekly duration (82 min)
    const cumulativeDuration = calculateTasksDuration([monthlyTask, weeklyTask], [], [], cycles, refDate, monthlySessionDates).activeMinutes;
    expect(cumulativeDuration).toBeGreaterThanOrEqual(weeklyDuration);
    expect(cumulativeDuration).toBe(82);
  });
});

describe('Gym Routine Exclusion from General Cycles', () => {
  it('excludes gym tasks from getTasksByCycle cascade (monthly/weekly views)', () => {
    const gymList: CustomList = {
      id: 'gimnasio',
      name: 'Gimnasio',
      color: '#ff9500'
    };
    const cleaningList: CustomList = {
      id: 'limpieza',
      name: 'Limpieza',
      color: '#34c759'
    };

    const cycles: CustomCycle[] = [
      { id: 'cycle_day', name: 'Diarias', daysValue: 1 },
      { id: 'cycle_week', name: 'Semanales', daysValue: 7 },
      { id: 'cycle_month', name: 'Mensuales', daysValue: 30 }
    ];

    const gymExercise: TaskItem = {
      id: 'gym-1',
      title: 'Press Banca',
      categoryId: 'gimnasio',
      cycle_id: 'cycle_week',
      duration: 45,
      status: 'pending',
      type: 'task',
      created_at: '2026-10-31T00:00:00.000Z'
    };

    const cleaningTask: TaskItem = {
      id: 'clean-1',
      title: 'Limpiar cristales',
      categoryId: 'limpieza',
      cycle_id: 'cycle_month',
      duration: 30,
      status: 'pending',
      type: 'task',
      created_at: '2026-10-31T00:00:00.000Z'
    };

    useAppStore.setState({
      lists: [gymList, cleaningList],
      cycles,
      listSections: [],
      tasks: {
        'gym-1': gymExercise,
        'clean-1': cleaningTask
      }
    });

    // Check gym identification helpers
    expect(isGymList('gimnasio', gymList)).toBe(true);
    expect(isGymTask(gymExercise, [gymList])).toBe(true);
    expect(isGymTask(cleaningTask, [cleaningList])).toBe(false);

    // Call getTasksByCycle for monthly routine
    const monthlyCycleTasks = useAppStore.getState().getTasksByCycle('cycle_month', true);
    
    // Flatten grouped tasks returned
    const allMonthlyTasks = Object.values(monthlyCycleTasks).flat();
    const taskIds = allMonthlyTasks.map(t => t.id);

    // Gym task must NOT appear in cycle_month cascade
    expect(taskIds).not.toContain('gym-1');
    // Cleaning task MUST appear
    expect(taskIds).toContain('clean-1');
  });
});

