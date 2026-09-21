import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const sections = await prisma.listSection.findMany({ where: { deletedAt: null } });
  console.log(sections.map(s => `${s.id}: ${s.listId} - ${s.name}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
