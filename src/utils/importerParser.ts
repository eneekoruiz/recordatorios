import type { TaskItem } from '../models/Task';
import { TaskRepository } from '../repositories/TaskRepository';

export interface ParseResult {
  tasks: TaskItem[];
  cycles: any[];
  lists: any[];
  listSections?: any[];
}

export function detectFormatAndParse(input: string, currentStoreData: { cycles: any[] }): ParseResult {
  const result: ParseResult = { tasks: [], cycles: [], lists: [] };
  const trimmed = input.trim();

  // 1. JSON (Backup)
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
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

  // 2. CSV (básico)
  if (trimmed.includes(',') && trimmed.split('\n')[0].toLowerCase().includes('title')) {
    const lines = trimmed.split('\n');
    const headers = lines[0].toLowerCase().split(',');
    const titleIdx = headers.findIndex(h => h.includes('title'));
    if (titleIdx !== -1) {
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const columns = lines[i].split(',');
        const title = columns[titleIdx]?.trim();
        if (title) {
          result.tasks.push(TaskRepository.create({
            title,
            type: 'task',
            categoryId: 'inbox',
            cycle_id: undefined,
            dueDate: new Date().toISOString(),
            alerts: [],
            blockedBy: []
          }));
        }
      }
      return result;
    }
  }

  // 3. Texto Plano (Brain Dump)
  const lines = trimmed.split('\n');
  lines.forEach(line => {
    let title = line.trim();
    if (!title || title.startsWith('//')) return;

    let categoryId = 'inbox';
    let cycle_id: string | undefined = undefined;
    const alerts: import('../models/Task').AlertDef[] = [];

    // Parse category @
    const catMatch = title.match(/@(\w+)/);
    if (catMatch) {
      categoryId = catMatch[1].toLowerCase();
      title = title.replace(`@${catMatch[1]}`, '').trim();
    }

    // Parse cycle #
    const cycleMatch = title.match(/#(\w+)/);
    if (cycleMatch) {
      const rawCycle = cycleMatch[1];
      title = title.replace(`#${rawCycle}`, '').trim();
      
      const existing = currentStoreData.cycles.find(c => c.name.toLowerCase() === rawCycle.toLowerCase());
      if (existing) {
        cycle_id = existing.id;
      } else {
        const newCycleId = `cycle_${Date.now()}_${Math.random()}`;
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

    // Basic time NLP
    const timeRegex = /\b([0-1]?[0-9]|2[0-3])(:[0-5][0-9])?\s*(am|pm|h)\b/i;
    const timeMatch = title.match(timeRegex);
    if (timeMatch) {
      alerts.push({ id: `alert_${Date.now()}_${Math.random()}`, type: 'at_time', time: timeMatch[0] });
      title = title.replace(timeMatch[0], '').trim();
    }

    if (title) {
      result.tasks.push(TaskRepository.create({
        title,
        type: 'task',
        categoryId,
        cycle_id,
        dueDate: new Date().toString().toString(),
        alerts,
        blockedBy: []
      }));
    }
  });

  return result;
}
