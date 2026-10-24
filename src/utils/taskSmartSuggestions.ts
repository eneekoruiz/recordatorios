import { detectHabitSuggestion } from './habitSuggestions';
import type { TaskItem } from '../models/Task';

export type TaskSuggestionType =
  | 'habit'
  | 'cycle'
  | 'duration'
  | 'price'
  | 'people'
  | 'location';

export interface TaskSmartSuggestion {
  type: TaskSuggestionType;
  prompt: string;
  actionLabel: string;
  cleanTitle: string;
  matchedPhrase: string;
  patch: Partial<TaskItem>;
}

export interface TaskContextInput {
  title?: string | null;
  targetCount?: number | null;
  cycle_id?: string | null;
  duration?: number | '' | null;
  price?: number | null;
  people?: string[] | null;
  locationName?: string | null;
}

function cleanString(title: string, matched: string): string {
  let res = title.replace(matched, ' ').replace(/\s+/g, ' ').trim();
  res = res.replace(/[:\-–—\s]+$/, '').trim();
  res = res.replace(/^[–—\-:\s]+/, '').trim();
  if (!res) return title;
  return res.charAt(0).toUpperCase() + res.slice(1);
}

interface CycleRule {
  cycleId: 'cycle_day' | 'cycle_week' | 'cycle_month' | 'cycle_year';
  periodLabel: string;
  regex: RegExp;
}

const CYCLE_RULES: CycleRule[] = [
  // Diario
  {
    cycleId: 'cycle_day',
    periodLabel: 'diariamente',
    regex: /(?:^|\s)(?:(?:y\s+)?que\s+se\s+repita\s+todos?\s+los?\s+d[íi]as|(?:y\s+)?que\s+se\s+repita\s+cada\s+d[íi]a|(?:y\s+)?que\s+se\s+repita\s+a\s+diario|repetir\s+(?:todos?\s+los?\s+d[íi]as|cada\s+d[íi]a|a\s+diario|diariamente)|todos\s+los\s+d[íi]as|cada\s+d[íi]a|a\s+diario|diariamente|cada\s+ma[ñn]ana|cada\s+tarde|cada\s+noche)\b/i
  },
  // Semanal
  {
    cycleId: 'cycle_week',
    periodLabel: 'semanalmente',
    regex: /(?:^|\s)(?:(?:y\s+)?que\s+se\s+repita\s+todas?\s+las?\s+semanas|(?:y\s+)?que\s+se\s+repita\s+cada\s+semana|(?:y\s+)?que\s+se\s+repita\s+semanalmente|repetir\s+(?:todas?\s+las?\s+semanas|cada\s+semana|semanalmente)|todas\s+las\s+semanas|cada\s+semana|semanalmente|todos\s+los\s+(?:lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bados|domingos))\b/i
  },
  // Mensual
  {
    cycleId: 'cycle_month',
    periodLabel: 'mensualmente',
    regex: /(?:^|\s)(?:(?:y\s+)?que\s+se\s+repita\s+todos?\s+los?\s+meses|(?:y\s+)?que\s+se\s+repita\s+cada\s+mes|(?:y\s+)?que\s+se\s+repita\s+mensualmente|repetir\s+(?:todos?\s+los?\s+meses|cada\s+mes|mensualmente)|todos\s+los\s+meses|cada\s+mes|mensualmente)\b/i
  },
  // Anual
  {
    cycleId: 'cycle_year',
    periodLabel: 'anualmente',
    regex: /(?:^|\s)(?:(?:y\s+)?que\s+se\s+repita\s+todos?\s+los?\s+a[ñn]os|(?:y\s+)?que\s+se\s+repita\s+cada\s+a[ñn]o|(?:y\s+)?que\s+se\s+repita\s+anualmente|repetir\s+(?:todos?\s+los?\s+a[ñn]os|cada\s+a[ñn]o|anualmente)|todos\s+los\s+a[ñn]os|cada\s+a[ñn]o|anualmente)\b/i
  }
];

function detectDurationSuggestion(title: string): { minutes: number; cleanTitle: string; matchedPhrase: string } | null {
  // a) "media hora" -> 30 min
  const halfHourMatch = title.match(/(?:^|\s)(?:durante\s+|tarda(?:r)?\s+)?media\s+hora\b/i);
  if (halfHourMatch) {
    const clean = cleanString(title, halfHourMatch[0]);
    return { minutes: 30, cleanTitle: clean, matchedPhrase: halfHourMatch[0].trim() };
  }

  // b) "1 hora y media" -> 90 min
  const hourAndHalfMatch = title.match(/(?:^|\s)(?:durante\s+|tarda(?:r)?\s+)?(?:1|una)\s+hora\s+y\s+media\b/i);
  if (hourAndHalfMatch) {
    const clean = cleanString(title, hourAndHalfMatch[0]);
    return { minutes: 90, cleanTitle: clean, matchedPhrase: hourAndHalfMatch[0].trim() };
  }

  // c) "X horas y Y minutos" o "X horas"
  const hoursMinsMatch = title.match(/(?:^|\s)(?:durante\s+|tarda(?:r)?\s+)?(\d+)\s*(?:horas?|h)\s*(?:y\s*)?(\d+)?\s*(?:minutos?|mins?|m)?\b/i);
  if (hoursMinsMatch) {
    const hours = parseInt(hoursMinsMatch[1], 10);
    const mins = hoursMinsMatch[2] ? parseInt(hoursMinsMatch[2], 10) : 0;
    if (hours > 0 || mins > 0) {
      const total = hours * 60 + mins;
      const clean = cleanString(title, hoursMinsMatch[0]);
      return { minutes: total, cleanTitle: clean, matchedPhrase: hoursMinsMatch[0].trim() };
    }
  }

  // d) "durante X minutos", "duración X min", "tarda X min", "X minutos", "X min"
  const minsMatch = title.match(/(?:^|\s)(?:(?:durante|duraci[óo]n|tarda(?:r)?|unos?|en|tiempo:?)\s+)?(\d+)\s*(?:minutos?|mins?|m)\b/i);
  if (minsMatch) {
    const mins = parseInt(minsMatch[1], 10);
    if (mins > 0 && mins <= 480) {
      const clean = cleanString(title, minsMatch[0]);
      return { minutes: mins, cleanTitle: clean, matchedPhrase: minsMatch[0].trim() };
    }
  }

  return null;
}

function detectPriceSuggestion(title: string): { price: number; cleanTitle: string; matchedPhrase: string } | null {
  const priceMatch = title.match(/(?:^|\s)(?:por|coste:?|precio:?)\s*(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?\b)/i) ||
                     title.match(/(?:^|\s)(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?\b)/i);
  if (priceMatch) {
    const num = parseFloat(priceMatch[1].replace(',', '.'));
    if (!isNaN(num) && num > 0) {
      const clean = cleanString(title, priceMatch[0]);
      return { price: num, cleanTitle: clean, matchedPhrase: priceMatch[0].trim() };
    }
  }
  return null;
}

const NON_PERSON_WORDS = new Set([
  'cuidado', 'tiempo', 'prisa', 'calma', 'leche', 'jabon', 'jabón', 'agua',
  'detergente', 'alcohol', 'lejia', 'lejía', 'esponja', 'bayeta', 'trapo',
  'frecuencia', 'atencion', 'atención', 'seguridad', 'paciencia', 'gusto',
  'amor', 'cariño', 'exito', 'éxito', 'facilidad', 'dificultad', 'miedo',
  'detalle', 'motivo', 'razon', 'razón', 'fuerza', 'ganas', 'musica', 'música',
  'bici', 'coche', 'moto', 'tren', 'avion', 'avión', 'autobus', 'autobús'
]);

function detectPeopleSuggestion(title: string): { person: string; cleanTitle: string; matchedPhrase: string } | null {
  const match = title.match(/(?:^|\s)(?:con|junto\s+a)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)\b/);
  if (match) {
    const word = match[1];
    if (!NON_PERSON_WORDS.has(word.toLowerCase()) && word.length >= 3) {
      const clean = cleanString(title, match[0]);
      return { person: word, cleanTitle: clean, matchedPhrase: match[0].trim() };
    }
  }
  return null;
}

const COMMON_LOCATIONS: Record<string, string> = {
  mercadona: 'Mercadona',
  carrefour: 'Carrefour',
  lidl: 'Lidl',
  supermercado: 'Supermercado',
  farmacia: 'Farmacia',
  gimnasio: 'Gimnasio',
  gym: 'Gimnasio',
  casa: 'Casa',
  trabajo: 'Trabajo',
  oficina: 'Oficina',
  banco: 'Banco',
  taller: 'Taller',
  ferreteria: 'Ferretería',
  ferretería: 'Ferretería'
};

function detectLocationSuggestion(title: string): { locationName: string; cleanTitle: string; matchedPhrase: string } | null {
  const match = title.match(/(?:^|\s)(?:en\s+(?:el\s+|la\s+)?)(mercadona|carrefour|lidl|supermercado|farmacia|gimnasio|gym|casa|trabajo|oficina|banco|taller|ferreter[íi]a)\b/i);
  if (match) {
    const raw = match[1].toLowerCase();
    const loc = COMMON_LOCATIONS[raw] || match[1];
    const clean = cleanString(title, match[0]);
    return { locationName: loc, cleanTitle: clean, matchedPhrase: match[0].trim() };
  }
  return null;
}

/**
 * Analiza una tarea y su contexto para sugerir de forma interactiva y no invasiva
 * la activación de funcionalidades avanzadas expresadas en lenguaje natural:
 * - Hábitos con contador ("3 veces al día")
 * - Ciclos de frecuencia ("y que se repita todas las semanas", "todos los días")
 * - Duración estimada ("durante 15 minutos", "tarda 30 min")
 * - Ubicación ("en Mercadona")
 * - Personas ("con Marta")
 * - Precio ("por 25€")
 */
export function detectTaskSmartSuggestion(task: TaskContextInput): TaskSmartSuggestion | null {
  if (!task.title || typeof task.title !== 'string') return null;
  const title = task.title.trim();
  if (!title) return null;

  // 1. Hábitos con contador ("3 veces al día", "4 veces al día", "10 veces al día")
  if (!task.targetCount || task.targetCount <= 1) {
    const habit = detectHabitSuggestion(title);
    if (habit) {
      return {
        type: 'habit',
        prompt: `¿Convertir en hábito de ${habit.targetCount} veces al ${habit.periodName}?`,
        actionLabel: 'Convertir',
        cleanTitle: habit.cleanTitle,
        matchedPhrase: habit.matchedPhrase,
        patch: {
          title: habit.cleanTitle,
          targetCount: habit.targetCount,
          cycle_id: habit.cycleId,
          currentCount: 0
        }
      };
    }
  }

  // 2. Frecuencias / Ciclos ("y que se repita todas las semanas", "todos los días", etc.)
  if (!task.cycle_id) {
    for (const rule of CYCLE_RULES) {
      const match = title.match(rule.regex);
      if (match) {
        const clean = cleanString(title, match[0]);
        return {
          type: 'cycle',
          prompt: `¿Repetir ${rule.periodLabel}?`,
          actionLabel: 'Convertir',
          cleanTitle: clean,
          matchedPhrase: match[0].trim(),
          patch: {
            title: clean,
            cycle_id: rule.cycleId
          }
        };
      }
    }
  }

  // 3. Duración estimada ("durante 15 minutos", "tarda 30 min", "1 hora", etc.)
  const hasDuration = typeof task.duration === 'number' && task.duration > 0;
  if (!hasDuration) {
    const dur = detectDurationSuggestion(title);
    if (dur) {
      return {
        type: 'duration',
        prompt: `¿Fijar duración en ${dur.minutes} min?`,
        actionLabel: 'Fijar',
        cleanTitle: dur.cleanTitle,
        matchedPhrase: dur.matchedPhrase,
        patch: {
          title: dur.cleanTitle,
          duration: dur.minutes
        }
      };
    }
  }

  // 4. Ubicación ("en Mercadona", "en el supermercado", "en casa")
  if (!task.locationName) {
    const loc = detectLocationSuggestion(title);
    if (loc) {
      return {
        type: 'location',
        prompt: `¿Añadir ubicación "${loc.locationName}"?`,
        actionLabel: 'Añadir',
        cleanTitle: loc.cleanTitle,
        matchedPhrase: loc.matchedPhrase,
        patch: {
          title: loc.cleanTitle,
          locationName: loc.locationName
        }
      };
    }
  }

  // 5. Personas involucradas ("con Marta", "con Carlos")
  if (!task.people || task.people.length === 0) {
    const person = detectPeopleSuggestion(title);
    if (person) {
      return {
        type: 'people',
        prompt: `¿Asignar a ${person.person}?`,
        actionLabel: 'Asignar',
        cleanTitle: person.cleanTitle,
        matchedPhrase: person.matchedPhrase,
        patch: {
          title: person.cleanTitle,
          people: [person.person]
        }
      };
    }
  }

  // 6. Precio / Coste ("por 25€", "coste 30 euros")
  if (task.price === undefined || task.price === null || task.price <= 0) {
    const pr = detectPriceSuggestion(title);
    if (pr) {
      return {
        type: 'price',
        prompt: `¿Añadir precio de ${pr.price}€?`,
        actionLabel: 'Añadir',
        cleanTitle: pr.cleanTitle,
        matchedPhrase: pr.matchedPhrase,
        patch: {
          title: pr.cleanTitle,
          price: pr.price
        }
      };
    }
  }

  return null;
}
