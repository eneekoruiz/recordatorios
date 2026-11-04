import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

/** Verify the original HTTP bytes before JSON parsing; never stringify a parsed body for this. */
export function verifyWhatsAppSignature(raw: Buffer, signature: string | undefined, appSecret: string): boolean {
  if (!appSecret || !signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  return timingSafeEqual(Buffer.from(signature.slice(7), 'hex'), createHmac('sha256', appSecret).update(raw).digest());
}

export function whatsAppChallenge(query: Record<string, unknown>, verifyToken: string): string | null {
  const parsed = z.object({ 'hub.mode': z.literal('subscribe'), 'hub.verify_token': z.string(), 'hub.challenge': z.string().min(1).max(256) }).safeParse(query);
  if (!verifyToken || !parsed.success) return null;
  const given = createHmac('sha256', verifyToken).update(parsed.data['hub.verify_token']).digest();
  const expected = createHmac('sha256', verifyToken).update(verifyToken).digest();
  return timingSafeEqual(given, expected) ? parsed.data['hub.challenge'] : null;
}

/** Telegram owner identity must come from a private provider update, never from message text. */
export function telegramPrivateActor(update: unknown): { subject: string; eventId: string; text: string } | null {
  const id = z.number().int().positive().refine(Number.isSafeInteger);
  const parsed = z.object({ update_id: z.number().int().nonnegative().refine(Number.isSafeInteger), message: z.object({ from: z.object({ id, is_bot: z.literal(false) }), chat: z.object({ id, type: z.literal('private') }), text: z.string().min(1).max(4096) }) }).safeParse(update);
  if (!parsed.success || parsed.data.message.from.id !== parsed.data.message.chat.id) return null;
  return { subject: String(parsed.data.message.from.id), eventId: String(parsed.data.update_id), text: parsed.data.message.text };
}
