import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function inspectCare() {
  const user = await prisma.user.findUnique({
    where: { email: 'eneekoruiz@gmail.com' }
  });
  if (!user) {
    console.log("No user found");
    return;
  }

  const list = await prisma.list.findUnique({
    where: { id: 'care' }
  });
  console.log("Care List in DB:", list);

  const sections = await prisma.listSection.findMany({
    where: { userId: user.id }
  });
  console.log("Sections for user:", sections.map(s => s.payload));

  const allTasks = await prisma.task.findMany({
    where: { userId: user.id }
  });

  const careTasks = allTasks.filter(t => t.payload?.categoryId === 'care');
  console.log(`Care tasks count: ${careTasks.length}`);
  console.log("Care tasks titles:", careTasks.map(t => ({ id: t.id, title: t.payload?.title, sectionId: t.payload?.sectionId })));
}

inspectCare().finally(() => prisma.$disconnect());
