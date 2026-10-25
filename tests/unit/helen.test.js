import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../server/app.js';
import { createMemoryPrisma } from '../support/memoryPrisma.js';

let server, base, prisma, pushed, failWith;
const secret = 'helen-test-secret-with-enough-length';
const token = (id) => jwt.sign({ id, email: `${id}@example.com`, sv: 0 }, secret);
const call = (method, path, body, owner = 'alice') => fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(owner ? { Authorization: `Bearer ${token(owner)}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
const mutation = (id, expectedVersion, patch, deleted) => ({ id, expectedVersion, ...(patch ? { patch } : {}), ...(deleted === undefined ? {} : { deleted }) });
const push = { id: 'event-1', title: 'Consulta privada', text: 'Texto privado', sensitive: true, kind: 'reminder' };
beforeEach(async () => {
  process.env.JWT_SECRET = secret;
  prisma = createMemoryPrisma(); pushed = []; failWith = undefined;
  await prisma.user.create({ data: { id: 'alice', email: 'alice@example.com', password: 'unused', preferences: { theme: 'dark', _security: { sessionVersion: 0 }, timeZone: 'Europe/Madrid' } } });
  await prisma.user.create({ data: { id: 'bob', email: 'bob@example.com', password: 'unused' } });
  const pushSender = async (sub, payload) => { if (failWith) throw Object.assign(new Error('push failed'), failWith); pushed.push({ sub, payload }); };
  await new Promise((resolve) => { server = createApp({ prisma, pushSender }).listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(() => { server.closeAllConnections?.(); server.close(); });
const task = (id, extra = {}, userId = 'alice') => prisma.task.create({ data: { id: `${userId}:${id}`, userId, payload: { id, title: 'Tarea', categoryId: 'inbox', status: 'pending', version: 1, created_at: new Date().toISOString(), ...extra } } });
const subscribe = (id = 'phone', userId = 'alice') => prisma.pushSubscription.create({ data: { id, userId, endpoint: `https://fcm.googleapis.com/fcm/send/${id}`, keys: { p256dh: 'public', auth: 'private' } } });
describe('HELEN authenticated integration', () => {
  it('rejects record overflow instead of truncating an export or accepting further creates', async () => {
    for (let index = 0; index < 5000; index++) await task(`full-${index}`);
    expect((await call('POST', '/api/helen/sync', { mutations: [mutation('overflow', null, { text: 'Too many' })] })).status).toBe(413);
    await task('legacy-overflow');
    expect((await call('GET', '/api/helen/sync')).status).toBe(413);
  });
  it('prefers a scoped task over a same-user legacy row with the same client id', async () => {
    await prisma.task.create({ data: { id: 'duplicate', userId: 'alice', payload: { title: 'Legacy', version: 1 } } });
    await task('duplicate', { title: 'Current', version: 3 });
    const pulled = await (await call('GET', '/api/helen/sync')).json();
    expect(pulled.tasks).toHaveLength(1);
    expect(pulled.tasks[0]).toMatchObject({ id: 'duplicate', version: 3, task: { text: 'Current' } });
    const patched = await (await call('POST', '/api/helen/sync', { mutations: [mutation('duplicate', 3, { text: 'Updated current' })] })).json();
    expect(patched.applied[0].version).toBe(4);
    expect((await prisma.task.findFirst({ where: { id: 'duplicate' } })).payload.title).toBe('Legacy');
  });
  it('keeps a concurrent push claim before its external send and does not resend it', async () => {
    await subscribe();
    await prisma.cronLease.create({ data: { key: `helen:${(await import('node:crypto')).createHash('sha256').update(JSON.stringify(['alice', push.id, 'phone'])).digest('hex')}`, owner: 'inflight:another-server', expiresAt: new Date(Date.now() + 48 * 3600_000) } });
    const response = await call('POST', '/api/push/helen', push);
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ delivered: 0, uncertain: true });
    expect(pushed).toHaveLength(0);
  });
  it('requires auth and validates complete batches before writing', async () => {
    expect((await call('GET', '/api/helen/sync', null, null)).status).toBe(401);
    expect((await call('POST', '/api/push/helen', push, null)).status).toBe(401);
    expect((await call('POST', '/api/helen/sync', { mutations: [mutation('a', null, { text: 'Valid' }), mutation('b', null, { unknown: true })] })).status).toBe(400);
    expect(prisma._stores.tasks.rows).toHaveLength(0);
    expect((await call('GET', '/api/helen/sync?since=NaN')).status).toBe(400);
  });
  it('creates normalized tasks in scoped lists, preserves opaque metadata and detects stale writes', async () => {
    const created = await (await call('POST', '/api/helen/sync', { mutations: [mutation('new', null, { text: 'Leche', list: 'Lista de la compra', priority: 'high' })] })).json();
    expect(created.applied[0]).toMatchObject({ id: 'new', version: 1, task: { text: 'Leche', list: 'compra', status: 'open', priority: 'high' } });
    await task('rich', { playbook: { steps: ['keep'] }, alerts: [{ id: 'alarm' }], completionHistory: [1] });
    const updated = await (await call('POST', '/api/helen/sync', { mutations: [mutation('rich', 1, { text: 'Renombrada', due: '2026-12-25T09:00:00Z' })] })).json();
    expect(updated.applied[0].version).toBe(2);
    const raw = (await prisma.task.findFirst({ where: { id: 'alice:rich' } })).payload;
    expect(raw).toMatchObject({ playbook: { steps: ['keep'] }, alerts: [{ id: 'alarm' }], completionHistory: [1] });
    const stale = await (await call('POST', '/api/helen/sync', { mutations: [mutation('rich', 1, { text: 'Lost write' })] })).json();
    expect(stale.conflicts[0]).toMatchObject({ version: 2, task: { text: 'Renombrada' } });
    const other = await (await call('GET', '/api/helen/sync', null, 'bob')).json();
    expect(other.tasks).toEqual([]);
    const tombstone = await (await call('POST', '/api/helen/sync', { mutations: [mutation('rich', 2, null, true)] })).json();
    expect(tombstone.applied[0].deleted).toBe(true);
    const restored = await (await call('POST', '/api/helen/sync', { mutations: [mutation('rich', 3, null, false)] })).json();
    expect(restored.applied[0].deleted).toBe(false);
  });
  it('uses row timestamp CAS when a concurrent writer changes a task after the snapshot', async () => {
    await task('race');
    const original = prisma.task.updateMany;
    prisma.task.updateMany = async (args) => {
      if (args.where.id === 'alice:race') {
        prisma.task.updateMany = original;
        await prisma.task.update({ where: { id: 'alice:race' }, data: { payload: { id: 'race', title: 'Concurrent edit', version: 2 } } });
        prisma._stores.tasks.rows.find((row) => row.id === 'alice:race').updatedAt = args.where.updatedAt.equals;
      }
      return original(args);
    };
    const result = await (await call('POST', '/api/helen/sync', { mutations: [mutation('race', 1, { text: 'Must not overwrite' })] })).json();
    expect(result.applied).toEqual([]);
    expect(result.conflicts[0].task.text).toBe('Concurrent edit');
  });
  it('roundtrips recurring completion without removing older periods or duplicating completion history', async () => {
    const yesterday = Date.now() - 3 * 86400_000;
    await task('routine', { cycle_id: 'cycle_day', completionHistory: [yesterday], targetCount: 3, currentCount: 0 });
    const complete = await (await call('POST', '/api/helen/sync', { mutations: [mutation('routine', 1, { status: 'done' })] })).json();
    expect(complete.applied[0].task.status).toBe('done');
    expect(complete.applied[0].task.completions).toContain(new Date(yesterday).toISOString());
    expect(complete.applied[0].task.completions).toHaveLength(2);
    const repeated = await (await call('POST', '/api/helen/sync', { mutations: [mutation('routine', 2, { status: 'done' })] })).json();
    expect(repeated.applied[0].task.status).toBe('done');
    let raw = (await prisma.task.findFirst({ where: { id: 'alice:routine' } })).payload;
    expect(raw.status).toBe('pending');
    expect(raw.currentCount).toBe(3);
    expect(raw.completionHistory).toHaveLength(2);
    await call('POST', '/api/helen/sync', { mutations: [mutation('routine', 3, { status: 'open' })] });
    raw = (await prisma.task.findFirst({ where: { id: 'alice:routine' } })).payload;
    expect(raw.completionHistory).toEqual([yesterday]);
    expect(raw.currentCount).toBe(0);
  });
  it('CAS updates mode while preserving security and unrelated preferences, and normalizes date-only expiry', async () => {
    const initial = await (await call('GET', '/api/helen/sync')).json();
    expect(initial.mode.updatedAt).toBe('1970-01-01T00:00:00.000Z');
    const request = { mutations: [], mode: { mode: 'examenes', updatedAt: new Date().toISOString(), expectedUpdatedAt: initial.mode.updatedAt, until: '2026-12-01T00:00:00Z' } };
    const result = await (await call('POST', '/api/helen/sync', request)).json();
    expect(result.modeConflict).toBe(false);
    expect((await (await call('POST', '/api/helen/sync', request)).json()).modeConflict).toBe(true);
    const user = await prisma.user.findUnique({ where: { id: 'alice' } });
    expect(user.preferences).toMatchObject({ theme: 'dark', _security: { sessionVersion: 0 } });
    await prisma.user.update({ where: { id: 'alice' }, data: { preferences: { ...user.preferences, activeMode: { mode: 'vacaciones', updatedAt: new Date().toISOString(), until: '2026-12-20' } } } });
    expect((await (await call('GET', '/api/helen/sync')).json()).mode.until).toBe('2026-12-20T00:00:00.000Z');
  });
  it('sends private push once per own subscription, skipping already sent events', async () => {
    await subscribe(); await subscribe('bob-phone', 'bob');
    expect((await call('POST', '/api/push/helen', push)).status).toBe(200);
    expect(pushed).toHaveLength(1);
    expect(JSON.stringify(pushed[0].payload)).not.toContain(push.text);
    expect(JSON.stringify(pushed[0].payload)).not.toContain(push.title);
    expect(await (await call('POST', '/api/push/helen', push)).json()).toEqual({ delivered: 0, skipped: true });
    expect(pushed).toHaveLength(1);
  });
  it('keeps a sent notification uncertain when recording its outcome fails', async () => {
    await subscribe();
    prisma.cronLease.updateMany = async () => { throw new Error('database unavailable after external send'); };
    const response = await call('POST', '/api/push/helen', push);
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ uncertain: true });
    expect((await call('POST', '/api/push/helen', push)).status).toBe(202);
    expect(pushed).toHaveLength(1);
  });
  it('never resends uncertain push and reports missing subscriptions or known rejections', async () => {
    expect((await call('POST', '/api/push/helen', push)).status).toBe(503);
    await subscribe(); failWith = {};
    const uncertain = await call('POST', '/api/push/helen', push);
    expect(uncertain.status).toBe(202);
    expect(await uncertain.json()).toMatchObject({ uncertain: true });
    failWith = undefined;
    expect((await call('POST', '/api/push/helen', push)).status).toBe(202);
    expect(pushed).toHaveLength(0);
    failWith = { statusCode: 410 };
    expect((await call('POST', '/api/push/helen', { ...push, id: 'gone' })).status).toBe(503);
    expect(prisma._stores.push.rows).toHaveLength(0);
  });
  it('requires the authenticated owner of an MCP SSE session before handling messages', async () => {
    const response = await call('GET', '/api/mcp/sse');
    const reader = response.body.getReader();
    const chunk = new TextDecoder().decode((await reader.read()).value);
    const endpoint = /data: (\/api\/mcp\/messages\?sessionId=[^\n]+)/.exec(chunk)[1];
    const request = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
    expect((await call('POST', endpoint, request, null)).status).toBe(401);
    expect((await call('POST', endpoint, request, 'bob')).status).toBe(403);
    expect((await call('POST', endpoint, request)).status).toBe(202);
    await reader.cancel();
  });
});
