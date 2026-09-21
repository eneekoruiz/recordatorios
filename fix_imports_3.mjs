import fs from 'fs';

let content2 = fs.readFileSync('src/components/tasks/card/TaskContextMenu.tsx', 'utf8');
content2 = content2.replace(/formatSectionTitle\((.*?)\)/g, "$1");
fs.writeFileSync('src/components/tasks/card/TaskContextMenu.tsx', content2);

// And in SectionContextMenu.tsx it also failed? No, SectionContextMenu is not in the error list anymore!
// Wait, I should also clean unused imports in TaskCard.tsx and MainContent.tsx just to be safe.
let taskCard = fs.readFileSync('src/components/tasks/TaskCard.tsx', 'utf8');
taskCard = taskCard.replace("Image as ImageIcon, MoreHorizontal, Trash2, Calendar,", "MoreHorizontal,");
fs.writeFileSync('src/components/tasks/TaskCard.tsx', taskCard);

let mainContent = fs.readFileSync('src/components/layout/MainContent.tsx', 'utf8');
mainContent = mainContent.replace("ensureRoutineSections, ", "");
mainContent = mainContent.replace("isLimpiezaList, isRoutineList, ", "");
fs.writeFileSync('src/components/layout/MainContent.tsx', mainContent);

console.log('Fixed errors');
