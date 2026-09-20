import { randomUUID } from 'node:crypto';
import { scopedId, toClientPayload } from './syncUtils.js';

// MCP (Model Context Protocol) Server implementation
// Implements JSON-RPC 2.0 endpoints for tools/list and tools/call

export const MCP_TOOLS = [
  {
    name: 'list_lists',
    description: 'Obtiene las listas y carpetas de recordatorios del usuario para saber dónde organizar tareas.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'create_list',
    description: 'Crea una nueva lista de recordatorios con un nombre, color e icono opcional.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre de la lista (ej: "Viaje a Roma", "Reforma Casa")' },
        color: { type: 'string', description: 'Color hexadecimal o nombre CSS (ej: "#007aff", "#ff9500")' },
        icon: { type: 'string', description: 'Nombre del icono (ej: "plane", "home", "shopping-cart")' }
      },
      required: ['name']
    }
  },
  {
    name: 'create_reminders',
    description: 'Crea uno o varios recordatorios estructurados en las listas del usuario basándose en sus instrucciones.',
    inputSchema: {
      type: 'object',
      properties: {
        reminders: {
          type: 'array',
          description: 'Lista de recordatorios a crear',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Título claro y conciso del recordatorio' },
              description: { type: 'string', description: 'Notas adicionales o detalles' },
              listName: { type: 'string', description: 'Nombre de la lista destino sugerida (ej: "Compras", "Inbox")' },
              listId: { type: 'string', description: 'ID de la lista destino si se conoce' },
              dueDate: { type: 'string', description: 'Fecha y hora límite en formato ISO 8601' },
              timeOfDay: { type: 'string', enum: ['morning', 'afternoon', 'night'], description: 'Franja horaria: morning (mañana), afternoon (tarde), night (noche)' },
              price: { type: 'number', description: 'Precio o presupuesto asociado en euros (si aplica)' },
              quantity: { type: 'number', description: 'Cantidad de unidades (opcional)' },
              priority: { type: 'string', enum: ['none', 'low', 'medium', 'high'], description: 'Nivel de prioridad' },
              cycle: { type: 'string', enum: ['cycle_day', 'cycle_week', 'cycle_month', 'cycle_year'], description: 'Frecuencia de recurrencia si es periódica' }
            },
            required: ['title']
          }
        }
      },
      required: ['reminders']
    }
  },
  {
    name: 'query_reminders',
    description: 'Busca recordatorios existentes del usuario para verificar tareas pendientes o evitar duplicados.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Texto de búsqueda' },
        listId: { type: 'string', description: 'Filtrar por ID de lista opcional' }
      }
    }
  }
];

const rpcResult = (id, data) => ({
  jsonrpc: '2.0',
  id,
  result: { content: [{ type: 'text', text: JSON.stringify(data) }] },
});
const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

const VALID_PRIORITIES = new Set(['none', 'low', 'medium', 'high']);
const VALID_TIMES = new Set(['morning', 'afternoon', 'night']);
const VALID_CYCLES = new Set(['cycle_day', 'cycle_week', 'cycle_month', 'cycle_year']);
const cleanString = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);
const cleanNumber = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const isSettingsList = (l) => typeof l?.id === 'string' && l.id.startsWith('user_preferences_');

export async function handleMcpRequest(reqBody, prisma, userId) {
  const { jsonrpc, id = null, method, params } = reqBody || {};

  if (jsonrpc !== '2.0' || typeof method !== 'string') {
    return rpcError(id, -32600, 'Invalid Request: se requiere JSON-RPC 2.0');
  }

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'Recordatorios MCP Server', version: '1.1.0' },
        capabilities: { tools: {} },
      },
    };
  }

  if (method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: { tools: MCP_TOOLS } };
  }

  if (method !== 'tools/call') {
    return rpcError(id, -32601, `Método JSON-RPC no soportado: ${method}`);
  }

  const toolName = params?.name;
  const args = params?.arguments || {};
  if (!toolName) return rpcError(id, -32602, 'Falta el nombre de la herramienta en params.name');
  if (!MCP_TOOLS.some((t) => t.name === toolName)) return rpcError(id, -32601, `Herramienta no encontrada: ${toolName}`);
  if (!userId) {
    return rpcError(id, -32001, 'Autenticación requerida: envía "Authorization: Bearer <token>" de tu sesión.');
  }

  try {
    if (toolName === 'list_lists') {
      const rows = await prisma.list.findMany({ where: { userId, deletedAt: null } });
      const lists = rows.map((r) => toClientPayload(userId, r)).filter((l) => !isSettingsList(l));
      return rpcResult(id, { lists: lists.map(({ id: lid, name, color, icon, parentId, isFolder }) => ({ id: lid, name, color, icon, parentId, isFolder })) });
    }

    if (toolName === 'create_list') {
      const name = cleanString(args.name, 120);
      if (!name) return rpcError(id, -32602, 'El nombre de la lista es obligatorio');
      const now = new Date().toISOString();
      const clientId = `list_${randomUUID()}`;
      const payload = {
        id: clientId,
        name,
        color: cleanString(args.color, 32) || '#007aff',
        icon: cleanString(args.icon, 40) || 'list',
        created_at: now,
        updated_at: now,
      };
      await prisma.list.create({ data: { id: scopedId(userId, clientId), userId, payload } });
      return rpcResult(id, { success: true, list: payload });
    }

    if (toolName === 'create_reminders') {
      const reminders = Array.isArray(args.reminders) ? args.reminders.slice(0, 100) : [];
      if (reminders.length === 0) return rpcError(id, -32602, 'Debes enviar al menos un recordatorio');

      // Resolver listName -> id existente del usuario (por nombre, sin distinguir mayúsculas).
      const listRows = await prisma.list.findMany({ where: { userId, deletedAt: null } });
      const userLists = listRows.map((r) => toClientPayload(userId, r)).filter((l) => !isSettingsList(l));
      const resolveList = (r) => {
        const explicit = cleanString(r.listId, 200);
        if (explicit && userLists.some((l) => l.id === explicit)) return explicit;
        const byName = cleanString(r.listName, 120)?.toLowerCase();
        const match = byName && userLists.find((l) => String(l.name || '').toLowerCase() === byName);
        return match ? match.id : 'inbox';
      };

      const now = new Date().toISOString();
      const created = [];
      for (const r of reminders) {
        const title = cleanString(r?.title, 300);
        if (!title) continue;
        const dueDate = r.dueDate && !Number.isNaN(new Date(r.dueDate).getTime()) ? new Date(r.dueDate).toISOString() : undefined;
        const task = {
          id: randomUUID(),
          user_id: userId,
          type: 'task',
          title,
          description: cleanString(r.description, 2000) || undefined,
          categoryId: resolveList(r),
          dueDate,
          timeOfDay: VALID_TIMES.has(r.timeOfDay) ? r.timeOfDay : undefined,
          price: cleanNumber(r.price),
          quantity: cleanNumber(r.quantity),
          priority: VALID_PRIORITIES.has(r.priority) ? r.priority : 'none',
          cycle_id: VALID_CYCLES.has(r.cycle) ? r.cycle : undefined,
          status: 'pending',
          version: 1,
          created_at: now,
          updated_at: now,
        };
        Object.keys(task).forEach((k) => task[k] === undefined && delete task[k]);
        created.push(task);
      }
      if (created.length === 0) return rpcError(id, -32602, 'Ningún recordatorio tenía título');

      await prisma.$transaction(
        created.map((task) => prisma.task.create({ data: { id: scopedId(userId, task.id), userId, payload: task } }))
      );
      return rpcResult(id, { success: true, count: created.length, reminders: created });
    }

    if (toolName === 'query_reminders') {
      const query = (cleanString(args.query, 200) || '').toLowerCase();
      const listId = cleanString(args.listId, 200);
      const rows = await prisma.task.findMany({ where: { userId, deletedAt: null } });
      const tasks = rows
        .map((r) => toClientPayload(userId, r))
        .filter((t) => !query || String(t.title || '').toLowerCase().includes(query))
        .filter((t) => !listId || t.categoryId === listId)
        .slice(0, 200);
      return rpcResult(id, { count: tasks.length, tasks });
    }

    return rpcError(id, -32601, `Herramienta no encontrada: ${toolName}`);
  } catch (err) {
    console.error('MCP execution error:', err);
    return rpcError(id, -32000, 'Error interno ejecutando la herramienta MCP');
  }
}
