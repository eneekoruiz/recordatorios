import type { TaskItem } from '../models/Task';
import { TaskRepository } from '../repositories/TaskRepository';
import { extractPrice } from './priceExtractor';
import { parseNaturalLanguage } from './nlp';

export interface ParseResult {
  tasks: TaskItem[];
  cycles: any[];
  lists: any[];
  listSections?: any[];
}

/**
 * Divide una línea CSV respetando comillas ("valor, con, comas").
 */
function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function detectFormatAndParse(input: string, currentStoreData: { cycles: any[] }): ParseResult {
  const result: ParseResult = { tasks: [], cycles: [], lists: [] };
  const trimmed = input.trim();
  if (!trimmed) return result;

  // 1. JSON (Backup o exportación)
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        result.tasks = parsed;
        return result;
      }
      if (parsed.tasks && typeof parsed.tasks === 'object') {
        result.tasks = Array.isArray(parsed.tasks) ? parsed.tasks : Object.values(parsed.tasks);
      }
      if (parsed.cycles) result.cycles = parsed.cycles;
      if (parsed.lists) result.lists = parsed.lists;
      if (parsed.listSections) result.listSections = parsed.listSections;
      return result;
    } catch (e) {
      console.warn("Fallo al parsear JSON:", e);
      throw new Error("El texto parece JSON pero es inválido o está incompleto.");
    }
  }

  // 2. CSV estructurado (soporta comas, punto y coma -estándar Excel-, y tabuladores)
  const lines = trimmed.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length > 0) {
    const firstLine = lines[0];
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;

    let delimiter = ',';
    if (semicolonCount > commaCount && semicolonCount > tabCount) delimiter = ';';
    else if (tabCount > commaCount && tabCount > semicolonCount) delimiter = '\t';

    const headerCols = parseCsvLine(firstLine.toLowerCase(), delimiter);
    const titleIdx = headerCols.findIndex(h =>
      /^(title|titulo|t[íi]tulo|tarea|recordatorio|nombre|task|name|item|asunto)$/i.test(h) ||
      h.includes('title') || h.includes('título') || h.includes('titulo') || h.includes('tarea') || h.includes('recordatorio')
    );

    if (titleIdx !== -1 && lines.length > 1) {
      const categoryIdx = headerCols.findIndex(h => /^(list|lista|category|categor[íi]a|carpeta|folder)$/i.test(h) || h.includes('list') || h.includes('categ'));
      const dueDateIdx = headerCols.findIndex(h => /^(date|fecha|due|vencimiento|l[íi]mite|plazo|deadline)$/i.test(h) || h.includes('fecha') || h.includes('due'));
      const priceIdx = headerCols.findIndex(h => /^(price|precio|cost|coste|importe|eur|euros)$/i.test(h) || h.includes('precio') || h.includes('cost'));
      const notesIdx = headerCols.findIndex(h => /^(notes?|notas?|descripci[óo]n|description|detalles?)$/i.test(h) || h.includes('nota') || h.includes('desc'));
      const priorityIdx = headerCols.findIndex(h => /^(priority|prioridad)$/i.test(h));

      for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i], delimiter);
        const title = cols[titleIdx]?.trim();
        if (!title) continue;

        let categoryId = 'inbox';
        if (categoryIdx !== -1 && cols[categoryIdx]) {
          categoryId = cols[categoryIdx].trim().toLowerCase().replace(/[@#]/g, '');
        }

        let dueDate: string | undefined = undefined;
        if (dueDateIdx !== -1 && cols[dueDateIdx]) {
          const parsedDate = new Date(cols[dueDateIdx].trim());
          if (!isNaN(parsedDate.getTime())) {
            dueDate = parsedDate.toISOString();
          }
        }

        let price: number | undefined = undefined;
        if (priceIdx !== -1 && cols[priceIdx]) {
          const rawPrice = cols[priceIdx].replace(/[^\d.,]/g, '').replace(',', '.');
          const p = parseFloat(rawPrice);
          if (!isNaN(p) && p > 0) price = p;
        }

        let description: string | undefined = undefined;
        if (notesIdx !== -1 && cols[notesIdx]) {
          description = cols[notesIdx].trim();
        }

        let priority: 'none' | 'low' | 'medium' | 'high' | undefined = undefined;
        if (priorityIdx !== -1 && cols[priorityIdx]) {
          const pVal = cols[priorityIdx].toLowerCase();
          if (pVal.includes('alt') || pVal.includes('high') || pVal.includes('urg')) priority = 'high';
          else if (pVal.includes('med')) priority = 'medium';
          else if (pVal.includes('baj') || pVal.includes('low')) priority = 'low';
        }

        result.tasks.push(TaskRepository.create({
          title,
          description,
          type: 'task',
          categoryId: categoryId || 'inbox',
          dueDate,
          price,
          priority,
          alerts: [],
          blockedBy: []
        }));
      }

      if (result.tasks.length > 0) {
        return result;
      }
    }
  }

  // 3. Texto Plano / Documento Libre / Markdown / PDF
  lines.forEach(line => {
    let title = line.trim();
    if (!title || title.startsWith('//')) return;

    // Ignorar líneas que solo son números de página (típico de PDFs) o separadores
    if (/^(p[áa]gina|page)?\s*\d+\s*(de\s*\d+|\/\s*\d+)?$/i.test(title)) return;
    if (/^[-=_*]{3,}$/.test(title)) return;

    // Limpiar viñetas comunes de listas (Markdown, listas de Word, viñetas de PDF)
    title = title.replace(/^[-*•]\s+\[[ xX]\]\s+/, ''); // Checkbox: - [ ] o - [x]
    title = title.replace(/^[-*•+–—]\s+/, '');          // Viñetas: -, *, •, +, etc.
    title = title.replace(/^\d+[.)]\s+/, '');           // Numeraciones: 1., 2), 3.

    if (!title || title.length < 2) return;

    let categoryId = 'inbox';
    let cycle_id: string | undefined = undefined;
    const alerts: import('../models/Task').AlertDef[] = [];

    // Detectar lista explícita con @ o [Lista]
    const catMatch = title.match(/@([a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9_]+)/) || title.match(/\[([a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9_\s]+)\]/);
    if (catMatch) {
      categoryId = (catMatch[1] || '').trim().toLowerCase();
      title = title.replace(catMatch[0], '').trim();
    }

    // Detectar ciclo o frecuencia con #
    const cycleMatch = title.match(/#([a-zA-ZáéíóúÁÉÍÓÚñÑüÜ0-9_]+)/);
    if (cycleMatch) {
      const rawCycle = cycleMatch[1];
      title = title.replace(`#${rawCycle}`, '').trim();

      const existing = currentStoreData.cycles.find(c => (c.name || '').toLowerCase() === (rawCycle || '').toLowerCase());
      if (existing) {
        cycle_id = existing.id;
      } else {
        const newCycleId = `cycle_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        result.cycles.push({
          id: newCycleId,
          name: rawCycle,
          daysValue: 14,
          isPinned: true,
          icon: 'sparkles'
        });
        cycle_id = newCycleId;
      }
    }

    // Extracción de precio con extractPrice
    let price: number | undefined = undefined;
    const priceRes = extractPrice(title, false);
    if (priceRes && priceRes.price > 0) {
      price = priceRes.price;
      title = priceRes.cleanText || title;
    }

    // Procesamiento de lenguaje natural (horas, fechas, prioridades)
    const nlp = parseNaturalLanguage(title);
    if (nlp.times.length > 0) {
      nlp.times.forEach(t => {
        alerts.push({ id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, type: 'at_time', time: t });
      });
    }

    const dueDate = nlp.suggestedDueDate ? nlp.suggestedDueDate.toISOString() : undefined;
    const priority = nlp.suggestedPriority !== 'none' ? nlp.suggestedPriority : undefined;
    if (nlp.suggestedCategory && categoryId === 'inbox') {
      categoryId = nlp.suggestedCategory;
    }
    if (nlp.suggestedCycleId && !cycle_id) {
      cycle_id = nlp.suggestedCycleId;
    }

    const cleanTitle = nlp.cleanTitle.trim() || title;

    if (cleanTitle) {
      result.tasks.push(TaskRepository.create({
        title: cleanTitle,
        type: 'task',
        categoryId,
        cycle_id,
        dueDate,
        price,
        priority,
        alerts,
        blockedBy: []
      }));
    }
  });

  return result;
}
