import fs from 'fs';

const files = [
  'src/components/layout/main/MainSectionHeader.tsx',
  'src/components/layout/main/SectionContextMenu.tsx',
  'src/components/tasks/card/TaskContextMenu.tsx',
  'src/components/tasks/drawer/DrawerFinanceSection.tsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  // Keep the cosmetic branch part (after =======)
  content = content.replace(/<<<<<<< HEAD[\s\S]*?=======\r?\n/g, '');
  content = content.replace(/>>>>>>> [^\n]+\r?\n/g, '');
  fs.writeFileSync(file, content);
});
