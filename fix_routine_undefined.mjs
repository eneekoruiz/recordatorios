import fs from 'fs';
const file = 'src/components/layout/MainContent.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/let tasksToRender = categoryTasks;/g, 'let tasksToRender = categoryTasks;\nlet routineCounts = null;');

fs.writeFileSync(file, content);
