import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const user = await prisma.user.findUnique({ where: { email: 'eneekoruiz@gmail.com' } });
  if (!user) throw new Error("User not found");

  const lists = await prisma.list.findMany({ where: { userId: user.id } });
  const tasks = await prisma.task.findMany({ where: { userId: user.id } });

  // Real UUIDs for Lists
  const listMap = {
    'limpieza': '59f5424b-3a87-4ad7-976d-482d2f4a4167',
    'care': '5e0bac8f-46f3-4c27-afbb-c6c42ef3dc64',
    'prop_sitos_anuales': '82e7da23-4011-466c-944e-4c2ee2a73347',
    'series': '1d536e26-6059-40e0-addf-efaf962b941f',
    'compra': '8cbf06b4-3724-4532-b1a3-60a7f66ca1af',
  };

  let updatedTasks = 0;

  for (const task of tasks) {
    const payload = task.payload;
    let categoryId = payload.categoryId || payload.category_id;
    if (!categoryId) categoryId = 'inbox'; // Should not happen usually

    // If it's a string ID mapped to a UUID, fix it
    if (listMap[categoryId]) {
      payload.categoryId = listMap[categoryId];
      
      await prisma.task.update({
        where: { id: task.id },
        data: { payload }
      });
      updatedTasks++;
    }
  }

  // Also delete duplicate lists created during import
  const stringLists = Object.keys(listMap);
  let deletedLists = 0;
  for (const list of lists) {
    if (stringLists.includes(list.id)) {
      await prisma.list.delete({ where: { id: list.id } });
      deletedLists++;
    }
  }

  console.log(`Migrated ${updatedTasks} tasks from string categoryId to UUID.`);
  console.log(`Deleted ${deletedLists} duplicate string-id lists.`);
}

run().catch(console.error).finally(() => prisma.$disconnect());
