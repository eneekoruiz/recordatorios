import type { TaskItem, TaskWeightLog } from '../models/Task';

export interface LastSessionWeightInfo {
  weightKg: number;
  reps?: number;
  set?: number;
  isPreviousSession: boolean;
}

const sameCalendarDay = (a: Date | string | number, b: Date | string | number): boolean => {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

/**
 * Obtiene el peso y repeticiones de la sesión anterior o de la serie previa
 * para ofrecer una pista rápida al usuario (ej. "Última vez: 35 kg × 8").
 */
export function getLastSessionWeightAndReps(
  task: TaskItem,
  currentSetIndex: number = 1,
  now: Date = new Date()
): LastSessionWeightInfo | null {
  if (!task || !Array.isArray(task.weightLogs) || task.weightLogs.length === 0) {
    return null;
  }

  const logs = [...task.weightLogs].filter(l => typeof l.weightKg === 'number' && Number.isFinite(l.weightKg));
  if (logs.length === 0) return null;

  // 1. Separar logs de sesiones anteriores vs hoy
  const priorSessionLogs: TaskWeightLog[] = [];
  const todayLogs: TaskWeightLog[] = [];

  for (const log of logs) {
    const logDate = log.date ? new Date(log.date) : (task.updated_at ? new Date(task.updated_at) : new Date(0));
    if (!sameCalendarDay(logDate, now)) {
      priorSessionLogs.push(log);
    } else {
      todayLogs.push(log);
    }
  }

  // 2. Si hay logs de sesiones anteriores, tomar los de la fecha más reciente
  if (priorSessionLogs.length > 0) {
    // Encontrar la fecha más reciente de sesión previa
    let latestTimestamp = 0;
    for (const l of priorSessionLogs) {
      const t = l.date ? new Date(l.date).getTime() : 0;
      if (t > latestTimestamp) latestTimestamp = t;
    }

    const latestSessionLogs = priorSessionLogs.filter(l => {
      const t = l.date ? new Date(l.date).getTime() : 0;
      return sameCalendarDay(t, latestTimestamp);
    });

    // Intentar buscar la serie equivalente de esa sesión previa
    const matchingSet = latestSessionLogs.find(l => l.set === currentSetIndex);
    if (matchingSet) {
      return {
        weightKg: matchingSet.weightKg,
        reps: matchingSet.reps,
        set: matchingSet.set,
        isPreviousSession: true
      };
    }

    // Si no coincide el número de serie, tomar la última serie de esa sesión
    const lastOfPriorSession = latestSessionLogs[latestSessionLogs.length - 1];
    return {
      weightKg: lastOfPriorSession.weightKg,
      reps: lastOfPriorSession.reps,
      set: lastOfPriorSession.set,
      isPreviousSession: true
    };
  }

  // 3. Si solo hay logs de hoy, tomar la serie anterior hecha hoy
  if (todayLogs.length > 0) {
    const prevSetToday = todayLogs.find(l => l.set === currentSetIndex - 1) || todayLogs[todayLogs.length - 1];
    return {
      weightKg: prevSetToday.weightKg,
      reps: prevSetToday.reps,
      set: prevSetToday.set,
      isPreviousSession: false
    };
  }

  return null;
}

export interface SessionVolumeSummary {
  totalVolumeKg: number;
  exercisesCount: number;
  setsCount: number;
}

/**
 * Calcula el volumen total levantado en kilogramos en la sesión actual
 * multiplicando (peso × repeticiones) de cada serie registrada hoy.
 */
export function calculateSessionVolume(
  tasks: TaskItem[],
  referenceDate: Date = new Date()
): SessionVolumeSummary {
  let totalVolumeKg = 0;
  let setsCount = 0;
  let exercisesCount = 0;

  for (const t of tasks) {
    if (t.isRest || t.deleted_at) continue;

    let hasActivityToday = false;
    if (Array.isArray(t.weightLogs)) {
      for (const log of t.weightLogs) {
        const logDate = log.date ? new Date(log.date) : (t.updated_at ? new Date(t.updated_at) : new Date(0));
        if (sameCalendarDay(logDate, referenceDate) && log.weightKg > 0) {
          const reps = typeof log.reps === 'number' && log.reps > 0 ? log.reps : (t.targetCount || 10);
          totalVolumeKg += Math.round(log.weightKg * reps);
          setsCount++;
          hasActivityToday = true;
        }
      }
    }

    if (hasActivityToday || (t.status === 'completed' && t.completed_at && sameCalendarDay(new Date(t.completed_at), referenceDate))) {
      exercisesCount++;
    }
  }

  return {
    totalVolumeKg,
    exercisesCount,
    setsCount
  };
}
