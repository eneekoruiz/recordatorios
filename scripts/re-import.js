import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'eneekoruiz@gmail.com' }
  });
  if (!user) throw new Error("User not found");
  const USER_ID = user.id;

  const content = fs.readFileSync('extracted_data.txt', 'utf-8');
  const lines = content.split('\n');

  let importedCount = 0;
  
  for (const line of lines) {
    if (!line || line.startsWith('===NEW') || line.startsWith('List Name')) continue;
    
    let cols = line.split('\t');
    if (cols.length < 8) cols = line.split('","').join('"|"').split('",').join('"|').split(',"').join('|"').split(',');
    
    // clean up quotes
    cols = cols.map(c => c.replace(/^"|"$/g, ''));
    if (cols.length < 8) continue;

    const listName = cols[0]?.trim();
    const title = cols[1]?.trim();
    const notes = cols[2]?.trim();
    const dueDateRaw = cols[3]?.trim();
    const isCompletedStr = cols[4]?.trim().toLowerCase();
    const priorityStr = cols[5]?.trim();
    const createdAtRaw = cols[7]?.trim();

    if (!title || !listName) continue;

    const categoryId = listName.toLowerCase();
    
    // priority map
    let priority = 0;
    if (priorityStr.includes('High')) priority = 1;
    else if (priorityStr.includes('Medium')) priority = 5;
    else if (priorityStr.includes('Low')) priority = 9;

    const now = new Date().toISOString();
    
    function parseDateSafe(val) {
      if (!val || val.trim() === '') return undefined;
      const d = new Date(val);
      return isNaN(d.getTime()) ? undefined : d.toISOString();
    }

    const payload = {
      id: uuidv4(),
      user_id: USER_ID,
      categoryId,
      type: 'task',
      title,
      description: notes || undefined,
      dueDate: parseDateSafe(dueDateRaw),
      status: isCompletedStr === 'true' ? 'completed' : 'pending',
      priority,
      created_at: parseDateSafe(createdAtRaw) || now,
      updated_at: now,
      version: 1,
      alerts: [],
      blockedBy: [],
      completedAlerts: [],
      completionHistory: []
    };

    await prisma.task.create({
      data: {
        id: payload.id,
        userId: USER_ID,
        payload
      }
    });

    importedCount++;
  }

  console.log(`Successfully re-imported ${importedCount} tasks for ${user.email}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
