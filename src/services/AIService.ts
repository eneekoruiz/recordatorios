import type { CustomList, TaskItem } from '../models/Task';
import { extractPrice } from '../utils/priceExtractor';
import { detectFormatAndParse } from '../utils/importerParser';
import { normalizeSpokenPrompt, stripRequestFrames, isFillerOnly, asPriorityModifier, parseWeekdayPhrase, parseClockTime, timeOfDayForHour, tidyTitle, leadingInfinitive, isBareNounPhrase } from '../utils/aiPhrasing';

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

export interface ProposedTaskUpdate {
  taskId: string;
  originalTitle: string;
  newTitle?: string;
  description?: string;
  dueDate?: string;
  timeOfDay?: 'morning' | 'afternoon' | 'night';
  price?: number;
  listId?: string;
  listName?: string;
  priority?: 'none' | 'low' | 'medium' | 'high';
  cycle?: 'cycle_day' | 'cycle_week' | 'cycle_month' | 'cycle_year';
  status?: 'pending' | 'completed';
  deleted?: boolean;
  selected: boolean;
  reason?: string;
}

export interface ProposedBatch {
  reply: string;
  tasks: ProposedTask[];
  taskUpdates?: ProposedTaskUpdate[];
  action?: ProposedGroupAction;
  suggestedList?: {
    name: string;
    color?: string;
    icon?: string;
  };
  clarificationQuestions?: string[];
  suggestedReplies?: string[];
}

export interface AIConfig {
  provider: 'auto' | 'gemini' | 'openai';
  apiKey?: string;
}

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
/** Modelos por orden de preferencia (los 1.5 ya están retirados: solo añadían intentos fallidos). */
const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash-lite'];

/** La clave viaja en cabecera, no en la URL (las URLs acaban en logs y en historiales de proxy). */
const geminiRequest = (model: string, apiKey: string, body: unknown, signal: AbortSignal) =>
  fetch(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    signal,
    body: JSON.stringify(body),
  });

export class AIService {
  public static getConfig(): AIConfig {
    try {
      const saved = localStorage.getItem('ai_assistant_config');
      if (saved) {
        const parsed: AIConfig = JSON.parse(saved);
        if (parsed.apiKey && (!parsed.provider || parsed.provider === 'auto') && parsed.apiKey.startsWith('AIza')) {
          parsed.provider = 'gemini';
        }
        return parsed;
      }
    } catch {}

    // Sin VITE_GEMINI_API_KEY: cualquier variable VITE_* acaba en el bundle público.
    return { provider: 'auto' };
  }

  public static saveConfig(config: AIConfig) {
    if (config.apiKey && config.apiKey.startsWith('AIza') && config.provider === 'auto') {
      config.provider = 'gemini';
    }
    localStorage.setItem('ai_assistant_config', JSON.stringify(config));
  }

  public static async testGeminiConnection(apiKey: string): Promise<{ ok: boolean; model?: string; error?: string }> {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      return { ok: false, error: 'La clave de API no puede estar vacía' };
    }

    const candidateModels = GEMINI_MODELS;
    let lastError = '';

    for (const model of candidateModels) {
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), 10000);
      try {
        const res = await geminiRequest(model, trimmedKey, {
          contents: [{ parts: [{ text: 'Responde estrictamente: OK' }] }]
        }, timeoutController.signal);

        if (res.ok) {
          return { ok: true, model };
        }

        const errData = await res.json().catch(() => ({}));
        const message = errData?.error?.message || `HTTP ${res.status} ${res.statusText}`;
        lastError = message;

        if (res.status === 401 || res.status === 403) {
          return { ok: false, error: `Clave no válida o sin permisos (${message})` };
        }
      } catch (err: any) {
        lastError = err?.name === 'AbortError' ? `Tiempo de espera agotado con ${model} (10s)` : (err?.message || 'Error de conexión de red');
      } finally {
        clearTimeout(timeoutId);
      }
    }

    return { ok: false, error: lastError || 'No se pudo conectar con ningún modelo de Gemini' };
  }

  /**
   * Main entry point: Processes conversation and returns conversational response + proposed tasks
   */
  public static async processPrompt(
    userMessage: string,
    existingLists: CustomList[],
    conversationHistory: { role: 'user' | 'assistant'; text: string }[] = [],
    existingTasks?: Record<string, TaskItem> | TaskItem[],
    lastProposedTasks?: ProposedTask[]
  ): Promise<ProposedBatch> {
    const config = this.getConfig();
    const apiKey = config.apiKey?.trim();

    // 1. External LLM via Gemini API if key is present or provider is gemini
    // OJO: un "provider" explícito (elegido en Ajustes) manda siempre — antes, cualquier clave
    // de más de 20 caracteres (o sea, casi cualquier clave real, también las de OpenAI que
    // empiezan por "sk-" y son más largas) se trataba como Gemini y "openai" nunca se alcanzaba.
    const isGemini = config.provider === 'gemini' || (config.provider === 'auto' && Boolean(apiKey) && apiKey!.startsWith('AIza'));
    if (isGemini && apiKey) {
      try {
        return await this.callGemini(userMessage, existingLists, conversationHistory, apiKey, existingTasks);
      } catch (err: any) {
        console.error('Gemini API call failed:', err);
        const localBatch = this.localSemanticExtract(userMessage, existingLists, existingTasks, lastProposedTasks);
        return {
          ...localBatch,
          reply: `⚠️ *[Aviso: No se pudo conectar con Gemini (${err.message || 'error de conexión'}). He procesado tu solicitud con el extractor local inteligente]:*\n\n${localBatch.reply}`,
          suggestedReplies: [
            ...(localBatch.suggestedReplies || []),
            'Abrir Ajustes de IA ⚙️'
          ]
        };
      }
    }

    // 2. External LLM via OpenAI API if key is present
    if (config.provider === 'openai' && apiKey) {
      try {
        return await this.callOpenAI(userMessage, existingLists, conversationHistory, apiKey, existingTasks);
      } catch (err: any) {
        console.error('OpenAI API call failed:', err);
        const localBatch = this.localSemanticExtract(userMessage, existingLists, existingTasks, lastProposedTasks);
        return {
          ...localBatch,
          reply: `⚠️ *[Aviso: No se pudo conectar con OpenAI (${err.message || 'error de conexión'}). He procesado tu solicitud con el extractor local inteligente]:*\n\n${localBatch.reply}`,
          suggestedReplies: [
            ...(localBatch.suggestedReplies || []),
            'Abrir Ajustes de IA ⚙️'
          ]
        };
      }
    }

    // 3. El proveedor elegido en Ajustes es Gemini/OpenAI pero no hay clave guardada: antes esto
    // caía en el extractor local en silencio, con la cabecera del chat mostrando igualmente
    // "Google Gemini LLM" / "OpenAI GPT" — parecía que se estaba hablando con el LLM real
    // cuando en realidad cada mensaje lo respondía el extractor de reglas.
    if ((config.provider === 'gemini' || config.provider === 'openai') && !apiKey) {
      const localBatch = this.localSemanticExtract(userMessage, existingLists, existingTasks, lastProposedTasks);
      return {
        ...localBatch,
        reply: `⚠️ *[Tienes ${config.provider === 'gemini' ? 'Gemini' : 'OpenAI'} elegido en Ajustes pero sin clave de API guardada, así que esto lo ha respondido el extractor local, no un LLM real]:*\n\n${localBatch.reply}`,
        suggestedReplies: [
          ...(localBatch.suggestedReplies || []),
          'Abrir Ajustes de IA ⚙️'
        ]
      };
    }

    // 4. Fallback: Intelligent Local Semantic Extractor (Zero-Config)
    return this.localSemanticExtract(userMessage, existingLists, existingTasks, lastProposedTasks);
  }

  /**
   * Aplica una corrección de última hora ("¿y si mejor a las 11?", "mejor el jueves",
   * "ponle 5€", "cámbialo a la lista Compra") sobre lo que se acaba de proponer (todavía sin
   * confirmar), en vez de tratarla como una tarea nueva. Reconoce hora, fecha (relativa o día
   * de la semana), precio, lista y título; si no reconoce ningún cambio, devuelve null y el
   * llamador decide qué hacer (normalmente, pedir que se reformule).
   */
  private static tryApplyCorrection(
    text: string,
    lastProposedTasks: ProposedTask[],
    existingLists: CustomList[]
  ): ProposedBatch | null {
    let newTimeString: string | undefined;
    let newTimeOfDay: 'morning' | 'afternoon' | 'night' | undefined;
    let newDueDate: Date | undefined;
    let newPrice: number | undefined;
    let newTitle: string | undefined;
    let newListId: string | undefined;
    let newListName: string | undefined;
    const changeDescriptions: string[] = [];

    const timeMatch = text.match(/\b(?:a\s+las?|a\s+la)\s+([0-1]?[0-9]|2[0-3])(?::([0-5][0-9]))?\s*(am|pm|h)?/i);
    if (timeMatch) {
      let hour = parseInt(timeMatch[1], 10);
      const min = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      const meridian = timeMatch[3]?.toLowerCase();
      if (meridian === 'pm' && hour < 12) hour += 12;
      if (meridian === 'am' && hour === 12) hour = 0;
      newTimeString = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      newTimeOfDay = hour >= 6 && hour < 14 ? 'morning' : hour >= 14 && hour < 20 ? 'afternoon' : 'night';
      changeDescriptions.push(`hora: ${newTimeString}`);
    }

    const now = new Date();
    // Sin acentos e indexados como Date.getDay() (0 = domingo ... 6 = sábado).
    const weekdayNamesNorm = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const weekdayMatch = text.match(/\b(domingo|lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado)\b/i);
    if (/\bpasado\s+mañana\b/i.test(text)) {
      newDueDate = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
      changeDescriptions.push('fecha: pasado mañana');
    } else if (/\bmañana\b/i.test(text) && !/\bpor\s+la\s+mañana\b/i.test(text)) {
      newDueDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      changeDescriptions.push('fecha: mañana');
    } else if (/\bhoy\b/i.test(text)) {
      newDueDate = new Date(now);
      changeDescriptions.push('fecha: hoy');
    } else if (/\b(este\s+)?fin\s+de\s+semana\b/i.test(text)) {
      const day = now.getDay();
      const diff = day === 6 ? 7 : (6 - day);
      newDueDate = new Date(now.getTime() + diff * 24 * 60 * 60 * 1000);
      changeDescriptions.push('fecha: fin de semana');
    } else if (weekdayMatch) {
      const normalizedWeekday = weekdayMatch[1].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const targetDow = weekdayNamesNorm.indexOf(normalizedWeekday);
      if (targetDow >= 0) {
        const currentDow = now.getDay();
        let diff = targetDow - currentDow;
        if (diff <= 0) diff += 7;
        newDueDate = new Date(now.getTime() + diff * 24 * 60 * 60 * 1000);
        changeDescriptions.push(`fecha: ${weekdayMatch[1]}`);
      }
    }

    const priceMatch = extractPrice(text, false);
    if (priceMatch && priceMatch.price > 0) {
      newPrice = priceMatch.price;
      changeDescriptions.push(`precio: ${newPrice}€`);
    }

    const listMatch = text.match(/(?:en\s+la\s+lista\s+(?:de\s+)?|muével[oa]\s+a\s+|pásal[oa]\s+a\s+|c[áa]mbial[oa]\s+a\s+(?:la\s+lista\s+)?)["']?([^"'.,\n]+)["']?/i);
    if (listMatch && listMatch[1]) {
      const candidate = listMatch[1].trim();
      const matchedList = existingLists.find(l => l.name.toLowerCase() === candidate.toLowerCase() || candidate.toLowerCase().includes(l.name.toLowerCase()));
      if (matchedList) {
        newListId = matchedList.id;
        newListName = matchedList.name;
        changeDescriptions.push(`lista: ${matchedList.name}`);
      }
    }

    const titleMatch = text.match(/(?:que\s+se\s+llame|c[áa]mbiale\s+el\s+(?:nombre|t[íi]tulo)\s+a|renómbral[oa]\s+a|mejor\s+(?:que\s+)?ponle)\s+["']?([^"'.\n]+)["']?/i);
    if (titleMatch && titleMatch[1]) {
      newTitle = titleMatch[1].trim();
      changeDescriptions.push(`título: ${newTitle}`);
    }

    if (changeDescriptions.length === 0) return null;

    const updatedTasks: ProposedTask[] = lastProposedTasks.map((t, i) => {
      const clone: ProposedTask = { ...t, id: `ai_task_${Date.now()}_${i}` };
      if (newTimeString) {
        const base = clone.dueDate ? new Date(clone.dueDate) : new Date();
        const [h, m] = newTimeString.split(':').map(Number);
        base.setHours(h, m, 0, 0);
        clone.dueDate = base.toISOString();
        clone.timeOfDay = newTimeOfDay;
      }
      if (newDueDate) {
        const combined = new Date(newDueDate);
        if (clone.dueDate) {
          const prevTime = new Date(clone.dueDate);
          combined.setHours(prevTime.getHours(), prevTime.getMinutes(), 0, 0);
        } else {
          combined.setHours(12, 0, 0, 0);
        }
        clone.dueDate = combined.toISOString();
      }
      if (newPrice !== undefined) clone.price = newPrice;
      if (newTitle) clone.title = newTitle;
      if (newListId) {
        clone.listId = newListId;
        clone.listName = newListName;
      }
      return clone;
    });

    const subject = updatedTasks.length === 1 ? `"${updatedTasks[0].title}"` : `los ${updatedTasks.length} recordatorios`;
    return {
      reply: `He actualizado ${subject} (${changeDescriptions.join(', ')}). Revisa y confirma:`,
      tasks: updatedTasks
    };
  }

  /**
   * Local Semantic Extractor (Zero-Config, runs 100% locally and offline)
   */
  public static localSemanticExtract(
    text: string,
    existingLists: CustomList[],
    existingTasks?: Record<string, TaskItem> | TaskItem[],
    lastProposedTasks?: ProposedTask[]
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

    // 0.-1 Intent: Corregir lo que se acaba de proponer (aún sin confirmar/guardar), no una
    // tarea existente ni una tarea nueva — "¿y si mejor a las 11?", "mejor el jueves",
    // "ponle 5€", "cámbialo a la lista Compra". Va antes que cualquier otra cosa: si hay una
    // propuesta reciente y el mensaje trae un cambio reconocible, se aplica sobre esa.
    // Solo si el mensaje realmente "suena" a corrección (frase corta u opener típico) — si no,
    // "recuérdame ir al médico mañana a las 5" tras una propuesta sin confirmar se trataría por
    // error como una corrección de esa propuesta en vez de como la tarea nueva que es.
    const soundsLikeCorrection = /^¿?(?:y\s+si|qu[ée]\s+tal\s+si|mejor\s+(?:si|a\s+las?|que)|y\s+mejor|no,?\s+mejor|c[áa]mbia(?:lo|la)?\s+a|c[áa]mbiale)\b/i.test(trimmed) ||
      (trimmed.split(/\s+/).length <= 6 && !/\b(recu[ée]rdame|apunta|a[ñn]ade|agrega|crea|pon\s+un\s+recordatorio|tengo\s+que|hay\s+que|debo|comprar|llamar|hacer)\b/i.test(trimmed));
    if (soundsLikeCorrection && lastProposedTasks && lastProposedTasks.length > 0) {
      const correctionBatch = this.tryApplyCorrection(trimmed, lastProposedTasks, existingLists);
      if (correctionBatch) return correctionBatch;
    }

    // 0. Intent: Saludo general o pregunta sobre capacidades (NO añadir recordatorios ciegamente)
    const normalizedGreeting = trimmed.replace(/^[¡¿\s]+/, '');
    const isGreetingOrHelp = /^(hola|buenas|buenos\s+d[íi]as|buenas\s+tardes|buenas\s+noches|qu[ée]\s+tal|c[óo]mo\s+est[áa]s|qu[ée]\s+puedes\s+hacer|qui[ée]n\s+eres|ayuda|ay[úu]dame|help)\b/i.test(normalizedGreeting) &&
      !/(?:apunta|crea|a[ñn]ade|recu[ée]rdame|compra|marca|borra|elimina|pon|haz)\b/i.test(trimmed);
    if (isGreetingOrHelp) {
      return {
        reply: `¡Hola! Soy tu **Asistente Inteligente de Recordatorios**. Estoy aquí para facilitarte el día a día. Puedes pedirme:

- 📋 **Crear recordatorios desglosados:** Pega listas largas, audios transcritos o notas enrevesadas.
- ✏️ **Modificar o completar:** *"Marca hecha la leche"*, *"Pon precio de 3,50€ al pan"* o *"Elimina la reunión"*.
- 🔍 **Consultar tus tareas:** *"¿Qué tengo para hoy?"* o *"¿Cuánto llevo gastado en la compra?"*.
- 📂 **Unificar y organizar:** *"Unifica los productos de limpieza en una tarea madre"*.
- 📄 **Importar documentos:** Arrastra cualquier archivo PDF o CSV.

¿Qué te gustaría organizar hoy?`,
        tasks: [],
        suggestedReplies: [
          '¿Qué tareas tengo para hoy?',
          'Planificar mi semana',
          'Compra semanal con precios'
        ]
      };
    }

    // 0.1 Intent: Modificar / Completar / Eliminar tarea existente de forma inteligente
    const isCompleteIntent = trimmed.match(/(?:marca(?:r)?\s+(?:como\s+)?(?:hech[ao]|completad[ao]|terminad[ao])|completa(?:r)?|termina(?:r)?|ya\s+(?:hice|termin[ée]))\s+(?:el|la|los|las|mi)?\s*(.+)/i);
    const isDeleteIntent = trimmed.match(/(?:borra(?:r)?|elimina(?:r)?|quita(?:r)?)\s+(?:el|la|los|las|recordatorio|tarea)?\s*(.+)/i);
    const isPriceUpdateIntent = trimmed.match(/(?:cambia(?:r)?|pon(?:le)?|actualiza(?:r)?)\s+(?:el\s+precio\s+de\s+|precio\s+a\s+)?(.+?)\s+(?:a|por)\s+(\d+(?:[.,]\d+)?\s*€?)/i);

    if ((isCompleteIntent || isDeleteIntent || isPriceUpdateIntent) && tasksArray.length > 0) {
      if (isCompleteIntent && isCompleteIntent[1]) {
        const query = isCompleteIntent[1].trim().toLowerCase().replace(/[.,;]$/, '');
        const matched = tasksArray.find(t => !t.deleted_at && t.status !== 'completed' && (
          t.title.toLowerCase().includes(query) || query.includes(t.title.toLowerCase())
        ));
        if (matched) {
          return {
            reply: `He preparado la modificación para marcar como completada la tarea **"${matched.title}"**. Puedes confirmarla abajo:`,
            tasks: [],
            taskUpdates: [{
              taskId: matched.id,
              originalTitle: matched.title,
              status: 'completed',
              selected: true,
              reason: 'Marcar como completada'
            }]
          };
        }
      }

      if (isDeleteIntent && isDeleteIntent[1]) {
        const query = isDeleteIntent[1].trim().toLowerCase().replace(/[.,;]$/, '');
        const matched = tasksArray.find(t => !t.deleted_at && (
          t.title.toLowerCase().includes(query) || query.includes(t.title.toLowerCase())
        ));
        if (matched) {
          return {
            reply: `He preparado la acción para eliminar el recordatorio **"${matched.title}"**. Confirma la modificación abajo:`,
            tasks: [],
            taskUpdates: [{
              taskId: matched.id,
              originalTitle: matched.title,
              deleted: true,
              selected: true,
              reason: 'Eliminar recordatorio'
            }]
          };
        }
      }

      if (isPriceUpdateIntent && isPriceUpdateIntent[1] && isPriceUpdateIntent[2]) {
        const query = isPriceUpdateIntent[1].trim().toLowerCase();
        const priceVal = parseFloat(isPriceUpdateIntent[2].replace(',', '.').replace('€', '').trim());
        const matched = tasksArray.find(t => !t.deleted_at && (
          t.title.toLowerCase().includes(query) || query.includes(t.title.toLowerCase())
        ));
        if (matched && !isNaN(priceVal)) {
          return {
            reply: `He preparado la actualización de precio para **"${matched.title}"** a **${priceVal.toFixed(2)} €**:`,
            tasks: [],
            taskUpdates: [{
              taskId: matched.id,
              originalTitle: matched.title,
              price: priceVal,
              selected: true,
              reason: `Actualizar precio a ${priceVal.toFixed(2)} €`
            }]
          };
        }
      }
    }

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
        rawList.split(/(?:,(?!\d)\s*|\s+y\s+)/i).forEach(item => {
          const cleaned = item.trim().replace(/^(?:el|la|los|las|un|una|donde pone)\s+/i, '').trim();
          if (cleaned && cleaned.length >= 2 && !/^(unifica|unifícalos|agrupa|todos|productos)$/i.test(cleaned)) {
            candidateItems.push(cleaned);
          }
        });
      }

      if (candidateItems.length === 0) {
        const parts = trimmed.split(/,(?!\d)/);
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
    // Lenguaje hablado: «lunes y miércoles» no son dos tareas, «3 euros cada uno» es un precio,
    // «ah y también» es solo un separador… (ver utils/aiPhrasing).
    const spoken = normalizeSpokenPrompt(trimmed);
    let rawSegments: string[] = [];
    if (spoken.includes('\n')) {
      rawSegments = spoken.split('\n');
    } else {
      // Split by bullet points or sequences
      rawSegments = spoken.split(/(?:;\s*|\.\s+(?=[A-Z0-9¿¡])|\s+-\s+|\s*\n\s*)/);
    }

    // If only one segment and it contains multiple actions joined by " y también ", " y luego ", " y ", commas
    let splitByConjunction = false;
    if (rawSegments.length === 1 && (spoken.includes(',') || /\s+y\s+(?:también\s+|luego\s+)?/i.test(spoken))) {
      const parts = spoken.split(/(?:,(?!\d)\s*(?:y\s+)?|\s+y\s+(?:también\s+|luego\s+)?)/i);
      if (parts.length > 1) {
        rawSegments = parts;
        splitByConjunction = true;
      }
    }
    // Contexto de la frase anterior: «comprar pan y leche» → «Comprar leche» (mismo verbo, fecha y hora).
    let lastVerb: string | null = null;
    let lastCtx: { dueDate?: Date; timeString?: string; timeOfDay?: 'morning' | 'afternoon' | 'night' } = {};

    const tasks: ProposedTask[] = [];
    // El extractor local no recuerda lo que acaba de proponer (no recibe el historial de la
    // conversación): "¿Y si mejor a las 11?" no tiene nada que corregir aquí y, sin este aviso,
    // se colaba como una tarea nueva sin sentido ("¿Y si mejor?"). Mejor pedir que lo reformule.
    let hadCorrectionLikeSegment = false;

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
      // "¿Y si...?", "¿Qué tal si...?", "Mejor a las..." — una corrección al turno anterior,
      // no una tarea nueva. Sin memoria de conversación aquí, mejor preguntar que inventar.
      if (/^¿?(?:y\s+si|qu[ée]\s+tal\s+si|mejor\s+(?:si|a\s+las?|que)|y\s+mejor)\b/i.test(segment)) {
        hadCorrectionLikeSegment = true;
        continue;
      }

      // Strip markdown checkboxes and bullets
      segment = segment.replace(/^[-*•]\s+\[[ xX]\]\s+/, '');
      segment = segment.replace(/^[-*•+–—\d.)]+\s*/, '').trim();
      if (!segment || segment.length < 3) continue;

      // «oye, cuando puedas, recuérdame que tengo que…»: fuera el marco, se queda lo que hay que hacer.
      // Si el usuario cuenta su día («fui a…», «he hecho…») no se toca.
      if (!isNarrative) segment = stripRequestFrames(segment);
      if (isFillerOnly(segment)) continue;
      // «es urgente» detrás de una tarea no es otra tarea: es su prioridad.
      const priorityModifier = asPriorityModifier(segment);
      if (priorityModifier && tasks.length > 0) {
        tasks[tasks.length - 1].priority = priorityModifier;
        continue;
      }
      // Frase nominal suelta tras un verbo compartido («comprar pan y leche»): hereda verbo y contexto.
      let inheritsContext = false;
      if (splitByConjunction && !isNarrative && lastVerb && isBareNounPhrase(segment)) {
        segment = `${lastVerb} ${segment.charAt(0).toLowerCase()}${segment.slice(1)}`;
        inheritsContext = true;
      }

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
      const clock = parseClockTime(segment);
      if (clock) {
        timeString = `${clock.hour.toString().padStart(2, '0')}:${clock.minute.toString().padStart(2, '0')}`;
        segment = segment.replace(clock.matched, '').trim();
        timeOfDay = timeOfDayForHour(clock.hour);
      }

      // Extract date
      let dueDate: Date | undefined;
      let weekdayCycle: ProposedTask['cycle'];
      let weekdayDescription: string | undefined;
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
      } else {
        // «el jueves», «el jueves que viene», «antes del viernes», «todos los lunes y miércoles»
        const weekday = parseWeekdayPhrase(segment, now);
        if (weekday) {
          dueDate = weekday.date;
          segment = segment.replace(weekday.matched, '').trim();
          if (weekday.recurring) {
            weekdayCycle = 'cycle_week';
            if (weekday.days.length > 1) weekdayDescription = `Días: ${weekday.days.join(', ').replace(/, ([^,]*)$/, ' y $1')}`;
          }
        }
      }
      // Sin fecha propia, «Comprar leche» comparte la de «Comprar pan».
      if (inheritsContext) {
        if (!dueDate && lastCtx.dueDate) dueDate = new Date(lastCtx.dueDate);
        if (!timeString && lastCtx.timeString) timeString = lastCtx.timeString;
        if (!timeOfDay && lastCtx.timeOfDay) timeOfDay = lastCtx.timeOfDay;
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
      cycle = weekdayCycle ?? cycle;

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
          const regex = new RegExp(`(?:\\b(?:en|a|para)\\s+(?:la\\s+)?lista\\s+(?:de\\s+)?)?\\b(${l.name}|@${l.id})\\b`, 'i');
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
      cleanTitle = tidyTitle(cleanTitle);
      const segmentVerb = leadingInfinitive(cleanTitle);

      let modifierDueDate: string | undefined;
      if (dueDate) {
        const d = new Date(dueDate);
        if (timeString) {
          const [h, m] = timeString.split(':').map(Number);
          d.setHours(h, m, 0, 0);
        } else {
          d.setHours(12, 0, 0, 0);
        }
        modifierDueDate = d.toISOString();
      }
      // «…el viernes» o «a las 5» dichos aparte: completan la tarea anterior, no crean otra.
      if (cleanTitle.length < 2 && tasks.length > 0 && (modifierDueDate || timeOfDay || price !== undefined)) {
        const prev = tasks[tasks.length - 1];
        if (modifierDueDate) prev.dueDate = modifierDueDate;
        if (timeOfDay) prev.timeOfDay = timeOfDay;
        if (price !== undefined && prev.price === undefined) prev.price = price;
        continue;
      }

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
          description: weekdayDescription,
          cycle,
          people: finalPeople.length > 0 ? finalPeople : undefined,
          vibe,
          locationName,
          selected: true
        });
        if (segmentVerb) {
          lastVerb = segmentVerb;
          lastCtx = { dueDate: dueDate ? new Date(dueDate) : undefined, timeString, timeOfDay };
        }
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
    } else if (hadCorrectionLikeSegment) {
      reply = 'El extractor local no tiene memoria de lo que acabo de proponer, así que no puedo aplicar ese cambio directamente. Escribe el recordatorio completo de nuevo (p. ej. "Comprar leche mañana a las 11") o configura una clave de Gemini/OpenAI en Ajustes ⚙️ para poder conversar con contexto.';
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
   * Prompt de sistema compartido por Gemini y OpenAI: antes OpenAI tenía uno mucho más pobre
   * (sin las reglas de nueva-tarea-vs-modificación, sin pedir aclaraciones, sin las reglas de
   * precio/frecuencia...), así que su calidad dependía de qué proveedor tuviera configurado
   * el usuario. Con el mismo prompt, ambos entienden las mismas formulaciones igual de bien.
   */
  private static buildSystemInstruction(existingLists: CustomList[], tasksArr: TaskItem[]): string {
    const listNames = existingLists.map(l => `"${l.name}" (id: "${l.id}")`).join(', ');

    // Format up to 60 active non-deleted tasks so the model can cross-reference them accurately
    const activeTasksFormatted = tasksArr
      .filter(t => !t.deleted_at && t.status !== 'completed')
      .slice(0, 60)
      .map(t => {
        const listName = existingLists.find(l => l.id === t.categoryId)?.name || t.categoryId || 'inbox';
        return `- [ID: "${t.id}"] "${t.title}" (Lista: "${listName}", ID Lista: "${t.categoryId || 'inbox'}"${t.price !== undefined ? `, Precio: ${t.price}€` : ''}${t.dueDate ? `, Fecha: ${t.dueDate.slice(0, 10)}` : ''}${t.cycle_id ? `, Ciclo: ${t.cycle_id}` : ''})`;
      })
      .join('\n');

    return `Eres el Asistente IA de Recordatorios Élite (Apple Reminders & Journal companion), sumamente inteligente, analítico, meticuloso y empático.
Tu objetivo es comprender incluso los mensajes más densos, caóticos o enrevesados del usuario, desglosando cada instrucción sin omitir ningún detalle.

Listas existentes del usuario: [${listNames}].

Recordatorios activos actuales del usuario:
${activeTasksFormatted || '(No hay recordatorios activos)'}

REGLAS CRÍTICAS DE COMPRENSIÓN, MODIFICACIÓN Y PREGUNTAS:
1. DISTINCIÓN ENTRE TAREAS NUEVAS vs MODIFICACIÓN / COMPLETAR / BORRAR DE TAREAS EXISTENTES:
   - Si el usuario pide marcar como hecha/completada ("hecha la leche", "completa el informe", "ya pagué el recibo"), borrar/eliminar ("borra la cita del dentista", "elimina la tarea de compras"), cambiar precio ("ponle 2€ a los tomates"), cambiar fecha ("pasa la reunión a mañana") o cambiar de lista una tarea YA EXISTENTE:
     ¡NUNCA crees un recordatorio nuevo en "tasks"!
     Debes incluir la modificación en el array "taskUpdates" con el "taskId" exacto de la lista de tareas activas.
   - Si el usuario pide crear recordatorios nuevos, agrégalos a "tasks".
   - PREVENCIÓN DE DUPLICADOS: Si el usuario menciona crear una tarea pero ya existe en activos para esa misma lista, no crees un duplicado idéntico. En su lugar, avísale en "reply" o propón modificarla.

2. PREGUNTAS Y ACLARACIONES (¡NO DEDUZCAS SIN SABER!):
   - Si el mensaje del usuario es ambiguo, le falta información clave o no está claro a qué lista corresponde (por ejemplo: hay varias listas posibles y no especificó cuál, o pide "cambia la cita" y hay más de una cita, o la fecha es confusa):
     ¡NO deduzcas a ciegas ni te inventes datos!
     Haz preguntas concretas al usuario en "clarificationQuestions" (y redáctalas amablemente en "reply").
     Proporciona opciones directas y clicables en "suggestedReplies" (ej: ["En la lista Compra", "En la lista Casa", "Para hoy a las 18:00"]).
     En este caso, deja "tasks" y "taskUpdates" vacíos mientras esperas la respuesta del usuario.

3. CONSULTAS GENERALES Y CONVERSACIÓN:
   - Si el usuario saluda, da las gracias, pregunta por sus tareas ("¿qué tengo para hoy?", "¿cuánto cuesta la lista de la compra?"), o comparte cómo le ha ido el día:
     Responde cálidamente en "reply". No intentes forzar la creación de tareas vacías.

4. PRECIOS Y FRECUENCIAS:
   - Si se menciona un precio (ej. "leche 1,20 €", "50 euros"), extrae el número en "price" (ej. 1.2 o 50).
   - Para frecuencias, usa EXCLUSIVAMENTE uno de estos 4 identificadores en "cycle":
     "cycle_day", "cycle_week", "cycle_month", "cycle_year".
     ¡ESTÁ PROHIBIDO inventar nuevos ciclos o crear listas llamadas "Semanal", "Mensual", etc.!

5. SI EL USUARIO CUENTA SU DÍA O VIVENCIAS ("Hoy estuve con...", "fui a..."):
   - Sé empático, cercano y cálido.
   - Asigna a la lista "Qué he hecho" (id: "que_he_hecho").
   - Extrae los nombres de personas en "people" y el emoji en "vibe".

DEBES responder SIEMPRE en formato JSON estricto con la siguiente estructura:
{
  "reply": "Respuesta conversacional empática, inteligente y clara",
  "suggestedList": { "name": "NombreSiRecomiendasCrearLista", "color": "#007aff", "icon": "list" }, // opcional
  "clarificationQuestions": ["¿Pregunta de aclaración 1?"], // opcional si falta info o hay ambigüedad
  "suggestedReplies": ["Opción 1 para pulsar", "Opción 2"], // botones sugeridos para responder con un toque
  "taskUpdates": [ // Si el usuario pide editar, completar, cambiar precio o borrar tareas existentes
    {
      "taskId": "ID_EXACTO_DE_LA_TAREA_EXISTENTE",
      "originalTitle": "Título original",
      "newTitle": "Nuevo título si cambia",
      "price": 3.5,
      "status": "completed", // o "pending"
      "deleted": false, // true si pidió eliminarla
      "listId": "id_nueva_lista",
      "dueDate": "ISO 8601 o null",
      "reason": "Explicación de la modificación"
    }
  ],
  "tasks": [ // Solo para tareas NUEVAS
    {
      "title": "Título de la nueva tarea",
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
  }

  /**
   * Gemini API LLM Integration with Multi-Model Fallback & Rich Intent Recognition
   */
  private static async callGemini(
    prompt: string,
    existingLists: CustomList[],
    history: { role: string; text: string }[] = [],
    apiKey: string,
    existingTasks?: Record<string, TaskItem> | TaskItem[]
  ): Promise<ProposedBatch> {
    const tasksArr = existingTasks ? (Array.isArray(existingTasks) ? existingTasks : Object.values(existingTasks)) : [];
    const systemInstruction = this.buildSystemInstruction(existingLists, tasksArr);

    // Prepare conversational history payload (ensuring alternating user/model sequence)
    const contents: any[] = [];
    const recentHistory = history.slice(-8);
    for (const h of recentHistory) {
      const role = h.role === 'assistant' ? 'model' : 'user';
      if (contents.length > 0 && contents[contents.length - 1].role === role) {
        contents[contents.length - 1].parts[0].text += `\n${h.text}`;
      } else {
        contents.push({ role, parts: [{ text: h.text }] });
      }
    }

    const currentTurnText = contents.length === 0 
      ? `${systemInstruction}\n\nInstrucción del usuario:\n${prompt}`
      : prompt;

    if (contents.length === 0 || contents[contents.length - 1].role !== 'user') {
      contents.push({ role: 'user', parts: [{ text: currentTurnText }] });
    } else {
      contents[contents.length - 1].parts[0].text += `\n\n${currentTurnText}`;
    }

    // Multi-model fallback list in order of performance and availability
    const candidateModels = GEMINI_MODELS;
    let lastError: Error | null = null;

    for (const model of candidateModels) {
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), 15000);
      try {
        const res = await geminiRequest(model, apiKey, {
          contents,
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },
          generationConfig: {
            responseMimeType: 'application/json'
          }
        }, timeoutController.signal);

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData?.error?.message || `HTTP ${res.status} ${res.statusText}`;
          console.warn(`Gemini model ${model} failed (HTTP ${res.status}): ${errMsg}`);

          if (res.status === 401 || res.status === 403) {
            // Una clave inválida falla igual con cualquier modelo: no tiene sentido reintentar 6 veces.
            throw Object.assign(new Error(`Clave de API no válida o sin permisos: ${errMsg}`), { fatal: true });
          }

          lastError = new Error(errMsg);
          // Para 404 (modelo no encontrado en la versión), 429 (cuota excedida) o 500/503 (error temporal), intentar el siguiente modelo
          continue;
        }

        const data = await res.json();
        const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!candidateText) throw new Error('Respuesta vacía de Gemini');

        const parsed = JSON.parse(candidateText);
        return {
          reply: parsed.reply || 'Aquí tienes la respuesta:',
          suggestedList: parsed.suggestedList,
          clarificationQuestions: parsed.clarificationQuestions,
          suggestedReplies: parsed.suggestedReplies,
          taskUpdates: (parsed.taskUpdates || []).map((u: any) => ({
            ...u,
            selected: true
          })),
          tasks: (parsed.tasks || []).map((t: any, idx: number) => ({
            ...t,
            id: `gemini_task_${Date.now()}_${idx}`,
            selected: true
          }))
        };
      } catch (err: any) {
        if (err.fatal) throw err;
        lastError = err.name === 'AbortError' ? new Error(`Tiempo de espera agotado con ${model} (15s)`) : err;
        console.warn(`Error attempting Gemini with ${model}:`, lastError?.message);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    throw lastError || new Error('No se pudo comunicar con Google Gemini');
  }

  /**
   * OpenAI API LLM Integration
   */
  private static async callOpenAI(
    prompt: string,
    existingLists: CustomList[],
    history: { role: string; text: string }[],
    apiKey: string,
    existingTasks?: Record<string, TaskItem> | TaskItem[]
  ): Promise<ProposedBatch> {
    const tasksArr = existingTasks ? (Array.isArray(existingTasks) ? existingTasks : Object.values(existingTasks)) : [];
    const systemPrompt = this.buildSystemInstruction(existingLists, tasksArr);

    // OpenAI ya usa 'user'/'assistant' tal cual, a diferencia de Gemini — no hace falta
    // traducir el rol. Antes este historial se recibía pero nunca se usaba: cada turno se
    // mandaba sin memoria de los anteriores, así que una corrección ("¿y si a las 11?") no
    // tenía nada a lo que referirse.
    const historyMessages = history.slice(-8).map(h => ({
      role: h.role === 'assistant' ? 'assistant' as const : 'user' as const,
      content: h.text
    }));

    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), 15000);
    let res: Response;
    try {
      res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        signal: timeoutController.signal,
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            ...historyMessages,
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' }
        })
      });
    } catch (err: any) {
      if (err.name === 'AbortError') throw new Error('Tiempo de espera agotado con OpenAI (15s)');
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errMsg = errData?.error?.message || `HTTP ${res.status} ${res.statusText}`;
      throw new Error(errMsg);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Respuesta vacía de OpenAI');
    const parsed = JSON.parse(content);
    return {
      reply: parsed.reply || 'Aquí tienes tus recordatorios preparados:',
      suggestedList: parsed.suggestedList,
      clarificationQuestions: parsed.clarificationQuestions,
      suggestedReplies: parsed.suggestedReplies,
      taskUpdates: (parsed.taskUpdates || []).map((u: any) => ({
        ...u,
        selected: true
      })),
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

        for (const model of GEMINI_MODELS) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);
          try {
            const res = await geminiRequest(model, config.apiKey, { contents: [{ parts: [{ text: prompt }] }] }, controller.signal);
            if (res.status === 401 || res.status === 403) break; // clave inválida: no insistir con otros modelos
            if (!res.ok) continue;
            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) return text.trim();
          } finally {
            clearTimeout(timeoutId);
          }
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


