import type { TaskItem } from '../models/Task';
import { TaskRepository } from '../repositories/TaskRepository';
import { extractPrice } from './priceExtractor';
import { parseNaturalLanguage } from './nlp';
import { validateJsonImport } from './importValidation';

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

/** Logical records: a quoted field may contain newlines and escaped quotes. */
function parseCsvRows(input: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  const field = () => { row.push(value.trim()); value = ''; };
  const record = () => { field(); if (row.some(cell => cell.length > 0)) rows.push(row); row = []; };
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) field();
    else if ((char === '\n' || char === '\r') && !quoted) {
      record();
      if (char === '\r' && input[i + 1] === '\n') i++;
    } else value += char;
  }
  if (quoted) throw new Error('El CSV contiene un campo con comillas sin cerrar.');
  record();
  return rows;
}

function csvDate(value: string, row: number): string {
  const calendar = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  const isoDay = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (calendar || isoDay) {
    const year = Number(calendar ? calendar[3] : isoDay![1]);
    const month = Number(calendar ? calendar[2] : isoDay![2]);
    const day = Number(calendar ? calendar[1] : isoDay![3]);
    const parsed = new Date(year, month - 1, day);
    if (parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day) return parsed.toISOString();
  } else if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }
  throw new Error(`CSV, fila ${row}: fecha inválida. Usa DD/MM/AAAA o una fecha ISO.`);
}

function csvPrice(value: string, row: number): number {
  const clean = value.replace(/[€$£]|\b(?:EUR|USD|GBP|euros?)\b/gi, '').replace(/\s/g, '');
  let normalized = clean;
  if (clean.includes(',') && clean.includes('.')) {
    const decimal = clean.lastIndexOf(',') > clean.lastIndexOf('.') ? ',' : '.';
    const group = decimal === ',' ? '.' : ',';
    const pattern = decimal === ',' ? /^\d{1,3}(?:\.\d{3})+,\d{1,2}$/ : /^\d{1,3}(?:,\d{3})+\.\d{1,2}$/;
    if (!pattern.test(clean)) throw new Error(`CSV, fila ${row}: importe inválido.`);
    normalized = clean.split(group).join('').replace(decimal, '.');
  } else if (/^\d{1,3}(?:[.,]\d{3})+$/.test(clean)) normalized = clean.replace(/[.,]/g, '');
  else if (/^\d+(?:[.,]\d{1,2})?$/.test(clean)) normalized = clean.replace(',', '.');
  else throw new Error(`CSV, fila ${row}: importe inválido.`);
  const price = Number(normalized);
  if (!Number.isFinite(price)) throw new Error(`CSV, fila ${row}: importe fuera de rango.`);
  return price;
}

export function detectFormatAndParse(input: string, currentStoreData: { cycles: any[] }): ParseResult {
  const result: ParseResult = { tasks: [], cycles: [], lists: [] };
  const trimmed = input.trim();
  if (!trimmed) return result;

  // 1. JSON (Backup o exportación)
  if (trimmed.startsWith('{') || /^\[\s*(?:[{["\d\-\]]|true\b|false\b|null\b)/.test(trimmed)) {
    let parsed: unknown;
    try { parsed = JSON.parse(trimmed); }
    catch { throw new Error('El texto parece JSON pero es inválido o está incompleto.'); }
    return validateJsonImport(parsed);
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

    if (titleIdx !== -1) {
      const records = parseCsvRows(trimmed, delimiter);
      const categoryIdx = headerCols.findIndex(h => /^(list|lista|category|categor[íi]a|carpeta|folder)$/i.test(h) || h.includes('list') || h.includes('categ'));
      const dueDateIdx = headerCols.findIndex(h => /^(date|fecha|due|vencimiento|l[íi]mite|plazo|deadline)$/i.test(h) || h.includes('fecha') || h.includes('due'));
      const priceIdx = headerCols.findIndex(h => /^(price|precio|cost|coste|importe|eur|euros)$/i.test(h) || h.includes('precio') || h.includes('cost'));
      const notesIdx = headerCols.findIndex(h => /^(notes?|notas?|descripci[óo]n|description|detalles?)$/i.test(h) || h.includes('nota') || h.includes('desc'));
      const priorityIdx = headerCols.findIndex(h => /^(priority|prioridad)$/i.test(h));
      const statusIdx = headerCols.findIndex(h => /^(status|estado)$/i.test(h));
      const durationIdx = headerCols.findIndex(h => /^duraci[óo]n \(seg\)$|^duration$/i.test(h));

      for (let i = 1; i < records.length; i++) {
        const cols = records[i];
        const title = cols[titleIdx]?.trim();
        if (!title) throw new Error(`CSV, fila ${i + 1}: falta el título.`);

        let categoryId = 'inbox';
        if (categoryIdx !== -1 && cols[categoryIdx]) {
          categoryId = cols[categoryIdx].trim().toLowerCase().replace(/[@#]/g, '');
        }

        let dueDate: string | undefined = undefined;
        if (dueDateIdx !== -1 && cols[dueDateIdx]) {
          dueDate = csvDate(cols[dueDateIdx].trim(), i + 1);
        }

        let price: number | undefined = undefined;
        if (priceIdx !== -1 && cols[priceIdx]) {
          price = csvPrice(cols[priceIdx], i + 1);
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

        let status: TaskItem['status'] = 'pending';
        if (statusIdx !== -1 && cols[statusIdx]) {
          const value = cols[statusIdx].toLowerCase();
          if (['completado', 'completed', 'done'].includes(value)) status = 'completed';
          else if (['in_progress', 'en curso'].includes(value)) status = 'in_progress';
          else if (!['pendiente', 'pending', 'todo'].includes(value)) throw new Error(`CSV, fila ${i + 1}: estado inválido.`);
        }
        let duration: number | undefined;
        if (durationIdx !== -1 && cols[durationIdx]) {
          duration = Number(cols[durationIdx].replace(',', '.'));
          if (!Number.isFinite(duration) || duration < 0) throw new Error(`CSV, fila ${i + 1}: duración inválida.`);
        }

        result.tasks.push(TaskRepository.create({
          title,
          description,
          type: 'task',
          categoryId: categoryId || 'inbox',
          dueDate,
          price,
          priority,
          status,
          duration,
          alerts: [],
          blockedBy: []
        }));
      }

      return result;
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

      const existing = [...currentStoreData.cycles, ...result.cycles].find(c => !c.deleted_at && (c.name || '').toLowerCase() === (rawCycle || '').toLowerCase());
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
