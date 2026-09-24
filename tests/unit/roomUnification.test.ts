import { describe, it, expect } from 'vitest';
import { getRoomForCleaningTask, isLimpiezaList } from '../../src/utils/specialLists';
import { deduplicateTaskList } from '../../src/utils/taskDeduplication';
import type { TaskItem } from '../../src/models/Task';

describe('Room Unification & Cleaning Routines', () => {
  describe('getRoomForCleaningTask', () => {
    it('accurately identifies Cocina tasks', () => {
      expect(getRoomForCleaningTask('Fregar los platos y cubiertos')).toBe('Cocina');
      expect(getRoomForCleaningTask('Limpiar la vitrocerámica y campana')).toBe('Cocina');
      expect(getRoomForCleaningTask('Vaciar lavavajillas')).toBe('Cocina');
      expect(getRoomForCleaningTask('Limpiar microondas y encimera')).toBe('Cocina');
    });

    it('accurately identifies Baño tasks', () => {
      expect(getRoomForCleaningTask('Limpiar lavabo y grifo')).toBe('Baño');
      expect(getRoomForCleaningTask('Desinfectar inodoro y ducha')).toBe('Baño');
      expect(getRoomForCleaningTask('Cambiar toalla de manos')).toBe('Baño');
      expect(getRoomForCleaningTask('Limpiar espejo del baño')).toBe('Baño');
    });

    it('accurately identifies Habitación tasks', () => {
      expect(getRoomForCleaningTask('Hacer la cama / acomodar la cama')).toBe('Habitación');
      expect(getRoomForCleaningTask('Aspirar el colchón y la base del canapé')).toBe('Habitación');
      expect(getRoomForCleaningTask('Cambiar sábanas y fundas')).toBe('Habitación');
      expect(getRoomForCleaningTask('Ordenar ropa de temporada en el armario')).toBe('Habitación');
    });

    it('accurately identifies Pasillo / Entrada tasks', () => {
      expect(getRoomForCleaningTask('Barrer el pasillo y la entrada')).toBe('Pasillo / Entrada');
      expect(getRoomForCleaningTask('Ordenar zapatero de la entrada')).toBe('Pasillo / Entrada');
      expect(getRoomForCleaningTask('Limpiar espejo del recibidor')).toBe('Pasillo / Entrada');
    });

    it('accurately identifies Balcón tasks', () => {
      expect(getRoomForCleaningTask('Barrer el suelo del balcón')).toBe('Balcón');
      expect(getRoomForCleaningTask('Limpiar barandilla exterior y terraza')).toBe('Balcón');
    });

    it('falls back to General for general tasks', () => {
      expect(getRoomForCleaningTask('Ventilar toda la casa 10 minutos')).toBe('General');
      expect(getRoomForCleaningTask('Desempolvar superficies generales')).toBe('General');
    });
  });

  describe('isLimpiezaList', () => {
    it('recognizes Limpieza lists by ID or name', () => {
      expect(isLimpiezaList('limpieza')).toBe(true);
      expect(isLimpiezaList('list_limpieza')).toBe(true);
      expect(isLimpiezaList(null, { id: 'custom_1', name: 'Limpieza', color: '#34c759' })).toBe(true);
      expect(isLimpiezaList('care')).toBe(false);
    });
  });

  describe('Room task aggregation and deduplication across cycles', () => {
    it('unifies daily and weekly tasks for the same room without duplicate titles', () => {
      const dailyCocinaTask: TaskItem = {
        id: 'task_daily_1',
        title: 'Fregar la encimera.',
        status: 'pending',
        categoryId: 'limpieza',
        sectionId: 'sec_limp_diaria_cocina',
        cycle_id: 'cycle_day',
        created_at: new Date().toISOString(),
        order: 0
      };

      const weeklyCocinaTask: TaskItem = {
        id: 'task_weekly_1',
        title: 'Limpiar el horno a fondo.',
        status: 'pending',
        categoryId: 'limpieza',
        sectionId: 'sec_limp_semanal_cocina',
        cycle_id: 'cycle_week',
        created_at: new Date().toISOString(),
        order: 1
      };

      const dupeWeeklyTask: TaskItem = {
        id: 'task_weekly_dupe',
        title: 'Fregar la encimera', // duplicate of daily task with dot stripped
        status: 'completed',
        categoryId: 'limpieza',
        sectionId: 'sec_limp_semanal_cocina',
        cycle_id: 'cycle_week',
        created_at: new Date().toISOString(),
        order: 2
      };

      const roomTasks = [dailyCocinaTask, weeklyCocinaTask, dupeWeeklyTask];
      const deduplicated = deduplicateTaskList(roomTasks);

      // Should keep 2 distinct tasks (Fregar la encimera and Limpiar el horno a fondo)
      expect(deduplicated).toHaveLength(2);
      // The pending task should be preserved over the completed duplicate
      const encimeraTask = deduplicated.find(t => t.title.includes('encimera'));
      expect(encimeraTask?.id).toBe('task_daily_1');
      expect(encimeraTask?.status).toBe('pending');
    });
  });
});
