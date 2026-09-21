import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tasks = await prisma.task.findMany({ where: { deletedAt: null } });
  const compraTasks = tasks.filter(t => {
    let p = typeof t.payload === 'string' ? JSON.parse(t.payload) : t.payload;
    return (p.categoryId === 'compra' || p.category_id === 'compra' || p.listId === 'compra') && (p.sectionId === 'sec_compra_anual' || p.cycle_id === 'cycle_year');
  });
  
  console.log(`Anuales sin precio/cantidad:`);
  for (const t of compraTasks) {
    let p = typeof t.payload === 'string' ? JSON.parse(t.payload) : t.payload;
    if (!p.price || !p.quantity) {
       console.log(`- ${p.title} (Price: ${p.price}, Qty: ${p.quantity})`);
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
