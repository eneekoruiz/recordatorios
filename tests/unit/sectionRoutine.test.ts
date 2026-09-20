import { describe, it, expect } from 'vitest';
import {
  getSectionPeriodicity,
  getTaskPeriodicity,
  getRoutineAllowedPeriodicities,
  sortTasksByRoutinePriority,
  formatSectionTitle
} from '../../src/utils/sectionRoutine';
import type { TaskItem, ListSection, CustomList } from '../../src/models/Task';

describe('sectionRoutine utility', () => {
  const mockSections: ListSection[] = [
    { id: 'sec_rec', listId: 'list_quehaceres', name: 'RECURRENTES', order: 0 },
    { id: 'sec_otras', listId: 'list_quehaceres', name: 'OTRAS', order: 1 }
  ];

  const mockLists: CustomList[] = [
    { id: 'list_quehaceres', name: 'Quehaceres', color: '#34c759' }
  ];

  it('detects periodicity from section name "RECURRENTES" as day', () => {
    const periodicity = getSectionPeriodicity('section_sec_rec', 'RECURRENTES', mockSections, mockLists);
    expect(periodicity).toBe('day');
  });

  it('calculates strictly section tasks vs full routine tasks correctly', () => {
    // 13 tasks in section_sec_rec
    const sectionTasks: TaskItem[] = Array.from({ length: 13 }, (_, i) => ({
      id: `task_rec_${i + 1}`,
      title: `Tarea recurrente ${i + 1}`,
      completed: false,
      sectionId: 'sec_rec',
      created_at: new Date().toISOString(),
      cycle_id: 'cycle_day'
    }));

    // 5 other tasks in sec_otras that have daily periodicity
    const otherRoutineTasks: TaskItem[] = Array.from({ length: 5 }, (_, i) => ({
      id: `task_other_${i + 1}`,
      title: `Otra diaria ${i + 1}`,
      completed: false,
      sectionId: 'sec_otras',
      created_at: new Date().toISOString(),
      cycle_id: 'cycle_day'
    }));

    // 2 non-routine tasks in sec_otras
    const nonRoutineTasks: TaskItem[] = Array.from({ length: 2 }, (_, i) => ({
      id: `task_non_${i + 1}`,
      title: `No periodica ${i + 1}`,
      completed: false,
      sectionId: 'sec_otras',
      created_at: new Date().toISOString()
    }));

    const allTasksInList = [...sectionTasks, ...otherRoutineTasks, ...nonRoutineTasks];
    const sectionPeriodicity = getSectionPeriodicity('section_sec_rec', 'RECURRENTES', mockSections, mockLists)!;
    const allowed = getRoutineAllowedPeriodicities(sectionPeriodicity);

    // Filter other routine tasks from the list
    const matchingOther = allTasksInList.filter(t => {
      if (sectionTasks.some(st => st.id === t.id)) return false;
      const p = getTaskPeriodicity(t, mockSections, mockLists);
      return p && allowed.has(p);
    });

    const strictlySectionTasks = sectionTasks;
    const fullRoutineTasks = [...sectionTasks, ...matchingOther];

    expect(strictlySectionTasks.length).toBe(13);
    expect(matchingOther.length).toBe(5);
    expect(fullRoutineTasks.length).toBe(18);

    // Sorting by routine priority retains all tasks
    const sorted = sortTasksByRoutinePriority(fullRoutineTasks, sectionPeriodicity, mockSections, mockLists);
    expect(sorted.length).toBe(18);
    expect(sorted.map(t => t.id)).toContain('task_rec_1');
    expect(sorted.map(t => t.id)).toContain('task_other_1');
  });

  it('unifies section titles to Apple-style Title Case plural (Diarias, Semanales, Mensuales, Anuales)', () => {
    expect(formatSectionTitle('Diaria')).toBe('Diarias');
    expect(formatSectionTitle('DIARIAS')).toBe('Diarias');
    expect(formatSectionTitle('diarias')).toBe('Diarias');
    expect(formatSectionTitle('⏳ Diario')).toBe('Diarias');
    expect(formatSectionTitle('RECURRENTES')).toBe('Diarias');

    expect(formatSectionTitle('Semanal')).toBe('Semanales');
    expect(formatSectionTitle('SEMANALES')).toBe('Semanales');
    expect(formatSectionTitle('semanales')).toBe('Semanales');
    expect(formatSectionTitle('⏳ Semanal')).toBe('Semanales');

    expect(formatSectionTitle('Mensual')).toBe('Mensuales');
    expect(formatSectionTitle('MENSUALES')).toBe('Mensuales');
    expect(formatSectionTitle('⏳ Mensual')).toBe('Mensuales');

    expect(formatSectionTitle('Anual')).toBe('Anuales');
    expect(formatSectionTitle('ANUALES')).toBe('Anuales');
    expect(formatSectionTitle('⏳ Anual')).toBe('Anuales');

    expect(formatSectionTitle('OTRAS')).toBe('Otras');
    expect(formatSectionTitle('COCINA')).toBe('Cocina');
    expect(formatSectionTitle('Tarjetas y Documentos')).toBe('Tarjetas y Documentos');
    expect(formatSectionTitle('⏳ Marzo 2026')).toBe('⏳ Marzo 2026');
  });
});
