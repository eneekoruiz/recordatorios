import type { TaskItem, CustomCycle } from '../models/Task';

/**
 * Servicio puro para determinar si una tarea recurrente
 * ya fue completada dentro de su periodo actual.
 *
 * Aplica principios de Clean Code, Guard Clauses y tipado estricto.
 */
export function isCompletedInCurrentPeriod(task: Partial<TaskItem>, cycles: CustomCycle[]): boolean {
  // Si la tarea tiene meta de repeticiones (ej. 3 vasos de agua), no está completada hasta alcanzar la meta
  if (task.targetCount && task.targetCount > 1) {
    if ((task.currentCount || 0) < task.targetCount) {
      return false;
    }
  }

  const isDone = task.status === 'completed' || !!(task as any).completed_at || !!(task as any).completed;
  
  if (isDone && !task.cycle_id) {
    return true;
  }

  if (!task.cycle_id || !task.completionHistory || task.completionHistory.length === 0) {
    return false;
  }

  const cycle = cycles.find((c) => c.id === task.cycle_id);
  if (!cycle) {
    return false;
  }

  const lastCompletion = task.completionHistory[task.completionHistory.length - 1];
  const now = new Date();
  const lastDate = new Date(lastCompletion);

  return checkCyclePeriodMatch(cycle.daysValue, lastDate, now, lastCompletion);
}

/**
 * Función auxiliar pura para reducir complejidad cognitivo-ciclomática
 */
function checkCyclePeriodMatch(daysValue: number, lastDate: Date, now: Date, lastCompletion: number): boolean {
  if (daysValue === 1) {
    return lastDate.toDateString() === now.toDateString();
  }

  if (daysValue === 7) {
    const diffMs = Math.abs(now.getTime() - lastDate.getTime());
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  }

  if (daysValue === 30) {
    return lastDate.getMonth() === now.getMonth() && lastDate.getFullYear() === now.getFullYear();
  }

  if (daysValue === 365) {
    return lastDate.getFullYear() === now.getFullYear();
  }

  const cycleMs = daysValue * 24 * 60 * 60 * 1000;
  return (Date.now() - lastCompletion) < cycleMs;
}

/**
 * Detecta ciclos de dependencia usando DFS.
 * Retorna `true` si añadir `blockedByTaskId` como dependencia de
 * `targetTaskId` crearía un ciclo (deadlock).
 */
export function wouldCreateDependencyCycle(
  targetTaskId: string,
  blockedByTaskId: string,
  tasks: Record<string, TaskItem>
): boolean {
  const visited = new Set<string>();

  function dfs(currentId: string): boolean {
    if (currentId === targetTaskId) return true;
    if (visited.has(currentId)) return false;
    visited.add(currentId);

    const current = tasks[currentId];
    if (!current?.blockedBy) return false;

    return current.blockedBy.some((depId) => dfs(depId));
  }

  return dfs(blockedByTaskId);
}

/**
 * Calcula la racha consecutiva de cumplimiento de un hábito o tarea recurrente.
 * Retorna el número de periodos consecutivos completados (días o semanas).
 */
export function calculateHabitStreak(
  task: Partial<TaskItem>,
  cycles: CustomCycle[] = []
): { count: number; unit: 'días' | 'sem' } {
  if (!task.completionHistory || task.completionHistory.length === 0) {
    return { count: 0, unit: 'días' };
  }

  const cycleId = task.cycle_id || (task.targetCount ? 'cycle_day' : null);
  const cycle = cycles.find((c) => c.id === cycleId);
  const daysValue = cycle?.daysValue || 1;
  const unit = daysValue >= 7 ? 'sem' : 'días';

  // Extraer días únicos (YYYY-MM-DD) en los que se completó
  const uniqueDays = Array.from(
    new Set(
      task.completionHistory.map((ts) => {
        const d = new Date(ts);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })
    )
  ).sort().reverse(); // Orden descendente (más reciente primero)

  if (uniqueDays.length === 0) {
    return { count: 0, unit };
  }

  const now = new Date();
  const formatDay = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const todayStr = formatDay(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDay(yesterday);

  // La racha sigue viva si la última finalización fue hoy O ayer (si hoy aún no la completa)
  const lastCompletedDay = uniqueDays[0];
  if (lastCompletedDay !== todayStr && lastCompletedDay !== yesterdayStr) {
    return { count: 0, unit };
  }

  let streak = 0;
  let expectedDate = new Date(lastCompletedDay);

  for (const dayStr of uniqueDays) {
    const dayDate = new Date(dayStr);
    const diffMs = Math.abs(expectedDate.getTime() - dayDate.getTime());
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 1) {
      streak++;
      expectedDate = dayDate;
      expectedDate.setDate(expectedDate.getDate() - 1);
    } else {
      break;
    }
  }

  return { count: streak, unit };
}

export interface ExpirationStatus {
  status: 'expired' | 'imminent' | 'warning' | 'safe';
  daysRemaining: number;
  label: string;
  badgeColor: string;
  badgeBg: string;
}

/**
 * Calcula el estado de caducidad y días restantes de una tarjeta o suscripción
 */
export function calculateExpirationStatus(dueDateStr?: string): ExpirationStatus | null {
  if (!dueDateStr) return null;

  const due = new Date(dueDateStr);
  if (isNaN(due.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);

  const diffMs = dueDay.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    return {
      status: 'expired',
      daysRemaining: diffDays,
      label: absDays === 1 ? 'Caducó ayer' : `Caducó hace ${absDays} días`,
      badgeColor: '#ff3b30',
      badgeBg: 'rgba(255, 59, 48, 0.14)'
    };
  } else if (diffDays === 0) {
    return {
      status: 'imminent',
      daysRemaining: 0,
      label: 'Caduca hoy',
      badgeColor: '#ff3b30',
      badgeBg: 'rgba(255, 59, 48, 0.16)'
    };
  } else if (diffDays === 1) {
    return {
      status: 'imminent',
      daysRemaining: 1,
      label: 'Caduca mañana',
      badgeColor: '#ff9500',
      badgeBg: 'rgba(255, 149, 0, 0.16)'
    };
  } else if (diffDays <= 3) {
    return {
      status: 'imminent',
      daysRemaining: diffDays,
      label: `Caduca en ${diffDays} días`,
      badgeColor: '#ff9500',
      badgeBg: 'rgba(255, 149, 0, 0.16)'
    };
  } else if (diffDays <= 30) {
    return {
      status: 'warning',
      daysRemaining: diffDays,
      label: `${diffDays} días restantes`,
      badgeColor: '#e08600',
      badgeBg: 'rgba(255, 149, 0, 0.1)'
    };
  } else {
    const months = Math.floor(diffDays / 30);
    const label = months >= 2 ? `En ${months} meses` : `En ${diffDays} días`;
    return {
      status: 'safe',
      daysRemaining: diffDays,
      label,
      badgeColor: '#34c759',
      badgeBg: 'rgba(52, 199, 89, 0.12)'
    };
  }
}

/**
 * Extrae personas mencionadas en el texto mediante @Nombre
 */
export function extractPeopleFromText(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/@([a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9_]+)/g);
  if (!matches) return [];
  return Array.from(new Set(matches.map(m => m.slice(1).trim()).filter(Boolean)));
}

/**
 * Genera alertas preventivas recomendadas según el tipo de caducidad
 */
export function getAnticipationAlerts(type: 'card' | 'subscription' | 'other'): Array<{ id: string; type: 'before'; offsetMinutes: number; label: string }> {
  const now = Date.now();
  if (type === 'card') {
    return [
      { id: `alert_card_30d_${now}`, type: 'before', offsetMinutes: 30 * 24 * 60, label: '1 mes antes' },
      { id: `alert_card_15d_${now}`, type: 'before', offsetMinutes: 15 * 24 * 60, label: '15 días antes' }
    ];
  } else if (type === 'subscription') {
    return [
      { id: `alert_sub_3d_${now}`, type: 'before', offsetMinutes: 3 * 24 * 60, label: '3 días antes' },
      { id: `alert_sub_1d_${now}`, type: 'before', offsetMinutes: 1 * 24 * 60, label: '1 día antes' }
    ];
  }
  return [
    { id: `alert_gen_1d_${now}`, type: 'before', offsetMinutes: 1 * 24 * 60, label: '1 día antes' }
  ];
}

/**
 * Calcula el gasto recurrente total en suscripciones (mensual y anual)
 */
export function calculateSubscriptionCosts(tasks: TaskItem[]): {
  monthlyTotal: number;
  yearlyTotal: number;
  formattedMonthly: string;
  formattedYearly: string;
  count: number;
} {
  let monthlyTotal = 0;
  let count = 0;

  for (const t of tasks) {
    if (t.deleted_at || t.status === 'completed') continue;
    const isSub = t.expirationType === 'subscription' || t.sectionId === 'sec_suscripciones';
    if (!isSub) continue;

    const price = typeof t.price === 'number' && !isNaN(t.price) ? t.price : 0;
    if (price > 0) {
      count++;
      if (t.subscriptionPeriod === 'yearly') {
        monthlyTotal += price / 12;
      } else {
        monthlyTotal += price;
      }
    }
  }

  const yearlyTotal = monthlyTotal * 12;
  return {
    monthlyTotal: Math.round(monthlyTotal * 100) / 100,
    yearlyTotal: Math.round(yearlyTotal * 100) / 100,
    formattedMonthly: (Math.round(monthlyTotal * 100) / 100).toFixed(2).replace('.', ',') + ' €',
    formattedYearly: (Math.round(yearlyTotal * 100) / 100).toFixed(2).replace('.', ',') + ' €',
    count
  };
}

export interface PersonRelationshipStats {
  person: string;
  count: number;
  latestTask: TaskItem | null;
  earliestTask: TaskItem | null;
  daysSinceLast: number | null;
  lastPlanText: string;
  allPersonTasks: TaskItem[];
}

/**
 * Calcula estadísticas de relación y última vez juntos con una persona
 */
export function getPersonRelationshipStats(personName: string, allTasks: TaskItem[]): PersonRelationshipStats {
  const normName = personName.trim().toLowerCase();
  const personTasks = allTasks.filter(t => 
    !t.deleted_at && 
    t.people && 
    t.people.some(p => p.trim().toLowerCase() === normName)
  );

  // Ordenar por fecha de más reciente a más antigua
  personTasks.sort((a, b) => {
    const timeA = new Date(a.dueDate || a.created_at).getTime();
    const timeB = new Date(b.dueDate || b.created_at).getTime();
    return timeB - timeA;
  });

  const latestTask = personTasks[0] || null;
  const earliestTask = personTasks[personTasks.length - 1] || null;

  let daysSinceLast: number | null = null;
  let lastPlanText = 'Sin registros previos';

  if (latestTask) {
    const latestDate = new Date(latestTask.dueDate || latestTask.created_at);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    latestDate.setHours(0, 0, 0, 0);

    const diffMs = today.getTime() - latestDate.getTime();
    daysSinceLast = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (daysSinceLast === 0) {
      lastPlanText = '¡Hoy!';
    } else if (daysSinceLast === 1) {
      lastPlanText = 'Ayer';
    } else if (daysSinceLast > 1) {
      if (daysSinceLast < 30) {
        lastPlanText = `Hace ${daysSinceLast} días`;
      } else {
        const months = Math.floor(daysSinceLast / 30);
        lastPlanText = months === 1 ? 'Hace 1 mes' : `Hace ${months} meses`;
      }
    } else {
      lastPlanText = 'Plan futuro';
    }
  }

  return {
    person: personName,
    count: personTasks.length,
    latestTask,
    earliestTask,
    daysSinceLast,
    lastPlanText,
    allPersonTasks: personTasks
  };
}

/**
 * Detecta recuerdos de "Un día como hoy" (Flashbacks / Efemérides)
 */
export function findFlashbackMemories(tasks: TaskItem[], refDate: Date = new Date()): TaskItem[] {
  const refMonth = refDate.getMonth();
  const refDay = refDate.getDate();
  const refYear = refDate.getFullYear();

  return tasks.filter(t => {
    if (t.deleted_at) return false;
    const isMemory = t.categoryId === 'que_he_hecho' || (t.people && t.people.length > 0);
    if (!isMemory) return false;

    const d = new Date(t.dueDate || t.created_at);
    if (isNaN(d.getTime())) return false;

    // Coincidencia exacta de mes y día en un año anterior
    const isSameDayMonth = d.getMonth() === refMonth && d.getDate() === refDay;
    const isPastYear = d.getFullYear() < refYear;

    return isSameDayMonth && isPastYear;
  });
}

