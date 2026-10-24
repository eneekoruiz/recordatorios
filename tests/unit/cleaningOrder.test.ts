import { describe, it, expect } from 'vitest';
import { getCleaningPhase, sortByCleaningOrder, splitWholeHouseTasks } from '../../src/utils/cleaningOrder';
import { sortTasksByUserPreference } from '../../src/utils/sectionRoutine';
import type { TaskItem } from '../../src/models/Task';

const task = (title: string, order: number, cycle_id?: string): TaskItem => ({
  id: title,
  user_id: 'u1',
  type: 'task',
  title,
  status: 'pending',
  order,
  cycle_id,
  created_at: '2026-10-01T10:00:00.000Z',
  updated_at: '2026-10-01T10:00:00.000Z',
  version: 1,
} as TaskItem);

describe('getCleaningPhase', () => {
  it('pone primero lo que prepara la casa', () => {
    expect(getCleaningPhase('Ventilar toda la casa 10 minutos')).toBe(0);
    expect(getCleaningPhase('Recoger ropa del suelo')).toBe(0);
    expect(getCleaningPhase('Hacer la cama')).toBe(0);
    expect(getCleaningPhase('Vaciar el lavavajillas')).toBe(0);
    expect(getCleaningPhase('Cambiar sábanas')).toBe(0);
    expect(getCleaningPhase('Tirar el albornoz a la lavadora')).toBe(0);
  });

  it('limpia de arriba abajo y deja los suelos casi al final', () => {
    expect(getCleaningPhase('Quitar el polvo de muebles')).toBe(1);
    expect(getCleaningPhase('Limpiar filtro de la campana')).toBe(1);
    expect(getCleaningPhase('Limpiar interruptores y pomos')).toBe(1);
    expect(getCleaningPhase('Limpiar el horno a fondo')).toBe(2);
    expect(getCleaningPhase('Fregar los platos')).toBe(2);
    expect(getCleaningPhase('Barrer el suelo de la cocina')).toBe(3);
    expect(getCleaningPhase('Fregar el suelo de toda la casa')).toBe(4);
    expect(getCleaningPhase('Fregar zonas comunes')).toBe(4);
    expect(getCleaningPhase('Pasar aspiradora detrás de muebles accesibles')).toBe(3);
  });

  it('deja para el final la basura, consumibles, espejos y ambientador', () => {
    expect(getCleaningPhase('Sacar la basura orgánica')).toBe(5);
    expect(getCleaningPhase('Cambiar ambientador o recarga')).toBe(5);
    expect(getCleaningPhase('Cambiar toallas')).toBe(5);
    expect(getCleaningPhase('Poner papel higiénico')).toBe(5);
    expect(getCleaningPhase('Reponer jabón de manos')).toBe(5);
    expect(getCleaningPhase('Reponer jabón de platos (Fairy)')).toBe(5);
    expect(getCleaningPhase('Limpiar espejos')).toBe(5);
    expect(getCleaningPhase('Limpiar todos los espejos de la casa')).toBe(5);
  });

  it('lo que no reconoce queda en la fase intermedia', () => {
    expect(getCleaningPhase('Revisar silicona de la ducha')).toBe(2);
    expect(getCleaningPhase('')).toBe(2);
  });
});

describe('sortByCleaningOrder', () => {
  it('intercala frecuencias según la fase, no en bloques por frecuencia', () => {
    const tasks = [
      task('Fregar los platos', 0, 'cycle_day'),
      task('Vaciar el lavavajillas', 1, 'cycle_day'),
      task('Sacar la basura orgánica', 2, 'cycle_day'),
      task('Barrer el suelo de la cocina', 3, 'cycle_week'),
      task('Limpiar el horno a fondo', 4, 'cycle_month'),
      task('Limpiar filtro de la campana', 5, 'cycle_month'),
    ];
    expect(sortByCleaningOrder(tasks).map(t => t.title)).toEqual([
      'Vaciar el lavavajillas',
      'Limpiar filtro de la campana',
      'Fregar los platos',
      'Limpiar el horno a fondo',
      'Barrer el suelo de la cocina',
      'Sacar la basura orgánica',
    ]);
  });

  it('dentro de una misma fase respeta el orden manual', () => {
    const tasks = [task('Limpiar vitrocerámica', 2), task('Limpiar el horno a fondo', 1), task('Limpiar microondas por dentro', 0)];
    expect(sortByCleaningOrder(tasks).map(t => t.order)).toEqual([0, 1, 2]);
  });

  it('es el modo «routine» de la función de orden compartida', () => {
    const tasks = [task('Fregar el suelo de toda la casa', 0), task('Ventilar toda la casa 10 minutos', 1)];
    expect(sortTasksByUserPreference(tasks, 'routine').map(t => t.title)).toEqual([
      'Ventilar toda la casa 10 minutos',
      'Fregar el suelo de toda la casa',
    ]);
  });
});

describe('splitWholeHouseTasks', () => {
  it('ventilar va al principio y los suelos, espejos y consumibles al final', () => {
    const general = [
      task('Fregar zonas comunes', 0, 'cycle_week'),
      task('Cambiar ambientador o recarga', 1, 'cycle_month'),
      task('Quitar el polvo de muebles', 2, 'cycle_week'),
      task('Ventilar toda la casa 10 minutos', 3, 'cycle_day'),
      task('Aspirar alfombras', 4, 'cycle_week'),
      task('Poner papel higiénico', 5, 'cycle_week'),
      task('Limpiar todos los espejos de la casa', 6, 'cycle_week'),
    ];
    const { start, end } = splitWholeHouseTasks(general);
    expect(start.map(t => t.title)).toEqual(['Ventilar toda la casa 10 minutos', 'Quitar el polvo de muebles']);
    expect(end.map(t => t.title)).toEqual([
      'Aspirar alfombras',
      'Fregar zonas comunes',
      'Cambiar ambientador o recarga',
      'Poner papel higiénico',
      'Limpiar todos los espejos de la casa'
    ]);
  });
});
