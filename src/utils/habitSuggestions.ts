export interface HabitSuggestion {
  targetCount: number;
  cycleId: 'cycle_day' | 'cycle_week';
  periodName: 'día' | 'semana';
  cleanTitle: string;
  matchedPhrase: string;
}

const NUMBER_WORDS: Record<string, number> = {
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12
};

function parseCountWord(val: string): number | null {
  if (!val) return null;
  const num = parseInt(val, 10);
  if (!isNaN(num) && num > 0) return num;
  const word = val.toLowerCase().trim();
  if (NUMBER_WORDS[word]) return NUMBER_WORDS[word];
  return null;
}

/**
 * Analiza el título de una tarea buscando patrones de repeticiones en lenguaje natural
 * (ej. "3 veces al día", "4 veces al día", "10 veces al día", "dos veces por semana", "8 vasos al día")
 * para ofrecer una sugerencia inteligente de conversión a hábito con contador interactivo (targetCount >= 2).
 */
export function detectHabitSuggestion(title?: string | null): HabitSuggestion | null {
  if (!title || typeof title !== 'string') return null;
  const trimmed = title.trim();
  if (!trimmed) return null;

  // 1. Patrón Diario: "X veces al día", "X veces por día", "X veces cada día", "X vasos al día", "X tazas al día"
  const dailyRegex = /(?:^|\s)(?:(\d+|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(?:veces|vasos|tazas|repeticiones))\s+(?:al|por|cada)\s+d[íi]a\b/i;
  const dailyMatch = trimmed.match(dailyRegex);

  if (dailyMatch) {
    const rawCount = dailyMatch[1];
    const count = rawCount ? parseCountWord(rawCount) : null;
    if (count && count >= 2) {
      const matchedPhrase = dailyMatch[0].trim();
      let clean = trimmed.replace(dailyRegex, ' ').replace(/\s+/g, ' ').trim();
      clean = clean.replace(/[:\-–—\s]+$/, '').trim();
      if (!clean) clean = trimmed;
      return {
        targetCount: count,
        cycleId: 'cycle_day',
        periodName: 'día',
        cleanTitle: clean.charAt(0).toUpperCase() + clean.slice(1),
        matchedPhrase
      };
    }
  }

  // 2. Patrón Semanal: "X veces a la semana", "X veces por semana"
  const weeklyRegex = /(?:^|\s)(?:(\d+|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(?:veces|d[íi]as|sesiones))\s+(?:a\s+la|por|cada)\s+semana\b/i;
  const weeklyMatch = trimmed.match(weeklyRegex);

  if (weeklyMatch) {
    const rawCount = weeklyMatch[1];
    const count = rawCount ? parseCountWord(rawCount) : null;
    if (count && count >= 2) {
      const matchedPhrase = weeklyMatch[0].trim();
      let clean = trimmed.replace(weeklyRegex, ' ').replace(/\s+/g, ' ').trim();
      clean = clean.replace(/[:\-–—\s]+$/, '').trim();
      if (!clean) clean = trimmed;
      return {
        targetCount: count,
        cycleId: 'cycle_week',
        periodName: 'semana',
        cleanTitle: clean.charAt(0).toUpperCase() + clean.slice(1),
        matchedPhrase
      };
    }
  }

  return null;
}
