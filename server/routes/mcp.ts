import type { AppContext } from '../context.js';
import express from 'express';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { isMailConfigured, sendPasswordResetEmail, sendSecurityEmail } from '../mail.js';
import { getSecurity, withSecurity, publicPreferences, stripSecurity, checkSecondFactor, noteDevice, deviceId, newTotpSecret, otpauthUrl, encryptSecret, decryptSecret, verifyTotp, generateRecoveryCodes, hashRecoveryCode } from '../security.js';
import { planNotifications, safeTimeZone } from '../notifications.js';
import { scopedId, clientIdOf, isValidClientId, shouldApplyIncoming, parseDeletedAt, toClientPayload, sanitizePayload } from '../syncUtils.js';
import { getJwtSecret, resetLinkBase, isAllowedPushEndpoint, MIN_PASSWORD_LENGTH } from '../app.js';
import { handleMcpRequest, MCP_TOOLS } from '../mcp.js';

export function createMcpRouter(context: AppContext) {
  const router = express.Router();
  const { prisma, pushSender, clients, hit, requireSecret, sessionResponse, authenticateToken, optionalAuthenticateToken, bumpedSessions, hashPassword, validatePassword, clientIp, apiLimiter, publicLimiter, authRateLimit, authIpLimiter, loginLimiter, changePasswordLimiter, forgotLimiter, safeEqual, emailRegex, normalizeEmail, MAX_ITEMS_PER_COLLECTION, CRON_CONCURRENCY } = context;

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
