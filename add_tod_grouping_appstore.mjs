import fs from 'fs';

const file = 'src/store/useAppStore.ts';
let content = fs.readFileSync(file, 'utf8');

const regex = /const grouped: Record<string, TaskItem\[\]> = \{\};\s*Array\.from\(tasksToInclude\.values\(\)\)\s*\.sort\(\(a: any, b: any\) => new Date\(a\.created_at\)\.getTime\(\) - new Date\(b\.created_at\)\.getTime\(\)\)\s*\.forEach\(\(t: any\) => \{\s*const listId = t\.categoryId \|\| \(t as any\)\.category_id \|\| 'inbox';\s*if \(!grouped\[listId\]\) grouped\[listId\] = \[\];\s*grouped\[listId\]\.push\(t\);\s*\}\);/;

const newGrouping = `const grouped: Record<string, TaskItem[]> = {};
        const sortedTasks = Array.from(tasksToInclude.values())
          .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          
        if (cycleId === 'cycle_day') {
          sortedTasks.forEach((t: any) => {
            const tod = t.timeOfDay ? \`tod_\${t.timeOfDay}\` : 'tod_none';
            if (!grouped[tod]) grouped[tod] = [];
            grouped[tod].push(t);
          });
          const order = ['tod_morning', 'tod_afternoon', 'tod_night', 'tod_none'];
          const sortedGrouped: Record<string, TaskItem[]> = {};
          order.forEach(k => { if (grouped[k]) sortedGrouped[k] = grouped[k]; });
          return sortedGrouped;
        } else {
          sortedTasks.forEach((t: any) => {
            const listId = t.categoryId || (t as any).category_id || 'inbox';
            if (!grouped[listId]) grouped[listId] = [];
            grouped[listId].push(t);
          });
        }`;

content = content.replace(regex, newGrouping);

fs.writeFileSync(file, content);
