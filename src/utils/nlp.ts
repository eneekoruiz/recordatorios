// Utilidad para extraer horas y auto-categorizar tareas en lenguaje natural
export function parseNaturalLanguage(text: string) {
  const times: string[] = [];
  const textLower = text.toLowerCase();
  
  // 1. Detección de Horas (Alertas)
  const timeRegex = /(?:a las|y a las|a la) (\d{1,2})(?::(\d{2}))?\s*(am|pm|de la mañana|de la tarde|de la noche)?/g;
  let match;

  while ((match = timeRegex.exec(textLower)) !== null) {
    let hour = parseInt(match[1], 10);
    const minutesRaw = match[2] || '00';
    let minutes = parseInt(minutesRaw, 10);
    const modifier = match[3];

    // EDGE CASE HANDLING: Evitar fechas inválidas
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

  // 2. Detección de Fechas y Ciclos
  let suggestedDueDate: Date | undefined;
  let suggestedCycleId: string | undefined;

  // Ciclos
  if (/(todos los d[íi]as|diario|cada d[íi]a|diariamente)/.test(textLower)) {
    suggestedCycleId = 'cycle_day';
  } else if (/(cada semana|semanal|todos los (lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bados|domingos))/.test(textLower)) {
    suggestedCycleId = 'cycle_week';
  } else if (/(cada mes|mensual|todos los meses)/.test(textLower)) {
    suggestedCycleId = 'cycle_month';
  } else if (/(cada a[ñn]o|anual|todos los a[ñn]os)/.test(textLower)) {
    suggestedCycleId = 'cycle_year';
  }

  // Fechas (One-off)
  const now = new Date();
  if (/\bma[ñn]ana\b/.test(textLower)) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    suggestedDueDate = tomorrow;
  } else if (/\bp[rR][óo]xima semana\b/.test(textLower)) {
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    suggestedDueDate = nextWeek;
  }

  // 3. Motor de Inferencia de Categorías (Auto-Categorization)
  const categoryKeywords: Record<string, string[]> = {
    'limpieza': ['limpiar', 'barrer', 'fregar', 'basura', 'polvo', 'lavadora', 'ropa'],
    'compra': ['comprar', 'supermercado', 'pan', 'leche', 'huevos', 'verdura', 'carne'],
    'skincare': ['crema', 'rutina', 'lavar cara', 'serum', 'exfoliar', 'hidratar', 'pastillas']
  };

  let inferredCategory = null;
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(kw => textLower.includes(kw))) {
      inferredCategory = category;
      break; 
    }
  }

  return {
    times: [...new Set(times)],
    suggestedCategory: inferredCategory,
    suggestedCycleId,
    suggestedDueDate
  };
}
