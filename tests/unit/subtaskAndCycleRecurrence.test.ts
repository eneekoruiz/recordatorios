import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../src/store/useAppStore';
import { isCompletedInCurrentPeriod } from '../../src/services/TaskService';
import type { TaskItem } from '../../src/models/Task';

describe('Subtask completion & N-day cycle recurrence rollover', () => {
  beforeEach(() => {
    useAppStore.setState({
      tasks: {},
      lists: [{ id: 'agenda', name: 'Agenda', _is_dirty: false, updated_at: new Date().toISOString() }],
      listSections: [],
      cycles: [
        { id: 'cycle_day', name: 'Diario', daysValue: 1 },
        { id: 'cycle_custom_20', name: 'Cada 20 días', daysValue: 20 }
      ]
    });
  });

  it('completes subtasks when parent is completed in a normal list', () => {
    const parent: TaskItem = { id: 'p1', title: 'Objetivo', categoryId: 'agenda', status: 'pending', created_at: new Date().toISOString() };
    const c1: TaskItem = { id: 'c1', title: 'Sub 1', parentId: 'p1', categoryId: 'agenda', status: 'pending', created_at: new Date().toISOString() };
    const c2: TaskItem = { id: 'c2', title: 'Sub 2', parentId: 'p1', categoryId: 'agenda', status: 'pending', created_at: new Date().toISOString() };

    useAppStore.setState({ tasks: { p1: parent, c1, c2 } });

    useAppStore.getState().toggleTask('p1', false, Date.now());

    const state = useAppStore.getState();
    expect(state.tasks['p1']?.status).toBe('completed');
    expect(state.tasks['c1']?.status).toBe('completed');
    expect(state.tasks['c2']?.status).toBe('completed');
    expect(state.tasks['c1']?.parentId).toBe('p1');
  });

  it('completes subtasks with matching period timestamp when parent has custom cycle and timestamp', () => {
    const oct4 = new Date(2026, 9, 4, 10, 0, 0).getTime();
    const parent: TaskItem = { id: 'p20', title: 'Ciclo 20 días', categoryId: 'agenda', cycle_id: 'cycle_custom_20', status: 'pending', created_at: new Date(oct4).toISOString() };
    const c1: TaskItem = { id: 'c20_1', title: 'Sub 20 1', parentId: 'p20', categoryId: 'agenda', status: 'pending', created_at: new Date(oct4).toISOString() };

    useAppStore.setState({ tasks: { p20: parent, c20_1: c1 } });

    useAppStore.getState().toggleTask('p20', false, oct4);

    const state = useAppStore.getState();
    expect(state.tasks['p20']?.status).toBe('pending');
    expect(state.tasks['p20']?.completionHistory).toEqual([oct4]);
    expect(state.tasks['c20_1']?.status).toBe('pending');
    expect(state.tasks['c20_1']?.completionHistory).toEqual([oct4]);
    expect(state.tasks['c20_1']?.parentId).toBe('p20');
  });

  it('checks if a 20-day cycle completed on Oct 4 is considered completed on Oct 4-23 and pending on Oct 24', () => {
    const oct4 = new Date(2026, 9, 4, 10, 0, 0);
    const oct24 = new Date(2026, 9, 24, 10, 0, 0);

    const cycles = [
      { id: 'cycle_custom_20', name: 'Cada 20 días', daysValue: 20 }
    ];

    const task: TaskItem = {
      id: 'task_20',
      title: 'Hacer algo cada 20 días',
      cycle_id: 'cycle_custom_20',
      status: 'pending',
      created_at: oct4.toISOString(),
      completionHistory: [oct4.getTime()]
    };

    // On Oct 4: should be completed
    expect(isCompletedInCurrentPeriod(task, cycles, [], [], oct4)).toBe(true);

    // On Oct 14: should still be completed (10 days passed)
    const oct14 = new Date(2026, 9, 14, 10, 0, 0);
    expect(isCompletedInCurrentPeriod(task, cycles, [], [], oct14)).toBe(true);

    // On Oct 23: should still be completed (19 days passed)
    const oct23 = new Date(2026, 9, 23, 23, 59, 59);
    expect(isCompletedInCurrentPeriod(task, cycles, [], [], oct23)).toBe(true);

    // On Oct 24 at morning (08:00): 20 calendar days have passed, must be PENDING (false)!
    const oct24Morning = new Date(2026, 9, 24, 8, 0, 0);
    expect(isCompletedInCurrentPeriod(task, cycles, [], [], oct24Morning)).toBe(false);

    // On Oct 24 at 10:00: must be PENDING (false)!
    expect(isCompletedInCurrentPeriod(task, cycles, [], [], oct24)).toBe(false);
  });

  it('advances dueDate by 20 days when completed and rolls back on reverse', () => {
    const oct4 = new Date(2026, 9, 4, 10, 0, 0);
    const task: TaskItem = {
      id: 'task_due_20',
      title: 'Cita cada 20 días',
      categoryId: 'agenda',
      cycle_id: 'cycle_custom_20',
      dueDate: oct4.toISOString(),
      status: 'pending',
      created_at: oct4.toISOString()
    };

    useAppStore.setState({ tasks: { task_due_20: task } });

    // Complete on Oct 4
    useAppStore.getState().toggleTask('task_due_20', false, oct4.getTime());

    let state = useAppStore.getState();
    const updated = state.tasks['task_due_20'];
    expect(updated).toBeDefined();
    // Due date should now be advanced by 20 days -> Oct 24!
    const nextDue = new Date(updated.dueDate!);
    expect(nextDue.getDate()).toBe(24);
    expect(nextDue.getMonth()).toBe(9); // October
    expect(updated.status).toBe('pending');
    expect(updated.completionHistory?.length).toBe(1);

    // Now uncheck (reverse)
    useAppStore.getState().toggleTask('task_due_20', true, oct4.getTime());

    state = useAppStore.getState();
    const reverted = state.tasks['task_due_20'];
    const revertedDue = new Date(reverted.dueDate!);
    expect(revertedDue.getDate()).toBe(4);
    expect(revertedDue.getMonth()).toBe(9);
    expect(reverted.completionHistory?.length).toBe(0);
  });
});
