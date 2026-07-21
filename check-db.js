import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  const tasks = await prisma.task.findMany();
  let missing = 0;
  for (const t of tasks) {
    if (t.payload && t.payload.alerts == null) {
      missing++;
    }
  }
  console.log(`Total tasks: ${tasks.length}`);
  console.log(`Tasks missing alerts: ${missing}`);
}

check().finally(() => prisma.$disconnect());
