import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const user = await prisma.user.findUnique({
    where: { email: 'eneekoruiz@gmail.com' }
  });
  if (!user) return console.log("User not found");

  const lists = await prisma.list.findMany({ where: { userId: user.id } });
  console.log("Existing Lists:", lists.map(l => ({ id: l.id, name: l.payload?.name })));

  const sections = await prisma.listSection.findMany({ where: { userId: user.id } });
  console.log("Existing Sections:", sections.map(s => ({ id: s.id, listId: s.payload?.listId, name: s.payload?.name })));

  const tasks = await prisma.task.findMany({ where: { userId: user.id } });
  const countsByCat = {};
  for (const t of tasks) {
    const cat = t.payload?.categoryId || 'none';
    countsByCat[cat] = (countsByCat[cat] || 0) + 1;
  }
  console.log("Task counts by category:", countsByCat);

  // Sample tasks in compra if any
  const compraTasks = tasks.filter(t => t.payload?.categoryId === 'compra');
  console.log("Compra tasks sample (first 5):", compraTasks.slice(0, 5).map(t => ({ id: t.id, title: t.payload?.title, sectionId: t.payload?.sectionId })));

  // Sample tasks in quehaceres if any
  const quehaceresTasks = tasks.filter(t => t.payload?.categoryId === 'quehaceres');
  console.log("Quehaceres tasks count:", quehaceresTasks.length);
}

check().finally(() => prisma.$disconnect());
