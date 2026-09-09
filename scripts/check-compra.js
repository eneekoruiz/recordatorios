import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkCompra() {
  const user = await prisma.user.findUnique({ where: { email: 'eneekoruiz@gmail.com' } });
  const tasks = await prisma.task.findMany({ where: { userId: user.id } });
  const compra = tasks.filter(t => t.payload?.categoryId === 'compra');
  console.log(`Total compra in DB: ${compra.length}`);
  console.log("Titles:", compra.map(t => t.payload?.title));
}

checkCompra().finally(() => prisma.$disconnect());
