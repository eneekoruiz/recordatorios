import type { AlertDef } from '../models/Task';
import { parseNaturalLanguage } from './nlp';

export interface TaskDraft {
  title: string;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high';
  price?: number;
  cycle_id?: string;
  alerts?: AlertDef[];
}

/**
 * Convierte lo que se escribe al añadir un recordatorio en los datos de la tarea, con el mismo
 * motor que la barra inferior (utils/nlp): fecha, hora (alerta), prioridad (!alta), ciclo
 * (#semanal), precio… y sin dejar «mañana a las 10:00» dentro del título.
 */
export function draftFromText(raw: string): TaskDraft {
  const text = raw.trim();
  const nlp = parseNaturalLanguage(text);
  const alerts: AlertDef[] = nlp.times.map((t) => ({ id: `alert_${Date.now()}_${t}`, type: 'at_time' as const, time: t }));
  return {
    title: nlp.cleanTitle || text,
    dueDate: nlp.suggestedDueDate ? nlp.suggestedDueDate.toISOString() : undefined,
    priority: nlp.suggestedPriority && nlp.suggestedPriority !== 'none' ? nlp.suggestedPriority : undefined,
    price: nlp.suggestedPrice !== undefined && nlp.suggestedPrice > 0 ? nlp.suggestedPrice : undefined,
    cycle_id: nlp.suggestedCycleId,
    alerts: alerts.length > 0 ? alerts : undefined,
  };
}
