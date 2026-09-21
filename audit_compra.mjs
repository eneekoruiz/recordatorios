import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tasks = await prisma.task.findMany({ where: { deletedAt: null } });
  const compraTasks = tasks.filter(t => {
    let p = typeof t.payload === 'string' ? JSON.parse(t.payload) : t.payload;
    return p.categoryId === 'compra' || p.category_id === 'compra' || p.listId === 'compra';
  });
  
  console.log(`Found ${compraTasks.length} tasks in Compra.`);
  
  let updates = 0;
  for (const t of compraTasks) {
    let p = typeof t.payload === 'string' ? JSON.parse(t.payload) : t.payload;
    let title = t.title || '';
    let desc = t.description || '';
    let updated = false;

    // Detect quantity (e.g. "3 botes", "2x", "x2", "2 paquetes")
    const qtyRegex = /(?:(\d+)\s*(?:botes|paquetes|uds|unidades|latas|botellas))|(?:x\s*(\d+))|(?:(\d+)\s*x)/i;
    let m = title.match(qtyRegex) || desc.match(qtyRegex);
    if (m) {
      const q = parseInt(m[1] || m[2] || m[3], 10);
      if (q && q > 1 && (!p.quantity || p.quantity === 1)) {
        p.quantity = q;
        updated = true;
      }
    }

    // Detect price (e.g. "15€", "15 e", "15 euros", "15.50€")
    const priceRegex = /([\d,\.]+)\s*(?:€|e\b|euros)/i;
    let pm = title.match(priceRegex) || desc.match(priceRegex);
    if (pm) {
      const priceMatch = pm[1].replace(',', '.');
      const val = parseFloat(priceMatch);
      if (!isNaN(val) && (!p.price || p.price !== val)) {
        p.price = val;
        updated = true;
      }
      // optionally remove the price from title if it's there
      if (pm.input === title && title.includes(pm[0])) {
         // but wait, user might want to keep the text, just set the price field.
         // Let's remove price from title to avoid duplication since it has a badge.
         let newTitle = title.replace(pm[0], '').replace(/\s{2,}/g, ' ').trim();
         // if it starts/ends with a dash or parenthesis from the price, clean it up
         newTitle = newTitle.replace(/^[-()]+|[-()]+$/g, '').trim();
         if (newTitle) {
            t.title = newTitle;
            p.title = newTitle;
            updated = true;
         }
      }
    }

    if (updated) {
      await prisma.task.update({
        where: { id: t.id },
        data: { title: t.title, payload: p }
      });
      console.log(`Updated: ${t.title} (Qty: ${p.quantity}, Price: ${p.price})`);
      updates++;
    }
  }
  
  console.log(`Total updates applied: ${updates}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
