import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getStartOfNextWeek, isCompletedInCurrentPeriod } from '../../src/services/TaskService';

const originalTimeZone = process.env.TZ;

beforeAll(() => {
  process.env.TZ = 'Europe/Madrid';
});

afterAll(() => {
  if (originalTimeZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimeZone;
});

const completed = (cycle_id: string, completion: Date, cycles: any[], reference: Date) =>
  isCompletedInCurrentPeriod(
    { cycle_id, completionHistory: [completion.getTime()] },
    cycles,
    undefined,
    undefined,
    reference
  );

describe('weekly recurrence boundaries across daylight-saving changes', () => {
  it('keeps the last Sunday hour in the autumn week', () => {
    const reference = new Date(2026, 9, 25, 12);
    const sundayLate = new Date(2026, 9, 25, 23, 30);
    const nextMonday = new Date(2026, 9, 26, 0, 0);

    expect(completed('cycle_week', sundayLate, [], reference)).toBe(true);
    expect(completed('cycle_week', nextMonday, [], reference)).toBe(false);
    expect(getStartOfNextWeek(reference).getTime()).toBe(nextMonday.getTime());
  });

  it('does not include Monday after the spring week has ended', () => {
    const reference = new Date(2026, 2, 29, 12);
    const sundayLate = new Date(2026, 2, 29, 23, 30);
    const nextMonday = new Date(2026, 2, 30, 0, 30);

    expect(completed('cycle_week', sundayLate, [], reference)).toBe(true);
    expect(completed('cycle_week', nextMonday, [], reference)).toBe(false);
    expect(getStartOfNextWeek(reference).getTime()).toBe(new Date(2026, 2, 30, 0, 0).getTime());
  });

  it('uses the same calendar boundaries for custom seven-day cycles', () => {
    const reference = new Date(2026, 9, 25, 12);
    const cycle = { id: 'custom-seven', name: 'Cada semana', daysValue: 7 };

    expect(completed('custom-seven', new Date(2026, 9, 25, 23, 30), [cycle], reference)).toBe(true);
    expect(completed('custom-seven', new Date(2026, 9, 26, 0, 0), [cycle], reference)).toBe(false);
  });
});
