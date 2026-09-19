import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { handleMcpRequest, MCP_TOOLS } from './mcp.js';

dotenv.config();

const app = express();
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.warn('⚠️ DATABASE_URL no está configurada en las variables de entorno.');
}
const prisma = new PrismaClient(dbUrl ? { datasourceUrl: dbUrl } : undefined);
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_recordatorios';
const clients = new Map(); // userId -> Set of Response objects

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- SECURITY HEADERS ---
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// --- IN-MEMORY RATE LIMITER FOR AUTH ---
const authAttempts = new Map(); // ip -> { count, resetTime }
const authRateLimiter = (req, res, next) => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : null) || req.socket?.remoteAddress || req.ip || 'unknown';
  const now = Date.now();
  const record = authAttempts.get(ip) || { count: 0, resetTime: now + 15 * 60 * 1000 };

  if (now > record.resetTime) {
    record.count = 0;
    record.resetTime = now + 15 * 60 * 1000;
  }

  record.count += 1;
  authAttempts.set(ip, record);

  if (record.count > 60) {
    return res.status(429).json({ error: 'Demasiados intentos de acceso. Por favor, espera unos minutos.' });
  }

  next();
};

// --- MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- HEALTH CHECK ---
app.get(['/api/health', '/health'], (req, res) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString() });
});

// --- AUTHENTICATION ---
app.post(['/api/auth/register', '/auth/register'], authRateLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Faltan credenciales válidas' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: 'El formato de correo electrónico no es válido' });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
    }

    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return res.status(409).json({ 
        error: 'Este correo ya está registrado. Puedes iniciar sesión o restablecer tu contraseña.',
        existing: true
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email: cleanEmail, password: hashedPassword }
    });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email }, preferences: user.preferences || null });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Error al registrar la cuenta. Por favor, inténtalo de nuevo.' });
  }
});

app.post(['/api/auth/login', '/auth/login'], authRateLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password || typeof email !== 'string') {
      return res.status(400).json({ error: 'Introduce tu email y contraseña' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (!user || !user.password) {
      return res.status(400).json({ error: 'No existe ninguna cuenta con este email o la contraseña es incorrecta' });
    }

    let validPassword = false;
    
    // Migración silenciosa: Si la contraseña no es un hash de bcrypt (no empieza por $2)
    if (!user.password.startsWith('$2')) {
      validPassword = (password === user.password);
      if (validPassword) {
        // Encriptarla para el futuro
        const newHash = await bcrypt.hash(password, 10);
        await prisma.user.update({ where: { id: user.id }, data: { password: newHash } });
      }
    } else {
      try {
        validPassword = await bcrypt.compare(String(password), String(user.password));
      } catch (err) {
        console.error('Bcrypt error:', err);
        return res.status(400).json({ error: 'Formato de contraseña inválido' });
      }
    }

    if (!validPassword) {
      return res.status(400).json({ error: 'Contraseña incorrecta. Puedes restablecerla si la has olvidado.' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email }, preferences: user.preferences || null });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error en el servidor de autenticación' });
  }
});

app.post(['/api/auth/reset-password', '/auth/reset-password'], authRateLimiter, async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword || typeof email !== 'string' || typeof newPassword !== 'string') {
      return res.status(400).json({ error: 'Faltan credenciales válidas' });
    }

    const cleanEmail = email.toLowerCase().trim();
    if (newPassword.length < 4) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 4 caracteres' });
    }

    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (!user) {
      return res.status(404).json({ error: 'No existe ninguna cuenta registrada con este correo electrónico' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    const token = jwt.sign({ id: updated.id, email: updated.email }, JWT_SECRET);
    res.json({ 
      token, 
      user: { id: updated.id, email: updated.email }, 
      preferences: updated.preferences || null,
      message: 'Contraseña actualizada y sesión iniciada correctamente' 
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Error al restablecer la contraseña' });
  }
});

// --- SYNC ---
app.post(['/api/sync/push', '/sync/push'], authenticateToken, async (req, res) => {
  const { tasks, cycles, lists, listSections, preferences } = req.body;
  const userId = req.user.id;

  try {
    const transaction = [];

    // Tareas
    if (tasks && tasks.length > 0) {
      for (const t of tasks) {
        if (!t || !t.id) continue;
        let delAt = null;
        if (t.deleted_at) {
          const parsed = new Date(t.deleted_at);
          if (!isNaN(parsed.getTime())) {
            delAt = parsed;
          }
        }
        transaction.push(
          prisma.task.upsert({
            where: { id: t.id },
            update: { payload: t, deletedAt: delAt, userId },
            create: { id: t.id, userId, payload: t, deletedAt: delAt }
          })
        );
      }
    }

    // Ciclos
    if (cycles && cycles.length > 0) {
      for (const c of cycles) {
        if (!c || !c.id) continue;
        transaction.push(
          prisma.cycle.upsert({
            where: { id: c.id },
            update: { payload: c, userId },
            create: { id: c.id, userId, payload: c }
          })
        );
      }
    }

    // Listas (CustomLists)
    if (lists && lists.length > 0) {
      for (const l of lists) {
        if (!l || !l.id) continue;
        transaction.push(
          prisma.list.upsert({
            where: { id: l.id },
            update: { payload: l, userId },
            create: { id: l.id, userId, payload: l }
          })
        );
      }
    }

    // Secciones de lista
    if (listSections && listSections.length > 0) {
      for (const s of listSections) {
        if (!s || !s.id) continue;
        let delAt = null;
        if (s.deleted_at) {
          const parsed = new Date(s.deleted_at);
          if (!isNaN(parsed.getTime())) delAt = parsed;
        }
        transaction.push(
          prisma.listSection.upsert({
            where: { id: s.id },
            update: { payload: s, deletedAt: delAt, userId },
            create: { id: s.id, userId, payload: s, deletedAt: delAt }
          })
        );
      }
    }

    // Preferencias de usuario persistidas permanentemente en base de datos
    if (preferences && typeof preferences === 'object') {
      transaction.push(
        prisma.user.update({
          where: { id: userId },
          data: { preferences }
        })
      );
    }

    await prisma.$transaction(transaction);
    res.json({ success: true });

    // Broadcast check_sync to other active devices of this user
    const userClients = clients.get(userId);
    if (userClients) {
      for (const client of userClients) {
        client.write('data: check_sync\n\n');
      }
    }
  } catch (error) {
    console.error('Push error:', error);
    res.status(500).json({ error: 'Error sincronizando datos' });
  }
});

app.get(['/api/sync/pull', '/sync/pull'], authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const lastToken = parseInt(req.query.lastToken || '0', 10);
  const lastDate = new Date(lastToken);

  try {
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true }
    });

    const tasks = await prisma.task.findMany({
      where: { userId, updatedAt: { gt: lastDate } }
    });
    
    const cycles = await prisma.cycle.findMany({
      where: { userId, updatedAt: { gt: lastDate } }
    });

    const lists = await prisma.list.findMany({
      where: { userId, updatedAt: { gt: lastDate } }
    });

    const listSections = await prisma.listSection.findMany({
      where: { userId, updatedAt: { gt: lastDate } }
    });

    // Provide active IDs for authoritative client-side reconciliation
    const allActiveTasks = await prisma.task.findMany({
      where: { userId, deletedAt: null },
      select: { id: true }
    });
    const allActiveLists = await prisma.list.findMany({
      where: { userId, deletedAt: null },
      select: { id: true }
    });
    const allActiveSections = await prisma.listSection.findMany({
      where: { userId, deletedAt: null },
      select: { id: true }
    });

    res.json({
      tasks: tasks.map(t => {
        const p = t.payload;
        if (t.deletedAt && !p.deleted_at) {
          p.deleted_at = t.deletedAt.toISOString();
        }
        return p;
      }),
      cycles: cycles.map(c => c.payload),
      lists: lists.map(l => {
        const p = l.payload;
        if (l.deletedAt && !p.deleted_at) {
          p.deleted_at = l.deletedAt.toISOString();
        }
        return p;
      }),
      listSections: listSections.map(s => {
        const p = s.payload;
        if (s.deletedAt && !p.deleted_at) {
          p.deleted_at = s.deletedAt.toISOString();
        }
        return p;
      }),
      activeTaskIds: allActiveTasks.map(t => t.id),
      activeListIds: allActiveLists.map(l => l.id),
      activeSectionIds: allActiveSections.map(s => s.id),
      preferences: userRecord?.preferences || null,
      serverTime: Date.now()
    });
  } catch (error) {
    console.error('Pull error:', error);
    res.status(500).json({ error: 'Error obteniendo datos' });
  }
});

app.get(['/api/sync/live', '/sync/live'], (req, res) => {
  const token = req.query.token;
  if (!token) return res.sendStatus(401);

  try {
    const user = jwt.verify(token, JWT_SECRET);
    const userId = user.id;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    res.write('data: connected\n\n');

    if (!clients.has(userId)) {
      clients.set(userId, new Set());
    }
    clients.get(userId).add(res);

    // Heartbeat ping every 20 seconds to prevent connection timeout on mobile and proxies
    const heartbeatInterval = setInterval(() => {
      res.write(': ping\n\n');
    }, 20000);

    req.on('close', () => {
      clearInterval(heartbeatInterval);
      const userClients = clients.get(userId);
      if (userClients) {
        userClients.delete(res);
        if (userClients.size === 0) {
          clients.delete(userId);
        }
      }
    });
  } catch (error) {
    console.error('SSE connection error:', error);
    res.sendStatus(403);
  }
});

// --- SHARE ---
app.post(['/api/share/generate', '/share/generate'], authenticateToken, async (req, res) => {
  const { listId } = req.body;
  const userId = req.user.id;
  try {
    const list = await prisma.list.findUnique({ where: { id: listId } });
    if (!list || list.userId !== userId) return res.status(403).json({ error: 'No tienes permiso para compartir esta lista' });
    const link = await prisma.sharedLink.create({ data: { listId } });
    res.json({ token: link.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error generating link' });
  }
});

app.get(['/api/share/:token', '/share/:token'], authenticateToken, async (req, res) => {
  const { token } = req.params;
  try {
    const link = await prisma.sharedLink.findUnique({ where: { id: token }, include: { list: true } });
    if (!link) return res.status(404).json({ error: 'Link no encontrado' });

    // Cargar todas las tareas y secciones del dueño y filtrar en memoria por seguridad (evita bugs de JSON querying)
    const allTasks = await prisma.task.findMany({ where: { userId: link.list.userId, deletedAt: null } });
    const allSections = await prisma.listSection.findMany({ where: { userId: link.list.userId, deletedAt: null } });
    
    const tasks = allTasks.filter(t => t.payload && t.payload.listId === link.listId).map(t => t.payload);
    const sections = allSections.filter(s => s.payload && s.payload.listId === link.listId).map(s => s.payload);

    res.json({ list: link.list.payload, tasks, sections });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error getting shared list' });
  }
});

// --- MCP (Model Context Protocol) ---
const optionalAuthenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (!err && user) {
        req.user = user;
      }
      next();
    });
  } else {
    next();
  }
};

app.post(['/api/mcp', '/mcp'], optionalAuthenticateToken, async (req, res) => {
  try {
    const response = await handleMcpRequest(req.body, prisma, req.user?.id);
    res.json(response);
  } catch (err) {
    console.error('MCP route error:', err);
    res.status(500).json({ 
      jsonrpc: '2.0', 
      id: req.body?.id || null, 
      error: { code: -32000, message: 'Internal Server Error' } 
    });
  }
});

app.get(['/api/mcp', '/mcp', '/api/mcp/tools', '/mcp/tools'], (req, res) => {
  res.json({
    name: 'Recordatorios Élite MCP Server',
    version: '1.0.0',
    protocolVersion: '2024-11-05',
    tools: MCP_TOOLS
  });
});

// START
if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Recordatorios Backend running on port ${PORT}`);
  });
}

export default app;
