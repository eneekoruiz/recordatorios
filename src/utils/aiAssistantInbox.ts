/**
 * Buzón de peticiones para el asistente de IA.
 *
 * El asistente se carga en diferido: la primera vez que se abre, el evento «open-ai-assistant»
 * llega antes de que exista quien lo escuche y el texto se perdía. La petición se deja aquí y el
 * asistente la recoge al montarse (o al recibir el evento, si ya estaba montado). Quien la
 * recoge primero la vacía, así que nunca se procesa dos veces.
 */
import type { ProposedBatch } from '../services/AIService';

export interface AssistantRequest {
  /** Lo que escribió la persona. */
  text: string;
  /** Respuesta ya calculada (p. ej. desde la barra rápida): se muestra sin volver a preguntar a la IA. */
  batch?: ProposedBatch;
}

let pending: AssistantRequest | null = null;

export function sendToAssistant(request: AssistantRequest): void {
  pending = request;
  window.dispatchEvent(new CustomEvent('open-ai-assistant', { detail: request.text }));
}

export function takeAssistantRequest(): AssistantRequest | null {
  const request = pending;
  pending = null;
  return request;
}
