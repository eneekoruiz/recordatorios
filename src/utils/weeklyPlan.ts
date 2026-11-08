import type { GymRoutineSplit } from './gymExercises';
import type { ListSection, TaskItem } from '../models/Task';

export interface WeeklyScheduleDay {
  weekdayIndex: number; // 0 = Lunes, 1 = Martes, ..., 6 = Domingo
  jsDay: number; // 1 = Lunes, ..., 6 = Sábado, 0 = Domingo
  shortWeekday: string; // 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'
  fullWeekday: string; // 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'
  isRest: boolean;
  dayNumber?: number; // 1, 2, 3, 4
  sectionId?: string;
  shortLabel: string; // 'Día 1', 'Día 2', 'Descanso'
  title: string; // 'Tren superior A', 'Recuperación activa'
  meta?: string; // '4 ejercicios · 45 min'
  isToday: boolean;
}

export const WEEKDAYS_ORDER = [
  { index: 0, jsDay: 1, short: 'Lun', full: 'Lunes' },
  { index: 1, jsDay: 2, short: 'Mar', full: 'Martes' },
  { index: 2, jsDay: 3, short: 'Mié', full: 'Miércoles' },
  { index: 3, jsDay: 4, short: 'Jue', full: 'Jueves' },
  { index: 4, jsDay: 5, short: 'Vie', full: 'Viernes' },
  { index: 5, jsDay: 6, short: 'Sáb', full: 'Sábado' },
  { index: 6, jsDay: 0, short: 'Dom', full: 'Domingo' }
] as const;

/**
 * Plantillas predeterminadas de planificación semanal para rutinas de entrenamiento.
 * Mapean los 7 días de la semana (Lunes a Domingo) a días de entrenamiento y días de descanso.
 */
export const DEFAULT_SPLIT_WEEKLY_MAP: Record<string, (number | null)[]> = {
  // Lunes: Día 1, Martes: Día 2, Miércoles: Descanso, Jueves: Día 3, Viernes: Día 4, Fin de semana: Descanso
  torso_pierna_4d: [1, 2, null, 3, 4, null, null],
  // Lunes: Día 1 (Push), Martes: Descanso, Miércoles: Día 2 (Pull), Jueves: Descanso, Viernes: Día 3 (Legs), Fin de semana: Descanso
  ppl_3d: [1, null, 2, null, 3, null, null],
  // Lunes: Día 1 (FB 1), Martes: Descanso, Miércoles: Día 2 (FB 2), Jueves: Descanso, Viernes: Día 3 (FB 3), Fin de semana: Descanso
  fullbody_3d: [1, null, 2, null, 3, null, null]
};

/**
 * Genera la planificación semanal completa de 7 días (Lunes a Domingo) para un split dado.
 */
export function getWeeklySplitSchedule(
  split: GymRoutineSplit | string = 'torso_pierna_4d',
  daySections: ListSection[] = [],
  referenceDate: Date = new Date(),
  tasks: TaskItem[] = []
): WeeklyScheduleDay[] {
  const currentJsDay = referenceDate.getDay();
  const pattern = DEFAULT_SPLIT_WEEKLY_MAP[split] || (
    daySections.length === 4 ? [1, 2, null, 3, 4, null, null] :
    daySections.length === 3 ? [1, null, 2, null, 3, null, null] :
    daySections.length === 5 ? [1, 2, 3, 4, 5, null, null] :
    [1, 2, 3, 4, null, null, null]
  );

  return WEEKDAYS_ORDER.map((wd, idx) => {
    const dayNum = pattern[idx];
    const isRest = dayNum === null || dayNum === undefined;
    const isToday = wd.jsDay === currentJsDay;

    if (isRest) {
      const title = idx === 5 || idx === 6
        ? 'Descanso fin de semana y regeneración'
        : 'Recuperación activa y descanso muscular';

      return {
        weekdayIndex: wd.index,
        jsDay: wd.jsDay,
        shortWeekday: wd.short,
        fullWeekday: wd.full,
        isRest: true,
        shortLabel: 'Descanso',
        title,
        isToday
      };
    }

    // Buscar sección correspondiente a este dayNum (Día 1, Día 2, etc.)
    const matchingSec = daySections.find(s => {
      const m = s.name.match(/d[ií]a\s*(\d+)/i);
      return m ? Number(m[1]) === dayNum : false;
    }) || daySections[dayNum - 1];

    let cleanTitle = matchingSec
      ? matchingSec.name.replace(/d[ií]a\s*\d+\s*:?\s*/i, '').trim()
      : `Entrenamiento ${dayNum}`;

    if (!cleanTitle) cleanTitle = `Día ${dayNum}`;

    // Contar ejercicios y duración si se facilitan tareas
    let meta: string | undefined;
    if (matchingSec && tasks.length > 0) {
      const dayTasks = tasks.filter(t => !t.deleted_at && t.sectionId === matchingSec.id && !t.isRest && !t.parentId);
      if (dayTasks.length > 0) {
        meta = `${dayTasks.length} ${dayTasks.length === 1 ? 'ejercicio' : 'ejercicios'}`;
      }
    }

    return {
      weekdayIndex: wd.index,
      jsDay: wd.jsDay,
      shortWeekday: wd.short,
      fullWeekday: wd.full,
      isRest: false,
      dayNumber: dayNum,
      sectionId: matchingSec?.id,
      shortLabel: `Día ${dayNum}`,
      title: cleanTitle,
      meta,
      isToday
    };
  });
}

/**
 * Obtiene el día de la planificación semanal correspondiente a una fecha específica.
 */
export function getWeeklyScheduleForDate(
  date: Date,
  split: GymRoutineSplit | string = 'torso_pierna_4d',
  daySections: ListSection[] = [],
  tasks: TaskItem[] = []
): WeeklyScheduleDay | null {
  const schedule = getWeeklySplitSchedule(split, daySections, date, tasks);
  const jsDay = date.getDay();
  return schedule.find(d => d.jsDay === jsDay) || null;
}
