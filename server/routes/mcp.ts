import type { AppContext } from '../context.js';
import express from 'express';
import { handleMcpRequest, MCP_TOOLS } from '../mcp.js';

export function createMcpRouter(context: AppContext) {
  const router = express.Router();
  const { prisma, optionalAuthenticateToken, apiLimiter, publicLimiter } = context;

  // --- MCP (Model Context Protocol) ---
  router.post('/mcp', apiLimiter, optionalAuthenticateToken, async (req: express.Request, res: express.Response) => {
    try {
      res.json(await handleMcpRequest(req.body, prisma, req.user?.id || ''));
    } catch (err) {
      console.error('MCP route error:', err);
      res.status(500).json({ jsonrpc: '2.0', id: req.body?.id ?? null, error: { code: -32000, message: 'Internal Server Error' } });
    }
  });

  router.get(['/api/mcp', '/mcp', '/api/mcp/tools', '/mcp/tools'], publicLimiter, (req: express.Request, res: express.Response) => {
    res.json({ name: 'Recordatorios MCP Server', version: '1.1.0', protocolVersion: '2024-11-05', tools: MCP_TOOLS });
  });


  return router;
}
