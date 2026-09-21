import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  const allTasks = await prisma.task.findMany({ where: { deletedAt: null } });
  
  const parsed = allTasks.map(t => {
    let p = typeof t.payload === 'string' ? JSON.parse(t.payload) : t.payload;
    return { id: t.id, ...p, originalTitle: t.title };
  });

  const categories = ['limpieza', 'care', 'compra'];
  
  const tree = {};

  for (const t of parsed) {
    const cat = t.categoryId || t.category_id || '';
    const section = t.sectionId || t.section_id || '';
    
    // Check if it belongs to one of the target categories
    const isTarget = categories.some(c => cat.toLowerCase().includes(c) || section.toLowerCase().includes(c) || t.title.toLowerCase().includes(c));
    if (!isTarget && t.parentId) continue; // might be subtask, handled later
    
    if (!tree[cat]) tree[cat] = [];
    tree[cat].push(t);
  }
  
  // Sort and build hierarchy
  let output = '# Task Audit\n\n';
  
  const cats = Object.keys(tree).sort();
  for (const c of cats) {
    output += `## Category: ${c || 'No Category'}\n`;
    
    const rootTasks = tree[c].filter(t => !t.parentId).sort((a,b) => (a.order || 0) - (b.order || 0));
    
    for (const t of rootTasks) {
      output += `- [${t.timeOfDay || 'none'}] ${t.title} ${t.price ? '('+t.price+'€)' : ''} (Cycle: ${t.cycle_id})\n`;
      const children = tree[c].filter(ch => ch.parentId === t.id).sort((a,b) => (a.order || 0) - (b.order || 0));
      for (const ch of children) {
         output += `  - [${ch.timeOfDay || 'none'}] ${ch.title}\n`;
      }
    }
    output += '\n';
  }

  fs.writeFileSync('task_audit_dump.md', output);
  console.log('Audit dumped to task_audit_dump.md');
}

main().catch(console.error).finally(() => prisma.$disconnect());
