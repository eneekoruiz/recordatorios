import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../server/app.js';
import { createMemoryPrisma } from '../support/memoryPrisma.js';
import { totpCode } from '../../server/security.js';

process.env.JWT_SECRET = 'security-hardening-test-secret-123456';
process.env.CRON_SECRET = 'security-hardening-cron-key';
process.env.NODE_ENV = 'test';
process.env.BCRYPT_COST = '4';

const servers = [];

async function openApp(prisma, pushSender = async () => {}) {
  const server = createApp({ prisma, pushSender }).listen(0);
  servers.push(server);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    post: (path, body, token) => fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }),
    get: (path, token) => fetch(`${base}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }),
    cron: () => fetch(`${base}/api/cron/notify`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } }),
  };
}

afterEach(async () => {
  for (const server of servers.splice(0)) {
    const closed = new Promise((resolve) => server.close(resolve));
    server.closeAllConnections();
    await closed;
  }
});

async function register(app, email) {
  const response = await app.post('/api/auth/register', { email, password: 'Password123!' });
  expect(response.status).toBe(200);
  return response.json();
}

describe('security hardening regressions', () => {
  it('consumes TOTP and recovery codes atomically across concurrent logins', async () => {
    const app = await openApp(createMemoryPrisma());
    const account = await register(app, 'parallel-2fa@example.com');
    const setup = await (await app.post('/api/auth/2fa/setup', {}, account.token)).json();
    const enabled = await app.post('/api/auth/2fa/enable', { code: totpCode(setup.secret) }, account.token);
    expect(enabled.status).toBe(200);
    const { recoveryCodes } = await enabled.json();

    const loginPair = (code) => Promise.all([1, 2].map(() => app.post('/api/auth/login', {
      email: 'parallel-2fa@example.com', password: 'Password123!', code,
    })));
    const totpResults = await loginPair(totpCode(setup.secret, Date.now() + 30_000));
    expect(totpResults.map((result) => result.status).sort()).toEqual([200, 401]);

    const recoveryResults = await loginPair(recoveryCodes[0]);
    expect(recoveryResults.map((result) => result.status).sort()).toEqual([200, 401]);
  });

  it('preserves a concurrently consumed TOTP step when sync merges preferences', async () => {
    const prisma = createMemoryPrisma();
    const app = await openApp(prisma);
    const account = await register(app, 'sync-2fa-race@example.com');
    const setup = await (await app.post('/api/auth/2fa/setup', {}, account.token)).json();
    expect((await app.post('/api/auth/2fa/enable', { code: totpCode(setup.secret) }, account.token)).status).toBe(200);

    const originalFindUnique = prisma.user.findUnique.bind(prisma.user);
    let releaseSyncRead;
    let signalSyncRead;
    const syncGate = new Promise((resolve) => { releaseSyncRead = resolve; });
    const syncRead = new Promise((resolve) => { signalSyncRead = resolve; });
    let intercepted = false;
    prisma.user.findUnique = async (args) => {
      const result = await originalFindUnique(args);
      if (!intercepted && args.where?.id === account.user.id && args.select?.preferences && Object.keys(args.select).length === 1) {
        intercepted = true;
        signalSyncRead();
        await syncGate;
      }
      return result;
    };

    const sync = app.post('/api/sync/push', {
      preferences: { theme: 'dark', updated_at: new Date().toISOString() },
    }, account.token);
    await syncRead;
    const reusableCode = totpCode(setup.secret, Date.now() + 30_000);
    const login = await app.post('/api/auth/login', {
      email: 'sync-2fa-race@example.com', password: 'Password123!', code: reusableCode,
    });
    expect(login.status).toBe(200);
    releaseSyncRead();
    expect((await sync).status).toBe(200);

    const stored = await originalFindUnique({ where: { id: account.user.id } });
    expect(stored.preferences.theme).toBe('dark');
    expect(stored.preferences._security.totp.lastStep).toBeGreaterThanOrEqual(Math.floor((Date.now() + 20_000) / 30_000));
    const replay = await app.post('/api/auth/login', {
      email: 'sync-2fa-race@example.com', password: 'Password123!', code: reusableCode,
    });
    expect(replay.status).toBe(401);
  });

  it('does not issue a fresh-session token for an old password during a concurrent password change', async () => {
    const prisma = createMemoryPrisma();
    const app = await openApp(prisma);
    const account = await register(app, 'password-login-race@example.com');
    const originalFindUnique = prisma.user.findUnique.bind(prisma.user);
    let releaseRead;
    let signalRead;
    const readGate = new Promise((resolve) => { releaseRead = resolve; });
    const reachedRead = new Promise((resolve) => { signalRead = resolve; });
    let intercepted = false;
    prisma.user.findUnique = async (args) => {
      const result = await originalFindUnique(args);
      if (!intercepted && args.where?.id === account.user.id && !args.select) {
        intercepted = true;
        signalRead();
        await readGate;
      }
      return result;
    };

    const login = app.post('/api/auth/login', { email: 'password-login-race@example.com', password: 'Password123!' });
    await reachedRead;
    const change = await app.post('/api/auth/change-password', {
      currentPassword: 'Password123!', newPassword: 'ChangedPassword456!',
    }, account.token);
    expect(change.status).toBe(200);
    releaseRead();
    expect((await login).status).toBe(401);
  });

  it('requires a factor if 2FA is enabled while a password-only login is in progress', async () => {
    const prisma = createMemoryPrisma();
    const app = await openApp(prisma);
    const account = await register(app, 'enable-2fa-login-race@example.com');
    const originalFindUnique = prisma.user.findUnique.bind(prisma.user);
    let releaseRead;
    let signalRead;
    const readGate = new Promise((resolve) => { releaseRead = resolve; });
    const reachedRead = new Promise((resolve) => { signalRead = resolve; });
    let intercepted = false;
    prisma.user.findUnique = async (args) => {
      const result = await originalFindUnique(args);
      if (!intercepted && args.where?.id === account.user.id && !args.select) {
        intercepted = true;
        signalRead();
        await readGate;
      }
      return result;
    };

    const login = app.post('/api/auth/login', { email: 'enable-2fa-login-race@example.com', password: 'Password123!' });
    await reachedRead;
    const setup = await (await app.post('/api/auth/2fa/setup', {}, account.token)).json();
    const enabled = await app.post('/api/auth/2fa/enable', { code: totpCode(setup.secret) }, account.token);
    expect(enabled.status).toBe(200);
    releaseRead();
    expect((await login).status).toBe(401);
  });

  it('omits private task descriptions from public shared lists', async () => {
    const prisma = createMemoryPrisma();
    const app = await openApp(prisma);
    const account = await register(app, 'share-notes@example.com');
    const timestamp = new Date().toISOString();
    await app.post('/api/sync/push', {
      lists: [{ id: 'private-list', name: 'Lista', updated_at: timestamp }],
      tasks: [{ id: 'private-task', title: 'Recordatorio', description: 'Nota privada', categoryId: 'private-list', updated_at: timestamp }],
    }, account.token);
    const generated = await (await app.post('/api/share/generate', { listId: 'private-list' }, account.token)).json();
    const response = await app.get(`/api/share/${generated.token}`);
    const shared = await response.json();
    expect(response.status).toBe(200);
    expect(shared.tasks[0]).not.toHaveProperty('description');
  });

  it('retries a failed timed alert after another notification succeeded, then records its delivery', async () => {
    const prisma = createMemoryPrisma();
    const attempts = [];
    let failedAlert = false;
    const sender = async (_subscription, message) => {
      attempts.push(message.title);
      if (message.title === 'Recordatorio' && !failedAlert) {
        failedAlert = true;
        const error = new Error('temporary failure');
        error.statusCode = 503;
        throw error;
      }
    };
    const app = await openApp(prisma, sender);
    const account = await register(app, 'retry-alert@example.com');
    const now = new Date();
    const alertTime = new Date(now.getTime() - 30 * 60_000);
    const time = `${String(alertTime.getUTCHours()).padStart(2, '0')}:${String(alertTime.getUTCMinutes()).padStart(2, '0')}`;
    await app.post('/api/sync/push', {
      tasks: [{ id: 'timed', title: 'Alerta pendiente', categoryId: 'inbox', cycle_id: 'cycle_day', status: 'pending', alerts: [{ type: 'at_time', time }], updated_at: now.toISOString() }],
    }, account.token);
    await app.post('/api/push/subscribe', {
      subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/retry', keys: { p256dh: 'p', auth: 'a' } },
      timeZone: 'Etc/UTC', digestHour: 0,
    }, account.token);
    const oldCursor = new Date(now.getTime() - 90 * 60_000);
    await prisma.pushSubscription.update({
      where: { endpoint: 'https://fcm.googleapis.com/fcm/send/retry' },
      data: { lastCheckedAt: oldCursor },
    });

    const first = await app.cron();
    expect(first.status).toBe(200);
    expect((await first.json()).sent).toBe(1);
    const afterFailure = await prisma.pushSubscription.findUnique({ where: { endpoint: 'https://fcm.googleapis.com/fcm/send/retry' } });
    expect(afterFailure.lastCheckedAt.getTime()).toBe(oldCursor.getTime());

    const retry = await app.cron();
    expect(retry.status).toBe(200);
    expect((await retry.json()).sent).toBe(1);
    expect(attempts.filter((title) => title === 'Recordatorio')).toHaveLength(2);

    const repeat = await app.cron();
    expect(repeat.status).toBe(200);
    expect((await repeat.json()).sent).toBe(0);
    expect(attempts.filter((title) => title === 'Recordatorio')).toHaveLength(2);
  });

  it('allows only one cron app instance to send while a shared durable lease is held', async () => {
    const prisma = createMemoryPrisma();
    let unblockSender;
    let senderEntered;
    const gate = new Promise((resolve) => { unblockSender = resolve; });
    const entered = new Promise((resolve) => { senderEntered = resolve; });
    const attempts = [];
    const sender = async () => {
      attempts.push('sent');
      senderEntered();
      await gate;
    };
    const firstApp = await openApp(prisma, sender);
    const secondApp = await openApp(prisma, sender);
    const account = await register(firstApp, 'parallel-cron@example.com');
    await firstApp.post('/api/sync/push', {
      tasks: [{ id: 'daily', title: 'Diaria', cycle_id: 'cycle_day', status: 'pending', updated_at: new Date().toISOString() }],
    }, account.token);
    await firstApp.post('/api/push/subscribe', {
      subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/lease', keys: { p256dh: 'p', auth: 'a' } },
      timeZone: 'Etc/UTC', digestHour: 0,
    }, account.token);

    const running = firstApp.cron();
    await entered;
    const concurrent = await secondApp.cron();
    expect(concurrent.status).toBe(429);
    unblockSender();
    expect((await running).status).toBe(200);
    expect(attempts).toHaveLength(1);
  });
});
