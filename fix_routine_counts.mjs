import fs from 'fs';
const file = 'src/components/layout/MainContent.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace routineCounts with null where it is used as shorthand
content = content.replace(/\broutineCounts,\n/g, 'routineCounts: null,\n');

// Also remove any stray git conflict markers
content = content.replace(/<<<<<<< HEAD[\s\S]*?=======\s*/g, '');
content = content.replace(/>>>>>>> [^\n]+\n/g, '');

fs.writeFileSync(file, content);
