import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const prisma = new PrismaClient({});
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_recordatorios';
const clients = new Map(); // userId -> Set of Response objects

app.use(cors());
app.use(express.json({ limit: '50mb' }));

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

// --- AUTHENTICATION ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Faltan credenciales' });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'El email ya está registrado' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword }
    });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.password) return res.status(400).json({ error: 'Usuario o contraseña incorrectos' });

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

    if (!validPassword) return res.status(400).json({ error: 'Contraseña incorrecta' });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
    res.json({ token, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// --- SYNC ---
app.post('/api/sync/push', authenticateToken, async (req, res) => {
  const { tasks, cycles, lists } = req.body;
  const userId = req.user.id;

  try {
    const transaction = [];

    // Tareas
    if (tasks && tasks.length > 0) {
      for (const t of tasks) {
        transaction.push(
          prisma.task.upsert({
            where: { id: t.id },
            update: { payload: t, deletedAt: t.deleted_at ? new Date(t.deleted_at) : null },
            create: { id: t.id, userId, payload: t, deletedAt: t.deleted_at ? new Date(t.deleted_at) : null }
          })
        );
      }
    }

    // Ciclos
    if (cycles && cycles.length > 0) {
      for (const c of cycles) {
        transaction.push(
          prisma.cycle.upsert({
            where: { id: c.id },
            update: { payload: c },
            create: { id: c.id, userId, payload: c }
          })
        );
      }
    }

    // Listas (CustomLists)
    if (lists && lists.length > 0) {
      for (const l of lists) {
        transaction.push(
          prisma.list.upsert({
            where: { id: l.id },
            update: { payload: l },
            create: { id: l.id, userId, payload: l }
          })
        );
      }
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

app.get('/api/sync/pull', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const lastToken = parseInt(req.query.lastToken || '0', 10);
  const lastDate = new Date(lastToken);

  try {
    const tasks = await prisma.task.findMany({
      where: { userId, updatedAt: { gt: lastDate } }
    });
    
    const cycles = await prisma.cycle.findMany({
      where: { userId, updatedAt: { gt: lastDate } }
    });

    const lists = await prisma.list.findMany({
      where: { userId, updatedAt: { gt: lastDate } }
    });

    res.json({
      tasks: tasks.map(t => t.payload),
      cycles: cycles.map(c => c.payload),
      lists: lists.map(l => l.payload)
    });
  } catch (error) {
    console.error('Pull error:', error);
    res.status(500).json({ error: 'Error obteniendo datos' });
  }
});

app.get('/api/sync/live', (req, res) => {
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

    req.on('close', () => {
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

// START
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`✅ Recordatorios Backend running on port ${PORT}`);
  });
}

export default app;
