import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function enrich() {
  const user = await prisma.user.findUnique({ where: { email: 'eneekoruiz@gmail.com' } });
  if (!user) {
    console.error("User not found");
    return;
  }

  const now = new Date();

  // 1. Enable isFinancial on 'compra' list
  const compraList = await prisma.list.findUnique({ where: { id: 'compra' } });
  if (compraList) {
    const updatedPayload = { ...compraList.payload, isFinancial: true, updated_at: now.toISOString() };
    await prisma.list.update({
      where: { id: 'compra' },
      data: { payload: updatedPayload, updatedAt: now }
    });
    console.log("Updated compra list with isFinancial: true");
  }

  // 2. Fetch all user tasks
  const tasks = await prisma.task.findMany({ where: { userId: user.id } });

  // Map of specific task titles to prices in Compra
  const pricesByTitleSubstring = [
    { match: 'Airtags 4 por 100e', price: 100 },
    { match: 'AliExpress 60e', price: 60 },
    { match: 'Zapatillas 200 e', price: 200 },
    { match: 'Ropa interior 100 e', price: 100 },
    { match: 'La perla 10 sesiones 350 e', price: 350 },
    { match: 'Cosas de 100e', price: 200 },
    { match: 'Cosas de 50e', price: 100 },
    { match: 'Cosas de 20e', price: 105 },
    { match: 'Cosas de 10e', price: 65 },
    { match: 'Jabón facial 5 e', price: 5 }
  ];

  for (const t of tasks) {
    const p = t.payload;
    let modified = false;

    // Compra prices
    if (p.categoryId === 'compra') {
      for (const item of pricesByTitleSubstring) {
        if (p.title.includes(item.match) && (!p.price || p.price === 0)) {
          p.price = item.price;
          modified = true;
          console.log(`Setting price ${item.price}€ for: ${p.title}`);
          break;
        }
      }
    }

    // Quehaceres habits
    if (p.categoryId === 'quehaceres') {
      if (p.title.toLowerCase().includes('agua 10 veces')) {
        p.targetCount = 10;
        p.currentCount = p.currentCount || 0;
        modified = true;
        console.log(`Setting habit counter 10 for: ${p.title}`);
      } else if (p.title.toLowerCase().includes('dientes 3 veces')) {
        p.targetCount = 3;
        p.currentCount = p.currentCount || 0;
        modified = true;
        console.log(`Setting habit counter 3 for: ${p.title}`);
      } else if (p.title.toLowerCase().includes('manos 4 veces')) {
        p.targetCount = 4;
        p.currentCount = p.currentCount || 0;
        modified = true;
        console.log(`Setting habit counter 4 for: ${p.title}`);
      } else if (p.title.toLowerCase().includes('aplicaciones permanentes 3 veces')) {
        p.targetCount = 3;
        p.currentCount = p.currentCount || 0;
        modified = true;
        console.log(`Setting habit counter 3 for: ${p.title}`);
      }

      // Skin-care in-app links
      if (p.title.toLowerCase().includes('skin-care') || p.title.toLowerCase().includes('skincare')) {
        p.url = 'app://list/care';
        modified = true;
        console.log(`Updated in-app list URL to app://list/care for: ${p.title}`);
      }
    }

    if (modified) {
      p.updated_at = now.toISOString();
      await prisma.task.update({
        where: { id: t.id },
        data: {
          payload: p,
          updatedAt: now
        }
      });
    }
  }

  console.log("Enrichment complete!");
}

enrich().finally(() => prisma.$disconnect());
