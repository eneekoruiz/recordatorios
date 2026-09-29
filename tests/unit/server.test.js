import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { createApp, resetLinkBase } from '../../server/app.js';
import { createMemoryPrisma } from '../support/memoryPrisma.js';
import bcrypt from 'bcryptjs';
import { totpCode } from '../../server/security.js';

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
  process.env.BCRYPT_COST = '4'; // los hashes reales usan 12; aquí solo importa la lógica
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

  it('los tokens anteriores a las versiones de sesión ya no valen (se vuelve a entrar una vez)', async () => {
    const { user } = await register(email);
    const legacy = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET);
    expect((await get('/api/sync/pull', legacy)).status).toBe(401);
  });

  it('renueva de forma transparente los tokens con más de 7 días', async () => {
    const { user } = await register(email);
    const eightDaysAgo = Math.floor(Date.now() / 1000) - 8 * 24 * 3600;
    const old = jwt.sign(
      { id: user.id, email: user.email, sv: 0, iat: eightDaysAgo },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );
    const res = await get('/api/sync/pull', old);
    expect(res.status).toBe(200);
    const refreshed = res.headers.get('x-refreshed-token');
    expect(refreshed).toBeTruthy();
    expect(jwt.decode(refreshed).sv).toBe(0);
    expect(jwt.decode(refreshed).iat).toBeGreaterThan(eightDaysAgo);
  });

  it('cambiar la contraseña cierra las demás sesiones y mantiene la actual', async () => {
    const { token: phone } = await register(email);
    const login = await post('/api/auth/login', { email, password: 'Password123!' });
    const { token: laptop } = await login.json();
    const change = await post('/api/auth/change-password', { currentPassword: 'Password123!', newPassword: 'Cambiada123!' }, phone);
    expect(change.status).toBe(200);
    const { token: phoneRenewed } = await change.json();
    expect((await get('/api/sync/pull', laptop)).status).toBe(401);
    expect((await get('/api/sync/pull', phone)).status).toBe(401);
    expect((await get('/api/sync/pull', phoneRenewed)).status).toBe(200);
  });

  it('restablecer la contraseña por email también cierra las sesiones abiertas', async () => {
    const { token: stolen } = await register(email);
    const forgot = await post('/api/auth/forgot-password', { email });
    const resetToken = new URL((await forgot.json()).devResetUrl).searchParams.get('reset');
    const reset = await post('/api/auth/reset-password', { token: resetToken, newPassword: 'NuevaClave456!' });
    expect(reset.status).toBe(200);
    expect((await get('/api/sync/pull', stolen)).status).toBe(401);
    expect((await get('/api/sync/pull', (await reset.json()).token)).status).toBe(200);
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

describe('seguridad de la cuenta', () => {
  let n = 0;
  const newEmail = () => `seg${Date.now()}_${n++}@example.com`;
  const login = (email, extra = {}, ua = 'Mozilla/5.0 Test') =>
    fetch(base + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': ua },
      body: JSON.stringify({ email, password: 'Password123!', ...extra }),
    });

  async function enable2fa(token) {
    const setup = await (await post('/api/auth/2fa/setup', {}, token)).json();
    expect(setup.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(setup.otpauthUrl).toContain('otpauth://totp/');
    const enabled = await post('/api/auth/2fa/enable', { code: totpCode(setup.secret) }, token);
    expect(enabled.status).toBe(200);
    const { recoveryCodes } = await enabled.json();
    return { secret: setup.secret, recoveryCodes };
  }

  it('actualiza en silencio las contraseñas con menos coste de bcrypt al iniciar sesión', async () => {
    const email = newEmail();
    await register(email);
    const weak = await bcrypt.hash('Password123!', 4);
    await prisma.user.update({ where: { email }, data: { password: weak } });
    process.env.BCRYPT_COST = '6';
    try {
      expect((await login(email)).status).toBe(200);
      const stored = (await prisma.user.findUnique({ where: { email } })).password;
      expect(bcrypt.getRounds(stored)).toBe(6);
    } finally {
      process.env.BCRYPT_COST = '4';
    }
  });

  it('cerrar sesión en todos los dispositivos invalida los tokens anteriores y devuelve uno válido', async () => {
    const email = newEmail();
    const { token: a } = await register(email);
    const b = (await (await login(email)).json()).token;
    const res = await post('/api/auth/logout-all', {}, a);
    expect(res.status).toBe(200);
    const fresh = (await res.json()).token;
    expect((await get('/api/auth/security', a)).status).toBe(401);
    expect((await get('/api/auth/security', b)).status).toBe(401);
    expect((await get('/api/auth/security', fresh)).status).toBe(200);
  });

  it('activa la verificación en dos pasos: el login pide código y acepta TOTP o un código de recuperación (una vez)', async () => {
    const email = newEmail();
    const { token } = await register(email);
    const { secret, recoveryCodes } = await enable2fa(token);
    expect((await (await get('/api/auth/security', token)).json())).toMatchObject({ twoFactorEnabled: true, recoveryCodesLeft: 8 });

    const noCode = await login(email);
    expect(noCode.status).toBe(401);
    expect((await noCode.json()).twoFactorRequired).toBe(true);
    expect((await login(email, { code: '000000' })).status).toBe(401);

    // El código con el que se activó ya está usado: hace falta el del siguiente intervalo
    const next = totpCode(secret, Date.now() + 30_000);
    expect((await login(email, { code: next })).status).toBe(200);
    expect((await login(email, { code: next })).status).toBe(401); // reutilizado

    expect((await login(email, { code: recoveryCodes[0] })).status).toBe(200);
    expect((await login(email, { code: recoveryCodes[0] })).status).toBe(401); // un solo uso
    expect((await (await get('/api/auth/security', token)).json()).recoveryCodesLeft).toBe(7);
  });

  it('una contraseña incorrecta no revela si la cuenta tiene 2FA', async () => {
    const email = newEmail();
    const { token } = await register(email);
    await enable2fa(token);
    const res = await post('/api/auth/login', { email, password: 'incorrecta!!' });
    expect(res.status).toBe(401);
    expect((await res.json()).twoFactorRequired).toBeUndefined();
  });

  it('desactivar el 2FA exige contraseña y código', async () => {
    const email = newEmail();
    const { token } = await register(email);
    const { recoveryCodes } = await enable2fa(token);
    expect((await post('/api/auth/2fa/disable', { password: 'mala', code: recoveryCodes[0] }, token)).status).toBe(400);
    expect((await post('/api/auth/2fa/disable', { password: 'Password123!', code: '111111' }, token)).status).toBe(400);
    expect((await post('/api/auth/2fa/disable', { password: 'Password123!', code: recoveryCodes[1] }, token)).status).toBe(200);
    expect((await login(email)).status).toBe(200);
  });

  it('el cliente nunca ve ni puede escribir los datos de seguridad en las preferencias', async () => {
    const email = newEmail();
    const { token } = await register(email);
    await enable2fa(token);

    const pull = await (await get('/api/sync/pull?since=0', token)).json();
    expect(JSON.stringify(pull.preferences ?? {})).not.toContain('_security');
    const relog = await (await login(email, { code: 'x' })).json();
    expect(JSON.stringify(relog)).not.toContain('totp');

    // Intento de apagar el 2FA (y subir la versión de sesión) desde el push de preferencias
    const push = await post('/api/sync/push', { preferences: { theme: 'dark', updated_at: new Date().toISOString(), _security: { totp: { enabled: false } } } }, token);
    expect(push.status).toBe(200);
    const stored = (await prisma.user.findUnique({ where: { email } })).preferences;
    expect(stored.theme).toBe('dark');
    expect(stored._security.totp.enabled).toBe(true);
  });

  it('un dispositivo nuevo se recuerda (y el primero no genera aviso)', async () => {
    const email = newEmail();
    await register(email);
    await login(email, {}, 'Mozilla/5.0 Mac');
    await login(email, {}, 'Mozilla/5.0 Mac');
    await login(email, {}, 'Mozilla/5.0 Windows');
    const devices = (await prisma.user.findUnique({ where: { email } })).preferences._security.devices;
    expect(devices).toHaveLength(2);
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

  it('sincroniza preferencias con Last-Write-Wins entre dispositivos', async () => {
    const a = await register(`prefs${Date.now()}@example.com`);
    const t1 = new Date(Date.now() - 10000).toISOString();
    const t2 = new Date().toISOString();

    // Dispositivo 1 sube preferencias en t2 (más nuevas)
    await post('/api/sync/push', {
      preferences: {
        smartListVisibility: { smart_scheduled: false, smart_flagged: false },
        updated_at: t2,
      },
    }, a.token);

    let pull = await (await get('/api/sync/pull?lastToken=0', a.token)).json();
    expect(pull.preferences?.smartListVisibility?.smart_scheduled).toBe(false);

    // Dispositivo 2 intenta pisar con preferencias viejas t1 (no debe pisar)
    await post('/api/sync/push', {
      preferences: {
        smartListVisibility: { smart_scheduled: true, smart_flagged: true },
        updated_at: t1,
      },
    }, a.token);

    pull = await (await get('/api/sync/pull?lastToken=0', a.token)).json();
    expect(pull.preferences?.smartListVisibility?.smart_scheduled).toBe(false);
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

    // Comprobar endpoint de listas compartidas activas
    const idsRes = await get('/api/share/shared-list-ids', a.token);
    expect(idsRes.status).toBe(200);
    expect((await idsRes.json()).sharedListIds).toContain('compras');

    // Revocar
    const revoke = await fetch(`${base}/api/share/list/compras`, { method: 'DELETE', headers: { Authorization: `Bearer ${a.token}` } });
    expect(revoke.status).toBe(200);
    expect((await get(`/api/share/${token}`)).status).toBe(404);

    const idsAfter = await (await get('/api/share/shared-list-ids', a.token)).json();
    expect(idsAfter.sharedListIds).not.toContain('compras');
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

  it('agrupa subtareas con precios y cantidades mediante group_reminders y las actualiza con update_reminders', async () => {
    const a = await register(`mcp_group_${Date.now()}@example.com`);
    const groupRes = await (await rpc({
      method: 'tools/call',
      params: {
        name: 'group_reminders',
        arguments: {
          parentTitle: 'Productos de belleza',
          listName: 'compra',
          cycle: 'cycle_year',
          items: [
            { title: 'Sérum', price: 18, quantity: 3 },
            { title: 'Bálsamo labial', price: 3.5, quantity: 4 }
          ]
        }
      }
    }, a.token)).json();

    const groupData = JSON.parse(groupRes.result.content[0].text);
    expect(groupData.success).toBe(true);
    expect(groupData.childrenCount).toBe(2);
    expect(groupData.parent.title).toBe('Productos de belleza');
    expect(groupData.children[0].parentId).toBe(groupData.parent.id);
    expect(groupData.children[0].price).toBe(18);
    expect(groupData.children[0].quantity).toBe(3);

    // Actualizar con update_reminders
    const childId = groupData.children[0].id;
    const updRes = await (await rpc({
      method: 'tools/call',
      params: {
        name: 'update_reminders',
        arguments: {
          updates: [{ id: childId, price: 20, quantity: 5 }]
        }
      }
    }, a.token)).json();

    const updData = JSON.parse(updRes.result.content[0].text);
    expect(updData.success).toBe(true);
    expect(updData.updated[0].price).toBe(20);
    expect(updData.updated[0].quantity).toBe(5);
  });
});

describe('listas compartidas — privacidad', () => {
  it('solo expone los campos que pinta la vista pública', async () => {
    const a = await register(`priv${Date.now()}@example.com`);
    const t = new Date().toISOString();
    await post('/api/sync/push', {
      lists: [{ id: 'viaje', name: 'Viaje', color: '#0a84ff', updated_at: t, secreto: 'x' }],
      tasks: [{
        id: 'p1', title: 'Vuelo', categoryId: 'viaje', version: 1, updated_at: t, price: 99,
        people: ['Irantzu'], issuerMask: 'VISA •• 4821', managementUrl: 'https://cuenta.example/cancelar',
        location: { lat: 1, lng: 2 }, locationName: 'Casa', user_id: a.user.id,
      }],
    }, a.token);
    const { token } = await (await post('/api/share/generate', { listId: 'viaje' }, a.token)).json();
    const shared = await (await get(`/api/share/${token}`)).json();
    expect(Object.keys(shared.tasks[0]).sort()).toEqual(['id', 'price', 'title']);
    for (const leaked of ['people', 'issuerMask', 'managementUrl', 'location', 'locationName', 'user_id']) {
      expect(shared.tasks[0]).not.toHaveProperty(leaked);
    }
    expect(shared.tasks[0]).toMatchObject({ id: 'p1', title: 'Vuelo', price: 99 });
    expect(shared.list).not.toHaveProperty('secreto');
    expect(shared.list.name).toBe('Viaje');
  });
});

describe('tiempo real (SSE)', () => {
  it('el ticket es de un solo propósito: no vale como sesión y la sesión no vale como ticket', async () => {
    const a = await register(`sse${Date.now()}@example.com`);
    expect((await post('/api/sync/live-ticket', {})).status).toBe(401);
    const { ticket } = await (await post('/api/sync/live-ticket', {}, a.token)).json();
    expect(jwt.decode(ticket).purpose).toBe('live');
    expect(jwt.decode(ticket).exp - jwt.decode(ticket).iat).toBeLessThanOrEqual(60);
    // Un ticket no autentica ninguna ruta de la API…
    expect((await get('/api/sync/pull', ticket)).status).toBe(401);
    // …y el token de sesión ya no se acepta en la URL del canal en vivo.
    expect((await get(`/api/sync/live?ticket=${encodeURIComponent(a.token)}`)).status).toBe(401);
    expect((await get(`/api/sync/live?token=${encodeURIComponent(a.token)}`)).status).toBe(401);
  });
});

describe('límites de peticiones compartidos', () => {
  it('el contador vive en la base de datos: dos instancias suman sus intentos', async () => {
    const shared = createMemoryPrisma();
    const open = () => new Promise((resolve) => {
      const srv = createApp({ prisma: shared }).listen(0, () => resolve(srv));
    });
    const [a, b] = await Promise.all([open(), open()]);
    const call = (srv) => fetch(`http://127.0.0.1:${srv.address().port}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nadie@example.com', password: 'incorrecta!!' }),
    });
    try {
      for (let i = 0; i < 10; i++) expect((await call(i % 2 ? a : b)).status).toBe(401);
      const blocked = await call(a);
      expect(blocked.status).toBe(429);
      expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
      expect((await call(b)).status).toBe(429); // la otra instancia ve el mismo contador
      expect(shared._stores.limits.rows.length).toBeGreaterThan(0);
    } finally {
      a.close();
      b.close();
    }
  });

  it('si la base de datos falla, limita en memoria en lugar de dejar de proteger', async () => {
    const broken = createMemoryPrisma();
    let dbCalls = 0;
    broken.rateLimit.updateMany = async () => { dbCalls++; throw new Error('db caída'); };
    const srv = await new Promise((resolve) => { const s = createApp({ prisma: broken }).listen(0, () => resolve(s)); });
    try {
      const url = `http://127.0.0.1:${srv.address().port}/api/auth/login`;
      const call = () => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'x@example.com', password: 'incorrecta!!' }) });
      for (let i = 0; i < 10; i++) expect((await call()).status).toBe(401);
      expect((await call()).status).toBe(429);
      // Interruptor: tras el primer fallo no se vuelve a llamar a la BD (ni a registrar un error por petición).
      expect(dbCalls).toBe(1);
    } finally {
      srv.close();
    }
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
      expect((await get('/api/sync/live?ticket=x')).status).toBe(204);
    } finally {
      delete process.env.VERCEL;
    }
  });
});

describe('resetLinkBase', () => {
  it('en producción ignora la cabecera Origin (la controla el atacante)', () => {
    expect(resetLinkBase({ production: true, origin: 'https://evil.example', protocol: 'https', host: 'recordatorios.app' }))
      .toBe('https://recordatorios.app');
  });

  it('usa APP_URL cuando está configurada, sin barra final', () => {
    expect(resetLinkBase({ appUrl: 'https://recordatorios.app/', production: true, origin: 'https://evil.example', protocol: 'https', host: 'x' }))
      .toBe('https://recordatorios.app');
  });

  it('en desarrollo apunta al frontend que hizo la petición', () => {
    expect(resetLinkBase({ production: false, origin: 'http://localhost:5173', protocol: 'http', host: 'localhost:3001' }))
      .toBe('http://localhost:5173');
  });
});
