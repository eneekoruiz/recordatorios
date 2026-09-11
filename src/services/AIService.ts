import type { CustomList } from '../models/Task';

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
  public static localSemanticExtract(text: string, existingLists: CustomList[]): ProposedBatch {
    const trimmed = text.trim();
    if (!trimmed) {
      return {
        reply: 'Hola, ¿en qué puedo ayudarte hoy? Puedes pedirme que organice tu día, prepare una lista de la compra o planifique un proyecto completo.',
        tasks: []
      };
    }

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
    // Split by newlines, bullets (-, *, 1.), semicolons, or sentence terminators.
    let rawSegments: string[] = [];
    if (trimmed.includes('\n')) {
      rawSegments = trimmed.split('\n');
    } else {
      // Split by bullet points or sequences
      rawSegments = trimmed.split(/(?:;\s*|\.\s+(?=[A-Z0-9¿¡])|\s+-\s+|\s*\n\s*)/);
    }

    // If only one segment and it contains multiple actions joined by commas or " y "
    if (rawSegments.length === 1 && (trimmed.includes(',') || /\s+y\s+/i.test(trimmed))) {
      const parts = trimmed.split(/,\s*(?:y\s+)?|\s+y\s+/i);
      if (parts.length > 1) {
        rawSegments = parts;
      }
    }

    const tasks: ProposedTask[] = [];

    for (let segment of rawSegments) {
      segment = segment.trim().replace(/^[-*•\d.)]+\s*/, '');
      if (!segment || segment.length < 3) continue;

      // Ignore greeting-only or meta segments
      if (/^(hola|buenas|por favor|organízame|ayúdame|apúntame|quiero que|gracias)\.?$/i.test(segment)) {
        continue;
      }

      // Extract price
      let price: number | undefined;
      const priceMatch = segment.match(/(\d+(?:[.,]\d+)?)\s*(?:€|euros?|eur|\$)/i);
      if (priceMatch) {
        price = parseFloat(priceMatch[1].replace(',', '.'));
        segment = segment.replace(priceMatch[0], '').trim();
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
      if (/\bhoy\b/i.test(segment)) {
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

      for (const l of existingLists) {
        const regex = new RegExp(`\\b(${l.name}|@${l.id})\\b`, 'i');
        if (regex.test(segment) || regex.test(text)) {
          listId = l.id;
          listName = l.name;
          segment = segment.replace(regex, '').trim();
          break;
        }
      }

      // Cleanup title
      let cleanTitle = segment
        .replace(/^(tengo\s+que|debo|hay\s+que|hacer|preparar|comprar|llamar|agendar)\s+/i, (m) => m)
        .replace(/\s{2,}/g, ' ')
        .trim();

      if (cleanTitle.length >= 2) {
        cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
        
        // Build final ISO date if dueDate
        let finalDueDateString: string | undefined;
        if (dueDate) {
          if (timeString) {
            const [h, m] = timeString.split(':').map(Number);
            dueDate.setHours(h, m, 0, 0);
          } else {
            dueDate.setHours(9, 0, 0, 0);
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
          selected: true
        });
      }
    }

    let reply = `He analizado tu petición y preparado ${tasks.length} recordatorio${tasks.length === 1 ? '' : 's'} listo${tasks.length === 1 ? '' : 's'} para importar:`;
    if (tasks.length === 0) {
      reply = 'No he podido detectar tareas claras en el texto. Puedes darme una lista como: "Comprar pan por 1€, llamar al dentista mañana a las 10:00 y hacer ejercicio por la tarde".';
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
    const systemInstruction = `Eres el Asistente IA de Recordatorios Élite (iOS Reminders style).
Tu objetivo es ayudar al usuario a planificar, desglosar y crear conjuntos de recordatorios estructurados a partir de lenguaje natural.
Listas existentes del usuario: [${listNames}].

DEBES responder SIEMPRE en formato JSON estricto con la siguiente estructura:
{
  "reply": "Texto conversacional cordial explicando qué has organizado",
  "suggestedList": { "name": "NombreSiRecomiendasCrearLista", "color": "#007aff", "icon": "list" }, // opcional
  "tasks": [
    {
      "title": "Título de la tarea",
      "description": "Notas adicionales (opcional)",
      "listName": "Nombre de la lista recomendada",
      "listId": "id de la lista si coincide con una existente",
      "dueDate": "ISO 8601 string o null",
      "timeOfDay": "morning" | "afternoon" | "night" | null,
      "price": number | null,
      "priority": "none" | "low" | "medium" | "high",
      "cycle": "cycle_day" | "cycle_week" | "cycle_month" | "cycle_year" | null
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
    const systemPrompt = `Eres el Asistente IA de Recordatorios Élite. 
Listas actuales del usuario: [${listNames}].
Analiza la solicitud y devuelve un JSON con:
{
  "reply": "Respuesta breve",
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
      "cycle": "cycle_day"|"cycle_week"|"cycle_month"|"cycle_year"|null
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
}
