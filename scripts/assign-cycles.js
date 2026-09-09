import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function assignCycles() {
  const user = await prisma.user.findUnique({ where: { email: 'eneekoruiz@gmail.com' } });
  if (!user) return console.error("User not found");

  const tasks = await prisma.task.findMany({ where: { userId: user.id } });
  const now = new Date();
  let updatedCount = 0;

  for (const t of tasks) {
    const p = t.payload;
    const sec = (p.sectionId || '').toLowerCase();
    const cat = (p.categoryId || '').toLowerCase();
    let targetCycleId = null;

    if (sec.includes('diaria') || cat === 'limpieza_diaria') {
      targetCycleId = 'cycle_day';
    } else if (sec.includes('semanal') || cat === 'limpieza_semanal') {
      targetCycleId = 'cycle_week';
    } else if (sec.includes('mensual') || cat === 'limpieza_mensual') {
      targetCycleId = 'cycle_month';
    } else if (sec.includes('anual') || cat === 'limpieza_anual') {
      targetCycleId = 'cycle_year';
    }

    if (targetCycleId && p.cycle_id !== targetCycleId) {
      p.cycle_id = targetCycleId;
      p.updated_at = now.toISOString();
      await prisma.task.update({
        where: { id: t.id },
        data: {
          payload: p,
          updatedAt: now
        }
      });
      updatedCount++;
    }
  }

  console.log(`Assigned cycle_id to ${updatedCount} tasks in database.`);
}

assignCycles().finally(() => prisma.$disconnect());
