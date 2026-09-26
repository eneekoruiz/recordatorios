// Planificador de avisos push (puro: sin base de datos ni red, fácil de probar).
//
// Filosofía: pocos avisos y útiles.
//  · Un único resumen al día, a la hora elegida (9:00 por defecto) y en la zona
//    horaria del usuario: «Completa tus recordatorios diarios», «Hoy te tocan los
//    recordatorios semanales» (su día semanal), «Hoy toca la ronda mensual» (el primer
//    día semanal del mes) o «Hoy toca la revisión anual» (el de enero). Si coinciden,
//    van en uno solo.
//  · Avisos con hora solo para las alertas que el usuario puso en un recordatorio.
//    Si varias caen en la misma pasada, se agrupan en una notificación.
//
// La frecuencia de cada tarea se deduce igual que en la app (título, lista o sección:
// ver shared/periodicity.js) y lo ya hecho en el periodo en curso no cuenta.
import { getTaskPeriodicity, routineRoundsOn } from '../shared/periodicity.js';

const DEFAULT_TZ = 'Europe/Madrid';
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Si el planificador lleva mucho sin ejecutarse, no se disparan avisos viejos en tromba.
const MAX_LOOKBACK_MS = 2 * 60 * 60 * 1000;

export function safeTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || !timeZone) return DEFAULT_TZ;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(0);
    return timeZone;
  } catch {
    return DEFAULT_TZ;
  }
}

/** Fecha y hora de pared de `date` en `timeZone`. */
export function zonedParts(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    hh: Number(p.hour),
    mm: Number(p.minute),
    weekday: WEEKDAYS.indexOf(p.weekday),
    dateKey: `${p.year}-${p.month}-${p.day}`,
  };
}

/** Instante UTC de una hora de pared en `timeZone` (respeta el cambio de hora). */
export function zonedTimeToUtc(y, m, d, hh, mm, timeZone) {
  const target = Date.UTC(y, m - 1, d, hh, mm);
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const p = zonedParts(new Date(guess), timeZone);
    const diff = target - Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm);
    if (diff === 0) break;
    guess += diff;
  }
  return new Date(guess);
}

/** Lunes a las 00:00 (hora local de `timeZone`) de la semana de `now`, como en la app. */
export function startOfZonedWeek(now, timeZone) {
  const p = zonedParts(now, timeZone);
  const monday = new Date(Date.UTC(p.y, p.m - 1, p.d - ((p.weekday + 6) % 7)));
  return zonedTimeToUtc(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate(), 0, 0, timeZone);
}

/**
 * ¿Está hecha para el periodo en curso? Mismo criterio que la app (isTaskCompleted +
 * isCompletedInCurrentPeriod): las periódicas vuelven a «pendiente» al completarlas y
 * lo que cuenta es su última vez en el historial (hoy, esta semana, este mes o este año).
 */
export function isDone(task, periodicity = null, now = new Date(), timeZone = DEFAULT_TZ) {
  if (task.targetCount && task.targetCount > 1) return (task.currentCount || 0) >= task.targetCount;
  if (task.status === 'completed' || Boolean(task.completed_at) || Boolean(task.completed)) return true;
  if (!periodicity) return false;
  const history = Array.isArray(task.completionHistory) ? task.completionHistory : [];
  const last = Number(history[history.length - 1]);
  if (!Number.isFinite(last)) return false;
  const then = zonedParts(new Date(last), timeZone);
  const today = zonedParts(now, timeZone);
  if (periodicity === 'day') return then.dateKey === today.dateKey;
  if (periodicity === 'week') return last >= startOfZonedWeek(now, timeZone).getTime();
  if (periodicity === 'month') return then.y === today.y && then.m === today.m;
  return then.y === today.y;
}

/** Momentos (en el intervalo (from, to]) en que deben sonar las alertas de una tarea. */
export function alertFireTimes(task, timeZone, from, to, periodicity = null) {
  const out = [];
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const hasDue = due && !Number.isNaN(due.getTime());
  for (const alert of Array.isArray(task.alerts) ? task.alerts : []) {
    if (!alert || typeof alert !== 'object') continue;
    const candidates = [];
    if (alert.type === 'before' && typeof alert.offsetMinutes === 'number' && hasDue) {
      candidates.push(new Date(due.getTime() - alert.offsetMinutes * 60_000));
    } else if (alert.type === 'at_time' && typeof alert.time === 'string' && /^\d{1,2}:\d{2}$/.test(alert.time)) {
      const [hh, mm] = alert.time.split(':').map(Number);
      if (hasDue) {
        const p = zonedParts(due, timeZone);
        candidates.push(zonedTimeToUtc(p.y, p.m, p.d, hh, mm, timeZone));
      } else if (periodicity === 'day' || task.cycle_id === 'cycle_day') {
        // Diarias sin fecha: la alerta suena cada día a esa hora.
        for (const day of [from, to]) {
          const p = zonedParts(day, timeZone);
          candidates.push(zonedTimeToUtc(p.y, p.m, p.d, hh, mm, timeZone));
        }
      }
    }
    for (const at of candidates) {
      if (at > from && at <= to && !out.some((t) => t.getTime() === at.getTime())) out.push(at);
    }
  }
  return out;
}

const joinNatural = (items) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * Resumen del día (o null si hoy no toca nada).
 * @param {Array<{task: object, periodicity: string|null}>} pending tareas pendientes ya clasificadas
 */
export function buildDigest(pending, local, weeklyDay) {
  const rounds = routineRoundsOn({ month: local.m, day: local.d, weekday: local.weekday }, weeklyDay);
  const count = (p) => pending.filter((x) => x.periodicity === p).length;
  const dueToday = pending.filter(
    (x) => !x.periodicity && x.task.dueDate && zonedParts(new Date(x.task.dueDate), local.timeZone).dateKey === local.dateKey
  ).length;
  const daily = count('day');
  const weekly = rounds.week ? count('week') : 0;
  const monthly = rounds.month ? count('month') : 0;
  const yearly = rounds.year ? count('year') : 0;

  const parts = [];
  if (yearly) parts.push(plural(yearly, 'anual', 'anuales'));
  if (monthly) parts.push(plural(monthly, 'mensual', 'mensuales'));
  if (weekly) parts.push(plural(weekly, 'semanal', 'semanales'));
  if (daily) parts.push(plural(daily, 'diario', 'diarios'));
  if (dueToday) parts.push(`${dueToday} con fecha de hoy`);
  if (parts.length === 0) return null;

  const title = yearly
    ? 'Hoy toca la revisión anual'
    : monthly
      ? 'Hoy toca la ronda mensual'
      : weekly
        ? 'Hoy te tocan los recordatorios semanales'
        : daily
          ? 'Completa tus recordatorios diarios'
          : 'Tienes recordatorios para hoy';
  return { title, body: `Pendientes: ${joinNatural(parts)}.`, tag: `digest-${local.dateKey}`, url: '/' };
}

/**
 * Decide qué avisos enviar a una suscripción.
 * @returns {{ messages: Array<{title:string, body:string, tag:string, url:string}>, sentLog: object }}
 */
export function planNotifications({ tasks, lists = [], sections = [], prefs = {}, now = new Date(), since, sentLog = {} }) {
  const timeZone = safeTimeZone(prefs.timeZone);
  const digestHour = Number.isInteger(prefs.digestHour) ? prefs.digestHour : 9;
  const weeklyDay = Number.isInteger(prefs.weeklyDay) ? prefs.weeklyDay : 6;
  const from = new Date(Math.max(since ? new Date(since).getTime() : now.getTime(), now.getTime() - MAX_LOOKBACK_MS));
  const local = { ...zonedParts(now, timeZone), timeZone };
  const messages = [];
  const nextLog = { ...(sentLog && typeof sentLog === 'object' ? sentLog : {}) };

  // Pendientes de verdad: ni borradas, ni de la guía de inicio, ni hechas en su periodo.
  const pending = (Array.isArray(tasks) ? tasks : [])
    .filter((task) => task && !task.deleted_at && task.categoryId !== 'primeros_pasos')
    .map((task) => ({ task, periodicity: getTaskPeriodicity(task, sections, lists) }))
    .filter(({ task, periodicity }) => !isDone(task, periodicity, now, timeZone));

  // 1) Resumen del día, una sola vez y a partir de la hora elegida.
  if (local.hh >= digestHour && nextLog.digest !== local.dateKey) {
    const digest = buildDigest(pending, local, weeklyDay);
    if (digest) messages.push(digest);
    nextLog.digest = local.dateKey;
  }

  // 2) Alertas con hora que caen en esta pasada, agrupadas.
  const due = pending
    .filter(({ task, periodicity }) => alertFireTimes(task, timeZone, from, now, periodicity).length > 0)
    .map(({ task }) => (typeof task.title === 'string' && task.title.trim() ? task.title.trim() : 'Recordatorio'));
  if (due.length === 1) {
    messages.push({ title: 'Recordatorio', body: due[0], tag: `alert-${now.getTime()}`, url: '/' });
  } else if (due.length > 1) {
    const shown = due.slice(0, 3);
    const rest = due.length - shown.length;
    messages.push({
      title: `${due.length} recordatorios`,
      body: rest > 0 ? `${shown.join(', ')} y ${plural(rest, 'más', 'más')}` : joinNatural(shown),
      tag: `alert-${now.getTime()}`,
      url: '/',
    });
  }

  return { messages, sentLog: nextLog };
}
