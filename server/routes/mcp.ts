import { randomUUID } from 'node:crypto';
import type { AppContext } from '../context.js';
import express from 'express';
import { handleMcpRequest, MCP_TOOLS } from '../mcp.js';

interface McpSession {
  sessionId: string;
  userId: string;
  res: express.Response;
  pingTimer: NodeJS.Timeout;
}

export function createMcpRouter(context: AppContext) {
  const router = express.Router();
  const { prisma, optionalAuthenticateToken, apiLimiter, publicLimiter } = context;

  const sessions = new Map<string, McpSession>();

  // --- SSE (Server-Sent Events) Transport para clientes remotos (Claude, Cursor, etc.) ---
  router.get(['/mcp/sse', '/api/mcp/sse'], apiLimiter, optionalAuthenticateToken, (req: express.Request, res: express.Response) => {
    const userId = req.user?.id || '';
    if (!userId) {
      res.status(401).json({ error: 'Autenticación requerida. Pasa tu token en Authorization: Bearer <token> o ?token=<token>.' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();

    const sessionId = randomUUID();
    const endpointUrl = `/api/mcp/messages?sessionId=${sessionId}`;

    res.write(`event: endpoint\ndata: ${endpointUrl}\n\n`);

    const pingTimer = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        clearInterval(pingTimer);
      }
    }, 15000);

    const session: McpSession = { sessionId, userId, res, pingTimer };
    sessions.set(sessionId, session);

    req.on('close', () => {
      clearInterval(pingTimer);
      sessions.delete(sessionId);
    });
  });

  // --- Mensajes entrantes para sesiones SSE ---
  router.post(['/mcp/messages', '/api/mcp/messages'], apiLimiter, optionalAuthenticateToken, async (req: express.Request, res: express.Response) => {
    const sessionId = typeof req.query?.sessionId === 'string' ? req.query.sessionId : null;
    if (!sessionId) {
      res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32602, message: 'Falta el parámetro sessionId en la query' } });
      return;
    }

    const session = sessions.get(sessionId);
    if (!session) {
      res.status(404).json({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Sesión MCP no encontrada o expirada' } });
      return;
    }
    if (!req.user?.id || req.user.id !== session.userId) {
      res.status(req.user?.id ? 403 : 401).json({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'La sesión MCP pertenece a otro usuario o requiere autenticación' } });
      return;
    }

    try {
      const response = await handleMcpRequest(req.body, prisma, session.userId);
      session.res.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
      res.status(202).send('Accepted');
    } catch (err) {
      console.error('MCP session message error:', err);
      const errResp = { jsonrpc: '2.0', id: req.body?.id ?? null, error: { code: -32000, message: 'Error interno en sesión MCP' } };
      session.res.write(`event: message\ndata: ${JSON.stringify(errResp)}\n\n`);
      res.status(500).json(errResp);
    }
  });

  // --- JSON-RPC 2.0 Direct HTTP (POST /mcp o /api/mcp) ---
  router.post(['/mcp', '/api/mcp'], apiLimiter, optionalAuthenticateToken, async (req: express.Request, res: express.Response) => {
    try {
      res.json(await handleMcpRequest(req.body, prisma, req.user?.id || ''));
    } catch (err) {
      console.error('MCP route error:', err);
      res.status(500).json({ jsonrpc: '2.0', id: req.body?.id ?? null, error: { code: -32000, message: 'Internal Server Error' } });
    }
  });

  // --- Info y descubrimiento ---
  router.get(['/api/mcp', '/mcp', '/api/mcp/tools', '/mcp/tools'], publicLimiter, (req: express.Request, res: express.Response) => {
    res.json({
      name: 'Recordatorios MCP Server',
      version: '1.2.0',
      protocolVersion: '2024-11-05',
      transports: {
        sse: '/api/mcp/sse',
        messages: '/api/mcp/messages',
        httpPost: '/api/mcp'
      },
      tools: MCP_TOOLS
    });
  });

  return router;
}
