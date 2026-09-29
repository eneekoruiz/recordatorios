import { extractPrice } from './priceExtractor';

export interface ParsedNLPResult {
  times: string[];
  suggestedCategory?: string;
  suggestedCycleId?: string;
  suggestedDueDate?: Date;
  suggestedPriority?: 'none' | 'low' | 'medium' | 'high';
  suggestedPrice?: number;
  cleanTitle: string;
}

/**
 * Motor de lenguaje natural avanzado para Recordatorios Élite.
 * Extrae fechas, horas, ciclos, prioridades y listas en español.
 */
// «a las 18:30», «y a las 9 de la noche», «a la 1»
const TIME_PHRASE = /(?:y\s+)?(?:a las?|a la)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm|de la mañana|de la tarde|de la noche)?/gi;

// «9:30» suelto (sin «a las»)
const BARE_TIME = /(?:^|\s)(\d{1,2}):(\d{2})(?:\s*h(?:oras?)?)?(?=\s|$|[,.;])/gi;

const MONTHS: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7,
  septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};
const MONTH_SRC = Object.keys(MONTHS).join('|');
const WD_SRC = 'domingos?|lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bados?';
const NUMBER_WORDS: Record<string, number> = { un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };
const PREP = '(?:(?:antes|despu[ée]s)\\s+del?\\s+|para\\s+el\\s+|hasta\\s+el\\s+|desde\\s+el\\s+|el\\s+|del?\\s+)?';

const weekdayIndex = (w: string): number => {
  const n = w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'].findIndex((d) => n.startsWith(d));
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Próxima vez que cae el día N del mes (hoy incluido). */
function nextDayOfMonth(day: number, now: Date): Date | undefined {
  if (day < 1 || day > 31) return undefined;
  let y = now.getFullYear();
  let m = now.getMonth();
  for (let i = 0; i < 24; i++) {
    const d = new Date(y, m, day);
    if (d.getMonth() === m && d >= startOfDay(now)) return d;
    if (++m > 11) { m = 0; y++; }
  }
  return undefined;
}

/** «15 de octubre»: este año, o el siguiente si ya pasó (salvo que se diga el año). */
function dateFromParts(day: number, month: number, year: number | undefined, now: Date): Date | undefined {
  if (day < 1 || day > 31 || month < 0 || month > 11) return undefined;
  const y = year ?? now.getFullYear();
  let d = new Date(y, month, day);
  if (d.getMonth() !== month) return undefined;
  if (year === undefined && d < startOfDay(now)) d = new Date(y + 1, month, day);
  return d;
}

/** Fecha, frecuencia y horas que se pueden leer con frases más largas; devuelve también qué trozos del título consumen. */
export function readExtendedDate(dateText: string, now: Date): { date?: Date; cycle?: string; consumed: RegExp[] } {
  const consumed: RegExp[] = [];
  const found: { date?: Date; cycle?: string } = {};

  // «el 1 de cada mes», «el 15 de cada mes»
  let m = dateText.match(new RegExp(`\\b(?:el\\s+)?(\\d{1,2})\\s+de\\s+cada\\s+mes\\b`));
  if (m) {
    found.cycle = 'cycle_month';
    found.date = nextDayOfMonth(parseInt(m[1], 10), now);
    consumed.push(/(?:^|\s)(?:el\s+)?\d{1,2}\s+de\s+cada\s+mes\b/gi);
    return { ...found, consumed };
  }

  // «15 de octubre», «el 3 de marzo de 2027», «antes del 20 de noviembre»
  m = dateText.match(new RegExp(`\\b(\\d{1,2})\\s+de\\s+(${MONTH_SRC})(?:\\s+(?:de|del)\\s+(\\d{4}))?\\b`));
  if (m) {
    const d = dateFromParts(parseInt(m[1], 10), MONTHS[m[2]], m[3] ? parseInt(m[3], 10) : undefined, now);
    if (d) {
      found.date = d;
      consumed.push(new RegExp(`(?:^|\\s)${PREP}\\d{1,2}\\s+de\\s+(?:${MONTH_SRC})(?:\\s+(?:de|del)\\s+\\d{4})?\\b`, 'gi'));
      return { ...found, consumed };
    }
  }

  // «15/10/2026»
  m = dateText.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (m) {
    const y = parseInt(m[3], 10);
    const d = dateFromParts(parseInt(m[1], 10), parseInt(m[2], 10) - 1, y < 100 ? 2000 + y : y, now);
    if (d) {
      found.date = d;
      consumed.push(new RegExp(`(?:^|\\s)${PREP}\\d{1,2}\\/\\d{1,2}\\/\\d{2,4}\\b`, 'gi'));
      return { ...found, consumed };
    }
  }

  // «en 3 días», «dentro de dos semanas», «en un mes»
  m = dateText.match(/\b(?:en|dentro de)\s+(\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(d[íi]as?|semanas?|mes(?:es)?)\b/);
  if (m) {
    const n = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : NUMBER_WORDS[m[1]];
    const d = new Date(now);
    if (/^d/.test(m[2])) d.setDate(d.getDate() + n);
    else if (/^s/.test(m[2])) d.setDate(d.getDate() + 7 * n);
    else d.setMonth(d.getMonth() + n);
    found.date = d;
    consumed.push(/(?:^|\s)(?:en|dentro de)\s+(?:\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(?:d[íi]as?|semanas?|mes(?:es)?)\b/gi);
    return { ...found, consumed };
  }

  // «la semana que viene», «el mes que viene»
  m = dateText.match(/\b(?:la semana|el mes) que viene\b/);
  if (m) {
    const d = new Date(now);
    if (m[0].includes('semana')) d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    found.date = d;
    consumed.push(/(?:^|\s)(?:para\s+)?(?:la semana|el mes) que viene\b/gi);
    return { ...found, consumed };
  }

  // «esta noche», «esta tarde», «esta mañana»: hoy
  if (/\besta\s+(?:noche|tarde|ma[ñn]ana)\b/.test(dateText)) {
    found.date = new Date(now);
    consumed.push(/(?:^|\s)(?:para\s+)?esta\s+(?:noche|tarde|ma[ñn]ana)\b/gi);
    return { ...found, consumed };
  }

  // «los lunes y jueves», «cada viernes», «todos los sábados»: semanal, empezando en el próximo de esos días
  m = dateText.match(new RegExp(`\\b(?:(?:todos\\s+)?los|cada)\\s+((?:${WD_SRC})(?:\\s*(?:,|y|e)\\s*(?:los\\s+)?(?:${WD_SRC}))*)\\b`));
  if (m) {
    const days = (m[1].match(new RegExp(WD_SRC, 'g')) || []).map(weekdayIndex).filter((n) => n >= 0);
    if (days.length > 0) {
      let best: Date | undefined;
      for (const idx of days) {
        const d = startOfDay(now);
        d.setDate(d.getDate() + ((idx - d.getDay() + 7) % 7));
        if (!best || d < best) best = d;
      }
      found.date = best;
      found.cycle = 'cycle_week';
      consumed.push(new RegExp(`(?:^|\\s)(?:(?:todos\\s+)?los|cada)\\s+(?:${WD_SRC})(?:\\s*(?:,|y|e)\\s*(?:los\\s+)?(?:${WD_SRC}))*\\b`, 'gi'));
    }
  }
  return { ...found, consumed };
}

/** Quita del título las expresiones de fecha y hora que ya se han convertido en datos. */
function stripDateTimePhrases(title: string, found: { time: boolean; date: boolean; bareTime?: boolean; extra?: RegExp[] }): string {
  let t = title;
  if (found.time) {
    t = t.replace(TIME_PHRASE, ' ').replace(/(?:^|\s)(?:a|al|a la)?\s*(?:mediod[íi]a|medianoche)\b/gi, ' ');
  }
  if (found.bareTime) t = t.replace(BARE_TIME, ' ');
  for (const re of found.extra || []) t = t.replace(re, ' ');
  if (found.date) {
    t = t
      .replace(/(?:^|\s)(?:para|de|del|hasta)?\s*(?:hoy|pasado ma[ñn]ana|ma[ñn]ana|(?:la\s+)?pr[óo]xima semana)\b/gi, ' ')
      .replace(/(?:^|\s)(?:para\s+|de\s+|del\s+|hasta\s+)?(?:el\s+|este\s+)?(?:pr[óo]ximo\s+)?(?:domingo|lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado)\b/gi, ' ');
  }
  t = t.replace(/\s+/g, ' ').trim();
  // Nunca dejar el título vacío (p. ej. si solo se escribió «mañana a las 10»)
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : title;
}

export function parseNaturalLanguage(text: string): ParsedNLPResult {
  if (!text) {
    return { times: [], cleanTitle: '' };
  }

  const times: string[] = [];
  let cleanTitle = text;
  const textLower = text.toLowerCase();
  const now = new Date();

  // 1. Detección de Prioridades (!alta, !urgente, !media, !baja, !!!, !!, !)
  let suggestedPriority: 'none' | 'low' | 'medium' | 'high' | undefined = undefined;
  if (/(!alta|!urgente|!high|!1|!!!)/i.test(text)) {
    suggestedPriority = 'high';
    cleanTitle = cleanTitle.replace(/(!alta|!urgente|!high|!1|!!!)/gi, '').trim();
  } else if (/(!media|!med|!2|!!)/i.test(text)) {
    suggestedPriority = 'medium';
    cleanTitle = cleanTitle.replace(/(!media|!med|!2|!!)/gi, '').trim();
  } else if (/(!baja|!low|!3|!\b)/i.test(text)) {
    suggestedPriority = 'low';
    cleanTitle = cleanTitle.replace(/(!baja|!low|!3)/gi, '').trim();
  }

  // 2. Detección de Listas explícitas (@Lista)
  let suggestedCategory: string | undefined = undefined;
  const listMatch = cleanTitle.match(/@([a-zA-Z0-9_áéíóúñÁÉÍÓÚÑ-]+)/);
  if (listMatch) {
    suggestedCategory = listMatch[1].toLowerCase();
    cleanTitle = cleanTitle.replace(`@${listMatch[1]}`, '').trim();
  }

  // 3. Detección de Ciclos explícitos (#Ciclo y prefijos [D], [S], [M], [A])
  let suggestedCycleId: string | undefined = undefined;
  
  // a) Prefijos al inicio [D], [S], [M], [A]
  const prefixMatch = cleanTitle.match(/^\[([dsmadSMA])\]/i);
  if (prefixMatch) {
    const code = prefixMatch[1].toLowerCase();
    if (code === 'd') suggestedCycleId = 'cycle_day';
    else if (code === 's') suggestedCycleId = 'cycle_week';
    else if (code === 'm') suggestedCycleId = 'cycle_month';
    else if (code === 'a') suggestedCycleId = 'cycle_year';
    cleanTitle = cleanTitle.replace(/^\[[dsmadSMA]\]\s*/i, '').trim();
  }

  // b) Hash de ciclos #diario, #semanal, etc.
  if (!suggestedCycleId) {
    const cycleMatch = cleanTitle.match(/#([a-zA-Z0-9_áéíóúñÁÉÍÓÚÑ-]+)/);
    if (cycleMatch) {
      const rawCycle = cycleMatch[1].toLowerCase();
      if (rawCycle.includes('dia') || rawCycle.includes('diari')) suggestedCycleId = 'cycle_day';
      else if (rawCycle.includes('sem') || rawCycle.includes('week')) suggestedCycleId = 'cycle_week';
      else if (rawCycle.includes('mes') || rawCycle.includes('mensu')) suggestedCycleId = 'cycle_month';
      else if (rawCycle.includes('anual') || rawCycle.includes('ano') || rawCycle.includes('año')) suggestedCycleId = 'cycle_year';
      cleanTitle = cleanTitle.replace(`#${cycleMatch[1]}`, '').trim();
    }
  }

  // 4. Detección de Horas (Alertas)
  // a) "a las 18:30", "a la 1:15", "a las 8 pm", "a las 9 de la noche"
  const timeRegex = /(?:a las?|y a las?|a la)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|de la mañana|de la tarde|de la noche)?/gi;
  let match;

  while ((match = timeRegex.exec(textLower)) !== null) {
    let hour = parseInt(match[1], 10);
    const minutesRaw = match[2] || '00';
    let minutes = parseInt(minutesRaw, 10);
    const modifier = match[3]?.toLowerCase();

    if (isNaN(hour) || hour < 0 || hour > 24) continue;
    if (isNaN(minutes) || minutes < 0 || minutes > 59) minutes = 0;

    if (modifier) {
      if ((modifier.includes('pm') || modifier.includes('tarde') || modifier.includes('noche')) && hour < 12) {
        hour += 12;
      } else if ((modifier.includes('am') || modifier.includes('mañana')) && hour === 12) {
        hour = 0;
      }
    } else {
      if (hour >= 1 && hour <= 6) {
        hour += 12; 
      }
    }

    if (hour === 24) hour = 0;

    const formattedHour = String(hour).padStart(2, '0');
    const formattedMinutes = String(minutes).padStart(2, '0');
    times.push(`${formattedHour}:${formattedMinutes}`);
  }

  // b) "mediodía" / "medianoche"
  if (/\bmediod[íi]a\b/.test(textLower)) {
    times.push('12:00');
  } else if (/\bmedianoche\b/.test(textLower)) {
    times.push('00:00');
  }

  // 5. Detección de Fechas y Ciclos en lenguaje natural
  let suggestedDueDate: Date | undefined;

  // Ciclos implícitos
  // Se quita del título la frase que expresa la frecuencia («todos los días»), no el adjetivo («informe semanal»).
  const consumedByCycle: RegExp[] = [];
  if (!suggestedCycleId) {
    if (/(todos los d[íi]as|diario|cada d[íi]a|diariamente)/.test(textLower)) {
      suggestedCycleId = 'cycle_day';
      consumedByCycle.push(/(?:^|\s)(?:todos los d[íi]as|cada d[íi]a|diariamente)\b/gi);
    } else if (/(cada semana|semanal|todos los (lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bados|domingos))/.test(textLower)) {
      suggestedCycleId = 'cycle_week';
      consumedByCycle.push(/(?:^|\s)(?:cada semana|semanalmente|todas las semanas)\b/gi);
    } else if (/(cada mes|mensual|todos los meses)/.test(textLower)) {
      suggestedCycleId = 'cycle_month';
      consumedByCycle.push(/(?:^|\s)(?:cada mes|mensualmente|todos los meses)\b/gi);
    } else if (/(cada a[ñn]o|anual|todos los a[ñn]os)/.test(textLower)) {
      suggestedCycleId = 'cycle_year';
      consumedByCycle.push(/(?:^|\s)(?:cada a[ñn]o|anualmente|todos los a[ñn]os)\b/gi);
    }
  }

  // Fechas relativas (sin las horas: «a las 9 de la mañana» o «por la mañana» no son «mañana»)
  const dateText = textLower
    .replace(TIME_PHRASE, ' ')
    .replace(/\b(?:por|de|en) la ma[ñn]ana\b/g, ' ');
  if (/\bhoy\b/.test(dateText)) {
    const today = new Date(now);
    suggestedDueDate = today;
  } else if (/\bpasado ma[ñn]ana\b/.test(dateText)) {
    const afterTomorrow = new Date(now);
    afterTomorrow.setDate(afterTomorrow.getDate() + 2);
    suggestedDueDate = afterTomorrow;
  } else if (/\bma[ñn]ana\b/.test(dateText)) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    suggestedDueDate = tomorrow;
  } else if (/\bp[rR][óo]xima semana\b/.test(dateText)) {
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    suggestedDueDate = nextWeek;
  } else {
    // Días de la semana específicos: "el lunes", "el viernes", "este sábado"
    const daysMap: Record<string, number> = {
      'domingo': 0, 'lunes': 1, 'martes': 2, 'miércoles': 3, 'miercoles': 3,
      'jueves': 4, 'viernes': 5, 'sábado': 6, 'sabado': 6
    };
    for (const [dayName, dayIndex] of Object.entries(daysMap)) {
      const regex = new RegExp(`(?:el|este|pr[óo]ximo)\\s+${dayName}`, 'i');
      if (regex.test(dateText)) {
        const target = new Date(now);
        const currentDay = target.getDay();
        let diff = dayIndex - currentDay;
        if (diff <= 0) diff += 7;
        target.setDate(target.getDate() + diff);
        suggestedDueDate = target;
        break;
      }
    }
  }

  // Fechas y frecuencias con frases más largas: «el 15 de octubre», «en 3 días», «los lunes y jueves»…
  const extendedConsumed: RegExp[] = [];
  if (!suggestedDueDate) {
    const ext = readExtendedDate(dateText, now);
    if (ext.date) suggestedDueDate = ext.date;
    if (ext.cycle && !suggestedCycleId) suggestedCycleId = ext.cycle;
    extendedConsumed.push(...ext.consumed);
  }

  // Hora suelta («pasado mañana 9:30») cuando no hay «a las»
  let bareTime = false;
  if (times.length === 0) {
    for (const bm of textLower.matchAll(BARE_TIME)) {
      const h = parseInt(bm[1], 10);
      const mi = parseInt(bm[2], 10);
      if (h <= 23 && mi <= 59) {
        times.push(`${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`);
        bareTime = true;
      }
    }
  }

  // 6. Inferencia temática de Categoría por defecto si no se especificó @Lista
  if (!suggestedCategory) {
    const categoryKeywords: Record<string, string[]> = {
      'limpieza': ['limpiar', 'barrer', 'fregar', 'basura', 'polvo', 'lavadora', 'ropa', 'fregadero', 'platos', 'aspirar', 'aspiradora', 'desinfectar', 'baño', 'cristales', 'sábanas', 'sabanas', 'ordenar'],
      'compras': ['comprar', 'supermercado', 'pan', 'leche', 'huevos', 'verdura', 'carne', 'tienda', 'amazon'],
      'salud': ['médico', 'medico', 'dentista', 'cita', 'pastillas', 'farmacia', 'entrenar', 'gym', 'ejercicio'],
      'trabajo': ['reunión', 'reunion', 'informe', 'email', 'cliente', 'proyecto', 'presentación', 'zoom', 'call']
    };

    for (const [cat, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(kw => textLower.includes(kw))) {
        suggestedCategory = cat;
        break; 
      }
    }
  }

  // 6b. La fecha y la hora detectadas salen del título, como en Recordatorios de Apple:
  //     «Reunión mañana a las 10:00» → «Reunión» (y así el precio queda al final).
  cleanTitle = stripDateTimePhrases(cleanTitle, {
    time: times.length > 0 && !bareTime,
    bareTime,
    date: Boolean(suggestedDueDate),
    extra: [...extendedConsumed, ...consumedByCycle],
  });

  // 7. Detección de Precio/Coste (100 e, 100€, 15.50 euros, etc.)
  let suggestedPrice: number | undefined = undefined;
  const priceExtracted = extractPrice(cleanTitle, false);
  if (priceExtracted && priceExtracted.price > 0) {
    suggestedPrice = priceExtracted.price;
    cleanTitle = priceExtracted.cleanText || cleanTitle;
  }

  return {
    times: [...new Set(times)],
    suggestedCategory,
    suggestedCycleId,
    suggestedDueDate,
    suggestedPriority,
    suggestedPrice,
    cleanTitle: cleanTitle.replace(/\s+/g, ' ').trim()
  };
}
