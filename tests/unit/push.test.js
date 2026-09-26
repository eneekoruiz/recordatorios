import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../../server/app.js';
import { createMemoryPrisma } from '../support/memoryPrisma.js';

let server;
let base;
let prisma;
const sent = [];
let failWith = null;

const call = (method, path, body, token, headers = {}) =>
  fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-with-enough-length';
  process.env.VAPID_PUBLIC_KEY = 'clave-publica-de-prueba';
  process.env.CRON_SECRET = 'cron-de-prueba';
  prisma = createMemoryPrisma();
  const pushSender = async (subscription, message) => {
    if (failWith) { const e = new Error('gone'); e.statusCode = failWith; throw e; }
    sent.push({ endpoint: subscription.endpoint, ...message });
  };
  await new Promise((resolve) => { server = createApp({ prisma, pushSender }).listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});
afterAll(() => server?.close());

async function user() {
  const res = await call('POST', '/api/auth/register', { email: `push${Date.now()}${Math.random()}@example.com`, password: 'Password123!' });
  return res.json();
}
const subscription = (n) => ({ endpoint: `https://push.example.com/${n}`, keys: { p256dh: 'p', auth: 'a' } });

describe('avisos push', () => {
  it('publica la clave pública', async () => {
    expect(await (await call('GET', '/api/push/public-key')).json()).toEqual({ publicKey: 'clave-publica-de-prueba' });
  });

  it('suscribirse exige sesión y valida la suscripción', async () => {
    expect((await call('POST', '/api/push/subscribe', { subscription: subscription(1) })).status).toBe(401);
    const { token } = await user();
    expect((await call('POST', '/api/push/subscribe', { subscription: { endpoint: 'http://inseguro' } }, token)).status).toBe(400);
    const ok = await call('POST', '/api/push/subscribe', { subscription: subscription(1), timeZone: 'Europe/Madrid', digestHour: 8, weeklyDay: 0 }, token);
    expect(await ok.json()).toEqual({ success: true, timeZone: 'Europe/Madrid', digestHour: 8, weeklyDay: 0 });
  });

  it('la tarea programada exige CRON_SECRET', async () => {
    expect((await call('GET', '/api/cron/notify')).status).toBe(401);
    expect((await call('GET', '/api/cron/notify', null, 'otro')).status).toBe(401);
  });

  it('envía el resumen del día una sola vez', async () => {
    const { token } = await user();
    await call('POST', '/api/sync/push', { tasks: [{ id: 'd1', title: 'Regar', cycle_id: 'cycle_day', status: 'pending', version: 1, updated_at: new Date().toISOString() }] }, token);
    await call('POST', '/api/push/subscribe', { subscription: subscription('resumen'), timeZone: 'Etc/UTC', digestHour: 0 }, token);
    sent.length = 0;
    const run = await call('POST', '/api/cron/notify', null, 'cron-de-prueba');
    expect(run.status).toBe(200);
    const mine = sent.filter((m) => m.endpoint.endsWith('/resumen'));
    expect(mine).toHaveLength(1);
    expect(mine[0].title).toBe('Completa tus recordatorios diarios');
    sent.length = 0;
    await call('POST', '/api/cron/notify', null, 'cron-de-prueba');
    expect(sent.filter((m) => m.endpoint.endsWith('/resumen'))).toHaveLength(0);
  });

  it('usa las secciones y el día semanal sincronizado para contar como la app', async () => {
    const { token } = await user();
    const now = new Date().toISOString();
    const today = new Date().getUTCDay();
    await call('POST', '/api/sync/push', {
      lists: [{ id: 'casa', name: 'Casa', color: '#007aff', version: 1, updated_at: now }],
      listSections: [{ id: 'sec_rutina', listId: 'casa', name: 'Semanales', updated_at: now }],
      tasks: [{ id: 'w1', title: 'Limpiar horno', categoryId: 'casa', sectionId: 'sec_rutina', status: 'pending', version: 1, updated_at: now }],
      preferences: { weeklyTasksDay: today, updated_at: now },
    }, token);
    // La suscripción dice otro día: manda el que el usuario eligió en la app.
    await call('POST', '/api/push/subscribe', { subscription: subscription('semanal'), timeZone: 'Etc/UTC', digestHour: 0, weeklyDay: (today + 3) % 7 }, token);
    sent.length = 0;
    await call('POST', '/api/cron/notify', null, 'cron-de-prueba');
    const mine = sent.filter((m) => m.endpoint.endsWith('/semanal'));
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ title: 'Hoy te tocan los recordatorios semanales', body: 'Pendientes: 1 semanal.' });
  });

  it('borra las suscripciones que el navegador anuló (410)', async () => {
    const { token } = await user();
    await call('POST', '/api/sync/push', { tasks: [{ id: 'd2', title: 'Leer', cycle_id: 'cycle_day', status: 'pending', version: 1, updated_at: new Date().toISOString() }] }, token);
    await call('POST', '/api/push/subscribe', { subscription: subscription('anulada'), timeZone: 'Etc/UTC', digestHour: 0 }, token);
    failWith = 410;
    await call('POST', '/api/cron/notify', null, 'cron-de-prueba');
    failWith = null;
    const left = await prisma.pushSubscription.findMany({ where: { endpoint: 'https://push.example.com/anulada' } });
    expect(left).toHaveLength(0);
  });

  it('darse de baja borra la suscripción', async () => {
    const { token } = await user();
    await call('POST', '/api/push/subscribe', { subscription: subscription('baja') }, token);
    expect((await call('POST', '/api/push/unsubscribe', { endpoint: 'https://push.example.com/baja' }, token)).status).toBe(200);
    expect(await prisma.pushSubscription.findMany({ where: { endpoint: 'https://push.example.com/baja' } })).toHaveLength(0);
  });
});
