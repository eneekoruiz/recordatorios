import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function verify() {
  const user = await prisma.user.findUnique({
    where: { email: 'eneekoruiz@gmail.com' }
  });

  const sections = await prisma.listSection.findMany({
    where: { userId: user.id }
  });
  const careSections = sections.filter(s => s.payload?.listId === 'care');
  console.log("Care sections:", careSections.map(s => s.payload?.name));

  const tasks = await prisma.task.findMany({
    where: { userId: user.id }
  });
  const careTasks = tasks.filter(t => t.payload?.categoryId === 'care');
  console.log(`Total care tasks in DB: ${careTasks.length}`);

  const bySec = {};
  for (const t of careTasks) {
    const sec = t.payload?.sectionId || 'none';
    bySec[sec] = (bySec[sec] || 0) + 1;
  }
  console.log("Care tasks by section:", bySec);
}

verify().finally(() => prisma.$disconnect());
