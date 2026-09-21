import fs from 'fs';

const file = 'src/store/useAppStore.ts';
let content = fs.readFileSync(file, 'utf8');

const regex = /const sortedTasks = Array\.from\(tasksToInclude\.values\(\)\)\s*\.sort\(\(a: any, b: any\) => new Date\(a\.created_at\)\.getTime\(\) - new Date\(b\.created_at\)\.getTime\(\)\);/;

const newSorting = `const sortedTasks = Array.from(tasksToInclude.values())
          .sort((a: any, b: any) => {
            const cyclesList = get().cycles || [];
            const cA = cyclesList.find((c: any) => c.id === a.cycle_id)?.daysValue || 999;
            const cB = cyclesList.find((c: any) => c.id === b.cycle_id)?.daysValue || 999;
            if (cA !== cB) return cA - cB;
            
            const todOrder: Record<string, number> = { morning: 1, afternoon: 2, night: 3, none: 4 };
            const todA = todOrder[a.timeOfDay || 'none'] || 4;
            const todB = todOrder[b.timeOfDay || 'none'] || 4;
            if (todA !== todB) return todA - todB;
            
            if ((a.order ?? 0) !== (b.order ?? 0)) return (a.order ?? 0) - (b.order ?? 0);
            
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          });`;

content = content.replace(regex, newSorting);

fs.writeFileSync(file, content);
