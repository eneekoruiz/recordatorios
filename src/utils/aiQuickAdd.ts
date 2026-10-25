/**
 * Piezas puras para que la barra «Nuevo recordatorio» hable con la IA:
 * decidir si lo escrito es una conversación (pregunta, cambio) o algo que apuntar, convertir la
 * respuesta de la IA en recordatorios y redactar la confirmación.
 */
import type { CustomList, TaskItem } from '../models/Task';
import type { ProposedBatch, ProposedTask } from '../services/AIService';

/** Preguntas («¿Qué tengo hoy?», «cuándo era la ITV») van al chat: no son recordatorios. */
export function isConversationalRequest(text: string): boolean {
  const t = (text || '').trim();
  if (!t) return false;
  if (/^[¿?]/.test(t) || /\?\s*$/.test(t)) return true;
  return /^(qu[eé]|cu[aá]ndo|cu[aá]nt[oa]s?|c[oó]mo|d[oó]nde|por qu[eé]|qui[eé]n)\s/i.test(t);
}

/** Se puede crear sin preguntar: hay algo que apuntar y nada que aclarar, cambiar o agrupar. */
export function canAutoApply(batch: ProposedBatch | null | undefined): boolean {
  if (!batch) return false;
  const selected = batch.tasks.filter(t => t.selected !== false);
  return selected.length > 0
    && !(batch.clarificationQuestions && batch.clarificationQuestions.length > 0)
    && !(batch.taskUpdates && batch.taskUpdates.length > 0)
    && !batch.action;
}

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export interface BuildFromBatchOptions {
  /** Lista de la vista actual: manda salvo que el texto nombre otra lista. */
  defaultListId?: string;
  /** Si la IA no da una lista válida y no hay lista por defecto. */
  fallbackListId?: string;
  /** Texto original, para saber si nombra una lista. */
  sourceText?: string;
  /** Valores de la vista si la IA no los da (fecha de Hoy/Calendario, frecuencia de la vista). */
  defaultDueDate?: string;
  defaultCycleId?: string;
  now?: Date;
  newListId?: () => string;
}

/**
 * Convierte lo que propone la IA en recordatorios listos para `addTasksBatch`.
 * Es la misma conversión que hace el chat al pulsar «Importar», compartida con la barra.
 */
export function buildTasksFromBatch(
  batch: ProposedBatch,
  lists: CustomList[],
  options: BuildFromBatchOptions = {}
): { tasks: Partial<TaskItem>[]; createList?: CustomList } {
  const selectedTasks = batch.tasks.filter((t: ProposedTask) => t.selected !== false);
  const now = options.now || new Date();

  let createList: CustomList | undefined;
  if (batch.suggestedList) {
    const suggestedName = batch.suggestedList.name || '';
    const existing = lists.find(l => norm(l.name) === norm(suggestedName));
    if (!existing) {
      createList = {
        id: options.newListId ? options.newListId() : `list_${now.getTime()}`,
        name: batch.suggestedList.name,
        color: batch.suggestedList.color || '#007aff',
        icon: batch.suggestedList.icon || 'list',
      } as CustomList;
    }
  }

  const textNorm = norm(options.sourceText || '');
  const listIsNamedInText = (listId?: string) => {
    if (!listId || !textNorm) return false;
    const list = lists.find(l => l.id === listId);
    return Boolean(list && list.name && textNorm.includes(norm(list.name)));
  };
  const fallback = options.fallbackListId || lists[0]?.id || 'inbox';

  const tasks = selectedTasks.map((t) => {
    let categoryId = t.listId;
    if (t.listId === 'que_he_hecho' || t.listId === 'caducidades') {
      categoryId = t.listId;
    } else if (createList) {
      categoryId = createList.id;
    } else if (options.defaultListId && !listIsNamedInText(t.listId)) {
      categoryId = options.defaultListId;
    } else if (!categoryId || !lists.some(l => l.id === categoryId)) {
      categoryId = fallback;
    }

    return {
      id: crypto.randomUUID(),
      title: t.title,
      description: t.description,
      categoryId,
      sectionId: t.sectionId,
      dueDate: t.dueDate || options.defaultDueDate,
      timeOfDay: t.timeOfDay,
      alerts: t.alerts,
      price: t.price,
      quantity: t.quantity,
      targetCount: t.targetCount,
      currentCount: t.currentCount || 0,
      priority: t.priority || 'none',
      cycle_id: t.cycle || options.defaultCycleId,
      people: t.people,
      vibe: t.vibe,
      locationName: t.locationName,
      mediaType: t.mediaType,
      mediaStatus: t.mediaStatus,
      status: 'pending' as const,
      created_at: now.toISOString(),
    } as Partial<TaskItem>;
  });

  return { tasks, createList };
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** «hoy», «mañana» o «vie 16 oct». */
export function describeDay(iso?: string, now: Date = new Date()): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  if (sameDay(d, now)) return 'hoy';
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (sameDay(d, tomorrow)) return 'mañana';
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * La respuesta de la IA en una línea: qué se ha apuntado y dónde.
 * «Apuntado «Comprar pan» en Compras · mañana» / «Apuntados 3 recordatorios en Compras».
 */
export function summarizeCreated(created: Partial<TaskItem>[], lists: CustomList[], now: Date = new Date()): string {
  if (created.length === 0) return 'Ya lo tenías apuntado.';
  const listNames = Array.from(new Set(created.map(t => lists.find(l => l.id === t.categoryId)?.name || 'Bandeja de entrada')));
  const where = listNames.length === 1 ? ` en ${listNames[0]}` : '';
  if (created.length === 1) {
    const t = created[0];
    const parts = [`Apuntado «${t.title}»${where}`];
    const day = describeDay(t.dueDate, now);
    if (day) parts.push(day);
    if (t.cycle_id) {
      const freq: Record<string, string> = { cycle_day: 'cada día', cycle_week: 'cada semana', cycle_month: 'cada mes', cycle_year: 'cada año' };
      if (freq[t.cycle_id]) parts.push(freq[t.cycle_id]);
    }
    return parts.join(' · ');
  }
  return `Apuntados ${created.length} recordatorios${where}`;
}

/** Quita el marcado (negritas, avisos entre corchetes) para mostrar la respuesta en una burbuja. */
export function plainReply(reply?: string): string {
  return (reply || '')
    .replace(/[*_`#>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
