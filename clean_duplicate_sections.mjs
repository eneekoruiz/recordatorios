import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Find all sections that are duplicates of cycles (Diaria, Semanal, Mensual, Anual, Recurrentes)
  const sections = await prisma.listSection.findMany({ where: { deletedAt: null } });
  let deletedCount = 0;
  
  for (const sec of sections) {
    const p = typeof sec.payload === 'string' ? JSON.parse(sec.payload) : sec.payload;
    const name = (p.name || sec.name).toLowerCase();
    
    // Also we delete sec_care_diaria, sec_limp_diaria etc.
    if (name.includes('diaria') || name.includes('semanal') || name.includes('mensual') || name.includes('anual') || name.includes('recurrent') || sec.id.includes('diaria') || sec.id.includes('semanal') || sec.id.includes('mensual') || sec.id.includes('anual')) {
      
      await prisma.listSection.update({
        where: { id: sec.id },
        data: { deletedAt: new Date(), updatedAt: new Date() }
      });
      deletedCount++;
      
      const tasks = await prisma.task.findMany({ where: { deletedAt: null } });
      let taskUpdates = 0;
      for (const t of tasks) {
        let payload = typeof t.payload === 'string' ? JSON.parse(t.payload) : t.payload;
        if (payload.sectionId === sec.id || payload.section_id === sec.id) {
          delete payload.sectionId;
          delete payload.section_id;
          
          if (name.includes('diaria') || name.includes('recurrent')) payload.cycle_id = 'cycle_day';
          if (name.includes('semanal')) payload.cycle_id = 'cycle_week';
          if (name.includes('mensual')) payload.cycle_id = 'cycle_month';
          if (name.includes('anual')) payload.cycle_id = 'cycle_year';
          
          await prisma.task.update({
            where: { id: t.id },
            data: { payload, updatedAt: new Date() }
          });
          taskUpdates++;
        }
      }
      console.log(`Deleted section ${name} (${sec.id}) and cleared sectionId from ${taskUpdates} tasks`);
    }
  }
  
  console.log(`Finished clearing ${deletedCount} fake manual cycle sections.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
