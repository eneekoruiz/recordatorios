import { describe, it, expect } from 'vitest';
import { getWeeklySplitSchedule, getWeeklyScheduleForDate } from '../../src/utils/weeklyPlan';
import type { ListSection } from '../../src/models/Task';

describe('weeklyPlan', () => {
  const dummySections: ListSection[] = [
    { id: 'sec_1', listId: 'gym', name: 'Día 1: Tren Superior A', order: 0 },
    { id: 'sec_2', listId: 'gym', name: 'Día 2: Tren Inferior A', order: 1 },
    { id: 'sec_3', listId: 'gym', name: 'Día 3: Tren Superior B', order: 2 },
    { id: 'sec_4', listId: 'gym', name: 'Día 4: Tren Inferior B', order: 3 },
  ];

  it('generates a 7-day schedule for torso_pierna_4d with explicit rest days on Wednesday, Saturday, and Sunday', () => {
    const monday = new Date('2026-10-26T10:00:00Z'); // Lunes
    const schedule = getWeeklySplitSchedule('torso_pierna_4d', dummySections, monday);

    expect(schedule).toHaveLength(7);

    // Lunes: Día 1
    expect(schedule[0].fullWeekday).toBe('Lunes');
    expect(schedule[0].isRest).toBe(false);
    expect(schedule[0].shortLabel).toBe('Día 1');
    expect(schedule[0].title).toBe('Tren Superior A');
    expect(schedule[0].isToday).toBe(true);

    // Martes: Día 2
    expect(schedule[1].fullWeekday).toBe('Martes');
    expect(schedule[1].isRest).toBe(false);
    expect(schedule[1].shortLabel).toBe('Día 2');
    expect(schedule[1].title).toBe('Tren Inferior A');

    // Miércoles: Descanso
    expect(schedule[2].fullWeekday).toBe('Miércoles');
    expect(schedule[2].isRest).toBe(true);
    expect(schedule[2].shortLabel).toBe('Descanso');

    // Jueves: Día 3
    expect(schedule[3].fullWeekday).toBe('Jueves');
    expect(schedule[3].isRest).toBe(false);
    expect(schedule[3].shortLabel).toBe('Día 3');

    // Viernes: Día 4
    expect(schedule[4].fullWeekday).toBe('Viernes');
    expect(schedule[4].isRest).toBe(false);
    expect(schedule[4].shortLabel).toBe('Día 4');

    // Sábado y Domingo: Descanso
    expect(schedule[5].isRest).toBe(true);
    expect(schedule[6].isRest).toBe(true);
  });

  it('correctly maps ppl_3d with rest on Tuesday, Thursday, and Weekend', () => {
    const wednesday = new Date('2026-10-28T10:00:00Z'); // Miércoles
    const pplSections: ListSection[] = [
      { id: 'p1', listId: 'gym', name: 'Día 1: Empuje', order: 0 },
      { id: 'p2', listId: 'gym', name: 'Día 2: Tirón', order: 1 },
      { id: 'p3', listId: 'gym', name: 'Día 3: Pierna', order: 2 },
    ];
    const schedule = getWeeklySplitSchedule('ppl_3d', pplSections, wednesday);

    expect(schedule[0].isRest).toBe(false); // Lunes: Día 1
    expect(schedule[1].isRest).toBe(true);  // Martes: Descanso
    expect(schedule[2].isRest).toBe(false); // Miércoles: Día 2
    expect(schedule[2].isToday).toBe(true);
    expect(schedule[3].isRest).toBe(true);  // Jueves: Descanso
    expect(schedule[4].isRest).toBe(false); // Viernes: Día 3
    expect(schedule[5].isRest).toBe(true);  // Sábado: Descanso
    expect(schedule[6].isRest).toBe(true);  // Domingo: Descanso
  });

  it('retrieves the exact scheduled day for a specific calendar date', () => {
    const wednesday = new Date('2026-10-28T10:00:00Z'); // Miércoles
    const plan = getWeeklyScheduleForDate(wednesday, 'torso_pierna_4d', dummySections);

    expect(plan).not.toBeNull();
    expect(plan?.fullWeekday).toBe('Miércoles');
    expect(plan?.isRest).toBe(true);
    expect(plan?.shortLabel).toBe('Descanso');

    const thursday = new Date('2026-10-29T10:00:00Z'); // Jueves
    const thursPlan = getWeeklyScheduleForDate(thursday, 'torso_pierna_4d', dummySections);
    expect(thursPlan?.fullWeekday).toBe('Jueves');
    expect(thursPlan?.isRest).toBe(false);
    expect(thursPlan?.shortLabel).toBe('Día 3');
    expect(thursPlan?.title).toBe('Tren Superior B');
  });
});
