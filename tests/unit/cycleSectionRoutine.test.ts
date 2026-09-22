import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../src/store/useAppStore';
import type { TaskItem, CustomList, ListSection } from '../../src/models/Task';
import { getEffectiveCycleId } from '../../src/utils/sectionRoutine';

describe('Vistas de ciclo/frecuencia — Conmutador [Solo | Todas] por sección', () => {
  const careListId = 'care';
  const limpiezaListId = 'limpieza';

  const baseTask = (overrides: Partial<TaskItem>): TaskItem => ({
    id: overrides.id || Math.random().toString(36).slice(2),
    user_id: 'u1',
    categoryId: careListId,
    type: 'task',
    title: 'Tarea',
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: 1,
    ...overrides,
  } as TaskItem);

  beforeEach(() => {
    const lists: CustomList[] = [
      { id: careListId, name: 'Care', color: '#ff2d55' },
      { id: limpiezaListId, name: 'Limpieza', color: '#34c759' },
    ];
    const listSections: ListSection[] = [
      { id: 'sec_care_diarias', listId: careListId, name: 'Diarias', order: 0 },
      { id: 'sec_care_semanales', listId: careListId, name: 'Semanales', order: 1 },
      { id: 'sec_limpieza_semanales', listId: limpiezaListId, name: 'Semanales', order: 0 },
    ];
    const tasks: Record<string, TaskItem> = {};

    // 4 tareas semanales en Care
    for (let i = 0; i < 4; i++) {
      const t = baseTask({
        id: `care_week_${i}`,
        categoryId: careListId,
        cycle_id: 'cycle_week',
        title: `Care Semanal ${i}`
      });
      tasks[t.id] = t;
    }

    // 26 tareas diarias en Care
    for (let i = 0; i < 26; i++) {
      const t = baseTask({
        id: `care_day_${i}`,
        categoryId: careListId,
        cycle_id: 'cycle_day',
        title: `Care Diario ${i}`
      });
      tasks[t.id] = t;
    }

    // 2 tareas semanales en Limpieza (y ninguna diaria)
    for (let i = 0; i < 2; i++) {
      const t = baseTask({
        id: `limpieza_week_${i}`,
        categoryId: limpiezaListId,
        cycle_id: 'cycle_week',
        title: `Limpieza Semanal ${i}`
      });
      tasks[t.id] = t;
    }

    useAppStore.setState({ lists, listSections, tasks } as any);
  });

  it('calcula correctamente los conteos only y full en cycle_week', () => {
    const store = useAppStore.getState();
    const tasks = Object.values(store.tasks);
    const cycles = store.cycles;
    const currentCycle = cycles.find(c => c.id === 'cycle_week')!;

    const counts: Record<string, { only: number; full: number }> = {};
    const validCycles = cycles.filter(c => c.daysValue <= currentCycle.daysValue).map(c => c.id);

    tasks.forEach(t => {
      const effCycle = getEffectiveCycleId(t, store.listSections, store.lists);
      if (!effCycle || !validCycles.includes(effCycle)) return;
      const catId = t.categoryId || (t as any).category_id || 'inbox';
      if (!counts[catId]) counts[catId] = { only: 0, full: 0 };
      counts[catId].full++;
      if (effCycle === currentCycle.id) counts[catId].only++;
    });

    // Care tiene 4 semanales y 26 diarias -> only: 4, full: 30 (full > only activa el conmutador)
    expect(counts[careListId]).toBeDefined();
    expect(counts[careListId].only).toBe(4);
    expect(counts[careListId].full).toBe(30);
    expect(counts[careListId].full > counts[careListId].only).toBe(true);

    // Limpieza tiene 2 semanales y 0 diarias -> only: 2, full: 2 (no activa conmutador redundante)
    expect(counts[limpiezaListId]).toBeDefined();
    expect(counts[limpiezaListId].only).toBe(2);
    expect(counts[limpiezaListId].full).toBe(2);
    expect(counts[limpiezaListId].full > counts[limpiezaListId].only).toBe(false);
  });

  it('filtra tareas según el modo per-section (only_section vs full_routine) en cycle_week', () => {
    const store = useAppStore.getState();
    const rawGrouped = store.getTasksByCycle('cycle_week', true);

    const filterForSection = (key: string, mode: 'only_section' | 'full_routine') => {
      const taskList = rawGrouped[key] || [];
      const allowedCycles = new Set<string>();
      if (mode === 'full_routine') {
        store.cycles.filter(c => c.daysValue <= 7).forEach(c => allowedCycles.add(c.id));
      } else {
        allowedCycles.add('cycle_week');
      }

      return taskList.filter(t => {
        const eff = getEffectiveCycleId(t, store.listSections, store.lists);
        return eff && allowedCycles.has(eff);
      });
    };

    // Si Care está en modo 'only_section': debe tener exactamente 4 tareas
    const careOnly = filterForSection(careListId, 'only_section');
    expect(careOnly.length).toBe(4);
    expect(careOnly.every(t => t.cycle_id === 'cycle_week')).toBe(true);

    // Si Care está en modo 'full_routine': debe tener todas las 30 tareas (semanales + diarias)
    const careFull = filterForSection(careListId, 'full_routine');
    expect(careFull.length).toBe(30);

    // Independencia: Limpieza en 'only_section' mientras Care está en 'full_routine'
    const limpiezaOnly = filterForSection(limpiezaListId, 'only_section');
    expect(limpiezaOnly.length).toBe(2);
  });

  it('en cycle_day no genera conmutador redundante porque full === only', () => {
    const store = useAppStore.getState();
    const tasks = Object.values(store.tasks);
    const cycles = store.cycles;
    const currentCycle = cycles.find(c => c.id === 'cycle_day')!;

    const counts: Record<string, { only: number; full: number }> = {};
    const validCycles = cycles.filter(c => c.daysValue <= currentCycle.daysValue).map(c => c.id);

    tasks.forEach(t => {
      const effCycle = getEffectiveCycleId(t, store.listSections, store.lists);
      if (!effCycle || !validCycles.includes(effCycle)) return;
      const catId = t.categoryId || (t as any).category_id || 'inbox';
      if (!counts[catId]) counts[catId] = { only: 0, full: 0 };
      counts[catId].full++;
      if (effCycle === currentCycle.id) counts[catId].only++;
    });

    // En diario todas las tareas válidas son diarias, por lo que full == only
    expect(counts[careListId].only).toBe(26);
    expect(counts[careListId].full).toBe(26);
    expect(counts[careListId].full > counts[careListId].only).toBe(false);
  });
});
