// Frecuencia de un recordatorio (diaria, semanal, mensual o anual).
//
// Módulo compartido entre la app y el servidor: los avisos push y el calendario
// tienen que contar exactamente las mismas tareas que el usuario ve en pantalla.
// JavaScript puro con tipos en periodicity.d.ts.

/**
 * Prefijos de periodicidad al inicio del título: [D], [Diario], [Diaria], [S], [Semanal],
 * [M], [Mensual], [A], [Anual] (también entre paréntesis).
 */
export const PERIODICITY_PREFIX_REGEX = /^\s*(\[|\()(D|Diari[oa]|S|Semanal|M|Mensual|A|Anual)(\]|\))\s*[:-]?\s*/i;

/** Periodicidad indicada por el prefijo del título, o null. */
export function getPeriodicityFromPrefix(title) {
  if (!title) return null;
  const trimmed = title.trim();
  if (/^(\[|\()(D|Diari[oa])(\]|\))/i.test(trimmed)) return 'day';
  if (/^(\[|\()(S|Semanal)(\]|\))/i.test(trimmed)) return 'week';
  if (/^(\[|\()(M|Mensual)(\]|\))/i.test(trimmed)) return 'month';
  if (/^(\[|\()(A|Anual)(\]|\))/i.test(trimmed)) return 'year';
  return null;
}

const periodicityFromText = (text) => {
  if (text.includes('diari') || text.includes('recurrent') || /\b(d[ií]as?)\b/i.test(text)) return 'day';
  if (text.includes('seman') || /\b(sem)\b/i.test(text)) return 'week';
  if (text.includes('mensu') || /\b(mes(es)?)\b/i.test(text)) return 'month';
  if (text.includes('anual') || /\b(a[ñn]os?)\b/i.test(text)) return 'year';
  return null;
};

/**
 * Periodicidad de un recordatorio según su título, cycle_id, repeticiones diarias,
 * lista de procedencia o sección (las subsecciones heredan de su sección padre).
 */
export function getTaskPeriodicity(task, sections, lists) {
  // 0. Prefijo en el título
  const fromPrefix = getPeriodicityFromPrefix(task.title);
  if (fromPrefix) return fromPrefix;

  // 1. cycle_id explícito
  if (task.cycle_id) {
    const c = (task.cycle_id || '').toLowerCase();
    if (c === 'cycle_day' || c.includes('day') || c.includes('diari')) return 'day';
    if (c === 'cycle_week' || c.includes('week') || c.includes('seman')) return 'week';
    if (c === 'cycle_month' || c.includes('month') || c.includes('mensu')) return 'month';
    if (c === 'cycle_year' || c.includes('year') || c.includes('anual')) return 'year';
  }

  // 2. frequencyLevel si viene de importación o metadato
  const freq = (task.frequencyLevel || task.frequency || '').toString().toLowerCase();
  if (freq.includes('day') || freq.includes('diari')) return 'day';
  if (freq.includes('week') || freq.includes('seman')) return 'week';
  if (freq.includes('month') || freq.includes('mensu')) return 'month';
  if (freq.includes('year') || freq.includes('anual')) return 'year';

  // 3. Hábitos o contador diario
  if (task.targetCount && task.targetCount > 1) return 'day';

  // 4. Sublista o lista (ej. limpieza_diaria, limpieza_semanal, etc.)
  const catId = task.categoryId || task.category_id;
  if (catId) {
    const catLower = (catId || '').toLowerCase();
    if (catLower === 'limpieza_diaria' || catLower.includes('diari')) return 'day';
    if (catLower === 'limpieza_semanal' || catLower.includes('seman')) return 'week';
    if (catLower === 'limpieza_mensual' || catLower.includes('mensu')) return 'month';
    if (catLower === 'limpieza_anual' || catLower.includes('anual')) return 'year';

    const listObj = lists?.find((l) => l.id === catId);
    if (listObj) {
      const fromList = periodicityFromText((listObj.name || catId || '').toLowerCase());
      if (fromList) return fromList;
    }
  }

  // 5. Sección asignada (las subsecciones heredan de su sección padre)
  const secId = task.sectionId || task.section_id;
  if (secId) {
    const secLower = (secId || '').toLowerCase();
    if (secLower.includes('diari')) return 'day';
    if (secLower.includes('seman')) return 'week';
    if (secLower.includes('mensu')) return 'month';
    if (secLower.includes('anual')) return 'year';

    let secObj = sections?.find((s) => s.id === secId);
    const seen = new Set();
    while (secObj && !seen.has(secObj.id)) {
      seen.add(secObj.id);
      const fromSection = periodicityFromText(`${secObj.name || ''} ${secObj.id || ''}`.toLowerCase());
      if (fromSection) return fromSection;
      const parentId = secObj.parentId;
      secObj = parentId ? sections?.find((s) => s.id === parentId) : undefined;
    }
  }

  return null;
}

const CYCLE_BY_PERIODICITY = { day: 'cycle_day', week: 'cycle_week', month: 'cycle_month', year: 'cycle_year' };

/** cycle_id canónico ('cycle_day', 'cycle_week'…) deducido o explícito. */
export function getEffectiveCycleId(task, sections, lists) {
  const p = getTaskPeriodicity(task, sections, lists);
  if (p) return CYCLE_BY_PERIODICITY[p];
  if (task.cycle_id) return task.cycle_id;
  return null;
}

/**
 * Rondas de rutina que tocan un día: las diarias, siempre; las semanales, en el día elegido
 * (sábado por defecto); la mensual, el primero de esos días de cada mes; y la anual, el de
 * enero. Así la limpieza mensual cae en un día de limpieza y no en un martes cualquiera.
 * @param {{ month: number, day: number, weekday: number }} date mes 1-12, día 1-31, weekday 0 = domingo
 */
export function routineRoundsOn({ month, day, weekday }, weeklyDay = 6) {
  const week = weekday === weeklyDay;
  const monthRound = week && day <= 7;
  return { day: true, week, month: monthRound, year: monthRound && month === 1 };
}
