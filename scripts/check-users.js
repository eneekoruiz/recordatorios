import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function checkUsers() {
  const users = await prisma.user.findMany();
  console.log("Users:", users);
}
checkUsers().finally(() => prisma.$disconnect());
