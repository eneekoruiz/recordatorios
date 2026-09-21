export interface NlpResult {
  dueDate?: string;
  hasTime?: boolean;
}

const dayNames: Record<string, number> = {
  lunes: 1,
  martes: 2,
  miércoles: 3,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sábado: 6,
  sabado: 6,
  domingo: 0
};

export function parseNaturalLanguage(text: string): NlpResult {
  const result: NlpResult = {};
  const lowerText = text.toLowerCase();
  
  const now = new Date();
  let targetDate = new Date(now);
  let dateSet = false;

  // 1. Detect day keywords
  if (lowerText.includes('hoy')) {
    dateSet = true;
  } else if (lowerText.includes('pasado mañana')) {
    // Debe comprobarse antes que 'mañana': "pasado mañana" contiene la palabra
    // "mañana" como subcadena, así que si el orden fuera al revés esta rama
    // jamás se alcanzaría y "pasado mañana" se interpretaría como "mañana".
    targetDate.setDate(now.getDate() + 2);
    dateSet = true;
  } else if (lowerText.includes('mañana')) {
    targetDate.setDate(now.getDate() + 1);
    dateSet = true;
  } else {
    // Check for "el lunes", "el martes", "este viernes", etc.
    const dayRegex = /(?:el|este|para el) (lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)/i;
    const dayMatch = lowerText.match(dayRegex);
    if (dayMatch) {
      const dayWord = dayMatch[1].toLowerCase();
      const targetDayOfWeek = dayNames[dayWord];
      if (targetDayOfWeek !== undefined) {
        const currentDay = now.getDay();
        let daysAhead = targetDayOfWeek - currentDay;
        if (daysAhead <= 0) daysAhead += 7; // Next occurrence
        targetDate.setDate(now.getDate() + daysAhead);
        dateSet = true;
      }
    }
  }

  // 2. Detect time keywords ("a las 18:00", "a las 5", "a las 14", "a las 17.30")
  const timeRegex = /(?:a las|a la|sobre las) (\d{1,2})(?:[:.](\d{2}))?(?:\s*(am|pm|de la mañana|de la tarde|de la noche))?/i;
  const timeMatch = lowerText.match(timeRegex);
  
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const modifier = timeMatch[3];

    if (modifier) {
      if ((modifier.includes('pm') || modifier.includes('tarde') || modifier.includes('noche')) && hours < 12) {
        hours += 12;
      } else if ((modifier.includes('am') || modifier.includes('mañana')) && hours === 12) {
        hours = 0;
      }
    }

    targetDate.setHours(hours, minutes, 0, 0);
    result.hasTime = true;
    dateSet = true;
  } else if (dateSet) {
    // If date is set but no time, default to 09:00
    targetDate.setHours(9, 0, 0, 0);
  }

  if (dateSet) {
    result.dueDate = targetDate.toISOString();
  }

  return result;
}
