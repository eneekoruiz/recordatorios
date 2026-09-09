import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const user = await prisma.user.findUnique({ where: { email: 'eneekoruiz@gmail.com' } });
  const tasks = await prisma.task.findMany({ where: { userId: user.id } });

  let countDiaria = 0;
  let countSemanal = 0;
  let countMensual = 0;
  let countAnual = 0;

  for (const t of tasks) {
    const p = t.payload;
    const sec = (p.sectionId || '').toLowerCase();
    const cat = (p.categoryId || '').toLowerCase();

    if (sec.includes('diaria') || cat.includes('diaria')) countDiaria++;
    if (sec.includes('semanal') || cat.includes('semanal')) countSemanal++;
    if (sec.includes('mensual') || cat.includes('mensual')) countMensual++;
    if (sec.includes('anual') || cat.includes('anual')) countAnual++;
  }

  console.log({ countDiaria, countSemanal, countMensual, countAnual });
}

check().finally(() => prisma.$disconnect());
