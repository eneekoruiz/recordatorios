import { describe, it, expect } from 'vitest';
import { extractPrice, normalizeTaskPrices } from '../../src/utils/priceExtractor';
import type { TaskItem } from '../../src/models/Task';

describe('extractPrice', () => {
  it('extracts price from Spanish shorthand "100 e" and cleans title', () => {
    const res = extractPrice('Ropa interior 100 e', false);
    expect(res).toEqual({
      price: 100,
      cleanText: 'Ropa interior'
    });
  });

  it('extracts price from "Zapatillas 200 e"', () => {
    const res = extractPrice('Zapatillas 200 e', false);
    expect(res).toEqual({
      price: 200,
      cleanText: 'Zapatillas'
    });
  });

  it('extracts price from pure note "50 e"', () => {
    const res = extractPrice('50 e', true);
    expect(res).toEqual({
      price: 50,
      cleanText: ''
    });
  });

  it('extracts price from pure numeric note "50"', () => {
    const res = extractPrice('50', true);
    expect(res).toEqual({
      price: 50,
      cleanText: ''
    });
  });

  it('extracts decimal prices with comma or dot (1.50€, 12,50 e)', () => {
    const res1 = extractPrice('Comprar pan 1.50€', false);
    expect(res1).toEqual({
      price: 1.5,
      cleanText: 'Comprar pan'
    });

    const res2 = extractPrice('Café 12,50 e', false);
    expect(res2).toEqual({
      price: 12.5,
      cleanText: 'Café'
    });
  });

  it('extracts prices with keywords (precio: 50, coste: 30 €)', () => {
    const res1 = extractPrice('precio: 45', true);
    expect(res1).toEqual({
      price: 45,
      cleanText: ''
    });

    const res2 = extractPrice('Libro coste: 30 €', false);
    expect(res2).toEqual({
      price: 30,
      cleanText: 'Libro'
    });
  });

  it('does NOT match quantity ranges like "(5 a 10 unidades)" or "(10 a 20 pares)"', () => {
    expect(extractPrice('Calzoncillos CK (5 a 10 unidades)', false)).toBeNull();
    expect(extractPrice('Calcetines (10 a 20 pares)', false)).toBeNull();
  });

  it('does NOT match Spanish conjunction "e" followed by words starting with i/hi', () => {
    expect(extractPrice('Tengo 10 e ir al dentista', false)).toBeNull();
    expect(extractPrice('Padre 2 e hijos', false)).toBeNull();
  });

  it('extracts prices inside parentheses "(100 e)" or "(50€)"', () => {
    const res = extractPrice('Zapatillas (100 e)', false);
    expect(res).toEqual({
      price: 100,
      cleanText: 'Zapatillas'
    });
  });
});

describe('normalizeTaskPrices', () => {
  const baseTask: TaskItem = {
    id: 'test-1',
    user_id: 'u1',
    type: 'task',
    title: 'Ropa interior 100 e',
    status: 'pending',
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  it('normalizes task with price in title', () => {
    const { task, modified } = normalizeTaskPrices(baseTask);
    expect(modified).toBe(true);
    expect(task.title).toBe('Ropa interior');
    expect(task.price).toBe(100);
  });

  it('normalizes task with price in description note', () => {
    const taskWithNote: TaskItem = {
      ...baseTask,
      title: 'Calzoncillos CK (5 a 10 unidades)',
      description: '50 e'
    };
    const { task, modified } = normalizeTaskPrices(taskWithNote);
    expect(modified).toBe(true);
    expect(task.title).toBe('Calzoncillos CK (5 a 10 unidades)');
    expect(task.description).toBeUndefined();
    expect(task.price).toBe(50);
  });

  it('preserves other description content when extracting price', () => {
    const taskWithComplexNote: TaskItem = {
      ...baseTask,
      title: 'Zapatillas deportivas',
      description: 'Comprar en tienda oficial 200 e'
    };
    const { task, modified } = normalizeTaskPrices(taskWithComplexNote);
    expect(modified).toBe(true);
    expect(task.price).toBe(200);
    expect(task.description).toBe('Comprar en tienda oficial');
  });

  it('does not modify tasks that do not contain prices', () => {
    const plainTask: TaskItem = {
      ...baseTask,
      title: 'Reunión de equipo',
      description: 'Discutir roadmap'
    };
    const { modified } = normalizeTaskPrices(plainTask);
    expect(modified).toBe(false);
  });
});
