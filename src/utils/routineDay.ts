// Día de las tareas semanales (0 = domingo … 6 = sábado). La ronda mensual es el primero
// de esos días de cada mes y la anual, el de enero (ver shared/periodicity.js).
export const WEEKLY_DAY_STORAGE_KEY = 'weekly_tasks_day';
export const DEFAULT_WEEKLY_DAY = 6;

export const WEEKDAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const;

export function isValidWeekday(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6;
}

/** Lectura directa (para servicios fuera de React); la app usa `weeklyTasksDay` del store. */
export function readStoredWeeklyDay(): number {
  try {
    const stored = localStorage.getItem(WEEKLY_DAY_STORAGE_KEY);
    const day = stored === null ? DEFAULT_WEEKLY_DAY : Number(stored);
    return isValidWeekday(day) ? day : DEFAULT_WEEKLY_DAY;
  } catch {
    return DEFAULT_WEEKLY_DAY;
  }
}

export function writeStoredWeeklyDay(day: number): void {
  try {
    localStorage.setItem(WEEKLY_DAY_STORAGE_KEY, String(day));
  } catch {
    /* modo privado: basta con el store */
  }
}
