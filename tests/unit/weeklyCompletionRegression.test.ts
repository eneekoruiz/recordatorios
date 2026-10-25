import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { CustomList, ListSection, TaskItem } from '../../src/models/Task';
import { useAppStore } from '../../src/store/useAppStore';
import { getTaskPeriodicity } from '../../src/utils/sectionRoutine';
import { isCompletedInCurrentPeriod } from '../../src/services/TaskService';
import { calculateCompletedTasksDuration, calculateTasksDuration } from '../../src/utils/taskDuration';

const originalTimeZone = process.env.TZ;
const lists: CustomList[] = [{ id: 'house', name: 'Quehaceres diarios', color: '#007aff', listType: 'routines' }];
const sections: ListSection[] = [
  { id: 'weekly', listId: 'house', name: 'Semanales', order: 0 },
  { id: 'kitchen', listId: 'house', name: 'Cocina', parentId: 'weekly', order: 0 },
];
const task = (extra: Partial<TaskItem> = {}): TaskItem => ({
  id: 'weekly-task', title: 'Limpiar la cocina', categoryId: 'house', sectionId: 'kitchen',
  type: 'task', status: 'pending', duration: 30, user_id: 'test', version: 1,
  created_at: '2026-10-01T10:00:00.000Z', ...extra,
});

beforeAll(() => { process.env.TZ = 'Europe/Madrid'; });
afterAll(() => {
  if (originalTimeZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimeZone;
});
afterEach(() => vi.useRealTimers());

describe('weekly completion and remaining time', () => {
  it('inherits the weekly section before the daily list name or a repetition counter', () => {
    expect(getTaskPeriodicity(task(), sections, lists)).toBe('week');
    expect(getTaskPeriodicity(task({ targetCount: 3 }), sections, lists)).toBe('week');
    expect(getTaskPeriodicity(task({ cycle_id: 'cycle_day' }), sections, lists)).toBe('day');
  });

  it('subtracts checked recurring tasks immediately and restores the time when unchecked', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 24, 20));
    const first = task({ cycle_id: 'cycle_week' });
    const second = task({ id: 'other', cycle_id: 'cycle_week', duration: 150 });
    useAppStore.setState({ tasks: { [first.id]: first, [second.id]: second }, lists, listSections: sections, cycles: [] });
    expect(calculateTasksDuration([first, second], sections, lists).activeMinutes).toBe(180);
    useAppStore.getState().toggleTask(first.id);
    const checked = useAppStore.getState().tasks[first.id];
    expect(checked.status).toBe('pending');
    expect(calculateTasksDuration([checked, second], sections, lists).activeMinutes).toBe(150);
    expect(calculateCompletedTasksDuration([checked, second], sections, lists).activeMinutes).toBe(30);
    useAppStore.getState().toggleTask(first.id);
    expect(calculateTasksDuration(Object.values(useAppStore.getState().tasks), sections, lists).activeMinutes).toBe(180);
  });

  it('keeps Saturday completion through Sunday and resets only on Monday, including the DST change', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 24, 23, 50));
    const done = task({ completionHistory: [Date.now()] });
    for (const date of [new Date(2026, 9, 25, 0, 1), new Date(2026, 9, 25, 23, 59)]) {
      vi.setSystemTime(date);
      expect(isCompletedInCurrentPeriod(done, [], sections, lists)).toBe(true);
      expect(calculateTasksDuration([done], sections, lists).activeMinutes).toBe(0);
    }
    vi.setSystemTime(new Date(2026, 9, 26, 0));
    expect(isCompletedInCurrentPeriod(done, [], sections, lists)).toBe(false);
    expect(calculateTasksDuration([done], sections, lists).activeMinutes).toBe(30);
  });

  it('uses recorded period completion even if a legacy counter has since reset', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 25, 12));
    const done = task({ cycle_id: 'cycle_week', targetCount: 3, currentCount: 0, completionHistory: [new Date(2026, 9, 24, 18).getTime()] });
    expect(isCompletedInCurrentPeriod(done, [], sections, lists)).toBe(true);
  });

  it('keeps partial weekly counter progress overnight and resets it in the next week', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 24, 20));
    const counted = task({ cycle_id: 'cycle_week', targetCount: 3, currentCount: 1, updated_at: new Date().toISOString() });
    useAppStore.setState({ tasks: { [counted.id]: counted }, lists, listSections: sections, cycles: [] });
    vi.setSystemTime(new Date(2026, 9, 25, 12));
    useAppStore.getState().toggleTask(counted.id);
    expect(useAppStore.getState().tasks[counted.id].currentCount).toBe(2);
    vi.setSystemTime(new Date(2026, 9, 26, 0, 1));
    useAppStore.getState().toggleTask(counted.id);
    expect(useAppStore.getState().tasks[counted.id].currentCount).toBe(1);
  });

  it('does not count skipped routines as completed work', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 25, 12));
    const skipped = task({ cycle_id: 'cycle_week', skipHistory: [Date.now()] });
    expect(calculateTasksDuration([skipped], sections, lists).activeMinutes).toBe(0);
    expect(calculateCompletedTasksDuration([skipped], sections, lists).activeMinutes).toBe(0);
  });

  it('can undo and complete a recurring counter goal without retaining a stale completion', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 25, 12));
    const counted = task({ cycle_id: 'cycle_week', targetCount: 3, currentCount: 3, updated_at: new Date().toISOString(), completionHistory: [Date.now()] });
    useAppStore.setState({ tasks: { [counted.id]: counted }, lists, listSections: sections, cycles: [] });
    useAppStore.getState().toggleTask(counted.id);
    const undone = useAppStore.getState().tasks[counted.id];
    expect(undone.currentCount).toBe(2);
    expect(isCompletedInCurrentPeriod(undone, [], sections, lists)).toBe(false);
    useAppStore.getState().toggleTask(counted.id);
    expect(isCompletedInCurrentPeriod(useAppStore.getState().tasks[counted.id], [], sections, lists)).toBe(true);
  });

  it('calculates the selected period rather than today, including custom weekly cycles', () => {
    const sunday = new Date(2026, 9, 25, 12);
    const monday = new Date(2026, 9, 26, 0);
    const done = task({ cycle_id: 'rotation', categoryId: undefined, sectionId: undefined, completionHistory: [new Date(2026, 9, 24, 18).getTime()] });
    const cycles = [{ id: 'rotation', name: 'Cada siete días', daysValue: 7 }];
    expect(calculateTasksDuration([done], [], [], cycles, sunday).activeMinutes).toBe(0);
    expect(calculateTasksDuration([done], [], [], cycles, monday).activeMinutes).toBe(30);
    expect(calculateCompletedTasksDuration([done], [], [], cycles, sunday).activeMinutes).toBe(30);
  });
});
