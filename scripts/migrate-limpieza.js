import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const user = await prisma.user.findUnique({
    where: { email: 'eneekoruiz@gmail.com' }
  });
  if (!user) throw new Error("User not found");

  const now = new Date().toISOString();

  // Create the Limpieza List explicitly just in case
  await prisma.list.upsert({
    where: { id: 'limpieza' },
    update: {},
    create: {
      id: 'limpieza',
      userId: user.id,
      payload: {
        id: 'limpieza',
        name: 'Limpieza',
        color: '#0a84ff',
        created_at: now,
        updated_at: now,
        _is_dirty: true
      }
    }
  });

  // Create the 3 sections in ListSection
  const sections = [
    { id: 'section_diaria', name: 'Diaria' },
    { id: 'section_semanal', name: 'Semanal' },
    { id: 'section_mensual', name: 'Mensual' }
  ];

  for (const sec of sections) {
    await prisma.listSection.upsert({
      where: { id: sec.id },
      update: {},
      create: {
        id: sec.id,
        userId: user.id,
        payload: {
          id: sec.id,
          listId: 'limpieza',
          name: sec.name,
          created_at: now,
          updated_at: now,
          _is_dirty: true
        }
      }
    });
  }

  // Find tasks to move
  const oldLists = ['diaria', 'semanal', 'mensual'];
  
  for (const oldListId of oldLists) {
    // get tasks belonging to this pseudo-list
    const tasks = await prisma.task.findMany({
      where: { userId: user.id } // we will filter in JS since payload is JSON
    });

    let updatedCount = 0;
    for (const t of tasks) {
      const p = t.payload;
      if (p.categoryId === oldListId && p.type === 'task') {
        const newSectionId = `section_${oldListId}`;
        p.categoryId = 'limpieza';
        p.sectionId = newSectionId;
        p.updated_at = now;
        p._is_dirty = true;

        await prisma.task.update({
          where: { id: t.id },
          data: { payload: p }
        });
        updatedCount++;
      }
    }
    console.log(`Moved ${updatedCount} tasks from ${oldListId} to Limpieza / ${oldListId}`);
  }

  // Also migrate the "Series" and "Propósitos Anuales" into the List table correctly!
  const customLists = [
    { id: 'series', name: 'Series', color: '#5856d6' },
    { id: 'prop_sitos_anuales', name: 'Propósitos Anuales', color: '#ff2d55' }
  ];

  for (const cl of customLists) {
    await prisma.list.upsert({
      where: { id: cl.id },
      update: {},
      create: {
        id: cl.id,
        userId: user.id,
        payload: {
          id: cl.id,
          name: cl.name,
          color: cl.color,
          created_at: now,
          updated_at: now,
          _is_dirty: true
        }
      }
    });
    // Cleanup the wrong pseudo-lists I created in Task table
    await prisma.task.deleteMany({
      where: { id: cl.id }
    }).catch(() => {});
  }

  // Cleanup wrong pseudo-lists from Task table for diaria/semanal/mensual
  for (const oldListId of oldLists) {
    await prisma.task.deleteMany({
      where: { id: oldListId }
    }).catch(() => {});
  }

  console.log("Migration complete!");
}

run().catch(console.error).finally(() => prisma.$disconnect());
