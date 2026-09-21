import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import fs from 'fs';

async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'eneekoruiz@gmail.com' } });
  const tasksRaw = await prisma.task.findMany({ where: { userId: user.id, deletedAt: null } });
  
  const compra = tasksRaw.filter(t => t.payload.categoryId === 'compra').map(t => t.payload.title);
  fs.writeFileSync('compra_titles.json', JSON.stringify(compra, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
