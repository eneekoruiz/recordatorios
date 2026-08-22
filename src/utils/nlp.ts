export interface ParsedNLPResult {
  times: string[];
  suggestedCategory?: string;
  suggestedCycleId?: string;
  suggestedDueDate?: Date;
  suggestedPriority?: 'none' | 'low' | 'medium' | 'high';
  cleanTitle: string;
}

/**
 * Motor de lenguaje natural avanzado para Recordatorios Élite.
 * Extrae fechas, horas, ciclos, prioridades y listas en español.
 */
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

  // 3. Detección de Ciclos explícitos (#Ciclo)
  let suggestedCycleId: string | undefined = undefined;
  const cycleMatch = cleanTitle.match(/#([a-zA-Z0-9_áéíóúñÁÉÍÓÚÑ-]+)/);
  if (cycleMatch) {
    const rawCycle = cycleMatch[1].toLowerCase();
    if (rawCycle.includes('dia') || rawCycle.includes('diari')) suggestedCycleId = 'cycle_day';
    else if (rawCycle.includes('sem') || rawCycle.includes('week')) suggestedCycleId = 'cycle_week';
    else if (rawCycle.includes('mes') || rawCycle.includes('mensu')) suggestedCycleId = 'cycle_month';
    else if (rawCycle.includes('anual') || rawCycle.includes('ano') || rawCycle.includes('año')) suggestedCycleId = 'cycle_year';
    cleanTitle = cleanTitle.replace(`#${cycleMatch[1]}`, '').trim();
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
  if (!suggestedCycleId) {
    if (/(todos los d[íi]as|diario|cada d[íi]a|diariamente)/.test(textLower)) {
      suggestedCycleId = 'cycle_day';
    } else if (/(cada semana|semanal|todos los (lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bados|domingos))/.test(textLower)) {
      suggestedCycleId = 'cycle_week';
    } else if (/(cada mes|mensual|todos los meses)/.test(textLower)) {
      suggestedCycleId = 'cycle_month';
    } else if (/(cada a[ñn]o|anual|todos los a[ñn]os)/.test(textLower)) {
      suggestedCycleId = 'cycle_year';
    }
  }

  // Fechas relativas
  if (/\bhoy\b/.test(textLower)) {
    const today = new Date(now);
    suggestedDueDate = today;
  } else if (/\bpasado ma[ñn]ana\b/.test(textLower)) {
    const afterTomorrow = new Date(now);
    afterTomorrow.setDate(afterTomorrow.getDate() + 2);
    suggestedDueDate = afterTomorrow;
  } else if (/\bma[ñn]ana\b/.test(textLower)) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    suggestedDueDate = tomorrow;
  } else if (/\bp[rR][óo]xima semana\b/.test(textLower)) {
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
      if (regex.test(textLower)) {
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

  // 6. Inferencia temática de Categoría por defecto si no se especificó @Lista
  if (!suggestedCategory) {
    const categoryKeywords: Record<string, string[]> = {
      'limpieza': ['limpiar', 'barrer', 'fregar', 'basura', 'polvo', 'lavadora', 'ropa', 'fregadero', 'platos'],
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

  return {
    times: [...new Set(times)],
    suggestedCategory,
    suggestedCycleId,
    suggestedDueDate,
    suggestedPriority,
    cleanTitle: cleanTitle.replace(/\s+/g, ' ').trim()
  };
}
