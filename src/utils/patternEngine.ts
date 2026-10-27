import type { InsightKind, PatternEvent, PatternInsight, SetLog } from '../models/Training';
import { detectFatigue } from './strength';
import type { TrainingSessionLog } from '../models/Training';

/**
 * Detección de patrones: eventos → patrón → sugerencia.
 *
 * Los eventos son hechos observados (se alargó un descanso, se pospuso una tarea…). Un patrón es lo mismo
 * repetido lo bastante como para no ser casualidad. Una sugerencia es una propuesta concreta que el usuario
 * aprueba con un toque. Las reglas son deliberadamente conservadoras: es mejor no sugerir que molestar.
 */
export const PATTERN_RULES = {
  /** Observaciones mínimas de descanso y días distintos en que se vieron. */
  restMinObservations: 6,
  restMinDays: 2,
  /** Fracción de descansos que deben ir en el mismo sentido (más largos o más cortos). */
  restShare: 0.7,
  /** Diferencia mínima (s) respecto a lo programado para que cuente como alargar o acortar. */
  restMinDeltaSec: 20,
  restWindowDays: 30,
  /** Tareas: tiempo real frente a estimado. */
  durationMinObservations: 3,
  durationShare: 0.7,
  durationMinRatio: 0.25,
  durationWindowDays: 60,
  /** Tareas pospuestas y omitidas. */
  postponeMin: 3,
  postponeWindowDays: 21,
  skipMin: 3,
  skipWindowDays: 30,
  /** Cuánto se calla una sugerencia descartada o dejada para más tarde. */
  dismissedHideDays: 30,
  laterHideDays: 3,
  keepEventsDays: 90,
} as const;

const DAY = 86400000;
const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
};
const roundTo = (value: number, step: number) => Math.round(value / step) * step;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const dayKey = (at: number) => new Date(at).toDateString();

export function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}:${String(r).padStart(2, '0')} min` : `${m} min`;
}

/** Eventos de descanso a partir de las series de una sesión (uno por descanso medido). */
export function restEventsFromSets(sets: SetLog[], subjectScope: 'training' | 'list' = 'training'): Omit<PatternEvent, 'id'>[] {
  const out: Omit<PatternEvent, 'id'>[] = [];
  for (const s of sets) {
    if (s.restPlannedSec === undefined || s.restTakenSec === undefined) continue;
    const delta = s.restTakenSec - s.restPlannedSec;
    const base = { at: s.completedAt, scope: subjectScope, subjectId: s.exerciseId, value: delta, planned: s.restPlannedSec };
    if (s.restSkipped && s.restTakenSec < s.restPlannedSec * 0.8) out.push({ ...base, type: 'rest_skipped' });
    else if (delta >= 15 || (s.restAdjustSec ?? 0) > 0) out.push({ ...base, type: 'rest_extended' });
    else if (delta <= -15 || (s.restAdjustSec ?? 0) < 0) out.push({ ...base, type: 'rest_shortened' });
    else out.push({ ...base, type: 'rest_ok' });
  }
  return out;
}

export interface InsightContext {
  /** Nombre legible del ejercicio, la tarea o la lista según el ámbito. */
  nameOf: (scope: PatternEvent['scope'], subjectId: string) => string | undefined;
  now: number;
}

const REST_TYPES = new Set(['rest_ok', 'rest_extended', 'rest_shortened', 'rest_skipped']);

/** ¿Hay que callarse? Ya hay una pendiente, está dormida o se resolvió y no ha habido nada nuevo. */
function blocked(insights: PatternInsight[], kind: InsightKind, subjectId: string, now: number): { blocked: boolean; since: number } {
  let since = 0;
  for (const i of insights) {
    if (i.kind !== kind || i.subjectId !== subjectId) continue;
    // Pendiente o dejada para más tarde: ya existe (volverá a enseñarse sola), no se crea otra.
    if (i.status === 'pending' || i.status === 'snoozed') return { blocked: true, since };
    if (i.status === 'dismissed' && (i.hiddenUntil ?? 0) > now) return { blocked: true, since };
    since = Math.max(since, i.resolvedAt ?? i.createdAt);
  }
  return { blocked: false, since };
}

export function detectInsights(events: PatternEvent[], existing: PatternInsight[], ctx: InsightContext): PatternInsight[] {
  const R = PATTERN_RULES;
  const { now } = ctx;
  const out: PatternInsight[] = [];
  const make = (kind: InsightKind, scope: PatternEvent['scope'], subjectId: string, message: string, proposal: PatternInsight['proposal'], observations: number, med: number): PatternInsight => ({
    id: `${kind}:${subjectId}:${now}`, kind, scope, subjectId, message, proposal,
    evidence: { observations, median: Math.round(med * 10) / 10 }, status: 'pending', createdAt: now,
  });

  // ── Descansos (entrenamiento y descansos guiados de listas) ──
  const restGroups = new Map<string, PatternEvent[]>();
  for (const e of events) {
    if (!REST_TYPES.has(e.type) || now - e.at > R.restWindowDays * DAY) continue;
    const key = `${e.scope}|${e.subjectId}`;
    restGroups.set(key, [...(restGroups.get(key) ?? []), e]);
  }
  for (const [key, group] of restGroups) {
    const [scope, subjectId] = key.split('|') as [PatternEvent['scope'], string];
    const gate = blocked(existing, 'rest_default', subjectId, now);
    if (gate.blocked) continue;
    const fresh = group.filter((e) => e.at > gate.since);
    if (fresh.length < R.restMinObservations || new Set(fresh.map((e) => dayKey(e.at))).size < R.restMinDays) continue;
    const longer = fresh.filter((e) => (e.type === 'rest_extended') && (e.value ?? 0) >= R.restMinDeltaSec);
    const shorter = fresh.filter((e) => (e.type === 'rest_skipped' || e.type === 'rest_shortened') && (e.value ?? 0) <= -R.restMinDeltaSec);
    const name = ctx.nameOf(scope, subjectId);
    if (!name) continue;
    const planned = median(fresh.map((e) => e.planned ?? 0).filter((p) => p > 0));
    let direction: 'longer' | 'shorter' | null = null;
    if (longer.length / fresh.length >= R.restShare) direction = 'longer';
    else if (shorter.length / fresh.length >= R.restShare) direction = 'shorter';
    if (!direction || planned <= 0) continue;
    const delta = median((direction === 'longer' ? longer : shorter).map((e) => e.value ?? 0));
    const target = clamp(roundTo(planned + delta, 15), 15, 600);
    if (target === roundTo(planned, 15)) continue;
    const message = scope === 'training'
      ? `En ${name} casi siempre ${direction === 'longer' ? 'alargas' : 'acortas'} el descanso unos ${fmtDuration(Math.abs(delta))} (de ${fmtDuration(planned)} a ${fmtDuration(planned + delta)}). ¿Lo dejo en ${fmtDuration(target)} por defecto?`
      : `En ${name} casi siempre ${direction === 'longer' ? 'alargas' : 'acortas'} la pausa entre tareas. ¿La dejo en ${fmtDuration(target)} por defecto?`;
    out.push(make('rest_default', scope, subjectId, message,
      scope === 'training' ? { type: 'set_exercise_rest', exerciseId: subjectId, restSec: target } : { type: 'set_list_break', listId: subjectId, breakSeconds: target },
      fresh.length, delta));
  }

  // ── Tiempo real frente a estimado (tareas) ──
  const byTask = (type: PatternEvent['type'], windowDays: number) => {
    const m = new Map<string, PatternEvent[]>();
    for (const e of events) if (e.scope === 'task' && e.type === type && now - e.at <= windowDays * DAY) m.set(e.subjectId, [...(m.get(e.subjectId) ?? []), e]);
    return m;
  };
  for (const [taskId, group] of byTask('time_delta', R.durationWindowDays)) {
    const gate = blocked(existing, 'duration_adjust', taskId, now);
    const fresh = group.filter((e) => e.at > gate.since && (e.planned ?? 0) > 0);
    const name = ctx.nameOf('task', taskId);
    if (gate.blocked || !name || fresh.length < R.durationMinObservations) continue;
    const ratios = fresh.map((e) => ((e.planned ?? 0) + (e.value ?? 0)) / (e.planned ?? 1));
    const over = ratios.filter((r) => r >= 1 + R.durationMinRatio).length;
    const under = ratios.filter((r) => r <= 1 - R.durationMinRatio).length;
    if (Math.max(over, under) / fresh.length < R.durationShare) continue;
    const plannedMin = median(fresh.map((e) => e.planned ?? 0)) / 60;
    const actualMin = median(fresh.map((e) => ((e.planned ?? 0) + (e.value ?? 0)) / 60));
    const minutes = Math.max(1, actualMin < 10 ? Math.round(actualMin) : roundTo(actualMin, 5));
    if (minutes === Math.round(plannedMin)) continue;
    out.push(make('duration_adjust', 'task', taskId,
      `«${name}» te lleva unos ${minutes} min y la tienes en ${Math.round(plannedMin)}. ¿Actualizo la estimación?`,
      { type: 'set_task_duration', taskId, minutes }, fresh.length, actualMin));
  }

  // ── Pospuestas y omitidas ──
  for (const [taskId, group] of byTask('task_postponed', R.postponeWindowDays)) {
    const gate = blocked(existing, 'move_to_start', taskId, now);
    const fresh = group.filter((e) => e.at > gate.since);
    const name = ctx.nameOf('task', taskId);
    if (gate.blocked || !name || fresh.length < R.postponeMin) continue;
    out.push(make('move_to_start', 'task', taskId,
      `Sueles dejar «${name}» para luego (${fresh.length} veces). ¿La muevo al inicio de la lista para hacerla con energía?`,
      { type: 'move_task_first', taskId }, fresh.length, fresh.length));
  }
  for (const [taskId, group] of byTask('task_skipped', R.skipWindowDays)) {
    const gate = blocked(existing, 'skip_review', taskId, now);
    const fresh = group.filter((e) => e.at > gate.since);
    const name = ctx.nameOf('task', taskId);
    if (gate.blocked || !name || fresh.length < R.skipMin) continue;
    out.push(make('skip_review', 'task', taskId,
      `Has omitido «${name}» ${fresh.length} veces. ¿La revisamos (cambiarla, espaciarla o quitarla)?`,
      { type: 'open_task', taskId }, fresh.length, fresh.length));
  }
  return out;
}

/** Sugerencia de descarga si el rendimiento baja en varios ejercicios principales a la vez. */
export function detectDeload(routineId: string, history: TrainingSessionLog[], existing: PatternInsight[], now: number): PatternInsight | null {
  if (blocked(existing, 'deload', routineId, now).blocked) return null;
  const since = blocked(existing, 'deload', routineId, now).since;
  const fatigue = detectFatigue(history.filter((h) => h.routineId === routineId && h.endedAt > since));
  if (!fatigue) return null;
  return {
    id: `deload:${routineId}:${now}`, kind: 'deload', scope: 'training', subjectId: routineId,
    message: `Tu fuerza estimada lleva dos sesiones bajando en ${fatigue.exercises.length} ejercicios. ¿Hacemos una semana de descarga con menos series?`,
    proposal: { type: 'start_deload', routineId }, evidence: { observations: fatigue.exercises.length, median: fatigue.exercises.length },
    status: 'pending', createdAt: now,
  };
}

export type InsightDecision = 'accept' | 'dismiss' | 'later';

export function resolveInsight(insight: PatternInsight, decision: InsightDecision, now: number): PatternInsight {
  const R = PATTERN_RULES;
  if (decision === 'accept') return { ...insight, status: 'accepted', resolvedAt: now };
  if (decision === 'dismiss') return { ...insight, status: 'dismissed', resolvedAt: now, hiddenUntil: now + R.dismissedHideDays * DAY };
  return { ...insight, status: 'snoozed', hiddenUntil: now + R.laterHideDays * DAY };
}

/** Sugerencias que toca enseñar ahora (las dejadas para más tarde vuelven cuando vence el plazo). */
export function visibleInsights(insights: PatternInsight[], now: number): PatternInsight[] {
  return insights.filter((i) => i.status === 'pending' || (i.status === 'snoozed' && (i.hiddenUntil ?? 0) <= now));
}

export const pruneEvents = (events: PatternEvent[], now: number) => events.filter((e) => now - e.at <= PATTERN_RULES.keepEventsDays * DAY);
