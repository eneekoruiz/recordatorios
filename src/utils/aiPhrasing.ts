// Comprensión de lenguaje hablado/enrevesado para el extractor local del asistente.
// Funciones puras (sin red ni estado): «oye, cuando puedas, el jueves que viene por la tarde
// recuérdame que tengo que llamar a mi madre» debe acabar como «Llamar a mi madre · jueves · tarde».

const WEEKDAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const;
const WEEKDAY_SRC = '(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)';

const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Índice Date.getDay() (0 = domingo) de un nombre de día, con o sin tilde. */
export function weekdayIndex(name: string): number {
  const clean = stripAccents(name);
  return WEEKDAY_NAMES.findIndex((d) => stripAccents(d) === clean);
}

// ── Normalización previa a partir en segmentos ──────────────────────────────────────────────

/**
 * Prepara el texto antes de trocearlo en tareas:
 *  · «lunes y miércoles» se protege como «lunes/miércoles» (no son dos tareas);
 *  · «3 euros cada uno» → «3€» (precio unitario que el extractor de precios sí entiende);
 *  · muletillas de enlace («ah y también», «además») pasan a ser una simple coma.
 */
export function normalizeSpokenPrompt(text: string): string {
  let out = text;
  const list = new RegExp(`\\b(${WEEKDAY_SRC})((?:\\s*(?:,|y|e)\\s*${WEEKDAY_SRC})+)`, 'gi');
  out = out.replace(list, (_m, first: string, rest: string) => {
    const days = [first, ...(rest.match(new RegExp(WEEKDAY_SRC, 'gi')) || [])];
    return days.join('/');
  });
  out = out.replace(
    /(\d+(?:[.,]\d+)?)\s*(?:euros?|€|eur)\s*(?:cada\s+un[oa]|la\s+unidad|por\s+unidad|c\/u|la\s+pieza)/gi,
    '$1€'
  );
  out = out.replace(/(?:,\s*)?\b(?:ah,?\s+)?(?:y\s+)?(?:tambi[eé]n|adem[aá]s)\b,?\s*/gi, ', ');
  out = out.replace(/(?:,\s*){2,}/g, ', ').replace(/^\s*,\s*/, '');
  return out.trim();
}

// ── Marcos conversacionales ─────────────────────────────────────────────────────────────────

const LEAD_FILLER =
  /^(?:oye|mira|pues|bueno|vale|eh+|ah+|hombre|a\s+ver|no\s+s[eé]|igual|quiz[aá]s?|por\s+favor|si\s+puedes|cuando\s+puedas|cuando\s+te\s+venga\s+bien|cuando\s+tengas\s+un\s+rato|te\s+pido\s+que|te\s+ruego\s+que|una\s+cosa|por\s+cierto)\b[\s,.:;]*/i;

/** «recuérdame que», «apúntame», «no me dejes olvidar», «tengo que», «debería»… en cualquier punto. */
const REQUEST_FRAME =
  /\b(?:(?:por\s+favor,?\s+)?(?:recu[eé]rdame|ap[uú]ntame|ap[uú]ntalo|anota(?:me)?|a[ñn]ade(?:me)?|agrega(?:me)?|pon(?:me)?\s+un\s+recordatorio(?:\s+para)?|crea(?:me)?\s+(?:un\s+)?recordatorio(?:\s+para)?)(?:\s+que)?|no\s+(?:te\s+)?(?:olvides|me\s+dejes\s+olvidar)(?:\s+de)?|acu[eé]rdate\s+de|(?:tendr[ií]a|deber[ií]a|tengo|debo|hay|necesito|quiero)\s+(?:que\s+)?(?=[a-záéíóúñ]+(?:ar|er|ir|arme|erme|irme)\b)|(?:deber[ií]a|debo)\s+)/gi;

/** Quita muletillas iniciales y verbos de petición; conserva el contenido. */
export function stripRequestFrames(segment: string): string {
  let out = segment.trim();
  for (let i = 0; i < 4; i++) {
    const next = out.replace(LEAD_FILLER, '');
    if (next === out) break;
    out = next;
  }
  out = out.replace(REQUEST_FRAME, ' ');
  // Restos sueltos de «que» delante del verbo tras quitar el marco.
  out = out.replace(/^(?:que|de)\s+(?=[a-záéíóúñ]+(?:ar|er|ir)\b)/i, '');
  return out.replace(/\s{2,}/g, ' ').replace(/^[\s,;:.]+/, '').trim();
}

/** Segmentos que no son ninguna tarea: muletillas o conectores sueltos. */
export function isFillerOnly(segment: string): boolean {
  const s = stripAccents(segment).replace(/[\s,.;:!?¡¿]+/g, ' ').trim().replace(/^(?:y|o) /, '');
  if (!s) return true;
  return /^(?:oye|mira|pues|bueno|vale|eh+|ah+|hombre|a ver|no se|igual|quizas?|por favor|tambien|ademas|luego|despues|y|o|ya|eso|eso es todo|nada mas|gracias|apuntame|recuerdame|una cosa|por cierto)$/.test(s);
}

/** «es urgente», «que sea importante»… → prioridad alta de la tarea anterior (no es una tarea). */
export function asPriorityModifier(segment: string): 'high' | null {
  const s = stripAccents(segment).replace(/[.!¡]+/g, '').trim();
  return /^(?:(?:y\s+)?(?:es|seria|que\s+sea|eso\s+es|esto\s+es)\s+(?:muy\s+)?(?:urgente|importante|prioritari[oa])|(?:con\s+)?prioridad\s+alta|urgente|importante)$/.test(s) ? 'high' : null;
}

// ── Días de la semana ───────────────────────────────────────────────────────────────────────

export interface WeekdayPhrase {
  /** Texto exacto a retirar del título. */
  matched: string;
  /** Próxima fecha (mediodía local) del primer día que toque. */
  date: Date;
  /** «todos los lunes», «cada martes»: se repite cada semana. */
  recurring: boolean;
  /** Nombres de los días mencionados, en orden. */
  days: string[];
}

/** Interpreta «el jueves», «el jueves que viene», «antes del viernes», «todos los lunes/miércoles». */
export function parseWeekdayPhrase(text: string, now: Date = new Date()): WeekdayPhrase | null {
  const re = new RegExp(
    `\\b((?:antes\\s+del?\\s+|para\\s+el\\s+|hasta\\s+el\\s+|el\\s+pr[oó]ximo\\s+|el\\s+|este\\s+|todos\\s+los\\s+|cada\\s+|los\\s+)?)(${WEEKDAY_SRC}(?:\\/${WEEKDAY_SRC})*)((?:\\s+que\\s+viene|\\s+pr[oó]ximo)?)`,
    'i'
  );
  const m = text.match(re);
  if (!m) return null;
  const prefix = stripAccents(m[1] || '');
  const days = m[2].split('/').map((d) => d.toLowerCase());
  const recurring = /todos\s+los|cada|^los\s*$/.test(prefix);
  const today = new Date(now);
  today.setHours(12, 0, 0, 0);
  let best: Date | null = null;
  for (const name of days) {
    // Próxima vez que toca ese día; si hoy ya es ese día, se entiende el de la semana que viene.
    const ahead = ((weekdayIndex(name) - today.getDay() + 7) % 7) || 7;
    const d = new Date(today.getTime() + ahead * 86400000);
    if (!best || d < best) best = d;
  }
  if (!best) return null;
  return { matched: m[0], date: best, recurring, days };
}

// ── Hora ────────────────────────────────────────────────────────────────────────────────────

export interface ClockTime {
  matched: string;
  hour: number;
  minute: number;
}

/**
 * «a las 5», «sobre las 5», «hacia las 17:30», «a eso de las 8 de la tarde», «a las 8h».
 * Sin indicación, de 1 a 7 se entiende de la tarde (17:00); de 8 a 11, de la mañana.
 * Ojo: «h» solo cuenta como sufijo de hora si no va seguida de letra («8 hacer» ≠ «8h»).
 */
export function parseClockTime(text: string): ClockTime | null {
  const re =
    /\b(?:a\s+las?|a\s+la|sobre\s+las?|sobre\s+la|hacia\s+las?|hacia\s+la|a\s+eso\s+de\s+las?|para\s+las?)\s+(\d{1,2})(?::([0-5]\d))?\s*(am|pm|h(?![a-záéíóúñ])|de\s+la\s+(?:ma[ñn]ana|tarde|noche)|del\s+mediod[ií]a)?/i;
  const m = text.match(re);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  if (hour > 23) return null;
  const minute = m[2] ? parseInt(m[2], 10) : 0;
  const cue = stripAccents(m[3] || '');
  const mentionsAfternoon = /tarde|noche/.test(cue) || /\b(?:por\s+la\s+(?:tarde|noche)|de\s+la\s+(?:tarde|noche))\b/i.test(text);
  if (cue === 'pm' || (mentionsAfternoon && hour < 12)) hour = hour < 12 ? hour + 12 : hour;
  else if (cue === 'am' && hour === 12) hour = 0;
  else if (!cue && hour >= 1 && hour <= 7) hour += 12;
  return { matched: m[0].replace(/\s+$/, ''), hour, minute };
}

export function timeOfDayForHour(hour: number): 'morning' | 'afternoon' | 'night' {
  if (hour >= 6 && hour < 14) return 'morning';
  if (hour >= 14 && hour < 20) return 'afternoon';
  return 'night';
}

// ── Limpieza del título y herencia entre segmentos ──────────────────────────────────────────

/** Quita conectores colgando («… de», «… para») y frases de franja ya interpretadas. */
export function tidyTitle(title: string): string {
  let out = title
    .replace(/\b(?:por|de|en)\s+la\s+(?:ma[ñn]ana|tarde|noche)\b/gi, ' ')
    .replace(/\b(?:sobre|hacia)\s+(?:las?|la)\b/gi, ' ')
    .replace(/\s{2,}/g, ' ');
  for (let i = 0; i < 3; i++) {
    out = out
      .replace(/[\s,;:]+$/g, '')
      .replace(/\s+(?:de|del|para|por|en|a|el|la|los|las|que|y|o|con|antes|hasta)$/i, '')
      .replace(/^(?:que|de|para|y|o|pues|luego)\s+/i, '')
      .trim();
  }
  return out;
}

const INFINITIVE = /^([a-záéíóúñ]{2,}(?:ar|er|ir))\s+\S/i;
/** Verbos en -ar/-er/-ir que empiezan la frase (no confundir con sustantivos: «lugar», «mujer»…). */
const NOT_VERBS = new Set(['lugar', 'mujer', 'dolor', 'calor', 'color', 'motor', 'amor', 'tenedor', 'cajer', 'papel', 'hogar', 'pilar', 'militar', 'ajar', 'mar', 'par', 'bar', 'ar', 'er', 'ir']);

/** Infinitivo con el que empieza un segmento («comprar pan» → «comprar»), o null. */
export function leadingInfinitive(segment: string): string | null {
  const m = segment.trim().match(INFINITIVE);
  if (!m) return null;
  const v = m[1].toLowerCase();
  return NOT_VERBS.has(v) ? null : v;
}

/** ¿Es una frase nominal corta y sin verbo (p. ej. «leche», «cepillos de dientes»)? */
export function isBareNounPhrase(segment: string): boolean {
  const words = segment.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 5) return false;
  if (leadingInfinitive(segment)) return false;
  // Una fecha u hora dicha aparte no es un elemento nuevo: completa la tarea anterior.
  if (parseWeekdayPhrase(segment) || parseClockTime(segment) || /\b(?:hoy|ma[ñn]ana|pasado\s+ma[ñn]ana|ayer)\b/i.test(segment)) return false;
  return !/[?¿!¡]/.test(segment) && !/^(?:y|o|pero|que|si|no|es|son|hay|ya|hoy|ayer|mañana)\b/i.test(segment.trim());
}
