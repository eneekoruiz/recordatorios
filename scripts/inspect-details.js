import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function inspect() {
  const user = await prisma.user.findUnique({ where: { email: 'eneekoruiz@gmail.com' } });
  const tasks = await prisma.task.findMany({ where: { userId: user.id } });
  
  console.log("=== QUEHACERES SKIN-CARE & HABIT TASKS ===");
  tasks.filter(t => t.payload?.categoryId === 'quehaceres').forEach(t => {
    const p = t.payload;
    if (/skin-care|agua|diente|mano|aplicacion/i.test(p.title) || /icloud|shortcut/i.test(p.description || '') || /icloud|shortcut/i.test(p.url || '')) {
      console.log(JSON.stringify({ id: t.id, title: p.title, url: p.url, description: p.description, sectionId: p.sectionId }, null, 2));
    }
  });

  console.log("=== CARE TASKS SAMPLE (Diaria) ===");
  tasks.filter(t => t.payload?.categoryId === 'care' && t.payload?.sectionId === 'care_diaria').slice(0, 10).forEach(t => {
    const p = t.payload;
    console.log(JSON.stringify({ id: t.id, title: p.title, description: p.description }, null, 2));
  });

  console.log("=== COMPRA TASKS WITH PRICES IN TITLE/NOTE ===");
  tasks.filter(t => t.payload?.categoryId === 'compra').forEach(t => {
    const p = t.payload;
    if (/[0-9]+[.,]?[0-9]*\s*€|[0-9]+\s*e\b|precio|cost/i.test(p.title + ' ' + (p.description || ''))) {
      console.log(JSON.stringify({ id: t.id, title: p.title, price: p.price, description: p.description }, null, 2));
    }
  });
}

inspect().finally(() => prisma.$disconnect());
