import type { CustomList, TaskItem } from '../models/Task';
import { extractPrice } from '../utils/priceExtractor';

export interface ProposedTask {
  id: string;
  title: string;
  description?: string;
  listName?: string;
  listId?: string;
  dueDate?: string;
  timeOfDay?: 'morning' | 'afternoon' | 'night';
  price?: number;
  quantity?: number;
  priority?: 'none' | 'low' | 'medium' | 'high';
  cycle?: 'cycle_day' | 'cycle_week' | 'cycle_month' | 'cycle_year';
  people?: string[];
  vibe?: string;
  locationName?: string;
  selected: boolean;
}

export interface ProposedBatch {
  reply: string;
  tasks: ProposedTask[];
  suggestedList?: {
    name: string;
    color?: string;
    icon?: string;
  };
}

export interface AIConfig {
  provider: 'auto' | 'gemini' | 'openai' | 'mcp';
  apiKey?: string;
  mcpServerUrl?: string;
}

export class AIService {
  public static getConfig(): AIConfig {
    try {
      const saved = localStorage.getItem('ai_assistant_config');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { provider: 'auto' };
  }

  public static saveConfig(config: AIConfig) {
    localStorage.setItem('ai_assistant_config', JSON.stringify(config));
  }

  /**
   * Main entry point: Processes conversation and returns conversational response + proposed tasks
   */
  public static async processPrompt(
    userMessage: string,
    existingLists: CustomList[],
    conversationHistory: { role: 'user' | 'assistant'; text: string }[] = []
  ): Promise<ProposedBatch> {
    const config = this.getConfig();

    // 1. External LLM via Gemini API if key is present
    if (config.provider === 'gemini' && config.apiKey) {
      try {
        return await this.callGemini(userMessage, existingLists, conversationHistory, config.apiKey);
      } catch (err) {
        console.warn('Gemini API call failed, falling back to local extractor:', err);
      }
    }

    // 2. External LLM via OpenAI API if key is present
    if (config.provider === 'openai' && config.apiKey) {
      try {
        return await this.callOpenAI(userMessage, existingLists, conversationHistory, config.apiKey);
      } catch (err) {
        console.warn('OpenAI API call failed, falling back to local extractor:', err);
      }
    }

    // 3. Fallback: Intelligent Local Semantic Extractor (Zero-Config)
    return this.localSemanticExtract(userMessage, existingLists);
  }

  /**
   * Local Semantic Extractor (Zero-Config, runs 100% locally and offline)
   */
  /**
   * Local Semantic Extractor (Zero-Config, runs 100% locally and offline)
   */
  public static localSemanticExtract(text: string, existingLists: CustomList[]): ProposedBatch {
    const trimmed = text.trim();
    if (!trimmed) {
      return {
        reply: 'Hola, ¿en qué puedo ayudarte hoy? Puedes contarme cómo ha ido tu día, pedirme que organice tus recordatorios o planificar la semana.',
        tasks: []
      };
    }

    // Check if the user is narrating their day or sharing personal experiences
    const isNarrative = /\b(buah|hoy\s+(he\s+hecho|hice|estuve|fui|quedé|pasé)|ayer\s+(estuve|fui|quedé|hice)|esta\s+mañana|esta\s+tarde|este\s+finde|el\s+finde)\b/i.test(trimmed);

    // Detect if user wants to create a specific list
    let suggestedList: ProposedBatch['suggestedList'] | undefined;
    const listMatch = trimmed.match(/(?:crea(?:r)?\s+(?:la\s+)?lista\s+["']?([^"'\n,]+)["']?|para\s+(?:el\s+|la\s+)?(viaje\s+a\s+\w+|mudanza|reforma|boda|cumpleaños))/i);
    if (listMatch) {
      const name = (listMatch[1] || listMatch[2] || '').trim();
      if (name && !existingLists.some(l => l.name.toLowerCase() === name.toLowerCase())) {
        suggestedList = {
          name: name.charAt(0).toUpperCase() + name.slice(1),
          color: '#007aff',
          icon: 'list'
        };
      }
    }

    // Split into individual task candidates:
    let rawSegments: string[] = [];
    if (trimmed.includes('\n')) {
      rawSegments = trimmed.split('\n');
    } else {
      // Split by bullet points or sequences
      rawSegments = trimmed.split(/(?:;\s*|\.\s+(?=[A-Z0-9¿¡])|\s+-\s+|\s*\n\s*)/);
    }

    // If only one segment and it contains multiple actions joined by " y también ", " y luego ", " y ", commas
    if (rawSegments.length === 1 && (trimmed.includes(',') || /\s+y\s+(?:también\s+|luego\s+)?/i.test(trimmed))) {
      const parts = trimmed.split(/(?:,\s*(?:y\s+)?|\s+y\s+(?:también\s+|luego\s+)?)/i);
      if (parts.length > 1) {
        rawSegments = parts;
      }
    }

    const tasks: ProposedTask[] = [];

    // Global people mentioned in prompt
    const globalMentionedPeople: string[] = [];
    const atMatches = trimmed.match(/@([a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9_]+)/g);
    if (atMatches) {
      atMatches.forEach(m => globalMentionedPeople.push(m.slice(1)));
    }
    const withMatches = trimmed.matchAll(/(?:con|junto\s+a)\s+([A-ZÁÉÍÓÚ][a-záéíóúñ]+)/g);
    for (const match of withMatches) {
      if (match[1] && !/^(el|la|los|las|mi|mis|un|una|mucho|toda|todo)$/i.test(match[1])) {
        globalMentionedPeople.push(match[1]);
      }
    }

    for (let segment of rawSegments) {
      segment = segment.trim().replace(/^[-*•\d.)]+\s*/, '');
      if (!segment || segment.length < 3) continue;

      // Ignore greeting-only or filler-only segments
      if (/^(hola|buenas|por favor|organízame|ayúdame|apúntame|quiero que|gracias|buah|pues)\.?$/i.test(segment)) {
        continue;
      }

      // Extract people in this specific segment
      const segmentPeople: string[] = [];
      const segAtMatches = segment.match(/@([a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9_]+)/g);
      if (segAtMatches) {
        segAtMatches.forEach(m => segmentPeople.push(m.slice(1)));
      }
      const segWithMatches = segment.matchAll(/(?:con|junto\s+a)\s+([A-ZÁÉÍÓÚ][a-záéíóúñ]+)/g);
      for (const match of segWithMatches) {
        if (match[1] && !/^(el|la|los|las|mi|mis|un|una|mucho|toda|todo)$/i.test(match[1])) {
          segmentPeople.push(match[1]);
        }
      }
      // If segment didn't match local people but prompt has them, associate if narrative
      const finalPeople = Array.from(new Set([...segmentPeople, ...(isNarrative ? globalMentionedPeople : [])]));

      // Extract price
      let price: number | undefined;
      const priceMatch = extractPrice(segment, false);
      if (priceMatch && priceMatch.price > 0) {
        price = priceMatch.price;
        segment = priceMatch.cleanText || segment;
      }

      // Extract time
      let timeString: string | undefined;
      let timeOfDay: 'morning' | 'afternoon' | 'night' | undefined;
      const timeMatch = segment.match(/(?:a\s+las?|a\s+la)\s+([0-1]?[0-9]|2[0-3])(?::([0-5][0-9]))?\s*(am|pm|h)?/i);
      if (timeMatch) {
        let hour = parseInt(timeMatch[1], 10);
        const min = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
        const meridian = timeMatch[3]?.toLowerCase();
        if (meridian === 'pm' && hour < 12) hour += 12;
        if (meridian === 'am' && hour === 12) hour = 0;
        timeString = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        segment = segment.replace(timeMatch[0], '').trim();

        if (hour >= 6 && hour < 14) timeOfDay = 'morning';
        else if (hour >= 14 && hour < 20) timeOfDay = 'afternoon';
        else timeOfDay = 'night';
      }

      // Extract date
      let dueDate: Date | undefined;
      const now = new Date();
      if (/\bayer\b/i.test(segment) || /\bayer\b/i.test(trimmed)) {
        dueDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        segment = segment.replace(/\bayer\b/i, '').trim();
      } else if (/\bhoy\b/i.test(segment) || isNarrative) {
        dueDate = new Date();
        segment = segment.replace(/\bhoy\b/i, '').trim();
      } else if (/\bpasado\s+mañana\b/i.test(segment)) {
        dueDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
        segment = segment.replace(/\bpasado\s+mañana\b/i, '').trim();
      } else if (/\bmañana\b/i.test(segment) && !/\bpor\s+la\s+mañana\b/i.test(segment)) {
        dueDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        segment = segment.replace(/\bmañana\b/i, '').trim();
      } else if (/\b(este\s+)?fin\s+de\s+semana\b/i.test(segment)) {
        const day = now.getDay();
        const diff = day === 6 ? 7 : (6 - day);
        dueDate = new Date(now.getTime() + diff * 24 * 60 * 60 * 1000);
        segment = segment.replace(/\b(este\s+)?fin\s+de\s+semana\b/i, '').trim();
      }

      // Time of day keywords if not set
      if (!timeOfDay) {
        if (/\b(mañana|desayun|despertar|aseo)\b/i.test(segment)) timeOfDay = 'morning';
        else if (/\b(tarde|almuerz|comida|meriend)\b/i.test(segment)) timeOfDay = 'afternoon';
        else if (/\b(noche|cena|dormir|acostar)\b/i.test(segment)) timeOfDay = 'night';
      }

      // Detect Vibe
      let vibe: string | undefined;
      if (/\b(escalar|montaña|cima|senderism|aventur|viaje|vuelo|excursión|ruta)\b/i.test(segment)) {
        vibe = '🏔️ Aventura';
      } else if (/\b(fiesta|cumpleaños|celebr|bar|cerveza|copas|concierto|festival)\b/i.test(segment)) {
        vibe = '🎉 Celebración';
      } else if (/\b(estudi|biblioteca|reunión|examen|trabajo|proyecto|oficina|logro)\b/i.test(segment)) {
        vibe = '💼 Logro';
      } else if (/\b(gimnasio|entren|gym|correr|natación|deporte|pesas|pádel|futbol)\b/i.test(segment)) {
        vibe = '💪 Deporte';
      } else if (/\b(cena|cine|película|café|paseo|tranqui|relax|comida|descans)\b/i.test(segment)) {
        vibe = '🍕 Relax';
      } else if (isNarrative || finalPeople.length > 0) {
        vibe = '✨ Especial';
      }

      // Extract location (e.g. "en Donosti", "en Bilbao", "en Madrid", "en Roma")
      let locationName: string | undefined;
      const locMatch = segment.match(/(?:\ben\s+|\bpor\s+)([A-ZÁÉÍÓÚ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚ][a-záéíóúñ]+)?)/);
      if (locMatch && !/^(la|el|los|las|mi|mis|su|sus|un|una|este|esta|casa|persona|vez|plan|coche|bici)$/i.test(locMatch[1])) {
        locationName = locMatch[1].trim();
      }

      // Extract priority
      let priority: 'none' | 'low' | 'medium' | 'high' = 'none';
      if (/\b(urgente|importante|ya|prioridad\s+alta)\b/i.test(segment) || segment.includes('!!!')) {
        priority = 'high';
        segment = segment.replace(/!{3,}/g, '').trim();
      } else if (/\b(prioridad\s+media)\b/i.test(segment) || segment.includes('!!')) {
        priority = 'medium';
      }

      // Extract cycle
      let cycle: ProposedTask['cycle'];
      if (/\b(diari[oa]|todos\s+los\s+días|cada\s+día)\b/i.test(segment)) cycle = 'cycle_day';
      else if (/\b(semanal|cada\s+semana)\b/i.test(segment)) cycle = 'cycle_week';
      else if (/\b(mensual|cada\s+mes)\b/i.test(segment)) cycle = 'cycle_month';
      else if (/\b(anual|cada\s+año)\b/i.test(segment)) cycle = 'cycle_year';

      // Match target list
      let listId = suggestedList ? undefined : 'inbox';
      let listName = suggestedList ? suggestedList.name : 'Bandeja de entrada';

      if (isNarrative || finalPeople.length > 0) {
        const queHeHechoList = existingLists.find(l => l.id === 'que_he_hecho' || l.id === 'list_que_he_hecho' || l.name.toLowerCase().includes('qué he hecho'));
        if (queHeHechoList) {
          listId = queHeHechoList.id;
          listName = queHeHechoList.name;
        } else {
          listId = 'que_he_hecho';
          listName = 'Qué he hecho';
        }
      } else {
        for (const l of existingLists) {
          const regex = new RegExp(`\\b(${l.name}|@${l.id})\\b`, 'i');
          if (regex.test(segment) || regex.test(text)) {
            listId = l.id;
            listName = l.name;
            segment = segment.replace(regex, '').trim();
            break;
          }
        }
      }

      // Cleanup title
      let cleanTitle = segment
        .replace(/^(?:buah|pues|bueno|mira|oye|hoy|ayer)\s*,?\s*/i, '')
        .replace(/^(?:he\s+hecho|hice|estuve|fui\s+a|quedé\s+con|tengo\s+que|debo|hay\s+que)\s+/i, (m) => m)
        .replace(/\s{2,}/g, ' ')
        .trim();

      if (cleanTitle.length >= 2) {
        cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
        
        let finalDueDateString: string | undefined;
        if (dueDate) {
          if (timeString) {
            const [h, m] = timeString.split(':').map(Number);
            dueDate.setHours(h, m, 0, 0);
          } else {
            dueDate.setHours(12, 0, 0, 0);
          }
          finalDueDateString = dueDate.toISOString();
        }

        tasks.push({
          id: `ai_task_${Date.now()}_${tasks.length}`,
          title: cleanTitle,
          listName,
          listId,
          dueDate: finalDueDateString,
          timeOfDay,
          price,
          priority,
          cycle,
          people: finalPeople.length > 0 ? finalPeople : undefined,
          vibe,
          locationName,
          selected: true
        });
      }
    }

    let reply = `He analizado tu petición y preparado ${tasks.length} recordatorio${tasks.length === 1 ? '' : 's'} listo${tasks.length === 1 ? '' : 's'} para importar:`;

    // Empathetic & conversational companion reply if the user talked about their day
    if (isNarrative && tasks.length > 0) {
      const allUniquePeople = Array.from(new Set(tasks.flatMap(t => t.people || [])));
      const activitiesOverview = tasks.map(t => {
        let act = t.title.toLowerCase();
        act = act.replace(/^(?:he\s+hecho|hice|estuve|fui\s+a)\s+/i, '');
        return act;
      }).filter(Boolean).slice(0, 3).join(', ');

      const peoplePart = allUniquePeople.length > 0 
        ? ` con ${allUniquePeople.join(' y ')}` 
        : '';

      reply = `¡Vaya día más activo! Con todo lo que me cuentas, veo que has hecho ${activitiesOverview || 'varias actividades'}${peoplePart}. ¿Quieres que lo apunte todo a tu lista «Qué he hecho»?`;
    } else if (tasks.length === 0) {
      reply = 'No he podido detectar tareas claras en el texto. Puedes contarme cómo ha ido tu día o darme una lista como: "Comprar pan por 1€, llamar al dentista mañana a las 10:00 y hacer ejercicio por la tarde".';
    }

    return {
      reply,
      tasks,
      suggestedList
    };
  }

  /**
   * Gemini API LLM Integration
   */
  private static async callGemini(
    prompt: string,
    existingLists: CustomList[],
    _history: { role: string; text: string }[],
    apiKey: string
  ): Promise<ProposedBatch> {
    const listNames = existingLists.map(l => `${l.name} (id: ${l.id})`).join(', ');
    const systemInstruction = `Eres el Asistente IA de Recordatorios Élite (Apple Reminders & Journal companion).
Tu objetivo es ayudar al usuario a planificar o rememorar vivencias, estructurando recordatorios o entradas de diario a partir de lenguaje natural.
Listas existentes del usuario: [${listNames}].

IMPORTANTE: Si el usuario te habla de su día o te cuenta vivencias ("Buah, pues hoy he hecho...", "estuve con Irantzu..."):
- Actúa como una IA conversacional cálida y empática.
- Responde con naturalidad reconociendo sus actividades y personas mencionadas (ejemplo: "¡Vaya día más activo! Con todo lo que me cuentas, veo que has hecho [X] con [Persona]. ¿Quieres que lo apunte todo a tu lista «Qué he hecho»?").
- Asigna las tareas a la lista "Qué he hecho" (id: "que_he_hecho").
- Extrae las personas en el campo "people" (ej: ["Irantzu", "Carlos"]).
- Extrae un emoji/vibe en "vibe" (ej: "✨ Especial", "🏔️ Aventura", "🎉 Celebración", "💼 Logro", "🍕 Relax", "💪 Deporte").

DEBES responder SIEMPRE en formato JSON estricto con la siguiente estructura:
{
  "reply": "Respuesta conversacional empática",
  "suggestedList": { "name": "NombreSiRecomiendasCrearLista", "color": "#007aff", "icon": "list" }, // opcional
  "tasks": [
    {
      "title": "Título de la tarea o vivencia",
      "description": "Notas adicionales (opcional)",
      "listName": "Nombre de la lista recomendada",
      "listId": "id de la lista si coincide con una existente",
      "dueDate": "ISO 8601 string o null",
      "timeOfDay": "morning" | "afternoon" | "night" | null,
      "price": number | null,
      "priority": "none" | "low" | "medium" | "high",
      "cycle": "cycle_day" | "cycle_week" | "cycle_month" | "cycle_year" | null,
      "people": ["Persona1", "Persona2"],
      "vibe": "✨ Especial"
    }
  ]
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: `${systemInstruction}\n\nInstrucción del usuario:\n${prompt}` }] }
        ],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      })
    });

    if (!res.ok) {
      throw new Error(`Gemini API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) throw new Error('Respuesta vacía de Gemini');

    const parsed = JSON.parse(candidateText);
    return {
      reply: parsed.reply || 'Aquí tienes tus recordatorios preparados:',
      suggestedList: parsed.suggestedList,
      tasks: (parsed.tasks || []).map((t: any, idx: number) => ({
        ...t,
        id: `gemini_task_${Date.now()}_${idx}`,
        selected: true
      }))
    };
  }

  /**
   * OpenAI API LLM Integration
   */
  private static async callOpenAI(
    prompt: string,
    existingLists: CustomList[],
    _history: { role: string; text: string }[],
    apiKey: string
  ): Promise<ProposedBatch> {
    const listNames = existingLists.map(l => `${l.name} (id: ${l.id})`).join(', ');
    const systemPrompt = `Eres el Asistente IA de Recordatorios Élite (Apple Reminders & Journal companion). 
Listas actuales del usuario: [${listNames}].
Si el usuario te cuenta su día ("Buah, pues hoy he hecho...", "estuve con Irantzu..."), responde con tono empático y conversacional ("¡Vaya día más activo! Con todo lo que me cuentas, veo que has hecho... ¿Quieres que lo apunte todo a tu lista «Qué he hecho»?"), extrayendo participantes en "people" y vibe en "vibe".

Analiza la solicitud y devuelve un JSON con:
{
  "reply": "Respuesta conversacional empática",
  "suggestedList": { "name": "NombreLista", "color": "#007aff", "icon": "list" }, // opcional
  "tasks": [
    {
      "title": "string",
      "description": "string",
      "listName": "string",
      "listId": "string",
      "dueDate": "ISO 8601 o null",
      "timeOfDay": "morning"|"afternoon"|"night"|null,
      "price": number|null,
      "priority": "none"|"low"|"medium"|"high",
      "cycle": "cycle_day"|"cycle_week"|"cycle_month"|"cycle_year"|null,
      "people": ["string"],
      "vibe": "string"
    }
  ]
}`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!res.ok) {
      throw new Error(`OpenAI API error: ${res.status}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);
    return {
      reply: parsed.reply || 'Aquí tienes tus recordatorios preparados:',
      suggestedList: parsed.suggestedList,
      tasks: (parsed.tasks || []).map((t: any, idx: number) => ({
        ...t,
        id: `openai_task_${Date.now()}_${idx}`,
        selected: true
      }))
    };
  }

  /**
   * Generates a warm, narrative monthly recap of life experiences
   */
  public static async generateMonthlySummary(tasks: TaskItem[], monthName?: string): Promise<string> {
    if (!tasks || tasks.length === 0) {
      return `No tienes vivencias registradas en ${monthName || 'este mes'} todavía. ¡Añade recuerdos con tus personas cercanas para crear tu memoria mensual!`;
    }

    const uniquePeople = Array.from(new Set(tasks.flatMap(t => t.people || [])));
    const uniqueLocations = Array.from(new Set(tasks.map(t => t.locationName).filter(Boolean)));
    const sampleMemories = tasks.slice(0, 4).map(t => t.title).join(', ');

    // Check if cloud LLM is configured
    const config = this.getConfig();
    if (config.apiKey && config.provider === 'gemini') {
      try {
        const prompt = `Actúa como el cronista personal y biógrafo empático de Apple Journal. Redacta un resumen mensual cálido, emotivo y estructurado para ${monthName || 'este mes'} en español.
Total vivencias: ${tasks.length}
Vivencias destacadas:
${tasks.slice(0, 10).map(t => `- ${t.title} ${t.people?.length ? '(con ' + t.people.join(', ') + ')' : ''} ${t.locationName ? 'en ' + t.locationName : ''}`).join('\n')}
Redacta 2 o 3 párrafos de lectura agradable con emojis sutiles.`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        if (res.ok) {
          const data = await res.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) return text.trim();
        }
      } catch (err) {
        console.warn('Gemini monthly summary error:', err);
      }
    }

    // High quality offline semantic narrative generator
    const companionsText = uniquePeople.length > 0
      ? `Las personas que más te han acompañado han sido **${uniquePeople.slice(0, 3).join(', ')}**${uniquePeople.length > 3 ? ` y ${uniquePeople.length - 3} personas más` : ''}.`
      : 'Has disfrutado de momentos de desarrollo e introspección personal.';

    const locationText = uniqueLocations.length > 0
      ? `Tus pasos te llevaron por lugares como **${uniqueLocations.join(', ')}**.`
      : '';

    return `✨ **Memoria de ${monthName || 'este mes'}:**

Ha sido un período lleno de vivencias y movimiento, sumando un total de **${tasks.length} momentos registrados en tu bitácora de vida**. Entre los momentos más señalados destacan: *${sampleMemories}*.

${companionsText} ${locationText}

Cada uno de estos instantes es un pedacito de tu historia personal. ¡Sigue coleccionando experiencias! 🌟`;
  }
}


