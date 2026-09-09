import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function inspect() {
  const user = await prisma.user.findUnique({ where: { email: 'eneekoruiz@gmail.com' } });
  const tasks = await prisma.task.findMany({ where: { userId: user.id } });
  const careDiaria = tasks.filter(t => t.payload?.categoryId === 'care' && t.payload?.sectionId === 'care_diaria');
  
  console.log(`Care diaria tasks: ${careDiaria.length}`);
  careDiaria.forEach(t => {
    console.log(`[${t.payload.parentId ? 'SUB' : 'ROOT'}] ${t.payload.title} (desc: ${t.payload.description ? t.payload.description.slice(0, 30) : 'none'})`);
  });
}

inspect().finally(() => prisma.$disconnect());
