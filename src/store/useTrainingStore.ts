import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { idbStorage } from '../utils/idbStorage';
import { useAppStore } from './useAppStore';
import type {
  PatternEvent, PatternInsight, Routine, RoutineStatus, SessionState, TrainingSessionLog,
} from '../models/Training';
import { newId } from '../data/routineTemplates';
import { detectDeload, detectInsights, pruneEvents, resolveInsight, restEventsFromSets, type InsightDecision } from '../utils/patternEngine';
import { finalizeSession } from '../utils/sessionMachine';

/**
 * Entrenamiento, eventos de comportamiento y sugerencias. Datos de este dispositivo (como las duraciones
 * aprendidas): no se sincronizan con el servidor, y se vacían si entra otra cuenta real.
 */
interface TrainingState {
  ownerId: string | null;
  routines: Routine[];
  sessions: TrainingSessionLog[];
  /** Sesión en directo (se guarda para poder retomarla si se cierra la app). */
  activeSession: SessionState | null;
  events: PatternEvent[];
  insights: PatternInsight[];

  ensureOwner: (userId: string | null) => void;
  addRoutine: (routine: Routine) => void;
  updateRoutine: (id: string, patch: Partial<Routine>) => void;
  duplicateRoutine: (id: string) => string | null;
  setRoutineStatus: (id: string, status: RoutineStatus) => void;
  deleteRoutine: (id: string) => void;
  setActiveSession: (session: SessionState | null) => void;
  /** Guarda la sesión terminada, avanza la rutina y registra los eventos de descanso. */
  finishSession: (session: SessionState) => TrainingSessionLog;
  recordEvents: (events: Omit<PatternEvent, 'id'>[]) => void;
  decideInsight: (id: string, decision: InsightDecision) => void;
}

const isRealUser = (id: string | null) => !!id && !id.startsWith('local_guest');

/** Nombre legible de lo que hay detrás de un evento (ejercicio, tarea o lista). */
export function nameOfSubject(scope: PatternEvent['scope'], subjectId: string): string | undefined {
  const app = useAppStore.getState();
  if (scope === 'task') return app.tasks[subjectId]?.title;
  if (scope === 'list') return app.lists.find((l) => l.id === subjectId)?.name;
  const training = useTrainingStore.getState();
  for (const r of training.routines) for (const d of r.days) for (const e of d.exercises) if (e.exerciseId === subjectId) return e.name;
  return undefined;
}

/** Recalcula las sugerencias a partir de los eventos (idempotente: no duplica las ya existentes). */
function refreshInsights(state: Pick<TrainingState, 'events' | 'insights' | 'sessions' | 'routines'>, now: number): PatternInsight[] {
  const created = detectInsights(state.events, state.insights, { nameOf: nameOfSubject, now });
  const all = [...state.insights, ...created];
  for (const routine of state.routines.filter((r) => r.status === 'active')) {
    const deload = detectDeload(routine.id, state.sessions, all, now);
    if (deload) all.push(deload);
  }
  // Se conserva lo reciente: las resueltas hace más de 120 días ya no hacen falta.
  return all.filter((i) => now - (i.resolvedAt ?? i.createdAt) < 120 * 86400000);
}

export const useTrainingStore = create<TrainingState>()(
  persist(
    (set, get) => ({
      ownerId: null,
      routines: [],
      sessions: [],
      activeSession: null,
      events: [],
      insights: [],

      ensureOwner: (userId) => {
        const { ownerId } = get();
        if (isRealUser(ownerId) && isRealUser(userId) && ownerId !== userId) {
          set({ ownerId: userId, routines: [], sessions: [], activeSession: null, events: [], insights: [] });
        } else if (isRealUser(userId) && ownerId !== userId) {
          set({ ownerId: userId });
        } else if (ownerId === null && userId) {
          set({ ownerId: userId });
        }
      },

      addRoutine: (routine) => set((s) => ({ routines: [...s.routines, routine] })),
      updateRoutine: (id, patch) => set((s) => ({ routines: s.routines.map((r) => (r.id === id ? { ...r, ...patch, updatedAt: Date.now() } : r)) })),
      duplicateRoutine: (id) => {
        const source = get().routines.find((r) => r.id === id);
        if (!source) return null;
        const copyId = newId('routine');
        const now = Date.now();
        const copy: Routine = {
          ...source, id: copyId, name: `${source.name} (copia)`, status: 'saved', nextDayIndex: 0, deload: false, createdAt: now, updatedAt: now,
          days: source.days.map((d) => ({ ...d, id: newId('day'), exercises: d.exercises.map((e) => ({ ...e, id: newId('pe') })) })),
        };
        set((s) => ({ routines: [...s.routines, copy] }));
        return copyId;
      },
      setRoutineStatus: (id, status) => set((s) => ({
        routines: s.routines.map((r) => {
          if (r.id === id) return { ...r, status, updatedAt: Date.now() };
          // Solo hay una rutina en curso: activar otra manda la anterior a guardadas.
          if (status === 'active' && r.status === 'active') return { ...r, status: 'saved', updatedAt: Date.now() };
          return r;
        }),
      })),
      deleteRoutine: (id) => set((s) => ({ routines: s.routines.filter((r) => r.id !== id) })),

      setActiveSession: (activeSession) => set({ activeSession }),

      finishSession: (session) => {
        const now = Date.now();
        const state = get();
        const log = finalizeSession(session, state.sessions, newId('session'));
        const restEvents = restEventsFromSets(session.sets).map((e) => ({ ...e, id: newId('ev') }));
        const routines = state.routines.map((r) =>
          r.id === session.routineId && r.days.length > 0 ? { ...r, nextDayIndex: (r.days.findIndex((d) => d.id === session.day.id) + 1) % r.days.length, updatedAt: now } : r);
        const next = { ...state, routines, sessions: [...state.sessions, log], events: pruneEvents([...state.events, ...restEvents], now) };
        set({ routines, sessions: next.sessions, events: next.events, activeSession: null, insights: refreshInsights(next, now) });
        return log;
      },

      recordEvents: (events) => {
        const now = Date.now();
        const state = get();
        const added = events.map((e) => ({ ...e, id: newId('ev') }));
        const next = { ...state, events: pruneEvents([...state.events, ...added], now) };
        set({ events: next.events, insights: refreshInsights(next, now) });
      },

      decideInsight: (id, decision) => {
        const now = Date.now();
        const insight = get().insights.find((i) => i.id === id);
        if (!insight) return;
        if (decision === 'accept') applyProposal(insight.proposal);
        set((s) => ({ insights: s.insights.map((i) => (i.id === id ? resolveInsight(i, decision, now) : i)) }));
      },
    }),
    {
      name: 'training-storage',
      storage: createJSONStorage(() => idbStorage),
      version: 1,
    },
  ),
);

/** Lo que hace «Aceptar»: cambia la configuración base de la rutina, la lista o la tarea. */
function applyProposal(p: PatternInsight['proposal']) {
  const app = useAppStore.getState();
  switch (p.type) {
    case 'set_exercise_rest':
      useTrainingStore.setState((s) => ({
        routines: s.routines.map((r) => ({
          ...r, updatedAt: Date.now(),
          days: r.days.map((d) => ({ ...d, exercises: d.exercises.map((e) => (e.exerciseId === p.exerciseId ? { ...e, restSec: p.restSec } : e)) })),
        })),
      }));
      break;
    case 'set_list_break':
      app.updateList(p.listId, { breakSeconds: p.breakSeconds });
      break;
    case 'set_task_duration':
      app.updateTask(p.taskId, { duration: p.minutes, disableDuration: undefined });
      break;
    case 'move_task_first': {
      const task = app.tasks[p.taskId];
      if (!task) break;
      const siblings = Object.values(app.tasks).filter((t) => !t.deleted_at && t.categoryId === task.categoryId && t.sectionId === task.sectionId);
      const minOrder = Math.min(0, ...siblings.map((t) => t.order ?? 0));
      app.updateTask(p.taskId, { order: minOrder - 1 });
      break;
    }
    case 'open_task':
      window.dispatchEvent(new CustomEvent('open-task-editor', { detail: p.taskId }));
      break;
    case 'start_deload':
      useTrainingStore.getState().updateRoutine(p.routineId, { deload: true });
      break;
  }
}

// Como useAppStore: accesible desde la consola y las pruebas E2E.
if (typeof window !== 'undefined') {
  (window as any).useTrainingStore = useTrainingStore;
}
