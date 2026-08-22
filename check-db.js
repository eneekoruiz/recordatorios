import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.findMany();
  console.log("Users:", users.map(u => ({ id: u.id, email: u.email })));
  const lists = await prisma.list.findMany();
  console.log(`Total lists: ${lists.length}`);
  console.log("List IDs:", lists.map(l => l.id));
  const tasks = await prisma.task.findMany();
  console.log(`Total tasks: ${tasks.length}`);
  const sample = tasks.slice(0, 5).map(t => ({ id: t.id, title: t.payload?.title, priority: t.payload?.priority, categoryId: t.payload?.categoryId }));
  console.log("Sample tasks:", sample);
}

check().finally(() => prisma.$disconnect());
