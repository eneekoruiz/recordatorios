import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'eneekoruiz@gmail.com' } });
  const tasksRaw = await prisma.task.findMany({ where: { userId: user.id, deletedAt: null } });
  
  let countDeleted = 0;
  let countUpdated = 0;

  for (const t of tasksRaw) {
    let payload = t.payload;
    if (payload.categoryId === 'compra' || (payload.category_id && payload.category_id === 'compra')) {
      const title = payload.title;

      if (title.toUpperCase().startsWith('TOTAL') || title.startsWith('Cosas de')) {
        await prisma.task.update({ where: { id: t.id }, data: { deletedAt: new Date(), updatedAt: new Date() } });
        countDeleted++;
        continue;
      }

      // Remove prices at the end like " 350 e", " 60e", " 100 €", " por 100e", " 15 e"
      // Also match " 1500" if it was "TOTAL: 1500" (but those are deleted)
      const newTitle = title.replace(/\s+(?:por\s+)?\d+([.,]\d+)?\s*(?:e|€)$/i, '').trim();
      if (newTitle !== title) {
        payload.title = newTitle;
        await prisma.task.update({ where: { id: t.id }, data: { payload, updatedAt: new Date() } });
        countUpdated++;
      }
    }
  }

  console.log(`Deleted ${countDeleted} totals. Updated ${countUpdated} prices in Compra.`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
