import { z } from 'zod';
import type { CustomCycle, CustomList, ListSection, TaskItem } from '../models/Task';

export interface ValidatedImport {
  tasks: TaskItem[];
  cycles: CustomCycle[];
  lists: CustomList[];
  listSections: ListSection[];
}

// Import is an untrusted boundary. Validate the entire batch before any store write,
// and strip unknown fields rather than copying arbitrary objects into persisted state.
const id = z.string().min(1).max(200).refine(value => !['__proto__', 'constructor', 'prototype'].includes(value));
const optional = <T extends z.ZodType>(schema: T) => z.preprocess(value => (value === null || value === '') ? undefined : value, schema.optional());
const text = optional(z.string());
const reference = z.preprocess(value => (value === null || value === undefined || value === '') ? undefined : value, id.optional());
const number = optional(z.number().finite());
const nonnegative = optional(z.number().finite().nonnegative());
const flag = optional(z.boolean());
const date = z.preprocess(value => {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const time = new Date(trimmed).getTime();
    if (Number.isFinite(time)) return trimmed;
  }
  return value;
}, z.string().refine(value => value.length > 0 && Number.isFinite(new Date(value).getTime()), 'Fecha inválida').optional());
const timestamp = date;
const historyArray = z.preprocess(value => {
  if (value === null || value === undefined || value === '') return undefined;
  if (!Array.isArray(value)) return value;
  return value
    .map(item => {
      if (typeof item === 'number' && Number.isFinite(item) && item >= 0) return item;
      if (typeof item === 'string') {
        const num = Number(item);
        if (Number.isFinite(num) && num >= 0) return num;
        const dt = new Date(item).getTime();
        if (Number.isFinite(dt) && dt >= 0) return dt;
      }
      return null;
    })
    .filter((item): item is number => item !== null);
}, optional(z.array(z.number().finite().nonnegative())));
const syncFields = {
  created_at: timestamp, updated_at: timestamp, deleted_at: timestamp,
  version: optional(z.number().int().nonnegative()), _is_dirty: flag,
};
const alertSchema = z.object({
  id: z.preprocess(value => (value === null || value === undefined || value === '') ? crypto.randomUUID() : value, id),
  type: z.enum(['at_time', 'before']),
  time: z.preprocess(value => (value === null || value === undefined || value === '') ? undefined : value, optional(z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/))),
  offsetMinutes: nonnegative, label: text,
}).refine(alert => alert.type === 'at_time' ? !!alert.time : alert.offsetMinutes !== undefined, 'Alerta incompleta');
const taskSchema = z.object({
  id: id.optional(), user_id: text,
  title: z.string().trim().min(1, 'El título no puede estar vacío'),
  type: z.enum(['task', 'log']).default('task'),
  status: z.enum(['pending', 'in_progress', 'completed']).default('pending'),
  description: text, notes: text, categoryId: reference, listId: reference,
  parentId: reference, sectionId: reference, cycle_id: reference, order: number,
  blockedBy: z.preprocess(val => Array.isArray(val) ? val.filter(item => typeof item === 'string' && item.length > 0) : val, optional(z.array(id))),
  dueDate: timestamp, completed_at: timestamp,
  alerts: optional(z.array(alertSchema)),
  completedAlerts: z.preprocess(val => Array.isArray(val) ? val.filter(item => typeof item === 'string' && item.length > 0) : val, optional(z.array(id))),
  completionHistory: historyArray,
  skipHistory: historyArray,
  consecutiveSkipCount: optional(z.number().int().nonnegative()),
  priority: optional(z.enum(['none', 'low', 'medium', 'high'])),
  flagged: flag, url: text, image: text, timeOfDay: optional(z.enum(['morning', 'afternoon', 'night'])),
  duration: nonnegative, disableDuration: flag, isParallel: flag, parallelDuration: nonnegative,
  targetCount: optional(z.number().int().nonnegative()), currentCount: optional(z.number().int().nonnegative()),
  isDetailed: flag, price: nonnegative, quantity: nonnegative, brand: text,
  location: optional(z.object({
    lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180),
    radius: z.number().finite().nonnegative(), address: z.string(),
  })),
  locationName: text, people: optional(z.array(z.string())),
  expirationType: optional(z.enum(['card', 'subscription', 'other'])), issuerMask: text,
  autoRollover: flag, subscriptionPeriod: optional(z.enum(['monthly', 'yearly'])), managementUrl: text, vibe: text,
  executionHistory: historyArray,
  suggestedDuration: nonnegative, postponeCount: nonnegative,
  mediaType: optional(z.enum(['series', 'movie', 'book', 'music', 'podcast', 'other'])),
  mediaStatus: optional(z.enum(['want_to_watch', 'in_progress', 'completed', 'dropped', 'favorite'])),
  mediaRating: optional(z.number().min(1).max(5)), mediaPlatform: text, mediaSeasonEpisode: text,
  mediaNotes: text, mediaRecommendedBy: text, googleCalendarUrl: text, gmailQuery: text, gmailThreadId: text, notionPageUrl: text,
  ...syncFields,
});
const cycleSchema = z.object({
  id, name: z.string().trim().min(1), daysValue: z.number().finite().positive(),
  isPinned: z.boolean().default(false), icon: z.string().default('sparkles'),
  color: text, recurrence_rule: text, ...syncFields,
});
const listSchema = z.object({
  id, name: z.string().trim().min(1), color: z.string().default('#007aff'), parentId: reference, icon: text,
  isFinancial: flag, showCompleted: flag, isPinned: flag, isFolder: flag,
  listType: optional(z.enum(['routines', 'simple', 'events', 'goals', 'caducidades', 'que_he_hecho', 'library'])),
  autoEstimateDuration: flag, specialType: optional(z.enum(['caducidades', 'que_he_hecho'])),
  isShared: flag, order: number, ...syncFields,
});
const sectionSchema = z.object({ id, listId: id, name: z.string().trim().min(1), parentId: reference, order: number, ...syncFields });

function collection<T>(value: unknown, schema: z.ZodType<T>, label: string): T[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`${label}: se esperaba una lista de elementos.`);
  const seen = new Set<string>();
  return value.map((item, index) => {
    const result = schema.safeParse(item);
    if (!result.success) {
      const issue = result.error.issues[0];
      throw new Error(`${label}, elemento ${index + 1}: campo ${issue.path.join('.') || 'elemento'} inválido. Revisa el archivo antes de importar.`);
    }
    const itemId = (result.data as { id?: string }).id;
    if (itemId && seen.has(itemId)) throw new Error(`${label}: hay identificadores duplicados.`);
    if (itemId) seen.add(itemId);
    return result.data;
  });
}

export function validateJsonImport(input: unknown): ValidatedImport {
  if (!input || typeof input !== 'object') throw new Error('La copia JSON debe contener tareas o una copia de seguridad.');
  const backup = Array.isArray(input) ? { tasks: input } : input as Record<string, unknown>;
  if (!['tasks', 'cycles', 'lists', 'listSections'].some(key => Object.hasOwn(backup, key))) {
    throw new Error('El JSON no contiene tareas, listas ni frecuencias reconocibles.');
  }
  let rawTasks = backup.tasks;
  if (rawTasks && typeof rawTasks === 'object' && !Array.isArray(rawTasks)) {
    rawTasks = Object.entries(rawTasks).map(([key, value]) => {
      if (!id.safeParse(key).success || !value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Tareas: identificador o elemento inválido.');
      }
      const task = value as Record<string, unknown>;
      if (task.id !== undefined && task.id !== key) throw new Error('Tareas: el identificador no coincide con la clave de la copia.');
      return { ...task, id: key };
    });
  }
  const now = new Date().toISOString();
  const tasks = collection(rawTasks, taskSchema, 'Tareas').map(task => ({
    ...task, id: task.id || crypto.randomUUID(), user_id: '',
    categoryId: task.categoryId || task.listId || 'inbox',
    description: task.description ?? task.notes,
    created_at: task.created_at || now, updated_at: task.updated_at || now, version: task.version ?? 1,
    _is_dirty: true,
  })) as TaskItem[];
  return {
    tasks,
    cycles: collection(backup.cycles, cycleSchema, 'Frecuencias') as CustomCycle[],
    lists: collection(backup.lists, listSchema, 'Listas') as CustomList[],
    listSections: collection(backup.listSections, sectionSchema, 'Secciones') as ListSection[],
  };
}
