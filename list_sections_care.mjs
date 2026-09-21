import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const sections = await prisma.listSection.findMany({ where: { deletedAt: null } });
  const careSections = sections.filter(s => s.listId === 'care' || (s.payload && s.payload.listId === 'care'));
  console.log(careSections.map(s => {
     const p = s.payload;
     return `${s.id} | Name: ${p.name || s.name} | Order: ${p.order}`;
  }));
}

main().catch(console.error).finally(() => prisma.$disconnect());
