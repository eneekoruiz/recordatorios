import type { CustomList, TaskItem } from '../models/Task';
import { extractPrice } from '../utils/priceExtractor';
import { detectFormatAndParse } from '../utils/importerParser';

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

export interface ProposedChildTask {
  id: string;
  title: string;
  isExisting: boolean;
  selected: boolean;
  price?: number;
}

export interface ProposedGroupAction {
  type: 'group_tasks';
  parentTitle: string;
  listId?: string;
  listName?: string;
  children: ProposedChildTask[];
}

export interface ProposedBatch {
  reply: string;
  tasks: ProposedTask[];
  action?: ProposedGroupAction;
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
    conversationHistory: { role: 'user' | 'assistant'; text: string }[] = [],
    existingTasks?: Record<string, TaskItem> | TaskItem[]
  ): Promise<ProposedBatch> {
    const config = this.getConfig();

    // 1. External LLM via Gemini API if key is present
    if (config.provider === 'gemini' && config.apiKey) {
      try {
        return await this.callGemini(userMessage, existingLists, conversationHistory, config.apiKey, existingTasks);
      } catch (err) {
        console.warn('Gemini API call failed, falling back to local extractor:', err);
      }
    }

    // 2. External LLM via OpenAI API if key is present
    if (config.provider === 'openai' && config.apiKey) {
      try {
        return await this.callOpenAI(userMessage, existingLists, conversationHistory, config.apiKey, existingTasks);
      } catch (err) {
        console.warn('OpenAI API call failed, falling back to local extractor:', err);
      }
    }

    // 3. Fallback: Intelligent Local Semantic Extractor (Zero-Config)
    return this.localSemanticExtract(userMessage, existingLists, existingTasks);
  }

  /**
   * Local Semantic Extractor (Zero-Config, runs 100% locally and offline)
   */
  public static localSemanticExtract(
    text: string, 
    existingLists: CustomList[], 
    existingTasks?: Record<string, TaskItem> | TaskItem[]
  ): ProposedBatch {
    const trimmed = text.trim();
    if (!trimmed) {
      return {
        reply: 'Hola, ¿en qué puedo ayudarte hoy? Puedes contarme cómo ha ido tu día, pedirme que organice tus recordatorios o planificar la semana.',
        tasks: []
      };
    }

    const tasksArray: TaskItem[] = existingTasks
      ? (Array.isArray(existingTasks) ? existingTasks : Object.values(existingTasks))
      : [];

    // 1. Intent: Unificar o agrupar recordatorios en una tarea madre
    const isUnifyIntent = /\b(unifica|unificar|agrupa|agrupar|junta|juntar|tarea madre|subtareas)\b/i.test(trimmed);
    if (isUnifyIntent) {
      let targetList = existingLists.find(l => {
        const pattern = new RegExp(`\\b(?:en\\s+(?:la\\s+)?lista\\s+(?:de\\s+)?|en\\s+)${l.name}\\b`, 'i');
        return pattern.test(trimmed) || new RegExp(`\\b${l.name}\\b`, 'i').test(trimmed);
      });

      let parentTitle = 'Productos agrupados';
      const motherMatch = trimmed.match(/(?:en una tarea madre|en la tarea madre|en una tarea principal|en la tarea principal|como subtareas de|bajo la tarea madre|bajo la tarea)\s+(?:que sea\s+|llamada\s+|de\s+)?["']?([^"'.\n]+)["']?/i)
        || trimmed.match(/(?:tarea madre|tarea principal)\s+(?:que sea\s+|llamada\s+|de\s+)?["']?([^"'.\n]+)["']?/i);
      if (motherMatch && motherMatch[1]) {
        parentTitle = motherMatch[1].trim().replace(/[.,;]$/, '');
      }

      const candidateItems: string[] = [];
      const itemsMatch = trimmed.match(/(?:donde pone|los productos donde pone|las tareas donde pone|los recordatorios donde pone|los productos|las tareas|los recordatorios)\s+([\s\S]+?)(?:,\s*unif[íi]calos|,\s*agrup|,\s*j[úu]ntalos|\s+unif[íi]calos|\s+agrup|\s+j[úu]ntalos|\s+en una tarea|\s+en la tarea|\.|$)/i);
      if (itemsMatch && itemsMatch[1]) {
        const rawList = itemsMatch[1];
        rawList.split(/(?:,\s*|\s+y\s+)/i).forEach(item => {
          const cleaned = item.trim().replace(/^(?:el|la|los|las|un|una|donde pone)\s+/i, '').trim();
          if (cleaned && cleaned.length >= 2 && !/^(unifica|unifícalos|agrupa|todos|productos)$/i.test(cleaned)) {
            candidateItems.push(cleaned);
          }
        });
      }

      if (candidateItems.length === 0) {
        const parts = trimmed.split(/,/);
        if (parts.length > 1) {
          parts.forEach(p => {
            const c = p.trim().replace(/^(?:el|la|los|las|un|una|donde pone)\s+/i, '').trim();
            if (c && c.length >= 2 && !/^(unifica|unifícalos|agrupa|todos|en la lista)$/i.test(c)) {
              candidateItems.push(c);
            }
          });
        }
      }

      const listTasks = targetList
        ? tasksArray.filter(t => t.categoryId === targetList.id && !t.deleted_at)
        : tasksArray.filter(t => !t.deleted_at);

      const children: ProposedChildTask[] = [];
      candidateItems.forEach(cand => {
        const candLower = cand.toLowerCase();
        const matched = listTasks.find(t =>
          (t.title || '').toLowerCase().includes(candLower) ||
          candLower.includes((t.title || '').toLowerCase())
        );

        if (matched) {
          if (!children.some(c => c.id === matched.id)) {
            children.push({
              id: matched.id,
              title: matched.title,
              isExisting: true,
              selected: true,
              price: matched.price
            });
          }
        } else {
          children.push({
            id: `ai_child_${Date.now()}_${children.length}`,
            title: cand.charAt(0).toUpperCase() + cand.slice(1),
            isExisting: false,
            selected: true
          });
        }
      });

      if (children.length > 0) {
        const parentTitleFormatted = parentTitle.charAt(0).toUpperCase() + parentTitle.slice(1);
        const listNameStr = targetList ? targetList.name : 'tu lista';
        return {
          reply: `He encontrado y preparado ${children.length} productos en la lista **${listNameStr}** para unificarlos bajo la nueva tarea madre **"${parentTitleFormatted}"**. Puedes revisar la selección y confirmar abajo:`,
          tasks: [],
          action: {
            type: 'group_tasks',
            parentTitle: parentTitleFormatted,
            listId: targetList ? targetList.id : undefined,
            listName: targetList ? targetList.name : undefined,
            children
          }
        };
      }
    }

    // 2. Intent: Consulta sobre tareas de hoy
    const normalized = trimmed.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const isQueryToday = (normalized.includes('que') || normalized.includes('cuales')) &&
                         (normalized.includes('tarea') || normalized.includes('tengo') || normalized.includes('hay') || normalized.includes('queda')) &&
                         normalized.includes('hoy');
    if (isQueryToday && tasksArray.length > 0) {
      const today = new Date().toDateString();
      const todayPending = tasksArray.filter(t => {
        if (t.deleted_at || t.status === 'completed') return false;
        if (t.cycle_id === 'cycle_day' || t.cycle_id === 'day') return true;
        if (t.dueDate) {
          return new Date(t.dueDate).toDateString() === today;
        }
        return false;
      });

      if (todayPending.length === 0) {
        return {
          reply: '🎉 ¡Enhorabuena! No tienes tareas pendientes programadas para hoy. Todo está al día.',
          tasks: []
        };
      }

      const listBullets = todayPending.map(t => `- **${t.title}**${t.duration ? ` (~${t.duration} min)` : ''}${t.price ? ` · ${t.price} €` : ''}`).join('\n');
      return {
        reply: `Para hoy tienes **${todayPending.length} recordatorio${todayPending.length === 1 ? '' : 's'} pendiente${todayPending.length === 1 ? '' : 's'}**:\n\n${listBullets}\n\n¿Quieres que organice algo más o empecemos por alguno?`,
        tasks: []
      };
    }

    // 3. Intent: Consulta sobre una lista concreta (ej. Compra)
    const isQueryList = trimmed.match(/\b(?:qué\s+(?:tengo|hay|queda)|cuánto\s+(?:cuesta|queda))\s+(?:en\s+(?:la\s+)?lista\s+(?:de\s+)?|en\s+)([\w\s]+)/i);
    if (isQueryList && tasksArray.length > 0) {
      const queryListName = isQueryList[1].trim();
      const matchedList = existingLists.find(l => l.name.toLowerCase().includes(queryListName.toLowerCase()));
      if (matchedList) {
        const pendingInList = tasksArray.filter(t => t.categoryId === matchedList.id && !t.deleted_at && t.status !== 'completed');
        const completedInList = tasksArray.filter(t => t.categoryId === matchedList.id && !t.deleted_at && t.status === 'completed');
        const pendingTotal = pendingInList.reduce((sum, t) => sum + (t.price ? Number(t.price) * (t.quantity || 1) : 0), 0);
        const completedTotal = completedInList.reduce((sum, t) => sum + (t.price ? Number(t.price) * (t.quantity || 1) : 0), 0);

        if (pendingInList.length === 0) {
          return {
            reply: `En la lista **${matchedList.name}** no tienes recordatorios pendientes actualmente.`,
            tasks: []
          };
        }

        const itemsPreview = pendingInList.slice(0, 10).map(t => `- ${t.title}${t.price ? ` (${t.price} €)` : ''}`).join('\n');
        const priceInfo = pendingTotal > 0 ? ` con un importe pendiente de **${pendingTotal.toFixed(2)} €**${completedTotal > 0 ? ` (ya completados ${completedTotal.toFixed(2)} €)` : ''}` : '';
        return {
          reply: `En la lista **${matchedList.name}** tienes **${pendingInList.length} recordatorios pendientes**${priceInfo}:\n\n${itemsPreview}${pendingInList.length > 10 ? `\n...y ${pendingInList.length - 10} más.` : ''}`,
          tasks: []
        };
      }
    }

    // Check if the user is narrating their day or sharing personal experiences
    const isNarrative = /\b(buah|hoy\s+(he\s+hecho|hice|estuve|fui|quedé|pasé)|ayer\s+(estuve|fui|quedé|hice)|esta\s+mañana|esta\s+tarde|este\s+finde|el\s+finde)\b/i.test(trimmed);

    // Detect if user wants to create a specific list
    let suggestedList: ProposedBatch['suggestedList'] | undefined;
    const listMatch = trimmed.match(/(?:crea(?:r)?\s+(?:la\s+)?lista\s+["']?([^"'\n,]+)["']?|para\s+(?:el\s+|la\s+)?(viaje\s+a\s+\w+|mudanza|reforma|boda|cumpleaños))/i);
    if (listMatch) {
      const name = (listMatch[1] || listMatch[2] || '').trim();
      if (name && !existingLists.some(l => (l.name || '').toLowerCase() === name.toLowerCase())) {
        suggestedList = {
          name: name.charAt(0).toUpperCase() + name.slice(1),
          color: '#007aff',
          icon: 'list'
        };
      }
    }

    // Check if the input contains structured CSV data
    const nonHeaderLines = trimmed.split(/\r?\n/).filter(l => !l.startsWith('[Documento adjunto:') && !l.startsWith('Por favor, extrae')).join('\n');
    if (nonHeaderLines.split(/\r?\n/).length > 1 && (nonHeaderLines.includes(',') || nonHeaderLines.includes(';') || nonHeaderLines.includes('\t'))) {
      try {
        const parsedCsv = detectFormatAndParse(nonHeaderLines, { cycles: [] });
        if (parsedCsv.tasks.length > 0 && parsedCsv.tasks.some(t => t.dueDate || t.price || t.priority || t.categoryId !== 'inbox')) {
          const mappedCsvTasks: ProposedTask[] = parsedCsv.tasks.map((t, idx) => {
            const matchedList = existingLists.find(l => l.id === t.categoryId || (l.name || '').toLowerCase() === (t.categoryId || '').toLowerCase());
            return {
              id: `ai_csv_${Date.now()}_${idx}`,
              title: t.title,
              description: t.description,
              listId: matchedList ? matchedList.id : (existingLists[0]?.id || 'inbox'),
              listName: matchedList ? matchedList.name : 'Bandeja de entrada',
              dueDate: t.dueDate,
              price: t.price,
              priority: t.priority,
              selected: true
            };
          });

          return {
            reply: `He procesado el documento CSV y extraído **${mappedCsvTasks.length} recordatorios** estructurados listos para guardar:`,
            tasks: mappedCsvTasks
          };
        }
      } catch {
        // Fall back to standard parsing
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
      segment = segment.trim();
      // Ignore document headers, instruction wrappers, or page markers
      if (/^(\[documento adjunto|\[archivo|por favor,?\s*extrae|extrae,?\s*organiza|p[áa]gina\s*\d+|page\s*\d+)/i.test(segment)) {
        continue;
      }
      if (/^[-=_*]{3,}$/.test(segment)) {
        continue;
      }

      // Strip markdown checkboxes and bullets
      segment = segment.replace(/^[-*•]\s+\[[ xX]\]\s+/, '');
      segment = segment.replace(/^[-*•+–—\d.)]+\s*/, '').trim();
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
        const queHeHechoList = existingLists.find(l => l.id === 'que_he_hecho' || l.id === 'list_que_he_hecho' || (l.name || '').toLowerCase().includes('qué he hecho'));
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
        if (/^(?:en\s+(?:la\s+)?lista|unifica|unifícalos|agrupa|agrupalos|ponlos todos|haz una tarea|crea una tarea|donde pone)\b/i.test(cleanTitle)) {
          continue;
        }
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
        let act = (t.title || '').toLowerCase();
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
    apiKey: string,
    existingTasks?: Record<string, TaskItem> | TaskItem[]
  ): Promise<ProposedBatch> {
    const listNames = existingLists.map(l => `${l.name} (id: ${l.id})`).join(', ');
    const tasksArr = existingTasks ? (Array.isArray(existingTasks) ? existingTasks : Object.values(existingTasks)) : [];
    const activeTasksSummary = tasksArr
      .filter(t => !t.deleted_at && t.status !== 'completed')
      .slice(0, 40)
      .map(t => `"${t.title}" (lista: ${t.categoryId || 'inbox'})`)
      .join(', ');

    const systemInstruction = `Eres el Asistente IA de Recordatorios Élite (Apple Reminders & Journal companion), sumamente inteligente, analítico y meticuloso.
Tu objetivo es comprender incluso los mensajes más densos, caóticos o enrevesados del usuario, desglosando cada instrucción sin omitir ningún detalle.
Listas existentes del usuario: [${listNames}].
Recordatorios activos existentes: [${activeTasksSummary}].

REGLAS CRÍTICAS DE COMPRENSIÓN Y PRECISIÓN:
1. DESGLOSE METICULOSO: Si el usuario escribe un mensaje largo o enrevesado con muchas cosas mezcladas (recordatorios, listas de compra con precios, duraciones, fechas/horas, hábitos recurrentes), desglosa cada uno como un recordatorio independiente en el array "tasks".
2. PRECIOS: Si se menciona un precio (ej. "leche 1,20 €", "50 euros"), extrae el número en "price" (ej. 1.2 o 50).
3. FRECUENCIAS (CICLOS): Si la tarea es recurrente/periódica, asigna EXCLUSIVAMENTE uno de estos 4 identificadores en "cycle":
   - "cycle_day" (si es diario / cada día)
   - "cycle_week" (si es semanal / cada semana)
   - "cycle_month" (si es mensual / cada mes)
   - "cycle_year" (si es anual / cada año)
   ¡ESTÁ ESTRICTAMENTE PROHIBIDO inventar nuevos ciclos o sugerir crear listas llamadas "Semanal", "Mensual", "Diario" o "Anual"!
4. PREVENCIÓN DE DUPLICADOS: Si una tarea que el usuario menciona ya está en sus recordatorios activos para la misma lista, no crees un duplicado idéntico.
5. SI EL USUARIO CUENTA SU DÍA O VIVENCIAS ("Hoy estuve con...", "fui a..."):
   - Sé empático, cercano y cálido.
   - Asigna a la lista "Qué he hecho" (id: "que_he_hecho").
   - Extrae los nombres de personas en "people" y el emoji en "vibe".

DEBES responder SIEMPRE en formato JSON estricto con la siguiente estructura:
{
  "reply": "Respuesta conversacional empática y clara",
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
    apiKey: string,
    existingTasks?: Record<string, TaskItem> | TaskItem[]
  ): Promise<ProposedBatch> {
    const listNames = existingLists.map(l => `${l.name} (id: ${l.id})`).join(', ');
    const tasksArr = existingTasks ? (Array.isArray(existingTasks) ? existingTasks : Object.values(existingTasks)) : [];
    const activeTasksSummary = tasksArr
      .filter(t => !t.deleted_at && t.status !== 'completed')
      .slice(0, 40)
      .map(t => `"${t.title}" (lista: ${t.categoryId || 'inbox'})`)
      .join(', ');

    const systemPrompt = `Eres el Asistente IA de Recordatorios Élite (Apple Reminders & Journal companion), sumamente inteligente, analítico y meticuloso.
Tu objetivo es comprender incluso los mensajes más densos, caóticos o enrevesados del usuario, desglosando cada instrucción sin omitir ningún detalle.
Listas existentes del usuario: [${listNames}].
Recordatorios activos existentes: [${activeTasksSummary}].

REGLAS CRÍTICAS:
1. DESGLOSE: Extrae cada elemento individual con precisión extrema.
2. PRECIOS: En "price" como número flotante (ej: 4.5).
3. FRECUENCIAS: Usa EXCLUSIVAMENTE 'cycle_day', 'cycle_week', 'cycle_month' o 'cycle_year'. ¡No inventes otros!
4. SIN DUPLICADOS: Si la tarea ya existe en activos, no la dupliques.

Analiza la solicitud y devuelve un JSON con:
{
  "reply": "Respuesta conversacional empática y clara",
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


