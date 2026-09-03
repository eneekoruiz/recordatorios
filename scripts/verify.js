import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  const userId = users[0].id;

  const listsCount = await prisma.list.count({ where: { userId } });
  const tasksCount = await prisma.task.count({ where: { userId } });
  const cyclesCount = await prisma.cycle.count({ where: { userId } });
  const sectionsCount = await prisma.listSection.count({ where: { userId } });

  console.log(`Stats for user ${users[0].email}:`);
  console.log(`- Lists: ${listsCount}`);
  console.log(`- Tasks & Logs: ${tasksCount}`);
  console.log(`- Cycles: ${cyclesCount}`);
  console.log(`- Sections: ${sectionsCount}`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
