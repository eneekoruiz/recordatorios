import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { draftFromText } from '../../src/utils/taskDraft';

describe('draftFromText — añadir dentro de una lista entiende lo mismo que la barra inferior', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 28, 10, 0)); // lunes 28-sep-2026
  });
  afterAll(() => vi.useRealTimers());

  it('saca fecha y hora del título y crea la alerta', () => {
    const d = draftFromText('Reunión mañana a las 10:00');
    expect(d.title).toBe('Reunión');
    expect(new Date(d.dueDate!).getDate()).toBe(29);
    expect(d.alerts?.map((a) => a.time)).toEqual(['10:00']);
  });

  it('entiende «a las 5» como las 17:00 (antes lo dejaba en las 05:00)', () => {
    expect(draftFromText('Llamar a Ana a las 5').alerts?.[0].time).toBe('17:00');
  });

  it('lee prioridad, ciclo y precio', () => {
    const d = draftFromText('Pagar el seguro !alta #mensual 45€');
    expect(d.priority).toBe('high');
    expect(d.cycle_id).toBe('cycle_month');
    expect(d.price).toBe(45);
    expect(d.title).toBe('Pagar el seguro');
  });

  it('un texto sin nada especial se queda tal cual', () => {
    expect(draftFromText('  Comprar pan  ')).toEqual({ title: 'Comprar pan' });
  });

  it('nunca deja el título vacío', () => {
    expect(draftFromText('mañana a las 10').title.length).toBeGreaterThan(0);
  });
});
