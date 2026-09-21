import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const HOGAR = [
  'Papel higiénico',
  'Bolsas de basura',
  'Pastillas lavavajillas / Lavavajillas mano',
  'Detergente y suavizante para la ropa',
  'Lejía o limpiador desinfectante',
  'Fregasuelos'
];

async function main() {
  const allTasks = await prisma.task.findMany({ where: { deletedAt: null } });
  
  const toDelete = allTasks.filter(t => {
    let p = typeof t.payload === 'string' ? JSON.parse(t.payload) : t.payload;
    return HOGAR.some(h => p.title === h);
  });
  
  console.log(`Deleting ${toDelete.length} household items...`);
  
  for (const t of toDelete) {
    await prisma.task.update({ where: { id: t.id }, data: { deletedAt: new Date() } });
  }
  
  console.log('Done!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
