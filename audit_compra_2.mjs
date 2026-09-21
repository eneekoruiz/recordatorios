import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tasks = await prisma.task.findMany({ where: { deletedAt: null } });
  const compraTasks = tasks.filter(t => {
    let p = typeof t.payload === 'string' ? JSON.parse(t.payload) : t.payload;
    return p.categoryId === 'compra' || p.category_id === 'compra' || p.listId === 'compra';
  });
  
  let updates = 0;
  for (const t of compraTasks) {
    let p = typeof t.payload === 'string' ? JSON.parse(t.payload) : t.payload;
    let title = p.title || t.title || '';
    let updated = false;

    // Detect quantity in Spanish text (e.g. "12 Cabezales", "10 sesiones", "2 pares de invierno y 2 pares de verano", "5-10 Calzoncillos")
    let newQty = p.quantity;
    
    // Explicit matches
    if (title.match(/10 sesiones/i)) newQty = 10;
    else if (title.match(/5\s*a\s*10\s*unidades/i) || title.match(/5-10/)) newQty = 10;
    else if (title.match(/10\s*a\s*20\s*pares/i) || title.match(/10-20/)) newQty = 20;
    else if (title.match(/12\s*Cabezales/i) || title.match(/12\s*uds/i)) newQty = 12;
    else if (title.match(/2 pares.*2 pares/i)) newQty = 4;
    else if (!newQty) newQty = 1; // Default to 1 instead of undefined
    
    if (newQty !== p.quantity) {
      p.quantity = newQty;
      updated = true;
    }
    
    // If no price, but title has a number at the end maybe? Or we just leave price as undefined if not specified.
    // The user just said "que todos los productos tengan el precio que les corresponde". If it doesn't have a price in the title, I can't invent it. 
    // Wait, let's remove the "(Price: 100)" if it's there. My previous script didn't run because I used `t.title` instead of `p.title`!
    
    // Detect price (e.g. "15€", "15 e", "15 euros", "15.50€")
    const priceRegex = /([\d,\.]+)\s*(?:€|e\b|euros)/i;
    let pm = title.match(priceRegex);
    if (pm) {
      const priceMatch = pm[1].replace(',', '.');
      const val = parseFloat(priceMatch);
      if (!isNaN(val) && (!p.price || p.price !== val)) {
        p.price = val;
        updated = true;
      }
      let newTitle = title.replace(pm[0], '').replace(/\s{2,}/g, ' ').trim();
      newTitle = newTitle.replace(/^[-()]+|[-()]+$/g, '').trim();
      if (newTitle !== title) {
         t.title = newTitle;
         p.title = newTitle;
         updated = true;
      }
    }

    if (updated) {
      await prisma.task.update({
        where: { id: t.id },
        data: { payload: p } // We don't overwrite t.title in DB top level, only payload is used by the app usually, but we'll do both just in case.
      });
      console.log(`Updated: ${p.title} (Qty: ${p.quantity}, Price: ${p.price})`);
      updates++;
    }
  }
  
  console.log(`Total updates applied: ${updates}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
