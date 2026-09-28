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
  },
  {
    name: 'group_reminders',
    description: 'Agrupa múltiples recordatorios bajo un recordatorio principal padre (creándolo si no existe), asignando subtareas con precio unitario, cantidad y ciclo para calcular el total acumulado.',
    inputSchema: {
      type: 'object',
      properties: {
        parentTitle: { type: 'string', description: 'Título del recordatorio padre (ej: "Productos de belleza")' },
        parentId: { type: 'string', description: 'ID del recordatorio padre si ya existe' },
        listName: { type: 'string', description: 'Nombre de la lista donde agrupar (ej: "compra", "Inbox")' },
        listId: { type: 'string', description: 'ID de la lista destino si se conoce' },
        sectionId: { type: 'string', description: 'ID de la sección destino si se conoce' },
        cycle: { type: 'string', enum: ['cycle_day', 'cycle_week', 'cycle_month', 'cycle_year'], description: 'Frecuencia de recurrencia para el grupo' },
        childTaskIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs de recordatorios existentes que deben convertirse en subtareas del padre'
        },
        items: {
          type: 'array',
          description: 'Detalles de las subtareas a asociar o actualizar con precio y cantidad',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'ID de la tarea existente si se conoce' },
              title: { type: 'string', description: 'Título de la subtarea' },
              price: { type: 'number', description: 'Precio unitario en euros' },
              quantity: { type: 'number', description: 'Cantidad de unidades' },
              cycle: { type: 'string', enum: ['cycle_day', 'cycle_week', 'cycle_month', 'cycle_year'] }
            },
            required: ['title']
          }
        }
      },
      required: ['parentTitle']
    }
  },
  {
    name: 'update_reminders',
    description: 'Actualiza uno o más recordatorios existentes (precio, cantidad, lista, sección, ciclo, subtarea/padre, título, estado, descripción).',
    inputSchema: {
      type: 'object',
      properties: {
        updates: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'ID del recordatorio a actualizar' },
              title: { type: 'string', description: 'Nuevo título (opcional)' },
              price: { type: 'number', description: 'Precio unitario en euros (opcional)' },
              quantity: { type: 'number', description: 'Cantidad de unidades (opcional)' },
              parentId: { type: 'string', description: 'ID del recordatorio padre (o vacío para desanidar)' },
              sectionId: { type: 'string', description: 'ID de la sección destino' },
              cycle: { type: 'string', enum: ['cycle_day', 'cycle_week', 'cycle_month', 'cycle_year'], description: 'Ciclo de recurrencia' },
              listId: { type: 'string', description: 'ID de la lista destino' },
              status: { type: 'string', enum: ['pending', 'completed'] },
              description: { type: 'string', description: 'Notas o descripción' }
            },
            required: ['id']
          }
        }
      },
      required: ['updates']
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

      // Tareas activas existentes del usuario para evitar duplicados en el MCP
      const existingTaskRows = await prisma.task.findMany({ where: { userId, deletedAt: null } });
      const existingTasks = existingTaskRows.map((r) => ({ ...toClientPayload(userId, r), _rowId: r.id }));

      const now = new Date().toISOString();
      const created = [];
      const ops = [];

      for (const r of reminders) {
        const title = cleanString(r?.title, 300);
        if (!title) continue;
        const catId = resolveList(r);
        const normTitle = title.toLowerCase().trim();

        // Evitar duplicados: si ya existe una tarea idéntica pendiente en la misma lista, actualizar en vez de duplicar
        const existingTask = existingTasks.find(
          (t) => t.status !== 'completed' &&
                 String(t.categoryId || 'inbox') === String(catId) &&
                 String(t.title || '').toLowerCase().trim() === normTitle
        );

        const dueDate = r.dueDate && !Number.isNaN(new Date(r.dueDate).getTime()) ? new Date(r.dueDate).toISOString() : undefined;

        if (existingTask) {
          const rowId = existingTask._rowId || scopedId(userId, existingTask.id);
          const updatedPayload = {
            ...existingTask,
            dueDate: dueDate || existingTask.dueDate,
            price: cleanNumber(r.price) ?? existingTask.price,
            description: cleanString(r.description, 2000) || existingTask.description,
            updated_at: now,
            version: (existingTask.version || 1) + 1,
          };
          delete updatedPayload._rowId;
          created.push(updatedPayload);
          ops.push(
            prisma.task.update({
              where: { id: rowId },
              data: { payload: updatedPayload, updatedAt: new Date() },
            })
          );
          continue;
        }

        const task = {
          id: randomUUID(),
          user_id: userId,
          type: 'task',
          title,
          description: cleanString(r.description, 2000) || undefined,
          categoryId: catId,
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
        ops.push(prisma.task.create({ data: { id: scopedId(userId, task.id), userId, payload: task } }));
      }
      if (created.length === 0) return rpcError(id, -32602, 'Ningún recordatorio tenía título');

      if (ops.length > 0) {
        await prisma.$transaction(ops);
      }
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

    if (toolName === 'group_reminders') {
      const parentTitle = cleanString(args.parentTitle, 300);
      if (!parentTitle) return rpcError(id, -32602, 'El título del recordatorio padre es obligatorio');

      const listRows = await prisma.list.findMany({ where: { userId, deletedAt: null } });
      const userLists = listRows.map((r) => toClientPayload(userId, r)).filter((l) => !isSettingsList(l));
      const resolveList = (lid, lname) => {
        const explicit = cleanString(lid, 200);
        if (explicit && userLists.some((l) => l.id === explicit)) return explicit;
        const byName = cleanString(lname, 120)?.toLowerCase();
        const match = byName && userLists.find((l) => String(l.name || '').toLowerCase() === byName);
        return match ? match.id : 'inbox';
      };

      const existingTaskRows = await prisma.task.findMany({ where: { userId, deletedAt: null } });
      const existingTasks = existingTaskRows.map((r) => ({ ...toClientPayload(userId, r), _rowId: r.id }));

      const now = new Date().toISOString();
      const ops = [];
      const updatedChildren = [];

      // 1. Resolver o crear tarea padre
      let parentTask = null;
      if (args.parentId) {
        parentTask = existingTasks.find((t) => t.id === args.parentId || t._rowId === args.parentId || scopedId(userId, t.id) === args.parentId);
      }
      if (!parentTask) {
        const normParent = parentTitle.toLowerCase().trim();
        parentTask = existingTasks.find((t) => String(t.title || '').toLowerCase().trim() === normParent && !t.parentId);
      }

      const cycle = VALID_CYCLES.has(args.cycle) ? args.cycle : undefined;
      const targetCat = resolveList(args.listId, args.listName || 'compra');
      const targetSec = cleanString(args.sectionId, 100);

      if (!parentTask) {
        const newParentId = randomUUID();
        parentTask = {
          id: newParentId,
          user_id: userId,
          type: 'task',
          title: parentTitle,
          categoryId: targetCat,
          sectionId: targetSec || (targetCat === 'compra' ? 'sec_compra_anuales' : undefined),
          cycle_id: cycle || 'cycle_year',
          status: 'pending',
          version: 1,
          created_at: now,
          updated_at: now,
        };
        ops.push(prisma.task.create({ data: { id: scopedId(userId, parentTask.id), userId, payload: parentTask } }));
      } else {
        const updatedParent = {
          ...parentTask,
          categoryId: targetCat || parentTask.categoryId,
          sectionId: targetSec || parentTask.sectionId,
          cycle_id: cycle || parentTask.cycle_id,
          updated_at: now,
          version: (parentTask.version || 1) + 1,
        };
        const rowId = parentTask._rowId || scopedId(userId, parentTask.id);
        delete updatedParent._rowId;
        parentTask = updatedParent;
        ops.push(prisma.task.update({
          where: { id: rowId },
          data: { payload: updatedParent, updatedAt: new Date() }
        }));
      }

      // 2. Agrupar childTaskIds
      const childIds = Array.isArray(args.childTaskIds) ? args.childTaskIds : [];
      for (const cid of childIds) {
        const existingChild = existingTasks.find((t) => t.id === cid || t._rowId === cid || scopedId(userId, t.id) === cid);
        if (existingChild && existingChild.id !== parentTask.id) {
          const rowId = existingChild._rowId || scopedId(userId, existingChild.id);
          const updatedChild = {
            ...existingChild,
            parentId: parentTask.id,
            categoryId: parentTask.categoryId,
            sectionId: parentTask.sectionId,
            cycle_id: cycle || parentTask.cycle_id || existingChild.cycle_id,
            updated_at: now,
            version: (existingChild.version || 1) + 1,
          };
          delete updatedChild._rowId;
          updatedChildren.push(updatedChild);
          ops.push(prisma.task.update({
            where: { id: rowId },
            data: { payload: updatedChild, updatedAt: new Date() }
          }));
        }
      }

      // 3. Procesar items con precios y cantidades
      const items = Array.isArray(args.items) ? args.items : [];
      for (const item of items) {
        const itemTitle = cleanString(item.title, 300);
        if (!itemTitle) continue;
        const norm = itemTitle.toLowerCase().trim();

        // Buscar si ya existe: primero por ID o coincidencia exacta de título en la misma lista
        let existing = existingTasks.find((t) =>
          item.id && (t.id === item.id || t._rowId === item.id || scopedId(userId, t.id) === item.id)
        );
        if (!existing) {
          existing = existingTasks.find((t) =>
            String(t.categoryId || '') === String(parentTask.categoryId || '') &&
            String(t.title || '').toLowerCase().trim() === norm
          );
        }
        if (!existing) {
          existing = existingTasks.find((t) =>
            String(t.title || '').toLowerCase().trim() === norm
          );
        }
        if (!existing) {
          existing = existingTasks.find((t) =>
            String(t.categoryId || '') === String(parentTask.categoryId || '') &&
            (String(t.title || '').toLowerCase().trim().startsWith(norm) ||
             norm.startsWith(String(t.title || '').toLowerCase().trim()))
          );
        }

        const price = cleanNumber(item.price);
        const quantity = cleanNumber(item.quantity) || 1;
        const itemCycle = VALID_CYCLES.has(item.cycle) ? item.cycle : (cycle || parentTask.cycle_id);

        if (existing && existing.id !== parentTask.id) {
          const rowId = existing._rowId || scopedId(userId, existing.id);
          const updatedChild = {
            ...existing,
            parentId: parentTask.id,
            categoryId: parentTask.categoryId,
            sectionId: parentTask.sectionId,
            price: price !== undefined ? price : existing.price,
            quantity: quantity !== undefined ? quantity : existing.quantity,
            cycle_id: itemCycle || existing.cycle_id,
            updated_at: now,
            version: (existing.version || 1) + 1,
          };
          delete updatedChild._rowId;
          updatedChildren.push(updatedChild);
          ops.push(prisma.task.update({
            where: { id: rowId },
            data: { payload: updatedChild, updatedAt: new Date() }
          }));
        } else {
          const newChild = {
            id: randomUUID(),
            user_id: userId,
            type: 'task',
            title: itemTitle,
            parentId: parentTask.id,
            categoryId: parentTask.categoryId,
            sectionId: parentTask.sectionId,
            price,
            quantity,
            cycle_id: itemCycle,
            status: 'pending',
            version: 1,
            created_at: now,
            updated_at: now,
          };
          Object.keys(newChild).forEach((k) => newChild[k] === undefined && delete newChild[k]);
          updatedChildren.push(newChild);
          ops.push(prisma.task.create({
            data: { id: scopedId(userId, newChild.id), userId, payload: newChild }
          }));
        }
      }

      if (ops.length > 0) {
        await prisma.$transaction(ops);
      }

      return rpcResult(id, {
        success: true,
        parent: parentTask,
        childrenCount: updatedChildren.length,
        children: updatedChildren
      });
    }

    if (toolName === 'update_reminders') {
      const updates = Array.isArray(args.updates) ? args.updates.slice(0, 100) : [];
      if (updates.length === 0) return rpcError(id, -32602, 'Debes enviar al menos un recordatorio para actualizar');

      const existingTaskRows = await prisma.task.findMany({ where: { userId, deletedAt: null } });
      const existingTasks = existingTaskRows.map((r) => ({ ...toClientPayload(userId, r), _rowId: r.id }));

      const now = new Date().toISOString();
      const ops = [];
      const updated = [];

      for (const u of updates) {
        const targetId = cleanString(u.id, 200);
        if (!targetId) continue;
        const task = existingTasks.find((t) => t.id === targetId || t._rowId === targetId || scopedId(userId, t.id) === targetId);
        if (!task) continue;

        const rowId = task._rowId || scopedId(userId, task.id);
        const updatedPayload = { ...task };
        if (u.title !== undefined) updatedPayload.title = cleanString(u.title, 300) || task.title;
        if (u.price !== undefined) updatedPayload.price = cleanNumber(u.price);
        if (u.quantity !== undefined) updatedPayload.quantity = cleanNumber(u.quantity);
        if (u.parentId !== undefined) updatedPayload.parentId = cleanString(u.parentId, 200) || undefined;
        if (u.sectionId !== undefined) updatedPayload.sectionId = cleanString(u.sectionId, 100) || undefined;
        if (u.listId !== undefined) updatedPayload.categoryId = cleanString(u.listId, 200) || task.categoryId;
        if (u.cycle !== undefined && VALID_CYCLES.has(u.cycle)) updatedPayload.cycle_id = u.cycle;
        if (u.status !== undefined && (u.status === 'pending' || u.status === 'completed')) updatedPayload.status = u.status;
        if (u.description !== undefined) updatedPayload.description = cleanString(u.description, 2000);

        updatedPayload.updated_at = now;
        updatedPayload.version = (task.version || 1) + 1;
        delete updatedPayload._rowId;

        updated.push(updatedPayload);
        ops.push(prisma.task.update({
          where: { id: rowId },
          data: { payload: updatedPayload, updatedAt: new Date() }
        }));
      }

      if (ops.length > 0) {
        await prisma.$transaction(ops);
      }

      return rpcResult(id, { success: true, count: updated.length, updated });
    }

    return rpcError(id, -32601, `Herramienta no encontrada: ${toolName}`);
  } catch (err) {
    console.error('MCP execution error:', err);
    return rpcError(id, -32000, 'Error interno ejecutando la herramienta MCP');
  }
}
