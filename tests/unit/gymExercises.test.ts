import { describe, it, expect } from 'vitest';
import { getExerciseAlternatives, createDefaultGymRoutine, GYM_EXERCISE_CATALOG } from '../../src/utils/gymExercises';
import { validateJsonImport } from '../../src/utils/importValidation';

describe('Gimnasio y Rutinas - Catálogo y Alternativas', () => {
  it('contiene ejercicios clave con alternativas verificadas', () => {
    expect(GYM_EXERCISE_CATALOG.length).toBeGreaterThan(10);
    const bench = GYM_EXERCISE_CATALOG.find(e => e.id === 'press_banca');
    expect(bench).toBeDefined();
    expect(bench?.alternatives.length).toBeGreaterThanOrEqual(3);
  });

  it('devuelve alternativas para Press de banca', () => {
    const res = getExerciseAlternatives('Press de banca');
    expect(res.found).toBe(true);
    expect(res.category).toBe('pecho');
    expect(res.alternatives.some(a => a.name.includes('mancuernas'))).toBe(true);
  });

  it('devuelve alternativas para Jalón al pecho y Dominadas', () => {
    const jalon = getExerciseAlternatives('Jalón al pecho');
    expect(jalon.found).toBe(true);
    expect(jalon.category).toBe('espalda');

    const dominadas = getExerciseAlternatives('Dominadas');
    expect(dominadas.found).toBe(true);
    expect(dominadas.category).toBe('espalda');
  });

  it('devuelve alternativas para Sentadilla y Peso muerto rumano', () => {
    const squat = getExerciseAlternatives('Sentadilla');
    expect(squat.found).toBe(true);
    expect(squat.category).toBe('pierna');

    const rdl = getExerciseAlternatives('Peso muerto rumano');
    expect(rdl.found).toBe(true);
    expect(rdl.category).toBe('femoral');
  });

  it('devuelve alternativas para Cardio flexible (remo, andar, bici)', () => {
    const cardio = getExerciseAlternatives('Cardio final');
    expect(cardio.found).toBe(true);
    expect(cardio.category).toBe('cardio');
    expect(cardio.alternatives.some(a => a.name.toLowerCase().includes('remo'))).toBe(true);
    expect(cardio.alternatives.some(a => a.name.toLowerCase().includes('cinta') || a.name.toLowerCase().includes('andar'))).toBe(true);
    expect(cardio.alternatives.some(a => a.name.toLowerCase().includes('bici'))).toBe(true);
  });

  it('ofrece alternativas de fallback incluso si el ejercicio no está en el catálogo', () => {
    const custom = getExerciseAlternatives('Ejercicio inventado de bíceps');
    expect(custom.alternatives.length).toBeGreaterThan(0);
  });
});

describe('Gimnasio y Rutinas - Rutina de 4 Días', () => {
  it('crea la estructura completa con 4 secciones y todos los ejercicios pedidos', () => {
    const { list, sections, tasks } = createDefaultGymRoutine('test_user');

    expect(list.id).toBe('gimnasio');
    expect(list.name).toBe('Gimnasio');
    expect(sections).toHaveLength(4);

    const sectionNames = sections.map(s => s.name);
    expect(sectionNames).toContain('Día 1: Tren Superior A');
    expect(sectionNames).toContain('Día 2: Tren Inferior A');
    expect(sectionNames).toContain('Día 3: Tren Superior B');
    expect(sectionNames).toContain('Día 4: Tren Inferior B');

    // Comprobar que no incluye zancadas ni hip thrust (especificación explícita del usuario)
    const taskTitles = tasks.map(t => t.title.toLowerCase());
    expect(taskTitles.some(t => t.includes('hip thrust'))).toBe(false);
    expect(taskTitles.some(t => t.includes('zancada'))).toBe(false);

    // Comprobar ejercicios de Tren Superior A
    const day1Tasks = tasks.filter(t => t.sectionId === 'sec_gym_sup_a').map(t => t.title);
    expect(day1Tasks).toContain('Press de banca');
    expect(day1Tasks).toContain('Remo con barra');
    expect(day1Tasks).toContain('Press militar');
    expect(day1Tasks).toContain('Jalón al pecho');
    expect(day1Tasks).toContain('Elevaciones laterales');
    expect(day1Tasks).toContain('Extensión de tríceps');

    // Comprobar que cada día finaliza con un apartado de cardio flexible
    const cardioTasks = tasks.filter(t => t.title.toLowerCase().includes('cardio'));
    expect(cardioTasks.length).toBe(4);

    // Comprobar que las tareas tienen configuradas series (targetCount), duración y descanso (restDuration)
    const benchTask = tasks.find(t => t.title === 'Press de banca');
    expect(benchTask).toBeDefined();
    expect(benchTask?.targetCount).toBe(4);
    expect(benchTask?.duration).toBe(3);
    expect(benchTask?.restDuration).toBe(120);
  });

  it('valida restDuration en el esquema de importación e IndexedDB sin errores', () => {
    const rawData = {
      tasks: [
        {
          id: 'test_task_gym',
          title: 'Press de banca',
          targetCount: 4,
          currentCount: 1,
          restDuration: 120,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: 1
        }
      ]
    };

    const validated = validateJsonImport(rawData);
    expect(validated.tasks?.[0].restDuration).toBe(120);
    expect(validated.tasks?.[0].targetCount).toBe(4);
  });
});
