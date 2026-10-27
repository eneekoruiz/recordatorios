import { describe, expect, it } from 'vitest';
import type { PatternEvent, PatternInsight, PlannedExercise, SetLog, TrainingDay, TrainingSessionLog } from '../../src/models/Training';
import { estimate1RM, tonnage, detectPRs, suggestNextLoad, weeklyVolume, detectFatigue, applyDeload, lastPerformance } from '../../src/utils/strength';
import { createSession, reduceSession, restRemainingSec, finalizeSession, swapOptions, currentExercise } from '../../src/utils/sessionMachine';
import { detectInsights, detectDeload, resolveInsight, visibleInsights, restEventsFromSets, PATTERN_RULES } from '../../src/utils/patternEngine';

const DAY = 86400000;
const NOW = new Date('2026-10-27T12:00:00Z').getTime();

const ex = (id: string, exerciseId: string, name: string, sets: number, restSec = 90, transitionRestSec = 120): PlannedExercise =>
  ({ id, exerciseId, name, sets, repMin: 8, repMax: 12, rir: 2, restSec, transitionRestSec });
const day: TrainingDay = { id: 'd1', name: 'Empuje', exercises: [ex('e1', 'press_banca', 'Press de banca', 2), ex('e2', 'press_militar', 'Press militar', 1)] };

const set = (exerciseId: string, weightKg: number, reps: number, at = NOW, extra: Partial<SetLog> = {}): SetLog =>
  ({ exerciseInstanceId: exerciseId, exerciseId, exerciseName: exerciseId, setIndex: 0, weightKg, reps, startedAt: at - 30000, completedAt: at, ...extra });
const session = (id: string, at: number, sets: SetLog[], routineId = 'r1'): TrainingSessionLog =>
  ({ id, routineId, routineName: 'PPL', dayId: 'd1', dayName: 'Empuje', startedAt: at - 3600000, endedAt: at, sets, tonnageKg: tonnage(sets), durationSec: 3600, prs: [] });

describe('fuerza', () => {
  it('1RM de Epley y tonelaje', () => {
    expect(estimate1RM(100, 1)).toBe(100);
    expect(estimate1RM(100, 10)).toBeCloseTo(133.33, 1);
    expect(estimate1RM(0, 10)).toBe(0);
    expect(tonnage([{ weightKg: 80, reps: 10 }, { weightKg: 80, reps: 8 }])).toBe(1440);
  });
  it('récords: solo cuando hay historial y se supera', () => {
    const history = [session('s1', NOW - 7 * DAY, [set('press_banca', 80, 10)])];
    expect(detectPRs([set('press_banca', 80, 10)], history)).toEqual([]);
    expect(detectPRs([set('press_banca', 85, 8)], history)[0]).toMatchObject({ exerciseId: 'press_banca', kind: 'weight', value: 85, previous: 80 });
    expect(detectPRs([set('press_banca', 80, 12)], history)[0]).toMatchObject({ kind: 'e1rm' });
    expect(detectPRs([set('sentadilla', 100, 5)], history)).toEqual([]);
  });
  it('sobrecarga progresiva según el rango y el RIR', () => {
    const planned = { exerciseId: 'press_banca', repMin: 8, repMax: 12, sets: 3, rir: 2 };
    const top = [session('s', NOW, [set('press_banca', 80, 12, NOW, { rir: 2 }), set('press_banca', 80, 12, NOW, { rir: 2 }), set('press_banca', 80, 12, NOW, { rir: 3 })])];
    expect(suggestNextLoad(planned, top)).toMatchObject({ weightKg: 82.5 });
    const mid = [session('s', NOW, [set('press_banca', 80, 10), set('press_banca', 80, 9)])];
    expect(suggestNextLoad(planned, mid)).toMatchObject({ weightKg: 80 });
    const low = [session('s', NOW, [set('press_banca', 80, 6), set('press_banca', 80, 6)])];
    expect(suggestNextLoad(planned, low)?.weightKg).toBe(77.5);
    expect(suggestNextLoad(planned, [])).toBeNull();
  });
  it('volumen semanal por grupo: principal 1, secundario 0,5, solo 7 días', () => {
    const history = [session('a', NOW - DAY, [set('press_banca', 80, 10), set('press_banca', 80, 10)]), session('b', NOW - 20 * DAY, [set('press_banca', 80, 10)])];
    expect(weeklyVolume(history, NOW)).toEqual({ pecho: 2, triceps: 1, hombros: 1 });
  });
  it('fatiga: baja seguida en dos o más ejercicios principales → descarga', () => {
    const h = (w1: number, w2: number, i: number) => session(`s${i}`, NOW - (3 - i) * 7 * DAY, [set('press_banca', w1, 8), set('sentadilla', w2, 8)]);
    expect(detectFatigue([h(100, 140, 0), h(95, 135, 1), h(90, 128, 2)])).toEqual({ exercises: ['press_banca', 'sentadilla'] });
    expect(detectFatigue([h(100, 140, 0), h(102, 142, 1), h(104, 144, 2)])).toBeNull();
    expect(applyDeload(day).exercises.map((e) => e.sets)).toEqual([1, 1]);
    expect(lastPerformance('press_banca', [session('x', NOW, [set('press_banca', 60, 10)])])?.weightKg).toBe(60);
  });
});

describe('máquina de estados de la sesión', () => {
  it('READY → IN_SET → RESTING → IN_SET → EXERCISE_TRANSITION → IN_SET → COMPLETED', () => {
    let s = createSession('r1', 'PPL', day, NOW);
    expect(s.status).toBe('READY');
    s = reduceSession(s, { type: 'START', now: NOW });
    expect(s).toMatchObject({ status: 'IN_SET', exerciseIndex: 0, setIndex: 0 });
    s = reduceSession(s, { type: 'LOG_SET', now: NOW + 40_000, weightKg: 80, reps: 10, rir: 2 });
    expect(s).toMatchObject({ status: 'RESTING', restPlannedSec: 90 });
    expect(restRemainingSec(s, NOW + 40_000 + 30_000)).toBe(60);
    s = reduceSession(s, { type: 'REST_DONE', now: NOW + 40_000 + 95_000 });
    expect(s).toMatchObject({ status: 'IN_SET', setIndex: 1, exerciseIndex: 0 });
    expect(s.sets[0]).toMatchObject({ restPlannedSec: 90, restTakenSec: 95, restSkipped: false });
    s = reduceSession(s, { type: 'LOG_SET', now: NOW + 300_000, weightKg: 80, reps: 9 });
    expect(s).toMatchObject({ status: 'EXERCISE_TRANSITION', restPlannedSec: 120 });
    s = reduceSession(s, { type: 'SKIP_REST', now: NOW + 330_000 });
    expect(s).toMatchObject({ status: 'IN_SET', exerciseIndex: 1, setIndex: 0 });
    expect(s.sets[1]).toMatchObject({ restSkipped: true, restTakenSec: 30 });
    s = reduceSession(s, { type: 'LOG_SET', now: NOW + 400_000, weightKg: 40, reps: 10 });
    expect(s.status).toBe('COMPLETED');
    const log = finalizeSession(s, [], 'log1');
    expect(log).toMatchObject({ tonnageKg: 80 * 10 + 80 * 9 + 400, dayName: 'Empuje' });
  });
  it('ajustar el descanso suma y resta sin bajar de cero; no hace nada fuera de un descanso', () => {
    let s = reduceSession(createSession('r1', 'PPL', day, NOW), { type: 'START', now: NOW });
    expect(reduceSession(s, { type: 'ADJUST_REST', deltaSec: 30 })).toBe(s);
    s = reduceSession(s, { type: 'LOG_SET', now: NOW, weightKg: 80, reps: 10 });
    s = reduceSession(s, { type: 'ADJUST_REST', deltaSec: 30 });
    expect(restRemainingSec(s, NOW)).toBe(120);
    s = reduceSession(s, { type: 'ADJUST_REST', deltaSec: -500 });
    expect(restRemainingSec(s, NOW)).toBe(0);
  });
  it('cambiar de ejercicio conserva las series y ofrece equivalentes', () => {
    let s = reduceSession(createSession('r1', 'PPL', day, NOW), { type: 'START', now: NOW });
    expect(swapOptions(s).map((e) => e.id)).toContain('press_mancuernas');
    s = reduceSession(s, { type: 'SWAP_EXERCISE', exerciseId: 'press_mancuernas' });
    expect(currentExercise(s)).toMatchObject({ exerciseId: 'press_mancuernas', sets: 2 });
  });
  it('terminar antes de tiempo cierra el descanso abierto', () => {
    let s = reduceSession(createSession('r1', 'PPL', day, NOW), { type: 'START', now: NOW });
    s = reduceSession(s, { type: 'LOG_SET', now: NOW, weightKg: 80, reps: 10 });
    s = reduceSession(s, { type: 'FINISH', now: NOW + 20_000 });
    expect(s.status).toBe('COMPLETED');
    expect(s.sets[0]).toMatchObject({ restSkipped: true, restTakenSec: 20 });
  });
});

describe('patrones y sugerencias', () => {
  const names = (scope: string, id: string) => ({ press_banca: 'Press de banca', t1: 'Fregar el suelo', l1: 'Limpieza' } as Record<string, string>)[id];
  const rests = (n: number, delta: number, planned = 90, subject = 'press_banca', scope: PatternEvent['scope'] = 'training', type: PatternEvent['type'] = 'rest_extended'): PatternEvent[] =>
    Array.from({ length: n }, (_, i) => ({ id: `r${i}`, at: NOW - i * 12 * 3600000, scope, subjectId: subject, type, value: delta, planned }));

  it('descansos: alargar casi siempre → propone fijarlo; mezclado o escaso, no', () => {
    const found = detectInsights(rests(8, 60), [], { nameOf: names, now: NOW });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ kind: 'rest_default', proposal: { type: 'set_exercise_rest', exerciseId: 'press_banca', restSec: 150 } });
    expect(found[0].message).toContain('Press de banca');
    expect(detectInsights(rests(4, 60), [], { nameOf: names, now: NOW })).toEqual([]);
    const mixed = [...rests(4, 60), ...rests(4, 0, 90, 'press_banca', 'training', 'rest_ok').map((e, i) => ({ ...e, id: `m${i}` }))];
    expect(detectInsights(mixed, [], { nameOf: names, now: NOW })).toEqual([]);
  });
  it('descansos acortados o saltados → propone bajarlo', () => {
    const ev = rests(7, -30, 120, 'press_banca', 'training', 'rest_skipped');
    expect(detectInsights(ev, [], { nameOf: names, now: NOW })[0].proposal).toMatchObject({ restSec: 90 });
  });
  it('pausas guiadas de una lista usan la propuesta de lista', () => {
    const ev = rests(7, 60, 300, 'l1', 'list');
    expect(detectInsights(ev, [], { nameOf: names, now: NOW })[0].proposal).toMatchObject({ type: 'set_list_break', listId: 'l1', breakSeconds: 360 });
  });
  it('tiempo real frente a estimado', () => {
    const ev: PatternEvent[] = Array.from({ length: 4 }, (_, i) => ({ id: `t${i}`, at: NOW - i * DAY, scope: 'task', subjectId: 't1', type: 'time_delta', planned: 600, value: 480 }));
    const [insight] = detectInsights(ev, [], { nameOf: names, now: NOW });
    expect(insight).toMatchObject({ kind: 'duration_adjust', proposal: { type: 'set_task_duration', taskId: 't1', minutes: 20 } });
    expect(insight.message).toContain('Fregar el suelo');
    expect(detectInsights(ev.slice(0, 2), [], { nameOf: names, now: NOW })).toEqual([]);
  });
  it('pospuestas y omitidas reiteradamente', () => {
    const mk = (type: PatternEvent['type'], n: number): PatternEvent[] => Array.from({ length: n }, (_, i) => ({ id: `${type}${i}`, at: NOW - i * DAY, scope: 'task', subjectId: 't1', type }));
    expect(detectInsights(mk('task_postponed', 3), [], { nameOf: names, now: NOW })[0].proposal).toEqual({ type: 'move_task_first', taskId: 't1' });
    expect(detectInsights(mk('task_postponed', 2), [], { nameOf: names, now: NOW })).toEqual([]);
    expect(detectInsights(mk('task_skipped', 3), [], { nameOf: names, now: NOW })[0].proposal).toEqual({ type: 'open_task', taskId: 't1' });
    // Fuera de la ventana no cuentan.
    expect(detectInsights(mk('task_postponed', 3).map((e) => ({ ...e, at: NOW - 40 * DAY })), [], { nameOf: names, now: NOW })).toEqual([]);
  });
  it('bucle de aprobación: pendiente no se duplica; descartar calla 30 días; aceptar reinicia la cuenta', () => {
    const ev = rests(8, 60);
    const ctx = { nameOf: names, now: NOW };
    const [first] = detectInsights(ev, [], ctx);
    expect(detectInsights(ev, [first], ctx)).toEqual([]);
    const later = resolveInsight(first, 'later', NOW);
    expect(later.hiddenUntil).toBe(NOW + PATTERN_RULES.laterHideDays * DAY);
    expect(visibleInsights([later], NOW)).toEqual([]);
    expect(visibleInsights([later], NOW + 4 * DAY)).toHaveLength(1);
    const dismissed = resolveInsight(first, 'dismiss', NOW);
    expect(detectInsights(ev, [dismissed], ctx)).toEqual([]);
    expect(detectInsights(ev, [dismissed], { ...ctx, now: NOW + 31 * DAY }).length).toBe(0); // los eventos ya son viejos y están antes de lo resuelto
    const accepted = resolveInsight(first, 'accept', NOW + 1000);
    expect(accepted.status).toBe('accepted');
    expect(detectInsights(ev, [accepted], ctx)).toEqual([]); // nada nuevo desde que se aceptó
    const newer = rests(8, 60).map((e, i) => ({ ...e, id: `n${i}`, at: NOW + 3600000 + i * 12 * 3600000 }));
    expect(detectInsights(newer, [accepted], { nameOf: names, now: NOW + 8 * DAY })).toHaveLength(1);
  });
  it('eventos de descanso a partir de las series de una sesión', () => {
    const base = { exerciseId: 'press_banca', restPlannedSec: 90 };
    const events = restEventsFromSets([
      set('press_banca', 80, 10, NOW, { ...base, restTakenSec: 150, restAdjustSec: 60 }),
      set('press_banca', 80, 10, NOW, { ...base, restTakenSec: 40, restSkipped: true }),
      set('press_banca', 80, 10, NOW, { ...base, restTakenSec: 92 }),
      set('press_banca', 80, 10, NOW),
    ]);
    expect(events.map((e) => e.type)).toEqual(['rest_extended', 'rest_skipped', 'rest_ok']);
    expect(events[0]).toMatchObject({ value: 60, planned: 90 });
  });
  it('descarga sugerida ante fatiga', () => {
    const h = (w1: number, w2: number, i: number) => session(`s${i}`, NOW - (3 - i) * 7 * DAY, [set('press_banca', w1, 8), set('sentadilla', w2, 8)]);
    const insight = detectDeload('r1', [h(100, 140, 0), h(95, 135, 1), h(90, 128, 2)], [], NOW) as PatternInsight;
    expect(insight).toMatchObject({ kind: 'deload', proposal: { type: 'start_deload', routineId: 'r1' } });
    expect(detectDeload('r1', [h(100, 140, 0), h(95, 135, 1), h(90, 128, 2)], [insight], NOW)).toBeNull();
  });
});
