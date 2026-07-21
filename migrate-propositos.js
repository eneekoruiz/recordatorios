import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const user = await prisma.user.findUnique({
    where: { email: 'eneekoruiz@gmail.com' }
  });
  if (!user) throw new Error("User not found");

  const now = new Date().toISOString();
  const listId = 'prop_sitos_anuales';

  // Get all tasks in the list, ordered by creation date to maintain sequence
  const tasks = await prisma.task.findMany({
    where: { userId: user.id }
  });
  
  // Filter and sort the tasks belonging to Propósitos Anuales
  const propTasks = tasks
    .filter(t => t.payload.categoryId === listId && t.payload.type === 'task')
    .sort((a, b) => new Date(a.payload.created_at).getTime() - new Date(b.payload.created_at).getTime());

  let currentSectionId = null;
  let updatedCount = 0;
  let sectionsCreated = 0;

  for (const t of propTasks) {
    const title = t.payload.title.trim();
    // Check if title is a year (e.g. 2020, 2021)
    if (/^20\d{2}$/.test(title)) {
      currentSectionId = `section_year_${title}`;
      
      // Create section
      await prisma.listSection.upsert({
        where: { id: currentSectionId },
        update: {},
        create: {
          id: currentSectionId,
          userId: user.id,
          payload: {
            id: currentSectionId,
            listId: listId,
            name: title,
            created_at: t.payload.created_at,
            updated_at: now,
            _is_dirty: true
          }
        }
      });
      sectionsCreated++;
      
      // Delete the year task itself
      await prisma.task.delete({
        where: { id: t.id }
      });
    } else if (currentSectionId) {
      // Assign task to current section
      const p = t.payload;
      p.sectionId = currentSectionId;
      p.updated_at = now;
      p._is_dirty = true;
      
      await prisma.task.update({
        where: { id: t.id },
        data: { payload: p }
      });
      updatedCount++;
    }
  }

  console.log(`Created ${sectionsCreated} year sections and moved ${updatedCount} goals!`);
}

run().catch(console.error).finally(() => prisma.$disconnect());
