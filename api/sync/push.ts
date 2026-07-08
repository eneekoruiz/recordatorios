import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { userId, tasks, cycles } = req.body;

    if (!userId || typeof userId !== 'string') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Wrap in a transaction for atomicity
    await prisma.$transaction(async (tx) => {
      // Upsert Tasks
      if (tasks && Array.isArray(tasks)) {
        for (const task of tasks) {
          // Simplistic upsert; in a real scenario you would check 'version' for OCC (Optimistic Concurrency Control)
          await tx.task.upsert({
            where: { id: task.id },
            update: {
              ...task,
              version: { increment: 1 },
              updatedAt: new Date(),
            },
            create: {
              ...task,
              userId,
              version: 1,
              updatedAt: new Date(),
            },
          });
        }
      }

      // Upsert Cycles
      if (cycles && Array.isArray(cycles)) {
        for (const cycle of cycles) {
          await tx.cycle.upsert({
            where: { id: cycle.id },
            update: {
              ...cycle,
              version: { increment: 1 },
              updatedAt: new Date(),
            },
            create: {
              ...cycle,
              userId,
              version: 1,
              updatedAt: new Date(),
            },
          });
        }
      }
    });

    res.status(200).json({ success: true, timestamp: Date.now() });
  } catch (error) {
    console.error('Push Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
