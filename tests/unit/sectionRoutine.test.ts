import { describe, it, expect } from 'vitest';
import {
  getSectionPeriodicity,
  getTaskPeriodicity,
  getRoutineAllowedPeriodicities,
  getPureCyclicPeriodicity,
  sortTasksByRoutinePriority,
  sortTasksByUserPreference,
  formatSectionTitle,
  getEffectiveCycleId,
  stripPeriodicityPrefix,
  hasPeriodicityPrefix,
  getPeriodicityFromPrefix
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

  it('getPureCyclicPeriodicity solo reconoce el nombre EXACTO de una periodicidad, no secciones personalizadas que solo la mencionan', () => {
    expect(getPureCyclicPeriodicity('Diaria')).toBe('day');
    expect(getPureCyclicPeriodicity('diarias')).toBe('day');
    expect(getPureCyclicPeriodicity('RECURRENTES')).toBe('day');
    expect(getPureCyclicPeriodicity('Semanal')).toBe('week');
    expect(getPureCyclicPeriodicity('Mensuales')).toBe('month');
    expect(getPureCyclicPeriodicity('⏳ Anual')).toBe('year');

    // Secciones personalizadas que solo mencionan la periodicidad NO deben fusionarse
    expect(getPureCyclicPeriodicity('Compra semanal de fruta')).toBeNull();
    expect(getPureCyclicPeriodicity('Semana Santa')).toBeNull();
    expect(getPureCyclicPeriodicity('Cocina')).toBeNull();
    expect(getPureCyclicPeriodicity(undefined)).toBeNull();
  });

  it('sortTasksByUserPreference intercala tareas de distinta periodicidad por fecha, sin agruparlas en bloques', () => {
    const mk = (id: string, dueDate: string, cycle_id?: string): TaskItem => ({
      id,
      user_id: 'u1',
      type: 'task',
      title: id,
      status: 'pending',
      dueDate,
      cycle_id,
      created_at: dueDate,
      updated_at: dueDate,
      version: 1
    } as TaskItem);

    // Orden cronológico deliberadamente intercalado entre periodicidades distintas
    const monthly = mk('monthly', '2026-01-10', 'cycle_month');
    const daily = mk('daily', '2026-01-11', 'cycle_day');
    const weekly = mk('weekly', '2026-01-12', 'cycle_week');
    const yearly = mk('yearly', '2026-01-13', 'cycle_year');

    // Mezclados y desordenados a propósito
    const mixed = [yearly, monthly, weekly, daily];
    const sorted = sortTasksByUserPreference(mixed, 'dueDate');

    // Debe respetar el orden cronológico real, NO agrupar primero mensuales, luego semanales, etc.
    expect(sorted.map(t => t.id)).toEqual(['monthly', 'daily', 'weekly', 'yearly']);
  });

  it('sortTasksByUserPreference respeta el orden manual (campo order) igual que una sección normal', () => {
    const mk = (id: string, order: number): TaskItem => ({
      id,
      user_id: 'u1',
      type: 'task',
      title: id,
      status: 'pending',
      order,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1
    } as TaskItem);

    const tasks = [mk('c', 3), mk('a', 1), mk('b', 2)];
    const sorted = sortTasksByUserPreference(tasks, 'manual');
    expect(sorted.map(t => t.id)).toEqual(['a', 'b', 'c']);
  });

  describe('getEffectiveCycleId', () => {
    it('prioritizes title prefix [D] over a mismatched cycle_id (e.g. cycle_week)', () => {
      const task: Partial<TaskItem> = {
        title: '[D] Lavar rostro.',
        cycle_id: 'cycle_week'
      };
      expect(getEffectiveCycleId(task)).toBe('cycle_day');
    });

    it('prioritizes title prefix [S] over a mismatched cycle_id', () => {
      const task: Partial<TaskItem> = {
        title: '[S] Exfoliar rostro.',
        cycle_id: 'cycle_day'
      };
      expect(getEffectiveCycleId(task)).toBe('cycle_week');
    });

    it('prioritizes title prefix [M] over a mismatched cycle_id', () => {
      const task: Partial<TaskItem> = {
        title: '[M] Mascarilla profunda.',
        cycle_id: 'cycle_week'
      };
      expect(getEffectiveCycleId(task)).toBe('cycle_month');
    });

    it('prioritizes title prefix [A] over a mismatched cycle_id', () => {
      const task: Partial<TaskItem> = {
        title: '[A] Revisión dermatológica.',
        cycle_id: 'cycle_day'
      };
      expect(getEffectiveCycleId(task)).toBe('cycle_year');
    });

    it('returns explicit cycle_id when no conflicting title prefix is present', () => {
      const task: Partial<TaskItem> = {
        title: 'Pagar alquiler',
        cycle_id: 'cycle_month'
      };
      expect(getEffectiveCycleId(task)).toBe('cycle_month');
    });

    it('returns cycle deduced from section when title and cycle_id are neutral', () => {
      const task: Partial<TaskItem> = {
        title: 'Pasar mopa',
        sectionId: 'sec_diarias'
      };
      const sections: ListSection[] = [
        { id: 'sec_diarias', listId: 'limpieza', name: 'Diarias', order: 0 }
      ];
      expect(getEffectiveCycleId(task, sections)).toBe('cycle_day');
    });
  });

  describe('stripPeriodicityPrefix & prefix detection', () => {
    it('detects periodicity from various prefix styles correctly', () => {
      expect(hasPeriodicityPrefix('[D] Lavar rostro.')).toBe(true);
      expect(hasPeriodicityPrefix('[Diario] Hacer cama')).toBe(true);
      expect(hasPeriodicityPrefix('(D) Cafe')).toBe(true);
      expect(hasPeriodicityPrefix('[S] Exfoliar')).toBe(true);
      expect(hasPeriodicityPrefix('[Semanal] Limpiar coche')).toBe(true);
      expect(hasPeriodicityPrefix('[M] Revisar filtros')).toBe(true);
      expect(hasPeriodicityPrefix('[A] Seguro coche')).toBe(true);
      expect(hasPeriodicityPrefix('Tarea normal')).toBe(false);
      expect(hasPeriodicityPrefix('')).toBe(false);
      expect(hasPeriodicityPrefix(null)).toBe(false);
    });

    it('extracts correct periodicity from prefix', () => {
      expect(getPeriodicityFromPrefix('[D] Tarea')).toBe('day');
      expect(getPeriodicityFromPrefix('(Diaria) Tarea')).toBe('day');
      expect(getPeriodicityFromPrefix('[S] Tarea')).toBe('week');
      expect(getPeriodicityFromPrefix('[M] Tarea')).toBe('month');
      expect(getPeriodicityFromPrefix('[A] Tarea')).toBe('year');
      expect(getPeriodicityFromPrefix('Sin prefijo')).toBeNull();
    });

    it('strips periodicity prefix cleanly without leaving colons or stray spaces', () => {
      expect(stripPeriodicityPrefix('[D] Lavar rostro.')).toBe('Lavar rostro.');
      expect(stripPeriodicityPrefix('[D]: Lavar rostro.')).toBe('Lavar rostro.');
      expect(stripPeriodicityPrefix('[D] - Lavar rostro.')).toBe('Lavar rostro.');
      expect(stripPeriodicityPrefix('(D) Lavar rostro.')).toBe('Lavar rostro.');
      expect(stripPeriodicityPrefix('[S] Exfoliar el rostro')).toBe('Exfoliar el rostro');
      expect(stripPeriodicityPrefix('[M] Mascarilla profunda')).toBe('Mascarilla profunda');
      expect(stripPeriodicityPrefix('[A] Revisión anual')).toBe('Revisión anual');
      expect(stripPeriodicityPrefix('Comprar manzanas')).toBe('Comprar manzanas');
      expect(stripPeriodicityPrefix('')).toBe('');
      expect(stripPeriodicityPrefix(null)).toBe('');
    });
  });
});
