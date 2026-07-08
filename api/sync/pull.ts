import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { lastToken, userId } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let lastSyncDate = new Date(0); // Default to epoch if no token
    if (lastToken && typeof lastToken === 'string' && lastToken !== '0') {
      lastSyncDate = new Date(parseInt(lastToken));
    }

    // Fetch records modified after the lastToken
    const tasks = await prisma.task.findMany({
      where: {
        userId,
        updatedAt: { gt: lastSyncDate },
      },
    });

    const cycles = await prisma.cycle.findMany({
      where: {
        userId,
        updatedAt: { gt: lastSyncDate },
      },
    });

    // In a real app, calculate the highest updatedAt from fetched records to return as nextToken
    const nextToken = Date.now().toString();

    res.status(200).json({
      tasks,
      cycles,
      nextToken,
    });
  } catch (error) {
    console.error('Pull Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
