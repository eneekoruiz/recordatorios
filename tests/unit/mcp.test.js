import { describe, it, expect, beforeEach } from 'vitest';
import { handleMcpRequest } from '../../server/mcp.js';
import { createMemoryPrisma } from '../support/memoryPrisma.js';

const U = 'u1';
let prisma;

const addTask = (id, payload = {}) =>
  prisma.task.create({ data: { id: `${U}:${id}`, userId: U, payload: { id, title: id, categoryId: 'inbox', status: 'pending', version: 1, ...payload } } });
const call = async (name, args) => {
  const res = await handleMcpRequest({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, prisma, U);
  return res.result ? JSON.parse(res.result.content[0].text) : res;
};
const payloadOf = async (id) => (await prisma.task.findMany({ where: { userId: U } })).find((r) => r.id === `${U}:${id}`).payload;

describe('MCP — integridad de datos', () => {
  beforeEach(() => {
    prisma = createMemoryPrisma();
  });

  it('group_reminders no reasigna una tarea con título vacío', async () => {
    await addTask('vacia', { title: '' });
    const out = await call('group_reminders', { parentTitle: 'Desayuno', items: [{ title: 'Leche' }] });
    expect(out.children).toHaveLength(1);
    expect(out.children[0].title).toBe('Leche');
    expect((await payloadOf('vacia')).parentId).toBeUndefined();
  });

  it('group_reminders no reasigna tareas por parecido de título (prefijo ni otra lista)', async () => {
    await addTask('almendras', { title: 'Leche de almendras', categoryId: 'compra' });
    await addTask('otra', { title: 'Leche', categoryId: 'trabajo' });
    const out = await call('group_reminders', { parentTitle: 'Desayuno', listName: 'compra', items: [{ title: 'Leche' }] });
    expect(out.children).toHaveLength(1);
    expect(out.children[0].id).not.toBe('otra');
    expect((await payloadOf('almendras')).parentId).toBeUndefined();
    expect((await payloadOf('otra')).parentId).toBeUndefined();
  });

  it('group_reminders sigue reutilizando una tarea con el mismo título exacto en la lista', async () => {
    await addTask('leche', { title: 'Leche', categoryId: 'inbox' });
    const out = await call('group_reminders', { parentTitle: 'Desayuno', listId: 'inbox', items: [{ title: 'leche', price: 2 }] });
    expect(out.children[0].id).toBe('leche');
    expect((await payloadOf('leche')).price).toBe(2);
  });

  it('group_reminders no crea ciclos con childTaskIds', async () => {
    await addTask('padre');
    await addTask('hijo', { parentId: 'padre' });
    const out = await call('group_reminders', { parentTitle: 'hijo', parentId: 'hijo', childTaskIds: ['padre'] });
    expect(out.success).toBe(true);
    expect((await payloadOf('padre')).parentId).toBeUndefined();
  });

  it('update_reminders rechaza auto-referencias, ciclos y padres inexistentes', async () => {
    await addTask('a');
    await addTask('b', { parentId: 'a' });
    await call('update_reminders', { updates: [{ id: 'a', parentId: 'a' }, { id: 'a', parentId: 'b' }, { id: 'b', parentId: 'no-existe' }] });
    expect((await payloadOf('a')).parentId).toBeUndefined();
    expect((await payloadOf('b')).parentId).toBe('a');
  });

  it('update_reminders acepta un padre válido y permite desanidar', async () => {
    await addTask('a');
    await addTask('b');
    await call('update_reminders', { updates: [{ id: 'b', parentId: 'a' }] });
    expect((await payloadOf('b')).parentId).toBe('a');
    await call('update_reminders', { updates: [{ id: 'b', parentId: '' }] });
    expect((await payloadOf('b')).parentId).toBeUndefined();
  });

  it('create_reminders no fusiona con una tarea de título vacío', async () => {
    await addTask('vacia', { title: '' });
    const out = await call('create_reminders', { reminders: [{ title: '  ' }, { title: 'Nueva' }] });
    expect(out.count).toBe(1);
    expect((await payloadOf('vacia')).title).toBe('');
  });
});
