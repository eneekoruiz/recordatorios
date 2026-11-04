import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { createApp } from '../../server/app.js';
import { telegramPrivateActor, verifyWhatsAppSignature, whatsAppChallenge } from '../../server/channelTransport.js';
import { createMemoryPrisma } from '../support/memoryPrisma.js';

const secret = 'channel-test-session-secret-at-least32';
const bridge = 'bridge-test-only-at-least32-characters';
let server, base, prisma;
const request = (path, body, owner = 'alice', method = 'POST') => fetch(base + '/api/' + path, {
  method, headers: { 'Content-Type': 'application/json', ...(owner ? { Authorization: `Bearer ${owner === 'bridge' ? bridge : jwt.sign({ id: owner, email: `${owner}@example.com`, sv: 0 }, secret)}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const startLink = async (owner = 'alice', channel = 'telegram') => (await request(`channels/${channel}/link`, {}, owner)).json();
const redeem = (code, subject = '123') => request('channel-bridge/telegram/redeem', { code, subject }, 'bridge');
const write = (eventId = 'event1', subject = '123', text = 'Leche') => request('channel-bridge/telegram/operations', { subject, eventId, operation: 'write', payload: { mutations: [{ id: 'from-channel', expectedVersion: null, patch: { text } }] } }, 'bridge');
beforeEach(async () => {
  vi.stubEnv('JWT_SECRET', secret); vi.stubEnv('TELEGRAM_BRIDGE_SECRET', bridge); vi.stubEnv('WHATSAPP_BRIDGE_SECRET', '');
  prisma = createMemoryPrisma();
  for (const id of ['alice', 'bob']) await prisma.user.create({ data: { id, email: `${id}@example.com`, password: 'unused' } });
  await new Promise((resolve) => { server = createApp({ prisma, pushSender: null }).listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(() => { server.closeAllConnections?.(); server.close(); vi.unstubAllEnvs(); });

describe('channel identity and shared task operations', () => {
  it('requires JWT, independent configured service credentials and a single-use code', async () => {
    expect((await request('channels/telegram/link', {}, null)).status).toBe(401);
    expect((await request('channels/whatsapp/link', {})).status).toBe(503);
    const { code } = await startLink();
    expect((await request('channel-bridge/telegram/redeem', { code, subject: '123' })).status).toBe(401);
    expect((await redeem(code)).status).toBe(200);
    expect((await redeem(code, '456')).status).toBe(403);
    expect(JSON.stringify(prisma._stores.channelLinks.rows)).not.toContain(code);
  });
  it('expires challenges and consumes concurrent redeem only once', async () => {
    const expired = await startLink();
    prisma._stores.channelLinks.rows[0].challengeExpiresAt = new Date(0);
    expect((await redeem(expired.code)).status).toBe(403);
    const fresh = await startLink();
    const responses = await Promise.all([redeem(fresh.code), redeem(fresh.code, '456')]);
    expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
    expect(responses.filter((response) => [403, 409].includes(response.status))).toHaveLength(1);
  });
  it('isolates accounts and rejects a supplied account id or unknown actor', async () => {
    await redeem((await startLink()).code);
    expect((await redeem((await startLink('bob')).code)).status).toBe(409);
    expect((await request('channel-bridge/telegram/operations', { subject: '123', userId: 'bob', eventId: 'x', operation: 'read' }, 'bridge')).status).toBe(400);
    expect((await write('unknown', '999')).status).toBe(403);
    expect((await write()).status).toBe(200);
    expect(prisma._stores.tasks.rows[0].userId).toBe('alice');
    const data = await (await request('channel-bridge/telegram/operations', { subject: '123', eventId: 'read1', operation: 'read' }, 'bridge')).json();
    expect(data.accountId).toBe('alice'); expect(data.tasks).toHaveLength(1);
  });
  it('reuses task validation, versions and completion without wider permissions', async () => {
    await redeem((await startLink()).code);
    expect((await request('channel-bridge/telegram/operations', { subject: '123', eventId: 'mode', operation: 'write', payload: { mutations: [], mode: {} } }, 'bridge')).status).toBe(400);
    expect((await request('channel-bridge/telegram/operations', { subject: '123', eventId: 'bad', operation: 'write', payload: { mutations: [{ id: 'bad', expectedVersion: null, patch: { text: 'x', command: 'rm' } }] } }, 'bridge')).status).toBe(400);
    await write();
    const complete = await request('channel-bridge/telegram/operations', { subject: '123', eventId: 'complete', operation: 'write', payload: { mutations: [{ id: 'from-channel', expectedVersion: 1, patch: { status: 'done' } }] } }, 'bridge');
    expect((await complete.json()).applied[0]).toMatchObject({ version: 2, task: { status: 'done' } });
    expect((await write('stale')).status).toBe(200);
    expect(prisma._stores.tasks.rows[0].payload.version).toBe(2);
  });
  it('deduplicates persistently and rejects changed content under the same event id', async () => {
    await redeem((await startLink()).code);
    const first = await (await write()).json();
    expect(await (await write()).json()).toEqual(first);
    expect((await write('event1', '123', 'Otro')).status).toBe(409);
    expect(prisma._stores.tasks.rows).toHaveLength(1);
    expect(prisma._stores.channelEvents.rows).toHaveLength(1);
  });
  it('does not replay a concurrent or unconfirmed delivery', async () => {
    await redeem((await startLink()).code);
    const create = prisma.task.create;
    let release;
    const held = new Promise((resolve) => { release = resolve; });
    prisma.task.create = async (args) => { await held; return create(args); };
    const first = write();
    try {
      await vi.waitFor(() => expect(prisma._stores.channelEvents.rows).toHaveLength(1), { timeout: 5000 });
      expect((await write()).status).toBe(202);
    } finally { release(); }
    expect((await first).status).toBe(200);
    prisma.channelEvent.update = async () => { throw new Error('receipt unavailable'); };
    expect((await write('uncertain')).status).toBe(500);
    expect((await write('uncertain')).status).toBe(202);
  });
  it('revokes only the session owner and invalidates bindings after session reset', async () => {
    await redeem((await startLink()).code);
    expect((await request('channels/telegram', undefined, 'bob', 'DELETE')).status).toBe(204);
    expect((await write()).status).toBe(200);
    expect((await request('channels/telegram', undefined, 'alice', 'DELETE')).status).toBe(204);
    expect((await write('after-revoke')).status).toBe(403);
    await redeem((await startLink()).code);
    await prisma.user.update({ where: { id: 'alice' }, data: { preferences: { _security: { sessionVersion: 1 } } } });
    expect((await write('after-reset')).status).toBe(403);
  });
});

describe('official transport boundaries without network sends', () => {
  it('checks WhatsApp original bytes HMAC and subscription challenge', () => {
    const raw = Buffer.from('{"entry":[]}');
    const signature = 'sha256=' + createHmac('sha256', 'fixture-secret').update(raw).digest('hex');
    expect(verifyWhatsAppSignature(raw, signature, 'fixture-secret')).toBe(true);
    expect(verifyWhatsAppSignature(Buffer.from('{ "entry":[]}'), signature, 'fixture-secret')).toBe(false);
    expect(verifyWhatsAppSignature(raw, signature, '')).toBe(false);
    expect(verifyWhatsAppSignature(raw, 'sha256=x', 'fixture-secret')).toBe(false);
    expect(whatsAppChallenge({ 'hub.mode': 'subscribe', 'hub.verify_token': 'fixture', 'hub.challenge': '123' }, 'fixture')).toBe('123');
    expect(whatsAppChallenge({ 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong', 'hub.challenge': '123' }, 'fixture')).toBeNull();
  });
  it('accepts only a private Telegram actor equal to the provider sender', () => {
    const update = { update_id: 1, message: { from: { id: 123, is_bot: false }, chat: { id: 123, type: 'private' }, text: 'Comprar leche' } };
    expect(telegramPrivateActor(update)).toEqual({ subject: '123', eventId: '1', text: 'Comprar leche' });
    expect(telegramPrivateActor({ ...update, message: { ...update.message, chat: { id: 456, type: 'private' } } })).toBeNull();
    expect(telegramPrivateActor({ ...update, message: { ...update.message, chat: { id: 123, type: 'group' } } })).toBeNull();
    expect(telegramPrivateActor({ ...update, message: { ...update.message, from: { id: 123, is_bot: true } } })).toBeNull();
  });
});
