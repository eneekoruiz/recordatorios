import fs from 'fs';
const file = 'src/components/layout/MainContent.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace the cascading logic block in both places
content = content.replace(/let tasksToRender = categoryTasks;[\s\S]*?(?=\/\/\s*Si se está filtrando por temporalidad|<<<<<<< HEAD|flat\.push)/g, 'let tasksToRender = categoryTasks;\n            ');

fs.writeFileSync(file, content);
