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

  it('devuelve alternativas y reconoce Sentadilla Jaca (Hack Squat) con descanso amplio', () => {
    const jaca = getExerciseAlternatives('Sentadilla Jaca');
    expect(jaca.found).toBe(true);
    expect(jaca.category).toBe('pierna');
    expect(jaca.alternatives.some(a => a.name.toLowerCase().includes('prensa'))).toBe(true);

    const hack = getExerciseAlternatives('hack');
    expect(hack.found).toBe(true);
    expect(hack.matchedTitle).toBe('Sentadilla Jaca');

    const catItem = GYM_EXERCISE_CATALOG.find(e => e.id === 'sentadilla_jaca');
    expect(catItem?.defaultRestSeconds).toBe(180);
  });

  it('devuelve alternativas para Curl femoral (Leg curl)', () => {
    const curl = getExerciseAlternatives('Curl femoral en máquina');
    expect(curl.found).toBe(true);
    expect(curl.category).toBe('femoral');

    const legCurl = getExerciseAlternatives('leg curl');
    expect(legCurl.found).toBe(true);
  });

  it('devuelve alternativas para Máquina de aducción y Máquina de glúteos', () => {
    const aduccion = getExerciseAlternatives('Máquina de aducción');
    expect(aduccion.found).toBe(true);
    expect(aduccion.category).toBe('pierna');

    const gluteos = getExerciseAlternatives('máquina de glúteos');
    expect(gluteos.found).toBe(true);

    const culoMatch = getExerciseAlternatives('culo');
    expect(culoMatch.found).toBe(true);
    expect(culoMatch.matchedTitle).toBe('Máquina de glúteos');
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

    // Comprobar ejercicios de Tren Inferior A y B configurados con la rutina real del usuario
    const day2Tasks = tasks.filter(t => t.sectionId === 'sec_gym_inf_a').map(t => t.title);
    expect(day2Tasks).toContain('Sentadilla Jaca');
    expect(day2Tasks).toContain('Curl femoral en máquina');
    expect(day2Tasks).toContain('Máquina de aducción');
    expect(day2Tasks).toContain('Máquina de glúteos');
    expect(day2Tasks).toContain('Gemelos en máquina');

    // Comprobar que no hay saturación de 3 ejercicios de cuádriceps en el mismo día
    expect(day2Tasks).not.toContain('Extensiones de cuádriceps');
    expect(day2Tasks).not.toContain('Prensa');

    const jacaTask = tasks.find(t => t.title === 'Sentadilla Jaca');
    expect(jacaTask).toBeDefined();
    expect(jacaTask?.restDuration).toBe(180); // 3 minutos de descanso para Jaca

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

  it('valida weightLogs en el esquema de importación e IndexedDB sin errores', () => {
    const rawData = {
      tasks: [
        {
          id: 'test_task_gym_weights',
          title: 'Sentadilla Jaca',
          targetCount: 4,
          currentCount: 2,
          restDuration: 180,
          weightLogs: [
            { set: 1, weightKg: 80, reps: 10, date: '2026-10-27T08:00:00Z' },
            { set: 2, weightKg: 85, reps: 8, date: '2026-10-27T08:05:00Z' }
          ],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version: 1
        }
      ]
    };

    const validated = validateJsonImport(rawData);
    expect(validated.tasks?.[0].weightLogs).toHaveLength(2);
    expect(validated.tasks?.[0].weightLogs?.[0].weightKg).toBe(80);
    expect(validated.tasks?.[0].weightLogs?.[1].weightKg).toBe(85);
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
