import { PrismaClient } from '@prisma/client';
import express from 'express';

// Extend Express Request directly here or in a separate custom.d.ts
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

export interface AppContext {
  prisma: PrismaClient;
  pushSender: ((subscription: any, message: any) => Promise<any>) | null;
  clients: Map<string, Set<express.Response>>;
  hit: (key: string, windowMs: number) => Promise<{ count: number; resetAt: number }>;
  requireSecret: (res: express.Response) => string | null;
  sessionResponse: (user: any, secret: string) => any;
  authenticateToken: (req: express.Request, res: express.Response, next: express.NextFunction) => void | Promise<void>;
  optionalAuthenticateToken: (req: express.Request, res: express.Response, next: express.NextFunction) => void | Promise<void>;
  bumpedSessions: (user: any) => any;
  hashPassword: (password: string) => Promise<string>;
  validatePassword: (password: string) => string | null;
  clientIp: (req: express.Request) => string;
  apiLimiter: express.RequestHandler;
  publicLimiter: express.RequestHandler;
  authRateLimit: express.RequestHandler;
  authIpLimiter: express.RequestHandler;
  loginLimiter: express.RequestHandler;
  changePasswordLimiter: express.RequestHandler;
  forgotLimiter: express.RequestHandler;
  createRateLimiter: (opts: any) => express.RequestHandler;
  safeEqual: (a: string | number, b: string | number) => boolean;
  emailRegex: RegExp;
  normalizeEmail: (email: string) => string;
  MAX_ITEMS_PER_COLLECTION: number;
  CRON_CONCURRENCY: number;
  isProduction: () => boolean;
  bcryptCost: () => number;
}
