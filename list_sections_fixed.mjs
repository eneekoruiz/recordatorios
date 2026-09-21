import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const sections = await prisma.listSection.findMany({ where: { deletedAt: null } });
  console.log(sections.map(s => {
     const p = typeof s.payload === 'string' ? JSON.parse(s.payload) : s.payload;
     return `${s.id} | ListId: ${p.listId || s.listId} | Name: ${p.name || s.name}`;
  }));
}

main().catch(console.error).finally(() => prisma.$disconnect());
