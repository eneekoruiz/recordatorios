import fs from 'fs';

const file = 'src/store/useAppStore.ts';
let content = fs.readFileSync(file, 'utf8');

const regex = /const grouped:\s*Record<string,\s*TaskItem\[\]>\s*=\s*\{\};\s*Array\.from\(tasksToInclude\.values\(\)\)\.forEach\(task\s*=>\s*\{\s*let catId\s*=\s*task\.categoryId \|\| \(task as any\)\.category_id;\s*if \(\!catId\)\s*\{\s*catId\s*=\s*\(currentView === 'smart_primeros_pasos'\)\s*\?\s*'primeros_pasos'\s*:\s*'inbox';\s*\}\s*if \(\!grouped\[catId\]\)\s*grouped\[catId\]\s*=\s*\[\];\s*grouped\[catId\]\.push\(task\);\s*\}\);\s*return grouped;/m;

const newGrouping = `const grouped: Record<string, TaskItem[]> = {};
    if (currentView === 'cycle_day') {
      Array.from(tasksToInclude.values()).forEach(task => {
        let catId = task.timeOfDay ? \`tod_\${task.timeOfDay}\` : 'tod_none';
        if (!grouped[catId]) grouped[catId] = [];
        grouped[catId].push(task);
      });
      // Sort by logical time of day
      const order = ['tod_morning', 'tod_afternoon', 'tod_night', 'tod_none'];
      const sortedGrouped: Record<string, TaskItem[]> = {};
      order.forEach(k => {
        if (grouped[k]) sortedGrouped[k] = grouped[k];
      });
      return sortedGrouped;
    } else {
      Array.from(tasksToInclude.values()).forEach(task => {
        let catId = task.categoryId || (task as any).category_id;
        if (!catId) {
          catId = (currentView === 'smart_primeros_pasos') ? 'primeros_pasos' : 'inbox';
        }
        if (!grouped[catId]) grouped[catId] = [];
        grouped[catId].push(task);
      });
      return grouped;
    }`;

content = content.replace(regex, newGrouping);

fs.writeFileSync(file, content);
