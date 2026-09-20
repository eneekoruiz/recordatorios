import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../server/app.js';
import { createMemoryPrisma } from '../support/memoryPrisma.js';

let server;
let base;
let prisma;

const post = (path, body, token) =>
  fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
const get = (path, token) => fetch(base + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

async function register(email, password = 'Password123!') {
  const res = await post('/api/auth/register', { email, password });
  expect(res.status).toBe(200);
  return res.json();
}

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-with-enough-length';
  delete process.env.VERCEL;
  delete process.env.RESEND_API_KEY;
  process.env.NODE_ENV = 'test';
  prisma = createMemoryPrisma();
  await new Promise((resolve) => {
    server = createApp({ prisma }).listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => server?.close());

describe('autenticación', () => {
  let i = 0;
  let email;
  beforeEach(() => {
    email = `user${Date.now()}_${i++}@example.com`;
  });

  it('rechaza contraseñas de menos de 8 caracteres', async () => {
    const res = await post('/api/auth/register', { email, password: '1234' });
    expect(res.status).toBe(400);
  });

  it('registra, inicia sesión y emite tokens con caducidad', async () => {
    const { token } = await register(email);
    const decoded = jwt.decode(token);
    expect(decoded.exp).toBeGreaterThan(Date.now() / 1000 + 29 * 24 * 3600);
    const login = await post('/api/auth/login', { email, password: 'Password123!' });
    expect(login.status).toBe(200);
  });

  it('no revela si una cuenta existe en el login', async () => {
    await register(email);
    const wrongPass = await post('/api/auth/login', { email, password: 'incorrecta!!' });
    const noUser = await post('/api/auth/login', { email: 'nadie@example.com', password: 'incorrecta!!' });
    expect(wrongPass.status).toBe(401);
    expect(noUser.status).toBe(401);
    expect((await wrongPass.json()).error).toBe((await noUser.json()).error);
  });

  it('ya NO permite cambiar la contraseña solo con el email', async () => {
    await register(email);
    const res = await post('/api/auth/reset-password', { email, newPassword: 'hackeado123' });
    expect(res.status).toBe(400);
    const login = await post('/api/auth/login', { email, password: 'Password123!' });
    expect(login.status).toBe(200);
  });

  it('recupera la contraseña con enlace firmado de un solo uso', async () => {
    await register(email);
    const forgot = await post('/api/auth/forgot-password', { email });
    expect(forgot.status).toBe(200);
    const { devResetUrl } = await forgot.json();
    const token = new URL(devResetUrl).searchParams.get('reset');

    const reset = await post('/api/auth/reset-password', { token, newPassword: 'NuevaClave456!' });
    expect(reset.status).toBe(200);
    expect((await reset.json()).token).toBeTruthy();

    // El mismo enlace ya no sirve una segunda vez
    const reuse = await post('/api/auth/reset-password', { token, newPassword: 'OtraClave789!' });
    expect(reuse.status).toBe(400);

    expect((await post('/api/auth/login', { email, password: 'NuevaClave456!' })).status).toBe(200);
  });

  it('forgot-password responde igual exista o no la cuenta', async () => {
    const res = await post('/api/auth/forgot-password', { email: 'no-existe@example.com' });
    expect(res.status).toBe(200);
    expect((await res.json()).devResetUrl).toBeUndefined();
  });

  it('cambia la contraseña con la actual', async () => {
    const { token } = await register(email);
    const bad = await post('/api/auth/change-password', { currentPassword: 'mal', newPassword: 'Cambiada123!' }, token);
    expect(bad.status).toBe(400);
    const ok = await post('/api/auth/change-password', { currentPassword: 'Password123!', newPassword: 'Cambiada123!' }, token);
    expect(ok.status).toBe(200);
  });

  it('rechaza tokens firmados con otro secreto (p. ej. el antiguo por defecto)', async () => {
    const forged = jwt.sign({ id: 'x', email: 'x@x.com' }, 'super_secret_jwt_key_for_recordatorios');
    expect((await get('/api/sync/pull', forged)).status).toBe(401);
  });

  it('renueva tokens heredados sin caducidad', async () => {
    const { user } = await register(email);
    const legacy = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET);
    const res = await get('/api/sync/pull', legacy);
    expect(res.status).toBe(200);
    const refreshed = res.headers.get('x-refreshed-token');
    expect(refreshed).toBeTruthy();
    expect(jwt.decode(refreshed).exp).toBeTruthy();
  });

  it('en producción sin JWT_SECRET deshabilita el login en vez de usar un secreto conocido', async () => {
    const prev = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'production';
    try {
      const res = await post('/api/auth/login', { email, password: 'Password123!' });
      expect(res.status).toBe(500);
    } finally {
      process.env.JWT_SECRET = prev;
      process.env.NODE_ENV = 'test';
    }
  });
});

describe('sincronización multiusuario', () => {
  const now = () => new Date().toISOString();

  it('dos usuarios con los mismos IDs de lista no se pisan', async () => {
    const a = await register(`a${Date.now()}@example.com`);
    const b = await register(`b${Date.now()}@example.com`);

    await post('/api/sync/push', { lists: [{ id: 'compras', name: 'Compras de A', color: '#f00', updated_at: now() }] }, a.token);
    await post('/api/sync/push', { lists: [{ id: 'compras', name: 'Compras de B', color: '#0f0', updated_at: now() }] }, b.token);

    const pullA = await (await get('/api/sync/pull?lastToken=0', a.token)).json();
    const pullB = await (await get('/api/sync/pull?lastToken=0', b.token)).json();
    expect(pullA.lists.map((l) => l.name)).toEqual(['Compras de A']);
    expect(pullB.lists.map((l) => l.name)).toEqual(['Compras de B']);
    expect(pullA.lists[0].id).toBe('compras');
    expect(pullA.activeListIds).toEqual(['compras']);
  });

  it('un usuario no puede sobrescribir la tarea de otro conociendo su ID', async () => {
    const a = await register(`a2${Date.now()}@example.com`);
    const b = await register(`b2${Date.now()}@example.com`);
    await post('/api/sync/push', { tasks: [{ id: 't-secret', title: 'Privada', version: 1, updated_at: now() }] }, a.token);
    await post('/api/sync/push', { tasks: [{ id: 't-secret', title: 'PWNED', version: 99, updated_at: now() }] }, b.token);
    const pullA = await (await get('/api/sync/pull?lastToken=0', a.token)).json();
    expect(pullA.tasks.find((t) => t.id === 't-secret').title).toBe('Privada');
  });

  it('respeta filas heredadas (ID sin ámbito) del propio usuario', async () => {
    const a = await register(`legacy${Date.now()}@example.com`);
    await prisma.task.create({ data: { id: 'legacy-task', userId: a.user.id, payload: { id: 'legacy-task', title: 'Vieja', version: 1 } } });
    await post('/api/sync/push', { tasks: [{ id: 'legacy-task', title: 'Actualizada', version: 2, updated_at: now() }] }, a.token);
    const rows = prisma._stores.tasks.rows.filter((r) => r.userId === a.user.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].payload.title).toBe('Actualizada');
  });

  it('Last-Write-Wins en servidor: un dispositivo desactualizado no pisa datos nuevos', async () => {
    const a = await register(`lww${Date.now()}@example.com`);
    await post('/api/sync/push', { tasks: [{ id: 't1', title: 'v3', version: 3, updated_at: now() }] }, a.token);
    const res = await post('/api/sync/push', { tasks: [{ id: 't1', title: 'v1 obsoleta', version: 1, updated_at: now() }] }, a.token);
    const body = await res.json();
    expect(body.stale.tasks[0].title).toBe('v3');
    const pull = await (await get('/api/sync/pull?lastToken=0', a.token)).json();
    expect(pull.tasks[0].title).toBe('v3');
  });

  it('los borrados de listas y ciclos se propagan', async () => {
    const a = await register(`del${Date.now()}@example.com`);
    await post('/api/sync/push', { lists: [{ id: 'l1', name: 'Viaje', updated_at: now() }], cycles: [{ id: 'c1', name: 'Quincenal', daysValue: 14, updated_at: now() }] }, a.token);
    await post('/api/sync/push', {
      lists: [{ id: 'l1', name: 'Viaje', deleted_at: now(), updated_at: new Date(Date.now() + 1000).toISOString() }],
      cycles: [{ id: 'c1', name: 'Quincenal', daysValue: 14, deleted_at: now(), updated_at: new Date(Date.now() + 1000).toISOString() }],
    }, a.token);
    const pull = await (await get('/api/sync/pull?lastToken=0', a.token)).json();
    expect(pull.activeListIds).not.toContain('l1');
    expect(pull.lists[0].deleted_at).toBeTruthy();
    expect(pull.cycles[0].deleted_at).toBeTruthy();
  });

  it('no guarda el flag local _is_dirty', async () => {
    const a = await register(`dirty${Date.now()}@example.com`);
    await post('/api/sync/push', { tasks: [{ id: 'd1', title: 'x', _is_dirty: true, version: 1, updated_at: now() }] }, a.token);
    const pull = await (await get('/api/sync/pull?lastToken=0', a.token)).json();
    expect(pull.tasks[0]._is_dirty).toBeUndefined();
  });

  it('el pull incremental solo devuelve cambios posteriores', async () => {
    const a = await register(`inc${Date.now()}@example.com`);
    await post('/api/sync/push', { tasks: [{ id: 'i1', title: 'uno', version: 1, updated_at: now() }] }, a.token);
    const first = await (await get('/api/sync/pull?lastToken=0', a.token)).json();
    expect(first.tasks).toHaveLength(1);
    const later = await (await get(`/api/sync/pull?lastToken=${Date.now() + 60_000}`, a.token)).json();
    expect(later.tasks).toHaveLength(0);
  });

  it('rechaza peticiones sin token', async () => {
    expect((await get('/api/sync/pull')).status).toBe(401);
    expect((await post('/api/sync/push', {})).status).toBe(401);
  });
});

describe('listas compartidas', () => {
  it('comparte una lista en solo lectura con sus tareas (categoryId)', async () => {
    const a = await register(`share${Date.now()}@example.com`);
    const t = new Date().toISOString();
    await post('/api/sync/push', {
      lists: [{ id: 'compras', name: 'Compras', color: '#f90', updated_at: t }],
      tasks: [
        { id: 's1', title: 'Leche', categoryId: 'compras', version: 1, updated_at: t },
        { id: 's2', title: 'Otra lista', categoryId: 'trabajo', version: 1, updated_at: t },
        { id: 's3', title: 'Borrada', categoryId: 'compras', deleted_at: t, version: 1, updated_at: t },
      ],
    }, a.token);
    const gen = await post('/api/share/generate', { listId: 'compras' }, a.token);
    expect(gen.status).toBe(200);
    const { token } = await gen.json();

    const shared = await (await get(`/api/share/${token}`)).json();
    expect(shared.list.name).toBe('Compras');
    expect(shared.tasks.map((x) => x.title)).toEqual(['Leche']);

    // Revocar
    const revoke = await fetch(`${base}/api/share/list/compras`, { method: 'DELETE', headers: { Authorization: `Bearer ${a.token}` } });
    expect(revoke.status).toBe(200);
    expect((await get(`/api/share/${token}`)).status).toBe(404);
  });

  it('no permite compartir listas ajenas', async () => {
    const a = await register(`owner${Date.now()}@example.com`);
    const b = await register(`thief${Date.now()}@example.com`);
    await post('/api/sync/push', { lists: [{ id: 'privada', name: 'Privada', updated_at: new Date().toISOString() }] }, a.token);
    const res = await post('/api/share/generate', { listId: 'privada' }, b.token);
    expect(res.status).toBe(404);
  });
});

describe('MCP', () => {
  const rpc = (body, token) => post('/api/mcp', { jsonrpc: '2.0', id: 1, ...body }, token);

  it('exige autenticación para ejecutar herramientas', async () => {
    const res = await rpc({ method: 'tools/call', params: { name: 'create_reminders', arguments: { reminders: [{ title: 'x' }] } } });
    const body = await res.json();
    expect(body.error.code).toBe(-32001);
  });

  it('crea listas y recordatorios que luego aparecen en la sincronización', async () => {
    const a = await register(`mcp${Date.now()}@example.com`);
    const listRes = await (await rpc({ method: 'tools/call', params: { name: 'create_list', arguments: { name: 'Viaje a Roma' } } }, a.token)).json();
    const list = JSON.parse(listRes.result.content[0].text).list;

    const remRes = await (await rpc({
      method: 'tools/call',
      params: { name: 'create_reminders', arguments: { reminders: [
        { title: 'Comprar billetes', listName: 'viaje a roma', priority: 'high' },
        { title: 'Pan', price: 1.2, timeOfDay: 'morning' },
      ] } },
    }, a.token)).json();
    expect(JSON.parse(remRes.result.content[0].text).count).toBe(2);

    const pull = await (await get('/api/sync/pull?lastToken=0', a.token)).json();
    const billetes = pull.tasks.find((t) => t.title === 'Comprar billetes');
    expect(billetes.categoryId).toBe(list.id);
    expect(billetes.version).toBe(1);
    expect(pull.tasks.find((t) => t.title === 'Pan').categoryId).toBe('inbox');

    const q = await (await rpc({ method: 'tools/call', params: { name: 'query_reminders', arguments: { query: 'pan' } } }, a.token)).json();
    expect(JSON.parse(q.result.content[0].text).count).toBe(1);
  });
});

describe('robustez', () => {
  it('devuelve JSON en rutas inexistentes y cuerpos inválidos', async () => {
    const r404 = await get('/api/no-existe');
    expect(r404.status).toBe(404);
    const bad = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{nope' });
    expect(bad.status).toBe(400);
  });

  it('en Vercel el canal SSE responde 204 para que el cliente use sondeo', async () => {
    process.env.VERCEL = '1';
    try {
      expect((await get('/api/sync/live?token=x')).status).toBe(204);
    } finally {
      delete process.env.VERCEL;
    }
  });
});
