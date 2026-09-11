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

export async function handleMcpRequest(reqBody, prisma, userId) {
  const { jsonrpc, id, method, params } = reqBody || {};

  if (jsonrpc !== '2.0' && !method) {
    // También aceptamos llamadas directas tipo REST
    return {
      jsonrpc: '2.0',
      id: id || 1,
      error: { code: -32600, message: 'Invalid Request: se requiere JSON-RPC 2.0' }
    };
  }

  // 1. tools/list
  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: MCP_TOOLS
      }
    };
  }

  // 2. tools/call
  if (method === 'tools/call') {
    const toolName = params?.name;
    const toolArgs = params?.arguments || {};

    if (!toolName) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32602, message: 'Falta el nombre de la herramienta en params.name' }
      };
    }

    try {
      if (toolName === 'list_lists') {
        let lists = [];
        if (userId && prisma) {
          lists = await prisma.list.findMany({ where: { userId, deletedAt: null } });
        }
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ lists: lists.map(l => l.payload || l) })
              }
            ]
          }
        };
      }

      if (toolName === 'create_list') {
        const { name, color = '#007aff', icon = 'list' } = toolArgs;
        const newListId = `list_${Date.now()}`;
        const listPayload = {
          id: newListId,
          name,
          color,
          icon,
          created_at: new Date().toISOString()
        };

        if (userId && prisma) {
          await prisma.list.create({
            data: {
              id: newListId,
              userId,
              name,
              color,
              payload: listPayload
            }
          });
        }

        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: true, list: listPayload })
              }
            ]
          }
        };
      }

      if (toolName === 'create_reminders') {
        const reminders = toolArgs.reminders || [];
        const created = reminders.map(r => ({
          id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          title: r.title,
          description: r.description || '',
          categoryId: r.listId || (r.listName ? `list_${r.listName.toLowerCase().replace(/\s+/g, '_')}` : 'inbox'),
          dueDate: r.dueDate,
          timeOfDay: r.timeOfDay,
          price: r.price,
          quantity: r.quantity,
          priority: r.priority || 'none',
          cycle_id: r.cycle,
          status: 'pending',
          created_at: new Date().toISOString()
        }));

        if (userId && prisma && created.length > 0) {
          for (const item of created) {
            await prisma.task.create({
              data: {
                id: item.id,
                userId,
                title: item.title,
                status: 'pending',
                payload: item
              }
            });
          }
        }

        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: true, count: created.length, reminders: created })
              }
            ]
          }
        };
      }

      if (toolName === 'query_reminders') {
        const query = (toolArgs.query || '').toLowerCase();
        let tasks = [];
        if (userId && prisma) {
          const allTasks = await prisma.task.findMany({ where: { userId, deletedAt: null } });
          tasks = allTasks
            .map(t => t.payload || t)
            .filter(t => !query || (t.title && t.title.toLowerCase().includes(query)));
        }

        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ count: tasks.length, tasks })
              }
            ]
          }
        };
      }

      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Herramienta no encontrada: ${toolName}` }
      };
    } catch (err) {
      console.error('MCP execution error:', err);
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32000, message: err.message || 'Error interno ejecutando la herramienta MCP' }
      };
    }
  }

  return {
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: `Método JSON-RPC no soportado: ${method}` }
  };
}
