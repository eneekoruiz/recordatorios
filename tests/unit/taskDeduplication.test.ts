import { describe, it, expect } from 'vitest';
import {
  normalizeTitle,
  areSectionsEquivalent,
  findDuplicateTask,
  deduplicateTaskList
} from '../../src/utils/taskDeduplication';
import type { TaskItem } from '../../src/models/Task';

describe('taskDeduplication', () => {
  describe('normalizeTitle', () => {
    it('normaliza títulos eliminando puntuación final (puntos, comas, exclamaciones)', () => {
      expect(normalizeTitle('Hacer la cama / acomodar la cama.')).toBe('hacer la cama / acomodar la cama');
      expect(normalizeTitle('Hacer la cama / acomodar la cama')).toBe('hacer la cama / acomodar la cama');
      expect(normalizeTitle('Aspirar y fregar suelo...')).toBe('aspirar y fregar suelo');
      expect(normalizeTitle('¡Lavar los platos!')).toBe('¡lavar los platos');
      expect(normalizeTitle('Lavar los platos!')).toBe('lavar los platos');
    });

    it('elimina prefijos de ciclos temporales [D], [S], [M], [A]', () => {
      expect(normalizeTitle('[D] Hacer la cama')).toBe('hacer la cama');
      expect(normalizeTitle('[s] Cambiar sábanas')).toBe('cambiar sábanas');
      expect(normalizeTitle('[M] Limpiar horno')).toBe('limpiar horno');
      expect(normalizeTitle('[A] Seguro de coche')).toBe('seguro de coche');
    });

    it('elimina precios y símbolos de monedas', () => {
      expect(normalizeTitle('Comprar leche 1.50€')).toBe('comprar leche');
      expect(normalizeTitle('Zapatillas $80')).toBe('zapatillas');
      expect(normalizeTitle('Suscripción 12 eur')).toBe('suscripción');
    });

    it('maneja strings vacíos o nulos sin lanzar errores', () => {
      expect(normalizeTitle('')).toBe('');
      expect(normalizeTitle(null)).toBe('');
      expect(normalizeTitle(undefined)).toBe('');
    });
  });

  describe('areSectionsEquivalent', () => {
    it('reconoce alias entre prefijos y singular/plural', () => {
      expect(areSectionsEquivalent('sec_limpieza_diaria', 'sec_limp_diaria')).toBe(true);
      expect(areSectionsEquivalent('sec_care_diarias', 'sec_care_diaria')).toBe(true);
      expect(areSectionsEquivalent('sec_limp_semanal_hab', 'sec_limpieza_semanal_hab')).toBe(true);
    });

    it('distingue secciones diferentes', () => {
      expect(areSectionsEquivalent('sec_limp_diaria', 'sec_limp_semanal')).toBe(false);
      expect(areSectionsEquivalent('sec_limp_diaria_hab', 'sec_limp_diaria_cocina')).toBe(false);
    });
  });

  describe('findDuplicateTask', () => {
    const existingTasks: Record<string, TaskItem> = {
      t1: {
        id: 't1',
        title: 'Hacer la cama / acomodar la cama',
        categoryId: 'limpieza',
        sectionId: 'sec_limp_diaria_hab',
        status: 'pending',
        version: 4
      } as TaskItem,
      t2: {
        id: 't2',
        title: 'Ventilar la habitación',
        categoryId: 'limpieza',
        sectionId: 'sec_limp_diaria_hab',
        status: 'pending',
        version: 1
      } as TaskItem,
      t3_deleted: {
        id: 't3_deleted',
        title: 'Barrer cocina',
        categoryId: 'limpieza',
        sectionId: 'sec_limp_diaria_cocina',
        status: 'pending',
        deleted_at: '2026-09-24T10:00:00Z'
      } as TaskItem
    };

    it('detecta duplicado si solo varía por punto final', () => {
      const candidate = {
        title: 'Hacer la cama / acomodar la cama.',
        categoryId: 'limpieza',
        sectionId: 'sec_limp_diaria_hab'
      };
      const found = findDuplicateTask(candidate, existingTasks);
      expect(found).not.toBeNull();
      expect(found?.id).toBe('t1');
    });

    it('detecta duplicado si varía por mayúsculas o prefijo de ciclo', () => {
      const candidate = {
        title: '[D] HACER LA CAMA / ACOMODAR LA CAMA',
        categoryId: 'limpieza',
        sectionId: 'sec_limp_diaria_hab'
      };
      const found = findDuplicateTask(candidate, existingTasks);
      expect(found).not.toBeNull();
      expect(found?.id).toBe('t1');
    });

    it('detecta duplicado con secciones aliadas (sec_limpieza_ vs sec_limp_)', () => {
      const candidate = {
        title: 'Hacer la cama / acomodar la cama',
        categoryId: 'limpieza',
        sectionId: 'sec_limpieza_diaria_hab'
      };
      const found = findDuplicateTask(candidate, existingTasks);
      expect(found).not.toBeNull();
      expect(found?.id).toBe('t1');
    });

    it('ignora tareas borradas', () => {
      const candidate = {
        title: 'Barrer cocina',
        categoryId: 'limpieza',
        sectionId: 'sec_limp_diaria_cocina'
      };
      const found = findDuplicateTask(candidate, existingTasks);
      expect(found).toBeNull();
    });
  });

  describe('deduplicateTaskList', () => {
    it('elimina tareas duplicadas en una lista dejando únicamente una', () => {
      const tasks: TaskItem[] = [
        {
          id: '1',
          title: 'Aspirar toda la habitación si hay pelusas visibles.',
          version: 4,
          status: 'pending'
        } as TaskItem,
        {
          id: '2_old',
          title: 'Hacer la cama / acomodar la cama.',
          version: 3,
          status: 'pending',
          updated_at: '2026-09-23T13:47:52Z'
        } as TaskItem,
        {
          id: '2_new',
          title: 'Hacer la cama / acomodar la cama',
          version: 4,
          status: 'pending',
          updated_at: '2026-09-23T16:22:50Z'
        } as TaskItem,
        {
          id: '3',
          title: 'Ventilar la habitación',
          version: 4,
          status: 'pending'
        } as TaskItem
      ];

      const result = deduplicateTaskList(tasks);
      expect(result).toHaveLength(3);

      const titles = result.map(t => t.title);
      expect(titles).toContain('Aspirar toda la habitación si hay pelusas visibles.');
      expect(titles).toContain('Ventilar la habitación');

      // Solo una versión de la cama debe estar presente, y debe ser la v4
      const bedTasks = result.filter(t => t.title.toLowerCase().includes('cama'));
      expect(bedTasks).toHaveLength(1);
      expect(bedTasks[0].id).toBe('2_new');
      expect(bedTasks[0].version).toBe(4);
    });

    it('prefiere tareas pendientes frente a tareas completadas si hay duplicados', () => {
      const tasks: TaskItem[] = [
        { id: 'done', title: 'Comprar leche.', status: 'completed', completed: true, version: 5 } as TaskItem,
        { id: 'pending', title: 'Comprar leche', status: 'pending', completed: false, version: 1 } as TaskItem
      ];

      const result = deduplicateTaskList(tasks);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('pending');
    });
  });
});
